/**
 * The one place `apps/web` calls `apps/api`.
 *
 * Server-side only. Every reader in `lib/data/` goes through `apiGet`, which means three things
 * are decided once rather than per reader:
 *
 * 1. **The session cookie is forwarded explicitly**, via `sessionHeader()` — the credential lives
 *    behind `lib/server/current-user.ts`, which is the only file allowed to read it. Forget this
 *    and every call is a 401 that looks like a permissions bug.
 * 2. **Nothing is cached.** Two people signed into the same deployment must never be served each
 *    other's rows, and a response that varies by session cannot be shared. `no-store` is explicit
 *    rather than relying on the framework default staying what it is today.
 * 3. **A failure throws.** The nearest `error.tsx` is the error UI, and it only runs if the render
 *    actually fails. Returning `null` on a 500 would render an "empty board" and hide an outage.
 */

import 'server-only'

import { failIfRequested, resolve } from '../data/latency'
import { sessionHeader } from '../server/current-user'
import { apiBaseUrl } from './config'

/**
 * A request the API refused or could not answer.
 *
 * `status` is kept because the callers branch on it: 401 sends the reader back to sign-in, 404 is
 * `notFound()`, and everything else is a genuine error boundary.
 */
export class ApiError extends Error {
  readonly status: number
  readonly path: string

  constructor(status: number, path: string, detail: string) {
    super(`${path} answered ${status}: ${detail}`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
}

/** The API's RFC 7807 problem envelope, as much of it as a message needs. */
type ProblemDetails = { title?: unknown; detail?: unknown }

async function describeFailure(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    const problem = body as ProblemDetails
    const detail = typeof problem.detail === 'string' ? problem.detail : null
    const title = typeof problem.title === 'string' ? problem.title : null
    return detail ?? title ?? response.statusText
  } catch {
    return response.statusText
  }
}

/**
 * A GET against the API, as the signed-in caller.
 *
 * `reader` is the name `MOCK_FAIL` matches, so a real endpoint can still be made to fail on demand
 * — see `lib/data/latency.ts`. It also names the call in the thrown message, which is what turns
 * "something 500ed" into "getBoard 500ed" in an error boundary.
 */
export async function apiGet<T>(reader: string, path: string): Promise<T> {
  failIfRequested(reader)

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json', ...(await sessionHeader()) },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ApiError(response.status, path, await describeFailure(response))
  }

  // Through `resolve` so `MOCK_LATENCY_MS` still holds a real response open. A local API answers
  // in single-digit milliseconds, which is not long enough for a `loading.tsx` to render either.
  return resolve((await response.json()) as T)
}

/** Whether a thrown value is the API answering `status`. */
export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}
