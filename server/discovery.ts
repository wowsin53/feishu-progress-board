import { normalizeGroup, normalizeTaskCategory } from '../src/config/groups'
import type { DashboardData, Group, Member } from '../src/types/dashboard'
import { dateKey, shiftDay } from '../src/utils/date'
import { fieldText, normalizeRecords, type FeishuRecord } from './normalize'

export interface TableSchema { table_id: string; name: string; fields: { field_name: string; type: number }[] }
const taskAliases: Record<string, string[]> = {
  任务ID: ['任务ID'], 任务名称: ['任务名称','任务名','任务','事项','标题','名称','任务描述'],
  负责人: ['负责人','任务负责人','执行人','成员'], 任务状态: ['任务状态','状态','完成状态','进展'],
  所属组别: ['所属组别','组别','小组'], 开始日期: ['开始日期','开始时间'],
  截止日期: ['截止日期','截止时间','计划完成时间','计划完成日期','预计完成日期'],
  任务优先级: ['任务优先级','优先级','重要紧急程度'], 任务描述: ['任务描述','描述','说明'],
  完成日期: ['完成日期','完成时间','实际完成日期'], 任务进度: ['任务进度','进度'],
  任务分类: ['任务分类','任务类型','分类'], 父记录: ['父记录'], 任务执行人: ['任务执行人'],
}
const memberAliases: Record<string, string[]> = {
  成员ID: ['成员ID'], 姓名: ['姓名','成员姓名','成员名称'], 组别: ['组别','所属组别','小组'],
  是否在队: ['是否在队','在队'], 加入时间: ['加入时间','加入日期','入队时间'],
}
function mapping(table: TableSchema, aliases: Record<string,string[]>) {
  const names = new Set(table.fields.map(f => f.field_name))
  return Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, options.find(name => names.has(name))]))
}
export function selectTables(tables: TableSchema[], selectedTask?: string, selectedMember?: string) {
  const tasks = tables.filter(table => {
    if (selectedTask && table.table_id !== selectedTask) return false
    const fields = mapping(table, taskAliases)
    return fields['任务名称'] && fields['负责人'] && fields['任务状态']
  })
  if (tasks.length !== 1) throw new Error(tasks.length ? '发现多个任务表，请设置 FEISHU_TASKS_TABLE_ID' : '未识别到任务名称、负责人和任务状态字段，请检查表结构')
  const members = tables.filter(t => t.table_id !== tasks[0]!.table_id && (!selectedMember || t.table_id === selectedMember) && mapping(t,memberAliases)['姓名'])
  if (members.length > 1 || (selectedMember && members.length !== 1)) throw new Error('无法唯一识别成员表，请设置 FEISHU_MEMBERS_TABLE_ID')
  return { task: tasks[0]!, member: members[0] }
}
function remap(rows: FeishuRecord[], table: TableSchema, aliases: Record<string,string[]>) {
  const map = mapping(table, aliases)
  return rows.map(row => ({ record_id: row.record_id, fields: Object.fromEntries(Object.entries(map).filter(([,source]) => source).map(([target,source]) => [target,row.fields[source!]])) }))
}
const tagsOf = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).map(fieldText).filter(Boolean)
const toGroup = normalizeGroup
const personKey = (value: unknown): string => {
  const object = value && typeof value === 'object' ? value as Record<string,unknown> : {}
  return fieldText(object.id) || 'name:' + fieldText(object.name || object.text || value)
}
export function normalizeDiscovered(taskRows: FeishuRecord[], taskTable: TableSchema, memberRows: FeishuRecord[] = [], memberTable?: TableSchema): DashboardData {
  const incompleteTasks: NonNullable<DashboardData['incompleteTasks']> = []
  const tasks = remap(taskRows, taskTable, taskAliases).filter(row => {
    // Feishu creates empty rows with a default start date; only skip otherwise empty rows.
    return Object.entries(row.fields).some(([key,value]) => key !== '开始日期' && fieldText(value).trim())
  }).filter(row => {
    const f = row.fields
    const missing: string[] = []
    if (!fieldText(f['任务名称']).trim()) missing.push('任务名称')
    const hasPerson = (value: unknown): boolean => Array.isArray(value) ? value.some(hasPerson) : typeof value === 'object' && value !== null ? Object.values(value).some(hasPerson) : !!fieldText(value).trim()
    if (!hasPerson(f['负责人']) && !hasPerson(f['任务执行人'])) missing.push('负责人或执行人')
    const status = fieldText(f['任务状态'])
    if (!status) missing.push('任务状态')
    else if (!['待开始','未开始','进行中','待验收','已完成','已逾期','已停滞','已放弃'].includes(status)) missing.push('可识别的任务状态')
    if (!missing.length) return true
    incompleteTasks.push({id:row.record_id,title:fieldText(f['任务名称']) || '未命名任务',reason:`待补充：${missing.join('、')}`})
    return false
  })
  const members = memberTable ? remap(memberRows, memberTable, memberAliases) : []
  const warnings: string[] = []
  const metadata = new Map(tasks.map(task => {
    const parent = task.fields['父记录'] as { link_record_ids?: string[]; record_ids?: string[] } | undefined
    const parentIds = parent?.link_record_ids || parent?.record_ids || (Array.isArray(parent) ? parent.flatMap((p: unknown) => typeof p === 'string' ? [p] : (p as {record_ids?:string[]}).record_ids || []) : [])
    const rawOwners = task.fields['负责人']
    const primaryOwners = (Array.isArray(rawOwners) ? rawOwners : rawOwners ? [rawOwners] : []).map(personKey)
    return [task.record_id,{primaryOwners,tags:tagsOf(task.fields['所属组别']).map(normalizeTaskCategory),category:normalizeTaskCategory(fieldText(task.fields['任务分类'])) || (tagsOf(task.fields['所属组别']).some(t=>['其他','其他任务','联调任务'].includes(t)) ? '联调任务' : ''),parentIds}]
  }))
  for (const task of tasks) {
    task.fields['所属组别'] = toGroup(task.fields['所属组别'])
    if (task.fields['任务状态'] === '待开始') task.fields['任务状态'] = '未开始'
    const people = (value: unknown) => Array.isArray(value) ? value : value ? [value] : []
    task.fields['负责人'] = [...people(task.fields['负责人']),...people(task.fields['任务执行人'])]
  }
  if (!memberTable) {
    // A personnel field carries stable open_id + display name. Plain text uses a
    // stable name key; linked record IDs require an actual member table.
    const found = new Map<string, {name:string;groups:Set<Group>;ownedGroups:Set<Group>}>()
    for (const task of tasks) {
      const raw = task.fields['负责人']
      const owners = Array.isArray(raw) ? raw : [raw]
      const ids: string[] = []
      for (const owner of owners) {
        const object = typeof owner === 'object' && owner ? owner as Record<string,unknown> : {}
        if (object.record_ids || object.link_record_ids) throw new Error('负责人为关联记录，请配置对应成员表')
        const name = fieldText(object.name || object.text || owner)
        if (!name || /^rec[a-zA-Z0-9]+$/.test(name)) throw new Error('负责人缺少可读姓名，请配置成员表')
        const id = fieldText(object.id) || `name:${name}`
        const group = toGroup(task.fields['所属组别'])
        if (!found.has(id)) found.set(id,{name,groups:new Set(),ownedGroups:new Set()})
        if (group) {
          found.get(id)!.groups.add(group)
          if (metadata.get(task.record_id)?.primaryOwners.includes(id)) found.get(id)!.ownedGroups.add(group)
        }
        ids.push(id)
      }
      task.fields['负责人'] = ids
    }
    for (const [id,member] of found) {
      // Prefer tasks the person owns; assisting another group must not reclassify them.
      // Blank and multi-group tasks provide no unique personnel-group evidence.
      const candidates = member.ownedGroups.size ? member.ownedGroups : member.groups
      const group = candidates.size === 1 ? [...candidates][0] : null
      members.push({record_id:id,fields:{成员ID:id,姓名:member.name,组别:group,是否在队:true,加入时间:shiftDay(dateKey(),-7)}})
    }
    warnings.push('成员由任务负责人和执行人提取，未分配任务的成员暂不计入；打卡为虚拟数据')
  }
  for (const member of members) {
    if (member.fields['是否在队'] === undefined) member.fields['是否在队'] = true
    if (!member.fields['加入时间']) member.fields['加入时间'] = shiftDay(dateKey(),-7)
  }
  const result = normalizeRecords(members, tasks, [], process.env.DEADLINE_MODE === 'datetime')
  result.incompleteTasks = incompleteTasks
  if (incompleteTasks.length) warnings.push(`${incompleteTasks.length} 条任务待补充信息，单独展示且暂不计入任务统计`)
  for (const task of result.tasks) {
    const extra = metadata.get(task.id)
    task.tags = extra?.tags
    task.category = extra?.category || task.category
    task.parentIds = extra?.parentIds
    task.parentTitles = extra?.parentIds.map(id => result.tasks.find(parent => parent.id === id)?.title || id)
  }
  if (result.members.some(m=>!m.group)) warnings.push('部分成员的组别待确认，已保留人数及任务统计；请填写五个组别之一')
  result.warnings.push(...warnings)
  return result
}

