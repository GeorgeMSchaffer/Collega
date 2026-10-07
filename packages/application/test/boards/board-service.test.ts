// Board configuration (SPEC/20-feature-boards-and-statuses.md "Board Rules").
//
// Two scopes, and the difference between them is the whole point: reading is open to any member
// of the organization, managing is admin-only AND closed to a direct Site Admin (rule 25), so a
// Site Admin can look at every board in the platform and change none of them.

import { archiveBoard, type Board, createBoard } from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import { createStatus, type Status, softDeleteStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { CreateBoardCommand, UpdateBoardCommand } from '../../src/boards/models.js'
import type {
  BoardRepository,
  BoardStatusIdeaCount,
  BoardTagIdeaCount,
  OrganizationExistenceLookup,
  UserName,
} from '../../src/boards/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../src/common/index.js'
import type { StatusRepository } from '../../src/statuses/ports.js'
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

const STATUS_1 = 'status-1'
const STATUS_2 = 'status-2'
const STATUS_3 = 'status-3'

function status(id: string, organizationId = ORG_A, sortOrder = 10): Status {
  return createStatus({
    id,
    organizationId,
    name: `Status ${id}`,
    color: '#123456',
    sortOrder,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function board(overrides: { id?: string; organizationId?: string; name?: string } = {}): Board {
  return createBoard({
    id: overrides.id ?? 'board-a',
    organizationId: overrides.organizationId ?? ORG_A,
    name: overrides.name ?? 'Acme Board',
    allowUserStatusUpdate: false,
    orderedStatusIds: [STATUS_1, STATUS_2],
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

const CREATE: CreateBoardCommand = {
  name: 'New Board',
  allowUserStatusUpdate: false,
  swimlanes: [
    { statusId: STATUS_1, order: 0 },
    { statusId: STATUS_2, order: 1 },
  ],
}

const UPDATE: UpdateBoardCommand = { ...CREATE, name: 'Renamed Board' }

function harness(options: {
  currentUser: CurrentUserContext
  boards?: readonly Board[]
  statuses?: readonly Status[]
  organizations?: readonly string[]
  statusCounts?: readonly BoardStatusIdeaCount[]
  tagCounts?: readonly BoardTagIdeaCount[]
  userNames?: Readonly<Record<string, UserName>>
}) {
  const boardsById = new Map((options.boards ?? [board()]).map((b) => [b.id, b]))
  const allStatuses = options.statuses ?? [status(STATUS_1), status(STATUS_2, ORG_A, 20)]
  const existingOrgs = new Set(options.organizations ?? [ORG_A, ORG_B])
  const added: Board[] = []
  const saved: Board[] = []
  /** Every repository read `list` makes, by method, with the ids it was handed. */
  const reads: { method: string; ids: readonly string[] }[] = []

  const boards: BoardRepository = {
    async add(b) {
      added.push(b)
    },
    async save(b) {
      saved.push(b)
    },
    async getById(id) {
      return boardsById.get(id) ?? null
    },
    async listByOrganization(organizationId) {
      return [...boardsById.values()].filter((b) => b.organizationId === organizationId)
    },
    async isStatusReferenced() {
      return false
    },
    async countIdeasByBoard(ids) {
      reads.push({ method: 'countIdeasByBoard', ids })
      return new Map(ids.map((id) => [id, 3]))
    },
    async countIdeasByBoardAndStatus(ids) {
      reads.push({ method: 'countIdeasByBoardAndStatus', ids })
      return (options.statusCounts ?? []).filter((row) => ids.includes(row.boardId))
    },
    async countIdeasByBoardAndTag(ids) {
      reads.push({ method: 'countIdeasByBoardAndTag', ids })
      return (options.tagCounts ?? []).filter((row) => ids.includes(row.boardId))
    },
    async getUserNames(ids) {
      reads.push({ method: 'getUserNames', ids })
      const names = options.userNames ?? {}
      return new Map(ids.flatMap((id) => (names[id] ? [[id, names[id]] as const] : [])))
    },
    async listLaneIdeas() {
      return []
    },
    async moveIdeas() {},
  }

  const statuses: StatusRepository = {
    async add() {},
    async addMany() {},
    async getById(id) {
      return allStatuses.find((s) => s.id === id) ?? null
    },
    async listActiveByOrganization(organizationId) {
      return allStatuses.filter((s) => s.organizationId === organizationId && !s.isDeleted)
    },
    async listByOrganization(organizationId, includeDeleted) {
      return allStatuses.filter(
        (s) => s.organizationId === organizationId && (includeDeleted || !s.isDeleted),
      )
    },
    async countActiveByOrganization(organizationId) {
      return allStatuses.filter((s) => s.organizationId === organizationId && !s.isDeleted).length
    },
    async save() {},
  }

  const organizations: OrganizationExistenceLookup = {
    async existsById(id) {
      return existingOrgs.has(id)
    },
  }

  const audit = recordingAudit()

  return {
    service: new BoardService(
      boards,
      statuses,
      organizations,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    added,
    saved,
    audit,
    reads,
  }
}

describe('BoardService read scope', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('lets %s list their own organization’s boards', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.list(ORG_A)).resolves.toHaveLength(1)
  })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s another organization’s board list', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

    await expect(service.list(ORG_B)).rejects.toThrow(NotFoundError)
  })

  it('refuses a member of another organization a board they name directly', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [board({ id: 'board-b', organizationId: ORG_B })],
    })

    await expect(service.getById('board-b')).rejects.toThrow(NotFoundError)
  })

  it('lets a direct Site Admin read any organization’s boards', async () => {
    const { service } = harness({
      currentUser: siteAdmin(),
      boards: [board({ id: 'board-b', organizationId: ORG_B })],
    })

    await expect(service.getById('board-b')).resolves.toMatchObject({ organizationId: ORG_B })
  })

  it('reports a nonexistent organization as not-found even to a Site Admin', async () => {
    const { service } = harness({ currentUser: siteAdmin(), organizations: [ORG_A] })

    await expect(service.list('org-nowhere')).rejects.toThrow(NotFoundError)
  })
})

