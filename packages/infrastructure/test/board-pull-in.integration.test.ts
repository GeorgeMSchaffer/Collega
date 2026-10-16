// Live-database QA for pulling items onto a board and for ideas with no board
// (SPEC/20-feature-board-pull-in.md): `reassignIdeas` (placement, what a pull clears and keeps,
// atomicity when an item vanishes between the picker and the save), `listPullCandidates` (the three
// sources, exclusions, filters, order, paging) and the null-board reads (organization list, board
// counts, tag usage, notification inbox).
//
// Skipped unless `DATABASE_URL` is set, like the other `*.integration.test.ts` files. It builds its
// own organizations and removes them afterwards, so point it at a scratch database.

import { randomUUID } from 'node:crypto'
import type { AutoCreateTaskPort } from '@collega/application/boards'
import { BoardService } from '@collega/application/boards'
import type { CurrentUserContext } from '@collega/application/common'
import type { IdeaRepository, OrganizationIdeaListFilter } from '@collega/application/ideas'
import { Role } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'
import { PrismaNotificationEventRepository } from '../src/repositories/notification-event.repository.js'
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-01T09:00:00.000Z')
const SAVED = new Date('2026-10-15T12:00:00.000Z')
const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00.000Z`)

describe.skipIf(!DATABASE_URL)('Board pull-in, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const orgA = randomUUID()
  const orgB = randomUUID()
  const adminId = randomUUID()
  const memberId = randomUUID()
  const otherAuthorId = randomUUID()
  const foreignUserId = randomUUID()
  const typeA = randomUUID()
  const impactA = randomUUID()
  const typeB = randomUUID()
  const impactB = randomUUID()
  const [S1, S2, S3, SB] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()] as const
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }

  const lanes = [
    { statusId: S1, order: 0 },
    { statusId: S2, order: 1 },
  ]

  function userContext(userId: string, role: Role, organizationId = orgA): CurrentUserContext {
    return {
      isAuthenticated: true,
      userId,
      organizationId,
      role,
      isImpersonating: false,
      realUserId: userId,
    }
  }

  function services(
    currentUser = userContext(adminId, Role.OrgAdmin),
    afterRead?: (ideaId: string) => Promise<void>,
  ) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    const reading = {
      getById: async (ideaId: string, includeDeleted?: boolean) => {
        const found = await ideas.getById(ideaId, includeDeleted)
        await afterRead?.(ideaId)
        return found
      },
    } as unknown as IdeaRepository
    const boardService = new BoardService(
      boards,
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      { write: async () => {} },
      currentUser,
      { now: () => SAVED },
      afterRead ? reading : ideas,
      {} as AutoCreateTaskPort,
    )
    return { boards, ideas, boardService }
  }

  async function newBoard(name = `QA ${randomUUID()}`, organizationId = orgA): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name,
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

  type IdeaSeed = {
    boardId?: string | null
    statusId?: string
    title?: string
    authorId?: string
    organizationId?: string
    phase?: 'Discovery' | 'Delivery'
    sprintId?: string | null
    parentId?: string | null
    isDeleted?: boolean
    createdAt?: Date
    effort?: 'Low' | 'Medium' | 'High' | null
    itemNumber?: number | null
  }

  async function newIdea(seed: IdeaSeed = {}): Promise<string> {
    const id = randomUUID()
    const organizationId = seed.organizationId ?? orgA
    const delivery = seed.phase === 'Delivery'
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: seed.boardId === undefined ? null : seed.boardId,
        item_number: seed.itemNumber ?? null,
        status_id: seed.statusId ?? S3,
        title: seed.title ?? `QA idea ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: organizationId === orgA ? typeA : typeB,
        business_impact_id: organizationId === orgA ? impactA : impactB,
        author_user_id: seed.authorId ?? memberId,
        is_deleted: seed.isDeleted ?? false,
        phase: seed.phase ?? 'Discovery',
        delivery_status: delivery ? 'Pending' : null,
        effort: delivery ? (seed.effort ?? 'High') : (seed.effort ?? null),
        promoted_at_utc: delivery ? at(5) : null,
        promoted_by_user_id: delivery ? adminId : null,
        upvote_count_at_promotion: delivery ? 4 : null,
        sprint_id: seed.sprintId ?? null,
        parent_idea_id: seed.parentId ?? null,
        created_at_utc: seed.createdAt ?? CREATED,
        updated_at_utc: seed.createdAt ?? CREATED,
      },
    })
    return id
  }

  async function newSprint(boardId: string | null): Promise<string> {
    const id = randomUUID()
    await prisma.sprints.create({
      data: {
        id,
        organization_id: orgA,
        board_id: boardId,
        name: `Sprint ${id.slice(0, 4)}`,
        start_date: new Date('2026-10-01T00:00:00.000Z'),
        end_date: new Date('2026-10-14T00:00:00.000Z'),
        state: 'Active' as never,
        is_deleted: false,
        ...stamps,
      },
    })
    return id
  }

  const row = (ideaId: string) => prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })

  async function refusal(promise: Promise<unknown>): Promise<string[]> {
    try {
      await promise
    } catch (error) {
      return (error as { failures?: { pullItemIds?: string[] } }).failures?.pullItemIds ?? []
    }
    throw new Error('expected the save to be refused')
  }

  beforeAll(async () => {
    for (const [organizationId, suffix] of [
      [orgA, 'a'],
      [orgB, 'b'],
    ] as const) {
      await prisma.organizations.create({
        data: {
          id: organizationId,
          title: `pull-in-qa-${suffix}-${marker}`,
          description: 'Pull-in QA probe.',
          invite_code: `pi-${suffix}-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
    }
    for (const [id, organizationId, role] of [
      [adminId, orgA, 'OrgAdmin'],
      [memberId, orgA, 'User'],
      [otherAuthorId, orgA, 'User'],
      [foreignUserId, orgB, 'User'],
    ] as const) {
      await prisma.users.create({
        data: {
          id,
          organization_id: organizationId,
          first_name: `First-${id.slice(0, 4)}`,
          last_name: 'Probe',
          email: `pi-${id}@example.test`,
          normalized_email: `PI-${id}@EXAMPLE.TEST`,
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
    for (const [id, organizationId, order] of [
      [S1, orgA, 0],
      [S2, orgA, 1],
      [S3, orgA, 2],
      [SB, orgB, 0],
    ] as const) {
      await prisma.statuses.create({
        data: {
          id,
          organization_id: organizationId,
          name: `Status ${order}`,
          color: '#123456',
          sort_order: order,
          is_deleted: false,
          ...stamps,
        },
      })
    }
    for (const [typeId, impactId, organizationId] of [
      [typeA, impactA, orgA],
      [typeB, impactB, orgB],
    ] as const) {
      await prisma.idea_types.create({
        data: {
          id: typeId,
          organization_id: organizationId,
          name: 'Type',
          sort_order: 0,
          is_deleted: false,
          ...stamps,
        },
      })
      await prisma.business_impacts.create({
        data: {
          id: impactId,
          organization_id: organizationId,
          name: 'Impact',
          color: '#123456',
          sort_order: 0,
          is_deleted: false,
          ...stamps,
        },
      })
    }
  })

  afterAll(async () => {
    const organizations = { in: [orgA, orgB] }
    await prisma.notification_events.deleteMany({ where: { organization_id: organizations } })
    await prisma.ideas.updateMany({
      where: { organization_id: organizations },
      data: { parent_idea_id: null, sprint_id: null },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: organizations } })
    await prisma.sprints.deleteMany({ where: { organization_id: organizations } })
    await prisma.tags.deleteMany({ where: { organization_id: organizations } })
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: organizations } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: organizations } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizations } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizations } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizations } })
    await prisma.users.deleteMany({ where: { organization_id: organizations } })
    await prisma.organizations.deleteMany({ where: { id: organizations } })
    await prisma.$disconnect()
  })

  describe('reassignIdeas: placement and effects', () => {
    it('files a pool idea, an idea from another board and a backlog Issue in one create, by rule 13', async () => {
      const other = await newBoard()
      const pooled = await newIdea({ statusId: S2 }) // kept: the board has a lane for S2
      const moved = await newIdea({ boardId: other, statusId: S3 }) // no lane: leftmost, S1
      const issue = await newIdea({ boardId: other, statusId: S2, phase: 'Delivery' })

      const created = await services().boardService.create(orgA, {
        name: 'Pulled',
        allowUserStatusUpdate: true,
        swimlanes: lanes,
        pullItemIds: [pooled, moved, issue],
      })

      expect(created.pulledItems?.map((p) => [p.ideaId, p.statusId]).sort()).toEqual(
        [
          [pooled, S2],
          [moved, S1],
          [issue, S2],
        ].sort(),
      )
      for (const [ideaId, statusId] of [
        [pooled, S2],
        [moved, S1],
        [issue, S2],
      ] as const) {
        const after = await row(ideaId)
        expect(after.board_id).toBe(created.boardId)
        expect(after.status_id).toBe(statusId)
        expect(after.updated_at_utc).toEqual(SAVED)
        expect(after.updated_by_user_id).toBe(adminId)
      }
    })

    it('returns an Issue to Discovery but keeps its effort, promotion snapshot and tasks', async () => {
      const issue = await newIdea({ phase: 'Delivery', effort: 'Medium', boardId: null })
      const taskId = randomUUID()
      await prisma.issue_tasks.create({
        data: {
          id: taskId,
          idea_id: issue,
          title: 'Keep me',
          state: 'NotStarted' as never,
          sort_order: 0,
          ...stamps,
        },
      })
      const target = await newBoard()

      await services().boardService.update(target, {
        name: 'Edited',
        allowUserStatusUpdate: true,
        swimlanes: lanes,
        pullItemIds: [issue],
      })

      const after = await row(issue)
      expect(after).toMatchObject({
        board_id: target,
        phase: 'Discovery',
        delivery_status: null,
        sprint_id: null,
        effort: 'Medium',
        promoted_by_user_id: adminId,
        upvote_count_at_promotion: 4,
      })
      expect(after.promoted_at_utc).toEqual(at(5))
      expect(await prisma.issue_tasks.count({ where: { idea_id: issue } })).toBe(1)
    })

    // A task cannot be pulled (decided 2026-10-16), so no pulled item has a parent to clear.
    it('clears a board sprint and both dependency directions, but leaves a legacy sprint', async () => {
      const source = await newBoard()
      const sourceSprint = await newSprint(source)
      const legacySprint = await newSprint(null)
      const leaving = await newIdea({ boardId: source, sprintId: sourceSprint })
      const legacy = await newIdea({ boardId: source, sprintId: legacySprint })
      const neighbour = await newIdea({ boardId: source })
      await prisma.idea_dependencies.createMany({
        data: [
          { blocked_idea_id: leaving, blocker_idea_id: neighbour, created_at_utc: CREATED },
          { blocked_idea_id: neighbour, blocker_idea_id: leaving, created_at_utc: CREATED },
        ],
      })
      const target = await newBoard()

      await services().boardService.update(target, {
        name: 'Cleared',
        allowUserStatusUpdate: true,
        swimlanes: lanes,
        pullItemIds: [leaving, legacy],
      })

      expect(await row(leaving)).toMatchObject({
        board_id: target,
        sprint_id: null,
      })
      expect(
        await prisma.idea_dependencies.count({
          where: { OR: [{ blocked_idea_id: leaving }, { blocker_idea_id: leaving }] },
        }),
      ).toBe(0)
      expect((await row(legacy)).sprint_id).toBe(legacySprint)
    })

    it("drops the old board's item number when the target board issues none", async () => {
      const source = await newBoard()
      const numbered = await newIdea({ boardId: source, itemNumber: 7 })
      const target = await newBoard()

      await services().boardService.update(target, {
        name: 'No prefix',
        allowUserStatusUpdate: true,
        swimlanes: lanes,
        pullItemIds: [numbered],
      })

      expect((await row(numbered)).item_number).toBeNull()
    })

    it('applies a lane removal and its ideaMoves before placing a pulled item, in one save', async () => {
      const board = await newBoard()
      const resident = await newIdea({ boardId: board, statusId: S2 })
      const pooled = await newIdea({ statusId: S2 })

      const updated = await services().boardService.update(board, {
        name: 'Lane removed',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: S1, order: 0 },
          { statusId: S3, order: 1 },
        ],
        ideaMoves: [{ fromStatusId: S2, toStatusId: S3 }],
        pullItemIds: [pooled],
      })

      expect((await row(resident)).status_id).toBe(S3)
      // S2 is no longer a lane, so the pooled idea falls to the leftmost lane.
      expect((await row(pooled)).status_id).toBe(S1)
      expect(updated.pulledItems).toEqual([{ ideaId: pooled, fromBoardId: null, statusId: S1 }])
    })
  })

  describe('reassignIdeas: atomicity', () => {
    const vanish: Record<string, (ideaId: string, other: string) => Promise<void>> = {
      'moved to another board': async (id, other) => {
        await prisma.ideas.update({ where: { id }, data: { board_id: other } })
      },
      deleted: async (id) => {
        await prisma.ideas.update({ where: { id }, data: { is_deleted: true } })
      },
      'moved to another status': async (id) => {
        await prisma.ideas.update({ where: { id }, data: { status_id: S1 } })
      },
      'promoted to an Issue': async (id) => {
        await prisma.ideas.update({
          where: { id },
          data: { phase: 'Delivery', delivery_status: 'Pending', effort: 'Low' },
        })
      },
    }

    it.each(Object.keys(vanish))(
      'saves nothing when an item is %s between the picker and the save, on create',
      async (how) => {
        const other = await newBoard()
        const good = await newIdea({ title: 'Good one' })
        const stale = await newIdea({ title: `Stale ${how}`, statusId: S2 })
        const before = await prisma.boards.count({ where: { organization_id: orgA } })

        const run = services(userContext(adminId, Role.OrgAdmin), async (ideaId) => {
          if (ideaId === stale) {
            await vanish[how]?.(stale, other)
          }
        }).boardService.create(orgA, {
          name: `Atomic ${how}`,
          allowUserStatusUpdate: true,
          swimlanes: lanes,
          keyPrefix: `AT${randomUUID().slice(0, 4).toUpperCase()}`,
          pullItemIds: [good, stale],
        })

        expect(await refusal(run)).toEqual([`'Stale ${how}' is no longer available.`])
        expect(await prisma.boards.count({ where: { organization_id: orgA } })).toBe(before)
        const untouched = await row(good)
        expect(untouched.board_id).toBeNull()
        expect(untouched.updated_at_utc).toEqual(CREATED)
        expect(untouched.item_number).toBeNull()
      },
    )

    it('saves nothing on edit: the board, its lanes, the other items and the number counter stay put', async () => {
      const target = await newBoard('Before')
      await prisma.boards.update({
        where: { id: target },
        data: { key_prefix: `ED${randomUUID().slice(0, 4).toUpperCase()}`, next_item_number: 5 },
      })
      const good = await newIdea()
      const stale = await newIdea({ title: 'Gone' })

      const run = services(userContext(adminId, Role.OrgAdmin), async (ideaId) => {
        if (ideaId === stale) {
          await prisma.ideas.update({ where: { id: stale }, data: { is_deleted: true } })
        }
      }).boardService.update(target, {
        name: 'After',
        allowUserStatusUpdate: false,
        swimlanes: [
          { statusId: S1, order: 0 },
          { statusId: S3, order: 1 },
        ],
        pullItemIds: [good, stale],
      })

      expect(await refusal(run)).toEqual(["'Gone' is no longer available."])
      const board = await prisma.boards.findUniqueOrThrow({
        where: { id: target },
        include: { board_swimlanes: true },
      })
      expect(board.name).toBe('Before')
      expect(board.next_item_number).toBe(5)
      expect(board.board_swimlanes.map((l) => l.status_id).sort()).toEqual([S1, S2].sort())
      expect((await row(good)).board_id).toBeNull()
    })

    it('names the first missing item when several have vanished', async () => {
      const first = await newIdea({ title: 'First gone', createdAt: at(1) })
      const second = await newIdea({ title: 'Second gone', createdAt: at(2) })

      const run = services(userContext(adminId, Role.OrgAdmin), async (ideaId) => {
        await prisma.ideas.update({ where: { id: ideaId }, data: { is_deleted: true } })
      }).boardService.create(orgA, {
        name: 'Both gone',
        allowUserStatusUpdate: true,
        swimlanes: lanes,
        pullItemIds: [second, first],
      })

      expect(await refusal(run)).toHaveLength(1)
    })

    it('refuses an idea that landed on the target board by another route during the save', async () => {
      const target = await newBoard()
      const racing = await newIdea({ title: 'Racing' })

      const run = services(userContext(adminId, Role.OrgAdmin), async (ideaId) => {
        if (ideaId === racing) {
          await prisma.ideas.update({ where: { id: racing }, data: { board_id: target } })
        }
      }).boardService.update(target, {
        name: 'Racing board',
        allowUserStatusUpdate: true,
        swimlanes: lanes,
        pullItemIds: [racing],
      })

      expect(await refusal(run)).toEqual(["'Racing' is no longer available."])
    })
  })

  describe('listPullCandidates', () => {
    const candidatesOf = async (
      boards: PrismaBoardRepository,
      source: 'unassigned' | 'boards' | 'backlog',
      overrides: Partial<Parameters<PrismaBoardRepository['listPullCandidates']>[0]> = {},
    ) =>
      boards.listPullCandidates({
        organizationId: orgA,
        source,
        excludeBoardId: null,
        search: null,
        tags: [],
        authorUserId: null,
        currentUserId: memberId,
        page: { page: 1, pageSize: 100 },
        ...overrides,
      })

    // A distinct title prefix per describe-run keeps these assertions independent of the rest of
    // the organization's data.
    const tag = `cand-${marker.slice(0, 6)}`

    it('offers each source only its own population, never deleted, sprinted or foreign items', async () => {
      const board = await newBoard()
      const excluded = await newBoard()
      const sprint = await newSprint(null)
      const pool = await newIdea({ title: `${tag} pool` })
      const onBoard = await newIdea({ title: `${tag} onboard`, boardId: board })
      const onExcluded = await newIdea({ title: `${tag} excluded`, boardId: excluded })
      const backlog = await newIdea({ title: `${tag} backlog`, phase: 'Delivery' })
      const sprinted = await newIdea({
        title: `${tag} sprinted`,
        phase: 'Delivery',
        sprintId: sprint,
      })
      const deleted = await newIdea({ title: `${tag} deleted`, isDeleted: true })
      const foreign = await newIdea({
        title: `${tag} foreign`,
        organizationId: orgB,
        authorId: foreignUserId,
      })
      const { boards } = services()

      const ids = async (
        source: 'unassigned' | 'boards' | 'backlog',
        extra: Parameters<typeof candidatesOf>[2] = {},
      ) =>
        (await candidatesOf(boards, source, { search: tag, ...extra })).items
          .map((c) => c.ideaId)
          .sort()

      expect(await ids('unassigned')).toEqual([pool])
      expect(await ids('boards')).toEqual([onBoard, onExcluded].sort())
      expect(await ids('boards', { excludeBoardId: excluded })).toEqual([onBoard])
      expect(await ids('backlog')).toEqual([backlog])
      for (const never of [sprinted, deleted, foreign]) {
        for (const source of ['unassigned', 'boards', 'backlog'] as const) {
          expect(await ids(source)).not.toContain(never)
        }
      }
    })

    it('keeps the pool when a board is excluded, since a null board is distinct from it', async () => {
      const board = await newBoard()
      const pool = await newIdea({ title: `${tag} pool-excl` })
      const { boards } = services()

      const page = await candidatesOf(boards, 'unassigned', {
        search: `${tag} pool-excl`,
        excludeBoardId: board,
      })

      expect(page.items.map((c) => c.ideaId)).toEqual([pool])
    })

    it('includes an idea on an archived board', async () => {
      const board = await newBoard()
      await prisma.boards.update({ where: { id: board }, data: { is_archived: true } })
      const idea = await newIdea({ title: `${tag} archived`, boardId: board })
      const { boards } = services()

      const page = await candidatesOf(boards, 'boards', { search: `${tag} archived` })

      expect(page.items.map((c) => c.ideaId)).toEqual([idea])
      expect(page.items[0]?.boardId).toBe(board)
    })

    it("describes a pool idea with no board name and marks the caller's own", async () => {
      const mine = await newIdea({ title: `${tag} mine`, authorId: memberId })
      const theirs = await newIdea({ title: `${tag} theirs`, authorId: otherAuthorId })
      const { boards } = services()

      const page = await candidatesOf(boards, 'unassigned', { search: `${tag} ` })
      const byId = new Map(page.items.map((c) => [c.ideaId, c]))

      expect(byId.get(mine)).toMatchObject({ boardId: null, boardName: null, isMine: true })
      expect(byId.get(theirs)?.isMine).toBe(false)
    })

    it('filters by author, and the author filter narrows a User to their own', async () => {
      const mine = await newIdea({ title: `${tag} auth-mine`, authorId: memberId })
      await newIdea({ title: `${tag} auth-theirs`, authorId: otherAuthorId })
      const { boards } = services()

      const page = await candidatesOf(boards, 'unassigned', {
        search: `${tag} auth-`,
        authorUserId: memberId,
      })

      expect(page.items.map((c) => c.ideaId)).toEqual([mine])
      expect(page.totalCount).toBe(1)
    })

    it('treats % and _ in the search as literal text', async () => {
      const literal = await newIdea({ title: `${tag} 100% done` })
      await newIdea({ title: `${tag} 100 percent done` })
      const underscore = await newIdea({ title: `${tag} a_b` })
      await newIdea({ title: `${tag} axb` })
      const { boards } = services()

      expect(
        (await candidatesOf(boards, 'unassigned', { search: `${tag} 100%` })).items.map(
          (c) => c.ideaId,
        ),
      ).toEqual([literal])
      expect(
        (await candidatesOf(boards, 'unassigned', { search: `${tag} a_b` })).items.map(
          (c) => c.ideaId,
        ),
      ).toEqual([underscore])
    })

    it("filters by tag (any-of, normalized names) and lists the idea's tags", async () => {
      const red = randomUUID()
      const blue = randomUUID()
      for (const [id, name] of [
        [red, `red-${marker.slice(0, 4)}`],
        [blue, `blue-${marker.slice(0, 4)}`],
      ] as const) {
        await prisma.tags.create({
          data: {
            id,
            organization_id: orgA,
            name,
            normalized_name: name.toLowerCase(),
            color: '#112233',
            ...stamps,
          },
        })
      }
      const tagged = await newIdea({ title: `${tag} tagged` })
      const other = await newIdea({ title: `${tag} other-tag` })
      const untagged = await newIdea({ title: `${tag} untagged` })
      await prisma.idea_tags.createMany({
        data: [
          { id: randomUUID(), idea_id: tagged, tag_id: red },
          { id: randomUUID(), idea_id: other, tag_id: blue },
        ],
      })
      const { boards } = services()

      const page = await candidatesOf(boards, 'unassigned', {
        search: `${tag} `,
        tags: [`red-${marker.slice(0, 4)}`, 'no-such-tag'],
      })

      expect(page.items.map((c) => c.ideaId)).toEqual([tagged])
      expect(page.items[0]?.tags).toEqual([`red-${marker.slice(0, 4)}`])
      expect(untagged).not.toBe(tagged)
    })

    it('orders oldest first, then title, then id, and pages stably with a true total', async () => {
      const sameTime = at(20)
      const oldest = await newIdea({ title: `${tag} ord Z`, createdAt: at(18) })
      const a = await newIdea({ title: `${tag} ord A`, createdAt: sameTime })
      const b = await newIdea({ title: `${tag} ord B`, createdAt: sameTime })
      const { boards } = services()

      const all = await candidatesOf(boards, 'unassigned', { search: `${tag} ord ` })
      expect(all.items.map((c) => c.ideaId)).toEqual([oldest, a, b])
      expect(all.totalCount).toBe(3)

      const second = await candidatesOf(boards, 'unassigned', {
        search: `${tag} ord `,
        page: { page: 2, pageSize: 2 },
      })
      expect(second.items.map((c) => c.ideaId)).toEqual([b])
      expect(second.totalCount).toBe(3)
    })

    it('returns an empty page beyond the last one', async () => {
      await newIdea({ title: `${tag} lonely` })
      const { boards } = services()

      const page = await candidatesOf(boards, 'unassigned', {
        search: `${tag} lonely`,
        page: { page: 5, pageSize: 10 },
      })

      expect(page.items).toEqual([])
      expect(page.totalCount).toBe(1)
    })
  })

  describe('items with no board, read back', () => {
    it('lists pool ideas under the no-board filter alone, and any-of with a board filter', async () => {
      const board = await newBoard()
      const pooled = await newIdea({ title: `NB pool ${marker}` })
      const onBoard = await newIdea({ title: `NB board ${marker}`, boardId: board })
      const elsewhere = await newIdea({
        title: `NB elsewhere ${marker}`,
        boardId: await newBoard(),
      })
      const { ideas } = services()
      const filter = (overrides: Partial<OrganizationIdeaListFilter>): OrganizationIdeaListFilter =>
        ({
          organizationId: orgA,
          createdByUserId: null,
          assignedToUserId: null,
          page: { page: 1, pageSize: 100 },
          search: `NB `,
          sortBy: null,
          sortDirection: 'asc',
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
          ...overrides,
        }) as OrganizationIdeaListFilter
      const idsOf = async (overrides: Partial<OrganizationIdeaListFilter>) =>
        (await ideas.listByOrganization(filter(overrides))).items.map((i) => i.id).sort()

      expect(await idsOf({ includeNoBoard: true })).toEqual([pooled])
      expect(await idsOf({ includeNoBoard: true, boardIds: [board] })).toEqual(
        [pooled, onBoard].sort(),
      )
      expect(await idsOf({ boardIds: [board] })).toEqual([onBoard])
      expect(await idsOf({})).toEqual([pooled, onBoard, elsewhere].sort())
    })

    it("leaves pool ideas out of every board's idea count, lane counts and tag counts", async () => {
      const board = await newBoard()
      const onBoard = await newIdea({ boardId: board, statusId: S1 })
      await newIdea({ statusId: S1 })
      const tagId = randomUUID()
      await prisma.tags.create({
        data: {
          id: tagId,
          organization_id: orgA,
          name: `cnt-${marker.slice(0, 5)}`,
          normalized_name: `cnt-${marker.slice(0, 5)}`,
          color: '#112233',
          ...stamps,
        },
      })
      const pooled = await newIdea()
      await prisma.idea_tags.createMany({
        data: [
          { id: randomUUID(), idea_id: onBoard, tag_id: tagId },
          { id: randomUUID(), idea_id: pooled, tag_id: tagId },
        ],
      })
      const { boards } = services()

      expect((await boards.countIdeasByBoard([board])).get(board)).toBe(1)
      expect(await boards.countIdeasByBoardAndStatus([board])).toEqual([
        { boardId: board, statusId: S1, ideaCount: 1 },
      ])
      expect(await boards.countIdeasByBoardAndTag([board])).toEqual([
        { boardId: board, tagName: `cnt-${marker.slice(0, 5)}`, tagColor: '#112233', ideaCount: 1 },
      ])
    })

    it("counts pool ideas in a tag's usage without naming a board for them", async () => {
      const board = await newBoard('Usage board')
      const tagId = randomUUID()
      await prisma.tags.create({
        data: {
          id: tagId,
          organization_id: orgA,
          name: `use-${marker.slice(0, 5)}`,
          normalized_name: `use-${marker.slice(0, 5)}`,
          color: '#112233',
          ...stamps,
        },
      })
      const pooled = await newIdea()
      const pooledOnly = await newIdea()
      const onBoard = await newIdea({ boardId: board })
      const deleted = await newIdea({ isDeleted: true })
      await prisma.idea_tags.createMany({
        data: [pooled, onBoard, deleted].map((idea_id) => ({
          id: randomUUID(),
          idea_id,
          tag_id: tagId,
        })),
      })
      const soloTag = randomUUID()
      await prisma.tags.create({
        data: {
          id: soloTag,
          organization_id: orgA,
          name: `solo-${marker.slice(0, 5)}`,
          normalized_name: `solo-${marker.slice(0, 5)}`,
          color: '#112233',
          ...stamps,
        },
      })
      await prisma.idea_tags.create({
        data: { id: randomUUID(), idea_id: pooledOnly, tag_id: soloTag },
      })

      const usage = await new PrismaTagRepository(prisma).usageByTagIds([tagId, soloTag])

      expect(usage.get(tagId)?.ideaCount).toBe(2)
      expect(usage.get(tagId)?.boards).toEqual([{ boardId: board, name: 'Usage board' }])
      expect(usage.get(soloTag)).toEqual({ ideaCount: 1, boards: [] })
    })

    it('shows a notification for a pool idea with no board name, and stores a null board_id', async () => {
      const pooled = await newIdea({ title: 'Pool notification' })
      const onBoard = await newIdea({ boardId: await newBoard('Named board') })
      const inbox = new PrismaNotificationEventRepository(prisma)
      for (const [ideaId, boardId] of [
        [pooled, null],
        [onBoard, (await row(onBoard)).board_id],
      ] as const) {
        await inbox.add({
          id: randomUUID(),
          eventType: 'CommentAdded' as never,
          organizationId: orgA,
          boardId,
          ideaId,
          ideaTitle: 'T',
          actorUserId: adminId,
          recipientUserId: memberId,
          link: `/ideas/${ideaId}`,
          statusName: null,
          occurredAtUtc: new Date(SAVED.getTime() + (boardId === null ? 0 : 1000)),
        })
      }

      const page = await inbox.listForRecipient({
        recipientUserId: memberId,
        sinceUtc: new Date('2026-10-01T00:00:00.000Z'),
        unreadOnly: false,
        page: { page: 1, pageSize: 20 },
      })

      const byIdea = new Map(page.items.map((r) => [r.ideaId, r.boardName]))
      expect(byIdea.get(pooled)).toBeNull()
      expect(byIdea.get(onBoard)).toBe('Named board')
      const stored = await prisma.notification_events.findFirstOrThrow({
        where: { idea_id: pooled },
      })
      expect(stored.board_id).toBeNull()
    })

    it('follows an idea to the pool when it is detached: the board-less row keeps its status', async () => {
      const board = await newBoard()
      const idea = await newIdea({ boardId: board, statusId: S2, itemNumber: 3 })
      const unitOfWork = new PrismaUnitOfWork(prisma)
      const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
      const loaded = await ideas.getById(idea)
      expect(loaded).not.toBeNull()
      if (loaded) {
        await ideas.update({ ...loaded, boardId: null, itemNumber: null, parentIdeaId: null })
        await unitOfWork.saveChanges()
      }

      expect(await row(idea)).toMatchObject({ board_id: null, status_id: S2, item_number: null })
      expect((await ideas.getById(idea))?.boardId).toBeNull()
    })
  })
})
