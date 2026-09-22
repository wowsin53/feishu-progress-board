import { missingRequired } from './readiness'
import type { RawRecord } from './policy'
import { normalizeRecord } from './normalizer'
import { validateSchema, type FieldMetadata } from './schema'
import type { AuditResult, AuditStore, DryRunReviewer } from './dry-run'
export interface ReviewReader { list(): Promise<RawRecord[]>; fields(): Promise<FieldMetadata[]>; get(id: string): Promise<RawRecord | null> }
/** Fixed cutoff, full pagination, durable claims; current state is never a creation snapshot. */
export class ReviewPoller {
  private running = false
  constructor(private api: ReviewReader, private reviewer: Pick<DryRunReviewer, 'run'>,
    private store: AuditStore, private tableId: string, private enabledAt: number,
    private log: (line: string) => void = console.log, private now = Date.now, private onAudit?: (result: AuditResult, records: RawRecord[]) => Promise<void>) {}
  async tick() {
    if (this.running) return
    this.running = true
    try {
      const metadata = await this.api.fields()
      const errors = validateSchema(metadata, this.tableId)
      if (errors.length) { this.log(JSON.stringify({ event: 'POLL_SCHEMA_BLOCKED', errors })); return }
      const records = await this.api.list()
      // Placeholder links are not proof of an empty parent. Recheck individually, at most three requests in flight.
      const unresolved = records.map((row, index) => ({ row, index })).filter(({ row }) => normalizeRecord(row).errors.includes('INVALID_PARENT_CELL'))
      for (let offset = 0; offset < unresolved.length; offset += 3) {
        await Promise.all(unresolved.slice(offset, offset + 3).map(async ({ row, index }) => {
          const fresh = await this.api.get(row.record_id)
          if (!fresh || fresh.record_id !== row.record_id) throw new Error('REVIEW_RECORD_RECHECK_FAILED')
          records[index] = fresh
        }))
      }
      const observedAt = this.now()
      // A failed/incomplete read must never become a completed audit.
      const tasks = records.map(normalizeRecord)
      if (tasks.some(t => !t.recordId) || new Set(tasks.map(t => t.recordId)).size !== tasks.length) throw new Error('REVIEW_INVALID_RECORD_SET')
      let reviewed = 0, skipped = 0, unreadable = 0, waiting = 0
      for (let i = 0; i < records.length; i++) {
        const task = tasks[i]!
        if (task.createdAt === null || task.createdAt > observedAt) { unreadable++; continue }
        if (task.createdAt < this.enabledAt) { skipped++; continue }
        if (missingRequired(task).length) { waiting++; continue }
        let key = this.tableId + ':' + task.recordId
        let existing = this.store.get(key)
        const recoverIncomplete = existing?.result && missingRequired(existing.result.task).some(f => f !== '重要紧急程度')
        if (recoverIncomplete) { key = this.tableId + ':filled:' + task.recordId; existing = this.store.get(key) }
        if (existing) {
          if (existing.result) await this.onAudit?.(existing.result, records)
          if (existing.state === 'processing') this.log(JSON.stringify({ event: 'MANUAL_REVIEW_REQUIRED', recordId: task.recordId, reason: 'INTERRUPTED_AUDIT_NOT_RETRIED' }))
          continue
        }
        const result = await this.reviewer.run({ record: records[i]!, records, complete: true, metadata, tableId: this.tableId,
          auditRevision: recoverIncomplete ? 'filled' : undefined, deferRelations: true, observation: { source: 'poll_first_read', observedAt, recordId: task.recordId, createdAt: task.createdAt } })
        await this.onAudit?.(result, records)
        reviewed++
      }
      this.log(JSON.stringify({ event: 'POLL_OK', dryRun: true, observedAt: new Date(observedAt).toISOString(), total: records.length, reviewed, skippedHistory: skipped, unreadableCreatedAt: unreadable, waitingForFields: waiting }))
    } catch (e) {
      this.log(JSON.stringify({ event: 'POLL_ERROR', error: e instanceof Error && /^REVIEW_[A-Z_0-9]+$/.test(e.message) ? e.message : 'REVIEW_POLL_FAILED' }))
    } finally { this.running = false }
  }
}
