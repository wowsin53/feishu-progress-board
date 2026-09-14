import { Router } from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'
import { reports, type ReportService } from './service'
import { reportSchedule } from './scheduler'
export function createReportRouter(service:()=>ReportService=reports){
const reportRouter=Router()
reportRouter.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store')
  const expected=process.env.ADMIN_REPORT_TOKEN
  if(!expected || expected.length<32){res.status(503).json({error:'ADMIN_REPORT_TOKEN_NOT_CONFIGURED'});return}
  const supplied=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):''
  const hash=(s:string)=>createHash('sha256').update(s).digest()
  if(!timingSafeEqual(hash(supplied),hash(expected))){res.status(401).json({error:'ADMIN_AUTH_REQUIRED'});return}
  next()
})
reportRouter.get('/status',(_req,res)=>{
  try{res.json({...reportSchedule(),webhookConfigured:!!process.env.FEISHU_WEBHOOK_URL})}
  catch{res.status(503).json({error:'INVALID_REPORT_SCHEDULE'})}
})
reportRouter.get('/history',(_req,res)=>{
  try{res.json({records:service().store.history()})}catch{res.status(500).json({error:'REPORT_STORAGE_FAILED'})}
})
reportRouter.get('/preview',async(_req,res)=>{
  try{res.json(await service().preview())}catch{res.status(502).json({error:'REPORT_PREVIEW_FAILED',message:'无法获取真实飞书任务，请检查服务端连接。'})}
})
reportRouter.post('/send',async(_req,res)=>{
  try{const result=await service().send('manual');res.status(result.status==='failed'?502:result.status==='unknown'?409:200).json(result)}
  catch{res.status(500).json({error:'REPORT_STORAGE_FAILED'})}
})

return reportRouter
}
export const reportRouter=createReportRouter()
