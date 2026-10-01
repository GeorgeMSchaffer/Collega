/**
 * Home: what needs the reader now (`SPEC/20-feature-client-ui.md` § Home; comp R
 * `SPEC/mockups/comp-r-home-dashboard.html` is the visual guide, and the spec wins where they
 * differ — decision 2026-10-01).
 *
 * Every figure is a count the API already answers — a `totalCount` from a short page, or the
 * length of a list the organization owns — so Home adds no route. **Every number is a filtered
 * query the reader can open**, so each count is paired here with the `/ideas` link that lists the
 * same set; the two are built side by side so they cannot drift apart.
 *
 * **What has no source yet is not computed.** "Open ideas" and "Awaiting review" need to know which
 * status means Complete and which means In Review, and a status carries no such marker. "Completed
 * · 30d" and the activity feed need status-change times, which only the audit log records and no
 * route reads. The page renders those as not tracked yet rather than as a guess.
 *
 * So "still on a board" means the Discovery phase, Complete lane included, until status categories
 * exist (decision 2026-10-01), and the attention queue is oldest by creation, not by time in lane.
 */

import { toBoardOverview, toSprint, toStatus } from '../api/adapt'
import { apiGet, apiPath, withQuery } from '../api/client'
import type {
  WireBoardListItem,
  WireDeliveryCard,
  WireIdeaListItem,
  WirePage,
  WireSprint,
  WireStatus,
  WireUserListItem,
} from '../api/wire'
import { DELIVERY_STATUSES } from '../display'
import type { HomeIdea, HomeKpi, OrganizationHome, PlatformHome, Priority } from '../types'
import { failIfRequested } from './latency'
import { everyOrganization, organizationScope } from './scope'

export type {
  HomeIdea,
  HomeIdeaList,
  HomeKpi,
  HomeSprint,
  OrganizationHome,
  PlatformHome,
  PlatformOrganization,
} from '../types'

/** How many rows each of Home's lists shows. */
const LIST_ROWS = 5

/** A status the catalog no longer lists — a deleted one still holding ideas — drawn neutral. */
const UNKNOWN_STATUS_COLOR = 'var(--ink-faint)'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function ideaPage(
  reader: string,
  organizationId: string,
  params: URLSearchParams,
  pageSize: number,
): Promise<WirePage<WireIdeaListItem>> {
  params.set('pageSize', String(pageSize))
  return apiGet<WirePage<WireIdeaListItem>>(
    reader,
    withQuery(apiPath`/organizations/${organizationId}/ideas`, params),
  )
}

function ideaCount(reader: string, organizationId: string, params: URLSearchParams) {
  return ideaPage(reader, organizationId, params, 1).then((page) => page.totalCount)
}

function toPriority(value: string): Priority {
  return value === 'Critical' || value === 'High' || value === 'Medium' ? value : 'Low'
}

/** The Active sprint ending first, ties by name: the decision's answer for two at once. */
function runningSprint(sprints: readonly WireSprint[]): WireSprint | null {
  return (
    sprints
      .filter((sprint) => sprint.state === 'Active')
      .sort((a, b) => a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name))[0] ?? null
  )
}

