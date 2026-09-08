/**
 * The current time, as a dependency rather than an ambient call.
 *
 * A port so tests can pin it, and so no domain or application code reaches for `new Date()`
 * directly - a service that does cannot be tested for anything time-dependent, and every
 * entity transition here already takes an explicit timestamp.
 *
 * The .NET original is `IClock.UtcNow`. Always UTC; the database columns are `timestamptz`.
 */
export interface Clock {
  now(): Date
}

/** The real one. Injected everywhere except tests. */
export const systemClock: Clock = {
  now: () => new Date(),
}
