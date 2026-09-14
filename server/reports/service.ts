import { resolve } from 'node:path'
import { getDashboard } from '../dashboard'
import { dateKey } from '../../src/utils/date'
import { generateDailyReport } from './generate'
import { ReportStore, type ReportMode } from './store'
import { ReportDeliveryError, sendWebhook, webhookConfig } from './webhook'
export class ReportService {
  constructor(public store:ReportStore,private read=getDashboard,private deliver=sendWebhook,private config=webhookConfig){}
  async preview(){return generateDailyReport(await this.read())}
  async send(mode:ReportMode){
    const date=dateKey()
    this.store.recoverStale()
    if(!this.store.claim(date,mode)) return {status:'skipped',record:this.store.get(date)}
    const attempt=this.store.get(date)!.attempts
    let sending=false
    try{
      const config=this.config()
      const report=await this.preview()
      if(report.date!==date) throw new Error('REPORT_DATE_CHANGED')
      if(!this.store.update(date,'sending',null,Date.now(),report.generatedAt,attempt)) return {status:'skipped',record:this.store.get(date)}
      sending=true
      await this.deliver(report.text,config)
      this.store.update(date,'sent',null,Date.now(),undefined,attempt)
      console.log(JSON.stringify({event:'daily_report',date,mode,state:'sent'}))
      return {status:'sent',record:this.store.get(date)}
    }catch(error){
      const uncertain=(error instanceof ReportDeliveryError ? error.uncertain : sending)
      const safe=error instanceof ReportDeliveryError ? error.message : sending?'DELIVERY_REQUIRES_GROUP_CHECK':'REPORT_GENERATION_FAILED'
      this.store.update(date,uncertain?'unknown':'failed',safe,Date.now(),undefined,attempt)
      console.error(JSON.stringify({event:'daily_report',date,mode,state:uncertain?'unknown':'failed',error:safe}))
      return {status:uncertain?'unknown':'failed',record:this.store.get(date)}
    }
  }
}
let instance:ReportService|undefined
export function reports(){return instance ||= new ReportService(new ReportStore(resolve(process.env.REPORT_DB_PATH || 'data/reports.sqlite')))}
