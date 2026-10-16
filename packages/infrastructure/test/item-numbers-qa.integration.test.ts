// Live-database QA for item numbers (Board References Ruling 3 and 5): pulls in the same save as a
// board create or a prefix change, a failed pull burning nothing, numbers never reused, detach, and
// the seeded numbering invariant. Skipped unless `DATABASE_URL` is set; builds its own organization
// and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import type { CurrentUserContext } from '@collega/application/common'
import { Role } from '@collega/domain/enums'
import { detachIdeaFromBoard } from '@collega/domain/ideas'
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

describe.skipIf(!DATABASE_URL)('Item numbers QA, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const tag = marker.slice(0, 4).toUpperCase()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [S1, S2] = [randomUUID(), randomUUID()] as const
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }

  function services() {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const currentUser: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    const boardService = new BoardService(
      boards,
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      { write: async () => {} },
      currentUser,
      { now: () => SAVED },
      ideas,
    )
    return { unitOfWork, boards, ideas, boardService }
  }

  const lanes = [
    { statusId: S1, order: 0 },
    { statusId: S2, order: 1 },
  ]

  function reassignment(ideaId: string, fromBoardId: string | null, fromStatusId = S1) {
    return {
      ideaId,
      title: `QA idea ${ideaId}`,
      from: {
        boardId: fromBoardId,
        statusId: fromStatusId,
        phase: 'Discovery' as never,
        sprintId: null,
      },
      toStatusId: S1,
      returnsToDiscovery: false,
    }
  }

  async function newBoard(keyPrefix: string | null, nextItemNumber = 1): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `QA ${id}`,
        key_prefix: keyPrefix,
        next_item_number: nextItemNumber,
        allow_user_status_update: true,
        ...stamps,
        board_swimlanes: {
          create: lanes.map((lane) => ({
            id: randomUUID(),
            status_id: lane.statusId,
            display_order: lane.order,
            is_final: false,
          })),
        },
      },
    })
    return id
  }

  async function newIdea(
    boardId: string | null,
    itemNumber: number | null,
    createdAt = CREATED,
  ): Promise<string> {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        item_number: itemNumber,
        status_id: S1,
        title: `QA idea ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: false,
        phase: 'Discovery',
        created_at_utc: createdAt,
        updated_at_utc: createdAt,
      },
    })
    return id
  }

  async function numberOf(ideaId: string): Promise<number | null> {
    const row = await prisma.ideas.findUniqueOrThrow({
      where: { id: ideaId },
      select: { item_number: true },
    })
    return row.item_number
  }

  async function nextOf(boardId: string): Promise<number> {
    const row = await prisma.boards.findUniqueOrThrow({
      where: { id: boardId },
      select: { next_item_number: true },
    })
    return row.next_item_number
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Item number QA probe.',
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
    for (const [order, id] of [S1, S2].entries()) {
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
  })

  afterAll(async () => {
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

  it('numbers items pulled into a board created in the same save from 1', async () => {
    // A pull numbers the oldest item first.
    const first = await newIdea(null, null, new Date('2026-10-01T00:00:00.000Z'))
    const second = await newIdea(null, null, new Date('2026-10-02T00:00:00.000Z'))

    const created = await services().boardService.create(organizationId, {
      name: 'Created with pull',
      allowUserStatusUpdate: true,
      swimlanes: lanes,
      keyPrefix: `NW${tag}`,
      pullItemIds: [first, second],
    })

    expect(await numberOf(first)).toBe(1)
    expect(await numberOf(second)).toBe(2)
    expect(await nextOf(created.boardId)).toBe(3)
  })

  it('leaves items pulled into a new board without a prefix unnumbered', async () => {
    const ideaId = await newIdea(null, null)

    const created = await services().boardService.create(organizationId, {
      name: 'Created, no prefix',
      allowUserStatusUpdate: true,
      swimlanes: lanes,
      pullItemIds: [ideaId],
    })

    expect(await numberOf(ideaId)).toBeNull()
    expect(await nextOf(created.boardId)).toBe(1)
  })

  it('numbers a pull in the same save that sets the key prefix', async () => {
    const boardId = await newBoard(null)
    const ideaId = await newIdea(null, null)

    await services().boardService.update(boardId, {
      name: 'Prefix and pull',
      allowUserStatusUpdate: true,
      swimlanes: lanes,
      keyPrefix: `PF${tag}`,
      pullItemIds: [ideaId],
    })

    const board = await prisma.boards.findUniqueOrThrow({ where: { id: boardId } })
    expect(board.key_prefix).toBe(`PF${tag}`)
    expect(await numberOf(ideaId)).toBe(1)
    expect(board.next_item_number).toBe(2)
  })

  it('burns no number when a pull fails, and rolls the whole save back', async () => {
    const { unitOfWork, boards } = services()
    const boardId = await newBoard(`FL${tag}`, 4)
    const good = await newIdea(null, null)
    const stale = await newIdea(null, null)

    // The second item's expected status is wrong, so the closing check refuses the batch.
    await boards.reassignIdeas(
      boardId,
      [reassignment(good, null), reassignment(stale, null, S2)],
      SAVED,
      adminId,
    )
    await expect(unitOfWork.saveChanges()).rejects.toThrow()

    expect(await nextOf(boardId)).toBe(4)
    expect(await numberOf(good)).toBeNull()
    expect(await numberOf(stale)).toBeNull()
    expect((await prisma.ideas.findUniqueOrThrow({ where: { id: good } })).board_id).toBeNull()
  })

  it('numbers concurrent pulls into one board distinctly', async () => {
    const boardId = await newBoard(`CC${tag}`)
    const ids = await Promise.all(Array.from({ length: 6 }, () => newIdea(null, null)))

    await Promise.all(
      ids.map(async (ideaId, index) => {
        const { unitOfWork, boards } = services()
        await boards.reassignIdeas(
          boardId,
          [reassignment(ideaId, null)],
          new Date(SAVED.getTime() + index),
          adminId,
        )
        await unitOfWork.saveChanges()
      }),
    )

    const numbers = await Promise.all(ids.map(numberOf))
    expect([...numbers].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 6])
    expect(await nextOf(boardId)).toBe(7)
  })

  it('never reuses a number after the item is detached, moved out or removed', async () => {
    const { boards, ideas, unitOfWork } = services()
    const boardId = await newBoard(`NR${tag}`)
    const other = await newBoard(`NO${tag}`)
    const a = await newIdea(boardId, await boards.allocateItemNumber(boardId))
    const b = await newIdea(boardId, await boards.allocateItemNumber(boardId))
    const c = await newIdea(boardId, await boards.allocateItemNumber(boardId))
    expect([await numberOf(a), await numberOf(b), await numberOf(c)]).toEqual([1, 2, 3])

    // a is detached through the repository, b is pulled onto another board, c is removed.
    const loaded = await ideas.getById(a, false)
    if (loaded === null) {
      throw new Error('idea a should load')
    }
    await ideas.update(detachIdeaFromBoard(loaded, SAVED, adminId))
    await unitOfWork.saveChanges()
    const mover = services()
    await mover.boards.reassignIdeas(other, [reassignment(b, boardId)], SAVED, adminId)
    await mover.unitOfWork.saveChanges()
    await prisma.ideas.delete({ where: { id: c } })

    expect(await numberOf(a)).toBeNull()
    expect((await prisma.ideas.findUniqueOrThrow({ where: { id: a } })).board_id).toBeNull()
    expect(await numberOf(b)).toBe(1)
    expect(await boards.allocateItemNumber(boardId)).toBe(4)
    expect(await nextOf(boardId)).toBe(5)
  })

  it('keeps seeded boards consistent: numbers unique per board and below next_item_number', async () => {
    const rows = await prisma.$queryRaw<
      {
        board_id: string
        numbered: bigint
        distinct_numbers: bigint
        max_number: number | null
        next_number: number
      }[]
    >`
      SELECT b.id AS board_id,
             COUNT(i.item_number) AS numbered,
             COUNT(DISTINCT i.item_number) AS distinct_numbers,
             MAX(i.item_number) AS max_number,
             b.next_item_number AS next_number
      FROM boards AS b
      INNER JOIN organizations AS o ON o.id = b.organization_id
      LEFT JOIN ideas AS i ON i.board_id = b.id
      WHERE b.key_prefix IS NOT NULL AND o.title NOT LIKE 'probe-org-%'
      GROUP BY b.id, b.next_item_number
    `

    for (const row of rows) {
      expect(row.distinct_numbers, `board ${row.board_id}`).toBe(row.numbered)
      expect(row.next_number, `board ${row.board_id}`).toBeGreaterThan(row.max_number ?? 0)
    }
  })
})
