import type { AuditResult } from './dry-run'
import type { ClarityResult } from './clarity'
export function feedbackText(audit: AuditResult, clarity: ClarityResult, url: string): string {
  const basic = audit.basic?.issues.filter(x => !(audit.taskType === 'unknown' && x.code.startsWith('TITLE_'))).map(x => x.reason) ?? []
  const labels = { CLEAR:'内容清楚', NEEDS_CLARIFICATION:'建议补充说明', UNCERTAIN:'需要人工确认' }
  const structure = audit.errors.length ? '部分字段或父子关系无法确认，需要人工检查；这不是填写违规结论。' :
    audit.semantic ? audit.semantic.reason : '未完成任务关系判断。'
  return ['【GIRT 任务填写审核】','任务：'+audit.taskText.slice(0,500),
    '填写人：'+(audit.task.submitter?.name ?? '未读取到姓名'),
    '审核时间：'+audit.reviewedAt,
    '基础规则：'+(basic.length ? basic.join('；') : audit.basic ? '已检查项目未发现明确填写问题。' : '本次未能完成校验。'),
    'DeepSeek 内容判断：'+labels[clarity.verdict]+'（仅内容清晰度；不是全部规则通过）',
    '依据：'+clarity.reason, ...(clarity.suggestion ? ['建议：'+clarity.suggestion] : []),
    '任务关系检查：'+structure,
    ...(basic.length ? ['请按照基础规则问题检查并补全相关字段。'] : []),
    '当前记录：已保留，本流程不删除任务。',
    '本次结果针对首次读取时的任务内容；不明确的部分请与组长或武珊确认。',
    url].join('\n')
}
