import type { RawRecord } from './policy'
import { fields } from './schema'
export interface Person { id: string; name?: string }
export interface ReviewTask {
  recordId: string; taskText: string; owner: Person | null; executors: Person[]; submitter: Person | null
  tags: string[]; status: string; startDate: number | null; dueDate: number | null; createdAt: number | null
  priority?: string; parentRecordIds: string[]; errors: string[]
}
/** Input is the existing REST records API shape, not CLI-rendered cells. Missing cells mean empty only after schema validation. */
export function normalizeRecord(raw: RawRecord): ReviewTask {
  const errors: string[] = [], cells = raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields) ? raw.fields : {}
  if (cells !== raw.fields) errors.push('RECORD_FIELDS_UNREADABLE')
  if (typeof raw.record_id !== 'string' || !raw.record_id) errors.push('RECORD_ID_UNREADABLE')
  function text(key: keyof typeof fields): string {
    const value = cells[fields[key]]
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value) && value.every(v => v && typeof v.text === 'string')) return value.map(v => v.text).join('')
    errors.push(`INVALID_CELL:${fields[key]}`); return ''
  }
  function people(key: 'owner' | 'executors' | 'submitter'): Person[] {
    const value = cells[fields[key]]
    if (value == null) return []
    const list = Array.isArray(value) ? value : [value]
    if (!list.every(v => v && typeof v.id === 'string' && /^ou_[A-Za-z0-9]+$/.test(v.id))) {
      errors.push(`INVALID_CELL:${fields[key]}`); return []
    }
    return list.map(v => ({ id: v.id, ...(typeof v.name === 'string' ? { name: v.name } : {}) }))
  }
  function date(key: 'createdAt' | 'startDate' | 'dueDate'): number | null {
    const value = cells[fields[key]]
    if (value == null) return null
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
    errors.push(`INVALID_CELL:${fields[key]}`); return null
  }
  const tags = cells[fields.tags], parent = cells[fields.parentRecordIds]
  let parentRecordIds: string[] = []
  if (parent != null) {
    if (Array.isArray(parent)) {
      for (const value of parent) {
        if (typeof value === 'string' && value) parentRecordIds.push(value)
        else if (value && typeof value.record_id === 'string' && value.record_id) parentRecordIds.push(value.record_id)
        else if (value && Array.isArray(value.record_ids) && value.record_ids.every((id: unknown) => typeof id === 'string' && id)) parentRecordIds.push(...value.record_ids)
        else errors.push('INVALID_PARENT_CELL')
      }
    } else errors.push('INVALID_PARENT_CELL')
  }
  if (tags != null && (!Array.isArray(tags) || !tags.every(v => typeof v === 'string'))) errors.push('INVALID_TAG_CELL')
  const owners = people('owner'), submitters = people('submitter')
  if (owners.length > 1) errors.push('INVALID_OWNER_CARDINALITY')
  if (submitters.length !== 1) errors.push('SUBMITTER_UNREADABLE')
  return { recordId: raw.record_id, taskText: text('taskText'), owner: owners[0] ?? null,
    executors: people('executors'), submitter: submitters[0] ?? null,
    tags: Array.isArray(tags) && tags.every(v => typeof v === 'string') ? [...new Set(tags)] : [],
    status: text('status'), startDate: date('startDate'), dueDate: date('dueDate'), createdAt: date('createdAt'),
    priority: text('priority'), parentRecordIds, errors }
}
