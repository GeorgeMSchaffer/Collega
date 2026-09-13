/**
 * Sprints, issues, outcomes and the roadmap.
 *
 * The five delivery statuses are fixed and are NOT the org-configurable ideation statuses in
 * `./boards.ts` — two different sets that both read as "status", which is the confusion this
 * separation exists to prevent. They are a domain enum with no endpoint behind them, so
 * `getDeliveryStatuses` reads `DELIVERY_STATUSES` in `lib/display.ts`; that file says why.
 *
 * **Sprints and issues are real. Outcomes are not, and cannot be.** Slice 1 of Issues-and-Delivery
 * shipped the promotion gate, sprints, the delivery query and tasks. Outcomes are Slice 2, and
 * nothing of them exists: no `outcomes` table in the frozen schema, no entity, no service, no
 * route. `SPEC/30-Contracts.md` "Delivery Contracts" says it outright — "The Slice 2 Outcome and
 * Roadmap routes are deliberately absent; nothing here carries an `outcomeId`."
 *
 * So the three outcome readers answer **empty**, rather than the fixture's three invented themes.
 * That is the whole decision, and it is not tidiness. The alternative was a roadmap that lists
 * "Cut reporting effort — 3 issues" over rows nobody created, beside issues that are real: the
 * reader cannot tell which half is which, and finds out by clicking one. The ideas/board seam
 * already caused exactly that failure — a real count rising over invented rows — and empty is the
 * answer that cannot. Every screen involved already renders it correctly: the roadmap's own empty
 * state says "N delivery issues and nothing to group them by", which is precisely true, and the
 * backlog and issue pages say "Ungrouped" and "Not grouped".
 *
 * Building Outcomes properly is a schema amendment plus an entity, a service, eight routes and a
 * roadmap query — the spec sizes Slice 2 at five to seven days. It is not this slice.
 *
 * **There is no issue key**, and `getIssueByKey` is gone with it. `CLG-114` was comp Q's eyebrow
 * and has no column behind it, exactly as the idea inspector's `IDEA-101` does not (`lib/types.ts`
 * says why that one was dropped rather than derived). An Issue is not a resource of its own — it is
 * the `ideas` row in its `Delivery` phase — so it is addressed by `{ideaId}` everywhere the API is
 * concerned, and now everywhere the screens are too.
 */

import { toIssue, toSprint } from '../api/adapt'
import { apiGet, apiPath, isApiStatus } from '../api/client'
import type { WireDeliveryCard, WireSprint } from '../api/wire'
import { DELIVERY_STATUSES } from '../display'
import type { DeliveryStatus, Issue, Outcome, Sprint } from '../types'
import { failIfRequested, resolve } from './latency'
import { organizationScope } from './scope'

export type { DeliveryStatus, Effort, Issue, Outcome, Sprint, SprintState } from '../types'

export async function getDeliveryStatuses(): Promise<readonly DeliveryStatus[]> {
  failIfRequested('getDeliveryStatuses')
  return resolve(DELIVERY_STATUSES)
}

export async function getDeliveryStatus(id: string): Promise<DeliveryStatus | null> {
  return resolve(DELIVERY_STATUSES.find((status) => status.id === id) ?? null)
}

/**
 * Every sprint the organization has, in the order the API returns them.
 *
 * Unfiltered, including `Completed` ones: the backlog reads this to name the sprint it would start
 * next, and that decision needs to see what has already run. Filtering here would answer a
 * different question than the one the endpoint's `?state=` was built for.
 */
export async function getSprints(): Promise<Sprint[]> {
  failIfRequested('getSprints')

  const scope = organizationScope()
  if (scope === null) return []

  const sprints = await apiGet<readonly WireSprint[]>(
    'getSprints',
    apiPath`/organizations/${scope}/sprints`,
  )
  return sprints.map(toSprint)
}

/**
 * The sprint that is running, or `null` when none is.
 *
 * Filtered server-side rather than by reading every sprint and picking one, because `?state=Active`
 * is what the endpoint offers and the sprint board asks for exactly one row. At most one sprint is
 * `Active` in practice; if a deployment ever managed two, the first is the board's — a screen that
 * shows one board cannot show both, and guessing loudly is worse than guessing quietly here.
 */
export async function getActiveSprint(): Promise<Sprint | null> {
  failIfRequested('getActiveSprint')

  const scope = organizationScope()
  if (scope === null) return null

  const sprints = await apiGet<readonly WireSprint[]>(
    'getActiveSprint',
    apiPath`/organizations/${scope}/sprints?state=Active`,
  )
  const active = sprints[0]
  return active ? toSprint(active) : null
}

/**
 * One sprint's header.
 *
 * The response also embeds the sprint's Issues, which are deliberately dropped: the only caller is
 * the issue page naming the sprint an issue sits in, and it has the issue already. Reading them
 * would transfer the whole sprint to render one word.
 *
 * `null` for a missing or cross-organization sprint, which the API answers 404 for rather than 403
 * — the caller reaches the same "Backlog — not in a sprint" line either way.
 */
