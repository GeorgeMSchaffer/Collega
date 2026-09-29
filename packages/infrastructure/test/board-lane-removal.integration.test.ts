// Live-database test for removing a lane that still holds ideas (SPEC/20-feature-boards-and-statuses.md
// rule 14, SPEC/contracts/boards.md `PUT /boards/{boardId}` `ideaMoves`). Three things only a real
// Postgres can show: which ideas the adapter treats as the lane's (live Discovery ideas of that
// board), that `moveIdeas` leaves an idea someone moved out of the lane meanwhile where they put it,
// and that the lane change and the moves commit as one transaction.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.
// Audit events go to an in-memory writer so the run leaves no rows behind.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import type { AuditEventInput, CurrentUserContext } from '@collega/application/common'
import { updateBoard } from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-09-20T09:00:00.000Z')
const SAVED = new Date('2026-09-29T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Removing a lane that holds ideas, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [NEW, REVIEW, DONE] = [randomUUID(), randomUUID(), randomUUID()] as const
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }

  function service(audit: AuditEventInput[] = []): BoardService {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const currentUser: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    return new BoardService(
      new PrismaBoardRepository(prisma, unitOfWork),
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      { write: async (event) => void audit.push(event) },
      currentUser,
      { now: () => SAVED },
    )
  }

  /** A board with the lanes New, In Review and Done. */
  async function newBoard(): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `Lanes ${id}`,
        allow_user_status_update: true,
        ...stamps,
        board_swimlanes: {
          create: [NEW, REVIEW, DONE].map((statusId, order) => ({
            id: randomUUID(),
            status_id: statusId,
            display_order: order,
          })),
        },
      },
    })
    return id
  }

  async function newIdea(
    boardId: string,
    statusId: string,
    options: { isDeleted?: boolean; delivery?: boolean } = {},
  ): Promise<string> {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        status_id: statusId,
        title: `Probe idea ${id}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: options.isDeleted ?? false,
        phase: options.delivery ? 'Delivery' : 'Discovery',
        ...stamps,
      },
    })
    return id
  }

  async function statusOf(ideaId: string): Promise<string> {
    const row = await prisma.ideas.findUniqueOrThrow({
      where: { id: ideaId },
      select: { status_id: true },
    })
    return row.status_id
  }

  async function lanesOf(boardId: string): Promise<string[]> {
    const rows = await prisma.board_swimlanes.findMany({
      where: { board_id: boardId },
      orderBy: { display_order: 'asc' },
      select: { status_id: true },
    })
    return rows.map((row) => row.status_id)
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Lane removal probe.',
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
    for (const [order, [id, name]] of [
      [NEW, 'New'],
      [REVIEW, 'In Review'],
      [DONE, 'Done'],
    ].entries()) {
      await prisma.statuses.create({
        data: {
          id: id as string,
          organization_id: organizationId,
          name: name as string,
          color: '#123456',
          sort_order: order,
          is_deleted: false,
          ...stamps,
        },
      })
    }
    await prisma.idea_types.create({
      data: {
        id: ideaTypeId,
        organization_id: organizationId,
        name: 'Probe type',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.business_impacts.create({
      data: {
        id: impactId,
        organization_id: organizationId,
        name: 'Probe impact',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  it('lists a lane’s live Discovery ideas of that board only', async () => {
    const boardId = await newBoard()
    const otherBoardId = await newBoard()
    const live = await newIdea(boardId, REVIEW)
    await newIdea(boardId, REVIEW, { isDeleted: true })
    await newIdea(boardId, REVIEW, { delivery: true })
    await newIdea(boardId, NEW)
    await newIdea(otherBoardId, REVIEW)

    const ideas = await new PrismaBoardRepository(
      prisma,
      new PrismaUnitOfWork(prisma),
    ).listLaneIdeas(boardId, [REVIEW])

    expect(ideas).toEqual([{ ideaId: live, title: `Probe idea ${live}`, statusId: REVIEW }])
  })

  it('moves the live Discovery ideas and leaves soft-deleted ideas and Issues where they were', async () => {
    const boardId = await newBoard()
    const otherBoardId = await newBoard()
    const moved = [await newIdea(boardId, REVIEW), await newIdea(boardId, REVIEW)]
    const deleted = await newIdea(boardId, REVIEW, { isDeleted: true })
    const issue = await newIdea(boardId, REVIEW, { delivery: true })
    const elsewhere = await newIdea(otherBoardId, REVIEW)
    const audit: AuditEventInput[] = []

    await service(audit).update(boardId, {
      name: 'Lanes',
      allowUserStatusUpdate: true,
      swimlanes: [
        { statusId: NEW, order: 0 },
        { statusId: DONE, order: 1 },
      ],
      ideaMoves: [{ fromStatusId: REVIEW, toStatusId: DONE }],
    })

    expect(await lanesOf(boardId)).toEqual([NEW, DONE])
    const rows = await prisma.ideas.findMany({
      where: { id: { in: moved } },
      select: { status_id: true, updated_at_utc: true, updated_by_user_id: true },
    })
    expect(rows).toEqual([
      { status_id: DONE, updated_at_utc: SAVED, updated_by_user_id: adminId },
      { status_id: DONE, updated_at_utc: SAVED, updated_by_user_id: adminId },
    ])
    expect(await statusOf(deleted)).toBe(REVIEW)
    expect(await statusOf(issue)).toBe(REVIEW)
    expect(await statusOf(elsewhere)).toBe(REVIEW)
    expect(
      audit
        .filter((event) => event.eventType === 'IdeaStatusChanged')
        .map((event) => event.entityId)
        .sort(),
    ).toEqual([...moved].sort())
  })

  it('leaves an idea moved out of the lane before the commit where it was put', async () => {
    const boardId = await newBoard()
    const stays = await newIdea(boardId, REVIEW)
    const movedMeanwhile = await newIdea(boardId, REVIEW)
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)

    await boards.moveIdeas(boardId, [stays, movedMeanwhile], REVIEW, NEW, SAVED, adminId)
    // Someone else's move lands between the save counting the lane and committing.
    await prisma.ideas.update({ where: { id: movedMeanwhile }, data: { status_id: DONE } })
    await unitOfWork.saveChanges()

    expect(await statusOf(stays)).toBe(NEW)
    expect(await statusOf(movedMeanwhile)).toBe(DONE)
  })

  it('commits the lane change and the moves together, or neither', async () => {
    const boardId = await newBoard()
    const ideaId = await newIdea(boardId, REVIEW)
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    const existing = await boards.getById(boardId)
    if (existing === null) throw new Error('The probe board was not created.')

    await boards.save(
      updateBoard(
        existing,
        { name: 'Lanes', allowUserStatusUpdate: true, orderedStatusIds: [NEW, DONE] },
        SAVED,
        adminId,
      ),
    )
    await boards.moveIdeas(boardId, [ideaId], REVIEW, DONE, SAVED, adminId)
    // A write that must fail - the organization already exists - staged in the same batch.
    unitOfWork.enqueue(
      prisma.organizations.create({
        data: {
          id: organizationId,
          title: 'duplicate',
          description: 'duplicate',
          invite_code: `dup-${marker}`,
          is_archived: false,
          ...stamps,
        },
      }),
    )

    await expect(unitOfWork.saveChanges()).rejects.toBeDefined()
    expect(await lanesOf(boardId)).toEqual([NEW, REVIEW, DONE])
    expect(await statusOf(ideaId)).toBe(REVIEW)
  })

  it('moves nothing when the save is refused', async () => {
    const boardId = await newBoard()
    const ideaId = await newIdea(boardId, REVIEW)

    await expect(
      service().update(boardId, {
        name: 'Lanes',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: NEW, order: 0 },
          { statusId: DONE, order: 1 },
        ],
      }),
    ).rejects.toMatchObject({
      failures: {
        ideaMoves: [
          "'In Review' still holds 1 idea. Choose a lane that stays on the board to move it to.",
        ],
      },
    })
    expect(await lanesOf(boardId)).toEqual([NEW, REVIEW, DONE])
    expect(await statusOf(ideaId)).toBe(REVIEW)
  })
})
