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
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { CreateSprintCommand } from '../../src/sprints/models.js'
import type {
  SprintBoard,
  SprintBoardsPort,
  SprintIssueCounts,
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
  counts?: Readonly<Record<string, SprintIssueCounts>>
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
      // With `counts` given, a sprint missing from it is absent from the map, as an empty one is.
      return new Map(
        ids.flatMap((id) => {
          const counts = options.counts
            ? options.counts[id]
            : { issueCount: 2, doneCount: 1, ideaCount: 0 }
          return counts ? [[id, counts] as const] : []
        }),
      )
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

// QA for "Sprints per board" (SPEC/contracts/sprints.md, plan Ruling 9): the guards on the board
// routes, completion carry-over by final lane, and the legacy (boardId null) path left untouched.
describe('SprintService board sprints: create and list guards', () => {
  const BOARD = 'board-a'
  const board = (over: Partial<SprintBoard> = {}): SprintBoard => ({
    id: BOARD,
    organizationId: ORG_A,
    sprintsEnabled: true,
    isArchived: false,
    finalStatusIds: ['status-done'],
    ...over,
  })
  const onBoard = (id: string, boardId: string | null, started = false) => {
    const created = createSprint({
      id,
      organizationId: ORG_A,
      name: id,
      goal: null,
      startDate: '2026-09-01',
      endDate: '2026-09-14',
      ownerUserId: null,
      boardId,
      nowUtc: NOW,
      actorUserId: 'seed',
    })
    return started ? startSprint(created, NOW, 'seed') : created
  }

  it('answers 404 for an unknown board on create and list', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A), boards: [] })

    await expect(service.createForBoard(BOARD, CREATE)).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.listForBoard(BOARD, null)).rejects.toBeInstanceOf(NotFoundError)
    expect(added).toHaveLength(0)
  })

  it('refuses an archived board with 409 before looking at sprintsEnabled', async () => {
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ isArchived: true, sprintsEnabled: false })],
    })

    await expect(service.createForBoard(BOARD, CREATE)).rejects.toBeInstanceOf(ConflictError)
    expect(added).toHaveLength(0)
  })

  it('refuses sprintsNotEnabled as a 422 and writes nothing', async () => {
    const { service, added, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ sprintsEnabled: false })],
    })

    const error = await service.createForBoard(BOARD, CREATE).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({ code: 'sprintsNotEnabled' })
    expect(added).toHaveLength(0)
    expect(audit.events).toHaveLength(0)
  })

  it.each([
    ['a Member', member(ORG_A)],
    ['a Read Only user', readOnly(ORG_A)],
  ])('refuses create for %s with 403', async (_label, currentUser) => {
    const { service, added } = harness({ currentUser, boards: [board()] })

    await expect(service.createForBoard(BOARD, CREATE)).rejects.toBeInstanceOf(ForbiddenError)
    expect(added).toHaveLength(0)
  })

  it('refuses create for a Site Admin acting as themselves', async () => {
    const { service, added } = harness({ currentUser: siteAdmin(), boards: [board()] })

    await expect(service.createForBoard(BOARD, CREATE)).rejects.toBeInstanceOf(ForbiddenError)
    expect(added).toHaveLength(0)
  })

  it('answers 404 to an Org Admin of another organization on create', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_B), boards: [board()] })

    await expect(service.createForBoard(BOARD, CREATE)).rejects.toBeInstanceOf(NotFoundError)
    expect(added).toHaveLength(0)
  })

  it('lets a View As session in the board organization create', async () => {
    const { service, added } = harness({
      currentUser: impersonating({
        targetUserId: 'org-admin-1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
      boards: [board()],
    })

    await service.createForBoard(BOARD, CREATE)

    expect(added[0]?.boardId).toBe(BOARD)
  })

  it('stores the new sprint Planned under the board organization and audits the board', async () => {
    const { service, added, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
    })

    const item = await service.createForBoard(BOARD, CREATE)

    expect(item).toMatchObject({
      boardId: BOARD,
      organizationId: ORG_A,
      state: SprintState.Planned,
      issueCount: 0,
      doneCount: 0,
    })
    expect(added[0]?.organizationId).toBe(ORG_A)
    expect(audit.events[0]?.eventType).toBe('SprintCreated')
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({ boardId: BOARD })
  })

  it('rejects an owner outside the organization on a board sprint', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A), boards: [board()] })

    await expect(
      service.createForBoard(BOARD, { ...CREATE, ownerUserId: 'nobody' }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(added).toHaveLength(0)
  })

  it('validates the date window as for an organization sprint', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), boards: [board()] })

    await expect(
      service.createForBoard(BOARD, { ...CREATE, startDate: '2026-09-28', endDate: '2026-09-15' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('lists only the board sprints, filtered by state, for any member of the organization', async () => {
    const sprints = [
      onBoard('s-board-planned', BOARD),
      onBoard('s-board-active', BOARD, true),
      onBoard('s-other-board', 'board-z'),
      onBoard('s-legacy', null),
    ]
    for (const currentUser of [orgAdmin(ORG_A), member(ORG_A), readOnly(ORG_A), siteAdmin()]) {
      const { service } = harness({ currentUser, boards: [board()], sprints })

      expect((await service.listForBoard(BOARD, null)).map((s) => s.sprintId).sort()).toEqual([
        's-board-active',
        's-board-planned',
      ])
      expect(
        (await service.listForBoard(BOARD, SprintState.Active)).map((s) => s.sprintId),
      ).toEqual(['s-board-active'])
    }
  })

  it('answers 404 to another organization listing the board', async () => {
    const { service } = harness({ currentUser: member(ORG_B), boards: [board()] })

    await expect(service.listForBoard(BOARD, null)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('projects boardId null for a legacy sprint on the organization list', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [onBoard('s-legacy', null), onBoard('s-board', BOARD)],
    })

    const byId = new Map((await service.list(ORG_A, null)).map((s) => [s.sprintId, s]))

    expect(byId.get('s-legacy')?.boardId).toBeNull()
    expect(byId.get('s-board')?.boardId).toBe(BOARD)
  })
})

describe('SprintService completing and deleting by sprint kind', () => {
  const BOARD = 'board-a'
  const FINAL_A = 'status-done'
  const FINAL_B = 'status-shipped'
  const board = (over: Partial<SprintBoard> = {}): SprintBoard => ({
    id: BOARD,
    organizationId: ORG_A,
    sprintsEnabled: true,
    isArchived: false,
    finalStatusIds: [FINAL_A, FINAL_B],
    ...over,
  })
  const make = (id: string, boardId: string | null, started = true) => {
    const created = createSprint({
      id,
      organizationId: ORG_A,
      name: id,
      goal: null,
      startDate: '2026-09-01',
      endDate: '2026-09-14',
      ownerUserId: null,
      boardId,
      nowUtc: NOW,
      actorUserId: 'seed',
    })
    return started ? startSprint(created, NOW, 'seed') : created
  }
  /** A board item: Discovery phase, no delivery status, sitting in `statusId`. */
  const item = (id: string, statusId: string, sprintId = 'sprint-board'): Idea => ({
    ...issue({ id, sprintId }),
    phase: IdeaPhase.Discovery,
    deliveryStatus: null,
    statusId,
  })
  const carried = (audit: { events: readonly { metadataJson?: string | null }[] }) =>
    JSON.parse(audit.events[0]?.metadataJson ?? '{}').carriedOverIssueCount

  it('carries over none when all items sit in final lanes (either final lane)', async () => {
    const { service, issueUpdates, audit, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('a', FINAL_A), item('b', FINAL_B)],
    })

    await service.complete(ORG_A, 'sprint-board')

    expect(issueUpdates).toHaveLength(0)
    expect(carried(audit)).toBe(0)
    expect(saved[0]?.state).toBe(SprintState.Completed)
  })

  it('carries over every item when none sit in a final lane', async () => {
    const { service, issueUpdates, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('a', 'status-1'), item('b', 'status-2')],
    })

    await service.complete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.id)).toEqual(['a', 'b'])
    expect(issueUpdates.every((i) => i.sprintId === null)).toBe(true)
    expect(carried(audit)).toBe(2)
  })

  it('treats a board with no final lane as nothing done', async () => {
    const { service, issueUpdates } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ finalStatusIds: [] })],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('a', FINAL_A)],
    })

    await service.complete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.id)).toEqual(['a'])
  })

  it('carries over a mixed set: only the non-final items go back to the backlog', async () => {
    const { service, issueUpdates, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('open', 'status-1'), item('done', FINAL_A), item('shipped', FINAL_B)],
    })

    await service.complete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.id)).toEqual(['open'])
    expect(carried(audit)).toBe(1)
  })

  it('ignores delivery status on a board sprint: Complete outside a final lane is carried over', async () => {
    const { service, issueUpdates } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [make('sprint-board', BOARD)],
      issues: [
        {
          ...issue({ id: 'delivery', sprintId: 'sprint-board' }),
          statusId: 'status-1',
          deliveryStatus: DeliveryStatus.Complete,
        },
      ],
    })

    await service.complete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.id)).toEqual(['delivery'])
  })

  it('does not consult the board for a legacy sprint and keeps the delivery-status rule', async () => {
    const { service, issueUpdates, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [],
      sprints: [make('sprint-legacy', null)],
      issues: [
        // Sits in a status that is final on some board, but is not Complete: still carried over.
        { ...issue({ id: 'dev', sprintId: 'sprint-legacy' }), statusId: FINAL_A },
        issue({ id: 'done', sprintId: 'sprint-legacy', deliveryStatus: DeliveryStatus.Complete }),
      ],
    })

    await service.complete(ORG_A, 'sprint-legacy')

    expect(issueUpdates.map((i) => i.id)).toEqual(['dev'])
    expect(carried(audit)).toBe(1)
  })

  it('answers 404 when the board of a board sprint no longer resolves', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('a', 'status-1')],
    })

    await expect(service.complete(ORG_A, 'sprint-board')).rejects.toBeInstanceOf(NotFoundError)
    expect(saved).toHaveLength(0)
  })

  it('still refuses completing a board sprint that is not Active', async () => {
    const { service, issueUpdates } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board()],
      sprints: [make('sprint-board', BOARD, false)],
      issues: [item('a', 'status-1')],
    })

    await expect(service.complete(ORG_A, 'sprint-board')).rejects.toBeDefined()
    expect(issueUpdates).toHaveLength(0)
  })

  it('refuses a Member completing or deleting a board sprint', async () => {
    const { service, issueUpdates } = harness({
      currentUser: member(ORG_A),
      boards: [board()],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('a', 'status-1')],
    })

    await expect(service.complete(ORG_A, 'sprint-board')).rejects.toBeInstanceOf(ForbiddenError)
    await expect(service.delete(ORG_A, 'sprint-board')).rejects.toBeInstanceOf(ForbiddenError)
    expect(issueUpdates).toHaveLength(0)
  })

  it('deleting a board sprint clears items in any phase and lane, and soft-deletes it', async () => {
    const { service, issueUpdates, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [],
      sprints: [make('sprint-board', BOARD)],
      issues: [item('open', 'status-1'), item('done', FINAL_A)],
    })

    await service.delete(ORG_A, 'sprint-board')

    expect(issueUpdates.map((i) => i.sprintId)).toEqual([null, null])
    expect(saved[0]?.isDeleted).toBe(true)
  })

  it('deleting a legacy sprint still unassigns through the Delivery path', async () => {
    const { service, issueUpdates, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [make('sprint-legacy', null)],
      issues: [issue({ id: 'dev', sprintId: 'sprint-legacy' })],
    })

    await service.delete(ORG_A, 'sprint-legacy')

    expect(issueUpdates.map((i) => i.sprintId)).toEqual([null])
    expect(saved[0]?.isDeleted).toBe(true)
  })
})

