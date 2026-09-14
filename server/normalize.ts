import type { DashboardData, Group, TaskStatus } from '../src/types/dashboard'
import { dateKey, deadlineValue } from '../src/utils/date'
export interface FeishuRecord { record_id: string; fields: Record<string, unknown> }
const object = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null ? v as Record<string,unknown> : {}
export const fieldText = (v: unknown): string => typeof v === 'string' || typeof v === 'number' ? String(v) : Array.isArray(v) ? v.map(fieldText).join('') : String(object(v).text ?? object(v).name ?? '')
export const fieldBoolean = (v: unknown) => v === true || v === 1 || ['是','已打卡','在队','true','1'].includes(fieldText(v).trim())
const groupValue = (v: unknown): Group => { const g = fieldText(v); return g === '机械组' || g === '电控组' || g === '视觉组' ? g : '其他' }
function dateField(v: unknown, exact = true): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const text = fieldText(v)
  const value = typeof v === 'number' ? v : /^\d{12,13}$/.test(text) ? Number(text) : text
  return deadlineValue(value,exact)
}
export function normalizeRecords(memberRows: FeishuRecord[], taskRows: FeishuRecord[], checkRows: FeishuRecord[], exactDeadline = false): DashboardData {
  const warnings: string[] = []
  const aliases = new Map<string, Set<string>>()
  const addAlias = (alias: string, id: string) => { if (alias) { if(!aliases.has(alias)) aliases.set(alias,new Set()); aliases.get(alias)!.add(id) } }
  const members = memberRows.map(r => {
    const f = r.fields, id = fieldText(f['成员ID']) || r.record_id, name = fieldText(f['姓名'])
    if (!name || f['是否在队'] === undefined) throw new Error('成员表缺少姓名或是否在队字段')
    addAlias(r.record_id,id); addAlias(id,id); addAlias(name,id)
    const joined = dateField(f['加入时间'])
    if (!joined) throw new Error('成员表缺少有效加入时间')
    return { id,name,group:groupValue(f['组别']),active:fieldBoolean(f['是否在队']),joinedAt:dateKey(joined) }
  })
  if (new Set(members.map(m=>m.id)).size !== members.length) throw new Error('成员ID不唯一')
  const resolve = (v: unknown): string[] => {
    const keys = (x: unknown): string[] => {
      if (typeof x === 'string') return [x]
      if (Array.isArray(x)) return x.flatMap(keys)
      const obj = object(x)
      if (obj.record_ids) return keys(obj.record_ids)
      if (obj.link_record_ids) return keys(obj.link_record_ids)
      return [fieldText(obj.id),fieldText(obj.text),fieldText(obj.name)].filter(Boolean)
    }
    const resolved = new Set<string>()
    for (const key of keys(v)) { const found = aliases.get(key); if (found?.size === 1) resolved.add([...found][0]!) ; else if (found && found.size > 1) throw new Error('姓名存在重名，请使用关联成员表字段') }
    return [...resolved]
  }
  const statuses = new Set<TaskStatus>(['未开始','进行中','待验收','已完成','已逾期','已停滞','已放弃'])
  const tasks = taskRows.map(r => {
    const f = r.fields, memberIds = resolve(f['负责人']), status = fieldText(f['任务状态']) as TaskStatus
    if (!memberIds.length) throw new Error('任务负责人无法关联成员，请检查成员ID或关联字段')
    if (!statuses.has(status)) throw new Error('任务状态无效')
    const title = fieldText(f['任务名称'])
    if (!title) throw new Error('任务名称为空')
    const priorityText = fieldText(f['任务优先级'])
    const priority = ['高','紧急','P0','P1','重要紧急','紧急不重要'].includes(priorityText) ? 3 : ['中','P2','重要不紧急'].includes(priorityText) ? 2 : 1
    const deadline = dateField(f['截止日期'], exactDeadline)
    if (!deadline && status !== '已完成') warnings.push('部分未完成任务缺少截止日期，未计入截止提醒')
    return { id:fieldText(f['任务ID']) || r.record_id,title,memberIds,group:groupValue(f['所属组别']),status,priority,deadline,startAt:dateField(f['开始日期']),completedAt:dateField(f['完成日期']),progress:Math.min(100,Math.max(0,Number(f['任务进度']) || 0)),description:fieldText(f['任务描述']) }
  })
  const checkIns = checkRows.map(r => {
    const f = r.fields, memberIds = resolve(f['成员']), date = dateField(f['日期'])
    if (!date || !memberIds.length || f['是否打卡'] === undefined) throw new Error('打卡表日期、成员或是否打卡字段无效')
    return {id:r.record_id,memberIds,date:dateKey(date),valid:fieldBoolean(f['是否打卡'])}
  })
  // All record pages are read, so absence is measured from the member's join date.
  const historyStart = members.reduce((first,m)=>m.joinedAt < first ? m.joinedAt : first,dateKey())
  return {members,tasks,checkIns,source:'feishu',syncedAt:new Date().toISOString(),historyStart,warnings:[...new Set(warnings)]}
}
