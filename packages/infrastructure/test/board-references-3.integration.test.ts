// Live-database QA for the 2026-10-19 "Board References UI: comp U answers" backend (slice 280;
// SPEC/decisions.md answers 1, 5 and 6; contracts/boards.md, ideas.md, outcomes.md): the real
// BoardService, IdeaService and OutcomeService over the Prisma repositories.
//
//  - a lane save with `isFinal` and `referencesBoardId` is refused (422 finalLaneCannotReference)
//    on create and update, the stored board untouched, and a reorder never looks at it;
//  - an idea update with `effort` null in a reference lane is refused (422
//    effortRequiredInReferenceLane), changing it is allowed, and it is settable in any phase;
//  - auto-create fires on the first entry only: a status move, a pull and `ideaMoves` skip an idea
//    with a live task on the referenced board, and a soft-deleted task or a task on another board
//    does not count;
//  - `GET /ideas/{id}/activity`: paging, newest first with an id tie-break, only that idea's
//    events, 404s equal to the idea read, and the `IdeaMovedPastOpenTasks` metadata shape;
//  - the pull picker's `hiddenTaskCount` under every filter and the User's own-ideas restriction;
//  - an Outcome's per-idea `metrics`: active types only, in the types' order, `[]` when none, on the
//    detail, the roadmap and the ungrouped list.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organizations and removes them afterwards.
// Each call builds a FRESH set of services, because the unit of work is a command buffer. Ideas get
// distinct creation times, so oldest-first never ties.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import {
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '@collega/application/common'
import { IdeaService, type UpdateIdeaCommand } from '@collega/application/ideas'
import { OutcomeService } from '@collega/application/outcomes'
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
import { PrismaOutcomeRepository } from '../src/repositories/outcome.repository.js'
import { PrismaSprintRepository } from '../src/repositories/sprint.repository.js'
import { PrismaStatusRepository } from '../src/repositories/status.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-15T09:00:00.000Z')
const SAVED = new Date('2026-10-19T12:00:00.000Z')

const uuids = (count: number) => Array.from({ length: count }, () => randomUUID())

