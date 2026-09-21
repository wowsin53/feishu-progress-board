import type { ReviewTask } from './normalizer'
import { parseTags } from './rules'
export interface CandidateSet { tasks: ReviewTask[]; context: ReviewTask[]; truncated: boolean; errors: string[] }
const active = (t: ReviewTask) => ['待开始', '进行中'].includes(t.status)
/** Keyword overlap ranks recall only; it never rejects a task. Parent context is not itself a rejection target. */
export function findCandidates(task: ReviewTask, all: ReviewTask[], maxCandidates: number): CandidateSet {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 100) throw new Error('INVALID_CANDIDATE_LIMIT')
  const parsed = parseTags(task.tags), byId = new Map(all.map(t => [t.recordId, t]))
  const child = task.parentRecordIds.length === 1
  const score = (t: ReviewTask) => [...new Set(task.taskText.match(/[\u4e00-\u9fff]{2}|[a-z0-9]+/gi) ?? [])].filter(w => t.taskText.includes(w)).length
  const recalled = all.filter(t => {
    if (t.recordId === task.recordId || !active(t)) return false
    if (child) return t.parentRecordIds.length === 1 && t.parentRecordIds[0] === task.parentRecordIds[0]
    if (parsed.groups[0] === '运营' && !parsed.robotTypes.length) return t.tags.includes('运营') && !t.parentRecordIds.length
    return parseTags(t.tags).robotTypes.some(r => parsed.robotTypes.includes(r))
  })
  // Include active children of recalled main tasks even if a historic child omitted robot tags.
  const mainIds = new Set(recalled.filter(t => !t.parentRecordIds.length).map(t => t.recordId))
  if (!child) for (const t of all) if (active(t) && t.recordId !== task.recordId && t.parentRecordIds.length === 1 && mainIds.has(t.parentRecordIds[0]) && !recalled.includes(t)) recalled.push(t)
  recalled.sort((a, b) => score(b) - score(a) || a.recordId.localeCompare(b.recordId))
  const tasks = recalled.slice(0, maxCandidates)
  const parentIds = new Set([...task.parentRecordIds, ...tasks.flatMap(t => t.parentRecordIds)])
  const context = [...parentIds].flatMap(id => byId.has(id) && !tasks.some(t => t.recordId === id) ? [byId.get(id)!] : [])
  const errors: string[] = []
  if ([...tasks, ...context].some(t => t.errors.length)) errors.push('CANDIDATE_UNREADABLE')
  if ([...parentIds].some(id => !byId.has(id))) errors.push('CANDIDATE_PARENT_MISSING')
  return { tasks, context, truncated: recalled.length > tasks.length, errors }
}