export function withVirtualCheckIns(data: DashboardData, now = Date.now()): DashboardData {
  const today = dateKey(now)
  const hash = (member: Member) => [...member.id].reduce((value,char) => ((value * 31 + char.charCodeAt(0)) >>> 0),0)
  return {
    ...data, checkInSource:'mock', historyStart:shiftDay(today,-7),
    warnings:[...new Set([...data.warnings,'打卡为虚拟数据，不代表真实考勤'])],
    checkIns:data.members.flatMap(member => {
      const seed = hash(member)
      const missed = seed % 3 === 0 ? seed % 4 + 1 : 0
      return Array.from({length:8},(_,day) => ({id:`virtual:${member.id}:${day}`,memberIds:[member.id],date:shiftDay(today,-day),valid:day>=missed}))
    }),
  }
}

export function parseBaseLink(link: string): {token:string; tableId?:string} {
  const url = new URL(link)
  const token = url.pathname.match(/^\/base\/([a-zA-Z0-9]+)\/?$/)?.[1]
  if (url.protocol !== 'https:' || !/(^|\.)feishu\.cn$|(^|\.)larksuite\.com$/.test(url.hostname) || !token) throw new Error('请使用飞书多维表格 /base/ 链接')
  // The supplied URL is parsed only; all outgoing API requests use the fixed Feishu host.
  return { token, tableId:url.searchParams.get('table') || undefined }
}
