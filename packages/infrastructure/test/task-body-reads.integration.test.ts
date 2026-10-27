// Live-database QA for how a task reads next to ordinary ideas (SPEC/decisions.md 2026-10-16
// "Metric types are an organization table...", the board-task bullet; contracts/ideas.md "Tasks and
// item keys"): a task has no priority, so the priority filter and the priority search never match
// it, a priority sort puts tasks last in both directions without reordering the other rows, and
// the pull picker shows a null priority for it.
//
// The `ideas.priority` column is NOT NULL, so a task stores a placeholder. These rows give their
// tasks 'Critical' and 'Low' on purpose: with the column left alone a task would match a Critical
// filter and head a descending sort, which is exactly what is being ruled out. Skipped unless
// `DATABASE_URL` is set; builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import type { Priority } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const BASE = new Date('2026-10-01T00:00:00.000Z')
const minutes = (n: number) => new Date(BASE.getTime() + n * 60_000)

describe.skipIf(!DATABASE_URL)('Task reads next to ideas, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const statusId = randomUUID()
  const boardId = randomUUID()
  const stamps = { created_at_utc: BASE, updated_at_utc: BASE }
  const unitOfWork = new PrismaUnitOfWork(prisma)
  const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
  const boards = new PrismaBoardRepository(prisma, unitOfWork)

  // Ordinary ideas, created in this order; two tie on High so the tie-break shows.
  const ORDINARY: [string, 'Low' | 'Medium' | 'High' | 'Critical', number][] = [
    ['Alpha', 'Critical', 1],
    ['Bravo', 'High', 2],
    ['Charlie', 'Medium', 3],
    ['Delta', 'Low', 4],
    ['Echo', 'High', 5],
    ['Parent', 'Medium', 6],
  ]
  // Tasks: the earliest and the latest created, and a placeholder that would sort at each end.
  const TASKS: [string, 'Low' | 'Critical', number][] = [
    ['Task early', 'Critical', 0],
    ['Task late', 'Low', 9],
  ]
  const ids = new Map<string, string>()
  const RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 } as const

  const page = { page: 1, pageSize: 50 }
  const boardFilter = (over: Record<string, unknown> = {}) => ({
    boardId,
    page,
    search: null,
    searchTextFieldIds: [],
    searchCreatedOnDate: null,
    statusIds: [],
    tags: [],
    priorities: [],
    dueBefore: null,
    phase: null,
    sortBy: null,
    sortDirection: 'asc' as const,
    ...over,
  })
  const orgFilter = (over: Record<string, unknown> = {}) => ({
    organizationId,
    createdByUserId: null,
    assignedToUserId: null,
    page,
    search: null,
    sortBy: null,
    sortDirection: 'asc' as const,
    fieldFilters: [],
    searchTextFieldIds: [],
    boardIds: [],
    includeNoBoard: false,
    statusIds: [],
    priorities: [],
    tags: [],
    associatedUserId: null,
    searchCreatedOnDate: null,
    phase: null,
    ...over,
  })
  const titles = (items: readonly { title: string }[]) => items.map((i) => i.title)

  /** The ordinary ideas in priority order (ties by creation), then the tasks, in either direction. */
  function expectedByPriority(direction: 'asc' | 'desc'): string[] {
    const sign = direction === 'asc' ? 1 : -1
    const ordinary = [...ORDINARY]
      .sort((a, b) => sign * (RANK[a[1]] - RANK[b[1]]) || a[2] - b[2])
      .map(([title]) => title)
    const tasks = [...TASKS].sort((a, b) => a[2] - b[2]).map(([title]) => title)
    return [...ordinary, ...tasks]
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Task reads probe.',
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
        name: 'Open',
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
    await prisma.boards.create({
      data: {
        id: boardId,
        organization_id: organizationId,
        name: `Task reads ${marker}`,
        allow_user_status_update: true,
        ...stamps,
        board_swimlanes: {
          create: [{ id: randomUUID(), status_id: statusId, display_order: 0, is_final: false }],
        },
      },
    })

    const row = (
      title: string,
      priority: Priority | string,
      at: number,
      parentId: string | null,
    ) => {
      const id = randomUUID()
      ids.set(title, id)
      return {
        id,
        organization_id: organizationId,
        board_id: boardId,
        status_id: statusId,
        parent_idea_id: parentId,
        title,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: priority as 'Low',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: false,
        phase: 'Discovery' as const,
        created_at_utc: minutes(at),
        updated_at_utc: minutes(at),
      }
    }
    // The parent first: tasks point at it.
    for (const [title, priority, at] of ORDINARY) {
      await prisma.ideas.create({ data: row(title, priority, at, null) })
    }
    for (const [title, priority, at] of TASKS) {
      await prisma.ideas.create({ data: row(title, priority, at, ids.get('Parent') ?? null) })
    }
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

  describe('the priority filter', () => {
    it.each([
      ['Critical', ['Alpha']],
      ['Low', ['Delta']],
      ['High', ['Bravo', 'Echo']],
    ] as const)('never matches a task on the board list: %s', async (priority, expected) => {
      const result = await ideas.listByBoard(boardFilter({ priorities: [priority] }) as never)

      expect(titles(result.items).sort()).toEqual([...expected].sort())
    })

    it('never matches a task on the organization list, for every priority at once', async () => {
      const result = await ideas.listByOrganization(
        orgFilter({ priorities: ['Low', 'Medium', 'High', 'Critical'] }) as never,
      )

      expect(titles(result.items).sort()).toEqual(ORDINARY.map(([title]) => title).sort())
      expect(result.totalCount).toBe(ORDINARY.length)
    })

    it('leaves tasks in an unfiltered list', async () => {
      const result = await ideas.listByBoard(boardFilter() as never)

      expect(titles(result.items)).toEqual(expect.arrayContaining(['Task early', 'Task late']))
      expect(result.totalCount).toBe(ORDINARY.length + TASKS.length)
    })
  })

  describe('the priority search', () => {
    it.each([
      ['critical', ['Alpha']],
      ['low', ['Delta']],
    ] as const)(
      'matches the priority of an idea but not the placeholder on a task: %s',
      async (term, expected) => {
        const board = await ideas.listByBoard(boardFilter({ search: term }) as never)
        const org = await ideas.listByOrganization(orgFilter({ search: term }) as never)

        expect(titles(board.items)).toEqual([...expected])
        expect(titles(org.items)).toEqual([...expected])
      },
    )

    it('still finds a task by its title', async () => {
      const result = await ideas.listByBoard(boardFilter({ search: 'Task late' }) as never)

      expect(titles(result.items)).toEqual(['Task late'])
    })
  })

  describe('the priority sort', () => {
    it.each(['asc', 'desc'] as const)(
      'puts tasks last on the board list, %s, and orders the others as before',
      async (direction) => {
        const result = await ideas.listByBoard(
          boardFilter({ sortBy: 'priority', sortDirection: direction }) as never,
        )

        expect(titles(result.items)).toEqual(expectedByPriority(direction))
      },
    )

    it.each(['asc', 'desc'] as const)(
      'puts tasks last on the organization list, %s, and orders the others as before',
      async (direction) => {
        const result = await ideas.listByOrganization(
          orgFilter({ sortBy: 'priority', sortDirection: direction }) as never,
        )

        expect(titles(result.items)).toEqual(expectedByPriority(direction))
      },
    )

    it('sorts by priority case-insensitively, as the other keys do', async () => {
      const result = await ideas.listByBoard(
        boardFilter({ sortBy: ' PRIORITY ', sortDirection: 'desc' }) as never,
      )

      expect(titles(result.items)).toEqual(expectedByPriority('desc'))
    })

    it('keeps the first page honest: a page of two is the two highest ideas, not a task', async () => {
      const result = await ideas.listByBoard(
        boardFilter({
          sortBy: 'priority',
          sortDirection: 'desc',
          page: { page: 1, pageSize: 2 },
        }) as never,
      )

      expect(titles(result.items)).toEqual(['Alpha', 'Bravo'])
      expect(result.totalCount).toBe(ORDINARY.length + TASKS.length)
    })

    it('does not move tasks to the end when sorting by another key', async () => {
      const result = await ideas.listByBoard(
        boardFilter({ sortBy: 'createdAt', sortDirection: 'asc' }) as never,
      )

      expect(titles(result.items)[0]).toBe('Task early')
    })
  })

  describe('the pull picker', () => {
    const candidates = (search: string) =>
      boards.listPullCandidates({
        organizationId,
        source: 'boards',
        excludeBoardId: null,
        visibleBoardIds: null,
        search,
        tags: [],
        authorUserId: null,
        currentUserId: adminId,
        page: { page: 1, pageSize: 50 },
      })

    // A task is never a pull candidate (decided 2026-10-16), so only the idea is offered.
    it('leaves a task out and shows the stored priority for an idea', async () => {
      const task = await candidates('Task early')
      const idea = await candidates('Alpha')

      expect(task.items).toHaveLength(0)
      expect(idea.items).toHaveLength(1)
      expect(idea.items[0]?.priority).toBe('Critical')
    })
  })
})
