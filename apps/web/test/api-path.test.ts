import { describe, expect, it } from 'vitest'
import { apiPath } from '@/lib/api/client'

/**
 * Which request `apiPath` can be made to send.
 *
 * Every value interpolated into these templates reaches the server from outside — a route segment,
 * or a hidden `boardId`/`ideaId` field that `lib/server/idea-actions.ts` says outright it cannot
 * trust. `fetch` runs the result through the WHATWG URL parser, so the question is never "what
 * string came out" but "what path does a browser resolve it to" — which is why every assertion here
 * goes through `new URL` rather than comparing text.
 *
 * `..` and `.` are the gap `encodeURIComponent` leaves: both are unreserved, so neither is touched,
 * and both are path operators. `apiPath`/boards/${'..'}/ideas`` resolved to `/api/v1/ideas` — a
 * sibling route one segment up, and `POST /api/v1/ideas` is an obvious route for this API to grow.
 */
const BASE = 'http://127.0.0.1:3001/api/v1'

/** Where a browser would actually send it, which is the only thing that matters here. */
function resolves(path: string): string {
  return new URL(`${BASE}${path}`).pathname
}

const UUID = '20111273-9308-42ff-80d4-1f527b4bd159'

describe('apiPath refuses the values that re-route a request', () => {
  it('throws on `..` rather than escaping it', () => {
    expect(() => apiPath`/boards/${'..'}/ideas`).toThrow(/cannot interpolate/)
    expect(() => apiPath`/ideas/${'..'}/status`).toThrow(/cannot interpolate/)
  })

  it('throws on `.` as well, which collapses a segment instead of climbing one', () => {
    expect(() => apiPath`/boards/${'.'}/ideas`).toThrow(/cannot interpolate/)
  })
})

describe('apiPath keeps an escaped value inside its own segment', () => {
  it('leaves a UUID untouched, so the ordinary call is unchanged', () => {
    expect(resolves(apiPath`/ideas/${UUID}/status`)).toBe(`/api/v1/ideas/${UUID}/status`)
  })

  it('does not let a multi-level climb out of the API prefix', () => {
    // The escaped `/` is what closes this one: `../..` cannot span segments, so it stays a single
    // inert segment under `/ideas` rather than reaching the host root.
    expect(resolves(apiPath`/ideas/${'../..'}/status`)).toMatch(/^\/api\/v1\/ideas\//)
  })

  it('does not let a percent-encoded dot segment through the second decode', () => {
    // `%2e%2e` is what an attacker reaches for once the literal `..` is refused. Double-encoding is
    // what makes it inert: the parser sees `%252e%252e`, not a dot segment.
    expect(resolves(apiPath`/ideas/${'%2e%2e'}/status`)).toBe('/api/v1/ideas/%252e%252e/status')
  })

  it('keeps a crafted id from reaching a different endpoint of the same resource', () => {
    // The case `lib/api/client.ts` names: an upvote toggle smuggled into the status route.
    expect(resolves(apiPath`/ideas/${`${UUID}/upvote/toggle#`}/status`)).toBe(
      `/api/v1/ideas/${UUID}%2Fupvote%2Ftoggle%23/status`,
    )
  })

  it('keeps a query separator from adding parameters the caller did not write', () => {
    expect(resolves(apiPath`/boards/${`${UUID}?pageSize=9999`}/ideas`)).toBe(
      `/api/v1/boards/${UUID}%3FpageSize%3D9999/ideas`,
    )
  })
})
