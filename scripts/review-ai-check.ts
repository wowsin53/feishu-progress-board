import 'dotenv/config'
import { reviewConfig } from '../server/review/config'
import { DeepSeekProvider, aiInput, validateSemantic } from '../server/review/ai'
import { findCandidates } from '../server/review/candidates'
import { semanticCases } from '../server/review/semantic-cases'
// Synthetic semantic-only experiment: no live records, activation or workflow changes.
const config = reviewConfig({ ...process.env, REVIEW_ENABLED_AT: '2026-09-20T00:00:00+08:00' })
if (!config.apiKey || !config.baseUrl || !config.model) {
  console.error('AI_NOT_CONFIGURED: 请填写本地 .env 的 DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL')
  process.exitCode = 1
} else {
  const provider = new DeepSeekProvider(config)
  for (const sample of semanticCases) {
    const candidates = findCandidates(sample.task, sample.records, config.maxCandidates)
    const parent = sample.records.find(t => sample.task.parentRecordIds.includes(t.recordId))
    try {
      const result = validateSemantic(await provider.evaluate(aiInput(sample.task, candidates, parent)), sample.task, candidates, parent)
      const matched = result.relation === sample.expected
      console.log(JSON.stringify({ case: sample.name, expected: sample.expected, ...result, matched, deleted: false }))
      if (!matched) process.exitCode = 1
    } catch { console.error(JSON.stringify({ case: sample.name, result: 'AI_REQUEST_FAILED', deleted: false })); process.exitCode = 1 }
  }
}
