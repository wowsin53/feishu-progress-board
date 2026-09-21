export interface ReviewConfig {
  dryRun: true; enabledAt: number; apiKey: string; baseUrl: string; model: string
  timeoutMs: number; maxRetries: number; maxCandidates: number; rejectConfidence: number | null
}
export function reviewConfig(env: NodeJS.ProcessEnv = process.env): ReviewConfig {
  // This release cannot enable deletion, even if an environment variable is accidentally changed.
  if (env.DRY_RUN && env.DRY_RUN !== 'true') throw new Error('LIVE_DELETE_NOT_IMPLEMENTED')
  if (!env.REVIEW_ENABLED_AT || !/(Z|[+-]\d\d:\d\d)$/.test(env.REVIEW_ENABLED_AT)) throw new Error('REVIEW_ENABLED_AT_REQUIRED_WITH_TIMEZONE')
  const enabledAt = Date.parse(env.REVIEW_ENABLED_AT)
  if (!Number.isFinite(enabledAt)) throw new Error('REVIEW_ENABLED_AT_INVALID')
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const v = env[key] ? Number(env[key]) : fallback
    if (!Number.isInteger(v) || v < min || v > max) throw new Error(`INVALID_${key}`)
    return v
  }
  const confidence = env.AI_REJECT_CONFIDENCE ? Number(env.AI_REJECT_CONFIDENCE) : null
  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) throw new Error('INVALID_AI_REJECT_CONFIDENCE')
  const baseUrl = env.DEEPSEEK_BASE_URL?.trim() ?? ''
  if (baseUrl) { const url = new URL(baseUrl); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('INVALID_DEEPSEEK_BASE_URL') }
  return { dryRun: true, enabledAt, apiKey: env.DEEPSEEK_API_KEY ?? '', baseUrl,
    model: env.DEEPSEEK_MODEL?.trim() ?? '', timeoutMs: integer('AI_TIMEOUT_MS', 30000, 100, 120000),
    maxRetries: integer('AI_MAX_RETRIES', 2, 0, 5), maxCandidates: integer('AI_MAX_CANDIDATES', 20, 1, 100), rejectConfidence: confidence }
}
