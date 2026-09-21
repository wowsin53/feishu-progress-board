import type { AuditResult } from './dry-run'
/** Preview only. Transport and administrator recipient remain unconfigured until integration is confirmed. */
export function adminTestNotice(audit: AuditResult): string {
  return ['【测试审核】【记录未删除】', '⚠️ 任务审核结果', '新任务：' + audit.taskText,
    '提交人：' + (audit.task.submitter?.name ?? audit.task.submitter?.id ?? '读取异常'),
    '结论：' + audit.decision, 'AI 判断：' + (audit.semantic?.relation ?? '未调用'),
    '相关候选：' + (audit.candidates.map(t => t.taskText).join('、') || '无'),
    '原因：' + [...(audit.basic?.issues.map(i => i.reason) ?? []), ...(audit.semantic ? [audit.semantic.reason] : []), ...audit.errors].join('；'),
    '当前记录：已保留'].join('\n')
}
