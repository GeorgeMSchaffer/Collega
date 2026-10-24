// Live-database test for the backlog list filters (SPEC/contracts/ideas.md, TB-1 / TB-8): `hideFinal`
// and `sprintId` on the board list and the organization list. `hideFinal` is a raw NOT EXISTS over
// board_swimlanes, so only a real Postgres can say whether it reads a card's OWN board's final lane.
//
// The fixture's point: the status "Done" is a FINAL lane on the Work board and an ordinary lane on
// the Other board. A join on status alone would hide the Other board's card; the contract says it
// stays.
//
// Skipped unless `DATABASE_URL` is set. Builds and removes its own organization. Run with:
//   DATABASE_URL=postgresql://collega:<password>@127.0.0.1:5432/<scratch db> pnpm --filter @collega/infrastructure test -- idea-list-backlog-filters

import { randomUUID } from 'node:crypto'
import type { IdeaListFilter, OrganizationIdeaListFilter } from '@collega/application/ideas'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const STAMP = new Date('2026-09-20T00:00:00.000Z')

describe.skipIf(!DATABASE_URL)('backlog list filters against a live database', () => {
  const prisma = new PrismaClient()
  const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
  const organizationId = randomUUID()
  const userId = randomUUID()
  const workBoard = randomUUID()
  const otherBoard = randomUUID()
  const sprintId = randomUUID()
  const status = { todo: randomUUID(), doing: randomUUID(), done: randomUUID() }
  const typeId = randomUUID()
  const impactId = randomUUID()
  const keyOf = new Map<string, string>()

  const keys = (items: readonly { id: string }[]) =>
    items.map((i) => keyOf.get(i.id) ?? i.id).sort()

  const boardFilter = (overrides: Partial<IdeaListFilter> = {}) =>
    ({
      boardId: workBoard,
      page: { page: 1, pageSize: 50 },
      search: null,
      searchTextFieldIds: [],
      searchCreatedOnDate: null,
      statusIds: [],
      tags: [],
      priorities: [],
      dueBefore: null,
      phase: null,
      sortBy: null,
      sortDirection: 'asc',
      ...overrides,
    }) as IdeaListFilter

  const orgFilter = (overrides: Partial<OrganizationIdeaListFilter> = {}) =>
    ({
      organizationId,
      createdByUserId: null,
      assignedToUserId: null,
      page: { page: 1, pageSize: 50 },
      search: null,
      sortBy: null,
      sortDirection: 'asc',
      fieldFilters: [],
      searchTextFieldIds: [],
      boardIds: [],
      statusIds: [],
      priorities: [],
      tags: [],
      associatedUserId: null,
      searchCreatedOnDate: null,
      phase: null,
      ...overrides,
    }) as OrganizationIdeaListFilter

  async function addIdea(
    key: string,
    board: string,
    statusId: string,
    extra: { sprint?: string; assigned?: boolean; deleted?: boolean } = {},
  ) {
    const id = randomUUID()
    keyOf.set(id, key)
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: board,
        status_id: statusId,
        title: key,
        description: null,
        problem: key,
        proposed_solutions: [key],
        impact_rationale: key,
        priority: 'Medium',
        idea_type_id: typeId,
        business_impact_id: impactId,
        author_user_id: userId,
        sprint_id: extra.sprint ?? null,
        is_deleted: extra.deleted ?? false,
        created_at_utc: STAMP,
        updated_at_utc: STAMP,
        idea_assignees: {
          create: extra.assigned ? [{ id: randomUUID(), user_id: userId }] : [],
        },
      },
    })
  }

  beforeAll(async () => {
    const stamps = { created_at_utc: STAMP, updated_at_utc: STAMP }
    const marker = organizationId.slice(0, 8)
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `backlog-probe-${marker}`,
        description: 'Backlog filter probe.',
        invite_code: `bl-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    await prisma.users.create({
      data: {
        id: userId,
        organization_id: organizationId,
        first_name: 'Bea',
        last_name: 'Probe',
        email: `bl-${marker}@example.test`,
        normalized_email: `BL-${marker}@EXAMPLE.TEST`,
        password_hash: 'not-a-real-hash',
        role: 'User',
        status: 'Active',
        must_change_password: false,
        failed_login_count: 0,
        security_stamp: marker,
        ...stamps,
      },
    })
    for (const [i, [name, id]] of Object.entries(status).entries()) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: organizationId,
          name: `${name}-${marker}`,
          color: '#123456',
          sort_order: i,
          is_deleted: false,
          ...stamps,
        },
      })
    }
    await prisma.idea_types.create({
      data: {
        id: typeId,
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
    const lane = (statusId: string, order: number, isFinal: boolean) => ({
      id: randomUUID(),
      status_id: statusId,
      display_order: order,
      is_final: isFinal,
    })
    await prisma.boards.create({
      data: {
        id: workBoard,
        organization_id: organizationId,
        name: 'Work',
        allow_user_status_update: true,
        ...stamps,
        board_swimlanes: {
          create: [
            lane(status.todo, 0, false),
            lane(status.doing, 1, false),
            lane(status.done, 2, true),
          ],
        },
      },
    })
    await prisma.boards.create({
      data: {
        id: otherBoard,
        organization_id: organizationId,
        name: 'Other',
        allow_user_status_update: true,
        ...stamps,
        board_swimlanes: {
          create: [lane(status.todo, 0, false), lane(status.done, 1, false)],
        },
      },
    })
    await prisma.sprints.create({
      data: {
        id: sprintId,
        organization_id: organizationId,
        name: 'Sprint 1',
        start_date: new Date('2026-09-21T00:00:00.000Z'),
        end_date: new Date('2026-10-04T00:00:00.000Z'),
        state: 'Active',
        is_deleted: false,
        board_id: workBoard,
        ...stamps,
      },
    })

    await addIdea('todo', workBoard, status.todo, { assigned: true })
    await addIdea('doing-in-sprint', workBoard, status.doing, { sprint: sprintId })
    await addIdea('done', workBoard, status.done, { assigned: true })
    await addIdea('done-in-sprint', workBoard, status.done, { sprint: sprintId, assigned: true })
    await addIdea('deleted-done', workBoard, status.done, { deleted: true })
    // "Done" is not final on this board: the card stays.
    await addIdea('other-done', otherBoard, status.done, { assigned: true })
    await addIdea('other-todo', otherBoard, status.todo)
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.sprints.deleteMany({ where: { organization_id: organizationId } })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  describe('board list hideFinal', () => {
    it('lists everything when hideFinal is absent or false', async () => {
      const all = ['doing-in-sprint', 'done', 'done-in-sprint', 'todo']
      expect(keys((await ideas.listByBoard(boardFilter())).items)).toEqual(all)
      expect(keys((await ideas.listByBoard(boardFilter({ hideFinal: false }))).items)).toEqual(all)
    })

    it('leaves out the cards in a final lane of the board', async () => {
      const page = await ideas.listByBoard(boardFilter({ hideFinal: true }))

      expect(keys(page.items)).toEqual(['doing-in-sprint', 'todo'])
      expect(page.totalCount).toBe(2)
    })

    it('keeps a card whose status is final only on a different board', async () => {
      const page = await ideas.listByBoard(boardFilter({ boardId: otherBoard, hideFinal: true }))

      expect(keys(page.items)).toEqual(['other-done', 'other-todo'])
    })

    it('composes with a sprint and with the backlog filter', async () => {
      const inSprint = await ideas.listByBoard(boardFilter({ hideFinal: true, sprintId }))
      const backlog = await ideas.listByBoard(boardFilter({ hideFinal: true, noSprint: true }))

      expect(keys(inSprint.items)).toEqual(['doing-in-sprint'])
      expect(keys(backlog.items)).toEqual(['todo'])
    })

    it('without hideFinal, the backlog filter still shows a finished card', async () => {
      const backlog = await ideas.listByBoard(boardFilter({ noSprint: true }))

      expect(keys(backlog.items)).toEqual(['done', 'todo'])
    })
  })

  describe('organization list sprintId and hideFinal', () => {
    it('lists every live card when neither is given', async () => {
      const page = await ideas.listByOrganization(orgFilter())

      expect(keys(page.items)).toEqual([
        'doing-in-sprint',
        'done',
        'done-in-sprint',
        'other-done',
        'other-todo',
        'todo',
      ])
    })

    it('hideFinal judges each card by its own board', async () => {
      const page = await ideas.listByOrganization(orgFilter({ hideFinal: true }))

      expect(keys(page.items)).toEqual(['doing-in-sprint', 'other-done', 'other-todo', 'todo'])
    })

    it('sprintId narrows to that sprint, and none to unassigned cards', async () => {
      const inSprint = await ideas.listByOrganization(orgFilter({ sprintId }))
      const none = await ideas.listByOrganization(orgFilter({ noSprint: true }))

      expect(keys(inSprint.items)).toEqual(['doing-in-sprint', 'done-in-sprint'])
      expect(keys(none.items)).toEqual(['done', 'other-done', 'other-todo', 'todo'])
    })

    it('composes sprintId none and hideFinal with boardId', async () => {
      const work = await ideas.listByOrganization(
        orgFilter({ boardIds: [workBoard], noSprint: true, hideFinal: true }),
      )
      const other = await ideas.listByOrganization(
        orgFilter({ boardIds: [otherBoard], noSprint: true, hideFinal: true }),
      )

      expect(keys(work.items)).toEqual(['todo'])
      expect(keys(other.items)).toEqual(['other-done', 'other-todo'])
    })

    it('composes with scope=assigned (my tasks)', async () => {
      const mine = await ideas.listByOrganization(orgFilter({ assignedToUserId: userId }))
      const mineOpen = await ideas.listByOrganization(
        orgFilter({ assignedToUserId: userId, hideFinal: true }),
      )
      const mineBacklog = await ideas.listByOrganization(
        orgFilter({
          assignedToUserId: userId,
          hideFinal: true,
          noSprint: true,
          boardIds: [workBoard],
        }),
      )

      expect(keys(mine.items)).toEqual(['done', 'done-in-sprint', 'other-done', 'todo'])
      expect(keys(mineOpen.items)).toEqual(['other-done', 'todo'])
      expect(keys(mineBacklog.items)).toEqual(['todo'])
    })

    it('an unknown sprint id matches nothing', async () => {
      const page = await ideas.listByOrganization(orgFilter({ sprintId: randomUUID() }))

      expect(page.items).toEqual([])
      expect(page.totalCount).toBe(0)
    })
  })
})
