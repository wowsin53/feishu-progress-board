/** Confirmed business classifications, checked against live field metadata on every run. */
export const groups = ['视觉', '电控', '机械', '操作手', '运营'] as const
export const robotTypes = ['重装', '步兵', '哨兵', '飞镖', '雷达', '无人机'] as const
export const statuses = ['已停滞', '待开始', '进行中', '已完成', '已放弃'] as const
export const fields = {
  taskText: '任务描述', owner: '任务负责人', executors: '任务执行人', tags: '组别',
  status: '进展', startDate: '开始日期', dueDate: '预计完成日期', parentRecordIds: '父记录',
  submitter: '填写人（系统）', createdAt: '填写时间（系统）', reviewResult: '填写审核结果',
  notificationState: '审核提醒状态', finalEffect: '最终效果', actualCompletionDate: '实际完成日期',
  difficulty: '遇到的困难', solution: '解决措施', priority: '重要紧急程度', delayStatus: '是否延期',
} as const
export interface FieldMetadata { name: string; type: string; multiple?: boolean; options?: { name: string }[]; link_table?: string }
const types: Record<keyof typeof fields, string> = {
  taskText: 'text', owner: 'user', executors: 'user', tags: 'select', status: 'select',
  startDate: 'datetime', dueDate: 'datetime', parentRecordIds: 'link', submitter: 'created_by',
  createdAt: 'created_at', reviewResult: 'text', notificationState: 'text', finalEffect: 'text',
  actualCompletionDate: 'datetime', difficulty: 'text', solution: 'text', priority: 'select', delayStatus: 'select',
}
export function validateSchema(metadata: FieldMetadata[], tableId: string): string[] {
  const errors: string[] = []
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const matches = metadata.filter(f => f.name === fields[key])
    if (matches.length !== 1 || matches[0]?.type !== types[key]) errors.push(`SCHEMA_FIELD:${fields[key]}`)
  }
  for (const [key, multiple] of [['owner', false], ['executors', true], ['tags', true], ['status', false]] as const) {
    if (metadata.find(f => f.name === fields[key])?.multiple !== multiple) errors.push(`SCHEMA_MULTIPLE:${fields[key]}`)
  }
  for (const [key, expected] of [['tags', [...groups, ...robotTypes]], ['status', [...statuses]]] as const) {
    const actual = metadata.find(f => f.name === fields[key])?.options?.map(o => o.name) ?? []
    if (actual.length !== expected.length || expected.some(v => !actual.includes(v))) errors.push(`SCHEMA_OPTIONS:${fields[key]}`)
  }
  if (metadata.find(f => f.name === fields.parentRecordIds)?.link_table !== tableId) errors.push('SCHEMA_PARENT_TABLE')
  return errors
}
