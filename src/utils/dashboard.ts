import type { DashboardData, Group, MemberView, Task } from '../types/dashboard'
import { dateKey, dayStart, shiftDay } from './date'
import { getTaskHealth, isActiveTask } from './task-health'
export { getTaskHealth, isActiveTask } from './task-health'
export const isOverdue = (task: Task, now = Date.now()) => getTaskHealth(task,now) === 'overdue'
export const taskStatus = (task: Task, now = Date.now()) => {
  const health=getTaskHealth(task,now)
  if(health==='overdue') return '已逾期'
  if(health==='missing_deadline') return '未填写截止日期'
  if(health==='invalid_deadline') return '截止日期无效'
  return task.status==='已逾期' ? '未完成' : task.status
}
export const overdueDays = (task: Task, now = Date.now()) => task.deadline ? Math.max(1, dayStart(dateKey(now)).diff(dayStart(dateKey(task.deadline)), 'day')) : 0
export const pendingOrder = (a: Task, b: Task) => b.priority - a.priority || (Date.parse(a.deadline || '') || Infinity) - (Date.parse(b.deadline || '') || Infinity)
export function deriveDashboard(data: DashboardData, group: Group | '全部成员', now = Date.now()) {
  const today = dateKey(now)
  const valid = new Map<string, Set<string>>()
  for (const c of data.checkIns) if (c.valid) for (const id of c.memberIds) {
    if (!valid.has(id)) valid.set(id, new Set())
    valid.get(id)!.add(c.date)
  }
  const members: MemberView[] = data.members.filter(m => m.active && m.joinedAt <= today && (group === '全部成员' || m.group === group)).map(m => {
    const tasks = data.tasks.filter(t => t.memberIds.includes(m.id))
    const completed = tasks.filter(t => t.status === '已完成').sort((a,b) => (Date.parse(b.completedAt || '') || 0) - (Date.parse(a.completedAt || '') || 0))
    const pending = tasks.filter(isActiveTask).sort(pendingOrder)
    let cursor = today, missedDays = 0
    const first = m.joinedAt > data.historyStart ? m.joinedAt : data.historyStart
    while (cursor >= first && !valid.get(m.id)?.has(cursor)) { missedDays++; cursor = shiftDay(cursor, -1) }
    const effectiveTotal = tasks.filter(t => t.status !== '已放弃').length
    return { ...m, tasks, completed, pending, checkedIn: !!valid.get(m.id)?.has(today), missedDays, missedIsMinimum: cursor < data.historyStart && m.joinedAt < data.historyStart, completion: effectiveTotal ? Math.round(completed.length / effectiveTotal * 100) : null }
  })
  const ids = new Set(members.map(m => m.id))
  const tasks = data.tasks.filter(t => t.memberIds.some(id => ids.has(id)))
  const overdue = tasks.filter(t => isOverdue(t, now)).sort((a,b) => Date.parse(a.deadline!) - Date.parse(b.deadline!))
  const upcoming = tasks.filter(t => getTaskHealth(t,now) === 'upcoming').sort((a,b) => Date.parse(a.deadline!) - Date.parse(b.deadline!))
  const missingDeadlines = tasks.filter(t => getTaskHealth(t,now)==='missing_deadline').sort(pendingOrder)
  const absent = members.filter(m => !m.checkedIn).sort((a,b) => b.missedDays - a.missedDays)
  return { members, tasks, overdue, upcoming, missingDeadlines, absent, summary: { checkedIn: members.length - absent.length, notCheckedIn: absent.length, unfinishedTasks: tasks.filter(isActiveTask).length, overdueTasks: overdue.length } }
}
