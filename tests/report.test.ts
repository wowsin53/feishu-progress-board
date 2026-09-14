import { afterEach,describe,expect,it,vi } from 'vitest'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve,sep } from 'node:path'
import { createHmac } from 'node:crypto'
import axios from 'axios'
import { createMockDashboard } from '../src/mock/dashboard'
import { getTaskHealth } from '../src/utils/task-health'
import { deriveDashboard,taskStatus } from '../src/utils/dashboard'
import { generateDailyReport } from '../server/reports/generate'
import { ReportStore } from '../server/reports/store'
import { ReportService } from '../server/reports/service'
import { ReportDeliveryError,sendWebhook,webhookConfig,webhookPayload } from '../server/reports/webhook'
import { isReportDue,reportSchedule,startReportScheduler } from '../server/reports/scheduler'
const now=Date.parse('2026-09-14T21:00:00+08:00')
function live(){const data=createMockDashboard(now);data.source='feishu';data.checkInSource='mock';return data}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()})
describe('统一截止日期状态',()=>{
  it('空日期、逾期、48小时边界互斥；完成和放弃不告警',()=>{
    const data=live(),base={...data.tasks[0]!,status:'进行中' as const}
    data.tasks=[
      {...base,id:'empty',deadline:undefined}, {...base,id:'spaces',deadline:' '},
      {...base,id:'late',deadline:new Date(now-1).toISOString()},
      {...base,id:'edge',deadline:new Date(now+48*3600000).toISOString()},
      {...base,id:'future',deadline:new Date(now+48*3600000+1).toISOString()},
      {...base,id:'completed',deadline:undefined,status:'已完成'},
      {...base,id:'abandoned',deadline:undefined,status:'已放弃'},
      {...base,id:'invalid',deadline:'not-a-date'},
    ]
    expect(data.tasks.map(t=>getTaskHealth(t,now))).toEqual(['missing_deadline','missing_deadline','overdue','upcoming','normal','completed','abandoned','invalid_deadline'])
    const view=deriveDashboard(data,'全部成员',now)
    expect(view.missingDeadlines.map(t=>t.id)).toEqual(['empty','spaces'])
    expect(view.overdue.map(t=>t.id)).toEqual(['late'])
    expect(view.upcoming.map(t=>t.id)).toEqual(['edge'])
    expect(taskStatus({...base,status:'已逾期',deadline:undefined},now)).toBe('未填写截止日期')
    expect(getTaskHealth({...base,deadline:new Date(now).toISOString()},now)).toBe('upcoming')
  })
})
describe('真实数据日报生成',()=>{
  it('包含五组、真实任务统计和独立缺日期检查，虚拟打卡不冒充考勤',()=>{
    const data=live();data.tasks[1]!.status='进行中';data.tasks[1]!.deadline=undefined
    const report=generateDailyReport(data,now)
    expect(report.date).toBe('2026-09-14')
    for(const text of ['RoboMaster','任务总数：48','运营组','操作手组','未填写截止日期','虚拟演示数据']) expect(report.text).toContain(text)
    expect(report.text).toContain('当前有效任务累计完成占比')
    expect(report.text).toContain(data.tasks[1]!.title)
    expect(()=>generateDailyReport(createMockDashboard(now),now)).toThrow('LIVE_TASKS')
  })
  it('无缺日期显示正常提示；超长日报限制详情但保持总数',()=>{
    const data=live()
    expect(generateDailyReport(data,now).text).toContain('所有未完成任务均已填写截止日期')
    data.tasks=Array.from({length:300},(_,i)=>({...data.tasks[0]!,id:'long'+i,title:'很长的任务名称'.repeat(50),status:'进行中' as const,deadline:undefined,priority:3}))
    const text=generateDailyReport(data,now).text
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(18000)
    expect(text).toContain('任务总数：300');expect(text).toContain('另有')
  })
})
describe('日报持久化与发送保护',()=>{
  it('并发手动和自动请求只发送一次，重启后仍保留成功记录',async()=>{
    vi.useFakeTimers();vi.setSystemTime(now)
    const dir=mkdtempSync(join(tmpdir(),'fs-report-test-')),path=join(dir,'reports.sqlite')
    const store=new ReportStore(path),second=new ReportStore(path)
    const deliver=vi.fn(async()=>{})
    const config=()=>({url:'https://open.feishu.cn/open-apis/bot/v2/hook/test',secret:''})
    const service=new ReportService(store,async()=>live(),deliver,config)
    const other=new ReportService(second,async()=>live(),deliver,config)
    try{
      const result=await Promise.all([service.send('manual'),other.send('automatic'),service.send('manual')])
      expect(result.filter(r=>r.status==='sent')).toHaveLength(1);expect(deliver).toHaveBeenCalledTimes(1)
      expect(store.get('2026-09-14')).toMatchObject({state:'sent',mode:'manual',attempts:1})
      expect(store.history().length).toBe(3)
    }finally{store.close();second.close()}
    const reopened=new ReportStore(path)
    try{expect(reopened.claim('2026-09-14','automatic',now+60000)).toBe(false)}finally{reopened.close();if(resolve(dir).startsWith(resolve(tmpdir())+sep))rmSync(dir,{recursive:true})}
  })
  it('明确失败可重试，网络结果未知不盲目重发',async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);vi.spyOn(console,'error').mockImplementation(()=>{})
    const store=new ReportStore(':memory:')
    const deliver=vi.fn().mockRejectedValueOnce(new ReportDeliveryError('WEBHOOK_REJECTED_19024')).mockRejectedValueOnce(new ReportDeliveryError('WEBHOOK_DELIVERY_UNCONFIRMED',true))
    const service=new ReportService(store,async()=>live(),deliver,()=>({url:'test',secret:''}))
    try{
      expect((await service.send('manual')).status).toBe('failed')
      expect((await service.send('manual')).status).toBe('unknown')
      expect((await service.send('automatic')).status).toBe('skipped')
      expect((await service.send('manual')).status).toBe('skipped')
      expect(deliver).toHaveBeenCalledTimes(2)
      expect(store.history()).toHaveLength(6)
    }finally{store.close()}
  })
  it('生成中断允许重新生成，发送中断转为待核对，旧请求不能夺回发送权',()=>{
    const store=new ReportStore(':memory:')
    try{
      store.claim('2026-09-14','automatic',now)
      store.recoverStale(now+600001)
      expect(store.get('2026-09-14')?.state).toBe('failed')
      expect(store.claim('2026-09-14','manual',now+600002)).toBe(true)
      expect(store.update('2026-09-14','sending',null,now+600003,undefined,1)).toBe(false)
      expect(store.update('2026-09-14','sending',null,now+600003,undefined,2)).toBe(true)
      store.recoverStale(now+1200005)
      expect(store.get('2026-09-14')?.state).toBe('unknown')
      expect(store.claim('2026-09-14','manual',now+1300000)).toBe(false)
    }finally{store.close()}
  })
})
describe('Webhook 和服务器定时器',()=>{
  it('签名与地址校验；错误日志不会带 Webhook 或密钥',async()=>{
    const payload=webhookPayload('日报','test-secret',now)
    expect(payload.sign).toBe(createHmac('sha256',String(Math.floor(now/1000))+'\n'+'test-secret').update('').digest('base64'))
    expect(()=>webhookConfig({FEISHU_WEBHOOK_URL:'https://evil.example/hook/test'})).toThrow('INVALID_WEBHOOK')
    expect(()=>webhookConfig({})).toThrow('NOT_CONFIGURED')
    vi.spyOn(axios,'post').mockRejectedValueOnce(new Error('private secret URL'))
    await expect(sendWebhook('日报',{url:'https://open.feishu.cn/open-apis/bot/v2/hook/test',secret:'private'})).rejects.toMatchObject({message:'WEBHOOK_DELIVERY_UNCONFIRMED',uncertain:true})
  })
  it('北京时间22点调度、重启补发检查及清理；不依赖浏览器',async()=>{
    vi.useFakeTimers();vi.setSystemTime(now)
    expect(reportSchedule({REPORT_ENABLED:'true',REPORT_SEND_TIME:'22:00'})).toEqual({enabled:true,time:'22:00',timezone:'Asia/Shanghai'})
    expect(()=>reportSchedule({REPORT_SEND_TIME:'25:00'})).toThrow()
    expect(isReportDue(now,'22:00')).toBe(false)
    expect(isReportDue(now+3600000,'22:00')).toBe(true)
    const run=vi.fn(async()=>({status:'skipped',record:undefined})),stop=startReportScheduler(run,{REPORT_ENABLED:'true',REPORT_SEND_TIME:'22:00'})
    await vi.advanceTimersByTimeAsync(3600000);expect(run).toHaveBeenCalledTimes(1)
    stop();await vi.advanceTimersByTimeAsync(60000);expect(run).toHaveBeenCalledTimes(1)
    const stopAgain=startReportScheduler(run,{REPORT_ENABLED:'true',REPORT_SEND_TIME:'22:00'})
    await vi.advanceTimersByTimeAsync(1);expect(run).toHaveBeenCalledTimes(2);stopAgain()
  })
})
