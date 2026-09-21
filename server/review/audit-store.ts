import { DatabaseSync } from 'node:sqlite'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AuditResult, AuditStore } from './dry-run'
/** Separate table from the legacy review worker. A claimed record is never automatically re-audited after a crash. */
export class SqliteAuditStore implements AuditStore {
  private db: DatabaseSync
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(path)
    if (path !== ':memory:') chmodSync(path, 0o600)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS review_v2_audits (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, state TEXT NOT NULL, result TEXT)')
  }
  get(id: string) {
    const row = this.db.prepare('SELECT state,result FROM review_v2_audits WHERE id=?').get(id)
    return row ? { state: String(row.state), result: row.result ? JSON.parse(String(row.result)) as AuditResult : undefined } : undefined
  }
  claim(id: string, hash: string) { return this.db.prepare('INSERT OR IGNORE INTO review_v2_audits(id,fingerprint,state) VALUES(?,?,?)').run(id, hash, 'processing').changes === 1 }
  finish(id: string, result: AuditResult) { this.db.prepare('UPDATE review_v2_audits SET state=?,result=? WHERE id=?').run('done', JSON.stringify(result), id) }
  close() { this.db.close() }
}
