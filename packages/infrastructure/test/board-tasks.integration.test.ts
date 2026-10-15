// Live-database test for the task counts (Board References Review Focus: a task counts done only
// when it sits in a final lane of its own board). Skipped unless `DATABASE_URL` is set; builds its
// own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const STAMP = new Date('2026-09-20T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Board tasks, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const openStatus = randomUUID()
  const doneStatus = randomUUID()
  const stamps = { created_at_utc: STAMP, updated_at_utc: STAMP }
  const unitOfWork = new PrismaUnitOfWork(prisma)
  const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
  const boards = new PrismaBoardRepository(prisma, unitOfWork)

  async function newBoard(lanes: { statusId: string; isFinal: boolean; refs?: string }[]) {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `Board ${id}`,
        allow_user_status_update: true,
        ...stamps,
      },
    })
    await prisma.board_swimlanes.createMany({
      data: lanes.map((lane, order) => ({
        id: randomUUID(),
        board_id: id,
        status_id: lane.statusId,
        display_order: order,
        is_final: lane.isFinal,
        references_board_id: lane.refs ?? null,
      })),
    })
    return id
  }

  async function newIdea(
    boardId: string,
    statusId: string,
    parentId: string | null,
    isDeleted = false,
  ) {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        parent_idea_id: parentId,
        status_id: statusId,
        title: `Probe ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: isDeleted,
        phase: 'Discovery',
        ...stamps,
      },
    })
    return id
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board task probe.',
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
    for (const [id, name, sort] of [
      [openStatus, 'Open', 0],
      [doneStatus, 'Done', 1],
    ] as const) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: organizationId,
          name,
          color: '#123456',
          sort_order: sort,
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
    await prisma.ideas.updateMany({
      where: { organization_id: organizationId },
      data: { parent_idea_id: null },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
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

  it('counts a child done only in a final lane of its own board, and skips deleted children', async () => {
    // The child board's FIRST lane is final here and the parent board's Done lane is not: only the
    // child's own board decides.
    const child = await newBoard([
      { statusId: openStatus, isFinal: false },
      { statusId: doneStatus, isFinal: true },
    ])
    const parentBoard = await newBoard([
      { statusId: openStatus, isFinal: false },
      { statusId: doneStatus, isFinal: false, refs: child },
    ])
    const parent = await newIdea(parentBoard, doneStatus, null)
    await newIdea(child, openStatus, parent)
    await newIdea(child, doneStatus, parent)
    await newIdea(child, doneStatus, parent, true)
    const childless = await newIdea(parentBoard, openStatus, null)

    const counts = await ideas.countChildrenByParentIds([parent, childless])

    expect(counts.get(parent)).toEqual({ total: 2, done: 1 })
    expect(counts.has(childless)).toBe(false)

    const facts = await boards.getBoardReadFacts([parentBoard, child])
    expect(facts.get(parentBoard)?.referencedBoardByStatusId.get(doneStatus)).toBe(child)
    expect(facts.get(parentBoard)?.ideaFeaturesEnabled).toBe(true)
    expect(facts.get(child)?.referencedBoardByStatusId.size).toBe(0)
  })
})
