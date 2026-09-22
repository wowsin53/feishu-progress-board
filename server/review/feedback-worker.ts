import type { AuditResult } from './dry-run'
import { assessClarity, clarityUncertain } from './clarity'
import type { ReviewAiProvider } from './ai'
import { FeedbackStore } from './feedback-store'
import { feedbackText } from './feedback'
export interface MessageSender { send(recipient:string,text:string,uuid:string):Promise<string> }
export class FeedbackWorker {
  constructor(private store:FeedbackStore,private provider:ReviewAiProvider,private sender:MessageSender,
    private admin:string,private tableId:string,private base:string,private log:(line:string)=>void=console.log, private minConfidence=0.8) {}
  async handle(audit:AuditResult) {
    if(audit.decision==='SKIPPED_HISTORY')return
    const id=this.tableId+':'+audit.recordId
    let result=this.store.result(id)
    if(!result) {
      if(this.store.claim(id)) {
        result=audit.errors.some(e=>e.startsWith('SCHEMA_') || e==='RECORD_FIELDS_UNREADABLE') ?
          clarityUncertain('数据结构异常，暂停内容判断，请人工检查。') : await assessClarity(audit.task,this.provider,this.minConfidence)
      } else result=clarityUncertain('上次内容判断中断，为避免重复请求已暂停，需人工检查。')
      this.store.finish(id,result)
      this.log(JSON.stringify({event:'CONTENT_REVIEW',recordId:audit.recordId,...result}))
    }
    const text=feedbackText(audit,result,'https://girtrobotlab.feishu.cn/base/'+encodeURIComponent(this.base)+'?table='+encodeURIComponent(this.tableId)+'&record='+encodeURIComponent(audit.recordId))
    const recipients=new Set([this.admin,...(audit.task.submitter?.id?[audit.task.submitter.id]:[])])
    for(const recipient of recipients) this.store.enqueue(id+':'+recipient,recipient,text)
  }
  async flush(now=Date.now()) {
    for(const item of this.store.pending(now)) {
      this.store.attempt(item.id,now)
      try { const messageId=await this.sender.send(item.recipient,item.text,item.uuid); this.store.sent(item.id,messageId); this.log(JSON.stringify({event:'REVIEW_NOTICE_SENT',deliveryId:item.id,messageId})) }
      catch(e) { this.store.failed(item.id,item.attempts+1); this.log(JSON.stringify({event:'REVIEW_NOTICE_UNCONFIRMED',deliveryId:item.id,attempt:item.attempts+1,error:e instanceof Error && /^REVIEW_SEND_CODE_[0-9]+$/.test(e.message)?e.message:'SEND_UNCONFIRMED'})) }
    }
  }
}
