import type { RawRecord } from './policy'
import { fingerprint } from './policy'
import { normalizeRecord } from './normalizer'
import { validateSchema, type FieldMetadata } from './schema'
import { validateTask, type CreationSnapshot, type FirstObservation } from './rules'
import { findCandidates } from './candidates'
import { aiInput, rejecting, uncertain, validateSemantic, type ReviewAiProvider, type SemanticResult } from './ai'
import type { ReviewConfig } from './config'
export interface AuditInput { record: RawRecord; records: RawRecord[]; complete: boolean; metadata: FieldMetadata[]; tableId: string; creation?: CreationSnapshot; observation?: FirstObservation }
export interface AuditResult {
  observation?: FirstObservation; recordId: string; taskText: string; taskType: 'main' | 'child' | 'unknown'; reviewedAt: string
  decision: 'SKIPPED_HISTORY' | 'PASS' | 'WOULD_DELETE' | 'MANUAL_REVIEW_REQUIRED' | 'SYSTEM_ERROR'
  deleted: false; wouldDelete: boolean; notificationStatus: 'LOG_ONLY'; errors: string[]
  task: ReturnType<typeof normalizeRecord>; basic: ReturnType<typeof validateTask> | null
  candidates: { recordId: string; taskText: string }[]; semantic: SemanticResult | null
  fingerprint: string; threshold: number | null
}
/** Injectable persistence. Production transport is deliberately not selected in this release. */
export interface AuditStore { get(id: string): { state: string; result?: AuditResult } | undefined; claim(id: string, hash: string): boolean; finish(id: string, result: AuditResult): void }
export class MemoryAuditStore implements AuditStore {
  private rows = new Map<string, { state: string; result?: AuditResult }>()
  get(id: string) { return this.rows.get(id) }
  claim(id: string) { if (this.rows.has(id)) return false; this.rows.set(id, { state: 'processing' }); return true }
  finish(id: string, result: AuditResult) { this.rows.set(id, { state: 'done', result }) }
}
/** No delete, Feishu write or notification client exists in this engine's capability set. */
export class DryRunReviewer {
  private inFlight = new Map<string, Promise<AuditResult>>()
  constructor(private config: ReviewConfig, private provider: ReviewAiProvider, private store: AuditStore, private log: (line: string) => void = console.log) {
    if (config.dryRun !== true) throw new Error('LIVE_DELETE_NOT_IMPLEMENTED')
  }
  run(input: AuditInput): Promise<AuditResult> {
    const key = `${input.tableId}:${input.record.record_id}`
    const pending = this.inFlight.get(key)
    if (pending) return pending
    const promise = this.review(input, key).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, promise); return promise
  }
  private async review(input: AuditInput, key: string): Promise<AuditResult> {
    const cached = this.store.get(key)
    if (cached?.result) return cached.result
    const task = normalizeRecord(input.record), hash = fingerprint(input.record)
    const out: AuditResult = { recordId: task.recordId, taskText: task.taskText, taskType: task.errors.includes('INVALID_PARENT_CELL') ? 'unknown' : task.parentRecordIds.length ? 'child' : 'main',
      reviewedAt: new Date().toISOString(), observation: input.observation, task, fingerprint: hash, threshold: this.config.rejectConfidence,
      decision: 'SYSTEM_ERROR', deleted: false, wouldDelete: false, notificationStatus: 'LOG_ONLY', errors: [], basic: null, candidates: [], semantic: null }
    if (!this.store.claim(key, hash)) { out.errors.push('AUDIT_ALREADY_CLAIMED_MANUAL_CHECK'); return out }
    try {
      out.errors.push(...validateSchema(input.metadata, input.tableId))
      if (task.createdAt === null) out.errors.push('CREATED_AT_UNREADABLE')
      else if (task.createdAt < this.config.enabledAt) out.decision = 'SKIPPED_HISTORY'
      if (out.decision !== 'SKIPPED_HISTORY' && !out.errors.length) {
        const tasks = input.records.map(normalizeRecord), records = new Map(tasks.map(t => [t.recordId, t]))
        if (records.size !== tasks.length) out.errors.push('DUPLICATE_RECORD_IDS')
        out.basic = validateTask(task, records, input.complete, input.creation, input.observation)
        out.errors.push(...out.basic.errors)
        // An unreadable relationship could conceal children; never infer absence from a partial/invalid tree.
        if (tasks.some(t => t.errors.includes('INVALID_PARENT_CELL'))) out.errors.push('TREE_UNREADABLE')
        const hasChildren = tasks.some(t => t.parentRecordIds.includes(task.recordId))
        if (!out.errors.length && out.basic.issues.length) out.decision = hasChildren ? 'MANUAL_REVIEW_REQUIRED' : 'WOULD_DELETE'
        else if (!out.errors.length) {
          const candidates = findCandidates(task, tasks, this.config.maxCandidates)
          out.candidates = candidates.tasks.map(t => ({ recordId: t.recordId, taskText: t.taskText }))
          if (candidates.errors.length) out.errors.push(...candidates.errors)
          else {
            const parent = records.get(task.parentRecordIds[0])
            const payload = aiInput(task, candidates, parent)
            // Limit data sent without silently truncating task evidence.
            if (Buffer.byteLength(payload, 'utf8') > 64000) out.semantic = uncertain('AI_INPUT_TOO_LARGE')
            else {
              try { out.semantic = validateSemantic(await this.provider.evaluate(payload), task, candidates, parent) }
              catch (e) { out.semantic = uncertain(e instanceof Error && /^AI_[A-Z_]+$/.test(e.message) ? e.message : 'AI_REQUEST_FAILED') }
            }
            const semantic = out.semantic
            if (semantic.relation === 'UNCERTAIN') out.decision = 'MANUAL_REVIEW_REQUIRED'
            else if (rejecting(semantic.relation)) {
              out.decision = !hasChildren && this.config.rejectConfidence !== null && semantic.confidence >= this.config.rejectConfidence ? 'WOULD_DELETE' : 'MANUAL_REVIEW_REQUIRED'
            } else out.decision = 'PASS'
          }
        }
        if (out.errors.length) out.decision = out.errors.every(e => ['INITIAL_STATUS_UNVERIFIABLE', 'INVALID_PARENT_CELL', 'TREE_UNREADABLE', 'PARENT_UNREADABLE'].includes(e)) ? 'MANUAL_REVIEW_REQUIRED' : 'SYSTEM_ERROR'
        if (hasChildren && out.decision === 'MANUAL_REVIEW_REQUIRED') out.errors.push('LINKED_CHILDREN_PROTECTED')
      }
    } catch { out.decision = 'SYSTEM_ERROR'; out.errors.push('AUDIT_INTERNAL_ERROR') }
    out.wouldDelete = out.decision === 'WOULD_DELETE'
    this.store.finish(key, out)
    // Only a whitelisted audit object is logged. Never log HTTP errors, headers or provider config.
    this.log(`${out.wouldDelete ? '[WOULD_DELETE] ' : ''}${JSON.stringify(out)}`)
    return out
  }
}
