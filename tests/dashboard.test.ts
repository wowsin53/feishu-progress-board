import { describe,it,expect } from 'vitest'
import { createMockDashboard } from '../src/mock/dashboard'
import { deriveDashboard,isOverdue } from '../src/utils/dashboard'
import { dateKey,deadlineValue } from '../src/utils/date'
import { dailyQuote,quotes } from '../src/utils/quotes'
import { normalizeRecords, type FeishuRecord } from '../server/normalize'
const now=Date.parse('2026-09-12T12:00:00+08:00')
describe('任务与打卡统计',()=>{
  it('演示数据覆盖成员、分组、任务、打卡与异常',()=>{
    const data=createMockDashboard(now),view=deriveDashboard(data,'全部成员',now)
    expect(data.members.length).toBeGreaterThanOrEqual(15);expect(data.tasks).toHaveLength(48)
    expect(new Set(data.members.map(m=>m.group)).size).toBe(5)
    expect(view.summary.checkedIn+view.summary.notCheckedIn).toBe(16)
    expect(view.overdue.length).toBeGreaterThan(0);expect(view.upcoming.length).toBeGreaterThan(0)
  })
  it('日期截止在北京时间当天结束，完成任务永不逾期',()=>{
    const task=createMockDashboard(now).tasks[0]!
    task.status='进行中';task.deadline=deadlineValue('2026-09-12')
    expect(isOverdue(task,Date.parse('2026-09-12T23:59:59+08:00'))).toBe(false)
    expect(isOverdue(task,Date.parse('2026-09-13T00:00:00+08:00'))).toBe(true)
    task.status='已完成';expect(isOverdue(task,now+86400000)).toBe(false)
    expect(dateKey('2026-09-12T18:00:00Z')).toBe('2026-09-13')
  })
  it('支持精确时间截止与48小时边界',()=>{
    const data=createMockDashboard(now),task=data.tasks[0]!
    task.status='进行中';task.deadline=new Date(now+48*3600000).toISOString();data.tasks=[task]
    expect(deriveDashboard(data,'全部成员',now).upcoming).toHaveLength(1)
    task.deadline=new Date(now+48*3600000+1).toISOString()
    expect(deriveDashboard(data,'全部成员',now).upcoming).toHaveLength(0)
    expect(deadlineValue('2026-09-12T14:00:00+08:00',true)).toBe('2026-09-12T06:00:00.000Z')
  })
  it('按人员分组筛选，共同负责人任务仅计一次，离队成员不计入',()=>{
    const data=createMockDashboard(now)
    data.tasks[0]!.memberIds.push(data.members[4]!.id)
    data.members[0]!.active=false
    const view=deriveDashboard(data,'电控组',now)
    expect(view.members).toHaveLength(3)
    expect(view.tasks.every(t=>t.memberIds.some(id=>view.members.some(m=>m.id===id)))).toBe(true)
    expect(new Set(view.tasks.map(t=>t.id)).size).toBe(view.tasks.length)
  })
  it('重复打卡去重、无效记录不计、连续缺卡截止于上次有效记录',()=>{
    const data=createMockDashboard(now),id=data.members[0]!.id
    data.checkIns=[{id:'1',memberIds:[id],date:'2026-09-10',valid:true},{id:'2',memberIds:[id],date:'2026-09-12',valid:false}]
    let view=deriveDashboard(data,'全部成员',now)
    expect(view.members[0]!.missedDays).toBe(2)
    data.checkIns.push({id:'3',memberIds:[id],date:'2026-09-12',valid:true},{id:'4',memberIds:[id],date:'2026-09-12',valid:true})
    view=deriveDashboard(data,'全部成员',now)
    expect(view.summary.checkedIn).toBe(1);expect(view.members[0]!.missedDays).toBe(0)
  })
  it('历史不足明确标记下限，加入前日期不计，零任务不显示0%',()=>{
    const data=createMockDashboard(now);data.checkIns=[];data.tasks=[]
    const view=deriveDashboard(data,'全部成员',now)
    expect(view.members[0]!.missedIsMinimum).toBe(true);expect(view.members[0]!.completion).toBeNull()
    data.members[0]!.joinedAt='2026-09-12'
    expect(deriveDashboard(data,'全部成员',now).members[0]!.missedDays).toBe(1)
  })
  it('语录同日固定，跨北京时间午夜切换，至少30条',()=>{
    expect(quotes.length).toBeGreaterThanOrEqual(30)
    expect(dailyQuote(now)).toBe(dailyQuote(now+3600000))
    expect(dailyQuote(now)).not.toBe(dailyQuote(now+86400000))
  })
})
describe('飞书字段清洗',()=>{
  const members:FeishuRecord[]=[{record_id:'recA',fields:{成员ID:'M1',姓名:[{text:'测试成员'}],组别:'电控组',是否在队:true,加入时间:Date.parse('2026-09-01T00:00:00+08:00')}}]
  it('解析富文本、关联记录、多负责人和日期',()=>{
    const data=normalizeRecords(members,[{record_id:'task1',fields:{任务名称:[{text:'CAN测试'}],负责人:[{record_ids:['recA']}],任务状态:'进行中',截止日期:Date.parse('2026-09-12T00:00:00+08:00')}}],[{record_id:'check1',fields:{成员:{link_record_ids:['recA']},日期:Date.parse('2026-09-12T00:00:00+08:00'),是否打卡:true}}])
    expect(data.tasks[0]!.memberIds).toEqual(['M1']);expect(data.checkIns[0]!.memberIds).toEqual(['M1']);expect(data.tasks[0]!.deadline).toBe('2026-09-12T15:59:59.999Z')
    expect(data.historyStart).toBe('2026-09-01')
  })
  it('无法关联的负责人触发错误，不静默丢任务',()=>{
    expect(()=>normalizeRecords(members,[{record_id:'task1',fields:{任务名称:'测试',负责人:'不存在',任务状态:'进行中'}}],[])).toThrow('负责人')
  })
  it('重复成员ID和未知任务状态阻止错误统计',()=>{
    expect(()=>normalizeRecords([...members,...members],[],[])).toThrow('成员ID')
    expect(()=>normalizeRecords(members,[{record_id:'task1',fields:{任务名称:'测试',负责人:'M1',任务状态:'取消'}}],[])).toThrow('任务状态')
  })
})
