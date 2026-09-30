/**
 * Home: what needs the reader now (`SPEC/20-feature-client-ui.md`, comp Q `s-home`).
 *
 * Every figure is a count the API already answers — a `totalCount` from a one-row page, or the
 * length of a list the organization owns — so Home adds no route and pulls no rows it does not show.
 *
 * **Three of comp Q's tiles have no source yet, and answer null rather than an approximation.**
 * "Open ideas" and "Awaiting review" need to know which status means Complete and which means In
 * Review, and a status carries no such marker: the catalog is organization-defined and names are
 * free text. "Completed · 30d" needs the moment an idea reached Complete, which only the audit log
 * records and no route reads. Guessing from a status name or from the right-most lane would be a
 * business rule written in the client, so the tiles render their definition and say the figure is
 * not tracked yet. The recent-activity feed is missing for the same reason as the third.
 *
 * The attention queue is therefore narrower than comp Q's: critical and high-priority ideas still on
 * a board, oldest first. "Gone a week without moving" needs the same status-change time, and "open"
 * the same Complete marker. The page's standfirst says what it actually lists.
 */

import { toStatus } from '../api/adapt'
import { apiGet, apiPath, withQuery } from '../api/client'
import type {
  WireBoardListItem,
  WireDeliveryCard,
  WireIdeaListItem,
  WirePage,
  WireStatus,
  WireUserListItem,
} from '../api/wire'
import type { AttentionItem, HomeKpi, OrganizationHome, PlatformHome, Priority } from '../types'
import { failIfRequested } from './latency'
import { everyOrganization, organizationScope } from './scope'

export type {
  AttentionItem,
  HomeKpi,
  OrganizationHome,
  PlatformBoard,
  PlatformHome,
} from '../types'

/** How many rows the attention queue shows before "View all". */
const ATTENTION_ROWS = 5

const NOT_TRACKED = 'Not tracked yet'

/** A status the catalog no longer lists — a deleted one still holding ideas — drawn neutral. */
const UNKNOWN_STATUS_COLOR = 'var(--ink-faint)'

function ideaCount(reader: string, organizationId: string, params: URLSearchParams) {
  params.set('pageSize', '1')
  return apiGet<WirePage<WireIdeaListItem>>(
    reader,
    withQuery(apiPath`/organizations/${organizationId}/ideas`, params),
  ).then((page) => page.totalCount)
}

function toPriority(value: string): Priority {
  return value === 'Critical' || value === 'High' || value === 'Medium' ? value : 'Low'
}

/** Home for a member of an organization. Empty for a Site Admin, who has none. */
export async function getOrganizationHome(): Promise<OrganizationHome> {
  failIfRequested('getOrganizationHome')

  const scope = organizationScope()
  if (scope === null) {
    return { counts: { ideas: 0, boards: 0, issues: 0 }, statuses: [], kpis: [], attention: [] }
  }

  const reader = 'getOrganizationHome'
  const attentionParams = new URLSearchParams({
    phase: 'Ideas',
    sortBy: 'createdAt',
    sortDirection: 'asc',
    pageSize: String(ATTENTION_ROWS),
  })
  attentionParams.append('priority', 'Critical')
  attentionParams.append('priority', 'High')
  const assignedCritical = new URLSearchParams({ scope: 'assigned', priority: 'Critical' })

  const [boards, wireStatuses, issues, ideas, assigned, critical, attention] = await Promise.all([
    // Archived boards too: an attention row on one still needs its board's name.
    apiGet<readonly WireBoardListItem[]>(
      reader,
      apiPath`/organizations/${scope}/boards?includeArchived=true`,
    ),
    apiGet<readonly WireStatus[]>(reader, apiPath`/organizations/${scope}/statuses`),
    apiGet<readonly WireDeliveryCard[]>(reader, apiPath`/organizations/${scope}/delivery`),
    // Discovery only: the greeting counts delivery issues separately.
    ideaCount(reader, scope, new URLSearchParams({ phase: 'Ideas' })),
    ideaCount(reader, scope, new URLSearchParams({ scope: 'assigned' })),
    ideaCount(reader, scope, assignedCritical),
    apiGet<WirePage<WireIdeaListItem>>(
      reader,
      withQuery(apiPath`/organizations/${scope}/ideas`, attentionParams),
    ),
  ])

  const statuses = wireStatuses.map(toStatus)
  const boardNames = new Map(boards.map((board) => [board.boardId, board.name]))

  const kpis: HomeKpi[] = [
    {
      label: 'Open ideas',
      value: null,
      detail: NOT_TRACKED,
      definition: 'Anything not yet Complete or Archived, on any board you can see.',
      href: null,
    },
    {
      label: 'Awaiting review',
      value: null,
      detail: NOT_TRACKED,
      definition: 'Sitting in In Review, waiting on a decision from a person.',
      href: null,
    },
    {
      label: 'Assigned to me',
      value: assigned,
      detail: `${critical} critical`,
      definition: 'Every idea with your name in the Assigned field, whatever its status.',
      href: null,
    },
    {
      label: 'Completed · 30d',
      value: null,
      detail: NOT_TRACKED,
      definition: 'Reached Complete in the last 30 days, against the 30 days before it.',
      href: null,
    },
  ]

  return {
    counts: {
      ideas,
      boards: boards.filter((board) => !board.isArchived).length,
      issues: issues.length,
    },
    statuses,
    kpis,
    attention: attention.items.map(
      (idea): AttentionItem => ({
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
      }),
    ),
  }
}

/**
 * The Site Admin's roll-up: every organization, board and account on the deployment.
 *
 * The same fan-out the cross-organization settings screens use (`everyOrganization`), because no
 * route counts across organizations: one request for the list, then one per organization per
 * figure, in parallel. A single organization failing fails the page, which is where comp P puts
 * that error.
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
      const [boards, ideas, issues, users, inactive] = await Promise.all([
        apiGet<readonly WireBoardListItem[]>(
          reader,
          apiPath`/organizations/${organization.id}/boards`,
        ),
        ideaCount(reader, organization.id, new URLSearchParams({ phase: 'Ideas' })),
        apiGet<readonly WireDeliveryCard[]>(
          reader,
          apiPath`/organizations/${organization.id}/delivery`,
        ),
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
        boards: boards.map((board) => ({
          id: board.boardId,
          name: board.name,
          organizationName: organization.name,
          laneCount: board.swimlaneCount,
        })),
        ideas,
        issues: issues.length,
        users: users.totalCount,
        inactive: inactive.totalCount,
      }
    }),
  )

  const sum = (pick: (row: (typeof perOrganization)[number]) => number) =>
    perOrganization.reduce((total, row) => total + pick(row), 0)
  const boards = perOrganization.flatMap((row) => row.boards)
  const ideas = sum((row) => row.ideas)
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
      value: boards.length,
      detail: `across ${organizations.length} ${organizations.length === 1 ? 'organization' : 'organizations'}`,
      definition: 'Every board anyone can reach; open one to read it.',
      href: null,
    },
    {
      label: 'Open ideas',
      value: null,
      detail: `${NOT_TRACKED} · ${ideas} in total`,
      definition: 'Anything not yet Complete or Archived, in any organization.',
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
    counts: { organizations: organizations.length, ideas, issues: sum((row) => row.issues) },
    kpis,
    boards,
  }
}

/** Exported for the page's "View all" link: the attention queue as an `/ideas` filter. */
export const ATTENTION_HREF = '/ideas?priority=Critical&priority=High'
