import type { DashboardData, Task } from '../../src/types/dashboard'
import { GROUPS, groupLabel } from '../../src/config/groups'
import { deriveDashboard, isActiveTask, overdueDays, pendingOrder } from '../../src/utils/dashboard'
import { chinaTime, dateKey, dayStart, shiftDay } from '../../src/utils/date'
const plain=(value:string)=>value.replace(/[\r\n\t]/g,' ').replace(/</g,'＜').replace(/>/g,'＞').slice(0,160)
export const reportDate=(now=Date.now())=>shiftDay(dateKey(now),-1)
export function generateDailyReport(data:DashboardData, now=Date.now()) {
  if(data.source!=='feishu') throw new Error('REPORT_REQUIRES_LIVE_TASKS')
  const view=deriveDashboard(data,'全部成员',now), date=reportDate(now)
  const attendance=deriveDashboard(data,'全部成员',dayStart(date).endOf('day').valueOf())
  const missingDeadlines=view.missingDeadlines.filter(t=>t.status!=='未开始')
  const missingIds=new Set(missingDeadlines.flatMap(t=>t.memberIds))
  const missingNames=[...new Set(view.members.filter(m=>missingIds.has(m.id)).map(m=>m.name))]
  const absentNames=attendance.absent.map(m=>plain(m.name)).join('、')
  const completed=view.tasks.filter(t=>t.status==='已完成')
  const effective=view.tasks.filter(t=>t.status!=='已放弃')
  const completedToday=completed.filter(t=>t.completedAt && dateKey(t.completedAt)===date)
  const rate=effective.length ? Math.round(completed.length/effective.length*100) : 0
  const owners=(task:Task)=>view.members.filter(m=>task.memberIds.includes(m.id)).map(m=>plain(m.name)+' / '+groupLabel(m.group)).join('、')
  const priority=view.tasks.filter(t=>isActiveTask(t) && (t.priority>=3 || t.status==='已停滞')).sort(pendingOrder)
  const build=(limit:number)=>{
    const list=(title:string,tasks:Task[],suffix:(t:Task)=>string=()=>'',empty='无')=>[
      title+'（'+tasks.length+'项）',
      ...(tasks.length ? tasks.slice(0,limit).map(t=>'• '+plain(t.title)+' —— '+owners(t)+suffix(t)) : [empty]),
      ...(tasks.length>limit ? ['另有 '+(tasks.length-limit)+' 项，请查看基地看板'] : []),
    ].join('\n')
    return [
      '【GIRT 今日任务日报】','日期：'+date,'数据截至：'+chinaTime(now).format('YYYY-MM-DD HH:mm:ss')+'（北京时间）','',
      '👥 当日人员','总人数：'+attendance.members.length,
      ...(data.checkInSource==='mock' ? ['打卡为虚拟演示数据，不代表真实考勤'] : []),
      '已打卡：'+attendance.summary.checkedIn+' 人',
      '未打卡：'+attendance.summary.notCheckedIn+' 人'+(absentNames?'——'+absentNames:''),'',
      '📋 今日任务（截至发送时的任务快照）','任务总数：'+view.tasks.length,'已完成（累计）：'+completed.length,'今日完成：'+completedToday.length,
      '进行中：'+view.tasks.filter(t=>t.status==='进行中').length,'未开始：'+view.tasks.filter(t=>t.status==='未开始').length,
      '待验收：'+view.tasks.filter(t=>t.status==='待验收').length,'已停滞：'+view.tasks.filter(t=>t.status==='已停滞').length,'已放弃：'+view.tasks.filter(t=>t.status==='已放弃').length,
      '当前完成率：'+rate+'%（当前有效任务累计完成占比，已放弃不计入）',
      ...(completed.some(t=>!t.completedAt)?['部分已完成任务未填实际完成日期，未计入“今日完成”']:[]),'',
      '🔧 各组情况',...GROUPS.map(group=>{const v=deriveDashboard(data,group,now);return group+'：完成 '+v.tasks.filter(t=>t.status==='已完成').length+' / 未完成 '+v.summary.unfinishedTasks}),
      ...(view.members.some(m=>!m.group)?['待分组成员：'+view.members.filter(m=>!m.group).map(m=>plain(m.name)).join('、')]:[]),
      '共同负责的任务在组内去重，跨组协作可出现在多个组；基地总数按任务去重。','',
      list('⚠️ 今日未完成重点任务',priority),'',
      list('🔴 已逾期任务',view.overdue,t=>' —— 已逾期 '+overdueDays(t,now)+' 天'),' ',
      list('🟠 即将到期',view.upcoming,t=>' —— 剩余 '+Math.max(1,Math.ceil((Date.parse(t.deadline!)-now)/3600000))+' 小时'),'',
      '⚠️ 未填写截止日期的负责人',
      missingNames.length?missingNames.map(plain).join('、'):'✅ 所有非待开始的未完成任务均已填写截止日期','',
      ...(data.incompleteTasks?.length ? ['待补充信息：'+data.incompleteTasks.length+' 条，未计入任务统计；请完善负责人或状态。'] : []),
      '今日重点：'+missingDeadlines.length+' 项任务未填写截止日期，'+view.overdue.length+' 项已逾期，'+view.upcoming.length+' 项将在48小时内到期，请对应负责人及时处理。',
      '', '📊 查看完整任务看板：http://47.93.156.196/',
      '📝 主任务填写：https://girtrobotlab.feishu.cn/share/base/shrcndaRaDyprWeJ1UJ8cJjrxgg',
    ].join('\n')
  }
  // One message keeps a daily send atomic. Bound details by UTF-8 bytes, not characters.
  let limit=20,text=build(limit)
  while(Buffer.byteLength(text,'utf8')>18000 && limit>1) text=build(--limit)
  if(Buffer.byteLength(text,'utf8')>18000) throw new Error('REPORT_TOO_LARGE')
  return {date,generatedAt:new Date(now).toISOString(),text,detailLimit:limit}
}
