import type { Task } from '../types/dashboard'
export type TaskHealth = 'completed' | 'abandoned' | 'missing_deadline' | 'invalid_deadline' | 'overdue' | 'upcoming' | 'normal'
export const isActiveTask = (task: Task) => !['已完成','已放弃'].includes(task.status)
export function getTaskHealth(task: Task, now = Date.now()): TaskHealth {
  if (task.status === '已完成') return 'completed'
  if (task.status === '已放弃') return 'abandoned'
  if (!task.deadline?.trim()) return 'missing_deadline'
  const deadline=Date.parse(task.deadline)
  if (!Number.isFinite(deadline)) return 'invalid_deadline'
  if (now > deadline) return 'overdue'
  if (deadline-now <= 48*3600000) return 'upcoming'
  return 'normal'
}
