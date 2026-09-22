import type { AuditResult } from './dry-run'
import type { ClarityResult } from './clarity'
export function feedbackText(audit: AuditResult, clarity: ClarityResult, url: string): string {
  const basic = audit.basic?.issues.filter(x => !(audit.taskType === 'unknown' && x.code.startsWith('TITLE_')) && !x.code.startsWith('PARENT_')).map(x => x.reason) ?? []
  const labels = { CLEAR:'内容清楚', NEEDS_CLARIFICATION:'建议补充说明', UNCERTAIN:'暂未获得可靠判断' }
  const merge = !basic.length && clarity.verdict === 'CLEAR' && clarity.merge?.relation === 'MERGE' ?
    ['并入建议：可考虑并入已有任务「'+clarity.merge.targetTaskText+'」。', '并入依据：'+clarity.merge.reason] : []
  const systemErrors = audit.errors.filter(e=>!['INVALID_PARENT_CELL','TREE_UNREADABLE','PARENT_UNREADABLE','LINKED_CHILDREN_PROTECTED'].includes(e))
  return ['【GIRT 任务填写审核】','任务：'+audit.taskText.slice(0,500),
    '填写人：'+(audit.task.submitter?.name ?? '未读取到姓名'),
    '审核时间：'+audit.reviewedAt,
    '基础规则：'+(basic.length ? basic.join('；') : audit.basic ? '已检查项目未发现明确填写问题。' : '本次未能完成校验。'),
    'DeepSeek 内容判断：'+labels[clarity.verdict],
    '依据：'+clarity.reason, ...(clarity.suggestion ? ['建议：'+clarity.suggestion] : []),
    ...(basic.length ? ['请先修正以上填写问题，本次不进行并入判断。'] : []),
    ...(systemErrors.length ? ['部分数据或服务读取异常，本次结果仅供参考。'] : []),
    ...merge,
    '当前记录：已保留，本流程不删除任务。',
    '本次结果针对七项填写完整后读取到的任务内容。',
    url].join('\n')
}
