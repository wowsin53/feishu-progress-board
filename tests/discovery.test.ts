import { describe, expect, it } from 'vitest'
import { normalizeDiscovered, parseBaseLink, selectTables, withVirtualCheckIns, type TableSchema } from '../server/discovery'
import { deriveDashboard } from '../src/utils/dashboard'
const schema: TableSchema = {table_id:'tblTest',name:'任务表',fields:['任务名称','负责人','状态','截止日期','组别'].map(field_name=>({field_name,type:1}))}
describe('链接识别与混合数据源',()=>{
  it('填写中的任务单独列出，不中断正常任务；补全后自动恢复',()=>{
    const valid={record_id:'good',fields:{任务名称:'正常任务',负责人:[{id:'ou_test',name:'测试成员'}],状态:'进行中'}}
    const draft={record_id:'draft',fields:{任务名称:'新建子任务',负责人:[],状态:''}}
    const result=normalizeDiscovered([valid,draft],schema)
    expect(result.tasks).toHaveLength(1)
    expect(result.incompleteTasks).toEqual([{id:'draft',title:'新建子任务',reason:'待补充：负责人或执行人、任务状态'}])
    expect(result.warnings.join(' ')).toContain('1 条任务待补充信息')
    const restored=normalizeDiscovered([valid,{...draft,fields:{...draft.fields,负责人:valid.fields.负责人,状态:'进行中'}}],schema)
    expect(restored.tasks).toHaveLength(2)
    expect(restored.incompleteTasks).toEqual([])
  })
  it('适配真实表字段、多选组别、执行人、父任务和空白行',()=>{
    const actual: TableSchema = {table_id:'tblActual',name:'数据表',fields:['任务描述','任务负责人','任务执行人','进展','组别','预计完成日期','重要紧急程度','父记录','开始日期'].map(field_name=>({field_name,type:1}))}
    expect(selectTables([actual]).task).toBe(actual)
    const owner={id:'ou_owner',name:'测试负责人'}, executor={id:'ou_executor',name:'测试执行人'}
    const data=normalizeDiscovered([
      {record_id:'recBlank',fields:{开始日期:1789257600000}},
      {record_id:'recParent',fields:{任务描述:'父任务',任务负责人:[owner],任务执行人:[owner,executor],进展:'进行中',组别:['重装','电控'],预计完成日期:Date.parse('2026-10-04'),重要紧急程度:'重要紧急'}},
      {record_id:'recChild',fields:{任务描述:'子任务',任务负责人:[owner],进展:'待开始',组别:['电控','重装'],父记录:{link_record_ids:['recParent']}}},
      {record_id:'recAbandoned',fields:{任务描述:'取消任务',任务负责人:[owner],进展:'已放弃',组别:['电控'],预计完成日期:Date.parse('2020-01-01')}},
      {record_id:'recStalled',fields:{任务描述:'停滞任务',任务负责人:[owner],进展:'已停滞',组别:['电控']}},
    ],actual)
    expect(data.tasks).toHaveLength(4)
    expect(data.members).toHaveLength(2)
    expect(data.members.every(m=>m.group==='电控组')).toBe(true)
    expect(data.tasks[0]).toMatchObject({priority:3,memberIds:['ou_owner','ou_executor'],tags:['重装','电控']})
    expect(data.tasks[1]).toMatchObject({status:'未开始',parentIds:['recParent'],parentTitles:['父任务']})
    const view=deriveDashboard(data,'全部成员',Date.now())
    expect(view.summary.unfinishedTasks).toBe(3)
    expect(view.overdue.some(t=>t.id==='recAbandoned')).toBe(false)
  })
  it('仅解析合法飞书Base链接，不对任意URL发起请求',()=>{
    expect(parseBaseLink('https://girtrobotlab.feishu.cn/base/IPtmbKzAlalpS1sHv4Wc5YvhnHg?from=from_copylink')).toEqual({token:'IPtmbKzAlalpS1sHv4Wc5YvhnHg',tableId:undefined})
    expect(()=>parseBaseLink('https://evil.example/base/fake')).toThrow()
    expect(()=>parseBaseLink('https://example.feishu.cn/wiki/fake')).toThrow()
  })
  it('发现唯一任务表，多个候选要求消歧',()=>{
    expect(selectTables([schema]).task.table_id).toBe('tblTest')
    expect(()=>selectTables([schema,{...schema,table_id:'tblOther'}])).toThrow('多个任务表')
  })
  it('从人员字段读取真实负责人，打卡独立模拟且同日稳定',()=>{
    const live = normalizeDiscovered([{record_id:'recTask',fields:{任务名称:'真实任务',负责人:[{id:'ou_test',name:'测试成员'}],状态:'进行中',组别:'电控组',截止日期:Date.parse('2026-09-20')}}],schema)
    expect(live.source).toBe('feishu')
    expect(live.members[0]!.id).toBe('ou_test')
    const now=Date.parse('2026-09-13T12:00:00+08:00')
    const mixed=withVirtualCheckIns(live,now)
    expect(mixed.tasks).toEqual(live.tasks)
    expect(mixed.checkInSource).toBe('mock')
    expect(mixed.checkIns).toEqual(withVirtualCheckIns(live,now+3600000).checkIns)
    expect(mixed.checkIns.every(c=>c.memberIds[0]==='ou_test')).toBe(true)
  })
  it('关联记录缺少成员表时拒绝伪造姓名',()=>{
    expect(()=>normalizeDiscovered([{record_id:'recTask',fields:{任务名称:'测试',负责人:[{record_ids:['recMember']}],状态:'进行中'}}],schema)).toThrow('成员表')
  })
})
