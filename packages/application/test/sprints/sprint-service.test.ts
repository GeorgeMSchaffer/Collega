// Sprints (SPEC/20-feature-issues-and-delivery.md). Reading is open to every member including
// Read Only; management is admin-only and closed to a direct Site Admin.
//
// The cross-tenant answer here is 404 on every path, deliberately: a 403 would confirm the sprint
// exists in somebody else's organization, which is the thing the probe is after.

import {
  DeliveryStatus,
  IdeaPhase,
  Priority,
  Role,
  SprintState,
  UserStatus,
} from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import { createIdea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { createSprint, type Sprint, softDeleteSprint, startSprint } from '@collega/domain/sprints'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { CreateSprintCommand } from '../../src/sprints/models.js'
import type {
  SprintBoard,
  SprintBoardsPort,
  SprintIssuesPort,
  SprintRepository,
  SprintUserSummary,
  SprintUsersPort,
} from '../../src/sprints/ports.js'
import { SprintService } from '../../src/sprints/sprint.service.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const SPRINT_A = 'sprint-a'
const SPRINT_B = 'sprint-b'

function sprint(
  overrides: { id?: string; organizationId?: string; ownerUserId?: string | null } = {},
): Sprint {
  return createSprint({
    id: overrides.id ?? SPRINT_A,
    organizationId: overrides.organizationId ?? ORG_A,
    name: 'Sprint 1',
    goal: null,
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    ownerUserId: overrides.ownerUserId ?? null,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function issue(
  overrides: { id?: string; deliveryStatus?: DeliveryStatus; sprintId?: string } = {},
): Idea {
  const base = createIdea({
    id: overrides.id ?? 'idea-1',
    organizationId: ORG_A,
    boardId: 'board-a',
    statusId: 'status-1',
    title: 'An issue',
    description: 'Body',
    problem: 'A problem',
    proposedSolutions: ['A solution'],
    impactRationale: 'A rationale',
    priority: Priority.Medium,
    ideaTypeId: 'type-a',
    businessImpactId: 'impact-a',
    dueDate: null,
    authorUserId: 'author-1',
    assigneeUserIds: [],
    tagIds: [],
    mentionedUserIds: [],
    nowUtc: NOW,
  })
  const promoted = promoteIdeaToIssue(
    base,
    { effort: 'Medium' as never, sprintId: overrides.sprintId ?? SPRINT_A, currentUpvoteCount: 0 },
    NOW,
    'author-1',
  )
  return overrides.deliveryStatus
    ? { ...promoted, deliveryStatus: overrides.deliveryStatus }
    : promoted
}

const CREATE: CreateSprintCommand = {
  name: 'Sprint 2',
  goal: 'Ship the thing',
  startDate: '2026-09-15',
  endDate: '2026-09-28',
  ownerUserId: null,
}

function harness(options: {
  currentUser: CurrentUserContext
  sprints?: readonly Sprint[]
  issues?: readonly Idea[]
  users?: readonly SprintUserSummary[]
  boards?: readonly SprintBoard[]
}) {
  const byId = new Map((options.sprints ?? [sprint()]).map((s) => [s.id, s]))
  const usersById = new Map((options.users ?? []).map((u) => [u.id, u]))
  const added: Sprint[] = []
  const saved: Sprint[] = []
  const issueUpdates: Idea[] = []

  const sprints: SprintRepository = {
    async getById(id) {
      return byId.get(id) ?? null
    },
    async listByOrganization(organizationId, state) {
      return [...byId.values()].filter(
        (s) =>
          s.organizationId === organizationId &&
          !s.isDeleted &&
          (state === null || s.state === state),
      )
    },
    async listByBoard(boardId, state) {
      return [...byId.values()].filter(
        (s) => s.boardId === boardId && !s.isDeleted && (state === null || s.state === state),
      )
    },
    async add(s) {
      added.push(s)
    },
    async save(s) {
      saved.push(s)
    },
  }

  const issues: SprintIssuesPort = {
    async listBySprint(sprintId) {
      return (options.issues ?? []).filter((i) => i.sprintId === sprintId)
    },
    async countsBySprintIds(ids) {
      return new Map(ids.map((id) => [id, { issueCount: 2, doneCount: 1 }]))
    },
    async update(idea) {
      issueUpdates.push(idea)
    },
  }

  const users: SprintUsersPort = {
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const found = usersById.get(id)
        return found ? [found] : []
      })
    },
  }

  const boardsById = new Map((options.boards ?? []).map((b) => [b.id, b]))
  const boards: SprintBoardsPort = {
    async getSprintBoard(id) {
      return boardsById.get(id) ?? null
    },
  }

  const audit = recordingAudit()

  return {
    service: new SprintService(
      sprints,
      issues,
      users,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
      boards,
    ),
    added,
    saved,
    issueUpdates,
    audit,
  }
}

describe('SprintService read scope', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('lets %s read their own organization’s sprints', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.list(ORG_A, null)).resolves.toHaveLength(1)
  })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s another organization’s sprint list, as not-found', async (_l, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.list(ORG_B, null)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses a sprint read whose route organization does not match the sprint', async () => {
    const { service } = harness({ currentUser: siteAdmin(), sprints: [sprint()] })

    await expect(service.get(ORG_B, SPRINT_A)).rejects.toThrow(NotFoundError)
  })

  it('treats a soft-deleted sprint as gone', async () => {
    const deleted = softDeleteSprint(sprint(), NOW, 'seed')
    const { service } = harness({ currentUser: orgAdmin(ORG_A), sprints: [deleted] })

    await expect(service.get(ORG_A, SPRINT_A)).rejects.toThrow(NotFoundError)
  })

  it('lets a Site Admin read any organization’s sprints', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      sprints: [sprint({ id: SPRINT_B, organizationId: ORG_B })],
    })

    await expect(service.get(ORG_B, SPRINT_B)).resolves.toMatchObject({ organizationId: ORG_B })
  })
})

