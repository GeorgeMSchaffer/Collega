// Clock is the TS replacement for the .NET IClock.UtcNow
// (src/Collega.Application/Abstractions/IClock.cs): a port so tests can pin time instead
// of reaching for `new Date()` ambiently. There is barely any logic here, but the one
// thing worth pinning is that systemClock actually delegates to the real clock rather
// than returning a fixed or memoized value - a bug that unit tests elsewhere would never
// surface, because they inject a fake Clock and never touch systemClock at all.

import { describe, expect, it } from 'vitest'
import { systemClock } from '../src/common/clock.js'

describe('systemClock', () => {
  it('returns a Date close to the real current time', () => {
    const before = Date.now()
    const result = systemClock.now()
    const after = Date.now()

    expect(result).toBeInstanceOf(Date)
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
  })

  it('reads the clock fresh on every call rather than returning a memoized value', () => {
    const first = systemClock.now()
    const second = systemClock.now()

    // Not a strict `>` - two calls can legitimately land in the same millisecond - but a
    // memoized `now` bound to a single `Date` instance would fail the identity check.
    expect(first).not.toBe(second)
  })
})
