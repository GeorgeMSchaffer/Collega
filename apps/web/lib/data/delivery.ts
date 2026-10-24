/**
 * Sprints and issues, and the one outcome reader the Backlog still takes.
 *
 * The five delivery statuses are fixed and are NOT the org-configurable ideation statuses in
 * `./boards.ts` — two different sets that both read as "status", which is the confusion this
 * separation exists to prevent. They are a domain enum with no endpoint behind them, so
 * `getDeliveryStatuses` reads `DELIVERY_STATUSES` in `lib/display.ts`; that file says why.
 *
 * Outcomes and the roadmap are read in `./outcomes`. `getOutcomes` below is the short form the
 * Backlog's Outcome column wants, derived from the roadmap read.
 *
 * **There is no issue key on the delivery card**, and `getIssueByKey` is gone with it. An Issue is
 * not a resource of its own — it is the `ideas` row in its `Delivery` phase — so it is addressed by
 * `{ideaId}` everywhere the API is concerned, and now everywhere the screens are too. **Nor does
 * the card carry an `outcomeId`**: `toIssue` leaves it `null`, and an Issue's Outcome is found by
 * looking for it among the roadmap's grouped items (`getOutcomeOf` in `./outcomes`).
 */

import { toIssue, toIssueTask, toMemberOption, toSprint } from '../api/adapt'
import { apiGet, apiPath, isApiStatus, withQuery } from '../api/client'
import type { WireDeliveryCard, WireIssueTask, WireMember, WireSprint } from '../api/wire'
import { DELIVERY_STATUSES } from '../display'
import { quarterOf } from '../outcome-display'
import type {
  DeliveryStatus,
  Issue,
  IssueTask,
  MemberOption,
  MentionCandidate,
  Outcome,
  Sprint,
  SprintState,
} from '../types'
import { failIfRequested, resolve } from './latency'
import { getOutcomeRoadmap } from './outcomes'
import { organizationScope } from './scope'

export type {
  DeliveryStatus,
  Effort,
  Issue,
  IssueTask,
  IssueTaskState,
  MemberOption,
  MentionCandidate,
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

/**
 * One board's sprints (`GET /boards/{id}/sprints`), optionally narrowed to one state. Empty for a
 * board the reader cannot see.
 */
export async function getBoardSprints(boardId: string, state?: SprintState): Promise<Sprint[]> {
  failIfRequested('getBoardSprints')

  const params = new URLSearchParams()
  if (state) params.set('state', state)
  try {
    const sprints = await apiGet<readonly WireSprint[]>(
      'getBoardSprints',
      withQuery(apiPath`/boards/${boardId}/sprints`, params),
    )
    return sprints.map(toSprint)
  } catch (error) {
    if (isApiStatus(error, 404) || isApiStatus(error, 400)) return []
    throw error
  }
}

/**
 * A board sprint's cards include its work-board tasks and standalone cards (`contracts/delivery.md`
 * "A board sprint"), which carry no delivery status or effort. They are not Issues and the Sprint
 * board has no lane for them; they are scheduled and shown on their board's own Sprints tab and
 * planning page, so they are left out here rather than turned into a throw in `toIssue`, which
 * stays strict for a real Issue missing its status.
 */
export async function getIssuesInSprint(sprintId: string): Promise<Issue[]> {
  failIfRequested('getIssuesInSprint')

  const scope = organizationScope()
  if (scope === null) return []

  const cards = await apiGet<readonly WireDeliveryCard[]>(
    'getIssuesInSprint',
    apiPath`/organizations/${scope}/delivery?sprintId=${sprintId}`,
  )
  return cards.filter((card) => card.deliveryStatus !== null).map(toIssue)
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
 * The same members, with the address the comment composer sends for an @mention. The organization
 * is passed in because the caller is a route handler, which has no render scope to read it from.
 */
export async function getMentionCandidates(organizationId: string): Promise<MentionCandidate[]> {
  failIfRequested('getMentionCandidates')

  const members = await apiGet<readonly WireMember[]>(
    'getMentionCandidates',
    apiPath`/organizations/${organizationId}/members`,
  )
  return members
    .map((member) => ({ ...toMemberOption(member), email: member.email }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Every Outcome in roadmap order, as the name, colour and quarter a picker or column needs. A Site
 * Admin has no organization to scope to, so the roadmap read answers empty and so does this.
 */
export async function getOutcomes(): Promise<Outcome[]> {
  failIfRequested('getOutcomes')
  const { outcomes } = await getOutcomeRoadmap()
  return outcomes.map((outcome) => ({
    id: outcome.id,
    name: outcome.name,
    color: outcome.color,
    quarter: quarterOf(outcome.targetStartDate),
  }))
}