describe('SprintService admin scope', () => {
  it('refuses a direct Site Admin every sprint mutation (rule 25)', async () => {
    const { service, added, saved } = harness({ currentUser: siteAdmin() })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update(ORG_A, SPRINT_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.start(ORG_A, SPRINT_A)).rejects.toThrow(ForbiddenError)
    await expect(service.complete(ORG_A, SPRINT_A)).rejects.toThrow(ForbiddenError)
    await expect(service.delete(ORG_A, SPRINT_A)).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('lets that Site Admin create once acting as an Org Admin through View As', async () => {
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: 'target-admin',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.create(ORG_A, CREATE)

    expect(added).toHaveLength(1)
  })

  it.each([
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s sprint management', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.start(ORG_A, SPRINT_A)).rejects.toThrow(ForbiddenError)
  })

  it('refuses an Org Admin managing another organization’s sprint', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_B),
      sprints: [sprint()],
    })

    await expect(service.start(ORG_A, SPRINT_A)).rejects.toThrow(NotFoundError)
    expect(saved).toHaveLength(0)
  })
})

describe('SprintService owner resolution', () => {
  const localOwner: SprintUserSummary = {
    id: 'owner-1',
    firstName: 'Ollie',
    lastName: 'Owner',
    status: UserStatus.Active,
    organizationId: ORG_A,
  }

  it('accepts an active owner from the same organization', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A), users: [localOwner] })

    await service.create(ORG_A, { ...CREATE, ownerUserId: 'owner-1' })

    expect(added[0]?.ownerUserId).toBe('owner-1')
  })

  it('refuses an owner from another organization', async () => {
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [{ ...localOwner, organizationId: ORG_B }],
    })

    await expect(service.create(ORG_A, { ...CREATE, ownerUserId: 'owner-1' })).rejects.toThrow(
      ValidationError,
    )
    expect(added).toHaveLength(0)
  })

  it('refuses an inactive owner', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [{ ...localOwner, status: UserStatus.Inactive }],
    })

    await expect(service.create(ORG_A, { ...CREATE, ownerUserId: 'owner-1' })).rejects.toThrow(
      ValidationError,
    )
  })

  it('treats a blank owner as none rather than a lookup', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.create(ORG_A, { ...CREATE, ownerUserId: '   ' })

    expect(added[0]?.ownerUserId).toBeNull()
  })
})

describe('SprintService.complete carry-over', () => {
  it('returns every unfinished issue to the backlog and leaves completed ones alone', async () => {
    const active = startSprint(sprint(), NOW, 'seed')
    const { service, issueUpdates } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [active],
      issues: [
        issue({ id: 'idea-open', deliveryStatus: DeliveryStatus.Development }),
        issue({ id: 'idea-done', deliveryStatus: DeliveryStatus.Complete }),
      ],
    })

    await service.complete(ORG_A, SPRINT_A)

    expect(issueUpdates.map((i) => i.id)).toEqual(['idea-open'])
    expect(issueUpdates[0]?.sprintId).toBeNull()
    expect(issueUpdates[0]?.phase).toBe(IdeaPhase.Delivery)
  })

  it('records how many issues carried over', async () => {
    const active = startSprint(sprint(), NOW, 'seed')
    const { service, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [active],
      issues: [issue({ id: 'idea-open', deliveryStatus: DeliveryStatus.Development })],
    })

    await service.complete(ORG_A, SPRINT_A)

    const event = audit.events.find((e) => e.eventType === 'SprintCompleted')
    expect(event?.metadataJson).toContain('"carriedOverIssueCount":1')
  })

  it('refuses to complete a sprint that was never started', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A), sprints: [sprint()] })

    await expect(service.complete(ORG_A, SPRINT_A)).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })
})

