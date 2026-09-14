import 'dotenv/config'
import { createMockDashboard } from '../src/mock/dashboard'
import { readFeishu } from './feishu'
export async function getDashboard() {
  const values=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_BASE_TOKEN','FEISHU_BASE_URL','FEISHU_MEMBERS_TABLE_ID','FEISHU_TASKS_TABLE_ID','FEISHU_CHECKINS_TABLE_ID'].map(k=>process.env[k]?.trim())
  const mode=process.env.DATA_MODE || 'auto'
  if(!['auto','mock','live'].includes(mode)) throw new Error('INVALID_DATA_MODE')
  if(mode==='mock' || (mode==='auto' && values.every(v=>!v))) return createMockDashboard()
  if(!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET || !(process.env.FEISHU_BASE_URL || process.env.FEISHU_BASE_TOKEN)) throw new Error('INCOMPLETE_FEISHU_CONFIG')
  const checkinMode = process.env.CHECKIN_MODE || 'mock'
  if (!['mock','live'].includes(checkinMode)) throw new Error('INVALID_CHECKIN_MODE')
  if (checkinMode === 'live' && (!process.env.FEISHU_MEMBERS_TABLE_ID || !process.env.FEISHU_TASKS_TABLE_ID || !process.env.FEISHU_CHECKINS_TABLE_ID)) throw new Error('INCOMPLETE_FEISHU_CONFIG')
  return readFeishu()
}
