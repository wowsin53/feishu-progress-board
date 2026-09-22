import { FeedbackStore } from './feedback-store'
import { FeedbackWorker } from './feedback-worker'
import { FeishuReviewSender } from './message-sender'
import 'dotenv/config'
import { reviewConfig } from './config'
import { ReviewApi } from './feishu'
import { DeepSeekProvider } from './ai'
import { DryRunReviewer } from './dry-run'
import { SqliteAuditStore } from './audit-store'
import { ReviewPoller } from './polling'

async function main() {
  const config = reviewConfig()
  if (!config.apiKey || !config.baseUrl || !config.model) throw new Error('AI_NOT_CONFIGURED')
  const base = process.env.REVIEW_BASE_TOKEN, table = process.env.REVIEW_TABLE_ID, db = process.env.REVIEW_V2_DB_PATH
  if (!base || !table || !db || !process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) throw new Error('REVIEW_POLL_CONFIG_REQUIRED')
  const interval = Number(process.env.REVIEW_POLL_INTERVAL_MS || 15000)
  if (!Number.isInteger(interval) || interval < 5000 || interval > 300000) throw new Error('REVIEW_POLL_INTERVAL_INVALID')
  const store = new SqliteAuditStore(db)
  const api = new ReviewApi(base, table)
  const notify = process.env.REVIEW_NOTIFY_ENABLED === 'true'
  const admin = process.env.REVIEW_ADMIN_OPEN_ID ?? ''
  const confidence = Number(process.env.AI_FEEDBACK_CONFIDENCE || 0.8)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('AI_FEEDBACK_CONFIDENCE_INVALID')
  if (notify && !/^ou_[A-Za-z0-9]+$/.test(admin)) throw new Error('REVIEW_ADMIN_REQUIRED')
  const feedbackStore = notify ? new FeedbackStore(db) : undefined
  const feedback = feedbackStore ? new FeedbackWorker(feedbackStore,new DeepSeekProvider(config),new FeishuReviewSender(),admin,table,base,console.log,confidence,config.maxCandidates) : undefined
  // Only GET capabilities passed to poller. Legacy deletion worker remains disabled.
  const poller = new ReviewPoller({ list: () => api.list(), fields: () => api.fields(), get: id => api.get(id) },
    new DryRunReviewer(config, new DeepSeekProvider(config), store), store, table, config.enabledAt, console.log, Date.now, feedback ? (result, records) => feedback.handle(result, records) : undefined)
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, wake: (() => void) | undefined
  const stop = () => { stopped = true; if (timer) clearTimeout(timer); wake?.() }
  process.once('SIGTERM', stop); process.once('SIGINT', stop)
  console.log(JSON.stringify({ event: 'REVIEW_POLL_STARTED', dryRun: true, notifyEnabled: notify, source: 'system_created_at', enabledAt: new Date(config.enabledAt).toISOString(), intervalMs: interval }))
  try {
    while (!stopped) {
      await poller.tick()
      await feedback?.flush()
      if (!stopped) await new Promise<void>(resolve => { wake = resolve; timer = setTimeout(resolve, interval) })
    }
  } finally { feedbackStore?.close(); store.close(); process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop) }
}
main().catch(() => { console.error('REVIEW_POLL_START_FAILED: check required server configuration'); process.exitCode = 1 })