describe('SprintService.delete', () => {
  it('unassigns every issue before soft-deleting - no issue is deleted with a sprint', async () => {
    const { service, saved, issueUpdates } = harness({
      currentUser: orgAdmin(ORG_A),
      issues: [issue({ id: 'idea-1' }), issue({ id: 'idea-2' })],
    })

    await service.delete(ORG_A, SPRINT_A)

    expect(issueUpdates.map((i) => i.sprintId)).toEqual([null, null])
    expect(saved[0]?.isDeleted).toBe(true)
  })

  it('reports a sprint in another organization as not-found rather than deleting it', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_B),
      sprints: [sprint({ id: SPRINT_B, organizationId: ORG_B }), sprint()],
    })

    await expect(service.delete(ORG_B, SPRINT_A)).rejects.toThrow(NotFoundError)
    expect(saved).toHaveLength(0)
  })
})

describe('SprintService projection', () => {
  it('reports the issue and done counts from one batched read', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    const [item] = await service.list(ORG_A, null)

    expect(item).toMatchObject({ issueCount: 2, doneCount: 1 })
  })

  it('resolves the owner display name', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [sprint({ ownerUserId: 'owner-1' })],
      users: [
        {
          id: 'owner-1',
          firstName: 'Ollie',
          lastName: 'Owner',
          status: UserStatus.Active,
          organizationId: ORG_A,
        },
      ],
    })

    const [item] = await service.list(ORG_A, null)

    expect(item?.ownerDisplayName).toBe('Ollie Owner')
  })

  it('filters the list by state when one is given', async () => {
    const active = startSprint(sprint({ id: 'sprint-active' }), NOW, 'seed')
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [sprint(), active],
    })

    const result = await service.list(ORG_A, SprintState.Active)

    expect(result.map((s) => s.sprintId)).toEqual(['sprint-active'])
  })
})

describe('SprintService board sprints', () => {
  const BOARD = 'board-a'
  const board = (over: Partial<SprintBoard> = {}): SprintBoard => ({
    id: BOARD,
    organizationId: ORG_A,
    sprintsEnabled: true,
    isArchived: false,
    finalStatusIds: ['status-done'],
    ...over,
  })
  const boardSprint = () =>
    startSprint(
      createSprint({
        id: 'sprint-board',
        organizationId: ORG_A,
        name: 'Board sprint',
        goal: null,
        startDate: '2026-09-01',
        endDate: '2026-09-14',
        ownerUserId: null,
        boardId: BOARD,
        nowUtc: NOW,
        actorUserId: 'seed',
      }),
      NOW,
      'seed',
    )
  const card = (id: string, statusId: string): Idea => ({
    ...issue({ id, sprintId: 'sprint-board' }),
    phase: IdeaPhase.Discovery,
    deliveryStatus: null,
    statusId,
  })

  it('refuses to create a sprint on a board with sprints off', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ sprintsEnabled: false })],
    })

    await expect(service.createForBoard(BOARD, CREATE)).rejects.toMatchObject({
      code: 'sprintsNotEnabled',
    })
    await expect(service.createForBoard(BOARD, CREATE)).rejects.toBeInstanceOf(UnprocessableError)
  })

  it('creates a sprint carrying the board id', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A), boards: [board()] })

    const item = await service.createForBoard(BOARD, CREATE)

    expect(item.boardId).toBe(BOARD)
    expect(added[0]?.boardId).toBe(BOARD)
  })

  it('completes by returning only items outside a final lane, whatever their phase', async () => {
    const { service, issueUpdates, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [boardSprint()],
      issues: [card('open', 'status-1'), card('done', 'status-done')],
    })

    await service.complete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.id)).toEqual(['open'])
    expect(issueUpdates[0]?.sprintId).toBeNull()
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({
      carriedOverIssueCount: 1,
    })
  })

  it('clears every item when a board sprint is deleted', async () => {
    const { service, issueUpdates } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [boardSprint()],
      issues: [card('open', 'status-1'), card('done', 'status-done')],
    })

    await service.delete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.sprintId)).toEqual([null, null])
  })
})
