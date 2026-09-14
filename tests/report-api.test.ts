import {it,expect,vi} from 'vitest'
import express from 'express'
import {createReportRouter} from '../server/reports/routes'
import {ReportService} from '../server/reports/service'
import {ReportStore} from '../server/reports/store'
import {createMockDashboard} from '../src/mock/dashboard'
it('管理员鉴权、预览、立即发送、日志与同日去重',async()=>{
  vi.stubEnv('ADMIN_REPORT_TOKEN','test-only-admin-token-32-characters-long')
  vi.stubEnv('REPORT_ENABLED','false');vi.stubEnv('REPORT_SEND_TIME','22:00')
  const data=createMockDashboard();data.source='feishu';data.checkInSource='mock'
  const store=new ReportStore(':memory:'),deliver=vi.fn(async()=>{})
  const service=new ReportService(store,async()=>data,deliver,()=>({url:'test-only',secret:''}))
  const app=express();app.use('/api/admin/reports',createReportRouter(()=>service))
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r))
  const address=server.address();if(!address || typeof address==='string')throw new Error('server not listening')
  const url='http://127.0.0.1:'+address.port+'/api/admin/reports/'
  const headers={Authorization:'Bearer test-only-admin-token-32-characters-long'}
  try{
    expect((await fetch(url+'send',{method:'POST'})).status).toBe(401)
    expect((await fetch(url+'preview',{headers:{Authorization:'Bearer wrong'}})).status).toBe(401)
    expect(deliver).not.toHaveBeenCalled()
    expect(await (await fetch(url+'status',{headers})).json()).toMatchObject({time:'22:00',timezone:'Asia/Shanghai',enabled:false})
    expect(await (await fetch(url+'preview',{headers})).json()).toHaveProperty('text')
    expect(deliver).not.toHaveBeenCalled()
    expect(await (await fetch(url+'send',{method:'POST',headers})).json()).toMatchObject({status:'sent',record:{state:'sent',mode:'manual'}})
    expect(await (await fetch(url+'send',{method:'POST',headers})).json()).toMatchObject({status:'skipped',record:{state:'sent'}})
    expect(deliver).toHaveBeenCalledTimes(1)
    expect((await (await fetch(url+'history',{headers})).json()).records).toHaveLength(3)
    vi.stubEnv('ADMIN_REPORT_TOKEN','')
    expect((await fetch(url+'preview',{headers})).status).toBe(503)
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));store.close();vi.unstubAllEnvs()}
})
