import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DashboardData, Group } from '../types/dashboard'
import { fetchDashboard } from '../services/dashboard'
import { deriveDashboard } from '../utils/dashboard'
export const useDashboard=defineStore('dashboard',()=>{
  const data=ref<DashboardData|null>(null),group=ref<Group|'全部成员'>('全部成员'),now=ref(Date.now()),loading=ref(false),error=ref(false)
  const view=computed(()=>data.value ? deriveDashboard(data.value,group.value,now.value) : null)
  async function refresh(){
    if(loading.value) return
    loading.value=true
    try {data.value=await fetchDashboard();error.value=false} catch {error.value=true} finally {loading.value=false}
  }
  return {data,group,now,loading,error,view,refresh}
})
