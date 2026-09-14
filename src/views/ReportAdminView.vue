<script setup lang="ts">
import { ref } from 'vue'
const token=ref(''),preview=ref(''),message=ref(''),busy=ref(false)
const records=ref<{date:string;state:string;mode:string;generatedAt:string|null;sentAt:string|null;error:string|null}[]>([])
const schedule=ref(''),ready=ref(false)
const labels:Record<string,string>={generating:'正在生成',sending:'正在发送',sent:'发送成功',failed:'发送失败',unknown:'结果待核对'}
async function request(path:string,method='GET'){
  const response=await fetch('/api/admin/reports/'+path,{method,headers:{Authorization:'Bearer '+token.value}})
  const data=await response.json()
  if(!response.ok) throw new Error(data.record?.error || data.message || data.error || data.status || '请求失败')
  return data
}
async function inspect(){
  busy.value=true;message.value=''
  try{
    const [settings,report,history]=await Promise.all([request('status'),request('preview'),request('history')])
    schedule.value=settings.time+'（北京时间） · 自动发送'+(settings.enabled?'已启用':'未启用')+' · 群机器人'+(settings.webhookConfigured?'已配置':'未配置')
    preview.value=report.text;records.value=history.records;ready.value=settings.webhookConfigured
  }catch(error){message.value=error instanceof Error?error.message:'请求失败'}finally{busy.value=false}
}
async function send(){
  busy.value=true;message.value=''
  try{const result=await request('send','POST');message.value=result.status==='sent'?'日报已发送。':'本日已有发送记录：'+(labels[result.record?.state] || result.record?.state)+'；未重复发送。'}
  catch(error){message.value=error instanceof Error?error.message:'发送失败'}
  finally{try{records.value=(await request('history')).records}catch{}busy.value=false}
}
</script>
<template><main class="report-admin">
  <h1>GIRT 每日任务日报管理</h1><p>用于管理员预览、发送和核对日报。手动发送同样受每日防重复保护。</p>
  <label>管理员令牌 <input v-model="token" type="password" autocomplete="off" placeholder="输入服务器 ADMIN_REPORT_TOKEN" @input="ready=false" /></label>
  <div class="report-actions"><button :disabled="busy || !token" @click="inspect">读取配置并预览前一日日报</button><button :disabled="busy || !ready" @click="send">立即发送前一日任务日报</button></div>
  <p>{{ schedule }}</p><p role="status">{{ message }}</p>
  <p>若显示“结果待核对”，请先核对群内消息；系统不会盲目重发。</p>
  <pre>{{ preview || '通过管理员认证后，可在这里查看真实数据生成的日报。' }}</pre>
  <h2>最近发送记录</h2><div class="report-history"><table><thead><tr><th>发送日期</th><th>方式</th><th>状态</th><th>生成时间</th><th>发送时间</th><th>错误</th></tr></thead><tbody><tr v-for="(r,i) in records" :key="i"><td>{{ r.date }}</td><td>{{ r.mode==='manual'?'手动':'自动' }}</td><td>{{ labels[r.state] || r.state }}</td><td>{{ r.generatedAt || '—' }}</td><td>{{ r.sentAt || '—' }}</td><td>{{ r.error || '—' }}</td></tr></tbody></table></div>
</main></template>
<style scoped>
.report-admin{max-width:1200px;margin:40px auto;padding:24px;color:#e8f2ff;line-height:1.7}.report-admin h1,.report-admin h2{margin:20px 0}.report-admin label{display:block;margin-top:20px}.report-admin input{display:block;width:100%;padding:12px;background:#172a40;color:#fff;border:1px solid #65829a}.report-actions{display:flex;flex-wrap:wrap;gap:16px;margin:20px 0}.report-actions button{padding:12px 20px;background:#28596a;border:1px solid #76dccc;border-radius:4px}.report-admin pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;background:#20364e;border:1px solid #577089}.report-history{overflow:auto}.report-admin table{width:100%;border-collapse:collapse;font-size:13px}.report-admin th,.report-admin td{padding:10px;border:1px solid #4c647e;text-align:left}.report-admin p{margin:12px 0}
</style>