export async function getSprint(id: string | null): Promise<Sprint | null> {
  if (id === null) return null

  const scope = organizationScope()
  if (scope === null) return null

  try {
    return toSprint(
      await apiGet<WireSprint>('getSprint', apiPath`/organizations/${scope}/sprints/${id}`),
    )
  } catch (error) {
    if (isApiStatus(error, 404)) return null
    throw error
  }
}

/**
 * Every Issue in the organization — the backlog plus each sprint's.
 *
 * **That fan-out is the shape of the routes, not a missing optimisation.** `GET
 * /organizations/{id}/delivery` with no `sprintId` reads the *backlog* — Delivery items with no
 * sprint — and not everything; the controller says so in capitals, and it is the list an admin
 * pulls from. There is no "every Issue" query, so the whole set is the backlog unioned with one
 * read per sprint, which is one request per row of `getSprints`.
 *
 * Only the roadmap and the issue page need it, and both need all of it. A screen that wants one
 * sprint's cards should call `getIssuesInSprint`, not filter this.
 */
async function everyIssue(reader: string): Promise<Issue[]> {
  const scope = organizationScope()
  if (scope === null) return []

  const sprints = await apiGet<readonly WireSprint[]>(
    reader,
    apiPath`/organizations/${scope}/sprints`,
  )

  const lists = await Promise.all([
    apiGet<readonly WireDeliveryCard[]>(reader, apiPath`/organizations/${scope}/delivery`),
    ...sprints.map((sprint) =>
      apiGet<readonly WireDeliveryCard[]>(
        reader,
        apiPath`/organizations/${scope}/delivery?sprintId=${sprint.sprintId}`,
      ),
    ),
  ])

  return lists.flat().map(toIssue)
}

export async function getIssues(): Promise<Issue[]> {
  failIfRequested('getIssues')
  return everyIssue('getIssues')
}

export async function getIssuesInSprint(sprintId: string): Promise<Issue[]> {
  failIfRequested('getIssuesInSprint')

  const scope = organizationScope()
  if (scope === null) return []

  const cards = await apiGet<readonly WireDeliveryCard[]>(
    'getIssuesInSprint',
    apiPath`/organizations/${scope}/delivery?sprintId=${sprintId}`,
  )
  return cards.map(toIssue)
}

/**
 * Committed but not yet in a sprint. Most upvoted first, so it reads as the org's own priority.
 *
 * The sort is the client's: the repository orders every delivery read by `created_at_utc`, and the
 * backlog screen is built around the promotion snapshot instead ("Vote counts are the snapshot
 * taken at promotion"). Sorting a full list in the client is honest here in a way filtering one
 * page never is — this route does not page, so these rows are the whole backlog.
 */
export async function getBacklogIssues(): Promise<Issue[]> {
  failIfRequested('getBacklogIssues')

  const scope = organizationScope()
  if (scope === null) return []

  const cards = await apiGet<readonly WireDeliveryCard[]>(
    'getBacklogIssues',
    apiPath`/organizations/${scope}/delivery`,
  )
  return cards.map(toIssue).sort((a, b) => b.upvotesAtPromotion - a.upvotesAtPromotion)
}

/**
 * One Issue, by the id `/delivery/issues/[ideaId]` was reached with.
 *
 * **Found in the delivery set rather than fetched on its own, because there is no single-Issue
 * read.** `GET /ideas/{id}` exists and answers for a promoted idea, but its payload is the ideation
 * detail: no `phase`, no `effort`, no `deliveryStatus`, no sprint and no promotion snapshot. Every
 * field this screen is about lives on the delivery card, and the delivery card is only ever
 * returned by a list. That is worth a route one day; until then the cost is `everyIssue`'s fan-out.
 *
 * `null` rather than a throw for an id that is not a promoted idea in this organization — a
 * Discovery idea's id included, which is not on any delivery list and reaches `notFound()` here.
 */
export async function getIssue(id: string): Promise<Issue | null> {
  failIfRequested('getIssue')
  return (await everyIssue('getIssue')).find((issue) => issue.id === id) ?? null
}

/**
 * The roadmap's outcomes — empty, and this file's header says why at length.
 *
 * Not `[]` as a placeholder to be filled in later by a fixture: `[]` is the true answer until the
 * Slice 2 schema amendment lands. No organization has an outcome, because there is nowhere to put
 * one.
 */
export async function getOutcomes(): Promise<Outcome[]> {
  failIfRequested('getOutcomes')
  return resolve([])
}

export async function getOutcome(_id: string | null): Promise<Outcome | null> {
  return resolve(null)
}

export async function getIssuesForOutcome(_outcomeId: string): Promise<Issue[]> {
  return resolve([])
}
