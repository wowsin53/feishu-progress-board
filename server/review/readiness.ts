import type { ReviewTask } from './normalizer'
export function missingRequired(task: ReviewTask): string[] {
  return [
    [task.taskText.trim(), '任务描述'], [task.owner, '任务负责人'],
    [task.executors.length, '任务执行人'], [task.tags.length, '组别'],
    [task.status.trim(), '进展'], [task.startDate !== null, '开始日期'],
    [task.priority?.trim(), '重要紧急程度'],
  ].filter(([filled]) => !filled).map(([, name]) => String(name))
}