describe('BoardService admin scope', () => {
  it('refuses a direct Site Admin every board mutation (rule 25)', async () => {
    const { service, added, saved } = harness({ currentUser: siteAdmin() })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('board-a', UPDATE)).rejects.toThrow(ForbiddenError)
    await expect(
      service.reorderSwimlanes('board-a', {
        swimlanes: [
          { statusId: STATUS_2, order: 0 },
          { statusId: STATUS_1, order: 1 },
        ],
      }),
    ).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('tells the refused Site Admin to use View As, rather than falling through to the generic refusal', async () => {
    // Without `ensureNotDirectSiteAdmin` the role would still be refused - by the final
    // `throw new ForbiddenError` below the OrgAdmin branch - so asserting the error TYPE alone
    // cannot tell the two apart. The message is what distinguishes "you may not do this" from
    // "here is the path that works", and it is the only externally visible difference.
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(/View As/)
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

  it('lets a User create a board in their own organization, but not manage one (2026-10-04)', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A) })

    await service.create(ORG_A, CREATE)
    expect(added).toHaveLength(1)
    await expect(service.update('board-a', UPDATE)).rejects.toThrow(ForbiddenError)
  })

  it('refuses ReadOnly board creation and management in their own organization', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A) })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ForbiddenError)
    await expect(service.update('board-a', UPDATE)).rejects.toThrow(ForbiddenError)
  })

  it('refuses an Org Admin managing another organization’s board, as not-found', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_B),
      boards: [board()],
    })

    await expect(service.update('board-a', UPDATE)).rejects.toBeInstanceOf(NotFoundError)
    expect(saved).toHaveLength(0)
  })

  it('refuses an Org Admin creating a board in another organization', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.create(ORG_B, CREATE)).rejects.toThrow(NotFoundError)
    expect(added).toHaveLength(0)
  })
})

