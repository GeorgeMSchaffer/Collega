// Live-database test for board archive (SPEC/20-feature-boards-and-statuses.md rule 13,
// SPEC/30-Contracts.md `includeArchived`): the real `BoardService` over the Prisma adapters, so the
// flag and its timestamp are proved to survive a write and a read, the default list is proved to
// leave an archived board out, and an archived board's settings are proved frozen end to end.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.
// Audit events go to an in-memory writer so the run leaves no rows behind.

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
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-09-20T09:00:00.000Z')
const ARCHIVED = new Date('2026-09-27T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Board archive against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const statusIds = [randomUUID(), randomUUID()] as const
  const activeBoardId = randomUUID()
  const archivedBoardId = randomUUID()
  const auditEvents: string[] = []

  /** A fresh service per call, as a request would get: one unit of work each. */
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
    const audit: AuditEventWriter = {
      write: async (event) => {
        auditEvents.push(event.eventType)
      },
    }
    return new BoardService(
      new PrismaBoardRepository(prisma, unitOfWork),
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      audit,
      currentUser,
      { now: () => ARCHIVED },
    )
  }

  beforeAll(async () => {
    const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board archive probe.',
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
    for (const [id, name] of [
      [activeBoardId, 'Active board'],
      [archivedBoardId, 'Board to archive'],
    ] as const) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name,
          allow_user_status_update: true,
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

    await service().archive(archivedBoardId)
  })

  afterAll(async () => {
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  it('stores the flag and the time it was archived', async () => {
    const row = await prisma.boards.findUniqueOrThrow({
      where: { id: archivedBoardId },
      select: { is_archived: true, archived_at_utc: true },
    })
    expect(row).toEqual({ is_archived: true, archived_at_utc: ARCHIVED })
    expect(auditEvents).toContain('BoardArchived')
  })

  it('leaves an archived board out of the default list', async () => {
    const boards = await service().list(organizationId)

    expect(boards.map((board) => board.boardId)).toEqual([activeBoardId])
  })

  it('lists it with includeArchived, carrying isArchived and archivedAtUtc', async () => {
    const boards = await service().list(organizationId, { includeArchived: true })

    const byId = new Map(boards.map((board) => [board.boardId, board]))
    expect(byId.get(archivedBoardId)).toMatchObject({ isArchived: true, archivedAtUtc: ARCHIVED })
    expect(byId.get(activeBoardId)).toMatchObject({ isArchived: false, archivedAtUtc: null })
  })

  it('refuses a settings change with 409 and leaves the row as it was', async () => {
    const error = await service()
      .update(archivedBoardId, {
        name: 'Renamed',
        allowUserStatusUpdate: true,
        swimlanes: statusIds.map((statusId, order) => ({ statusId, order })),
      })
      .then(
        () => null,
        (thrown: unknown) => thrown,
      )

    expect(error).toBeInstanceOf(ConflictError)
    const row = await prisma.boards.findUniqueOrThrow({
      where: { id: archivedBoardId },
      select: { name: true },
    })
    expect(row.name).toBe('Board to archive')
  })

  it('unarchives back to the default list with the timestamp cleared', async () => {
    const probeId = randomUUID()
    await prisma.boards.create({
      data: {
        id: probeId,
        organization_id: organizationId,
        name: 'Round trip',
        allow_user_status_update: true,
        is_archived: true,
        archived_at_utc: CREATED,
        created_at_utc: CREATED,
        updated_at_utc: CREATED,
        board_swimlanes: {
          create: statusIds.map((statusId, order) => ({
            id: randomUUID(),
            status_id: statusId,
            display_order: order,
          })),
        },
      },
    })

    await service().unarchive(probeId)

    const listed = await service().list(organizationId)
    expect(listed.find((board) => board.boardId === probeId)).toMatchObject({
      isArchived: false,
      archivedAtUtc: null,
    })
  })
})
