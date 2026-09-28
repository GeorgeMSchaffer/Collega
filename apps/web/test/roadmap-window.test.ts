import { describe, expect, it } from 'vitest'
import {
  dayNumber,
  localToday,
  type RoadmapWindow,
  readZoom,
  roadmapWindow,
  spanIn,
} from '@/lib/roadmap-window'

/**
 * The Roadmap's fixed windows (`20-feature-issues-and-delivery.md` "Roadmap (comp R)"): Weeks — 16
 * Monday-start weeks from two weeks before this one; Months — 7 from this month; Quarters — 4 from
 * this quarter. `today` is passed in, so no clock is read.
 */
const day = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10)
const bounds = (w: RoadmapWindow) => [day(w.start), day(w.end)]

describe('readZoom', () => {
  it('reads each zoom', () => {
    expect(readZoom('weeks')).toBe('weeks')
    expect(readZoom('months')).toBe('months')
    expect(readZoom('quarters')).toBe('quarters')
  })

  it.each([null, undefined, '', 'Weeks', 'years', ' weeks'])('falls back to months for %j', (v) => {
    expect(readZoom(v)).toBe('months')
  })
})

describe('roadmapWindow — Weeks', () => {
  it('starts two Mondays back on a Monday (2026-09-28)', () => {
    const w = roadmapWindow('weeks', '2026-09-28')
    expect(bounds(w)).toEqual(['2026-09-14', '2027-01-04'])
    expect(w.columns).toHaveLength(16)
    expect(w.columns[0]?.label).toBe('SEP 14')
    expect(w.columns[2]?.label).toBe('28')
    expect(w.columns[3]?.label).toBe('OCT 5')
  })

  it('treats a Sunday (2026-09-27) as the end of the week before', () => {
    expect(bounds(roadmapWindow('weeks', '2026-09-27'))).toEqual(['2026-09-07', '2026-12-28'])
  })

  it('spans the turn of the year from 2026-12-31', () => {
    const w = roadmapWindow('weeks', '2026-12-31')
    expect(bounds(w)).toEqual(['2026-12-14', '2027-04-05'])
    expect(w.columns.map((c) => c.label)).toContain('JAN 4')
  })

  it('is the same window on 2027-01-01 as on 2026-12-31 (same week)', () => {
    expect(bounds(roadmapWindow('weeks', '2027-01-01'))).toEqual(
      bounds(roadmapWindow('weeks', '2026-12-31')),
    )
  })

  it('has seven-day columns across both DST changes', () => {
    for (const today of ['2026-03-29', '2026-10-25', '2026-03-08', '2026-11-01']) {
      const w = roadmapWindow('weeks', today)
      expect(w.end - w.start).toBe(112)
      const keys = w.columns.map((c) => Number(c.key))
      for (let n = 1; n < keys.length; n++) expect((keys[n] ?? 0) - (keys[n - 1] ?? 0)).toBe(7)
      // Every column starts on a Monday.
      for (const key of keys) expect(new Date(key * 86_400_000).getUTCDay()).toBe(1)
    }
  })
})

describe('roadmapWindow — Months', () => {
  it('shows this month and the six after it (2026-09-28)', () => {
    const w = roadmapWindow('months', '2026-09-28')
    expect(bounds(w)).toEqual(['2026-09-01', '2027-04-01'])
    expect(w.columns.map((c) => c.label)).toEqual([
      'SEP',
      'OCT',
      'NOV',
      'DEC',
      'JAN 27',
      'FEB',
      'MAR',
    ])
  })

  it('starts on the last day of a month in that month (2026-03-31)', () => {
    expect(bounds(roadmapWindow('months', '2026-03-31'))).toEqual(['2026-03-01', '2026-10-01'])
  })

  it('moves to the next month the day after (2026-12-31 → 2027-01-01)', () => {
    expect(bounds(roadmapWindow('months', '2026-12-31'))).toEqual(['2026-12-01', '2027-07-01'])
    const w = roadmapWindow('months', '2027-01-01')
    expect(bounds(w)).toEqual(['2027-01-01', '2027-08-01'])
    // The first column is not marked with its year; only a later January is.
    expect(w.columns[0]?.label).toBe('JAN')
  })
})

describe('roadmapWindow — Quarters', () => {
  it('shows this quarter and the three after it (2026-09-28)', () => {
    const w = roadmapWindow('quarters', '2026-09-28')
    expect(bounds(w)).toEqual(['2026-07-01', '2027-07-01'])
    expect(w.columns.map((c) => c.label)).toEqual(['Q3 2026', 'Q4 2026', 'Q1 2027', 'Q2 2027'])
  })

  it('keeps Q1 on its last day (2026-03-31) and moves to Q2 the next', () => {
    expect(bounds(roadmapWindow('quarters', '2026-03-31'))).toEqual(['2026-01-01', '2027-01-01'])
    expect(bounds(roadmapWindow('quarters', '2026-04-01'))).toEqual(['2026-04-01', '2027-04-01'])
  })

  it('crosses the year at 2026-12-31 → 2027-01-01', () => {
    expect(roadmapWindow('quarters', '2026-12-31').columns[0]?.label).toBe('Q4 2026')
    expect(roadmapWindow('quarters', '2027-01-01').columns[0]?.label).toBe('Q1 2027')
  })
})

describe('spanIn', () => {
  const w = roadmapWindow('months', '2026-09-28') // 2026-09-01 .. 2027-04-01, 212 days
  const width = w.end - w.start

  it('places a span inside the window, its last day inclusive', () => {
    const span = spanIn(w, '2026-09-01', '2026-09-01')
    expect(span?.left).toBe(0)
    expect(span?.width).toBeCloseTo(100 / width)
  })

  it('clips a span that starts before the window', () => {
    const span = spanIn(w, '2026-08-01', '2026-09-10')
    expect(span?.left).toBe(0)
    expect(span?.width).toBeCloseTo((10 / width) * 100)
  })

  it('clips a span that ends after the window', () => {
    const span = spanIn(w, '2027-03-25', '2027-06-30')
    expect((span?.left ?? 0) + (span?.width ?? 0)).toBe(100)
  })

  it('clips a span covering the whole window to 0–100', () => {
    expect(spanIn(w, '2025-01-01', '2028-01-01')).toEqual({ left: 0, width: 100 })
  })

  it('misses a span that ends the day before the window', () => {
    expect(spanIn(w, '2026-08-01', '2026-08-31')).toBeNull()
  })

  it('misses a span that starts on the window’s exclusive end', () => {
    expect(spanIn(w, '2027-04-01', '2027-04-10')).toBeNull()
  })

  it('keeps a span that starts on the window’s last day', () => {
    expect(spanIn(w, '2027-03-31', '2027-04-10')).not.toBeNull()
  })
})

describe('dayNumber and localToday', () => {
  it('counts calendar days, whatever the offset', () => {
    expect(dayNumber('1970-01-02')).toBe(1)
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-28')).toBe(2)
    expect(dayNumber('2026-11-02') - dayNumber('2026-10-31')).toBe(2)
  })

  it('reads the viewer’s local calendar date, not UTC’s', () => {
    // Local-time constructor, so this is late on the 28th wherever the test runs.
    expect(localToday(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28')
    expect(localToday(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
    expect(localToday(new Date(2026, 2, 29, 2, 30))).toBe('2026-03-29')
  })
})
