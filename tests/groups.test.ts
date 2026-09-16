import { describe, expect, it } from 'vitest'
import { GROUPS, normalizeGroup, normalizeTaskCategory } from '../src/config/groups'
import { normalizeDiscovered, type TableSchema } from '../server/discovery'
import { deriveDashboard } from '../src/utils/dashboard'
const schema:TableSchema={table_id:'t',name:'任务',fields:['任务描述','任务负责人','任务执行人','进展','组别','任务分类'].map(field_name=>({field_name,type:1}))}
describe('统一五组与历史分类兼容',()=>{
  it('五组别兼容有无组后缀，多选车型标签不影响归组',()=>{
    expect(GROUPS).toEqual(['机械组','电控组','视觉组','运营组','操作手组'])
    expect(normalizeGroup(['操作手','步兵'])).toBe('操作手组')
    expect(normalizeGroup('运营')).toBe('运营组')
    expect(normalizeGroup(['电控','重装'])).toBe('电控组')
    expect(normalizeGroup('其他')).toBeNull()
    expect(normalizeGroup(['机械','电控'])).toBeNull()
    expect(normalizeTaskCategory('其他')).toBe('联调任务')
    expect(normalizeTaskCategory('其他任务')).toBe('联调任务')
  })
  it('运营和操作手自动计入人数及任务统计；任务分类不改变成员分组',()=>{
    const rows=GROUPS.map((g,i)=>({record_id:'r'+i,fields:{任务描述:'任务'+i,任务负责人:[{id:'u'+i,name:'成员'+i}],进展:'进行中',组别:g,任务分类:i===3?'其他任务':'日常任务'}}))
    const data=normalizeDiscovered(rows,schema)
    const view=deriveDashboard(data,'全部成员')
    expect(view.members).toHaveLength(5)
    expect(view.summary.unfinishedTasks).toBe(5)
    expect(view.summary.notCheckedIn).toBe(5)
    expect(data.tasks[3]?.category).toBe('联调任务')
    expect(data.members[3]?.group).toBe('运营组')
    expect(deriveDashboard(data,'操作手组').members).toHaveLength(1)
    expect(rows[3]?.fields.任务分类).toBe('其他任务')
  })
  it('跨组协作和空白子任务不改变任务负责人的明确组别',()=>{
    const electrical={id:'e',name:'电控成员'},mechanical={id:'m',name:'机械成员'}
    const rows=[
      {record_id:'a',fields:{任务描述:'电控任务',任务负责人:[electrical],进展:'进行中',组别:['电控','重装']}},
      {record_id:'b',fields:{任务描述:'协作任务',任务负责人:[mechanical],任务执行人:[electrical],进展:'进行中',组别:['机械','重装']}},
      {record_id:'c',fields:{任务描述:'空白组别子任务',任务负责人:[mechanical],进展:'进行中',组别:[]}},
      {record_id:'d',fields:{任务描述:'跨组联调',任务负责人:[mechanical],任务执行人:[electrical],进展:'进行中',组别:['机械','电控']}},
    ]
    const data=normalizeDiscovered(rows,schema)
    expect(data.members.find(m=>m.id==='e')?.group).toBe('电控组')
    expect(data.members.find(m=>m.id==='m')?.group).toBe('机械组')
    expect(data.tasks).toHaveLength(4)
    expect(data.tasks[1]?.memberIds).toEqual(['m','e'])
  })
  it('历史其他组保留成员和任务但不伪造为新组',()=>{
    const data=normalizeDiscovered([{record_id:'r',fields:{任务描述:'联调',任务负责人:[{id:'u',name:'待确认成员'}],进展:'进行中',组别:'其他'}}],schema)
    expect(data.members[0]?.group).toBeNull()
    expect(data.tasks[0]?.category).toBe('联调任务')
    expect(deriveDashboard(data,'全部成员').summary.unfinishedTasks).toBe(1)
    expect(data.warnings.join('')).toContain('组别待确认')
  })
})

it('通讯录归组支持仅有跨组任务的成员，共同任务在双方显示且基地只计一次',()=>{
 const electrical={id:'e',name:'同名成员'},mechanical={id:'m',name:'同名成员'}
 const rows=[{record_id:'joint',fields:{任务描述:'跨组安装测试',任务负责人:[electrical],任务执行人:[electrical,mechanical],进展:'进行中',组别:['电控','机械']}}]
 const data=normalizeDiscovered(rows,schema,[],undefined,{e:'电控组',m:'机械组'})
 expect(data.members.map(m=>m.group)).toEqual(['电控组','机械组'])
 expect(data.tasks[0]?.memberIds).toEqual(['e','m'])
 const all=deriveDashboard(data,'全部成员')
 expect(all.summary.unfinishedTasks).toBe(1)
 expect(all.members.every(m=>m.pending.some(t=>t.id==='joint'))).toBe(true)
 for(const group of ['电控组','机械组'] as const)expect(deriveDashboard(data,group).summary.unfinishedTasks).toBe(1)
})
it('人员表优先于补充归组配置，未核实人员仍待分组',()=>{
 const rows=[{record_id:'joint',fields:{任务描述:'联调',任务负责人:[{id:'e',name:'甲'}],进展:'进行中',组别:['机械','电控']}}]
 expect(normalizeDiscovered(rows,schema).members[0]?.group).toBeNull()
 const memberTable:TableSchema={table_id:'members',name:'成员',fields:['成员ID','姓名','组别'].map(field_name=>({field_name,type:1}))}
 const data=normalizeDiscovered(rows,schema,[{record_id:'member',fields:{成员ID:'e',姓名:'甲',组别:'视觉组'}}],memberTable,{e:'电控组'})
 expect(data.members[0]?.group).toBe('视觉组')
})