describe('BoardService swimlane validation', () => {
  it('rejects fewer than two swimlanes', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.create(ORG_A, { ...CREATE, swimlanes: [{ statusId: STATUS_1, order: 0 }] }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects the same status listed twice', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.create(ORG_A, {
        ...CREATE,
        swimlanes: [
          { statusId: STATUS_1, order: 0 },
          { statusId: STATUS_1, order: 1 },
        ],
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a swimlane naming a status from another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [status(STATUS_1), status(STATUS_2, ORG_A, 20), status(STATUS_3, ORG_B, 10)],
    })

    await expect(
      service.create(ORG_A, {
        ...CREATE,
        swimlanes: [
          { statusId: STATUS_1, order: 0 },
          { statusId: STATUS_3, order: 1 },
        ],
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a swimlane naming a soft-deleted status', async () => {
    const deleted = softDeleteStatus(status(STATUS_2, ORG_A, 20), NOW, 'seed')
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [status(STATUS_1), deleted],
    })

    await expect(service.create(ORG_A, CREATE)).rejects.toThrow(ValidationError)
  })

  it('normalizes swimlane order densely from the requested positions', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.create(ORG_A, {
      ...CREATE,
      swimlanes: [
        { statusId: STATUS_2, order: 90 },
        { statusId: STATUS_1, order: 7 },
      ],
    })

    expect(added[0]?.swimlanes.map((s) => [s.statusId, s.displayOrder])).toEqual([
      [STATUS_1, 0],
      [STATUS_2, 1],
    ])
  })

  it('refuses a reorder that adds or removes a swimlane', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      statuses: [status(STATUS_1), status(STATUS_2, ORG_A, 20), status(STATUS_3, ORG_A, 30)],
    })

    await expect(
      service.reorderSwimlanes('board-a', {
        swimlanes: [
          { statusId: STATUS_1, order: 0 },
          { statusId: STATUS_3, order: 1 },
        ],
      }),
    ).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('accepts a reorder that lists exactly the current set', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.reorderSwimlanes('board-a', {
      swimlanes: [
        { statusId: STATUS_2, order: 0 },
        { statusId: STATUS_1, order: 1 },
      ],
    })

    expect(saved[0]?.swimlanes.map((s) => s.statusId)).toEqual([STATUS_2, STATUS_1])
  })
})

describe('BoardService listing order', () => {
  it('breaks a name tie on creation time, never on id', async () => {
    const older = { ...board({ id: 'zzz' }), name: 'Same', createdAtUtc: new Date('2026-01-01') }
    const newer = { ...board({ id: 'aaa' }), name: 'Same', createdAtUtc: new Date('2026-06-01') }
    const { service } = harness({ currentUser: orgAdmin(ORG_A), boards: [newer, older] })

    const result = await service.list(ORG_A)

    expect(result.map((b) => b.boardId)).toEqual(['zzz', 'aaa'])
  })

  it('reports each board’s live idea count from one batched read', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    const result = await service.list(ORG_A)

    expect(result[0]?.ideaCount).toBe(3)
  })
})