/** Home for a member of an organization. Empty for a Site Admin, who has none. */
export async function getOrganizationHome(): Promise<OrganizationHome> {
  failIfRequested('getOrganizationHome')

  const scope = organizationScope()
  if (scope === null) {
    return {
      counts: { ideas: 0, boards: 0, issues: 0 },
      ideasHref: null,
      statuses: [],
      kpis: [],
      attention: { total: 0, rows: [], href: '/ideas' },
      assigned: { total: 0, rows: [], href: '/ideas' },
      topVoted: [],
      boards: [],
      sprint: null,
    }
  }

  const reader = 'getOrganizationHome'

  const [boards, wireStatuses, backlog, sprints, issues] = await Promise.all([
    // Archived boards too: to know which to leave out, and to name a board in a row.
    apiGet<readonly WireBoardListItem[]>(
      reader,
      apiPath`/organizations/${scope}/boards?includeArchived=true`,
    ),
    apiGet<readonly WireStatus[]>(reader, apiPath`/organizations/${scope}/statuses`),
    // No sprintId: the backlog.
    apiGet<readonly WireDeliveryCard[]>(reader, apiPath`/organizations/${scope}/delivery`),
    apiGet<readonly WireSprint[]>(reader, apiPath`/organizations/${scope}/sprints`),
    ideaCount(reader, scope, new URLSearchParams({ phase: 'Issues' })),
  ])

  // **Ideas on archived boards are left out of every idea figure on Home** (decision 2026-10-01).
  // The API cannot exclude archived boards, so when one is archived each request and each link
  // names the live boards instead: `boardId` to the API, `board` to the `/ideas` URL, so every
  // count still matches the list it opens. With every board live the plain query is the same set.
  const liveBoards = boards.filter((board) => !board.isArchived)
  const someArchived = liveBoards.length < boards.length
  const onLiveBoards = (params: Record<string, string>, priorities: string[] = []) => {
    const api = new URLSearchParams(params)
    for (const priority of priorities) api.append('priority', priority)
    if (someArchived) for (const board of liveBoards) api.append('boardId', board.boardId)
    return api
  }
  const link = (params: Record<string, string>, priorities: string[] = []) => {
    const url = new URLSearchParams(params)
    for (const priority of priorities) url.append('priority', priority)
    if (someArchived) for (const board of liveBoards) url.append('board', board.boardId)
    return `/ideas?${url}`
  }
  const empty: WirePage<WireIdeaListItem> = { items: [], page: 1, pageSize: 1, totalCount: 0 }
  // With no live board there is nothing to filter to, and the page shows "No boards yet".
  const page = (params: URLSearchParams, rows: number) =>
    liveBoards.length === 0 ? Promise.resolve(empty) : ideaPage(reader, scope, params, rows)

  const urgent = ['Critical', 'High']
  const [critical, created, attention, assigned, voted] = await Promise.all([
    page(onLiveBoards({ scope: 'assigned' }, ['Critical']), 1).then((p) => p.totalCount),
    page(onLiveBoards({ scope: 'created' }), 1).then((p) => p.totalCount),
    page(
      onLiveBoards({ phase: 'Ideas', sortBy: 'createdAt', sortDirection: 'asc' }, urgent),
      LIST_ROWS,
    ),
    // The default phase, so a promoted Issue assigned to the reader is listed too.
    page(onLiveBoards({ scope: 'assigned', sortBy: 'priority', sortDirection: 'desc' }), LIST_ROWS),
    page(onLiveBoards({ phase: 'Ideas', sortBy: 'upvoteCount', sortDirection: 'desc' }), LIST_ROWS),
  ])
  const attentionHref = link({ phase: 'Ideas' }, urgent)
  const assignedHref = link({ scope: 'assigned', sort: 'priority', dir: 'desc' })

  const running = runningSprint(sprints)
  const sprintIssues = running
    ? await apiGet<readonly WireDeliveryCard[]>(
        reader,
        apiPath`/organizations/${scope}/delivery?sprintId=${running.sprintId}`,
      )
    : []

  const statuses = wireStatuses.map(toStatus)
  const boardNames = new Map(boards.map((board) => [board.boardId, board.name]))
  const toRow = (idea: WireIdeaListItem): HomeIdea => ({
    id: idea.ideaId,
    title: idea.title,
    boardName: boardNames.get(idea.boardId) ?? null,
    ideaType: idea.ideaTypeName,
    status: statuses.find((status) => status.id === idea.statusId) ?? {
      id: idea.statusId,
      name: idea.statusName,
      color: UNKNOWN_STATUS_COLOR,
    },
    priority: toPriority(idea.priority),
    createdAtUtc: idea.createdAtUtc,
    upvotes: idea.upvoteCount,
    hasUpvoted: idea.hasUpvoted,
  })

  // The greeting's ideas are the live boards' own counts, the same set its link lists.
  const ideas = liveBoards.reduce((total, board) => total + board.ideaCount, 0)

  const kpis: HomeKpi[] = [
    {
      label: 'Assigned to me',
      value: assigned.totalCount,
      detail: critical > 0 ? `${critical} critical` : 'none critical',
      detailAlert: critical > 0,
      definition: 'Every idea or issue with your name in Assigned, whatever its status.',
      href: assignedHref,
      detailHref: critical > 0 ? link({ scope: 'assigned' }, ['Critical']) : undefined,
    },
    {
      label: 'Critical & high',
      value: attention.totalCount,
      detail: 'still on a board',
      definition: 'Critical or high-priority ideas not yet promoted, on any board you can see.',
      href: attentionHref,
    },
    {
      label: 'You created',
      value: created,
      detail: 'ideas and issues',
      definition: 'Everything you authored, on any board, in either phase.',
      href: link({ scope: 'created' }),
    },
  ]

  return {
    counts: { ideas, boards: liveBoards.length, issues },
    ideasHref: ideas > 0 ? link({ phase: 'Ideas' }) : null,
    statuses,
    kpis,
    attention: {
      total: attention.totalCount,
      rows: attention.items.map(toRow),
      href: attentionHref,
    },
    assigned: { total: assigned.totalCount, rows: assigned.items.map(toRow), href: assignedHref },
    topVoted: voted.items.map(toRow),
    boards: liveBoards.map(toBoardOverview),
    sprint: running
      ? {
          sprint: toSprint(running),
          mix: DELIVERY_STATUSES.map((status) => ({
            status,
            count: sprintIssues.filter((issue) => issue.deliveryStatus === status.id).length,
          })),
          backlog: backlog.length,
        }
      : null,
  }
}

