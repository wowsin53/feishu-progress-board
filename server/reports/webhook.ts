import { createHmac } from 'node:crypto'
import axios from 'axios'
export class ReportDeliveryError extends Error {
  constructor(message:string,public uncertain=false){super(message)}
}
export function webhookConfig(env:NodeJS.ProcessEnv=process.env){
  if(!env.FEISHU_WEBHOOK_URL) throw new ReportDeliveryError('WEBHOOK_NOT_CONFIGURED')
  let url:URL
  try{url=new URL(env.FEISHU_WEBHOOK_URL)}catch{throw new ReportDeliveryError('INVALID_WEBHOOK_URL')}
  if(url.protocol!=='https:' || !['open.feishu.cn','open.larksuite.com'].includes(url.hostname) || url.port || url.username || url.password || !/^\/open-apis\/bot\/v2\/hook\/[a-zA-Z0-9-]+$/.test(url.pathname) || url.search || url.hash) throw new ReportDeliveryError('INVALID_WEBHOOK_URL')
  return {url:url.href,secret:env.FEISHU_BOT_SECRET || ''}
}
export function webhookPayload(text:string,secret='',now=Date.now()){
  const timestamp=String(Math.floor(now/1000))
  // Feishu signs an empty message with timestamp + newline + secret as the HMAC key.
  return {msg_type:'text',content:{text},...(secret?{timestamp,sign:createHmac('sha256',timestamp+'\n'+secret).update('').digest('base64')}: {})}
}
export async function sendWebhook(text:string,config=webhookConfig()){
  const payload=webhookPayload(text,config.secret)
  if(Buffer.byteLength(JSON.stringify(payload),'utf8')>20000) throw new ReportDeliveryError('REPORT_TOO_LARGE')
  let data:Record<string,unknown>
  try{
    const response=await axios.post(config.url,payload,{timeout:15000,maxRedirects:0,validateStatus:()=>true,maxContentLength:64000})
    if(response.status<200 || response.status>=300) throw new ReportDeliveryError('WEBHOOK_HTTP_'+response.status,true)
    data=response.data
  }catch(error){
    if(error instanceof ReportDeliveryError) throw error
    // A timeout can occur after delivery: never blindly retry and duplicate a group message.
    throw new ReportDeliveryError('WEBHOOK_DELIVERY_UNCONFIRMED',true)
  }
  const code=data?.code ?? data?.StatusCode
  if(code===0) return
  if(typeof code==='number') throw new ReportDeliveryError('WEBHOOK_REJECTED_'+code)
  throw new ReportDeliveryError('WEBHOOK_INVALID_RESPONSE',true)
}
