import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { ClarityResult } from './clarity'
export interface Delivery { id:string; recipient:string; text:string; uuid:string; attempts:number; firstAttempt:number|null }
export class FeedbackStore {
  private db:DatabaseSync
  constructor(path:string) {
    this.db=new DatabaseSync(path)
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS review_feedback(id TEXT PRIMARY KEY,state TEXT NOT NULL,result TEXT); CREATE TABLE IF NOT EXISTS review_deliveries(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,text TEXT NOT NULL,uuid TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,first_attempt INTEGER,next_attempt INTEGER NOT NULL DEFAULT 0,message_id TEXT,error TEXT)")
  }
  claim(id:string) { return this.db.prepare("INSERT OR IGNORE INTO review_feedback(id,state) VALUES(?,'processing')").run(id).changes===1 }
  result(id:string) { const r=this.db.prepare('SELECT result FROM review_feedback WHERE id=?').get(id); return r?.result ? JSON.parse(String(r.result)) as ClarityResult : undefined }
  finish(id:string,result:ClarityResult) { this.db.prepare("UPDATE review_feedback SET state='done',result=? WHERE id=?").run(JSON.stringify(result),id) }
  enqueue(id:string,recipient:string,text:string) {
    this.db.prepare("INSERT OR IGNORE INTO review_deliveries(id,recipient,text,uuid,state) VALUES(?,?,?,?,'pending')").run(id,recipient,text,randomUUID())
  }
  pending(now:number):Delivery[] {
    // Never retry outside the Feishu one-hour UUID deduplication window.
    this.db.prepare("UPDATE review_deliveries SET state='uncertain',error='DELIVERY_WINDOW_EXPIRED' WHERE state='pending' AND first_attempt IS NOT NULL AND first_attempt<?").run(now-45*60000)
    this.db.prepare("UPDATE review_deliveries SET state='uncertain',error='ATTEMPTS_EXHAUSTED' WHERE state='pending' AND attempts>=3").run()
    return this.db.prepare("SELECT * FROM review_deliveries WHERE state='pending' AND attempts<3 AND next_attempt<=? ORDER BY rowid LIMIT 20").all(now).map(r=>({id:String(r.id),recipient:String(r.recipient),text:String(r.text),uuid:String(r.uuid),attempts:Number(r.attempts),firstAttempt:r.first_attempt===null?null:Number(r.first_attempt)}))
  }
  attempt(id:string,now:number) { this.db.prepare('UPDATE review_deliveries SET attempts=attempts+1,first_attempt=COALESCE(first_attempt,?),next_attempt=? WHERE id=?').run(now,now+60000,id) }
  sent(id:string,messageId:string) { this.db.prepare("UPDATE review_deliveries SET state='sent',message_id=? WHERE id=?").run(messageId,id) }
  failed(id:string,attempts:number) { this.db.prepare("UPDATE review_deliveries SET state=?,error='SEND_UNCONFIRMED' WHERE id=?").run(attempts>=3?'uncertain':'pending',id) }
  close(){this.db.close()}
}
