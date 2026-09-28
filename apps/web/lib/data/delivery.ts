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

import { toIssue, toIssueTask, toMemberOption, toSprint } from '../api/adapt'
import { apiGet, apiPath, isApiStatus } from '../api/client'
import type { WireDeliveryCard, WireIssueTask, WireMember, WireSprint } from '../api/wire'
import { DELIVERY_STATUSES } from '../display'
import type { DeliveryStatus, Issue, IssueTask, MemberOption, Outcome, Sprint } from '../types'
import { failIfRequested, resolve } from './latency'
import { organizationScope } from './scope'

export type {
  DeliveryStatus,
  Effort,
  Issue,
  IssueTask,
  IssueTaskState,
  MemberOption,
  Outcome,
  Sprint,
  SprintState,
} from '../types'

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
 * The sprint the Sprint board shows: the running one, or — when none is running — the next
 * `Planned` one, earliest start first and ties by name
 * (`SPEC/20-feature-issues-and-delivery.md` "Sprint board (comp R)"). `null` when there is neither.
 *
 * Several `Active` sprints are allowed by the API; the board shows the first the list returns, as
 * it always has.
 */
export async function getBoardSprint(): Promise<Sprint | null> {
  failIfRequested('getBoardSprint')

  const sprints = await getSprints()
  const active = sprints.find((sprint) => sprint.state === 'Active')
  if (active) return active

  const planned = sprints
    .filter((sprint) => sprint.state === 'Planned')
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))
  return planned[0] ?? null
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
 * One Issue's delivery card, from `GET /ideas/{ideaId}/delivery` — the same card the lists return.
 *
 * `null` for anything that is not an Issue this reader can see: a Discovery idea, a deleted one,
 * another organization's, or a malformed id, which the API answers 404 (400 is tolerated too, for
 * the reason `getIdea` gives).
 */
export async function getIssue(id: string): Promise<Issue | null> {
  failIfRequested('getIssue')

  try {
    return toIssue(await apiGet<WireDeliveryCard>('getIssue', apiPath`/ideas/${id}/delivery`))
  } catch (error) {
    if (isApiStatus(error, 404) || isApiStatus(error, 400)) return null
    throw error
  }
}

/**
 * An Issue's checklist, in its order. Empty for an id the reader cannot see, which `getIssue`
 * answers `null` for beside it.
 */
export async function getIssueTasks(ideaId: string): Promise<IssueTask[]> {
  failIfRequested('getIssueTasks')

  try {
    const tasks = await apiGet<readonly WireIssueTask[]>(
      'getIssueTasks',
      apiPath`/ideas/${ideaId}/tasks`,
    )
    return tasks.map(toIssueTask)
  } catch (error) {
    if (isApiStatus(error, 404) || isApiStatus(error, 400)) return []
    throw error
  }
}

/**
 * The organization's active members, for the sprint owner and task assignee pickers. `/members`,
 * which every member may read, not the administrators' `/users`.
 */
export async function getMemberOptions(): Promise<MemberOption[]> {
  failIfRequested('getMemberOptions')

  const scope = organizationScope()
  if (scope === null) return []

  const members = await apiGet<readonly WireMember[]>(
    'getMemberOptions',
    apiPath`/organizations/${scope}/members`,
  )
  return members.map(toMemberOption).sort((a, b) => a.name.localeCompare(b.name))
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
