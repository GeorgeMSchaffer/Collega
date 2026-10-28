// Live-database QA for the work board sprint header and chip backend (SPEC/contracts/sprints.md
// "Work board sprint header", SPEC/contracts/ideas.md `sprintId` and `sprint`, decision 2026-10-19):
// the real IdeaService and SprintService over the Prisma repositories. What the unit suites fake is
// proved here: the board list's `sprintId` filter (GUID, `none`, anything else), board scoping, the
// Discovery-only list against a legacy Delivery item in a board sprint, the `sprint` object on
// every card read, `ideaCount` as distinct parent ideas, and who may put an item in a board sprint.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.
// Each call builds FRESH services, as a request does: the unit of work is a command buffer.

import { randomUUID } from 'node:crypto'
import {
  type CurrentUserContext,
  ForbiddenError,
  UnprocessableError,
} from '@collega/application/common'
import { type IdeaListQuery, IdeaService } from '@collega/application/ideas'
import { SprintService } from '@collega/application/sprints'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaAuditEventWriter } from '../src/repositories/audit-event.repository.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { IdeaCommentsLookupRepository } from '../src/repositories/comment.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { IdeaClassificationRepository } from '../src/repositories/idea-classification.repository.js'
import { PrismaIdeaDependencyRepository } from '../src/repositories/idea-dependency.repository.js'
import { PrismaIdeaFieldValuesRepository } from '../src/repositories/idea-field-values.repository.js'
import { PrismaIdeaFollowerRepository } from '../src/repositories/idea-follower.repository.js'
import { PrismaIdeaUpvoteRepository } from '../src/repositories/idea-upvote.repository.js'
import { PrismaIssueTaskRepository } from '../src/repositories/issue-task.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-10-15T09:00:00.000Z')
const NOW = new Date('2026-10-16T09:00:00.000Z')
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

const LIST: IdeaListQuery = {
  page: null,
  pageSize: 100,
  search: null,
  statusIds: [],
  tags: [],
  priorities: [],
  dueBefore: null,
  sortBy: 'title',
  sortDirection: 'asc',
}

