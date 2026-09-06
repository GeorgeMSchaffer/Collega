import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePageRequest,
  toPage,
} from '../src/common/pagination.js'

describe('normalizePageRequest', () => {
  it('defaults both fields when the request is undefined', () => {
    expect(normalizePageRequest(undefined)).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  })

  it('defaults pageSize when only page is supplied', () => {
    expect(normalizePageRequest({ page: 3 })).toEqual({ page: 3, pageSize: DEFAULT_PAGE_SIZE })
  })

  it('defaults page when only pageSize is supplied', () => {
    expect(normalizePageRequest({ pageSize: 50 })).toEqual({ page: 1, pageSize: 50 })
  })

  it('clamps a page below 1 up to 1', () => {
    expect(normalizePageRequest({ page: 0 }).page).toBe(1)
    expect(normalizePageRequest({ page: -5 }).page).toBe(1)
  })

  it('clamps a pageSize below 1 up to 1', () => {
    expect(normalizePageRequest({ pageSize: 0 }).pageSize).toBe(1)
    expect(normalizePageRequest({ pageSize: -10 }).pageSize).toBe(1)
  })

  it('clamps a pageSize above MAX_PAGE_SIZE down to MAX_PAGE_SIZE', () => {
    expect(normalizePageRequest({ pageSize: MAX_PAGE_SIZE + 1 }).pageSize).toBe(MAX_PAGE_SIZE)
    expect(normalizePageRequest({ pageSize: 100_000 }).pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('truncates a fractional page toward zero rather than rounding', () => {
    // Math.trunc, not Math.round: 1.9 must become 1, not 2.
    expect(normalizePageRequest({ page: 1.9 }).page).toBe(1)
    expect(normalizePageRequest({ page: 2.1 }).page).toBe(2)
  })

  it('truncates a fractional pageSize toward zero rather than rounding', () => {
    expect(normalizePageRequest({ pageSize: 10.7 }).pageSize).toBe(10)
  })

  it('MAX_PAGE_SIZE wins over a floor of 1 when the request asks for both extremes at once', () => {
    // Regression guard: a max(1, ...) applied AFTER the min(MAX_PAGE_SIZE, ...) clamp, instead
    // of before it, could not raise a too-small value back past the cap - but getting the
    // clamp order backwards (min applied to the unclamped floor) could let a request for a
    // negative-but-huge-looking size slip past MAX_PAGE_SIZE. Exercise both bounds together.
    expect(normalizePageRequest({ pageSize: -1 }).pageSize).toBe(1)
    expect(normalizePageRequest({ pageSize: Number.MAX_SAFE_INTEGER }).pageSize).toBe(MAX_PAGE_SIZE)
  })
})

describe('toPage', () => {
  it('wraps items with the page metadata, unchanged', () => {
    const result = toPage(['a', 'b'], 42, { page: 2, pageSize: 10 })
    expect(result).toEqual({ items: ['a', 'b'], page: 2, pageSize: 10, totalCount: 42 })
  })

  it('preserves an empty items array and a zero total', () => {
    const result = toPage([], 0, { page: 1, pageSize: 25 })
    expect(result).toEqual({ items: [], page: 1, pageSize: 25, totalCount: 0 })
  })
})
