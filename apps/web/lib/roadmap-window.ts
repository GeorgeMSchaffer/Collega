/**
 * The Roadmap's visible window at each zoom (`SPEC/20-feature-issues-and-delivery.md`, "Roadmap
 * (comp R)"): fixed, anchored on the viewer's local today, no panning.
 *
 * - Weeks: 16 week columns (weeks start Monday), beginning two weeks before the current week.
 * - Months: 7 month columns, beginning with the current month.
 * - Quarters: 4 quarter columns, beginning with the current quarter.
 *
 * Pure, and `today` is a parameter, so the window around a month or quarter boundary can be tested
 * without a clock. Dates are calendar days (`YYYY-MM-DD`), counted as whole days since the epoch —
 * a day is not an instant, and doing the arithmetic in UTC keeps a viewer's offset out of it.
 */

export const ZOOMS = ['weeks', 'months', 'quarters'] as const
export type Zoom = (typeof ZOOMS)[number]
export const DEFAULT_ZOOM: Zoom = 'months'

export const ZOOM_LABELS: Record<Zoom, string> = {
  weeks: 'Weeks',
  months: 'Months',
  quarters: 'Quarters',
}

/** The `?zoom=` parameter, or the default for anything else. */
export function readZoom(value: string | null | undefined): Zoom {
  return ZOOMS.find((zoom) => zoom === value) ?? DEFAULT_ZOOM
}

export type RoadmapColumn = { key: string; label: string }

/** `start` inclusive, `end` exclusive, both in days since the epoch. */
export type RoadmapWindow = { start: number; end: number; columns: RoadmapColumn[] }

const DAY_MS = 86_400_000
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** A `YYYY-MM-DD` calendar day as a day number. */
export function dayNumber(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1) / DAY_MS
}

const fromParts = (year: number, monthIndex: number, date = 1) =>
  Date.UTC(year, monthIndex, date) / DAY_MS

/** The viewer's local calendar date, as `YYYY-MM-DD`. */
export function localToday(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function roadmapWindow(zoom: Zoom, today: string): RoadmapWindow {
  const t = dayNumber(today)
  const date = new Date(t * DAY_MS)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()

  if (zoom === 'weeks') {
    const monday = t - ((date.getUTCDay() + 6) % 7)
    const start = monday - 14
    const columns = Array.from({ length: 16 }, (_, n) => {
      const d = new Date((start + n * 7) * DAY_MS)
      const firstInMonth = n === 0 || d.getUTCDate() <= 7
      return {
        key: String(start + n * 7),
        label: `${firstInMonth ? `${MONTHS[d.getUTCMonth()]} ` : ''}${d.getUTCDate()}`,
      }
    })
    return { start, end: start + 16 * 7, columns }
  }

  if (zoom === 'quarters') {
    const first = month - (month % 3)
    const columns = Array.from({ length: 4 }, (_, n) => {
      const d = new Date(fromParts(year, first + n * 3) * DAY_MS)
      return {
        key: `${d.getUTCFullYear()}-Q${d.getUTCMonth() / 3 + 1}`,
        label: `Q${d.getUTCMonth() / 3 + 1} ${d.getUTCFullYear()}`,
      }
    })
    return { start: fromParts(year, first), end: fromParts(year, first + 12), columns }
  }

  const columns = Array.from({ length: 7 }, (_, n) => {
    const d = new Date(fromParts(year, month + n) * DAY_MS)
    const m = d.getUTCMonth()
    // A January after the first column carries its year, so the turn of the year is visible.
    const yearMark = n > 0 && m === 0 ? ` ${String(d.getUTCFullYear()).slice(2)}` : ''
    return { key: `${d.getUTCFullYear()}-${m + 1}`, label: `${MONTHS[m]}${yearMark}` }
  })
  return { start: fromParts(year, month), end: fromParts(year, month + 7), columns }
}

/** Where a day number falls across the window, as a percentage clamped to 0–100. */
export function positionIn(window: RoadmapWindow, day: number): number {
  const at = ((day - window.start) / (window.end - window.start)) * 100
  return Math.max(0, Math.min(100, at))
}

/**
 * A span of calendar days (`last` inclusive) placed on the window: its left edge and width in
 * percent, clipped at the window's edges — or `null` when the span misses the window entirely.
 */
export function spanIn(
  window: RoadmapWindow,
  first: string,
  last: string,
): { left: number; width: number } | null {
  const from = dayNumber(first)
  const to = dayNumber(last) + 1
  if (to <= window.start || from >= window.end) return null
  const left = positionIn(window, from)
  return { left, width: positionIn(window, to) - left }
}