describe.skipIf(!DATABASE_URL)('Board References comp U backend, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const tag = marker.slice(0, 4).toUpperCase()
  const organizationId = randomUUID()
  const pullOrgId = randomUUID()
  const foreignOrgId = randomUUID()
  const orgIds = [organizationId, pullOrgId, foreignOrgId]
  const adminId = randomUUID()
  const memberId = randomUUID()
  const readOnlyId = randomUUID()
  const pullAdminId = randomUUID()
  const pullMemberId = randomUUID()
  const foreignAdminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
  const [S_NEW, S_OUT, S_AUTO, S_OPEN, S_DONE, S_PULL] = uuids(6) as [
    string,
    string,
    string,
    string,
    string,
    string,
  ]

  const ctx = (userId: string, role: Role, orgId = organizationId): CurrentUserContext => ({
    isAuthenticated: true,
    userId,
    organizationId: orgId,
    role,
    isImpersonating: false,
    realUserId: userId,
  })
  const admin = ctx(adminId, Role.OrgAdmin)
  const author = ctx(memberId, Role.User)
  const readOnly = ctx(readOnlyId, Role.ReadOnly)
  const foreignAdmin = ctx(foreignAdminId, Role.OrgAdmin, foreignOrgId)
  const siteAdmin: CurrentUserContext = {
    isAuthenticated: true,
    userId: randomUUID(),
    organizationId: null,
    role: Role.SiteAdmin,
    isImpersonating: false,
    realUserId: null,
  }

  function services(
    currentUser: CurrentUserContext = admin,
    hooks: { afterBoardsListed?: () => Promise<void> } = {},
  ) {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const boards = new PrismaBoardRepository(prisma, unitOfWork)
    if (hooks.afterBoardsListed) {
      const list = boards.listByOrganization.bind(boards)
      boards.listByOrganization = async (orgId) => {
        const listed = await list(orgId)
        await hooks.afterBoardsListed?.()
        return listed
      }
    }
    const ideas = new PrismaIdeaRepository(prisma, unitOfWork)
    const audit = new PrismaAuditEventWriter(prisma)
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
      { notify: async () => {} },
      new PrismaIdeaFollowerRepository(prisma, unitOfWork),
      new PrismaIdeaDependencyRepository(prisma, unitOfWork),
      unitOfWork,
      audit,
      currentUser,
      clock,
      { nextInt: () => 0 },
      new PrismaMetricTypeRepository(prisma, unitOfWork),
      audit,
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
    const outcomes = new PrismaOutcomeRepository(prisma, unitOfWork)
    const outcomeService = new OutcomeService(
      outcomes,
      outcomes,
      ideas,
      { listByIds: async () => [] },
      unitOfWork,
      audit,
      currentUser,
      clock,
      { nextInt: () => 0 },
    )
    return { ideaService, boardService, outcomeService }
  }

  let boardCounter = 0
  async function newBoard(
    lanes: { statusId: string; isFinal?: boolean; refs?: string; auto?: boolean }[],
    orgId = organizationId,
  ): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: orgId,
        name: `Comp U QA ${id}`,
        key_prefix: `U${++boardCounter}${tag}`,
        next_item_number: 1,
        allow_user_status_update: true,
        is_archived: false,
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
    orgId?: string
    phase?: 'Discovery' | 'Delivery'
    effort?: 'Low' | 'Medium' | 'High' | null
    isDeleted?: boolean
    outcomeId?: string
  }): Promise<string> {
    const id = randomUUID()
    const at = new Date(CREATED.getTime() + ++ideaSeq * 1000)
    await prisma.ideas.create({
      data: {
        id,
        organization_id: input.orgId ?? organizationId,
        board_id: input.boardId,
        status_id: input.statusId,
        parent_idea_id: input.parentId ?? null,
        outcome_id: input.outcomeId ?? null,
        title: input.title ?? `Comp U QA idea ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: input.authorId ?? adminId,
        is_deleted: input.isDeleted ?? false,
        phase: input.phase ?? 'Discovery',
        effort: input.effort === undefined ? 'Medium' : input.effort,
        created_at_utc: at,
        updated_at_utc: at,
      },
    })
    return id
  }

  const row = (ideaId: string) => prisma.ideas.findUniqueOrThrow({ where: { id: ideaId } })
  const tasksOf = (ideaId: string) =>
    prisma.ideas.findMany({ where: { parent_idea_id: ideaId }, orderBy: { id: 'asc' } })
  const liveTasksOf = (ideaId: string) =>
    prisma.ideas.findMany({ where: { parent_idea_id: ideaId, is_deleted: false } })
  const eventsOf = (entityId: string, eventType: string) =>
    prisma.audit_events.findMany({ where: { entity_id: entityId, event_type: eventType } })
  const laneShape = async (boardId: string) =>
    (
      await prisma.board_swimlanes.findMany({
        where: { board_id: boardId },
        orderBy: { display_order: 'asc' },
        select: { status_id: true, is_final: true, references_board_id: true },
      })
    ).map((lane) => [lane.status_id, lane.is_final, lane.references_board_id])
  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (error: unknown) => error,
    )

  const updateCommand = (
    existing: { title: string },
    effort?: string | null,
  ): UpdateIdeaCommand => ({
    title: existing.title,
    description: null,
    problem: 'p',
    proposedSolutions: ['s'],
    impactRationale: 'r',
    priority: 'Medium' as never,
    ideaTypeId,
    businessImpactId: impactId,
    dueDate: null,
    assigneeUserIds: [],
    tagNames: null,
    mentionEmails: null,
    fieldValues: null,
    ...(effort === undefined ? {} : { effort }),
  })

  beforeAll(async () => {
    for (const [id, name] of [
      [organizationId, 'main'],
      [pullOrgId, 'pull'],
      [foreignOrgId, 'foreign'],
    ] as const) {
      await prisma.organizations.create({
        data: {
          id,
          title: `probe-org-${name}-${marker}`,
          description: 'Board References comp U QA probe.',
          invite_code: `probe-${name}-${marker}`,
          is_archived: false,
          ...stamps,
        },
      })
    }
    for (const [id, orgId, role, first] of [
      [adminId, organizationId, 'OrgAdmin', 'Admin'],
      [memberId, organizationId, 'User', 'Member'],
      [readOnlyId, organizationId, 'ReadOnly', 'Viewer'],
      [pullAdminId, pullOrgId, 'OrgAdmin', 'PullAdmin'],
      [pullMemberId, pullOrgId, 'User', 'PullMember'],
      [foreignAdminId, foreignOrgId, 'OrgAdmin', 'Foreign'],
    ] as const) {
      await prisma.users.create({
        data: {
          id,
          organization_id: orgId,
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
    await prisma.statuses.create({
      data: {
        id: S_PULL,
        organization_id: pullOrgId,
        name: 'Pull lane',
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
    await prisma.audit_events.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.ideas.updateMany({
      where: { organization_id: { in: orgIds } },
      data: { parent_idea_id: null },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.outcomes.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.metric_types.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.board_swimlanes.deleteMany({
      where: { boards: { organization_id: { in: orgIds } } },
    })
    await prisma.boards.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.tags.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.idea_types.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.statuses.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.users.deleteMany({ where: { organization_id: { in: orgIds } } })
    await prisma.organizations.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  describe('a Final lane cannot reference a board', () => {
    it('refuses a board create with a Final reference lane and creates no board', async () => {
      const { child } = await boardPair()
      const before = await prisma.boards.count({ where: { organization_id: organizationId } })

      const error = await failure(
        services().boardService.create(organizationId, {
          name: 'Final reference create',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0 },
            { statusId: S_DONE, order: 1, isFinal: true, referencesBoardId: child },
          ],
        }),
      )

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
      expect(await prisma.boards.count({ where: { organization_id: organizationId } })).toBe(before)
    })

    it('refuses turning a stored reference lane Final, leaving the board and its lanes as they were', async () => {
      const { child, parentBoard } = await boardPair()
      const shape = await laneShape(parentBoard)
      const name = (await prisma.boards.findUniqueOrThrow({ where: { id: parentBoard } })).name

      const error = await failure(
        services().boardService.update(parentBoard, {
          name: 'Renamed but refused',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0 },
            { statusId: S_OUT, order: 1 },
            { statusId: S_AUTO, order: 2, isFinal: true, referencesBoardId: child },
          ],
        }),
      )

      expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
      expect(await laneShape(parentBoard)).toEqual(shape)
      expect((await prisma.boards.findUniqueOrThrow({ where: { id: parentBoard } })).name).toBe(
        name,
      )
      expect(await prisma.audit_events.count({ where: { entity_id: parentBoard } })).toBe(0)
    })

    it('is raised before autoCreateTaskRequiresReference', async () => {
      const { child, parentBoard } = await boardPair()

      const error = await failure(
        services().boardService.update(parentBoard, {
          name: 'Both rules broken',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0, autoCreateTask: true },
            { statusId: S_OUT, order: 1 },
            { statusId: S_AUTO, order: 2, isFinal: true, referencesBoardId: child },
          ],
        }),
      )

      expect(error).toMatchObject({ code: 'finalLaneCannotReference' })
    })

    it('accepts the same lane once it is Final with its reference cleared', async () => {
      const { parentBoard } = await boardPair()

      await services().boardService.update(parentBoard, {
        name: 'Final without reference',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: S_NEW, order: 0 },
          { statusId: S_OUT, order: 1 },
          { statusId: S_AUTO, order: 2, isFinal: true, referencesBoardId: null },
        ],
      })

      expect((await laneShape(parentBoard)).at(-1)).toEqual([S_AUTO, true, null])
    })

    it('does not look at the lane rules on a swimlane reorder of a stored Final reference lane', async () => {
      const child = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
      const legacy = await newBoard([
        { statusId: S_NEW },
        { statusId: S_AUTO, isFinal: true, refs: child },
      ])

      await services().boardService.reorderSwimlanes(legacy, {
        swimlanes: [
          { statusId: S_AUTO, order: 0 },
          { statusId: S_NEW, order: 1 },
        ],
      })

      expect(await laneShape(legacy)).toEqual([
        [S_AUTO, true, child],
        [S_NEW, false, null],
      ])
    })
  })

  describe('Effort cannot be cleared in a reference lane', () => {
    it('refuses effort null in a reference lane, leaving the row and the audit trail as they were', async () => {
      const { parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_AUTO, title: 'Needs effort' })
      const before = await row(id)

      const error = await failure(
        services().ideaService.update(id, updateCommand({ title: 'Needs effort' }, null)),
      )

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({ code: 'effortRequiredInReferenceLane' })
      const after = await row(id)
      expect(after.effort).toBe('Medium')
      expect(after.updated_at_utc).toEqual(before.updated_at_utc)
      expect(await prisma.audit_events.count({ where: { entity_id: id } })).toBe(0)
    })

    it('allows changing the Effort in a reference lane', async () => {
      const { parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_AUTO, title: 'Change effort' })

      await services().ideaService.update(id, updateCommand({ title: 'Change effort' }, 'High'))

      expect((await row(id)).effort).toBe('High')
    })

    it('leaves the Effort alone when the update does not mention it, in a reference lane', async () => {
      const { parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_AUTO, title: 'Silent effort' })

      await services().ideaService.update(id, updateCommand({ title: 'Silent effort' }))

      expect((await row(id)).effort).toBe('Medium')
    })

    it('allows effort null in a lane that references nothing and on a pool idea', async () => {
      const { parentBoard } = await boardPair()
      const plain = await newIdea({ boardId: parentBoard, statusId: S_NEW, title: 'Plain lane' })
      const pool = await newIdea({ boardId: null, statusId: S_NEW, title: 'Pool idea' })

      await services().ideaService.update(plain, updateCommand({ title: 'Plain lane' }, null))
      await services().ideaService.update(pool, updateCommand({ title: 'Pool idea' }, null))

      expect((await row(plain)).effort).toBeNull()
      expect((await row(pool)).effort).toBeNull()
    })

    it('allows a Delivery-phase idea to change and clear its Effort outside a reference lane', async () => {
      const { parentBoard } = await boardPair()
      const id = await newIdea({
        boardId: parentBoard,
        statusId: S_NEW,
        title: 'Delivery effort',
        phase: 'Delivery',
      })

      await services().ideaService.update(id, updateCommand({ title: 'Delivery effort' }, 'Low'))
      expect((await row(id)).effort).toBe('Low')
      await services().ideaService.update(id, updateCommand({ title: 'Delivery effort' }, null))
      expect((await row(id)).effort).toBeNull()
    })
  })

  describe('auto-create fires on the first entry only', () => {
    it('on a status move: creates the task on first entry, none on a return, and records a forced exit with its reason', async () => {
      const { child, parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_NEW, title: 'Round trip' })

      await services().ideaService.changeStatus(id, { statusId: S_AUTO })
      const [task] = await liveTasksOf(id)
      expect(task).toMatchObject({ title: 'Round trip', board_id: child, status_id: S_OPEN })

      // The open task locks the card; an Org Admin leaves with a reason, then comes back.
      await services().ideaService.changeStatus(id, {
        statusId: S_OUT,
        forceReason: 'Customer escalation',
      })
      await services().ideaService.changeStatus(id, { statusId: S_AUTO })

      expect(await liveTasksOf(id)).toHaveLength(1)
      expect(await tasksOf(id)).toHaveLength(1)
      expect(await eventsOf(task?.id ?? '', 'BoardTaskCreated')).toHaveLength(1)
      expect((await row(id)).status_id).toBe(S_AUTO)
      expect(await eventsOf(id, 'IdeaStatusChanged')).toHaveLength(3)
    })

    it('on a status move: a finished task still counts, so a return creates nothing', async () => {
      const { parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_NEW })
      await services().ideaService.changeStatus(id, { statusId: S_AUTO })
      const [task] = await liveTasksOf(id)
      await prisma.ideas.update({ where: { id: task?.id ?? '' }, data: { status_id: S_DONE } })

      await services().ideaService.changeStatus(id, { statusId: S_OUT })
      await services().ideaService.changeStatus(id, { statusId: S_AUTO })

      expect(await tasksOf(id)).toHaveLength(1)
    })

    it('on a status move: a deleted task does not count, so the entry creates a new one', async () => {
      const { child, parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      const deleted = await newIdea({
        boardId: child,
        statusId: S_OPEN,
        parentId: id,
        isDeleted: true,
        title: 'Deleted task',
      })

      await services().ideaService.changeStatus(id, { statusId: S_AUTO })

      const live = await liveTasksOf(id)
      expect(live).toHaveLength(1)
      expect(live[0]?.id).not.toBe(deleted)
      expect(await tasksOf(id)).toHaveLength(2)
    })

    it('on a status move: a task on another board does not count', async () => {
      const { child, parentBoard } = await boardPair()
      const elsewhere = await newBoard([{ statusId: S_OPEN }, { statusId: S_DONE, isFinal: true }])
      const id = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      await newIdea({ boardId: elsewhere, statusId: S_OPEN, parentId: id })

      await services().ideaService.changeStatus(id, { statusId: S_AUTO })

      const onChild = (await liveTasksOf(id)).filter((t) => t.board_id === child)
      expect(onChild).toHaveLength(1)
    })

    it('on a status move: a task in the referenced board’s final lane counts', async () => {
      const { child, parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      const done = await newIdea({ boardId: child, statusId: S_DONE, parentId: id })

      await services().ideaService.changeStatus(id, { statusId: S_AUTO })

      expect((await tasksOf(id)).map((t) => t.id)).toEqual([done])
      expect((await row(id)).status_id).toBe(S_AUTO)
    })

    it('on a status move: still rolls the move back when the first task is refused', async () => {
      const { child, parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_OUT })
      await prisma.boards.update({ where: { id: child }, data: { is_archived: true } })

      try {
        const error = await failure(services().ideaService.changeStatus(id, { statusId: S_AUTO }))

        expect(error).toMatchObject({ code: 'referencedBoardArchived' })
        expect((await row(id)).status_id).toBe(S_OUT)
        expect(await tasksOf(id)).toHaveLength(0)
        expect(await prisma.audit_events.count({ where: { entity_id: id } })).toBe(0)
      } finally {
        await prisma.boards.update({ where: { id: child }, data: { is_archived: false } })
      }
    })

    describe('on a pull (pullItemIds)', () => {
      const lanes = (child: string) => [
        { statusId: S_NEW, order: 0 },
        { statusId: S_OUT, order: 1 },
        { statusId: S_AUTO, order: 2, referencesBoardId: child, autoCreateTask: true },
      ]

      it('at board update: pulls a holder of a live task without a new task, and a card with none with one', async () => {
        const { child, parentBoard } = await boardPair()
        const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
        const holder = await newIdea({ boardId: source, statusId: S_AUTO, title: 'Holder' })
        const existing = await newIdea({ boardId: child, statusId: S_OPEN, parentId: holder })
        const first = await newIdea({ boardId: source, statusId: S_AUTO, title: 'First entry' })

        const result = await services().boardService.update(parentBoard, {
          name: 'Pull skip',
          allowUserStatusUpdate: true,
          swimlanes: lanes(child),
          pullItemIds: [holder, first],
        })

        expect(result.pulledItems).toHaveLength(2)
        expect(await row(holder)).toMatchObject({ board_id: parentBoard, status_id: S_AUTO })
        expect((await tasksOf(holder)).map((t) => t.id)).toEqual([existing])
        expect(await eventsOf(existing, 'BoardTaskCreated')).toHaveLength(0)
        const created = await tasksOf(first)
        expect(created).toHaveLength(1)
        expect(created[0]).toMatchObject({ title: 'First entry', board_id: child })
      })

      it('at board update: a deleted task does not count, so the pulled card gets a task', async () => {
        const { child, parentBoard } = await boardPair()
        const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
        const card = await newIdea({ boardId: source, statusId: S_AUTO })
        await newIdea({ boardId: child, statusId: S_OPEN, parentId: card, isDeleted: true })

        await services().boardService.update(parentBoard, {
          name: 'Pull deleted',
          allowUserStatusUpdate: true,
          swimlanes: lanes(child),
          pullItemIds: [card],
        })

        expect(await liveTasksOf(card)).toHaveLength(1)
        expect(await tasksOf(card)).toHaveLength(2)
      })

      it('at board create: a deleted task does not count either', async () => {
        const { child } = await boardPair()
        const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
        const card = await newIdea({ boardId: source, statusId: S_AUTO })
        await newIdea({ boardId: child, statusId: S_OPEN, parentId: card, isDeleted: true })

        await services().boardService.create(organizationId, {
          name: 'Create deleted',
          allowUserStatusUpdate: true,
          swimlanes: [
            { statusId: S_NEW, order: 0 },
            { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
          ],
          pullItemIds: [card],
        })

        expect(await liveTasksOf(card)).toHaveLength(1)
      })

      it('at board update: still rolls the save back when a first task is refused', async () => {
        const { child, parentBoard } = await boardPair()
        const source = await newBoard([{ statusId: S_NEW }, { statusId: S_AUTO }])
        const card = await newIdea({ boardId: source, statusId: S_AUTO })

        try {
          const error = await failure(
            services(admin, {
              afterBoardsListed: () =>
                prisma.boards
                  .update({ where: { id: child }, data: { is_archived: true } })
                  .then(() => undefined),
            }).boardService.update(parentBoard, {
              name: 'Pull refused',
              allowUserStatusUpdate: true,
              swimlanes: lanes(child),
              pullItemIds: [card],
            }),
          )

          expect(error).toMatchObject({ code: 'referencedBoardArchived' })
          expect((await row(card)).board_id).toBe(source)
          expect(await tasksOf(card)).toHaveLength(0)
        } finally {
          await prisma.boards.update({ where: { id: child }, data: { is_archived: false } })
        }
      })
    })

    describe('on a bulk lane move (ideaMoves)', () => {
      /** Removes the plain S_OUT lane, sending its cards into the auto-create S_AUTO. */
      const removeOut = (child: string) => ({
        name: 'Moves',
        allowUserStatusUpdate: true,
        swimlanes: [
          { statusId: S_NEW, order: 0 },
          { statusId: S_AUTO, order: 1, referencesBoardId: child, autoCreateTask: true },
        ],
        ideaMoves: [{ fromStatusId: S_OUT, toStatusId: S_AUTO }],
      })

      it('moves a holder of a live task without a new task and gives the others their one', async () => {
        const { child, parentBoard } = await boardPair()
        const holder = await newIdea({ boardId: parentBoard, statusId: S_OUT, title: 'Holder' })
        const existing = await newIdea({ boardId: child, statusId: S_OPEN, parentId: holder })
        const fresh = await newIdea({ boardId: parentBoard, statusId: S_OUT, title: 'Fresh' })

        await services().boardService.update(parentBoard, removeOut(child))

        expect((await row(holder)).status_id).toBe(S_AUTO)
        expect((await row(fresh)).status_id).toBe(S_AUTO)
        expect((await tasksOf(holder)).map((t) => t.id)).toEqual([existing])
        expect(await eventsOf(existing, 'BoardTaskCreated')).toHaveLength(0)
        expect(await tasksOf(fresh)).toHaveLength(1)
        expect(await eventsOf(holder, 'IdeaStatusChanged')).toHaveLength(1)
      })

      it('counts a task in the referenced final lane, and ignores a deleted one and one on another board', async () => {
        const { child, parentBoard } = await boardPair()
        const elsewhere = await newBoard([{ statusId: S_OPEN }])
        const finished = await newIdea({ boardId: parentBoard, statusId: S_OUT })
        await newIdea({ boardId: child, statusId: S_DONE, parentId: finished })
        const deletedOnly = await newIdea({ boardId: parentBoard, statusId: S_OUT })
        await newIdea({ boardId: child, statusId: S_OPEN, parentId: deletedOnly, isDeleted: true })
        const otherBoardOnly = await newIdea({ boardId: parentBoard, statusId: S_OUT })
        await newIdea({ boardId: elsewhere, statusId: S_OPEN, parentId: otherBoardOnly })

        await services().boardService.update(parentBoard, removeOut(child))

        expect(await tasksOf(finished)).toHaveLength(1)
        expect(await liveTasksOf(deletedOnly)).toHaveLength(1)
        expect(
          (await liveTasksOf(otherBoardOnly)).filter((t) => t.board_id === child),
        ).toHaveLength(1)
      })

      it('still rolls the whole save back when a first task is refused, even beside a skipped holder', async () => {
        const { child, parentBoard } = await boardPair()
        const holder = await newIdea({ boardId: parentBoard, statusId: S_OUT })
        await newIdea({ boardId: child, statusId: S_OPEN, parentId: holder })
        const fresh = await newIdea({ boardId: parentBoard, statusId: S_OUT })

        try {
          const error = await failure(
            services(admin, {
              afterBoardsListed: () =>
                prisma.boards
                  .update({ where: { id: child }, data: { is_archived: true } })
                  .then(() => undefined),
            }).boardService.update(parentBoard, removeOut(child)),
          )

          expect(error).toMatchObject({ code: 'referencedBoardArchived' })
          expect((await laneShape(parentBoard)).map((l) => l[0])).toEqual([S_NEW, S_OUT, S_AUTO])
          expect((await row(holder)).status_id).toBe(S_OUT)
          expect((await row(fresh)).status_id).toBe(S_OUT)
          expect(await tasksOf(fresh)).toHaveLength(0)
        } finally {
          await prisma.boards.update({ where: { id: child }, data: { is_archived: false } })
        }
      })
    })
  })

  describe('GET /ideas/{id}/activity', () => {
    let seq = 0
    async function seedEvent(input: {
      entityId: string | null
      entityType?: string
      message: string
      at: Date
      id?: string
      metadataJson?: string | null
      actor?: string | null
      onBehalfOf?: string | null
      type?: string
    }) {
      await prisma.audit_events.create({
        data: {
          id: input.id ?? randomUUID(),
          organization_id: organizationId,
          actor_user_id: input.actor ?? null,
          event_type: input.type ?? 'IdeaStatusChanged',
          entity_type: input.entityType ?? 'Idea',
          entity_id: input.entityId,
          message: input.message,
          metadata_json: input.metadataJson ?? null,
          occurred_at_utc: input.at,
          on_behalf_of_user_id: input.onBehalfOf ?? null,
        },
      })
      seq++
    }
    const at = (seconds: number) => new Date(Date.UTC(2026, 9, 18, 10, 0, seconds))
    const messages = (page: { items: readonly { message: string }[] }) =>
      page.items.map((i) => i.message)

    it('pages newest first, breaking a timestamp tie on the event id, counting only this idea', async () => {
      const target = await newIdea({ boardId: null, statusId: S_NEW, title: 'Activity target' })
      const other = await newIdea({ boardId: null, statusId: S_NEW, title: 'Activity other' })
      const [low, mid, high] = uuids(3).sort() as [string, string, string]
      await seedEvent({ entityId: target, message: 'first', at: at(0) })
      await seedEvent({ entityId: target, message: 'second', at: at(1) })
      // Inserted out of id order on purpose.
      await seedEvent({ entityId: target, message: 'tie-mid', at: at(2), id: mid })
      await seedEvent({ entityId: target, message: 'tie-high', at: at(2), id: high })
      await seedEvent({ entityId: target, message: 'tie-low', at: at(2), id: low })
      await seedEvent({ entityId: other, message: 'other idea', at: at(9) })
      await seedEvent({
        entityId: target,
        entityType: 'Board',
        message: 'same id, a board',
        at: at(9),
      })
      await seedEvent({ entityId: null, message: 'no entity', at: at(9) })
      const { ideaService } = services()
      const request = (page: number, pageSize: number) =>
        ideaService.listActivity(target, { page, pageSize })

      const all = await request(1, 20)
      const first = await request(1, 2)
      const second = await request(2, 2)
      const third = await request(3, 2)
      const beyond = await request(4, 2)

      expect(messages(all)).toEqual(['tie-high', 'tie-mid', 'tie-low', 'second', 'first'])
      expect(all).toMatchObject({ page: 1, pageSize: 20, totalCount: 5 })
      expect(messages(first)).toEqual(['tie-high', 'tie-mid'])
      expect(messages(second)).toEqual(['tie-low', 'second'])
      expect(messages(third)).toEqual(['first'])
      expect(beyond.items).toEqual([])
      for (const page of [first, second, third, beyond]) {
        expect(page.totalCount).toBe(5)
      }
      expect(await ideaService.listActivity(target, { page: null, pageSize: 1000 })).toMatchObject({
        pageSize: 100,
        totalCount: 5,
      })
      expect(await ideaService.listActivity(target, { page: 0, pageSize: 0 })).toMatchObject({
        page: 1,
        pageSize: 1,
      })
      expect(seq).toBeGreaterThan(0)
    })

    it('answers every field of an entry, and a metadata object only when the stored text is one', async () => {
      const target = await newIdea({ boardId: null, statusId: S_NEW, title: 'Shape target' })
      const variants: [string, string | null][] = [
        ['object', '{"reason":"Escalation","openTaskCount":3}'],
        ['null', null],
        ['not json', 'not json'],
        ['array', '[1,2]'],
        ['string', '"text"'],
        ['number', '5'],
        ['json null', 'null'],
      ]
      for (const [index, [message, metadataJson]] of variants.entries()) {
        await seedEvent({
          entityId: target,
          message,
          at: at(index),
          metadataJson,
          actor: adminId,
          onBehalfOf: memberId,
          type: 'IdeaMovedPastOpenTasks',
        })
      }

      const page = await services().ideaService.listActivity(target, { page: 1, pageSize: 50 })

      const byMessage = new Map(page.items.map((i) => [i.message, i]))
      expect(byMessage.get('object')).toEqual({
        eventType: 'IdeaMovedPastOpenTasks',
        message: 'object',
        occurredAtUtc: at(0),
        actorUserId: adminId,
        onBehalfOfUserId: memberId,
        metadata: { reason: 'Escalation', openTaskCount: 3 },
      })
      for (const message of ['null', 'not json', 'array', 'string', 'number', 'json null']) {
        expect(byMessage.get(message)?.metadata, message).toBeNull()
      }
    })

    it('carries the lock override as IdeaMovedPastOpenTasks with { reason, openTaskCount } and the audited actor', async () => {
      const { parentBoard } = await boardPair()
      const id = await newIdea({ boardId: parentBoard, statusId: S_NEW, title: 'Override trail' })
      await services().ideaService.changeStatus(id, { statusId: S_AUTO })
      await services().ideaService.changeStatus(id, {
        statusId: S_OUT,
        forceReason: 'Customer escalation',
      })

      const page = await services().ideaService.listActivity(id, { page: null, pageSize: null })

      const moved = page.items.find((i) => i.eventType === 'IdeaMovedPastOpenTasks')
      expect(moved?.metadata).toEqual({ reason: 'Customer escalation', openTaskCount: 1 })
      expect(moved?.message).toContain('1')
      expect(moved?.actorUserId).toBe(adminId)
      expect(moved?.occurredAtUtc).toEqual(SAVED)
      expect(page.items.map((i) => i.eventType)).toEqual(
        expect.arrayContaining(['IdeaStatusChanged', 'IdeaMovedPastOpenTasks']),
      )
    })

    it('has the scope and 404s of the idea read, and leaks nothing across organizations', async () => {
      const target = await newIdea({ boardId: null, statusId: S_NEW, title: 'Scope target' })
      const gone = await newIdea({
        boardId: null,
        statusId: S_NEW,
        title: 'Scope deleted',
        isDeleted: true,
      })
      await seedEvent({ entityId: target, message: 'secret', at: at(0) })
      await seedEvent({ entityId: gone, message: 'of a deleted idea', at: at(0) })
      const none = { page: null, pageSize: null }

      for (const reader of [admin, author, readOnly, siteAdmin]) {
        const page = await services(reader).ideaService.listActivity(target, none)
        expect(messages(page)).toEqual(['secret'])
        await expect(services(reader).ideaService.getById(target)).resolves.toBeDefined()
      }
      expect(
        await failure(services(foreignAdmin).ideaService.listActivity(target, none)),
      ).toBeInstanceOf(NotFoundError)
      expect(await failure(services(foreignAdmin).ideaService.getById(target))).toBeInstanceOf(
        NotFoundError,
      )
      expect(await failure(services().ideaService.listActivity(gone, none))).toBeInstanceOf(
        NotFoundError,
      )
      expect(await failure(services().ideaService.listActivity(randomUUID(), none))).toBeInstanceOf(
        NotFoundError,
      )
    })
  })

  describe('the pull picker: hiddenTaskCount', () => {
    const pullStamps = (n: number) => {
      const at = new Date(CREATED.getTime() + n * 1000)
      return { created_at_utc: at, updated_at_utc: at }
    }
    const ids = {
      boardX: randomUUID(),
      boardY: randomUUID(),
      poolIdea: randomUUID(),
      xIdea: randomUUID(),
      yIdea: randomUUID(),
      backlogIdea: randomUUID(),
      tXMember: randomUUID(),
      tYAdmin: randomUUID(),
      tXAdmin: randomUUID(),
      tBacklog: randomUUID(),
      tDeleted: randomUUID(),
      tPool: randomUUID(),
      tForeign: randomUUID(),
      foreignParent: randomUUID(),
      tagRed: randomUUID(),
      tagBlue: randomUUID(),
    }

    async function pullIdea(
      id: string,
      data: {
        title: string
        author: string
        board: string | null
        parent?: string
        phase?: 'Discovery' | 'Delivery'
        deleted?: boolean
        org?: string
        n: number
        tags?: string[]
      },
    ) {
      await prisma.ideas.create({
        data: {
          id,
          organization_id: data.org ?? pullOrgId,
          board_id: data.board,
          status_id: S_PULL,
          parent_idea_id: data.parent ?? null,
          title: data.title,
          problem: 'p',
          proposed_solutions: ['s'],
          impact_rationale: 'r',
          priority: 'Medium',
          idea_type_id: ideaTypeId,
          business_impact_id: impactId,
          author_user_id: data.author,
          is_deleted: data.deleted ?? false,
          phase: data.phase ?? 'Discovery',
          effort: 'Medium',
          ...pullStamps(data.n),
        },
      })
      for (const tagId of data.tags ?? []) {
        await prisma.idea_tags.create({ data: { id: randomUUID(), idea_id: id, tag_id: tagId } })
      }
    }

    beforeAll(async () => {
      for (const [id, name] of [
        [ids.tagRed, 'red'],
        [ids.tagBlue, 'blue'],
      ] as const) {
        await prisma.tags.create({
          data: {
            id,
            organization_id: pullOrgId,
            name,
            normalized_name: name,
            color: '#aa0000',
            ...stamps,
          },
        })
      }
      for (const id of [ids.boardX, ids.boardY]) {
        await prisma.boards.create({
          data: {
            id,
            organization_id: pullOrgId,
            name: `Pull board ${id}`,
            allow_user_status_update: true,
            ...stamps,
            board_swimlanes: {
              create: [{ id: randomUUID(), status_id: S_PULL, display_order: 0, is_final: false }],
            },
          },
        })
      }
      const A = pullAdminId
      const M = pullMemberId
      await pullIdea(ids.poolIdea, { title: 'Alpha pool', author: A, board: null, n: 1 })
      await pullIdea(ids.xIdea, {
        title: 'Alpha boardx',
        author: M,
        board: ids.boardX,
        n: 2,
        tags: [ids.tagRed],
      })
      await pullIdea(ids.yIdea, { title: 'Beta boardy', author: A, board: ids.boardY, n: 3 })
      await pullIdea(ids.backlogIdea, {
        title: 'Gamma backlog',
        author: A,
        board: null,
        phase: 'Delivery',
        n: 4,
      })
      await pullIdea(ids.tXMember, {
        title: 'Alpha task one',
        author: M,
        board: ids.boardX,
        parent: ids.xIdea,
        n: 5,
        tags: [ids.tagRed],
      })
      await pullIdea(ids.tYAdmin, {
        title: 'Beta task two',
        author: A,
        board: ids.boardY,
        parent: ids.yIdea,
        n: 6,
      })
      await pullIdea(ids.tXAdmin, {
        title: 'Alpha task three',
        author: A,
        board: ids.boardX,
        parent: ids.xIdea,
        n: 7,
        tags: [ids.tagBlue],
      })
      await pullIdea(ids.tBacklog, {
        title: 'Gamma task',
        author: A,
        board: ids.boardY,
        parent: ids.backlogIdea,
        phase: 'Delivery',
        n: 8,
      })
      await pullIdea(ids.tDeleted, {
        title: 'Alpha task deleted',
        author: A,
        board: ids.boardX,
        parent: ids.xIdea,
        deleted: true,
        n: 9,
      })
      await pullIdea(ids.tPool, {
        title: 'Alpha pool task',
        author: A,
        board: null,
        parent: ids.poolIdea,
        n: 10,
      })
      // Another organization's task with a matching title must never be counted.
      await pullIdea(ids.foreignParent, {
        title: 'Alpha foreign parent',
        author: foreignAdminId,
        board: null,
        org: foreignOrgId,
        n: 11,
      })
      await pullIdea(ids.tForeign, {
        title: 'Alpha foreign task',
        author: foreignAdminId,
        board: null,
        parent: ids.foreignParent,
        org: foreignOrgId,
        n: 12,
      })
    })

    const pullAdmin = ctx(pullAdminId, Role.OrgAdmin, pullOrgId)
    const pullMember = ctx(pullMemberId, Role.User, pullOrgId)
    const query = (overrides: Record<string, unknown> = {}) => ({
      source: 'boards',
      excludeBoardId: null,
      search: null,
      tags: [] as string[],
      authorUserId: null,
      page: null,
      pageSize: null,
      ...overrides,
    })
    const read = (user: CurrentUserContext, overrides: Record<string, unknown> = {}) =>
      services(user).boardService.listPullCandidates(pullOrgId, query(overrides))
    const summary = (page: {
      items: readonly { ideaId: string }[]
      totalCount: number
      hiddenTaskCount: number
    }) => ({
      items: page.items.map((i) => i.ideaId),
      total: page.totalCount,
      hidden: page.hiddenTaskCount,
    })

    it('counts the live tasks of each tab and never a deleted or another organization task', async () => {
      expect(summary(await read(pullAdmin, { source: 'boards' }))).toEqual({
        items: [ids.xIdea, ids.yIdea],
        total: 2,
        hidden: 3,
      })
      expect(summary(await read(pullAdmin, { source: 'unassigned' }))).toEqual({
        items: [ids.poolIdea],
        total: 1,
        hidden: 1,
      })
      expect(summary(await read(pullAdmin, { source: 'backlog' }))).toEqual({
        items: [ids.backlogIdea],
        total: 1,
        hidden: 1,
      })
    })

    it('narrows the count by excludeBoardId', async () => {
      const page = await read(pullAdmin, { source: 'boards', excludeBoardId: ids.boardX })

      expect(summary(page)).toEqual({ items: [ids.yIdea], total: 1, hidden: 1 })
      // A pool task has no board, so excluding a board never removes it.
      expect(
        (await read(pullAdmin, { source: 'unassigned', excludeBoardId: ids.boardX }))
          .hiddenTaskCount,
      ).toBe(1)
    })

    it('narrows the count by search, matching the title text and escaping wildcards', async () => {
      expect(summary(await read(pullAdmin, { search: 'Alpha' }))).toEqual({
        items: [ids.xIdea],
        total: 1,
        hidden: 2,
      })
      expect(summary(await read(pullAdmin, { search: 'task two' }))).toEqual({
        items: [],
        total: 0,
        hidden: 1,
      })
      expect((await read(pullAdmin, { search: 'zzz-no-match' })).hiddenTaskCount).toBe(0)
      expect((await read(pullAdmin, { search: '%' })).hiddenTaskCount).toBe(0)
      expect(
        (await read(pullAdmin, { search: 'Alpha pool task', source: 'unassigned' }))
          .hiddenTaskCount,
      ).toBe(1)
    })

    it('narrows the count by tag, any of the tags named', async () => {
      expect((await read(pullAdmin, { tags: ['red'] })).hiddenTaskCount).toBe(1)
      expect((await read(pullAdmin, { tags: ['blue'] })).hiddenTaskCount).toBe(1)
      expect((await read(pullAdmin, { tags: ['red', 'blue'] })).hiddenTaskCount).toBe(2)
      expect((await read(pullAdmin, { tags: ['nope'] })).hiddenTaskCount).toBe(0)
      expect(summary(await read(pullAdmin, { tags: ['red'] })).items).toEqual([ids.xIdea])
    })

    it('narrows the count by the task author, as an Org Admin may', async () => {
      expect(summary(await read(pullAdmin, { authorUserId: pullAdminId }))).toEqual({
        items: [ids.yIdea],
        total: 1,
        hidden: 2,
      })
      expect(summary(await read(pullAdmin, { authorUserId: pullMemberId }))).toEqual({
        items: [ids.xIdea],
        total: 1,
        hidden: 1,
      })
    })

    it('counts under all the filters together', async () => {
      const page = await read(pullAdmin, {
        search: 'Alpha',
        authorUserId: pullAdminId,
        excludeBoardId: ids.boardY,
        tags: ['blue'],
      })

      expect(summary(page)).toEqual({ items: [], total: 0, hidden: 1 })
    })

    it('does not let paging change the count', async () => {
      const page = await read(pullAdmin, { pageSize: 1, page: 2 })

      expect(page).toMatchObject({ page: 2, pageSize: 1, totalCount: 2, hiddenTaskCount: 3 })
      expect(page.items.map((i) => i.ideaId)).toEqual([ids.yIdea])
    })

    it('counts only the User’s own tasks, whatever author they ask for', async () => {
      expect(summary(await read(pullMember, { source: 'boards' }))).toEqual({
        items: [ids.xIdea],
        total: 1,
        hidden: 1,
      })
      expect(
        (await read(pullMember, { source: 'boards', authorUserId: pullAdminId })).hiddenTaskCount,
      ).toBe(1)
      expect(summary(await read(pullMember, { source: 'unassigned' }))).toEqual({
        items: [],
        total: 0,
        hidden: 0,
      })
    })

    it('still refuses the backlog tab to a User and another organization to everyone', async () => {
      expect(await failure(read(pullMember, { source: 'backlog' }))).toBeInstanceOf(ForbiddenError)
      expect(
        await failure(services(foreignAdmin).boardService.listPullCandidates(pullOrgId, query())),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('Outcome per-idea metrics', () => {
    const T1 = new Date('2026-10-10T08:00:00.000Z')
    const T2 = new Date('2026-10-11T08:00:00.000Z')
    const [tieLow, tieHigh] = uuids(2).sort() as [string, string]
    const mt = {
      first: randomUUID(),
      tieLow,
      tieHigh,
      archived: randomUUID(),
    }
    const outcomeId = randomUUID()
    const emptyOutcomeId = randomUUID()
    let withValues = ''
    let withNone = ''
    let onlyArchived = ''
    let ungrouped = ''

    async function value(
      ideaId: string,
      typeId: string,
      projected: string | null,
      realized: string | null,
    ) {
      await prisma.idea_metric_values.create({
        data: { idea_id: ideaId, metric_type_id: typeId, projected, realized },
      })
    }

    beforeAll(async () => {
      const type = (id: string, name: string, at: Date, archived = false) =>
        prisma.metric_types.create({
          data: {
            metric_type_id: id,
            organization_id: organizationId,
            name,
            unit: '$',
            is_archived: archived,
            created_at_utc: at,
            updated_at_utc: at,
          },
        })
      // Inserted newest first and the tied pair high first, so only the ORDER BY can order them.
      await type(mt.tieHigh, 'Tie high', T2)
      await type(mt.tieLow, 'Tie low', T2)
      await type(mt.first, 'Earliest', T1)
      await type(mt.archived, 'Archived', new Date('2026-10-01T08:00:00.000Z'), true)
      for (const [id, order] of [
        [outcomeId, 0],
        [emptyOutcomeId, 1],
      ] as const) {
        await prisma.outcomes.create({
          data: {
            id,
            organization_id: organizationId,
            name: `Metrics outcome ${order}`,
            target_start_date: new Date('2026-10-01T00:00:00.000Z'),
            target_end_date: new Date('2026-12-31T00:00:00.000Z'),
            sort_order: order + 100,
            color: '#112233',
            is_deleted: false,
            ...stamps,
          },
        })
      }
      const { parentBoard } = await boardPair()
      withValues = await newIdea({
        boardId: parentBoard,
        statusId: S_NEW,
        outcomeId,
        title: 'Has values',
      })
      withNone = await newIdea({
        boardId: parentBoard,
        statusId: S_NEW,
        outcomeId,
        title: 'Has none',
      })
      onlyArchived = await newIdea({
        boardId: parentBoard,
        statusId: S_NEW,
        outcomeId,
        title: 'Only archived',
      })
      ungrouped = await newIdea({
        boardId: parentBoard,
        statusId: S_NEW,
        title: 'Ungrouped values',
      })
      await value(withValues, mt.tieHigh, '5.50', null)
      await value(withValues, mt.first, '100.00', '0.00')
      await value(withValues, mt.tieLow, null, '-3.25')
      await value(withValues, mt.archived, '9.00', '9.00')
      await value(onlyArchived, mt.archived, '1.00', '2.00')
      await value(ungrouped, mt.tieLow, '7.00', null)
      await value(ungrouped, mt.archived, '8.00', null)
    })

    const expectedValues = [
      { metricTypeId: mt.first, projected: 100, realized: 0 },
      { metricTypeId: mt.tieLow, projected: null, realized: -3.25 },
      { metricTypeId: mt.tieHigh, projected: 5.5, realized: null },
    ]

    it('lists active types only, in the types’ order with ties on the type id, on the detail', async () => {
      const detail = await services().outcomeService.get(organizationId, outcomeId)

      const byId = new Map(detail.ideas.map((i) => [i.ideaId, i]))
      expect(byId.get(withValues)?.metrics).toEqual(expectedValues)
      expect(Object.keys(byId.get(withValues)?.metrics[0] ?? {}).sort()).toEqual([
        'metricTypeId',
        'projected',
        'realized',
      ])
    })

    it('answers [] for an idea with no values and for one holding only archived types', async () => {
      const detail = await services().outcomeService.get(organizationId, outcomeId)

      const byId = new Map(detail.ideas.map((i) => [i.ideaId, i]))
      expect(byId.get(withNone)?.metrics).toEqual([])
      expect(byId.get(onlyArchived)?.metrics).toEqual([])
    })

    it('answers [] on an Outcome with no ideas, and carries the same values on the roadmap', async () => {
      const roadmap = await services().outcomeService.roadmap(organizationId)

      const grouped = roadmap.outcomes.find((o) => o.outcomeId === outcomeId)
      expect(grouped?.ideas.find((i) => i.ideaId === withValues)?.metrics).toEqual(expectedValues)
      expect(grouped?.ideas.find((i) => i.ideaId === withNone)?.metrics).toEqual([])
      expect(roadmap.outcomes.find((o) => o.outcomeId === emptyOutcomeId)?.ideas).toEqual([])
    })

    it('carries the field on the ungrouped list, active types only', async () => {
      const roadmap = await services().outcomeService.roadmap(organizationId)

      const item = roadmap.ungrouped.find((i) => i.ideaId === ungrouped)
      expect(item?.metrics).toEqual([{ metricTypeId: mt.tieLow, projected: 7, realized: null }])
      for (const i of roadmap.ungrouped) {
        expect(Array.isArray(i.metrics)).toBe(true)
      }
    })

    it('follows a type being archived and restored', async () => {
      await prisma.metric_types.update({
        where: { metric_type_id: mt.first },
        data: { is_archived: true },
      })
      try {
        const archivedRead = await services().outcomeService.get(organizationId, outcomeId)
        expect(
          archivedRead.ideas
            .find((i) => i.ideaId === withValues)
            ?.metrics.map((m) => m.metricTypeId),
        ).toEqual([mt.tieLow, mt.tieHigh])
      } finally {
        await prisma.metric_types.update({
          where: { metric_type_id: mt.first },
          data: { is_archived: false },
        })
      }
      const restored = await services().outcomeService.get(organizationId, outcomeId)
      expect(restored.ideas.find((i) => i.ideaId === withValues)?.metrics).toEqual(expectedValues)
    })

    it('leaves a soft-deleted idea out and does not read another organization’s values', async () => {
      const gone = await newIdea({
        boardId: null,
        statusId: S_NEW,
        outcomeId,
        title: 'Deleted with values',
        isDeleted: true,
      })
      await value(gone, mt.first, '1.00', '1.00')

      const detail = await services().outcomeService.get(organizationId, outcomeId)

      expect(detail.ideas.map((i) => i.ideaId)).not.toContain(gone)
      expect(
        await failure(services(foreignAdmin).outcomeService.get(organizationId, outcomeId)),
      ).toBeInstanceOf(NotFoundError)
    })
  })
})
