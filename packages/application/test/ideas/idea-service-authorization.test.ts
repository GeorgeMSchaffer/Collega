// Cross-organization isolation and the four-role matrix for IdeaService
// (SPEC/20-feature-ideas-and-engagement.md "Permissions", SPEC/20-feature-view-as.md rules 25-26).
//
// The two properties every test here is about:
//   1. A caller bound to org A can neither read nor write anything belonging to org B, and is told
//      "not found" rather than "forbidden", so the refusal does not confirm the row exists.
//   2. A Site Admin acting as themselves reads everything and mutates nothing.

import { IdeaPhase, Priority, Role, SprintState, UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import { createIdea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
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
  TagsPort,
  UpvoteCountsPort,
  UserSummary,
  UsersPort,
} from '../../src/ideas/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
  member as memberContext,
} from '../support/fixtures.js'

const BOARD_A = 'board-a'
const BOARD_B = 'board-b'
const STATUS_1 = 'status-1'
const STATUS_2 = 'status-2'
const TYPE_A = 'type-a'
const IMPACT_A = 'impact-a'
const AUTHOR = 'author-1'

function board(overrides: Partial<BoardContext> = {}): BoardContext {
  return {
    boardId: BOARD_A,
    organizationId: ORG_A,
    name: 'Acme Board',
    allowUserStatusUpdate: false,
    swimlanes: [
      { statusId: STATUS_1, displayOrder: 0 },
      { statusId: STATUS_2, displayOrder: 1 },
    ],
    ...overrides,
  }
}

