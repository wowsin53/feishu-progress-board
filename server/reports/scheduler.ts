import { chinaTime } from '../../src/utils/date'
import { reports } from './service'
export function reportSchedule(env:NodeJS.ProcessEnv=process.env){
  const time=env.REPORT_SEND_TIME || '00:30'
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('INVALID_REPORT_SEND_TIME')
  return {enabled:env.REPORT_ENABLED==='true',time,timezone:'Asia/Shanghai'}
}
export function isReportDue(now:number,time:string){return chinaTime(now).format('HH:mm')>=time}
export function startReportScheduler(run=()=>reports().send('automatic'),env:NodeJS.ProcessEnv=process.env){
  const config=reportSchedule(env)
  if(!config.enabled){console.log(JSON.stringify({event:'daily_report_scheduler',enabled:false}));return ()=>{}}
  let timer:ReturnType<typeof setTimeout>|undefined,stopped=false
  const notBefore=env.REPORT_START_AT ? Date.parse(env.REPORT_START_AT) : 0
  if(!Number.isFinite(notBefore)) throw new Error('INVALID_REPORT_START_AT')
  const tick=async()=>{
    try{if(Date.now()>=notBefore && isReportDue(Date.now(),config.time)) await run()}
    catch{console.error(JSON.stringify({event:'daily_report_scheduler',error:'SCHEDULER_TICK_FAILED'}))}
    finally{if(!stopped){timer=setTimeout(tick,30000);timer.unref()}}
  }
  console.log(JSON.stringify({event:'daily_report_scheduler',...config}))
  void tick()
  return ()=>{stopped=true;clearTimeout(timer)}
}