/**
 * The Site Admin's roll-up: every organization, board and account on the deployment.
 *
 * The same fan-out the cross-organization settings screens use (`everyOrganization`), because no
 * route counts across organizations: one request for the list, then one per organization per
 * figure, in parallel. A single organization failing fails the page, which is where comp P puts
 * that error. A platform summary route would replace this if organizations grow.
 */
export async function getPlatformHome(): Promise<PlatformHome> {
  failIfRequested('getPlatformHome')

  const reader = 'getPlatformHome'
  const [organizations, everyIncludingArchived] = await Promise.all([
    everyOrganization(reader),
    apiGet<WirePage<unknown>>(reader, apiPath`/organizations?isArchived=true&pageSize=1`),
  ])

  const perOrganization = await Promise.all(
    organizations.map(async (organization) => {
      const [boards, issues, users, inactive] = await Promise.all([
        apiGet<readonly WireBoardListItem[]>(
          reader,
          apiPath`/organizations/${organization.id}/boards`,
        ),
        ideaCount(reader, organization.id, new URLSearchParams({ phase: 'Issues' })),
        apiGet<WirePage<WireUserListItem>>(
          reader,
          apiPath`/organizations/${organization.id}/users?pageSize=1`,
        ),
        apiGet<WirePage<WireUserListItem>>(
          reader,
          apiPath`/organizations/${organization.id}/users?status=Inactive&pageSize=1`,
        ),
      ])
      return {
        id: organization.id,
        name: organization.name,
        boards: boards.map(toBoardOverview),
        // The live boards' own counts, the same ideas the board rows below add up to.
        ideas: boards.reduce((total, board) => total + board.ideaCount, 0),
        issues,
        users: users.totalCount,
        inactive: inactive.totalCount,
      }
    }),
  )

  const sum = (pick: (row: (typeof perOrganization)[number]) => number) =>
    perOrganization.reduce((total, row) => total + pick(row), 0)
  const ideas = sum((row) => row.ideas)
  const issues = sum((row) => row.issues)
  const archived = Math.max(0, everyIncludingArchived.totalCount - organizations.length)

  const kpis: HomeKpi[] = [
    {
      label: 'Organizations',
      value: organizations.length,
      detail: `${archived} archived`,
      definition: 'Every organization on this deployment, archived ones excluded.',
      href: '/settings/organizations',
    },
    {
      label: 'Boards',
      value: sum((row) => row.boards.length),
      detail: `across ${plural(organizations.length, 'organization', 'organizations')}`,
      definition: 'Every live board in every organization.',
      href: null,
    },
    {
      label: 'Ideas',
      value: ideas,
      detail: `plus ${plural(issues, 'delivery issue', 'delivery issues')}`,
      definition: 'Ideas still on a live board, in every organization.',
      href: null,
    },
    {
      label: 'Users',
      value: sum((row) => row.users),
      detail: `${sum((row) => row.inactive)} inactive`,
      definition: 'Every account in an organization, whatever its role.',
      href: '/settings/users',
    },
  ]

  return {
    counts: { organizations: organizations.length, ideas, issues },
    kpis,
    organizations: [...perOrganization].sort((a, b) => b.ideas - a.ideas),
  }
}
