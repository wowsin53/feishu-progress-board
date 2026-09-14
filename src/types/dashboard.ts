export type Group = '机械组' | '电控组' | '视觉组' | '其他'
export type TaskStatus = '未开始' | '进行中' | '待验收' | '已完成' | '已逾期' | '已停滞' | '已放弃'
export interface Member { id: string; name: string; group: Group; active: boolean; joinedAt: string }
export interface Task { id: string; title: string; memberIds: string[]; group: Group; status: TaskStatus; priority: number; startAt?: string; deadline?: string; completedAt?: string; progress: number; description: string; tags?: string[]; parentIds?: string[]; parentTitles?: string[] }
export interface CheckIn { id: string; memberIds: string[]; date: string; valid: boolean }
export interface DashboardData { members: Member[]; tasks: Task[]; checkIns: CheckIn[]; source: 'mock' | 'feishu'; checkInSource?: 'mock' | 'feishu'; syncedAt: string; historyStart: string; warnings: string[]; incompleteTasks?: { id: string; title: string; reason: string }[] }
export interface MemberView extends Member { tasks: Task[]; completed: Task[]; pending: Task[]; checkedIn: boolean; missedDays: number; missedIsMinimum: boolean; completion: number | null }
