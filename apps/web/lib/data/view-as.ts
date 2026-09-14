/**
 * Who a Site Admin may act as.
 *
 * **The list is the server's answer, not a filter applied here.** `GET /auth/view-as/candidates`
 * returns only what the caller may target, already narrowed by the eligibility rules in
 * `SPEC/20-feature-view-as.md` — so this layer never reproduces them, and a rule changing on the
 * server changes the picker without a deployment here.
 *
 * `selectable` is false for rows the picker shows but must not offer: an inactive account, or a
 * member of an archived organization. They are shown rather than hidden so somebody looking for a
 * name finds it and learns why it is unavailable, instead of concluding the search is broken. The
 * server refuses them on start regardless of what was displayed.
 */

import { apiGet, apiPath } from '../api/client'
import type { WireViewAsCandidate } from '../api/wire'
import { failIfRequested } from './latency'

export type ViewAsCandidate = {
  userId: string
  displayName: string
  email: string
  role: string
  status: string
  organizationName: string
  selectable: boolean
}

export async function getViewAsCandidates(search?: string): Promise<ViewAsCandidate[]> {
  failIfRequested('getViewAsCandidates')

  const term = search?.trim() ?? ''
  const rows = await apiGet<readonly WireViewAsCandidate[]>(
    'getViewAsCandidates',
    term.length > 0
      ? apiPath`/auth/view-as/candidates?search=${term}`
      : apiPath`/auth/view-as/candidates`,
  )

  return rows.map((row) => ({
    userId: row.userId,
    displayName: `${row.firstName} ${row.lastName}`.trim(),
    email: row.email,
    role: row.role,
    status: row.status,
    organizationName: row.organizationName,
    selectable: row.selectable,
  }))
}
