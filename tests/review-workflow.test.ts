import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
const workflow=JSON.parse(readFileSync(new URL('../deploy/review/workflow.json',import.meta.url),'utf8'))
const step=(id:string)=>workflow.steps.find((s:any)=>s.id===id)
it('只有明确通过才跳过提醒，待复核及异常输出不能静默丢失',()=>{
 const gate=step('is_rejected')
 const condition=gate.data.condition.conditions[0].conditions[0]
 expect(condition.left_value.value).toBe('$.route_result')
 expect(condition.operator).toBe('isNot')
 expect(condition.right_value).toEqual([{value_type:'text',value:'PASS'}])
 const target=(output:string)=>gate.children.links.find((l:any)=>l.kind===(output!==condition.right_value[0].value?'if_true':'if_false')).to
 for(const output of ['NOTIFY','','uncertain','reject'])expect(target(output)).toBe('pending_notice')
 expect(target('PASS')).toBe('finish')
 expect(step('save').next).toBe('route_result')
 expect(step('route_result').next).toBe('is_rejected')
 expect(step('pending_notice').next).toBe('advice')
 expect(step('advice').next).toBe('notify')
 expect(step('notify').next).toBe('notice_sent')
 expect(step('notice_sent').data.field_values[0].value[0].value).toBe('已发送')
})
it('新增立即读取审核，引用实际填写人，保留已通知去重分支',()=>{
 const ids=new Set(workflow.steps.map((s:any)=>s.id))
 for(const s of workflow.steps){if(s.next)expect(ids.has(s.next)).toBe(true);for(const link of s.children?.links||[])expect(ids.has(link.to)).toBe(true)}
 expect(step('added').type).toBe('AddRecordTrigger')
 expect(step('added').next).toBe('read')
 expect(step('grace')).toBeUndefined()
 expect(step('read').next).toBe('already_notified')
 expect(step('already_notified').children.links).toEqual([{kind:'if_true',to:'end_notified'},{kind:'if_false',to:'review'}])
 expect(step('notify').data.receiver).toEqual([{value_type:'ref',value:'$.read.firstfieldsRecord.fldFBtsuNV'}])
 expect(step('notify').data.send_to_everyone).toBe(false)
})
