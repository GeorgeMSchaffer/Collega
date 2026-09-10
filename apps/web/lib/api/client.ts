/**
 * The one place `apps/web` calls `apps/api`.
 *
 * Server-side only. Every reader in `lib/data/` goes through `apiGet` and every mutation in
 * `lib/server/` through `apiPost`, which means three things are decided once rather than per call:
 *
 * 1. **The session cookie is forwarded explicitly**, via `sessionHeader()` — the credential lives
 *    behind `lib/server/current-user.ts`, which is the only file allowed to read it. Forget this
 *    and every call is a 401 that looks like a permissions bug.
 * 2. **Nothing is cached.** Two people signed into the same deployment must never be served each
 *    other's rows, and a response that varies by session cannot be shared. `no-store` is explicit
 *    rather than relying on the framework default staying what it is today.
 * 3. **A failure throws.** The nearest `error.tsx` is the error UI, and it only runs if the render
 *    actually fails. Returning `null` on a 500 would render an "empty board" and hide an outage.
 *
 * A mutation adds a fourth: the API is the only thing that decides whether the caller may write.
 * `apiPost` therefore sends the request and lets the refusal come back, rather than consulting the
 * principal first — a check here could only ever disagree with the one that matters.
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
  /**
   * What the API said, on its own — no path and no status around it.
   *
   * A mutation shows this to the person who tried to write ("Read Only users cannot create or edit
   * ideas."), which is the whole reason it is kept separately from `message`: that one is written
   * for a log line and reads as one.
   */
  readonly detail: string

  constructor(status: number, path: string, detail: string) {
    super(`${path} answered ${status}: ${detail}`)
    this.name = 'ApiError'
    this.status = status
    this.path = path
    this.detail = detail
  }
}

/** The API's RFC 7807 problem envelope, as much of it as a message needs. */
type ProblemDetails = { title?: unknown; detail?: unknown; errors?: unknown }

/**
 * The field-level messages a validation 400 carries.
 *
 * Worth reaching for because that envelope's `detail` is "The request failed validation. See the
 * errors property for field-level details." — true, and useless to the person who left the title
 * empty. The first message per field, joined, is what they actually need to read.
 */
function fieldMessages(errors: unknown): string | null {
  if (typeof errors !== 'object' || errors === null) return null

  const messages = Object.values(errors)
    .map((list) => (Array.isArray(list) ? list.find((entry) => typeof entry === 'string') : null))
    .filter((message) => typeof message === 'string')

  return messages.length > 0 ? messages.join(' ') : null
}

async function describeFailure(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    const problem = body as ProblemDetails
    const detail = typeof problem.detail === 'string' ? problem.detail : null
    const title = typeof problem.title === 'string' ? problem.title : null
    return fieldMessages(problem.errors) ?? detail ?? title ?? response.statusText
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

/**
 * A POST against the API, as the signed-in caller.
 *
 * The response body is discarded rather than returned, and that is not laziness: all three
 * mutations behind it answer with what they just wrote, and the screen re-reads that from the
 * server anyway when `revalidatePath` re-renders it. Returning it would invite a second source of
 * truth for the same row — one from the write, one from the following read — that could disagree.
 *
 * No `reader` name and no `failIfRequested`: `MOCK_FAIL` exists so a screen's `error.tsx` can be
 * exercised, and a mutation has no such boundary — a refusal here is a message beside the control.
 *
 * The default body is `{}` rather than nothing, so the upvote toggle — the one route here that
 * takes no payload — is the same request shape as the other two instead of a branch.
 */
export async function apiPost(path: string, body: unknown = {}): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(await sessionHeader()),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ApiError(response.status, path, await describeFailure(response))
  }
}

/** Whether a thrown value is the API answering `status`. */
export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}
