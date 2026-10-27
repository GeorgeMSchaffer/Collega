// Live-database QA for the 2026-10-16 "Board References follow-ups" decision (SPEC/decisions.md items
// 1 to 5; contracts/boards.md "Pulling items", `autoCreateTask`, `ideaMoves`; contracts/ideas.md
// "Updating a task"; contracts/metric-types.md): the real BoardService and IdeaService over the
// Prisma repositories.
//
//  - auto-create on every entry: a pull at board create and at board update, and a bulk lane move,
//    each give a card its one task in the board save's transaction; a task that is refused rolls
//    the whole save back (no lane change, no moved or pulled card, no task, no audit);
//  - a task is never a pull candidate and is refused in `pullItemIds`;
//  - editing a task writes only the four task fields and the audit, and refuses everyone else;
//  - metric values stay writable on an archived board while every other write stays refused;
//  - a direct Site Admin reads `metrics: []` in the idea detail, View As still sees the values.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.
// Each call builds a FRESH set of services, because the unit of work is a command buffer (a refused
// call's staged writes would otherwise ride along on the next call's commit). Ideas get distinct
// creation times, so the oldest-first order of a pull never ties.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import {
  type AuditEventInput,
  type CurrentUserContext,
  ForbiddenError,
  ValidationError,
} from '@collega/application/common'
import { IdeaService } from '@collega/application/ideas'
import { IdeaMetricsService } from '@collega/application/metric-types'
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
import { PrismaMetricTypeRepository } from '../src/repositories/metric-type.repository.js'
import { OrganizationExistenceLookupRepository } from '../src/repositories/organization-existence-lookup.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-15T09:00:00.000Z')
const SAVED = new Date('2026-10-16T12:00:00.000Z')

type Notification = { eventType: string; recipientUserId: string; ideaId: string }