describe('BoardService list card aggregates', () => {
  const threeLaneStatuses = [
    status(STATUS_1),
    status(STATUS_2, ORG_A, 20),
    status(STATUS_3, ORG_A, 30),
  ]

  function threeLaneBoard(id = 'board-a', createdByUserId: string | null = 'creator-1'): Board {
    return createBoard({
      id,
      organizationId: ORG_A,
      name: `Board ${id}`,
      allowUserStatusUpdate: false,
      // Deliberately not the statuses' own sort order: lanes follow the board, not the status.
      orderedStatusIds: [STATUS_3, STATUS_1, STATUS_2],
      nowUtc: NOW,
      actorUserId: createdByUserId,
    })
  }

  it('lists every swimlane in board order, with zero for a lane that has no ideas', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [threeLaneBoard()],
      statuses: threeLaneStatuses,
      statusCounts: [
        { boardId: 'board-a', statusId: STATUS_1, ideaCount: 4 },
        { boardId: 'board-a', statusId: STATUS_3, ideaCount: 2 },
      ],
    })

    const [card] = await service.list(ORG_A)

    expect(card?.laneCounts.map((lane) => [lane.statusId, lane.order, lane.ideaCount])).toEqual([
      [STATUS_3, 0, 2],
      [STATUS_1, 1, 4],
      [STATUS_2, 2, 0],
    ])
    expect(card?.laneCounts[0]).toMatchObject({
      statusName: `Status ${STATUS_3}`,
      statusColor: '#123456',
    })
  })

  it('keeps each board’s lane counts to its own ideas', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [threeLaneBoard('board-a'), threeLaneBoard('board-b')],
      statuses: threeLaneStatuses,
      statusCounts: [{ boardId: 'board-b', statusId: STATUS_1, ideaCount: 7 }],
    })

    const cards = await service.list(ORG_A)

    const byId = new Map(cards.map((card) => [card.boardId, card]))
    expect(byId.get('board-a')?.laneCounts.map((lane) => lane.ideaCount)).toEqual([0, 0, 0])
    expect(byId.get('board-b')?.laneCounts.map((lane) => lane.ideaCount)).toEqual([0, 7, 0])
  })

  it('shows the three most-used tags, breaking a count tie by name ignoring case', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [board()],
      tagCounts: [
        { boardId: 'board-a', tagName: 'rare', tagColor: '#E5484D', ideaCount: 1 },
        // A case-sensitive sort would put 'Zeta' before 'alpha'; the card must not.
        { boardId: 'board-a', tagName: 'Zeta', tagColor: '#3FB86B', ideaCount: 2 },
        { boardId: 'board-a', tagName: 'alpha', tagColor: '#ABCDEF', ideaCount: 2 },
        { boardId: 'board-a', tagName: 'safety', tagColor: '#94A3B8', ideaCount: 5 },
      ],
    })

    const [card] = await service.list(ORG_A)

    expect(card?.topTags).toEqual([
      { name: 'safety', ideaCount: 5, color: '#94A3B8' },
      { name: 'alpha', ideaCount: 2, color: '#ABCDEF' },
      { name: 'Zeta', ideaCount: 2, color: '#3FB86B' },
    ])
  })

  it('counts every distinct tag in tagCount, not just the three shown', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [board()],
      tagCounts: ['a', 'b', 'c', 'd', 'e'].map((tagName) => ({
        boardId: 'board-a',
        tagName,
        tagColor: '#E5484D',
        ideaCount: 1,
      })),
    })

    const [card] = await service.list(ORG_A)

    expect(card?.topTags.map((tag) => tag.name)).toEqual(['a', 'b', 'c'])
    expect(card?.tagCount).toBe(5)
  })

  it('reports no tags and a zero tag count for a board with no tagged ideas', async () => {
    const { service } = harness({ currentUser: member(ORG_A), boards: [board()] })

    const [card] = await service.list(ORG_A)

    expect(card?.topTags).toEqual([])
    expect(card?.tagCount).toBe(0)
  })

  it('names the creator by first and last name, with the creation time', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [threeLaneBoard('board-a', 'creator-1')],
      statuses: threeLaneStatuses,
      userNames: { 'creator-1': { firstName: 'Ada', lastName: 'Lovelace' } },
    })

    const [card] = await service.list(ORG_A)

    expect(card?.createdBy).toEqual({ userId: 'creator-1', displayName: 'Ada Lovelace' })
    expect(card?.createdAtUtc).toEqual(NOW)
  })

  it('reports no creator when the board records none, without looking one up', async () => {
    const { service, reads } = harness({
      currentUser: member(ORG_A),
      boards: [threeLaneBoard('board-a', null)],
      statuses: threeLaneStatuses,
    })

    const [card] = await service.list(ORG_A)

    expect(card?.createdBy).toBeNull()
    expect(reads.find((read) => read.method === 'getUserNames')?.ids).toEqual([])
  })

  it('reports no creator when the creator id no longer resolves to a user', async () => {
    const { service } = harness({
      currentUser: member(ORG_A),
      boards: [threeLaneBoard('board-a', 'deleted-user')],
      statuses: threeLaneStatuses,
    })

    const [card] = await service.list(ORG_A)

    expect(card?.createdBy).toBeNull()
  })

  it('carries the board description through', async () => {
    const described = { ...board(), description: 'Assembly cell reliability.' }
    const { service } = harness({ currentUser: member(ORG_A), boards: [described] })

    const [card] = await service.list(ORG_A)

    expect(card?.description).toBe('Assembly cell reliability.')
  })

  it('reads the aggregates in a fixed number of batched calls, however many boards there are', async () => {
    const readsFor = async (boardCount: number) => {
      const boards = Array.from({ length: boardCount }, (_, i) =>
        threeLaneBoard(`board-${i}`, `creator-${i % 2}`),
      )
      const { service, reads } = harness({
        currentUser: member(ORG_A),
        boards,
        statuses: threeLaneStatuses,
      })
      await service.list(ORG_A)
      return reads
    }

    const one = await readsFor(1)
    const many = await readsFor(12)

    expect(many.map((read) => read.method).sort()).toEqual(one.map((read) => read.method).sort())
    for (const method of [
      'countIdeasByBoard',
      'countIdeasByBoardAndStatus',
      'countIdeasByBoardAndTag',
    ]) {
      const calls = many.filter((read) => read.method === method)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.ids).toHaveLength(12)
    }
    // Twelve boards, two distinct creators: the lookup is de-duplicated.
    expect(many.find((read) => read.method === 'getUserNames')?.ids).toHaveLength(2)
  })
})

