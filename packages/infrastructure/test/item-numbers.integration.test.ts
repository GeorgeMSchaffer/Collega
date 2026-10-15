// Live-database test for item numbers (Board References Ruling 3 and 5): the atomic allocator, and
// the numbering a pull gives an item. Skipped unless `DATABASE_URL` is set; builds its own
// organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const STAMP = new Date('2026-09-20T09:00:00.000Z')
const PULLED = new Date('2026-09-29T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Item numbers, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const statusId = randomUUID()
  const stamps = { created_at_utc: STAMP, updated_at_utc: STAMP }
  const unitOfWork = new PrismaUnitOfWork(prisma)
  const repository = new PrismaBoardRepository(prisma, unitOfWork)

  async function newBoard(keyPrefix: string | null): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `Board ${id}`,
        key_prefix: keyPrefix,
        allow_user_status_update: true,
        ...stamps,
      },
    })
    return id
  }

  async function newIdea(boardId: string | null, itemNumber: number | null): Promise<string> {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        item_number: itemNumber,
        status_id: statusId,
        title: `Probe ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: false,
        phase: 'Discovery',
        ...stamps,
      },
    })
    return id
  }

  async function pull(boardId: string, from: string | null, ids: string[]): Promise<void> {
    await repository.reassignIdeas(
      boardId,
      ids.map((ideaId) => ({
        ideaId,
        title: `Probe ${ideaId}`,
        from: { boardId: from, statusId, phase: 'Discovery' as never, sprintId: null },
        toStatusId: statusId,
        returnsToDiscovery: false,
      })),
      PULLED,
      adminId,
    )
    await unitOfWork.saveChanges()
  }

  async function numberOf(ideaId: string): Promise<number | null> {
    const row = await prisma.ideas.findUniqueOrThrow({
      where: { id: ideaId },
      select: { item_number: true },
    })
    return row.item_number
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Item number probe.',
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
    await prisma.statuses.create({
      data: {
        id: statusId,
        organization_id: organizationId,
        name: 'New',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
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

  it('hands concurrent allocations distinct, consecutive numbers', async () => {
    const boardId = await newBoard(`CI${marker.slice(0, 4)}`.toUpperCase())

    const numbers = await Promise.all(
      Array.from({ length: 8 }, () => repository.allocateItemNumber(boardId)),
    )

    expect([...numbers].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const board = await prisma.boards.findUniqueOrThrow({ where: { id: boardId } })
    expect(board.next_item_number).toBe(9)
  })

  it('allocates nothing on a board without a prefix', async () => {
    const boardId = await newBoard(null)

    expect(await repository.allocateItemNumber(boardId)).toBeNull()
    const board = await prisma.boards.findUniqueOrThrow({ where: { id: boardId } })
    expect(board.next_item_number).toBe(1)
  })

  it('numbers a pulled item from the new board and drops the old board number', async () => {
    const source = await newBoard(`SR${marker.slice(0, 4)}`.toUpperCase())
    const target = await newBoard(`TG${marker.slice(0, 4)}`.toUpperCase())
    await prisma.boards.update({ where: { id: target }, data: { next_item_number: 5 } })
    const first = await newIdea(source, 5)
    const second = await newIdea(null, null)

    await pull(target, source, [first])
    await pull(target, null, [second])

    expect(await numberOf(first)).toBe(5)
    expect(await numberOf(second)).toBe(6)
    const board = await prisma.boards.findUniqueOrThrow({ where: { id: target } })
    expect(board.next_item_number).toBe(7)
  })

  it('leaves a pulled item unnumbered on a board without a prefix', async () => {
    const source = await newBoard(`SX${marker.slice(0, 4)}`.toUpperCase())
    const target = await newBoard(null)
    const ideaId = await newIdea(source, 3)

    await pull(target, source, [ideaId])

    expect(await numberOf(ideaId)).toBeNull()
  })
})
