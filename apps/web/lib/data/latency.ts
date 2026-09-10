/**
 * Holds a response open long enough to see the loading state.
 *
 * Every reader in `lib/data/` goes through this, fixture-backed or not — `lib/api/client.ts` runs
 * real responses through it too. That is deliberate: a local API answers in single-digit
 * milliseconds, so a real fetch does not show a `loading.tsx` any more reliably than a fixture did.
 *
 * `MOCK_LATENCY_MS` exists for one reason: a `loading.tsx` only renders while something is
 * genuinely pending, and a response that arrives in the same tick never shows one. Without a way
 * to hold it open, every loading state in this app would be unreviewable — present in
 * the source, never once seen. Set it to watch them:
 *
 *   MOCK_LATENCY_MS=800 pnpm dev
 *
 * Unset and it costs a microtask. It is read per call rather than captured at module load so it
 * can be changed without restarting a dev server that keeps this module warm.
 *
 * **Both knobs are inert in production**, and that is a security property rather than tidiness.
 * Setting a project environment variable is available to more people than deploying is, and these
 * two would otherwise let any one of them hold every server render open for thirty seconds, or 500
 * every authenticated page, without touching the code or leaving a deploy behind.
 */
export async function resolve<T>(value: T): Promise<T> {
  if (process.env.NODE_ENV === 'production') return value

  const delay = Number(process.env.MOCK_LATENCY_MS ?? 0)
  if (delay > 0) {
    await new Promise((done) => setTimeout(done, delay))
  }
  return value
}

/**
 * Fails the way the API does, for exercising an `error.tsx` without breaking anything.
 *
 * `MOCK_FAIL` holds a comma-separated list of reader names — `MOCK_FAIL=getBoards pnpm dev` — so
 * one surface can be made to fail while the rest of the app stays usable. An error boundary that
 * has never actually caught anything is a guess, and this is how it stops being one.
 *
 * Still here now that the readers are real, and more useful than before: a real network fails for
 * reasons a local API never will, and this is the only way to see what the screen does about it
 * without unplugging something. `lib/api/client.ts` calls it before every request, so the same
 * names work against the real endpoints.
 */
export function failIfRequested(reader: string): void {
  if (process.env.NODE_ENV === 'production') return

  const failing = (process.env.MOCK_FAIL ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  if (failing.includes(reader)) {
    throw new Error(`${reader} failed because MOCK_FAIL names it.`)
  }
}
