import type { DashboardData, Group, Task, TaskStatus } from '../types/dashboard'
import { dateKey, dayStart, shiftDay } from '../utils/date'
export function createMockDashboard(now = Date.now()): DashboardData {
  const today = dateKey(now)
  const groups: Group[] = ['电控组', '机械组', '视觉组', '其他']
  const names = ['陈宇航','林子墨','王奕辰','苏沐阳','周景行','许知远','陆星野','沈亦舟','江予安','李明轩','赵思齐','顾言川','张以恒','徐嘉宁','黄子扬','宋文博']
  const members = names.map((name, i) => ({ id: `RM-${String(i+1).padStart(3,'0')}`, name, group: groups[i % 4]!, active: true, joinedAt: shiftDay(today, -35) }))
  const titles = [['底盘速度环调试','CAN 通信联调','裁判系统协议解析','云台姿态控制'], ['步兵底盘装配','弹仓供弹机构优化','云台结构强度校核','发射机构加工'], ['装甲板识别优化','相机内参标定','目标追踪算法测试','视觉串口协议联调'], ['整车联调记录','比赛物资清点','训练场地布置','技术文档归档']]
  const statuses: TaskStatus[] = ['已完成','进行中','未开始','待验收']
  const tasks: Task[] = Array.from({length:48}, (_,i) => {
    const member = members[i % 16]!, round = Math.floor(i/16)
    const status = round === 0 ? '已完成' : statuses[(i + round) % 4]!
    const offset = status === '已完成' ? -2 : [1,3,-2,0,5,-6,2,4][i % 8]!
    return { id:`TASK-${i+1}`, title:titles[i % 4]![round]!, memberIds:[member.id], group:member.group, status, priority:i % 3 + 1, startAt:dayStart(shiftDay(today,-7)).toISOString(), deadline:dayStart(shiftDay(today, offset)).endOf('day').toISOString(), completedAt:status === '已完成' ? dayStart(shiftDay(today,-(i%3))).add(10,'hour').toISOString() : undefined, progress:status === '已完成' ? 100 : status === '待验收' ? 90 : status === '进行中' ? 55 : 0, description:'完成模块验证与测试记录，确认接口、稳定性及异常恢复行为，并提交联调结果。' }
  })
  const checkIns = members.flatMap((m,i) => Array.from({length:8},(_,d) => ({id:`C-${i}-${d}`,memberIds:[m.id],date:shiftDay(today,-d),valid:d >= (i % 3 === 0 ? i % 4 + 1 : 0)})))
  return {members,tasks,checkIns,source:'mock',syncedAt:new Date(now).toISOString(),historyStart:shiftDay(today,-7),warnings:[]}
}
