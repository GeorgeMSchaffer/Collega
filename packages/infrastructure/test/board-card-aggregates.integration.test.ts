// Live-database test for the board list's card aggregates (SPEC/30-Contracts.md Board Contracts,
// SPEC/decisions.md 2026-09-27). Every aggregate must count exactly what `GET /boards/{id}/ideas`
// lists: live, Discovery-phase ideas. The tag count is raw SQL, so its filter is a second copy of
// `boardIdeasWhere` that only a real Postgres can check - a mock would agree with whatever it was
// told.
//
// Skipped unless `DATABASE_URL` is set, like `tag-get-or-create.integration.test.ts`. It borrows an
// organization with at least two statuses, an idea type, a business impact and a user from the
// seeded database, creates its own board, tags and ideas, and removes them afterwards. Run with:
//   DATABASE_URL=postgresql://collega:<password>@127.0.0.1:5432/Collega pnpm --filter @collega/infrastructure test -- board-card-aggregates

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-09-27T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)(
  'PrismaBoardRepository card aggregates against a live database',
  () => {
    const prisma = new PrismaClient()
    const boards = new PrismaBoardRepository(prisma, new PrismaUnitOfWork(prisma))
    const boardId = randomUUID()
    const otherBoardId = randomUUID()
    const tagIds: string[] = []
    /** Generated tag name -> the label the test gave it. */
    const tagLabels = new Map<string, string>()
    let laneA: string
    let laneB: string

    beforeAll(async () => {
      const organization = await prisma.organizations.findFirst({
        where: {
          statuses: { some: {} },
          idea_types: { some: {} },
          business_impacts: { some: {} },
          users: { some: {} },
        },
        select: {
          id: true,
          statuses: { select: { id: true }, take: 2, orderBy: { sort_order: 'asc' } },
          idea_types: { select: { id: true }, take: 1 },
          business_impacts: { select: { id: true }, take: 1 },
          users: { select: { id: true }, take: 1 },
        },
      })
      const [statusA, statusB] = organization?.statuses ?? []
      const ideaType = organization?.idea_types[0]
      const impact = organization?.business_impacts[0]
      const author = organization?.users[0]
      if (!organization || !statusA || !statusB || !ideaType || !impact || !author) {
        throw new Error(
          'Fixture requires a seeded organization with two statuses, an idea type, a business impact and a user.',
        )
      }
      laneA = statusA.id
      laneB = statusB.id
      const organizationId = organization.id

      for (const id of [boardId, otherBoardId]) {
        await prisma.boards.create({
          data: {
            id,
            organization_id: organizationId,
            name: `probe-board-${id}`,
            allow_user_status_update: true,
            created_at_utc: AT,
            updated_at_utc: AT,
            board_swimlanes: {
              create: [
                { id: randomUUID(), status_id: laneA, display_order: 0 },
                { id: randomUUID(), status_id: laneB, display_order: 1 },
              ],
            },
          },
        })
      }

      const tag = async (label: string) => {
        const id = randomUUID()
        const name = `probe-${label}-${id}`
        await prisma.tags.create({
          data: {
            id,
            organization_id: organizationId,
            name,
            normalized_name: name.toLowerCase(),
            color: '#E5484D',
            created_at_utc: AT,
            updated_at_utc: AT,
          },
        })
        tagIds.push(id)
        tagLabels.set(name, label)
        return { id, name }
      }
      const common = await tag('common')
      const single = await tag('single')
      const deletedOnly = await tag('deleted-only')
      const deliveryOnly = await tag('delivery-only')

      const idea = async (params: {
        board: string
        status: string
        tags: readonly string[]
        isDeleted?: boolean
        delivery?: boolean
      }) => {
        await prisma.ideas.create({
          data: {
            id: randomUUID(),
            organization_id: organizationId,
            board_id: params.board,
            status_id: params.status,
            title: 'Probe idea',
            description: 'Probe idea for the board card aggregates.',
            problem: 'Probe problem.',
            proposed_solutions: ['Probe solution.'],
            impact_rationale: 'Probe rationale.',
            priority: 'Medium',
            idea_type_id: ideaType.id,
            business_impact_id: impact.id,
            author_user_id: author.id,
            is_deleted: params.isDeleted ?? false,
            phase: params.delivery ? 'Delivery' : 'Discovery',
            created_at_utc: AT,
            updated_at_utc: AT,
            idea_tags: {
              create: params.tags.map((tagId) => ({ id: randomUUID(), tag_id: tagId })),
            },
          },
        })
      }
      // Counted: three live Discovery ideas.
      await idea({ board: boardId, status: laneA, tags: [common.id, single.id] })
      await idea({ board: boardId, status: laneA, tags: [common.id] })
      await idea({ board: boardId, status: laneB, tags: [] })
      // Not counted: soft-deleted, and promoted to Delivery - each on lane B, each with its own tag.
      await idea({ board: boardId, status: laneB, tags: [deletedOnly.id], isDeleted: true })
      await idea({ board: boardId, status: laneB, tags: [deliveryOnly.id], delivery: true })
      // Another board's idea, sharing a tag, must not leak into this board's rows.
      await idea({ board: otherBoardId, status: laneA, tags: [common.id] })
    })

    afterAll(async () => {
      await prisma.ideas.deleteMany({ where: { board_id: { in: [boardId, otherBoardId] } } })
      await prisma.boards.deleteMany({ where: { id: { in: [boardId, otherBoardId] } } })
      await prisma.tags.deleteMany({ where: { id: { in: tagIds } } })
      await prisma.$disconnect()
    })

    it('counts only live Discovery ideas per board', async () => {
      const counts = await boards.countIdeasByBoard([boardId, otherBoardId])

      expect(counts.get(boardId)).toBe(3)
      expect(counts.get(otherBoardId)).toBe(1)
    })

    it('counts only live Discovery ideas per lane', async () => {
      const rows = await boards.countIdeasByBoardAndStatus([boardId])

      expect(Object.fromEntries(rows.map((row) => [row.statusId, row.ideaCount]))).toEqual({
        [laneA]: 2,
        [laneB]: 1,
      })
    })

    it('counts tags over live Discovery ideas only, and only the requested board’s', async () => {
      const rows = await boards.countIdeasByBoardAndTag([boardId])

      const byLabel = Object.fromEntries(
        rows.map((row) => [tagLabels.get(row.tagName) ?? row.tagName, row.ideaCount]),
      )
      expect(rows.every((row) => row.boardId === boardId)).toBe(true)
      expect(byLabel).toEqual({ common: 2, single: 1 })
    })
  },
)
