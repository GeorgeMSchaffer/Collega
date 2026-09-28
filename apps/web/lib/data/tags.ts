/**
 * The organization's tags (`20-feature-ideas-and-engagement.md` "Tags", rules 9–15).
 *
 * The catalog is unpaged and member-readable on purpose (`30-Contracts.md`): Settings → Tags lists
 * it, and the Ideas screen's Tags filter offers every tag from it, whoever is reading.
 */

import { toIdea, toTagOverview } from '../api/adapt'
import { apiGet, apiPath, withQuery } from '../api/client'
import type { WireIdeaListItem, WirePage, WireTagItem } from '../api/wire'
import type { TagOverview, TagRef } from '../types'
import { failIfRequested } from './latency'
import { everyOrganization, organizationScope } from './scope'

export type { TagOverview, TagRef } from '../types'

/** Every tag in the reader's organization, by name. Empty for a Site Admin, who has none. */
export async function getTagCatalog(): Promise<TagOverview[]> {
  failIfRequested('getTagCatalog')

  const scope = organizationScope()
  if (scope === null) return []

  const items = await apiGet<readonly WireTagItem[]>(
    'getTagCatalog',
    apiPath`/organizations/${scope}/tags/catalog`,
  )
  return items.map((item) => toTagOverview(item))
}

/** The Tags filter's options: every tag, with its colour. */
export async function getTagRefs(): Promise<TagRef[]> {
  return (await getTagCatalog()).map(({ id, name, color }) => ({ id, name, color }))
}

/**
 * Every organization's tags, for the read-only roll-up a Site Admin gets — the same fan-out as the
 * other catalogs' (`everyOrganization` says why).
 */
export async function getTagCatalogsByOrganization(): Promise<TagOverview[]> {
  failIfRequested('getTagCatalogsByOrganization')

  const organizations = await everyOrganization('getTagCatalogsByOrganization')
  const catalogs = await Promise.all(
    organizations.map(async (organization) =>
      (
        await apiGet<readonly WireTagItem[]>(
          'getTagCatalogsByOrganization',
          apiPath`/organizations/${organization.id}/tags/catalog`,
        )
      ).map((item) => toTagOverview(item, organization)),
    ),
  )
  return catalogs.flat()
}

/** How many of a tag's ideas the drawer's *Used on* lists before pointing at Ideas for the rest. */
export const TAG_USAGE_LIMIT = 25

/**
 * The ideas carrying a tag, for the tag drawer's *Used on* — not a new read, but the ideas list's
 * `tag` filter (`30-Contracts.md`), first page by title.
 */
export async function getTagUsage(
  organizationId: string,
  tagName: string,
): Promise<{ ideas: { id: string; title: string; boardId: string }[]; total: number }> {
  failIfRequested('getTagUsage')

  const params = new URLSearchParams({
    tag: tagName,
    page: '1',
    pageSize: String(TAG_USAGE_LIMIT),
    sortBy: 'title',
    sortDirection: 'asc',
  })
  const page = await apiGet<WirePage<WireIdeaListItem>>(
    'getTagUsage',
    withQuery(apiPath`/organizations/${organizationId}/ideas`, params),
  )
  return {
    ideas: page.items.map(toIdea).map(({ id, title, boardId }) => ({ id, title, boardId })),
    total: page.totalCount,
  }
}
