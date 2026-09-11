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
 *
 * A fifth is `apiPath`, below: which request gets sent is decided here too, not by whatever a form
 * field happened to contain.
 */

import 'server-only'

import { failIfRequested, resolve } from '../data/latency'
import { sessionHeader } from '../server/current-user'
import { apiBaseUrl } from './config'
import { fieldMessages, type ProblemDetails } from './problem'

declare const API_PATH: unique symbol

/** A path whose interpolated values are escaped — see `apiPath`. */
export type ApiPath = string & { readonly [API_PATH]: true }

/**
 * The path of an API call, as a template whose interpolations are escaped: apiPath`/boards/${id}`.
 *
 * Every id in these paths reaches the server from outside — a route segment, a hidden form field —
 * and `fetch` runs whatever it is handed through the WHATWG URL parser. So an id spelling `/`, `..`
 * or `#` does not sit in the segment it was written into; it re-routes the request. `<uuid>/upvote/
 * toggle#` interpolated into `/ideas/{id}/status` posts an upvote instead, and `../..` climbs out of
 * `/api/v1` entirely — which would turn three Server Functions into a general-purpose authenticated
 * proxy to every route the API has, against the boundary `config.ts` states as a decision.
 *
 * `encodeURIComponent` closes most of that: `/` becomes `%2F` and `#` becomes `%23`, so no value can
 * span segments or start a fragment. **It does not close `.` and `..`**, which are unreserved in a
 * URI and left alone — and which are exactly the two the URL parser reads as path operators. So
 * `apiPath`/boards/${'..'}/ideas`` resolves to `/api/v1/ideas` with nothing escaped at all, one
 * segment up and into whatever route lives there.
 *
 * Those two are refused rather than escaped, because there is no escaping available: an encoded
 * `%2e%2e` is a different string the API would 404, not the value the caller meant. They are also
 * the only two raw values that survive as operators — `%2e%2e` double-encodes to `%252e%252e`, and
 * `../..` keeps the escaped slash that makes it inert — so this is the whole of the hole. Every
 * interpolation here is an id or a page number, neither of which is ever `.` or `..`, so a value
 * that is one is a bug or an attack and a throw is the honest answer to both.
 *
 * Everything else becomes one inert segment, which the API answers 404 for and `refusal()` puts
 * beside the control. The branded return type is the point of the tag: it is the only thing `apiGet`
 * and `apiPost` accept, so a path assembled any other way does not compile and the next caller does
 * not have to remember this.
 */
export function apiPath(literals: TemplateStringsArray, ...values: string[]): ApiPath {
  return String.raw({ raw: literals }, ...values.map(escapeSegment)) as ApiPath
}

function escapeSegment(value: string): string {
  if (value === '.' || value === '..') {
    throw new Error(`An API path cannot interpolate "${value}": it re-routes the request.`)
  }
  return encodeURIComponent(value)
}

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
export async function apiGet<T>(reader: string, path: ApiPath): Promise<T> {
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
export async function apiPost(path: ApiPath, body: unknown = {}): Promise<void> {
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
