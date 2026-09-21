import type { ReviewTask } from './normalizer'
import { groups, robotTypes, statuses } from './schema'
export interface Issue { code: string; reason: string }
export interface RuleResult { group: string | null; robotTypes: string[]; issues: Issue[]; errors: string[]; dateIssues: Issue[] }
export function parseTags(tags: string[]) {
  return { groups: tags.filter(t => (groups as readonly string[]).includes(t)),
    robotTypes: tags.filter(t => (robotTypes as readonly string[]).includes(t)),
    unknown: tags.filter(t => !([...groups, ...robotTypes] as string[]).includes(t)) }
}
/** Creation snapshot must come from a verified creation source; current read state is not an initial-state substitute. */
export interface CreationSnapshot { recordId: string; createdAt: number; initialStatus: string }
export function validateTask(task: ReviewTask, records: Map<string, ReviewTask>, complete: boolean, creation?: CreationSnapshot): RuleResult {
  const parsed = parseTags(task.tags)
  const result: RuleResult = { group: parsed.groups.length === 1 ? parsed.groups[0] : null,
    robotTypes: parsed.robotTypes, issues: [], errors: [...task.errors], dateIssues: [] }
  const fail = (code: string, reason: string, date = false) => { const issue = { code, reason }; result.issues.push(issue); if (date) result.dateIssues.push(issue) }
  if (parsed.unknown.length) result.errors.push('UNKNOWN_TAG_OPTIONS')
  if (!task.taskText.trim()) fail('TASK_EMPTY', '任务描述不能为空')
  if (!task.owner) fail('OWNER_EMPTY', '任务负责人必须填写')
  if (!task.executors.length) fail('EXECUTORS_EMPTY', '任务执行人至少填写一人')
  if (task.startDate === null) fail('START_EMPTY', '开始日期必须填写', true)
  if (!(statuses as readonly string[]).includes(task.status)) fail('STATUS_INVALID', '进展不是已确认的合法状态')
  if (!creation || creation.recordId !== task.recordId || creation.createdAt !== task.createdAt) result.errors.push('CREATION_SNAPSHOT_REQUIRED')
  else if (['已完成', '已放弃'].includes(creation.initialStatus)) fail('INITIAL_STATUS_INVALID', '新建时不能直接选择已完成或已放弃')
  else if (!(statuses as readonly string[]).includes(creation.initialStatus)) fail('INITIAL_STATUS_INVALID', '创建时进展不合法')
  if (parsed.groups.length !== 1) fail('GROUP_COUNT', '必须且只能选择一个真正组别')
  if (result.group === '运营') {
    if (parsed.robotTypes.length > 1) fail('OPERATIONS_ROBOT_COUNT', '运营最多选择一个兵种')
  } else if (result.group && !parsed.robotTypes.length) fail('ROBOT_EMPTY', '非运营任务必须选择至少一个兵种')
  if (!task.parentRecordIds.length) {
    const mentioned = robotTypes.filter(r => task.taskText.includes(r))
    if ((result.group !== '运营' || parsed.robotTypes.length > 0) && parsed.robotTypes.length && !mentioned.some(r => parsed.robotTypes.includes(r))) fail('TITLE_ROBOT_MISSING', '主任务描述须体现至少一个已选兵种')
    if (mentioned.some(r => !parsed.robotTypes.includes(r))) fail('TITLE_ROBOT_CONFLICT', '任务描述中的兵种与所选兵种冲突')
  }
  if (['进行中', '已停滞'].includes(task.status) && task.dueDate === null) fail('DUE_EMPTY', '进行中或已停滞任务必须填写预计完成日期', true)
  if (task.startDate !== null && task.dueDate !== null && task.startDate > task.dueDate) fail('DATE_ORDER', '开始日期不能晚于预计完成日期', true)
  if (task.parentRecordIds.length > 1) fail('PARENT_COUNT', '子任务只能关联一个父任务')
  for (const id of task.parentRecordIds) {
    if (id === task.recordId) { fail('PARENT_SELF', '不能关联自身作为父任务'); continue }
    const parent = records.get(id)
    if (!parent) { if (complete) fail('PARENT_MISSING', '关联的父任务不存在'); else result.errors.push('PARENT_UNCONFIRMED'); continue }
    if (parent.errors.length) { result.errors.push('PARENT_UNREADABLE'); continue }
    if (parent.parentRecordIds.length) fail('PARENT_IS_CHILD', '父任务自身也是子任务，不允许三级结构或循环关联')
    if (task.dueDate !== null && parent.dueDate !== null && task.dueDate > parent.dueDate) fail('CHILD_DUE', '子任务截止日期不能晚于父任务', true)
  }
  if (!complete) result.errors.push('RECORD_SNAPSHOT_INCOMPLETE')
  return result
}