function idea(overrides: Partial<Idea> = {}): Idea {
  const base = createIdea({
    id: 'idea-1',
    organizationId: ORG_A,
    boardId: BOARD_A,
    statusId: STATUS_1,
    title: 'Reduce onboarding friction',
    description: 'Cut the number of forms.',
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

function summary(overrides: Partial<UserSummary> = {}): UserSummary {
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

const CREATE: CreateIdeaCommand = {
  title: 'A new idea',
  description: 'Body',
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

const LIST_QUERY: IdeaListQuery = {
  page: null,
  pageSize: null,
  search: null,
  statusId: null,
  tag: null,
  priority: null,
  dueBefore: null,
  sortBy: null,
  sortDirection: null,
}

const ORG_LIST_QUERY: OrganizationIdeaListQuery = {
  page: null,
  pageSize: null,
  search: null,
  scope: null,
  sortBy: null,
  sortDirection: null,
  fieldFilters: null,
  tag: null,
  user: null,
  phase: null,
}

type Harness = {
  service: IdeaService
  saved: Idea[]
  added: Idea[]
  audit: ReturnType<typeof recordingAudit>
  notifications: NotificationInput[]
  boardFilters: IdeaListFilter[]
  orgFilters: OrganizationIdeaListFilter[]
}

function harness(options: {
  currentUser: CurrentUserContext
  boards?: readonly BoardContext[]
  ideas?: readonly Idea[]
  users?: readonly UserSummary[]
  sprints?: readonly SprintSummary[]
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
      return { items, page: 1, pageSize: 20, totalCount: items.length, sortBy: null, sortDirection: 'asc' }
    },
    async listByOrganization(filter) {
      orgFilters.push(filter)
      const items = [...ideasById.values()].filter(
        (i) => i.organizationId === filter.organizationId,
      )
      return { items, page: 1, pageSize: 20, totalCount: items.length, sortBy: null, sortDirection: 'asc' }
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
    async listByIds() {
      return []
    },
    async getOrCreate(input) {
      return input.requestedNames.map((name) => ({ id: `tag-${name}`, name }))
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
    { id: TYPE_A, organizationId: ORG_A, name: 'Improvement', colorHex: null, icon: null, isDeleted: false },
    { id: 'type-b', organizationId: ORG_B, name: 'Beta Type', colorHex: null, icon: null, isDeleted: false },
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

  const fieldValues: IdeaFieldValuesPort = {
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
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    saved,
    added,
    audit,
    notifications,
    boardFilters,
    orgFilters,
  }
}

// Cross-organization isolation -------------------------------------------------------------

describe('IdeaService cross-organization isolation', () => {
  const foreignBoard = board({ boardId: BOARD_B, organizationId: ORG_B, name: 'Beta Board' })
  const foreignIdea = idea({ id: 'idea-b', organizationId: ORG_B, boardId: BOARD_B })

  const callers: readonly [string, () => CurrentUserContext][] = [
    ['OrgAdmin', () => orgAdmin(ORG_A)],
    ['User', () => memberContext(ORG_A)],
    ['ReadOnly', () => readOnly(ORG_A)],
  ]

  describe.each(callers)("a %s of org A against org B's data", (_label, caller) => {
    it('cannot list another organization’s board', async () => {
      const { service } = harness({ currentUser: caller(), boards: [foreignBoard] })
      await expect(service.listByBoard(BOARD_B, LIST_QUERY)).rejects.toThrow(NotFoundError)
    })

    it('cannot read another organization’s idea', async () => {
      const { service } = harness({
        currentUser: caller(),
        boards: [foreignBoard],
        ideas: [foreignIdea],
      })
      await expect(service.getById('idea-b')).rejects.toThrow(NotFoundError)
    })

    it('cannot enumerate another organization’s idea list', async () => {
      const { service } = harness({ currentUser: caller(), ideas: [foreignIdea] })
      await expect(service.listByOrganization(ORG_B, ORG_LIST_QUERY)).rejects.toThrow(NotFoundError)
    })

    it('cannot create an idea on another organization’s board', async () => {
      const { service, added } = harness({ currentUser: caller(), boards: [foreignBoard] })
      await expect(service.create(BOARD_B, CREATE)).rejects.toThrow()
      expect(added).toHaveLength(0)
    })

    it('cannot change the status of another organization’s idea', async () => {
      const { service, saved } = harness({
        currentUser: caller(),
        boards: [foreignBoard],
        ideas: [foreignIdea],
      })
      await expect(service.changeStatus('idea-b', { statusId: STATUS_2 })).rejects.toThrow()
      expect(saved).toHaveLength(0)
    })

    it('cannot delete another organization’s idea', async () => {
      const { service, saved } = harness({ currentUser: caller(), ideas: [foreignIdea] })
      await expect(service.delete('idea-b')).rejects.toThrow()
      expect(saved).toHaveLength(0)
    })

    it('cannot read another organization’s delivery board', async () => {
      const { service } = harness({ currentUser: caller() })
      await expect(
        service.listDelivery(ORG_B, { sprintId: null, deliveryStatus: null }),
      ).rejects.toThrow(NotFoundError)
    })

    it('cannot export another organization’s board', async () => {
      const { service } = harness({ currentUser: caller(), boards: [foreignBoard] })
      await expect(service.exportBoardIdeas(BOARD_B)).rejects.toThrow(NotFoundError)
    })
  })

  it('refuses a cross-organization read with not-found, never forbidden - a 403 would confirm the idea exists', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ideas: [foreignIdea] })

    await expect(service.getById('idea-b')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('scopes the repository query itself, so the store is never asked for another organization', async () => {
    const { service, orgFilters } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    expect(orgFilters).toHaveLength(1)
    expect(orgFilters[0]?.organizationId).toBe(ORG_A)
  })

  it('refuses an out-of-organization sprint as a promotion target', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea()],
      sprints: [
        {
          id: 'sprint-b',
          organizationId: ORG_B,
          name: 'Beta Sprint',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
          state: SprintState.Planned,
          isDeleted: false,
        },
      ],
    })

    await expect(
      service.promote('idea-1', { effort: 'Medium', sprintId: 'sprint-b', note: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses an assignee who belongs to another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [summary({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(
      service.create(BOARD_A, { ...CREATE, assigneeUserIds: ['outsider'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses a mention of a user in another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [summary({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(
      service.create(BOARD_A, { ...CREATE, mentionEmails: ['out@beta.test'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses an Idea Type belonging to another organization', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.create(BOARD_A, { ...CREATE, ideaTypeId: 'type-b' })).rejects.toThrow(
      ValidationError,
    )
  })

  it('refuses a Business Impact belonging to another organization', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.create(BOARD_A, { ...CREATE, businessImpactId: 'impact-b' }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses reassigning an idea’s type through a mismatched organization id in the route', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })

    // The caller may administer the idea, but the route names a different organization: the
    // mismatch is refused on the route id, not only on the caller's own scope.
    await expect(service.reassignIdeaType(ORG_B, 'idea-1', TYPE_A)).rejects.toThrow(NotFoundError)
  })
})

// The four-role matrix ------------------------------------------------------------------------

describe('IdeaService role matrix', () => {
  it('lets a Site Admin read any organization’s board', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      boards: [board({ boardId: BOARD_B, organizationId: ORG_B })],
    })

    await expect(service.listByBoard(BOARD_B, LIST_QUERY)).resolves.toMatchObject({ items: [] })
  })

  it('refuses a direct Site Admin every organization-content mutation (rule 25)', async () => {
    const { service, added, saved } = harness({
      currentUser: siteAdmin(),
      ideas: [idea()],
      sprints: [],
    })

    await expect(service.create(BOARD_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('idea-1', updateFrom(idea()))).rejects.toThrow(ForbiddenError)
    await expect(service.changeStatus('idea-1', { statusId: STATUS_2 })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.delete('idea-1')).rejects.toThrow(ForbiddenError)
    await expect(
      service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ).rejects.toThrow(ForbiddenError)
    await expect(service.returnToDiscovery('idea-1')).rejects.toThrow(ForbiddenError)
    await expect(service.assignToSprint('idea-1', { sprintId: null })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.importBoardIdeas(BOARD_A, [])).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('lets that same Site Admin create once they act through View As (rule 25 has no impersonation branch)', async () => {
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: AUTHOR,
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.create(BOARD_A, CREATE)

    expect(added).toHaveLength(1)
    expect(added[0]?.organizationId).toBe(ORG_A)
    // Rule 15: authorship records the TARGET, never the administrator.
    expect(added[0]?.authorUserId).toBe(AUTHOR)
  })

  it('attributes an idea created through View As to the administrator, on behalf of the target (rule 14)', async () => {
    const { service, audit } = harness({
      currentUser: impersonating({
        targetUserId: AUTHOR,
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await service.create(BOARD_A, CREATE)

    const created = audit.events.find((e) => e.eventType === 'IdeaCreated')
    expect(created?.attribution.actorUserId).toBe('site-admin-1')
    expect(created?.attribution.onBehalfOfUserId).toBe(AUTHOR)
  })

  it('refuses Read Only every idea-edit path but leaves reads open', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A), ideas: [idea()] })

    await expect(service.create(BOARD_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('idea-1', updateFrom(idea()))).rejects.toThrow(ForbiddenError)
    await expect(service.importBoardIdeas(BOARD_A, [])).rejects.toThrow(ForbiddenError)
    await expect(
      service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ).rejects.toThrow(ForbiddenError)

    await expect(service.getById('idea-1')).resolves.toMatchObject({ ideaId: 'idea-1' })
    await expect(service.listByBoard(BOARD_A, LIST_QUERY)).resolves.toBeDefined()
  })

  it('refuses Read Only a status move even on a board that opts users in', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      boards: [board({ allowUserStatusUpdate: true })],
      ideas: [idea()],
    })

    await expect(service.changeStatus('idea-1', { statusId: STATUS_2 })).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('lets a User move an idea only when the board opts in (rule #34)', async () => {
    const opted = harness({
      currentUser: memberContext(ORG_A),
      boards: [board({ allowUserStatusUpdate: true })],
      ideas: [idea()],
    })
    await opted.service.changeStatus('idea-1', { statusId: STATUS_2 })
    expect(opted.saved).toHaveLength(1)

    const locked = harness({
      currentUser: memberContext(ORG_A),
      boards: [board({ allowUserStatusUpdate: false })],
      ideas: [idea()],
    })
    await expect(locked.service.changeStatus('idea-1', { statusId: STATUS_2 })).rejects.toThrow(
      ForbiddenError,
    )
    expect(locked.saved).toHaveLength(0)
  })

  it('lets an Org Admin move an idea regardless of the board setting', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ allowUserStatusUpdate: false })],
      ideas: [idea()],
    })

    await service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(saved).toHaveLength(1)
  })

  it('restricts description and assignee edits to the author or an in-scope admin', async () => {
    const stranger = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [idea()],
    })
    await expect(
      stranger.service.update('idea-1', {
        ...updateFrom(idea()),
        description: 'A rewritten description',
      }),
    ).rejects.toThrow(ForbiddenError)

    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [idea()] })
    await expect(
      author.service.update('idea-1', {
        ...updateFrom(idea()),
        description: 'A rewritten description',
      }),
    ).resolves.toBeDefined()
  })

  it('lets a non-author User edit non-restricted fields on someone else’s idea', async () => {
    const { service, saved } = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [idea()],
    })

    await service.update('idea-1', { ...updateFrom(idea()), title: 'A better title' })

    expect(saved).toHaveLength(1)
  })

  it('restricts deletion to an admin - the author alone is not enough (rule #16)', async () => {
    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [idea()] })
    await expect(author.service.delete('idea-1')).rejects.toThrow(ForbiddenError)

    const admin = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })
    await admin.service.delete('idea-1')
    expect(admin.saved[0]?.isDeleted).toBe(true)
  })

  it('refuses an Org Admin of another organization the admin-only paths', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_B), ideas: [idea()] })

    // `delete` deliberately has no separate scope check - `canAdministerIdeaContent`'s own
    // organization comparison is what a cross-org Org Admin fails.
    await expect(service.delete('idea-1')).rejects.toThrow(ForbiddenError)
    expect(saved).toHaveLength(0)
  })

  it('lets the author promote their own idea, and refuses a bystander', async () => {
    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [idea()] })
    await author.service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null })
    expect(author.saved).toHaveLength(1)

    const bystander = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [idea()],
    })
    await expect(
      bystander.service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('restricts returning an issue to discovery to admins - not the author', async () => {
    const promoted = promotedIdea()
    const author = harness({ currentUser: memberContext(ORG_A, AUTHOR), ideas: [promoted] })
    await expect(author.service.returnToDiscovery('idea-1')).rejects.toThrow(ForbiddenError)

    const admin = harness({ currentUser: orgAdmin(ORG_A), ideas: [promoted] })
    await admin.service.returnToDiscovery('idea-1')
    expect(admin.saved).toHaveLength(1)
  })

  it('lets an assignee change delivery status, and refuses an unrelated member', async () => {
    const promoted = promotedIdea({ assigneeUserIds: ['helper-1'] })

    const assignee = harness({ currentUser: memberContext(ORG_A, 'helper-1'), ideas: [promoted] })
    await assignee.service.changeDeliveryStatus('idea-1', { deliveryStatus: 'Development' })
    expect(assignee.saved).toHaveLength(1)

    const bystander = harness({
      currentUser: memberContext(ORG_A, 'someone-else'),
      ideas: [promoted],
    })
    await expect(
      bystander.service.changeDeliveryStatus('idea-1', { deliveryStatus: 'Development' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('lets every role including Read Only read the delivery board', async () => {
    for (const caller of [siteAdmin(), orgAdmin(ORG_A), memberContext(ORG_A), readOnly(ORG_A)]) {
      const { service } = harness({ currentUser: caller })
      await expect(
        service.listDelivery(ORG_A, { sprintId: null, deliveryStatus: null }),
      ).resolves.toEqual([])
    }
  })
})

// Board-scoped behaviour that the authorization rules rest on --------------------------------

describe('IdeaService board scoping', () => {
  it('filters the ideation board to Discovery, so a promoted item leaves it', async () => {
    const { service, boardFilters } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.listByBoard(BOARD_A, LIST_QUERY)

    expect(boardFilters[0]?.phase).toBe(IdeaPhase.Discovery)
  })

  it('defaults the organization list to both phases, so a promoted item is still findable', async () => {
    const { service, orgFilters } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    expect(orgFilters[0]?.phase).toBeNull()
  })

  it('narrows the organization list to the caller when scope is "created"', async () => {
    const { service, orgFilters } = harness({ currentUser: memberContext(ORG_A, 'me') })

    await service.listByOrganization(ORG_A, { ...ORG_LIST_QUERY, scope: 'created' })

    expect(orgFilters[0]?.createdByUserId).toBe('me')
    expect(orgFilters[0]?.assignedToUserId).toBeNull()
  })

  it('rejects a status that is not a swimlane on the board', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.create(BOARD_A, { ...CREATE, statusId: 'status-elsewhere' })).rejects.toThrow(
      ValidationError,
    )
  })

  it('defaults a new idea to the left-most swimlane (rule #27)', async () => {
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [
        board({
          swimlanes: [
            { statusId: STATUS_2, displayOrder: 5 },
            { statusId: STATUS_1, displayOrder: 1 },
          ],
        }),
      ],
    })

    await service.create(BOARD_A, CREATE)

    expect(added[0]?.statusId).toBe(STATUS_1)
  })

  it('excludes a soft-deleted idea from reads (rule #11)', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [idea({ isDeleted: true })],
    })

    await expect(service.getById('idea-1')).rejects.toThrow(NotFoundError)
  })

  it('refuses to change an idea’s type on the ordinary edit path', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })

    await expect(
      service.update('idea-1', { ...updateFrom(idea()), ideaTypeId: 'type-other' }),
    ).rejects.toThrow(ValidationError)
  })

  it('notifies mentioned users on create, and nobody else', async () => {
    const mentioned = summary({ id: 'mentioned-1', email: 'mentioned@acme.test' })
    const { service, notifications } = harness({
      currentUser: memberContext(ORG_A, AUTHOR),
      users: [summary(), mentioned],
    })

    await service.create(BOARD_A, { ...CREATE, mentionEmails: ['mentioned@acme.test'] })

    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      eventType: 'IdeaMention',
      recipientUserId: 'mentioned-1',
      organizationId: ORG_A,
    })
  })
})

function updateFrom(existing: Idea): UpdateIdeaCommand {
  return {
    title: existing.title,
    description: existing.description,
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

function promotedIdea(overrides: Partial<Idea> = {}): Idea {
  const base = idea(overrides)
  return promoteIdeaToIssue(
    base,
    { effort: 'Medium' as never, sprintId: null, currentUpvoteCount: 3 },
    NOW,
    AUTHOR,
  )
}

beforeEach(() => {
  // Each harness builds its own state; nothing is shared between tests.
})
