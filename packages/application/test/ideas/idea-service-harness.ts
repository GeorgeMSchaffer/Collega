// The in-memory IdeaService harness shared by the idea suites: every port faked, fixed clock, fixed
// ids. Each call builds fresh state, so nothing is shared between tests.

import { IdeaPhase, Priority, Role, UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import { createIdea, promoteIdeaToIssue } from '@collega/domain/ideas'
import type { CurrentUserContext, RandomSource } from '../../src/common/index.js'
import { IdeaService } from '../../src/ideas/idea.service.js'
import type {
  CreateIdeaCommand,
  IdeaListQuery,
  OrganizationIdeaListQuery,
  UpdateIdeaCommand,
} from '../../src/ideas/models.js'
import type {
  BoardContext,
  BoardsPort,
  BusinessImpactSummary,
  CommentsPort,
  IdeaClassificationPort,
  IdeaFieldValuesPort,
  IdeaFollowersPort,
  IdeaListFilter,
  IdeaRepository,
  IdeaTypeSummary,
  IssueTaskRollupPort,
  NotificationInput,
  NotificationsPort,
  OrganizationIdeaListFilter,
  SprintLookupPort,
  SprintSummary,
  StatusInfo,
  TagSummary,
  TagsPort,
  UpvoteCountsPort,
  UserSummary,
  UsersPort,
} from '../../src/ideas/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  ORG_B,
  recordingAudit,
} from '../support/fixtures.js'

export const BOARD_A = 'board-a'
export const BOARD_B = 'board-b'
export const STATUS_1 = 'status-1'
export const STATUS_2 = 'status-2'
export const TYPE_A = 'type-a'
export const TYPE_A2 = 'type-a2'
export const IMPACT_A = 'impact-a'
export const AUTHOR = 'author-1'

export function board(overrides: Partial<BoardContext> = {}): BoardContext {
  return {
    boardId: BOARD_A,
    organizationId: ORG_A,
    name: 'Acme Board',
    allowUserStatusUpdate: false,
    isArchived: false,
    swimlanes: [
      { statusId: STATUS_1, displayOrder: 0 },
      { statusId: STATUS_2, displayOrder: 1 },
    ],
    ...overrides,
  }
}

export function idea(overrides: Partial<Idea> = {}): Idea {
  const base = createIdea({
    id: 'idea-1',
    organizationId: ORG_A,
    boardId: BOARD_A,
    statusId: STATUS_1,
    title: 'Reduce onboarding friction',
    description: 'Cut the number of forms.',
    problem: 'Onboarding takes too long.',
    proposedSolutions: ['Cut the number of forms.'],
    impactRationale: 'Faster activation.',
    priority: Priority.Medium,
    ideaTypeId: TYPE_A,
    businessImpactId: IMPACT_A,
    dueDate: null,
    authorUserId: AUTHOR,
    assigneeUserIds: [],
    tagIds: [],
    mentionedUserIds: [],
    nowUtc: NOW,
  })
  return { ...base, ...overrides }
}

export function summary(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: AUTHOR,
    firstName: 'Ann',
    lastName: 'Author',
    email: 'ann@acme.test',
    role: Role.User,
    status: UserStatus.Active,
    organizationId: ORG_A,
    portraitPng: null,
    ...overrides,
  }
}

export const CREATE: CreateIdeaCommand = {
  title: 'A new idea',
  description: 'Body',
  problem: 'A problem',
  proposedSolutions: ['A solution'],
  impactRationale: 'A rationale',
  priority: Priority.Medium,
  ideaTypeId: TYPE_A,
  businessImpactId: IMPACT_A,
  dueDate: null,
  assigneeUserIds: null,
  statusId: null,
  tagNames: null,
  mentionEmails: null,
  fieldValues: null,
}

export const LIST_QUERY: IdeaListQuery = {
  page: null,
  pageSize: null,
  search: null,
  statusIds: [],
  tags: [],
  priorities: [],
  dueBefore: null,
  sortBy: null,
  sortDirection: null,
}

export const ORG_LIST_QUERY: OrganizationIdeaListQuery = {
  page: null,
  pageSize: null,
  search: null,
  scope: null,
  sortBy: null,
  sortDirection: null,
  fieldFilters: null,
  boardIds: [],
  statusIds: [],
  priorities: [],
  tags: [],
  user: null,
  phase: null,
}

export type Harness = {
  service: IdeaService
  saved: Idea[]
  added: Idea[]
  audit: ReturnType<typeof recordingAudit>
  notifications: NotificationInput[]
  /** Who follows each idea; edit it to model an unfollow or a follower who is not the author. */
  followersByIdea: Map<string, Set<string>>
  boardFilters: IdeaListFilter[]
  orgFilters: OrganizationIdeaListFilter[]
  /** Tags `getOrCreate` created, in order, with the colour the service picked for each. */
  createdTags: TagSummary[]
}

