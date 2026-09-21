import type { ReviewTask } from './normalizer'
const base: ReviewTask = { recordId: 'main', taskText: '重装模块化发射机构', owner: null, executors: [], submitter: null, tags: ['机械', '重装'], status: '进行中', startDate: null, dueDate: null, createdAt: null, parentRecordIds: [], errors: [] }
const child = { ...base, recordId: 'child', taskText: '测试发射机构', parentRecordIds: ['main'] }
export const semanticCases = [
  { name: '独立', expected: 'INDEPENDENT', task: { ...base, recordId: 'new', taskText: '重装底盘减震结构优化' }, records: [base] },
  { name: '并入主任务', expected: 'MERGE_INTO_PARENT', task: { ...base, recordId: 'new', taskText: '重装发射机构测试' }, records: [base] },
  { name: '主任务重复', expected: 'DUPLICATE_MAIN', task: { ...base, recordId: 'new', taskText: '重装发射机构模块化改进' }, records: [base] },
  { name: '已有子任务重复', expected: 'DUPLICATE_CHILD', task: { ...base, recordId: 'new', taskText: '重装发射机构测试' }, records: [base, child] },
  { name: '合理子任务', expected: 'CHILD_VALID', task: { ...child, recordId: 'new' }, records: [base] },
  { name: '子任务越界', expected: 'CHILD_OUT_OF_SCOPE', task: { ...child, recordId: 'new', taskText: '设计整车主控板' }, records: [base] },
]
