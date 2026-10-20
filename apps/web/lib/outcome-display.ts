/**
 * How the Outcome screens write what `GET /outcomes` returns. Dates are calendar days
 * (`YYYY-MM-DD`) and are formatted in UTC so a viewer's offset cannot move one.
 */

import type { MetricTotal } from './types'

const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

const at = (day: string) => new Date(`${day}T00:00:00Z`)

/** `Oct 1, 2026`. */
export const formatDay = (day: string) => LONG.format(at(day))

/** `Oct 1 – Dec 31, 2026`; the first year is written only when the two differ. */
export function formatWindow(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${(sameYear ? SHORT : LONG).format(at(start))} – ${formatDay(end)}`
}

/** `SEP – NOV 2026`, the card's window as months. */
export function monthsOf(start: string, end: string): string {
  const from = MONTH.format(at(start)).toUpperCase()
  const to = MONTH.format(at(end)).toUpperCase()
  return `${from} – ${to} ${end.slice(0, 4)}`
}

/** The calendar quarter a day falls in: `Q4 2026`. */
export function quarterOf(day: string): string {
  return `Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1} ${day.slice(0, 4)}`
}

export type OutcomeState = 'Planned' | 'In its window' | 'Past its window'

/** The drawer's derived State, from the viewer's local date; the API does not return it. */
export function outcomeState(window: { start: string; end: string }, today: string): OutcomeState {
  if (today < window.start) return 'Planned'
  if (today > window.end) return 'Past its window'
  return 'In its window'
}

/** A bare number with its unit after it; a dash when there is no value. */
export function formatMetric(value: number | null, unit: string | null): string {
  if (value === null) return '—'
  const figure = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return unit ? `${figure} ${unit}` : figure
}

/** Realized as a share of projected, or null when either is missing or projected is zero. */
export function metricShare(total: Pick<MetricTotal, 'projected' | 'realized'>): number | null {
  if (total.projected === null || total.realized === null || total.projected === 0) return null
  return Math.round((total.realized / total.projected) * 100)
}
