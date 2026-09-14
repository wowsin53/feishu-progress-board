import { getDashboard } from '../../server/dashboard'
import { timingSafeEqual } from 'node:crypto'
export default async (request: Request) => {
  const headers: Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store'}
  if(process.env.ALLOWED_ORIGIN === request.headers.get('origin')) {headers['Access-Control-Allow-Origin']=process.env.ALLOWED_ORIGIN!;headers['Access-Control-Allow-Credentials']='true';headers.Vary='Origin'}
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers})
  if(request.method!=='GET') return new Response('{}',{status:405,headers})
  const u=process.env.DASHBOARD_USERNAME,p=process.env.DASHBOARD_PASSWORD
  if(u || p) {
    if(!u || !p) return new Response('{"error":"AUTH_CONFIG_ERROR"}',{status:503,headers})
    const expected=Buffer.from('Basic '+Buffer.from(`${u}:${p}`).toString('base64')), actual=Buffer.from(request.headers.get('authorization') || '')
    if(expected.length!==actual.length || !timingSafeEqual(expected,actual)) return new Response('{"error":"AUTH_REQUIRED"}',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="RM Mission Control", charset="UTF-8"'}})
  }
  try {return new Response(JSON.stringify(await getDashboard()),{headers})}
  catch {return new Response('{"error":"DATA_CONNECTION_LOST"}',{status:502,headers})}
}
