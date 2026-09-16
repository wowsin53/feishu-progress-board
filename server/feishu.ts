import axios from 'axios'
import { configuredMemberGroups } from './member-groups'
import type { DashboardData } from '../src/types/dashboard'
import { normalizeRecords, type FeishuRecord } from './normalize'
import { normalizeDiscovered, parseBaseLink, selectTables, type TableSchema, withVirtualCheckIns } from './discovery'
const client = axios.create({ baseURL:'https://open.feishu.cn/open-apis', timeout:15000 })
interface Envelope<T> { code: number; msg?: string; data: T }
let cachedToken: { value:string; until:number } | undefined
let tokenRequest: Promise<string> | undefined
async function accessToken() {
  if(cachedToken && cachedToken.until > Date.now()) return cachedToken.value
  if(tokenRequest) return tokenRequest
  tokenRequest = (async () => {
    const {data} = await client.post<{code:number;tenant_access_token:string;expire:number}>('/auth/v3/tenant_access_token/internal',{app_id:process.env.FEISHU_APP_ID,app_secret:process.env.FEISHU_APP_SECRET})
    if(data.code !== 0 || !data.tenant_access_token) throw new Error('FEISHU_AUTH_FAILED')
    cachedToken={value:data.tenant_access_token,until:Date.now()+Math.max(0,data.expire-120)*1000}
    return cachedToken.value
  })().finally(()=>{tokenRequest=undefined})
  return tokenRequest
}
async function allItems<T>(path: string): Promise<T[]> {
  const records: T[] = [], seen = new Set<string>()
  let pageToken: string | undefined
  do {
    let page: { items?: T[]; has_more?: boolean; page_token?: string } | undefined
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const {data} = await client.get<Envelope<{items?:T[];has_more?:boolean;page_token?:string}>>(path, {headers:{Authorization:`Bearer ${await accessToken()}`},params:{page_size:100,page_token:pageToken}})
        if([99991663,99991664,99991668].includes(data.code) && attempt<2) { cachedToken=undefined; continue }
        if(data.code === 1254290 && attempt<2) { await new Promise(r=>setTimeout(r,500*(attempt+1))); continue }
        if(data.code !== 0) throw new Error(`FEISHU_API_${data.code}`)
        page=data.data; break
      } catch(error) {
        if(axios.isAxiosError(error) && error.response?.status === 429 && attempt<2) { await new Promise(r=>setTimeout(r,500*(attempt+1))); continue }
        const code = axios.isAxiosError(error) ? error.response?.data?.code : undefined
        if (Number.isInteger(code)) throw new Error(`FEISHU_API_${code}`)
        if (error instanceof Error && /^FEISHU_API_\d+$/.test(error.message)) throw error
        throw new Error('FEISHU_READ_FAILED')
      }
    }
    if(!page || !Array.isArray(page.items)) throw new Error('FEISHU_INVALID_RESPONSE')
    records.push(...page.items)
    if(!page.has_more) break
    if(!page.page_token || seen.has(page.page_token)) throw new Error('FEISHU_INVALID_PAGINATION')
    seen.add(page.page_token); pageToken=page.page_token
  } while(true)
  return records
}
let pending: Promise<DashboardData> | undefined
export function readFeishu(): Promise<DashboardData> {
  if(pending) return pending
  pending=(async()=>{
    const linked = process.env.FEISHU_BASE_URL ? parseBaseLink(process.env.FEISHU_BASE_URL) : undefined
    const baseToken = linked?.token || process.env.FEISHU_BASE_TOKEN!
    const basePath = `/bitable/v1/apps/${encodeURIComponent(baseToken)}/tables`
    const records = (id:string) => allItems<FeishuRecord>(`${basePath}/${encodeURIComponent(id)}/records`)
    if ((process.env.CHECKIN_MODE || 'mock') === 'mock') {
      const tables = await allItems<{table_id:string;name:string}>(basePath)
      const schemas: TableSchema[] = []
      for (const table of tables) schemas.push({...table,fields:await allItems<TableSchema['fields'][number]>(`${basePath}/${encodeURIComponent(table.table_id)}/fields`)})
      const selected = selectTables(schemas,process.env.FEISHU_TASKS_TABLE_ID || linked?.tableId,process.env.FEISHU_MEMBERS_TABLE_ID)
      const tasks = await records(selected.task.table_id)
      const members = selected.member ? await records(selected.member.table_id) : []
      return withVirtualCheckIns(normalizeDiscovered(tasks,selected.task,members,selected.member,configuredMemberGroups()))
    }
    const members=await records(process.env.FEISHU_MEMBERS_TABLE_ID!)
    const tasks=await records(process.env.FEISHU_TASKS_TABLE_ID!)
    const checkIns=await records(process.env.FEISHU_CHECKINS_TABLE_ID!)
    return {...normalizeRecords(members,tasks,checkIns,process.env.DEADLINE_MODE === 'datetime'),checkInSource:'feishu' as const}
  })().finally(()=>{pending=undefined})
  return pending
}
