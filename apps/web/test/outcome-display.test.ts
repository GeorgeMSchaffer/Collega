import { describe, expect, it } from 'vitest'
import {
  formatDay,
  formatMetric,
  formatWindow,
  metricShare,
  monthsOf,
  outcomeState,
  quarterOf,
} from '@/lib/outcome-display'

/** How the Outcome screens write dates, State and metric figures. Pure; `today` is a parameter. */
describe('outcomeState', () => {
  const window = { start: '2026-10-01', end: '2026-12-31' }

  it('is Planned the day before the window opens', () => {
    expect(outcomeState(window, '2026-09-30')).toBe('Planned')
  })

  it('is In its window on the first and the last day', () => {
    expect(outcomeState(window, '2026-10-01')).toBe('In its window')
    expect(outcomeState(window, '2026-12-31')).toBe('In its window')
  })

  it('is Past its window the day after it closes', () => {
    expect(outcomeState(window, '2027-01-01')).toBe('Past its window')
  })

  it('is In its window for a one-day window on that day', () => {
    expect(outcomeState({ start: '2026-10-05', end: '2026-10-05' }, '2026-10-05')).toBe(
      'In its window',
    )
  })
})

describe('date formatting', () => {
  it('writes a day without moving it for the viewer’s offset', () => {
    expect(formatDay('2026-10-01')).toBe('Oct 1, 2026')
    expect(formatDay('2026-01-01')).toBe('Jan 1, 2026')
  })

  it('writes the first year only when the window crosses a year', () => {
    expect(formatWindow('2026-10-01', '2026-12-31')).toBe('Oct 1 – Dec 31, 2026')
    expect(formatWindow('2026-11-01', '2027-02-28')).toBe('Nov 1, 2026 – Feb 28, 2027')
  })

  it('writes the card’s window as months of the end year', () => {
    expect(monthsOf('2026-09-15', '2026-11-30')).toBe('SEP – NOV 2026')
  })

  it('puts the quarter boundaries in the right quarter', () => {
    expect(quarterOf('2026-03-31')).toBe('Q1 2026')
    expect(quarterOf('2026-04-01')).toBe('Q2 2026')
    expect(quarterOf('2026-12-31')).toBe('Q4 2026')
  })
})

describe('formatMetric', () => {
  it('is a dash when there is no value, and zero is a value', () => {
    expect(formatMetric(null, 'hrs')).toBe('—')
    expect(formatMetric(0, 'hrs')).toBe('0 hrs')
  })

  it('puts the unit after the figure and groups thousands', () => {
    expect(formatMetric(12500, '$')).toBe('12,500 $')
  })

  it('writes a bare number when the type has no unit, rounded to two places', () => {
    expect(formatMetric(1.239, null)).toBe('1.24')
  })
})

describe('metricShare', () => {
  it('is realized as a rounded percent of projected', () => {
    expect(metricShare({ projected: 300, realized: 100 })).toBe(33)
    expect(metricShare({ projected: 300, realized: 200 })).toBe(67)
    expect(metricShare({ projected: 100, realized: 150 })).toBe(150)
  })

  it('is zero percent when nothing is realized yet', () => {
    expect(metricShare({ projected: 100, realized: 0 })).toBe(0)
  })

  it('is null when either side is missing or projected is zero', () => {
    expect(metricShare({ projected: null, realized: 5 })).toBeNull()
    expect(metricShare({ projected: 5, realized: null })).toBeNull()
    expect(metricShare({ projected: 0, realized: 5 })).toBeNull()
  })
})
