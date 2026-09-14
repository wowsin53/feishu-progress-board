import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'
export type ReportMode='manual'|'automatic'
export type ReportState='generating'|'sending'|'sent'|'failed'|'unknown'
export interface ReportRecord { date:string; state:ReportState; mode:ReportMode; generatedAt:string|null; sentAt:string|null; updatedAt:string; error:string|null; attempts:number }
export class ReportStore {
  private db:DatabaseSync
  constructor(path:string){
    if(path!==':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700})
    this.db=new DatabaseSync(path)
    if(path!==':memory:') chmodSync(path,0o600)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reports(date TEXT PRIMARY KEY,state TEXT NOT NULL,mode TEXT NOT NULL,generatedAt TEXT,sentAt TEXT,updatedAt TEXT NOT NULL,error TEXT,attempts INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS report_events(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL,state TEXT NOT NULL,mode TEXT NOT NULL,generatedAt TEXT,sentAt TEXT,updatedAt TEXT NOT NULL,error TEXT,attempts INTEGER NOT NULL)')
  }
  get(date:string){return this.db.prepare("SELECT * FROM reports WHERE date=?").get(date) as unknown as ReportRecord|undefined}
  history(){return this.db.prepare("SELECT * FROM report_events ORDER BY id DESC LIMIT 100").all()}
  private event(date:string){this.db.prepare("INSERT INTO report_events(date,state,mode,generatedAt,sentAt,updatedAt,error,attempts) SELECT date,state,mode,generatedAt,sentAt,updatedAt,error,attempts FROM reports WHERE date=?").run(date)}
  claim(date:string,mode:ReportMode,now=Date.now()):boolean{
    this.db.exec('BEGIN IMMEDIATE')
    try{
      const existing=this.get(date)
      if(existing && (existing.state!=='failed' || (mode==='automatic' && (existing.attempts>=3 || now-Date.parse(existing.updatedAt)<600000)))){this.db.exec('COMMIT');return false}
      this.db.prepare("INSERT INTO reports(date,state,mode,updatedAt,attempts) VALUES(?,?,?,?,1) ON CONFLICT(date) DO UPDATE SET state=excluded.state,mode=excluded.mode,updatedAt=excluded.updatedAt,generatedAt=NULL,sentAt=NULL,error=NULL,attempts=reports.attempts+1").run(date,'generating',mode,new Date(now).toISOString())
      this.event(date);this.db.exec('COMMIT');return true
    }catch(error){this.db.exec('ROLLBACK');throw error}
  }
  update(date:string,state:ReportState,error:string|null=null,now=Date.now(),generatedAt?:string,attempt?:number,previousUpdate?:string){
    this.db.exec('BEGIN IMMEDIATE')
    try{
      const result=this.db.prepare("UPDATE reports SET state=?,error=?,updatedAt=?,generatedAt=COALESCE(?,generatedAt),sentAt=CASE WHEN ?='sent' THEN ? ELSE sentAt END WHERE date=? AND (? IS NULL OR attempts=?) AND (? IS NULL OR updatedAt=?) AND (? != 'sending' OR state='generating')").run(state,error,new Date(now).toISOString(),generatedAt||null,state,new Date(now).toISOString(),date,attempt??null,attempt??null,previousUpdate??null,previousUpdate??null,state)
      if(result.changes) this.event(date);this.db.exec('COMMIT');return !!result.changes
    }catch(error){this.db.exec('ROLLBACK');throw error}
  }
  recoverStale(now=Date.now()){
    // Generation has no external side effect. An interrupted sending phase is ambiguous.
    const rows=this.db.prepare("SELECT * FROM reports WHERE state IN ('generating','sending')").all() as unknown as ReportRecord[]
    for(const row of rows) if(now-Date.parse(row.updatedAt)>600000) this.update(row.date,row.state==='sending'?'unknown':'failed',row.state==='sending'?'DELIVERY_REQUIRES_GROUP_CHECK':'INTERRUPTED_BEFORE_SEND',now,undefined,row.attempts,row.updatedAt)
  }
  close(){this.db.close()}
}
