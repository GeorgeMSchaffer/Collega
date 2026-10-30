import type { UsageFailureLog } from '@collega/application/usage'

/**
 * A batch that could not be stored, as one JSON line on the console (SPEC/20-feature-analytics.md
 * rule 14). Vercel keeps runtime logs and a drain can keep them longer; a local file would not
 * survive a serverless request. The events hold no content (rule 8), so logging them is safe.
 */
export const consoleUsageFailureLog: UsageFailureLog = {
  writeFailed(entry) {
    console.error(JSON.stringify({ tag: 'usage_events_write_failed', ...entry }))
  },
}
