import axios from 'axios'
import type { DashboardData } from '../types/dashboard'
const client=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL || '',timeout:60000,withCredentials:true})
export async function fetchDashboard(): Promise<DashboardData> {
  if(import.meta.env.VITE_STATIC_MOCK === 'true') {
    const {createMockDashboard}=await import('../mock/dashboard')
    return createMockDashboard()
  }
  // During local startup Vite can become ready a moment before the API process.
  // A single bounded retry also handles a transient dropped connection.
  let response
  try { response=await client.get<DashboardData>('/api/dashboard') }
  catch(error) {
    if(!axios.isAxiosError(error) || (error.response && ![500,502,503,504].includes(error.response.status))) throw error
    await new Promise(resolve=>setTimeout(resolve,1000))
    response=await client.get<DashboardData>('/api/dashboard')
  }
  const {data}=response
  if(!data || !Array.isArray(data.members) || !Array.isArray(data.tasks) || !Array.isArray(data.checkIns) || !['mock','feishu'].includes(data.source)) throw new Error('INVALID_DATA')
  return data
}
