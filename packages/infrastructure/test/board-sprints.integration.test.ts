// Live-database check of the board-sprint reads (SPEC/contracts/sprints.md "Sprints per board"):
// done counts follow the final lane of the item's own board, a legacy sprint keeps the
// delivery-status rule, and the board lookup reports its final statuses.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Board sprints against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [OPEN, DONE] = [randomUUID(), randomUUID()] as const
  const boardId = randomUUID()
  const otherBoardId = randomUUID()
  const boardSprintId = randomUUID()
  const legacySprintId = randomUUID()
  const stamps = { created_at_utc: AT, updated_at_utc: AT }

  async function newIdea(
    board: string | null,
    statusId: string,
    sprintId: string,
    extra: { phase?: 'Discovery' | 'Delivery'; delivery?: 'Complete' | 'Development' } = {},
  ): Promise<void> {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: board,
        status_id: statusId,
        sprint_id: sprintId,
        title: `Probe idea ${id}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: false,
        phase: extra.phase ?? 'Discovery',
        delivery_status: extra.delivery ?? null,
        effort: extra.phase === 'Delivery' ? 'Medium' : null,
        ...stamps,
      },
    })
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board sprints probe.',
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
    for (const [order, id] of [OPEN, DONE].entries()) {
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
    for (const id of [boardId, otherBoardId]) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Board ${id}`,
          allow_user_status_update: true,
          sprints_enabled: id === boardId,
          ...stamps,
          board_swimlanes: {
            create: [
              { id: randomUUID(), status_id: OPEN, display_order: 0, is_final: false },
              { id: randomUUID(), status_id: DONE, display_order: 1, is_final: true },
            ],
          },
        },
      })
    }
    for (const [id, board] of [
      [boardSprintId, boardId],
      [legacySprintId, null],
    ] as const) {
      await prisma.sprints.create({
        data: {
          id,
          organization_id: organizationId,
          board_id: board,
          name: 'Probe sprint',
          start_date: new Date('2026-10-01T00:00:00.000Z'),
          end_date: new Date('2026-10-14T00:00:00.000Z'),
          state: 'Planned',
          is_deleted: false,
          ...stamps,
        },
      })
    }
    await newIdea(boardId, OPEN, boardSprintId)
    await newIdea(boardId, DONE, boardSprintId)
    await newIdea(boardId, DONE, boardSprintId)
    await newIdea(null, OPEN, legacySprintId, { phase: 'Delivery', delivery: 'Complete' })
    await newIdea(null, DONE, legacySprintId, { phase: 'Delivery', delivery: 'Development' })
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.sprints.deleteMany({ where: { organization_id: organizationId } })
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: organizationId } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  it('counts a board sprint by final lane and a legacy sprint by delivery status', async () => {
    const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))

    const counts = await ideas.countsBySprintIds([boardSprintId, legacySprintId])

    expect(counts.get(boardSprintId)).toEqual({ issueCount: 3, doneCount: 2 })
    expect(counts.get(legacySprintId)).toEqual({ issueCount: 2, doneCount: 1 })
  })

  it('lists a board sprint by board and reports the board for sprint management', async () => {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const sprints = new PrismaSprintRepository(prisma, unitOfWork)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)

    expect((await sprints.listByBoard(boardId, null)).map((s) => s.id)).toEqual([boardSprintId])
    expect(await sprints.listByBoard(otherBoardId, null)).toEqual([])
    expect(await boards.getSprintBoard(boardId)).toEqual({
      id: boardId,
      organizationId,
      sprintsEnabled: true,
      isArchived: false,
      finalStatusIds: [DONE],
    })
  })

  it('reads a board sprint items in any phase', async () => {
    const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
    const filter = {
      organizationId,
      sprintId: boardSprintId,
      backlogOnly: false,
      deliveryStatus: null,
    }

    expect(await ideas.listDelivery(filter)).toHaveLength(0)
    expect(await ideas.listDelivery({ ...filter, anyPhase: true })).toHaveLength(3)
  })
})