describe('BoardService description', () => {
  const describedBoard: Board = { ...board(), description: 'Original description.' }

  it('stores a trimmed description on create', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.create(ORG_A, { ...CREATE, description: '  Fewer stoppages.  ' })

    expect(added[0]?.description).toBe('Fewer stoppages.')
  })

  it('leaves the description unchanged when an update omits it', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A), boards: [describedBoard] })

    const detail = await service.update('board-a', UPDATE)

    expect(saved[0]?.description).toBe('Original description.')
    expect(detail.description).toBe('Original description.')
  })

  it.each([
    ['null', null],
    ['blank', '   '],
  ])('clears the description when an update sends %s', async (_label, description) => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A), boards: [describedBoard] })

    await service.update('board-a', { ...UPDATE, description })

    expect(saved[0]?.description).toBeNull()
  })

  it('refuses an over-long description as a validation failure keyed on description', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A), boards: [describedBoard] })

    const error = await service
      .update('board-a', { ...UPDATE, description: 'd'.repeat(501) })
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['description'])
    expect(saved).toHaveLength(0)
  })
})

describe('BoardService archive (rule 13)', () => {
  const archived = archiveBoard(board(), NOW, 'seed')
  const REORDER = {
    swimlanes: [
      { statusId: STATUS_2, order: 0 },
      { statusId: STATUS_1, order: 1 },
    ],
  }

  it('lets an Org Admin archive a board, saving it once and auditing it', async () => {
    const { service, saved, audit } = harness({ currentUser: orgAdmin(ORG_A) })

    await service.archive('board-a')

    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ isArchived: true, archivedAtUtc: NOW })
    expect(audit.events.map((e) => e.eventType)).toEqual(['BoardArchived'])
  })

  it('treats archiving an archived board, or unarchiving an active one, as a no-op', async () => {
    const onArchived = harness({ currentUser: orgAdmin(ORG_A), boards: [archived] })
    await onArchived.service.archive('board-a')

    const onActive = harness({ currentUser: orgAdmin(ORG_A) })
    await onActive.service.unarchive('board-a')

    expect(onArchived.saved).toHaveLength(0)
    expect(onArchived.audit.events).toHaveLength(0)
    expect(onActive.saved).toHaveLength(0)
    expect(onActive.audit.events).toHaveLength(0)
  })

  it('unarchives an archived board', async () => {
    const { service, saved, audit } = harness({ currentUser: orgAdmin(ORG_A), boards: [archived] })

    await service.unarchive('board-a')

    expect(saved[0]).toMatchObject({ isArchived: false, archivedAtUtc: null })
    expect(audit.events.map((e) => e.eventType)).toEqual(['BoardUnarchived'])
  })

  it.each([
    ['a direct Site Admin', siteAdmin()],
    ['a User', member(ORG_A)],
    ['Read Only', readOnly(ORG_A)],
  ])('refuses %s archiving or unarchiving', async (_label, currentUser) => {
    const { service, saved } = harness({ currentUser, boards: [archived] })

    await expect(service.archive('board-a')).rejects.toThrow(ForbiddenError)
    await expect(service.unarchive('board-a')).rejects.toThrow(ForbiddenError)
    expect(saved).toHaveLength(0)
  })

  it('refuses an Org Admin of another organization as not-found', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_B) })

    await expect(service.archive('board-a')).rejects.toThrow(NotFoundError)
  })

  it('refuses an archived board’s own update and lane reorder with 409', async () => {
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A), boards: [archived] })

    await expect(service.update('board-a', UPDATE)).rejects.toThrow(ConflictError)
    await expect(service.reorderSwimlanes('board-a', REORDER)).rejects.toThrow(ConflictError)
    expect(saved).toHaveLength(0)
  })

  it('answers a role refusal on an archived board with 403, not 409', async () => {
    const { service } = harness({ currentUser: member(ORG_A), boards: [archived] })

    await expect(service.update('board-a', UPDATE)).rejects.toThrow(ForbiddenError)
    await expect(service.reorderSwimlanes('board-a', REORDER)).rejects.toThrow(ForbiddenError)
  })

  it('leaves an archived board out of the list unless includeArchived is set', async () => {
    const active = board({ id: 'board-b', name: 'Active Board' })
    const { service } = harness({ currentUser: member(ORG_A), boards: [archived, active] })

    const defaultList = await service.list(ORG_A)
    const everything = await service.list(ORG_A, { includeArchived: true })

    expect(defaultList.map((b) => b.boardId)).toEqual(['board-b'])
    expect(everything.map((b) => [b.boardId, b.isArchived])).toEqual([
      ['board-a', true],
      ['board-b', false],
    ])
  })

  it('still reads an archived board’s detail, flagged as archived', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A), boards: [archived] })

    await expect(service.getById('board-a')).resolves.toMatchObject({ isArchived: true })
  })
})