// QA for the work board sprint header (SPEC/contracts/sprints.md "Work board sprint header"):
// `ideaCount` is carried per sprint from the same batched counts as `issueCount`.
describe('SprintService.ideaCount', () => {
  it('reports the distinct-idea count per sprint on the organization list', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      sprints: [sprint({ id: SPRINT_A }), sprint({ id: SPRINT_B })],
      counts: {
        [SPRINT_A]: { issueCount: 5, doneCount: 1, ideaCount: 3 },
        [SPRINT_B]: { issueCount: 1, doneCount: 0, ideaCount: 0 },
      },
    })

    const items = await service.list(ORG_A, null)

    expect(items.map((i) => [i.sprintId, i.ideaCount]).sort()).toEqual([
      [SPRINT_A, 3],
      [SPRINT_B, 0],
    ])
  })

  it('is 0 for a sprint the counts read has no row for (an empty sprint)', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), counts: {} })

    expect(await service.get(ORG_A, SPRINT_A)).toMatchObject({
      issueCount: 0,
      doneCount: 0,
      ideaCount: 0,
    })
  })

  it('is on the single-sprint read, for a Read Only member too', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      counts: { [SPRINT_A]: { issueCount: 4, doneCount: 2, ideaCount: 2 } },
    })

    expect(await service.get(ORG_A, SPRINT_A)).toMatchObject({
      issueCount: 4,
      doneCount: 2,
      ideaCount: 2,
    })
  })

  it('is on the board sprint list the header reads', async () => {
    const BOARD = 'board-a'
    const created = createSprint({
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
    })
    const { service } = harness({
      currentUser: member(ORG_A),
      sprints: [created],
      boards: [
        {
          id: BOARD,
          organizationId: ORG_A,
          sprintsEnabled: true,
          isArchived: false,
          finalStatusIds: [],
        },
      ],
      counts: { 'sprint-board': { issueCount: 3, doneCount: 0, ideaCount: 2 } },
    })

    const [item] = await service.listForBoard(BOARD, null)

    expect(item).toMatchObject({ sprintId: 'sprint-board', issueCount: 3, ideaCount: 2 })
  })
})
