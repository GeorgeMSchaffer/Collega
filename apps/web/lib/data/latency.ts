/**
 * Turns a fixture into the promise the real client will return.
 *
 * Every reader in `lib/data/` goes through this, so the call sites are already written against a
 * promise and Wave D replaces a body rather than a signature.
 *
 * `MOCK_LATENCY_MS` exists for one reason: a `loading.tsx` only renders while something is
 * genuinely pending, and a promise that resolves in the same tick never shows one. Without a way
 * to hold the response open, every loading state in this app would be unreviewable — present in
 * the source, never once seen. Set it to watch them:
 *
 *   MOCK_LATENCY_MS=800 pnpm dev
 *
 * Unset and it costs a microtask. It is read per call rather than captured at module load so it
 * can be changed without restarting a dev server that keeps this module warm.
 */
export async function resolve<T>(value: T): Promise<T> {
  const delay = Number(process.env.MOCK_LATENCY_MS ?? 0)
  if (delay > 0) {
    await new Promise((done) => setTimeout(done, delay))
  }
  return value
}

/**
 * Fails the way the API will, for exercising an `error.tsx` without breaking anything.
 *
 * `MOCK_FAIL` holds a comma-separated list of reader names — `MOCK_FAIL=getBoards pnpm dev` — so
 * one surface can be made to fail while the rest of the app stays usable. An error boundary that
 * has never actually caught anything is a guess, and this is how it stops being one.
 */
export function failIfRequested(reader: string): void {
  const failing = (process.env.MOCK_FAIL ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  if (failing.includes(reader)) {
    throw new Error(`${reader} failed because MOCK_FAIL names it.`)
  }
}
