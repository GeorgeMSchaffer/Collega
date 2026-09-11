/**
 * Which organization a reader is scoped to.
 *
 * Most of the API's list routes hang off `/organizations/{id}/...`, and the id is not the caller's
 * to choose: it is whichever organization the acting user belongs to. Reading it from the resolved
 * principal rather than from a route parameter is what makes that true — there is no id in the URL
 * for a reader to change.
 *
 * A Site Admin belongs to no organization, so there is nothing to scope to and the readers answer
 * empty rather than guessing at one. That is the same story the sidebar and the settings hub
 * already tell that role, and the API would refuse a direct Site Admin anyway (View As is the way
 * in, and it is D7).
 *
 * The settings catalogs are the exception, and `everyOrganization` below is it: those screens are
 * *designed* cross-organization for that role, and read-only, which is the one thing a Site Admin
 * may do to organization content directly.
 */

import { apiGet, apiPath } from '../api/client'
import type { WireOrganizationListItem, WirePage } from '../api/wire'
import { currentUser } from '../session'

export function organizationScope(): string | null {
  return currentUser().organizationId
}

/**
 * Every organization on the deployment, which is what a Site Admin's settings lists are scoped to
 * instead.
 *
 * The three catalog screens each render a cross-organization variant (comp P's `s-statuses`,
 * `s-idea-types` and `s-fields`, all `data-roles="SiteAdmin"`), and each one is this list joined
 * against a per-organization catalog read. That fan-out is deliberate rather than a missing
 * endpoint: a status belongs to exactly one organization and there is no route that returns
 * everyone's at once. Comp P states the consequence in its own error copy — "this view queries
 * every organization in turn, so a single organization failing empties the whole list" — and a
 * throw here reaches the route's `error.tsx`, which is where that belongs.
 *
 * `GET /organizations` is Site Admin only and pages, so this is not a reader for anyone else; the
 * pages call it from a branch they have already taken on the role. The page size is the ceiling on
 * how many organizations a single cross-organization screen will show, and it is deliberately one
 * request: paging it would mean paging three settings tables that comp P draws unpaged.
 */
export async function everyOrganization(
  reader: string,
): Promise<readonly { id: string; name: string }[]> {
  const page = await apiGet<WirePage<WireOrganizationListItem>>(
    reader,
    apiPath`/organizations?pageSize=200`,
  )
  return page.items.map((organization) => ({
    id: organization.organizationId,
    name: organization.title,
  }))
}
