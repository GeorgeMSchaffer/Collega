'use client'

import { useEffect } from 'react'
import { createUsageQueue, type UsageEvent, type UsageInput } from '@/lib/usage-queue'

/** The same-origin route that forwards a batch to the API (`app/(desk)/usage/events/route.ts`). */
export const USAGE_EVENTS_URL = '/usage/events'
const FLUSH_EVERY_MS = 10_000

/** `sendBeacon`, which survives the page closing; `fetch` with `keepalive` where it is refused. */
function send(events: UsageEvent[]): void {
  const body = JSON.stringify({ events })
  const beacon = new Blob([body], { type: 'application/json' })
  if (
    typeof navigator.sendBeacon === 'function' &&
    navigator.sendBeacon(USAGE_EVENTS_URL, beacon)
  ) {
    return
  }
  fetch(USAGE_EVENTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

const queue = createUsageQueue({ send, pathname: () => window.location.pathname })
let recording: 'pending' | 'on' | 'off' = 'pending'

/**
 * Records one usage event (`SPEC/20-feature-analytics.md` rule 7). Safe to call from any client
 * component: it never waits and never throws. A screen's effects run before the layout's, so an
 * event recorded before `<UsageRecorder>` has started is held until it decides.
 */
export function recordUsage(input: UsageInput): void {
  if (recording === 'off') return
  queue.record(input)
}

/**
 * Mounted once by the desk layout. `enabled` is false while a password change is owed and for a
 * Site Admin acting directly (`usageRecordingAllowed`); then whatever was held is dropped unsent.
 */
export function UsageRecorder({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      recording = 'off'
      queue.clear()
      return
    }
    recording = 'on'
    queue.setSending(true)
    const timer = window.setInterval(queue.flush, FLUSH_EVERY_MS)
    const onHide = () => {
      if (document.visibilityState === 'hidden') queue.flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      queue.flush()
      queue.setSending(false)
      recording = 'pending'
    }
  }, [enabled])
  return null
}
