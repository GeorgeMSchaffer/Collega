// Live-database test for Board References lanes and flags: a save round-trips `is_final`,
// `references_board_id` and the board flags, a first-named target loses its idea features, the
// unique key prefix surfaces as a 409, and a save never writes `next_item_number`.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import {
  type AuditEventWriter,
  ConflictError,
  type CurrentUserContext,
} from '@collega/application/common'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-15T09:00:00.000Z')
const SAVED = new Date('2026-10-15T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Board lanes and flags against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const statusIds = [randomUUID(), randomUUID()] as const
  const referencingBoardId = randomUUID()
  const targetBoardId = randomUUID()
  const otherBoardId = randomUUID()

  function service(): BoardService {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const currentUser: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    const audit: AuditEventWriter = { write: async () => {} }
    return new BoardService(
      new PrismaBoardRepository(prisma, unitOfWork),
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      audit,
      currentUser,
      { now: () => SAVED },
      new PrismaIdeaRepository(prisma, unitOfWork),
    )
  }

  beforeAll(async () => {
    const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board lanes probe.',
        invite_code: `probe-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    await prisma.users.create({
      data: {
        id: adminId,
        organization_id: organizationId,
        first_name: 'Probe',
        last_name: 'Admin',
        email: `probe-admin-${marker}@example.test`,
        normalized_email: `PROBE-ADMIN-${marker}@EXAMPLE.TEST`,
        password_hash: 'not-a-real-hash',
        role: 'OrgAdmin',
        status: 'Active',
        must_change_password: false,
        failed_login_count: 0,
        security_stamp: marker,
        ...stamps,
      },
    })
    for (const [order, id] of statusIds.entries()) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Lane ${order}`,
          color: '#123456',
          sort_order: order,
          is_deleted: false,
          ...stamps,
        },
      })
    }
    for (const [id, name, keyPrefix] of [
      [referencingBoardId, 'Referencing', null],
      [targetBoardId, 'Target', null],
      [otherBoardId, 'Other', 'TAKEN'],
    ] as const) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name,
          allow_user_status_update: true,
          key_prefix: keyPrefix,
          ...stamps,
          board_swimlanes: {
            create: statusIds.map((statusId, order) => ({
              id: randomUUID(),
              status_id: statusId,
              display_order: order,
            })),
          },
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: organizationId } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  it('round-trips lane flags and board flags, and turns the new target idea features off', async () => {
    await service().update(referencingBoardId, {
      name: 'Referencing',
      allowUserStatusUpdate: true,
      keyPrefix: 'ref',
      sprintsEnabled: true,
      swimlanes: [
        { statusId: statusIds[0], order: 0, referencesBoardId: targetBoardId },
        { statusId: statusIds[1], order: 1, isFinal: true },
      ],
    })

    const lanes = await prisma.board_swimlanes.findMany({
      where: { board_id: referencingBoardId },
      orderBy: { display_order: 'asc' },
      select: { is_final: true, references_board_id: true },
    })
    expect(lanes).toEqual([
      { is_final: false, references_board_id: targetBoardId },
      { is_final: true, references_board_id: null },
    ])
    const rows = await prisma.boards.findMany({
      where: { id: { in: [referencingBoardId, targetBoardId] } },
      select: { id: true, key_prefix: true, sprints_enabled: true, idea_features_enabled: true },
    })
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get(referencingBoardId)).toMatchObject({
      key_prefix: 'REF',
      sprints_enabled: true,
      idea_features_enabled: true,
    })
    expect(byId.get(targetBoardId)?.idea_features_enabled).toBe(false)

    const detail = await service().getById(referencingBoardId)
    expect(detail.swimlanes.map((lane) => [lane.isFinal, lane.referencesBoardId])).toEqual([
      [false, targetBoardId],
      [true, null],
    ])
  })

  it('answers a duplicate key prefix with a 409, from the service check and the index backstop', async () => {
    await expect(
      service().update(targetBoardId, {
        name: 'Target',
        allowUserStatusUpdate: true,
        keyPrefix: 'taken',
        swimlanes: statusIds.map((statusId, order) => ({ statusId, order })),
      }),
    ).rejects.toThrow(ConflictError)

    const unitOfWork = new PrismaUnitOfWork(prisma)
    const repository = new PrismaBoardRepository(prisma, unitOfWork)
    const stale = await repository.getById(targetBoardId)
    if (stale === null) {
      throw new Error('target board missing')
    }
    await repository.save({ ...stale, keyPrefix: 'TAKEN' })
    await expect(unitOfWork.saveChanges()).rejects.toThrow(ConflictError)
  })

  it('never writes next_item_number on save', async () => {
    const repository = new PrismaBoardRepository(prisma, new PrismaUnitOfWork(prisma))
    const stale = await repository.getById(otherBoardId)
    if (stale === null) {
      throw new Error('board missing')
    }
    expect(stale.nextItemNumber).toBe(1)
    await prisma.boards.update({ where: { id: otherBoardId }, data: { next_item_number: 7 } })

    const unitOfWork = new PrismaUnitOfWork(prisma)
    await new PrismaBoardRepository(prisma, unitOfWork).save({ ...stale, name: 'Renamed' })
    await unitOfWork.saveChanges()

    const row = await prisma.boards.findUniqueOrThrow({
      where: { id: otherBoardId },
      select: { name: true, next_item_number: true },
    })
    expect(row).toEqual({ name: 'Renamed', next_item_number: 7 })
  })
})
