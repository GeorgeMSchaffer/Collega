'use client'

import { Analytics } from '@vercel/analytics/next'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The route template for a page view: every id in the path becomes `[id]`, and the query and hash
 * go, because `?idea=…` names an idea too (`SPEC/20-feature-analytics.md` requirement 3).
 */
export function routeTemplate(url: string): string {
  const parsed = new URL(url)
  parsed.pathname = parsed.pathname
    .split('/')
    .map((segment) => (GUID.test(segment) ? '[id]' : segment))
    .join('/')
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

/** Mounted once, by the root layout, and only where `analyticsEnabled()` says so. */
export function PageAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: routeTemplate(event.url) })} />
}
