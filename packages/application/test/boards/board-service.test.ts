// Board configuration (SPEC/20-feature-boards-and-statuses.md "Board Rules").
//
// Two scopes, and the difference between them is the whole point: reading is open to any member
// of the organization, managing is admin-only AND closed to a direct Site Admin (rule 25), so a
// Site Admin can look at every board in the platform and change none of them.

import { type Board, createBoard } from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import { createStatus, type Status, softDeleteStatus } from '@collega/domain/statuses'
import { describe, expect, it } from 'vitest'
import { BoardService } from '../../src/boards/board-service.js'
import type { CreateBoardCommand, UpdateBoardCommand } from '../../src/boards/models.js'
import type { BoardRepository, OrganizationExistenceLookup } from '../../src/boards/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
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
}) {
  const boardsById = new Map((options.boards ?? [board()]).map((b) => [b.id, b]))
  const allStatuses = options.statuses ?? [status(STATUS_1), status(STATUS_2, ORG_A, 20)]
  const existingOrgs = new Set(options.organizations ?? [ORG_A, ORG_B])
  const added: Board[] = []
  const saved: Board[] = []

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
      return new Map(ids.map((id) => [id, 3]))
    },
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

    const error = await service.create(ORG_A, CREATE).catch((e: Error) => e)

    expect(error.message).toContain('View As')
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
  ])('refuses %s board management in their own organization', async (_label, currentUser) => {
    const { service } = harness({ currentUser })

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