describe.skipIf(!DATABASE_URL)('Board sprint header and chip against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const orgId = randomUUID()
  const adminId = randomUUID()
  const memberId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [OPEN, DONE] = [randomUUID(), randomUUID()] as const
  const boardA = randomUUID()
  const boardB = randomUUID()
  const sprintA = randomUUID()
  const sprintAEmpty = randomUUID()
  const sprintAStandalone = randomUUID()
  const sprintB = randomUUID()
  const sprintLegacy = randomUUID()
  const stamps = { created_at_utc: AT, updated_at_utc: AT }
  const ids: Record<string, string> = {}
  const idOf = (key: string): string => {
    const id = ids[key]
    if (!id) throw new Error(`no fixture idea ${key}`)
    return id
  }
  let itemNumber = 0

  const as = (role: Role, userId: string): CurrentUserContext => ({
    isAuthenticated: true,
    userId,
    organizationId: role === Role.SiteAdmin ? null : orgId,
    role,
    isImpersonating: false,
    realUserId: userId,
  })
  const admin = () => as(Role.OrgAdmin, adminId)

  function services(currentUser: CurrentUserContext = admin()) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    const sprints = new PrismaSprintRepository(prisma, unitOfWork)
    const audit = new PrismaAuditEventWriter(prisma)
    const clock = { now: () => NOW }
    return {
      ideaService: new IdeaService(
        ideas,
        boards,
        new PrismaUserRepository(prisma, unitOfWork),
        new PrismaTagRepository(prisma),
        new IdeaCommentsLookupRepository(prisma),
        new IdeaClassificationRepository(prisma),
        new PrismaIdeaFieldValuesRepository(prisma),
        new PrismaIdeaUpvoteRepository(prisma, unitOfWork),
        sprints,
        new PrismaIssueTaskRepository(prisma, unitOfWork),
        { notify: async () => {} },
        new PrismaIdeaFollowerRepository(prisma, unitOfWork),
        new PrismaIdeaDependencyRepository(prisma, unitOfWork),
        unitOfWork,
        audit,
        currentUser,
        clock,
        { nextInt: () => 0 },
        boards,
      ),
      sprintService: new SprintService(
        sprints,
        ideas,
        new PrismaUserRepository(prisma, unitOfWork),
        unitOfWork,
        audit,
        currentUser,
        clock,
        boards,
        boards,
      ),
    }
  }

  async function newIdea(
    key: string,
    board: string | null,
    options: {
      title?: string
      sprint?: string
      parent?: string
      deleted?: boolean
      delivery?: boolean
    } = {},
  ): Promise<void> {
    const id = randomUUID()
    ids[key] = id
    await prisma.ideas.create({
      data: {
        id,
        organization_id: orgId,
        board_id: board,
        item_number: board ? ++itemNumber : null,
        status_id: OPEN,
        sprint_id: options.sprint ?? null,
        parent_idea_id: options.parent ?? null,
        title: options.title ?? key,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: options.deleted ?? false,
        phase: options.delivery ? 'Delivery' : 'Discovery',
        delivery_status: options.delivery ? 'Development' : null,
        effort: options.delivery ? 'Medium' : null,
        ...stamps,
      },
    })
  }

  const titles = async (boardId: string, sprintId?: string | null, noSprint = false) =>
    (
      await services().ideaService.listByBoard(boardId, {
        ...LIST,
        ...(sprintId === undefined ? {} : { sprintId }),
        ...(noSprint ? { noSprint: true } : {}),
      })
    ).items
      .map((i) => i.title)
      .sort()
  const sprintOf = async (key: string) =>
    (await prisma.ideas.findUniqueOrThrow({ where: { id: idOf(key) } })).sprint_id

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: orgId,
        title: `probe-org-${marker}`,
        description: 'Board sprint header probe.',
        invite_code: `probe-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    for (const [id, role] of [
      [adminId, 'OrgAdmin'],
      [memberId, 'User'],
    ] as const) {
      await prisma.users.create({
        data: {
          id,
          organization_id: orgId,
          first_name: 'Probe',
          last_name: role,
          email: `probe-${role}-${marker}@example.test`,
          normalized_email: `PROBE-${role}-${marker}@EXAMPLE.TEST`.toUpperCase(),
          password_hash: 'not-a-real-hash',
          role,
          status: 'Active',
          must_change_password: false,
          failed_login_count: 0,
          security_stamp: marker,
          ...stamps,
        },
      })
    }
    for (const [order, id] of [OPEN, DONE].entries()) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: orgId,
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
        organization_id: orgId,
        name: 'Probe type',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.business_impacts.create({
      data: {
        id: impactId,
        organization_id: orgId,
        name: 'Probe impact',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    for (const id of [boardA, boardB]) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: orgId,
          name: `Board ${id.slice(0, 8)}`,
          allow_user_status_update: true,
          sprints_enabled: true,
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
    for (const [id, board, name] of [
      [sprintA, boardA, 'Sprint A'],
      [sprintAEmpty, boardA, 'Sprint A empty'],
      [sprintAStandalone, boardA, 'Sprint A standalone'],
      [sprintB, boardB, 'Sprint B'],
      [sprintLegacy, null, 'Legacy sprint'],
    ] as const) {
      await prisma.sprints.create({
        data: {
          id,
          organization_id: orgId,
          board_id: board,
          name,
          start_date: new Date('2026-10-05T00:00:00.000Z'),
          end_date: new Date('2026-10-18T00:00:00.000Z'),
          state: 'Active',
          is_deleted: false,
          ...stamps,
        },
      })
    }

    // Board A: two parents with tasks in the sprint, a deleted task, a standalone card and a legacy
    // Delivery item sharing sprint A; backlog items; a second sprint holding only a standalone card.
    await newIdea('P1', boardA)
    await newIdea('P2', boardA)
    await newIdea('P3', boardA)
    await newIdea('T1a', boardA, { sprint: sprintA, parent: idOf('P1') })
    await newIdea('T1b', boardA, { sprint: sprintA, parent: idOf('P1') })
    await newIdea('T2', boardA, { sprint: sprintA, parent: idOf('P2') })
    await newIdea('Tdel', boardA, { sprint: sprintA, parent: idOf('P3'), deleted: true })
    await newIdea('Tfree', boardA, { parent: idOf('P1') })
    await newIdea('Tp3', boardA, { parent: idOf('P3') })
    await newIdea('C1', boardA, { sprint: sprintA })
    await newIdea('D1', boardA, { sprint: sprintA, delivery: true })
    await newIdea('D2', boardA, { delivery: true })
    await newIdea('B1', boardA)
    await newIdea('C2', boardA, { sprint: sprintAStandalone })
    // Board B and the legacy sprint.
    await newIdea('X1', boardB, { sprint: sprintB })
    await newIdea('X2', boardB)
    await newIdea('L1', null, { sprint: sprintLegacy, delivery: true })
    await newIdea('L2', null, { delivery: true })
  })

  afterAll(async () => {
    const mine = { organization_id: orgId }
    await prisma.audit_events.deleteMany({ where: mine })
    await prisma.ideas.deleteMany({ where: { ...mine, parent_idea_id: { not: null } } })
    await prisma.ideas.deleteMany({ where: mine })
    await prisma.sprints.deleteMany({ where: mine })
    await prisma.board_swimlanes.deleteMany({ where: { boards: mine } })
    await prisma.boards.deleteMany({ where: mine })
    await prisma.idea_types.deleteMany({ where: mine })
    await prisma.business_impacts.deleteMany({ where: mine })
    await prisma.statuses.deleteMany({ where: mine })
    await prisma.users.deleteMany({ where: mine })
    await prisma.organizations.deleteMany({ where: { id: orgId } })
    await prisma.$disconnect()
  })

  describe('GET /boards/{boardId}/ideas sprintId', () => {
    it('returns every Discovery item of the board when no sprint filter is given', async () => {
      expect(await titles(boardA)).toEqual([
        'B1',
        'C1',
        'C2',
        'P1',
        'P2',
        'P3',
        'T1a',
        'T1b',
        'T2',
        'Tfree',
        'Tp3',
      ])
    })

    it('with a sprint GUID returns only that sprint items', async () => {
      expect(await titles(boardA, sprintA)).toEqual(['C1', 'T1a', 'T1b', 'T2'])
      expect(await titles(boardA, sprintAStandalone)).toEqual(['C2'])
      expect(await titles(boardB, sprintB)).toEqual(['X1'])
    })

    it('with a sprint that holds nothing returns an empty page', async () => {
      const page = await services().ideaService.listByBoard(boardA, {
        ...LIST,
        sprintId: sprintAEmpty,
      })

      expect(page.items).toEqual([])
      expect(page.totalCount).toBe(0)
    })

    it('with noSprint (the literal none) returns only items in no sprint, the board backlog', async () => {
      expect(await titles(boardA, null, true)).toEqual(['B1', 'P1', 'P2', 'P3', 'Tfree', 'Tp3'])
      expect(await titles(boardB, null, true)).toEqual(['X2'])
    })

    it('excludes a sprint item from the backlog and a backlog item from a sprint', async () => {
      expect(await titles(boardA, null, true)).not.toContain('T1a')
      expect(await titles(boardA, sprintA)).not.toContain('B1')
    })

    it('matches nothing for another board sprint id, whichever board is asked', async () => {
      expect(await titles(boardA, sprintB)).toEqual([])
      expect(await titles(boardB, sprintA)).toEqual([])
    })

    it('matches nothing for a legacy org-wide sprint id on a board list', async () => {
      expect(await titles(boardA, sprintLegacy)).toEqual([])
    })

    it('matches nothing for an unknown sprint GUID or the empty GUID (what any other value becomes)', async () => {
      expect(await titles(boardA, randomUUID())).toEqual([])
      expect(await titles(boardA, EMPTY_GUID)).toEqual([])
    })

    it('keeps the board list Discovery-only: a legacy Delivery item in a board sprint is absent', async () => {
      const inSprint = await titles(boardA, sprintA)
      const backlog = await titles(boardA, null, true)

      expect(inSprint).not.toContain('D1')
      expect(backlog).not.toContain('D2')
    })

    it('counts that Delivery item in the sprint issueCount and lists it on the sprint detail read', async () => {
      const { ideaService, sprintService } = services()

      const sprint = await sprintService.get(orgId, sprintA)
      const detail = await ideaService.listDelivery(orgId, {
        sprintId: sprintA,
        deliveryStatus: null,
      })

      // T1a, T1b, T2, C1, D1: the deleted task is out.
      expect(sprint.issueCount).toBe(5)
      expect(detail.map((c) => c.title).sort()).toEqual(['C1', 'D1', 'T1a', 'T1b', 'T2'])
    })

    it('combines with the paging and the other filters instead of replacing them', async () => {
      const page = await services().ideaService.listByBoard(boardA, {
        ...LIST,
        sprintId: sprintA,
        pageSize: 2,
      })

      expect(page.totalCount).toBe(4)
      expect(page.items).toHaveLength(2)
    })
  })

  describe('the sprint object on card reads', () => {
    it('is {sprintId, name, startDate, endDate} on a board list item in a sprint, null otherwise', async () => {
      const page = await services().ideaService.listByBoard(boardA, LIST)

      const byTitle = new Map(page.items.map((i) => [i.title, i.sprint] as const))
      expect(byTitle.get('T1a')).toEqual({
        sprintId: sprintA,
        name: 'Sprint A',
        startDate: '2026-10-05',
        endDate: '2026-10-18',
      })
      expect(byTitle.get('C2')?.sprintId).toBe(sprintAStandalone)
      expect(byTitle.get('B1')).toBeNull()
      expect(byTitle.get('P1')).toBeNull()
    })

    it('is on the organization list for an item of a board sprint, of a legacy sprint, and null for none', async () => {
      const page = await services().ideaService.listByOrganization(orgId, {
        page: null,
        pageSize: 100,
        search: null,
        scope: null,
        sortBy: null,
        sortDirection: null,
        fieldFilters: null,
        boardIds: [],
        includeNoBoard: false,
        statusIds: [],
        priorities: [],
        tags: [],
        user: null,
        phase: null,
      })

      const byTitle = new Map(page.items.map((i) => [i.title, i.sprint] as const))
      expect(byTitle.get('T1a')?.sprintId).toBe(sprintA)
      expect(byTitle.get('X1')?.sprintId).toBe(sprintB)
      expect(byTitle.get('L1')?.sprintId).toBe(sprintLegacy)
      expect(byTitle.get('B1')).toBeNull()
      expect(byTitle.get('L2')).toBeNull()
    })

    it('is on the delivery cards, unchanged in shape', async () => {
      const cards = await services().ideaService.listDelivery(orgId, {
        sprintId: sprintLegacy,
        deliveryStatus: null,
      })

      expect(cards).toHaveLength(1)
      expect(cards[0]?.sprint).toEqual({
        sprintId: sprintLegacy,
        name: 'Legacy sprint',
        startDate: '2026-10-05',
        endDate: '2026-10-18',
      })
      const backlog = await services().ideaService.listDelivery(orgId, {
        sprintId: null,
        deliveryStatus: null,
      })
      expect(backlog.find((c) => c.title === 'L2')?.sprint).toBeNull()
    })
  })

  describe('ideaCount on the sprint item', () => {
    it('counts distinct parent ideas among the task items, once however many tasks a parent has', async () => {
      const { sprintService } = services()

      const items = await sprintService.listForBoard(boardA, null)
      const a = items.find((s) => s.sprintId === sprintA)

      // T1a and T1b share P1, T2 has P2; C1 and D1 have no parent; Tdel (P3) is soft-deleted.
      expect(a).toMatchObject({ issueCount: 5, ideaCount: 2 })
    })

    it('is 0 for a sprint with no items and for one holding only standalone cards', async () => {
      const items = await services().sprintService.listForBoard(boardA, null)

      expect(items.find((s) => s.sprintId === sprintAEmpty)).toMatchObject({
        issueCount: 0,
        ideaCount: 0,
      })
      expect(items.find((s) => s.sprintId === sprintAStandalone)).toMatchObject({
        issueCount: 1,
        ideaCount: 0,
      })
    })

    it('does not count a soft-deleted task, and stops counting a parent whose only task is deleted', async () => {
      // P3 has only the deleted task Tdel in sprint A.
      const a = await services().sprintService.get(orgId, sprintA)

      expect(a.ideaCount).toBe(2)
    })

    it('is 0 for a legacy org-wide sprint of standalone Issues', async () => {
      const legacy = await services().sprintService.get(orgId, sprintLegacy)

      expect(legacy).toMatchObject({ issueCount: 1, ideaCount: 0 })
    })

    it('is 0 for a sprint with no boardId even when a row with a parent was written into it', async () => {
      await newIdea('Lt', boardA, { sprint: sprintLegacy, parent: idOf('P1'), delivery: true })

      const legacy = await services().sprintService.get(orgId, sprintLegacy)
      await prisma.ideas.delete({ where: { id: idOf('Lt') } })

      expect(legacy.ideaCount).toBe(0)
    })

    it('is on the organization list and the single read alike', async () => {
      const { sprintService } = services()

      const list = await sprintService.list(orgId, null)

      expect(list.find((s) => s.sprintId === sprintA)?.ideaCount).toBe(2)
      expect((await sprintService.get(orgId, sprintA)).ideaCount).toBe(2)
    })

    it('follows a task of a new parent being moved into the sprint and out again', async () => {
      await services().ideaService.assignToSprint(idOf('Tp3'), { sprintId: sprintA })
      const inSprint = await services().sprintService.get(orgId, sprintA)
      expect(inSprint).toMatchObject({ issueCount: 6, ideaCount: 3 })

      await services().ideaService.assignToSprint(idOf('Tp3'), { sprintId: null })
      const out = await services().sprintService.get(orgId, sprintA)
      expect(out).toMatchObject({ issueCount: 5, ideaCount: 2 })
    })

    it('does not count a second task of a parent already counted', async () => {
      await services().ideaService.assignToSprint(idOf('Tfree'), { sprintId: sprintA })
      const withTfree = await services().sprintService.get(orgId, sprintA)
      await services().ideaService.assignToSprint(idOf('Tfree'), { sprintId: null })

      // Tfree is a third task of P1, already counted through T1a and T1b.
      expect(withTfree).toMatchObject({ issueCount: 6, ideaCount: 2 })
    })
  })

  describe('PUT /ideas/{ideaId}/sprint into a board sprint', () => {
    it('lets an Org Admin put a task of the board in its sprint, then take it out', async () => {
      await services().ideaService.assignToSprint(idOf('Tfree'), { sprintId: sprintA })
      expect(await sprintOf('Tfree')).toBe(sprintA)

      await services().ideaService.assignToSprint(idOf('Tfree'), { sprintId: null })
      expect(await sprintOf('Tfree')).toBeNull()
    })

    it('takes a Discovery task into the sprint and moves a Delivery item of the board in too', async () => {
      await services().ideaService.assignToSprint(idOf('D2'), { sprintId: sprintA })
      expect(await sprintOf('D2')).toBe(sprintA)

      await services().ideaService.assignToSprint(idOf('D2'), { sprintId: null })
      expect(await sprintOf('D2')).toBeNull()
    })

    it('refuses a task going into another board sprint with sprintItemOnOtherBoard, leaving it unchanged', async () => {
      const error = await services()
        .ideaService.assignToSprint(idOf('Tfree'), { sprintId: sprintB })
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
      expect(await sprintOf('Tfree')).toBeNull()
    })

    it('refuses an item of another board going into this board sprint', async () => {
      const error = await services()
        .ideaService.assignToSprint(idOf('X2'), { sprintId: sprintA })
        .catch((e: unknown) => e)

      expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
      expect(await sprintOf('X2')).toBeNull()
    })

    it('refuses a Member, and a direct Site Admin, leaving the item unchanged', async () => {
      for (const user of [as(Role.User, memberId), as(Role.SiteAdmin, randomUUID())]) {
        const error = await services(user)
          .ideaService.assignToSprint(idOf('Tfree'), { sprintId: sprintA })
          .catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ForbiddenError)
      }
      expect(await sprintOf('Tfree')).toBeNull()
    })
  })
})