export function harness(options: {
  currentUser: CurrentUserContext
  boards?: readonly BoardContext[]
  ideas?: readonly Idea[]
  users?: readonly UserSummary[]
  sprints?: readonly SprintSummary[]
  /** Tags that already exist; `getOrCreate` reuses them by case-insensitive name. */
  tags?: readonly TagSummary[]
  random?: RandomSource
  /** Replaces the default followers (author and assignees) of the named ideas. */
  followers?: Readonly<Record<string, readonly string[]>>
  /** Overrides for the user-defined-field port, e.g. to make a save change a field value. */
  fieldValues?: Partial<IdeaFieldValuesPort>
}): Harness {
  const boardsById = new Map((options.boards ?? [board()]).map((b) => [b.boardId, b]))
  const ideasById = new Map((options.ideas ?? []).map((i) => [i.id, i]))
  const usersById = new Map((options.users ?? [summary()]).map((u) => [u.id, u]))
  const sprintsById = new Map((options.sprints ?? []).map((s) => [s.id, s]))

  const saved: Idea[] = []
  const added: Idea[] = []
  const notifications: NotificationInput[] = []
  const boardFilters: IdeaListFilter[] = []
  const orgFilters: OrganizationIdeaListFilter[] = []
  const tagsById = new Map((options.tags ?? []).map((t) => [t.id, t]))
  const createdTags: TagSummary[] = []

  const ideaRepository: IdeaRepository = {
    async getById(ideaId, includeDeleted = false) {
      const found = ideasById.get(ideaId) ?? null
      if (!found || (found.isDeleted && !includeDeleted)) {
        return null
      }
      return found
    },
    async add(i) {
      added.push(i)
    },
    async update(i) {
      saved.push(i)
    },
    async listByBoard(filter) {
      boardFilters.push(filter)
      const items = [...ideasById.values()].filter((i) => i.boardId === filter.boardId)
      return {
        items,
        page: 1,
        pageSize: 20,
        totalCount: items.length,
        sortBy: null,
        sortDirection: 'asc',
      }
    },
    async listByOrganization(filter) {
      orgFilters.push(filter)
      const items = [...ideasById.values()].filter(
        (i) => i.organizationId === filter.organizationId,
      )
      return {
        items,
        page: 1,
        pageSize: 20,
        totalCount: items.length,
        sortBy: null,
        sortDirection: 'asc',
      }
    },
    async getFieldValuesByIdeaIds() {
      return []
    },
    async listDelivery(filter) {
      return [...ideasById.values()].filter(
        (i) => i.organizationId === filter.organizationId && i.phase === IdeaPhase.Delivery,
      )
    },
    async listBySprint() {
      return []
    },
  }

  const boards: BoardsPort = {
    async getBoardContext(boardId) {
      return boardsById.get(boardId) ?? null
    },
    async getStatusInfo(organizationId) {
      const info: StatusInfo = {
        statusId: STATUS_1,
        name: organizationId === ORG_A ? 'New' : 'Beta New',
        color: '#fff',
        isDeleted: false,
      }
      return new Map([[STATUS_1, info]])
    },
  }

  const users: UsersPort = {
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const found = usersById.get(id)
        return found ? [found] : []
      })
    },
    async findByNormalizedEmail(email) {
      return [...usersById.values()].find((u) => u.email.toLowerCase() === email) ?? null
    },
  }

  const tags: TagsPort = {
    async listByIds(ids) {
      return ids.flatMap((id) => tagsById.get(id) ?? [])
    },
    async getOrCreate(input) {
      return input.requestedNames.map((name) => {
        const existing = [...tagsById.values()].find(
          (t) => t.name.toLowerCase() === name.trim().toLowerCase(),
        )
        if (existing) return existing
        const created = { id: `tag-${name}`, name, color: input.pickNewTagColor() }
        tagsById.set(created.id, created)
        createdTags.push(created)
        return created
      })
    },
  }

  const comments: CommentsPort = {
    async listByIdea() {
      return []
    },
    async countByIdea() {
      return 0
    },
    async countByIdeaIds() {
      return new Map()
    },
  }

  const ideaTypes: readonly IdeaTypeSummary[] = [
    {
      id: TYPE_A,
      organizationId: ORG_A,
      name: 'Improvement',
      colorHex: null,
      icon: null,
      isDeleted: false,
    },
    {
      id: TYPE_A2,
      organizationId: ORG_A,
      name: 'Experiment',
      colorHex: null,
      icon: null,
      isDeleted: false,
    },
    {
      id: 'type-b',
      organizationId: ORG_B,
      name: 'Beta Type',
      colorHex: null,
      icon: null,
      isDeleted: false,
    },
  ]
  const businessImpacts: readonly BusinessImpactSummary[] = [
    { id: IMPACT_A, organizationId: ORG_A, name: 'Medium', color: '#888', isDeleted: false },
    { id: 'impact-b', organizationId: ORG_B, name: 'Beta Impact', color: '#888', isDeleted: false },
  ]

  const classification: IdeaClassificationPort = {
    async getIdeaTypeById(id) {
      return ideaTypes.find((t) => t.id === id) ?? null
    },
    async listIdeaTypesByOrganization(organizationId) {
      return ideaTypes.filter((t) => t.organizationId === organizationId)
    },
    async getBusinessImpactById(id) {
      return businessImpacts.find((b) => b.id === id) ?? null
    },
    async listBusinessImpactsByOrganization(organizationId) {
      return businessImpacts.filter((b) => b.organizationId === organizationId)
    },
  }

  const baseFieldValues: IdeaFieldValuesPort = {
    async resolveAndValidate() {
      return []
    },
    async getReconcileScope() {
      return []
    },
    async getFieldNames() {
      return new Map()
    },
    async describeForDetail() {
      return []
    },
    async describeFormFields() {
      return []
    },
    async translateListFilters() {
      return { filters: [], searchTextFieldIds: [] }
    },
    async getExportColumns() {
      return []
    },
    async formatForExport() {
      return ''
    },
    async translateImportCell() {
      return { ok: true, stored: '' }
    },
  }

  const fieldValues: IdeaFieldValuesPort = { ...baseFieldValues, ...options.fieldValues }

  const upvoteCounts: UpvoteCountsPort = {
    async countByIdea() {
      return 7
    },
    async countByIdeaIds() {
      return new Map()
    },
    async getUpvotedIdeaIds() {
      return new Set()
    },
  }

  const sprints: SprintLookupPort = {
    async getById(sprintId) {
      return sprintsById.get(sprintId) ?? null
    },
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const found = sprintsById.get(id)
        return found ? [found] : []
      })
    },
  }

  const taskRollup: IssueTaskRollupPort = {
    async summaryByIdeaIds() {
      return new Map()
    },
  }

  // The author and assignees of a seeded idea follow it, as the migration's backfill makes true.
  const followersByIdea = new Map(
    [...ideasById.values()].map((i) => [
      i.id,
      new Set(options.followers?.[i.id] ?? [i.authorUserId, ...i.assigneeUserIds]),
    ]),
  )
  const followers: IdeaFollowersPort = {
    async add(rows) {
      for (const row of rows) {
        const set = followersByIdea.get(row.ideaId) ?? new Set<string>()
        set.add(row.userId)
        followersByIdea.set(row.ideaId, set)
      }
    },
    async listFollowerIds(ideaId) {
      return [...(followersByIdea.get(ideaId) ?? [])]
    },
    async countByIdea(ideaId) {
      return followersByIdea.get(ideaId)?.size ?? 0
    },
    async isFollowing(ideaId, userId) {
      return followersByIdea.get(ideaId)?.has(userId) ?? false
    },
  }

  const notificationsPort: NotificationsPort = {
    async notify(input) {
      notifications.push(input)
    },
  }

  const audit = recordingAudit()

  return {
    service: new IdeaService(
      ideaRepository,
      boards,
      users,
      tags,
      comments,
      classification,
      fieldValues,
      upvoteCounts,
      sprints,
      taskRollup,
      notificationsPort,
      followers,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
      options.random ?? { nextInt: () => 0 },
    ),
    saved,
    added,
    audit,
    notifications,
    followersByIdea,
    boardFilters,
    orgFilters,
    createdTags,
  }
}

export function updateFrom(existing: Idea): UpdateIdeaCommand {
  return {
    title: existing.title,
    description: existing.description,
    problem: existing.problem,
    proposedSolutions: [...existing.proposedSolutions],
    impactRationale: existing.impactRationale,
    priority: existing.priority,
    ideaTypeId: existing.ideaTypeId,
    businessImpactId: existing.businessImpactId,
    dueDate: existing.dueDate,
    assigneeUserIds: [...existing.assigneeUserIds],
    tagNames: null,
    mentionEmails: null,
    fieldValues: null,
  }
}

export function promotedIdea(overrides: Partial<Idea> = {}): Idea {
  const base = idea(overrides)
  return promoteIdeaToIssue(
    base,
    { effort: 'Medium' as never, sprintId: null, currentUpvoteCount: 3 },
    NOW,
    AUTHOR,
  )
}
