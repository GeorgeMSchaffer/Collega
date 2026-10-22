/**
 * Vercel Analytics' switch and its server-side events (`SPEC/20-feature-analytics.md`).
 *
 * On in production only, unless `COLLEGA_ANALYTICS=on` turns it on elsewhere (requirement 6), so a
 * preview or a local run sends nothing by default. Events carry no properties: the name alone is
 * the count the spec asks for, and nothing about the idea, board or person can leak through it.
 */

import 'server-only'
import { track } from '@vercel/analytics/server'

export type AnalyticsEvent = 'idea.created' | 'idea.assist.used' | 'view-as.started'

export function analyticsEnabled(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.COLLEGA_ANALYTICS === 'on'
}

export async function recordEvent(name: AnalyticsEvent): Promise<void> {
  if (!analyticsEnabled()) return
  try {
    await track(name)
  } catch {
    // Analytics never decides an outcome: a failed send must not fail the write it describes.
  }
}
