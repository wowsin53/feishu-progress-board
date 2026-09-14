import express from 'express'
import { timingSafeEqual } from 'node:crypto'
import { resolve } from 'node:path'
import { getDashboard } from './dashboard'
import { reportRouter } from './reports/routes'
export const app=express()
app.disable('x-powered-by')
app.use('/api/admin/reports',reportRouter)
app.get('/healthz',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json({status:'ok'})})
const same=(a:string,b:string)=>{ const aa=Buffer.from(a),bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb) }
app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store')
  res.setHeader('X-Content-Type-Options','nosniff')
  if(process.env.ALLOWED_ORIGIN && req.headers.origin===process.env.ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin',process.env.ALLOWED_ORIGIN)
    res.setHeader('Access-Control-Allow-Credentials','true')
    res.setHeader('Vary','Origin')
  }
  if(req.method==='OPTIONS') { res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.sendStatus(204);return }
  const username=process.env.DASHBOARD_USERNAME,password=process.env.DASHBOARD_PASSWORD
  if(username || password) {
    if(!username || !password) {res.status(503).json({error:'AUTH_CONFIG_ERROR'});return}
    const header=req.headers.authorization || ''
    const value=header.startsWith('Basic ') ? Buffer.from(header.slice(6),'base64').toString() : ''
    if(!same(value,`${username}:${password}`)) {res.setHeader('WWW-Authenticate','Basic realm="RM Mission Control", charset="UTF-8"');res.status(401).json({error:'AUTH_REQUIRED'});return}
  }
  next()
})
app.get('/api/dashboard',async(_req,res)=>{
  try {res.json(await getDashboard())}
  catch {res.status(502).json({error:'DATA_CONNECTION_LOST',message:'飞书数据连接异常，请检查服务端环境变量、表格字段及应用访问权限。'})}
})
app.use('/api',(_req,res)=>{res.status(404).json({error:'NOT_FOUND'})})
app.use(express.static(resolve('dist')))
