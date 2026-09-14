import { DatabaseSync } from 'node:sqlite'
import { mkdirSync,chmodSync } from 'node:fs'
import { dirname } from 'node:path'
import { creator,decisionFor,fingerprint,linkedIds,text,type RawRecord } from './policy'
export interface Baseline{base:string;table:string;since:string;recordIds:string[]}
interface Entry{id:string;hash:string;changed:number;state:string;backup:string|null;error:string|null}
export class ReviewStore {
  db:DatabaseSync
  constructor(path:string){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);if(path!==':memory:')chmodSync(path,0o600);this.db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,hash TEXT NOT NULL,changed INTEGER NOT NULL,state TEXT NOT NULL,backup TEXT,error TEXT);CREATE TABLE IF NOT EXISTS review_events(id INTEGER PRIMARY KEY,record_id TEXT,state TEXT,at INTEGER,error TEXT)')}
  get(id:string){return this.db.prepare('SELECT * FROM reviews WHERE id=?').get(id) as unknown as Entry|undefined}
  observe(r:RawRecord,now:number){const h=fingerprint(r),old=this.get(r.record_id);if(!old)this.db.prepare('INSERT INTO reviews(id,hash,changed,state) VALUES(?,?,?,?)').run(r.record_id,h,now,'observed');else if(old.hash!==h&&['observed','passed','manual','notified','error'].includes(old.state))this.db.prepare('UPDATE reviews SET hash=?,changed=?,state=?,backup=NULL,error=NULL WHERE id=?').run(h,now,'observed',r.record_id);return this.get(r.record_id)!}
  set(id:string,state:string,error:string|null=null,backup?:RawRecord){this.db.prepare('UPDATE reviews SET state=?,error=?,backup=COALESCE(?,backup) WHERE id=?').run(state,error,backup?JSON.stringify(backup):null,id);this.db.prepare('INSERT INTO review_events(record_id,state,at,error) VALUES(?,?,?,?)').run(id,state,Date.now(),error);console.log(JSON.stringify({event:'task_review',record:id,state,error}))}
  pending(){return this.db.prepare("SELECT * FROM reviews WHERE state IN ('delete_pending','notification_sending')").all() as unknown as Entry[]}
}
export interface ReviewClient {list():Promise<RawRecord[]>;get(id:string):Promise<RawRecord|null>;remove(id:string):Promise<void>}
export class ReviewWorker {
  private old:Set<string>
  constructor(private api:ReviewClient,public store:ReviewStore,private baseline:Baseline,private now=Date.now){if(!Number.isFinite(Date.parse(baseline.since))||!baseline.recordIds.length)throw new Error('REVIEW_BASELINE_REQUIRED');this.old=new Set(baseline.recordIds)}
  private safeError(e:unknown){return e instanceof Error&&/^(REVIEW_[A-Z0-9_]+|WEBHOOK_[A-Z0-9_]+)$/.test(e.message)?e.message:'REVIEW_OPERATION_FAILED'}
  async tick(){
    // Never retry a possibly delivered notification. Resolve interrupted deletes by reading first.
    for(const row of this.store.pending()){
      if(row.state==='notification_sending'){this.store.set(row.id,'unknown','REVIEW_NOTIFICATION_UNCONFIRMED');continue}
      try{const r=await this.api.get(row.id);if(!r)this.store.set(row.id,'deleted');else this.store.set(row.id,'unknown','REVIEW_DELETE_UNCONFIRMED')}catch(e){this.store.set(row.id,'unknown',this.safeError(e))}
    }
    const rows=await this.api.list(),now=this.now();const referenced=new Set(rows.flatMap(r=>linkedIds(r.fields['父记录'])));
    for(const r of rows){
      if(this.old.has(r.record_id))continue
      const created=Number(r.fields['填写时间（系统）']);if(!Number.isFinite(created)||created<Date.parse(this.baseline.since)||created>now)continue
      const entry=this.store.observe(r,now);if(entry.state!=='observed')continue
      const d=decisionFor(r);if(!d)continue
      if(d.verdict==='pass'){this.store.set(r.record_id,'passed');continue}
      if(d.verdict==='uncertain'||referenced.has(r.record_id)||linkedIds(r.fields['父记录']).length||!creator(r)){this.store.set(r.record_id,'manual','REVIEW_CONTEXT_REQUIRES_CHECK');continue}
      try{
        if(text(r.fields['审核提醒状态'])!=='已发送')continue
        const fresh=await this.api.get(r.record_id);if(!fresh||fingerprint(fresh)!==entry.hash||decisionFor(fresh)?.verdict!=='reject'||text(fresh.fields['审核提醒状态'])!=='已发送')continue
        // Native workflow already delivered the private reminder. Persist a complete backup before deletion.
        this.store.set(r.record_id,'notified',null,fresh)
        const latest=await this.api.get(r.record_id);if(!latest){this.store.set(r.record_id,'deleted');continue}
        if(fingerprint(latest)!==entry.hash||text(latest.fields['审核提醒状态'])!=='已发送'||decisionFor(latest)?.verdict!=='reject'){this.store.observe(latest,now);continue}
        // Recheck relations immediately before deletion, protecting newly linked child records.
        const current=await this.api.list();if(current.some(x=>linkedIds(x.fields['父记录']).includes(r.record_id))){this.store.set(r.record_id,'manual','REVIEW_LINKED_CHILDREN');continue}
        this.store.set(r.record_id,'delete_pending')
        await this.api.remove(r.record_id)
        this.store.set(r.record_id,'deleted')
      }catch(e){const state=this.store.get(r.record_id)?.state;this.store.set(r.record_id,state==='notification_sending'||state==='delete_pending'?'unknown':'error',this.safeError(e))}
    }
  }
}