describe.skipIf(!DATABASE_URL)('Board References follow-ups, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const tag = marker.slice(0, 4).toUpperCase()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const memberId = randomUUID()
  const strangerId = randomUUID()
  const assigneeId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const metricTypeId = randomUUID()
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
  const [S_NEW, S_OUT, S_AUTO, S_OPEN, S_DONE] = Array.from({ length: 5 }, () => randomUUID()) as [
    string,
    string,
    string,
    string,
    string,
  ]

  const ctx = (userId: string, role: Role): CurrentUserContext => ({
    isAuthenticated: true,
    userId,
    organizationId,
    role,
    isImpersonating: false,
    realUserId: userId,
  })
  const admin = ctx(adminId, Role.OrgAdmin)
  const author = ctx(memberId, Role.User)
  const stranger = ctx(strangerId, Role.User)
  const readOnly = ctx(randomUUID(), Role.ReadOnly)
  const siteAdmin: CurrentUserContext = {
    isAuthenticated: true,
    userId: randomUUID(),
    organizationId: null,
    role: Role.SiteAdmin,
    isImpersonating: false,
    realUserId: null,
  }
  const viewingAsAdmin: CurrentUserContext = {
    ...admin,
    isImpersonating: true,
    realUserId: siteAdmin.userId,
  }

  type Hooks = {
    /** Runs once a board save has read the lanes it removes, before it commits. */
    afterLaneRead?: () => Promise<void>
    /** Runs after the organization's boards were listed for the reference checks. */
    afterBoardsListed?: () => Promise<void>
    /** Runs after the first idea read, the route's `isTask` pre-read. */
    afterFirstIdeaRead?: () => Promise<void>
  }

  function services(currentUser: CurrentUserContext = admin, hooks: Hooks = {}) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    if (hooks.afterLaneRead) {
      const read = boards.listLaneIdeas.bind(boards)
      boards.listLaneIdeas = async (boardId, statusIds) => {
        const ideas = await read(boardId, statusIds)
        await hooks.afterLaneRead?.()
        return ideas
      }
    }
    if (hooks.afterBoardsListed) {
      const list = boards.listByOrganization.bind(boards)
      boards.listByOrganization = async (orgId) => {
        const listed = await list(orgId)
        await hooks.afterBoardsListed?.()
        return listed
      }
    }
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    if (hooks.afterFirstIdeaRead) {
      const read = ideas.getById.bind(ideas)
      let reads = 0
      ideas.getById = async (ideaId, includeDeleted) => {
        const found = await read(ideaId, includeDeleted)
        if (++reads === 1) await hooks.afterFirstIdeaRead?.()
        return found
      }
    }
    const events: AuditEventInput[] = []
    const audit = new PrismaAuditEventWriter(prisma)
    const notifications: Notification[] = []
    const clock = { now: () => SAVED }
    const ideaService = new IdeaService(
      ideas,
      boards,
      new PrismaUserRepository(prisma, unitOfWork),
      new PrismaTagRepository(prisma),
      new IdeaCommentsLookupRepository(prisma),
      new IdeaClassificationRepository(prisma),
      new PrismaIdeaFieldValuesRepository(prisma),
      new PrismaIdeaUpvoteRepository(prisma, unitOfWork),
      new PrismaSprintRepository(prisma, unitOfWork),
      new PrismaIssueTaskRepository(prisma, unitOfWork),
      {
        notify: async (input) => {
          notifications.push({
            eventType: input.eventType,
            recipientUserId: input.recipientUserId,
            ideaId: input.ideaId,
          })
        },
      },
      new PrismaIdeaFollowerRepository(prisma, unitOfWork),
      new PrismaIdeaDependencyRepository(prisma, unitOfWork),
      unitOfWork,
      audit,
      currentUser,
      clock,
      { nextInt: () => 0 },
      boards,
      new PrismaMetricTypeRepository(prisma, unitOfWork),
    )
    const boardService = new BoardService(
      boards,
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      audit,
      currentUser,
      clock,
      ideas,
      ideaService,
    )
    const metrics = new PrismaMetricTypeRepository(prisma, unitOfWork)
    const metricsService = new IdeaMetricsService(
      ideas,
      metrics,
      metrics,
      unitOfWork,
      audit,
      currentUser,
      clock,
      boards,
    )
    return { ideaService, boardService, metricsService, notifications, events }
  }

  let boardCounter = 0
  async function newBoard(
    lanes: { statusId: string; isFinal?: boolean; refs?: string; auto?: boolean }[],
    isArchived = false,
  ): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `Follow-up QA ${id}`,
        key_prefix: `F${++boardCounter}${tag}`,
        next_item_number: 1,
        allow_user_status_update: true,
        is_archived: isArchived,
        ...stamps,
        board_swimlanes: {
          create: lanes.map((lane, order) => ({
            id: randomUUID(),
            status_id: lane.statusId,
            display_order: order,
            is_final: lane.isFinal ?? false,
            references_board_id: lane.refs ?? null,
            auto_create_task: lane.auto ?? false,
          })),
        },
      },
    })
    return id
  }

  /** A child board (open lane, then a final one) and a parent board with an auto-create lane. */
  async function boardPair() {
    const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
    const parentBoard = await newBoard([
      { statusId: S_NEW },
      { statusId: S_OUT },
      { statusId: S_AUTO, refs: child, auto: true },
    ])
    return { child, parentBoard }
  }

  let ideaSeq = 0
  async function newIdea(input: {
    boardId: string | null
    statusId: string
    parentId?: string | null
    title?: string
    authorId?: string
    phase?: 'Discovery' | 'Delivery'
  }): Promise<string> {
    const id = randomUUID()
    const at = new Date(CREATED.getTime() + ++ideaSeq * 1000)
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: input.boardId,
        status_id: input.statusId,
        parent_idea_id: input.parentId ?? null,
        title: input.title ?? `Follow-up QA idea ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: input.authorId ?? adminId,
        is_deleted: false,
        phase: input.phase ?? 'Discovery',
        effort: 'Medium',
        created_at_utc: at,
        updated_at_utc: at,
      },
    })
    return id
  }

  const row = (ideaId: string) => prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })
  const tasksOf = (ideaId: string) =>
    prisma.ideas.findMany({ where: { parent_idea_id: ideaId }, orderBy: { id: 'asc' } })
  const eventsOf = (entityId: string, eventType: string) =>
    prisma.audit_events.findMany({ where: { entity_id: entityId, event_type: eventType } })
  const eventsOfAny = (entityIds: string[]) =>
    prisma.audit_events.count({ where: { entity_id: { in: entityIds } } })
  const laneStatuses = async (boardId: string) =>
    (
      await prisma.board_swimlanes.findMany({
        where: { board_id: boardId },
        orderBy: { display_order: 'asc' },
        select: { status_id: true },
      })
    ).map((lane) => lane.status_id)
  const snapshot = async (ideaIds: string[]) =>
    JSON.stringify(
      await prisma.ideas.findMany({
        where: { id: { in: ideaIds } },
        orderBy: { id: 'asc' },
        select: { id: true, board_id: true, status_id: true, updated_at_utc: true },
      }),
    )
  const nextNumber = async (boardId: string) =>
    (await prisma.boards.findUniqueOrThrow({ where: { id: boardId } })).next_item_number

  async function setArchived(boardId: string, isArchived: boolean) {
    await prisma.boards.update({ where: { id: boardId }, data: { is_archived: isArchived } })
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board References follow-ups QA probe.',
        invite_code: `probe-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    for (const [id, role, first] of [
      [adminId, 'OrgAdmin', 'Admin'],
      [memberId, 'User', 'Member'],
      [strangerId, 'User', 'Stranger'],
      [assigneeId, 'User', 'Assignee'],
    ] as const) {
      await prisma.users.create({
        data: {
          id,
          organization_id: organizationId,
          first_name: 'Probe',
          last_name: first,
          email: `probe-${first}-${marker}@example.test`,
          normalized_email: `PROBE-${first}-${marker}@EXAMPLE.TEST`.toUpperCase(),
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
    for (const [order, id] of [S_NEW, S_OUT, S_AUTO, S_OPEN, S_DONE].entries()) {
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
    await prisma.metric_types.create({
      data: {
        metric_type_id: metricTypeId,
        organization_id: organizationId,
        name: 'Savings',
        unit: '$',
        is_archived: false,
        ...stamps,
      },
    })
  })

  afterAll(async () => {
    await prisma.audit_events.deleteMany({ where: { organization_id: organizationId } })
    await prisma.ideas.updateMany({
      where: { organization_id: organizationId },
      data: { parent_idea_id: null },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.metric_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: organizationId } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.tags.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  describe('auto-create on a pull', () => {
    const lanesWithAuto = (child: string) => [
      { statusId: S_NEW, order: 0 },
      { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
    ]

    it('at board create gives each pulled card landing in the auto-create lane its one task, and no other card', async () => {
      const { child } = await boardPair()
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const entering = await newIdea({ boardId: source, statusId: S_AUTO, title: 'Pulled in' })
      const staying = await newIdea({ boardId: source, statusId: S_NEW, title: 'Stays plain' })

      const created = await services().boardService.create(organizationId, {
        name: 'Pull create',
        allowUserStatusUpdate: true,
        swimlanes: lanesWithAuto(child),
        pullItemIds: [entering, staying],
      })

      expect(await row(entering)).toMatchObject({ board_id: created.boardId, status_id: S_AUTO })
      expect(await row(staying)).toMatchObject({ board_id: created.boardId, status_id: S_NEW })
      const tasks = await tasksOf(entering)
      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toMatchObject({
        title: 'Pulled in',
        board_id: child,
        status_id: S_OPEN,
        item_number: 1,
        is_deleted: false,
      })
      expect(await tasksOf(staying)).toHaveLength(0)
      expect(await eventsOf(tasks[0]?.id ?? '', 'BoardTaskCreated')).toHaveLength(1)
      expect(await eventsOf(created.boardId, 'BoardCreated')).toHaveLength(1)
    })

    it('gives a card that already holds a task on the referenced board no new task on entry', async () => {
      const { child } = await boardPair()
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const card = await newIdea({ boardId: source, statusId: S_AUTO, title: 'Has a task' })
      const existing = await newIdea({ boardId: child, statusId: S_DONE, parentId: card })

      await services().boardService.create(organizationId, {
        name: 'Pull holder',
        allowUserStatusUpdate: true,
        swimlanes: lanesWithAuto(child),
        pullItemIds: [card],
      })

      const tasks = await tasksOf(card)
      expect(tasks.map((t) => t.id)).toEqual([existing])
      expect(await eventsOf(existing, 'BoardTaskCreated')).toHaveLength(0)
    })

    it('at board update gives the pulled card its task, in the same save as the pull', async () => {
      const { child, parentBoard } = await boardPair()
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const card = await newIdea({ boardId: source, statusId: S_AUTO, title: 'Pulled on edit' })

      const updated = await services().boardService.update(parentBoard, {
        name: 'Pull update',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: S_NEW, order: 0 },
          { statusId: S_OUT, order: 1 },
          { statusId: S_AUTO, order: 2, referencesBoardId: child, autoCreateTask: true },
        ],
        pullItemIds: [card],
      })

      expect(updated.pulledItems).toHaveLength(1)
      expect(await row(card)).toMatchObject({ board_id: parentBoard, status_id: S_AUTO })
      const tasks = await tasksOf(card)
      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toMatchObject({ title: 'Pulled on edit', board_id: child })
      expect(await eventsOf(tasks[0]?.id ?? '', 'BoardTaskCreated')).toHaveLength(1)
      expect(await eventsOf(parentBoard, 'BoardUpdated')).toHaveLength(1)
    })

    it('creates no task when the lane is a reference lane without auto-create', async () => {
      const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const card = await newIdea({ boardId: source, statusId: S_AUTO })

      await services().boardService.create(organizationId, {
        name: 'Pull no auto',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: S_NEW, order: 0 },
          { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: false },
        ],
        pullItemIds: [card],
      })

      expect(await tasksOf(card)).toHaveLength(0)
    })

    it('rolls a board create back when the referenced board was archived mid-save: no board, no move, no task, no audit', async () => {
      const { child } = await boardPair()
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const card = await newIdea({ boardId: source, statusId: S_AUTO })
      const before = await snapshot([card])
      const boardsBefore = await prisma.boards.count({ where: { organization_id: organizationId } })

      try {
        const error = await services(admin, {
          afterBoardsListed: () => setArchived(child, true),
        })
          .boardService.create(organizationId, {
            name: 'Refused create',
            allowUserStatusUpdate: true,
            swimlanes: lanesWithAuto(child),
            pullItemIds: [card],
          })
          .catch((caught: unknown) => caught)

        expect(error).toMatchObject({ code: 'referencedBoardArchived' })
        expect(await prisma.boards.count({ where: { organization_id: organizationId } })).toBe(
          boardsBefore,
        )
        expect(await snapshot([card])).toBe(before)
        expect(await tasksOf(card)).toHaveLength(0)
        expect(await eventsOfAny([card])).toBe(0)
        expect(await nextNumber(child)).toBe(1)
      } finally {
        await setArchived(child, false)
      }
    })

    it('rolls a board update back when the pulled card task is refused: lanes, cards and audit untouched', async () => {
      const { child, parentBoard } = await boardPair()
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const card = await newIdea({ boardId: source, statusId: S_AUTO })
      const before = await snapshot([card])

      try {
        const error = await services(admin, {
          afterBoardsListed: () => setArchived(child, true),
        })
          .boardService.update(parentBoard, {
            name: 'Renamed but refused',
            allowUserStatusUpdate: false,
            swimlanes: [
              { statusId: S_NEW, order: 0 },
              { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
            ],
            pullItemIds: [card],
          })
          .catch((caught: unknown) => caught)

        expect(error).toMatchObject({ code: 'referencedBoardArchived' })
        expect(await laneStatuses(parentBoard)).toEqual([S_NEW, S_OUT, S_AUTO])
        const stored = await prisma.boards.findUniqueOrThrow({ where: { id: parentBoard } })
        expect(stored.name).not.toBe('Renamed but refused')
        expect(await snapshot([card])).toBe(before)
        expect(await tasksOf(card)).toHaveLength(0)
        expect(await eventsOfAny([card, parentBoard])).toBe(0)
      } finally {
        await setArchived(child, false)
      }
    })

    it('rolls a board create back when the organization has no active idea type', async () => {
      const { child } = await boardPair()
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const card = await newIdea({ boardId: source, statusId: S_AUTO })
      const before = await snapshot([card])
      const boardsBefore = await prisma.boards.count({ where: { organization_id: organizationId } })
      await prisma.idea_types.update({ where: { id: ideaTypeId }, data: { is_deleted: true } })

      try {
        const error = await services()
          .boardService.create(organizationId, {
            name: 'No type create',
            allowUserStatusUpdate: true,
            swimlanes: lanesWithAuto(child),
            pullItemIds: [card],
          })
          .catch((caught: unknown) => caught)

        expect(error).toMatchObject({ code: 'noDefaultIdeaType' })
        expect(await prisma.boards.count({ where: { organization_id: organizationId } })).toBe(
          boardsBefore,
        )
        expect(await snapshot([card])).toBe(before)
        expect(await tasksOf(card)).toHaveLength(0)
        expect(await eventsOfAny([card])).toBe(0)
      } finally {
        await prisma.idea_types.update({ where: { id: ideaTypeId }, data: { is_deleted: false } })
      }
    })
  })

  describe('auto-create on a bulk lane move (ideaMoves)', () => {
    /** Removes the plain S_OUT lane, sending its cards into the auto-create S_AUTO. */
    const removeOut = (child: string, extra: { pullItemIds?: string[] } = {}) => ({
      name: 'Moves',
      allowUserStatusUpdate: true,
      swimlanes: [
        { statusId: S_NEW, order: 0 },
        { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
      ],
      ideaMoves: [{ fromStatusId: S_OUT, toStatusId: S_AUTO }],
      ...extra,
    })

    it('gives each moved card one task titled as the card on the referenced first lane, auditing the moves and the tasks', async () => {
      const { child, parentBoard } = await boardPair()
      const first = await newIdea({ boardId: parentBoard, statusId: S_OUT, title: 'Move one' })
      const second = await newIdea({ boardId: parentBoard, statusId: S_OUT, title: 'Move two' })
      const bystander = await newIdea({ boardId: parentBoard, statusId: S_NEW })

      await services().boardService.update(parentBoard, removeOut(child))

      expect(await laneStatuses(parentBoard)).toEqual([S_NEW, S_AUTO])
      expect((await row(first)).status_id).toBe(S_AUTO)
      expect((await row(second)).status_id).toBe(S_AUTO)
      expect((await row(bystander)).status_id).toBe(S_NEW)
      for (const [card, title] of [
        [first, 'Move one'],
        [second, 'Move two'],
      ] as const) {
        const tasks = await tasksOf(card)
        expect(tasks).toHaveLength(1)
        expect(tasks[0]).toMatchObject({ title, board_id: child, status_id: S_OPEN })
        expect(await eventsOf(tasks[0]?.id ?? '', 'BoardTaskCreated')).toHaveLength(1)
        expect(await eventsOf(card, 'IdeaStatusChanged')).toHaveLength(1)
      }
      expect(await tasksOf(bystander)).toHaveLength(0)
      const numbers = (await tasksOf(first)).concat(await tasksOf(second)).map((t) => t.item_number)
      expect([...numbers].sort()).toEqual([1, 2])
    })

    it('moves and pulls in one save, giving each its own task', async () => {
      const { child, parentBoard } = await boardPair()
      const moved = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
      const pulled = await newIdea({ boardId: source, statusId: S_AUTO })

      await services().boardService.update(parentBoard, removeOut(child, { pullItemIds: [pulled] }))

      expect(await tasksOf(moved)).toHaveLength(1)
      expect(await tasksOf(pulled)).toHaveLength(1)
      expect(await row(pulled)).toMatchObject({ board_id: parentBoard, status_id: S_AUTO })
    })

    it('skips silently, as before, an idea that left an ordinary destination lane meanwhile', async () => {
      const { parentBoard } = await boardPair()
      const stays = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      const leaves = await newIdea({ boardId: parentBoard, statusId: S_OUT })

      await services(admin, {
        afterLaneRead: async () => {
          await prisma.ideas.update({ where: { id: leaves }, data: { status_id: S_AUTO } })
        },
      }).boardService.update(parentBoard, {
        name: 'Ordinary move',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: S_NEW, order: 0 },
          { statusId: S_AUTO, order: 1, referencesBoardId: (await refOf(parentBoard)) ?? null },
        ],
        ideaMoves: [{ fromStatusId: S_OUT, toStatusId: S_NEW }],
      })

      expect((await row(stays)).status_id).toBe(S_NEW)
      expect((await row(leaves)).status_id).toBe(S_AUTO)
      expect(await tasksOf(stays)).toHaveLength(0)
    })

    it('rolls the whole save back when a moved card task is refused: the lane stays, the cards stay, nothing is audited', async () => {
      const { child, parentBoard } = await boardPair()
      const first = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      const second = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      const before = await snapshot([first, second])

      try {
        const error = await services(admin, {
          afterBoardsListed: () => setArchived(child, true),
        })
          .boardService.update(parentBoard, removeOut(child))
          .catch((caught: unknown) => caught)

        expect(error).toMatchObject({ code: 'referencedBoardArchived' })
        expect(await laneStatuses(parentBoard)).toEqual([S_NEW, S_OUT, S_AUTO])
        expect(await snapshot([first, second])).toBe(before)
        expect(await tasksOf(first)).toHaveLength(0)
        expect(await tasksOf(second)).toHaveLength(0)
        expect(await eventsOfAny([first, second, parentBoard])).toBe(0)
      } finally {
        await setArchived(child, false)
      }
    })

    it('rolls the whole save back with no active idea type, and the same save works once one exists', async () => {
      const { child, parentBoard } = await boardPair()
      const card = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      await prisma.idea_types.update({ where: { id: ideaTypeId }, data: { is_deleted: true } })

      try {
        const error = await services()
          .boardService.update(parentBoard, removeOut(child))
          .catch((caught: unknown) => caught)
        expect(error).toMatchObject({ code: 'noDefaultIdeaType' })
        expect((await row(card)).status_id).toBe(S_OUT)
        expect(await laneStatuses(parentBoard)).toEqual([S_NEW, S_OUT, S_AUTO])
        expect(await tasksOf(card)).toHaveLength(0)
      } finally {
        await prisma.idea_types.update({ where: { id: ideaTypeId }, data: { is_deleted: false } })
      }

      await services().boardService.update(parentBoard, removeOut(child))
      expect((await row(card)).status_id).toBe(S_AUTO)
      expect(await tasksOf(card)).toHaveLength(1)
    })

    async function refOf(boardId: string): Promise<string | undefined> {
      const lane = await prisma.board_swimlanes.findFirst({
        where: { board_id: boardId, status_id: S_AUTO },
        select: { references_board_id: true },
      })
      return lane?.references_board_id ?? undefined
    }
  })

  describe('a task is never pullable', () => {
    const TASK_TEXT = (title: string) =>
      `'${title}' is a task, so it cannot be pulled. Tasks stay on their parent's reference board.`

    async function taskOnChild(title: string) {
      const { child, parentBoard } = await boardPair()
      const parent = await newIdea({ boardId: parentBoard, statusId: S_NEW })
      const task = await newIdea({ boardId: child, statusId: S_OPEN, parentId: parent, title })
      return { child, parent, task }
    }

    it('keeps tasks out of every picker tab and keeps their parent in', async () => {
      const unique = `Picker ${randomUUID()}`
      const { child, parent } = await boardPair().then(async ({ child, parentBoard }) => ({
        child,
        parent: await newIdea({ boardId: parentBoard, statusId: S_NEW, title: `${unique} parent` }),
      }))
      await newIdea({ boardId: child, statusId: S_OPEN, parentId: parent, title: `${unique} task` })
      await newIdea({
        boardId: null,
        statusId: S_OPEN,
        parentId: parent,
        title: `${unique} loose task`,
      })
      await newIdea({
        boardId: child,
        statusId: S_OPEN,
        parentId: parent,
        title: `${unique} backlog task`,
        phase: 'Delivery',
      })
      await newIdea({ boardId: null, statusId: S_NEW, title: `${unique} loose idea` })

      const titlesOf = async (source: string) =>
        (
          await services().boardService.listPullCandidates(organizationId, {
            source,
            excludeBoardId: null,
            search: unique,
            tags: [],
            authorUserId: null,
            page: null,
            pageSize: null,
          } as never)
        ).items
          .map((item) => item.title)
          .sort()

      expect(await titlesOf('boards')).toEqual([`${unique} parent`])
      expect(await titlesOf('unassigned')).toEqual([`${unique} loose idea`])
      expect(await titlesOf('backlog')).toEqual([])
    })

    it('refuses a task in pullItemIds on create with the exact text, saving nothing', async () => {
      const { child, task } = await taskOnChild('Wire the form')
      const before = await snapshot([task])
      const boardsBefore = await prisma.boards.count({ where: { organization_id: organizationId } })

      const error = await services()
        .boardService.create(organizationId, {
          name: 'Pull a task',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0 },
            { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
          ],
          pullItemIds: [task],
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toEqual({
        pullItemIds: [TASK_TEXT('Wire the form')],
      })
      expect(await snapshot([task])).toBe(before)
      expect(await prisma.boards.count({ where: { organization_id: organizationId } })).toBe(
        boardsBefore,
      )
    })

    it('refuses it on update too, and a forceReason from an Org Admin does not lift it', async () => {
      const { task } = await taskOnChild('Wire the form again')
      const target = await newBoard([{ statusId: S_NEW }, { statusId: S_OUT }])
      const before = await snapshot([task])

      const error = await services()
        .boardService.update(target, {
          name: 'Pull a task on edit',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0 },
            { statusId: S_OUT, order: 1 },
          ],
          pullItemIds: [task],
          forceReason: 'Do it anyway',
        })
        .catch((caught: unknown) => caught)

      expect((error as ValidationError).failures).toEqual({
        pullItemIds: [TASK_TEXT('Wire the form again')],
      })
      expect(await snapshot([task])).toBe(before)
      expect(await eventsOfAny([task])).toBe(0)
    })
  })

  describe('editing a task', () => {
    /** A parent in a reference lane and a task made through the real create path, by `author`. */
    async function realTask() {
      const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
      const board = await newBoard([
        { statusId: S_NEW },
        { statusId: S_OUT, refs: child },
        { statusId: S_AUTO },
      ])
      const parent = await newIdea({ boardId: board, statusId: S_OUT, authorId: memberId })
      const created = await services(author).ideaService.createBoardTask(parent, {
        title: 'Original task',
        description: 'Original description',
        assigneeUserIds: null,
        tagNames: null,
      })
      return { child, parent, taskId: created.ideaId }
    }

    const EDIT = (assigneeUserIds: string[] = []) => ({
      title: 'Edited task',
      description: 'Edited description',
      assigneeUserIds,
      tagNames: ['Frontend'],
    })

    it('lets the author change the four task fields and writes nothing else on the row', async () => {
      const { taskId } = await realTask()
      const before = await row(taskId)

      const s = services(author)
      const detail = await s.ideaService.updateTask(taskId, EDIT([assigneeId]))

      const after = await row(taskId)
      expect(after).toMatchObject({ title: 'Edited task', description: 'Edited description' })
      for (const column of [
        'problem',
        'proposed_solutions',
        'impact_rationale',
        'priority',
        'idea_type_id',
        'business_impact_id',
        'due_date',
        'effort',
        'board_id',
        'status_id',
        'parent_idea_id',
        'item_number',
        'author_user_id',
        'phase',
        'sprint_id',
      ] as const) {
        expect(after[column], column).toEqual(before[column])
      }
      expect(
        (await prisma.idea_assignees.findMany({ where: { idea_id: taskId } })).map(
          (a) => a.user_id,
        ),
      ).toEqual([assigneeId])
      expect(await prisma.idea_tags.count({ where: { idea_id: taskId } })).toBe(1)
      expect(detail).toMatchObject({
        title: 'Edited task',
        problem: null,
        impactRationale: null,
        priority: null,
        ideaTypeId: null,
        businessImpactId: null,
        proposedSolutions: [],
      })
      const updated = await eventsOf(taskId, 'IdeaUpdated')
      expect(updated).toHaveLength(1)
      expect(updated[0]).toMatchObject({ actor_user_id: memberId, entity_type: 'Idea' })
    })

    it('notifies the followers of the edit, not the actor, and sends no mention notification', async () => {
      const { taskId } = await realTask()
      const s = services(author)

      await s.ideaService.updateTask(taskId, EDIT([assigneeId]))

      // The author follows (and is the actor); the new assignee follows from this save.
      expect(s.notifications).toEqual([
        { eventType: 'IdeaEdited', recipientUserId: assigneeId, ideaId: taskId },
      ])
      expect(await prisma.idea_mentions.count({ where: { idea_id: taskId } })).toBe(0)
    })

    it('lets an Org Admin who is not the author edit it', async () => {
      const { taskId } = await realTask()

      await services(admin).ideaService.updateTask(taskId, EDIT())

      expect((await row(taskId)).title).toBe('Edited task')
    })

    it('refuses another User, a Read Only member and a direct Site Admin, changing nothing', async () => {
      const { taskId } = await realTask()
      const before = await row(taskId)

      for (const refused of [stranger, readOnly, siteAdmin]) {
        const error = await services(refused)
          .ideaService.updateTask(taskId, {
            title: before.title,
            description: before.description,
            assigneeUserIds: [],
            tagNames: null,
          })
          .catch((caught: unknown) => caught)
        expect(error).toBeInstanceOf(ForbiddenError)
      }

      expect(await row(taskId)).toEqual(before)
      expect(await eventsOf(taskId, 'IdeaUpdated')).toHaveLength(0)
    })

    it('refuses with 409 while its board is archived and leaves the row as it was', async () => {
      const { child, taskId } = await realTask()
      const before = await row(taskId)
      await setArchived(child, true)

      try {
        const error = await services(admin)
          .ideaService.updateTask(taskId, EDIT())
          .catch((caught: unknown) => caught)
        expect(error).toMatchObject({ name: 'ConflictError' })
        expect(await row(taskId)).toEqual(before)
      } finally {
        await setArchived(child, false)
      }
    })

    it('answers 409 "This item is no longer a task." when the parent link was cleared after the route asked', async () => {
      const { taskId } = await realTask()
      const s = services(author, {
        afterFirstIdeaRead: async () => {
          await prisma.ideas.update({ where: { id: taskId }, data: { parent_idea_id: null } })
        },
      })
      expect(await s.ideaService.isTask(taskId)).toBe(true)

      const error = await s.ideaService
        .updateTask(taskId, EDIT())
        .catch((caught: unknown) => caught)

      expect(error).toMatchObject({
        name: 'ConflictError',
        message: 'This item is no longer a task.',
      })
      expect((await row(taskId)).title).toBe('Original task')
    })

    it('reports isTask for the real rows: true for a task, false for its parent', async () => {
      const { parent, taskId } = await realTask()
      const s = services(admin)

      expect(await s.ideaService.isTask(taskId)).toBe(true)
      expect(await s.ideaService.isTask(parent)).toBe(false)
    })

    it('exports a task row with blank Idea Type and Business Impact cells and keeps them on its parent', async () => {
      const { child, parent, taskId } = await realTask()
      const s = services(admin)

      const childExport = await s.ideaService.exportBoardIdeas(child)
      const parentBoard = (await row(parent)).board_id ?? ''
      const parentExport = await s.ideaService.exportBoardIdeas(parentBoard)

      const cells = (
        exported: Awaited<ReturnType<typeof s.ideaService.exportBoardIdeas>>,
        title: string,
        header: string,
      ) =>
        exported.rows.find((r) => r[0] === title)?.[exported.headers.indexOf(header)] as
          | string
          | undefined
      expect(taskId).toBeTruthy()
      expect(cells(childExport, 'Original task', 'Idea Type')).toBe('')
      expect(cells(childExport, 'Original task', 'Business Impact')).toBe('')
      const parentTitle = (await row(parent)).title
      expect(cells(parentExport, parentTitle, 'Idea Type')).toBe('Probe type')
      expect(cells(parentExport, parentTitle, 'Business Impact')).toBe('Probe impact')
    })
  })

  describe('metric values and the Site Admin', () => {
    const entry = { metricTypeId, projected: 10.5, realized: 8 }

    it('lets the values be written on an archived board while every other write there stays refused', async () => {
      const board = await newBoard([{ statusId: S_NEW }, { statusId: S_OUT }], true)
      const card = await newIdea({ boardId: board, statusId: S_NEW, authorId: memberId })

      const written = await services(author).metricsService.replace(card, [entry])

      expect(written).toMatchObject([{ metricTypeId, projected: 10.5, realized: 8 }])
      expect(await prisma.idea_metric_values.findMany({ where: { idea_id: card } })).toHaveLength(1)
      expect(await eventsOf(card, 'IdeaMetricsChanged')).toHaveLength(1)
      const blocked = await services(admin)
        .ideaService.changeStatus(card, { statusId: S_OUT })
        .catch((caught: unknown) => caught)
      expect(blocked).toMatchObject({ name: 'ConflictError' })
      expect((await row(card)).status_id).toBe(S_NEW)
    })

    it('answers metrics [] in the detail to a direct Site Admin, refuses the metrics route, and shows View As the values', async () => {
      const board = await newBoard([{ statusId: S_NEW }, { statusId: S_OUT }])
      const card = await newIdea({ boardId: board, statusId: S_NEW })
      await services(admin).metricsService.replace(card, [entry])

      const direct = services(siteAdmin)
      const detail = await direct.ideaService.getById(card)
      const refused = await direct.metricsService.get(card).catch((caught: unknown) => caught)
      const viewing = services(viewingAsAdmin)
      const viaViewAs = await viewing.ideaService.getById(card)

      expect(detail.metrics).toEqual([])
      expect(detail.ideaId).toBe(card)
      expect(refused).toBeInstanceOf(ForbiddenError)
      expect(viaViewAs.metrics).toMatchObject([{ metricTypeId, projected: 10.5, realized: 8 }])
      expect(await viewing.metricsService.get(card)).toHaveLength(1)
    })
  })
})
