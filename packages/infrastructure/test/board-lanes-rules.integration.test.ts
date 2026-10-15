// Live-database QA for Board References lane rules (SPEC/contracts/boards.md "Board References"):
// the rules judged against what the real repository stores - lane flags surviving the
// delete-all-then-create save, `laneInUse` counting live ideas, the archive guard and the one-level
// chain read from real rows.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { BoardService } from '@collega/application/boards'
import {
  ConflictError,
  type CurrentUserContext,
  UnprocessableError,
} from '@collega/application/common'
import { Role } from '@collega/domain/enums'
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

describe.skipIf(!DATABASE_URL)('Board lane rules against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const [S1, S2, S3] = [randomUUID(), randomUUID(), randomUUID()] as const
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }

  function service(): BoardService {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const currentUser: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    return new BoardService(
      new PrismaBoardRepository(prisma, unitOfWork),
      new PrismaStatusRepository(prisma, unitOfWork),
      new OrganizationExistenceLookupRepository(prisma),
      unitOfWork,
      { write: async () => {} },
      currentUser,
      { now: () => SAVED },
      new PrismaIdeaRepository(prisma, unitOfWork),
    )
  }

  async function newBoard(
    lanes: { statusId: string; isFinal?: boolean; referencesBoardId?: string }[] = [
      { statusId: S1 },
      { statusId: S2 },
      { statusId: S3 },
    ],
    extra: { keyPrefix?: string; nextItemNumber?: number } = {},
  ): Promise<string> {
    const id = randomUUID()
    await prisma.boards.create({
      data: {
        id,
        organization_id: organizationId,
        name: `Lanes ${id}`,
        allow_user_status_update: true,
        key_prefix: extra.keyPrefix ?? null,
        next_item_number: extra.nextItemNumber ?? 1,
        ...stamps,
        board_swimlanes: {
          create: lanes.map((lane, order) => ({
            id: randomUUID(),
            status_id: lane.statusId,
            display_order: order,
            is_final: lane.isFinal ?? false,
            references_board_id: lane.referencesBoardId ?? null,
          })),
        },
      },
    })
    return id
  }

  async function newIdea(boardId: string, statusId: string, isDeleted = false): Promise<void> {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: boardId,
        status_id: statusId,
        title: `Probe idea ${id}`,
        problem: 'Probe problem.',
        proposed_solutions: ['Probe solution.'],
        impact_rationale: 'Probe rationale.',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: isDeleted,
        phase: 'Discovery',
        ...stamps,
      },
    })
  }

  async function lanesOf(boardId: string) {
    const rows = await prisma.board_swimlanes.findMany({
      where: { board_id: boardId },
      orderBy: { display_order: 'asc' },
      select: { status_id: true, is_final: true, references_board_id: true },
    })
    return rows.map((r) => [r.status_id, r.is_final, r.references_board_id])
  }

  const body = (
    swimlanes: { statusId: string; isFinal?: boolean; referencesBoardId?: string }[],
  ) => ({
    name: 'Board',
    allowUserStatusUpdate: true,
    swimlanes: swimlanes.map((lane, order) => ({ ...lane, order })),
  })

  async function codeOf(promise: Promise<unknown>): Promise<string> {
    try {
      await promise
    } catch (error) {
      if (error instanceof UnprocessableError) {
        return error.code
      }
      throw error
    }
    return 'none'
  }

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Board lane rules probe.',
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
    for (const [order, id] of [S1, S2, S3].entries()) {
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

  it('creates a board with lane flags, flags and a prefix, and names its target', async () => {
    const target = await newBoard()

    const created = await service().create(organizationId, {
      ...body([
        { statusId: S1, referencesBoardId: target },
        { statusId: S2 },
        { statusId: S3, isFinal: true },
      ]),
      keyPrefix: 'cr1',
      sprintsEnabled: true,
    })

    expect(await lanesOf(created.boardId)).toEqual([
      [S1, false, target],
      [S2, false, null],
      [S3, true, null],
    ])
    const rows = await prisma.boards.findMany({
      where: { id: { in: [created.boardId, target] } },
      select: { id: true, key_prefix: true, sprints_enabled: true, idea_features_enabled: true },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(created.boardId)).toMatchObject({
      key_prefix: 'CR1',
      sprints_enabled: true,
      idea_features_enabled: true,
    })
    expect(byId.get(target)?.idea_features_enabled).toBe(false)
  })

  it('keeps every lane flag when only the lane order changes (reorder rebuilds the lanes)', async () => {
    const target = await newBoard()
    const id = await newBoard([
      { statusId: S1, referencesBoardId: target },
      { statusId: S2, isFinal: true },
      { statusId: S3, isFinal: true },
    ])

    await service().reorderSwimlanes(id, {
      swimlanes: [
        { statusId: S3, order: 0 },
        { statusId: S1, order: 1 },
        { statusId: S2, order: 2 },
      ],
    })

    expect(await lanesOf(id)).toEqual([
      [S3, true, null],
      [S1, false, target],
      [S2, true, null],
    ])
  })

  it('keeps lane flags when a stale-looking board is saved for another reason', async () => {
    const target = await newBoard()
    const id = await newBoard([
      { statusId: S1, referencesBoardId: target },
      { statusId: S2, isFinal: true },
    ])
    const unitOfWork = new PrismaUnitOfWork(prisma)
    const repository = new PrismaBoardRepository(prisma, unitOfWork)
    const loaded = await repository.getById(id)
    if (loaded === null) {
      throw new Error('board missing')
    }

    await repository.save({ ...loaded, name: 'Renamed' })
    await unitOfWork.saveChanges()

    expect(await lanesOf(id)).toEqual([
      [S1, false, target],
      [S2, true, null],
    ])
  })

  it('exposes keyPrefix and lane flags through getBoardContext', async () => {
    const target = await newBoard()
    const id = await newBoard(
      [
        { statusId: S1, referencesBoardId: target },
        { statusId: S2, isFinal: true },
      ],
      { keyPrefix: 'CTX' },
    )

    const context = await new PrismaBoardRepository(
      prisma,
      new PrismaUnitOfWork(prisma),
    ).getBoardContext(id)

    expect(context?.keyPrefix).toBe('CTX')
    expect(context?.swimlanes.map((l) => [l.isFinal, l.referencesBoardId])).toEqual([
      [false, target],
      [true, null],
    ])
  })

  it('refuses changing or removing a reference while the lane holds a live idea, and writes nothing', async () => {
    const target = await newBoard()
    const other = await newBoard()
    const id = await newBoard([
      { statusId: S1, referencesBoardId: target },
      { statusId: S2 },
      { statusId: S3 },
    ])
    await newIdea(id, S1)

    const change = () =>
      service().update(
        id,
        body([{ statusId: S1, referencesBoardId: other }, { statusId: S2 }, { statusId: S3 }]),
      )
    const clear = () =>
      service().update(id, body([{ statusId: S1 }, { statusId: S2 }, { statusId: S3 }]))
    const remove = () => service().update(id, body([{ statusId: S2 }, { statusId: S3 }]))

    expect(await codeOf(change())).toBe('laneInUse')
    expect(await codeOf(clear())).toBe('laneInUse')
    expect(await codeOf(remove())).toBe('laneInUse')
    expect(await lanesOf(id)).toEqual([
      [S1, false, target],
      [S2, false, null],
      [S3, false, null],
    ])
  })

  it('does not count a soft-deleted idea, so the reference can change', async () => {
    const target = await newBoard()
    const other = await newBoard()
    const id = await newBoard([{ statusId: S1, referencesBoardId: target }, { statusId: S2 }])
    await newIdea(id, S1, true)

    await service().update(id, body([{ statusId: S1, referencesBoardId: other }, { statusId: S2 }]))

    expect(await lanesOf(id)).toEqual([
      [S1, false, other],
      [S2, false, null],
    ])
  })

  it('allows giving a reference to a lane that holds ideas', async () => {
    const target = await newBoard()
    const id = await newBoard()
    await newIdea(id, S1)

    await service().update(
      id,
      body([{ statusId: S1, referencesBoardId: target }, { statusId: S2 }, { statusId: S3 }]),
    )

    expect((await lanesOf(id))[0]).toEqual([S1, false, target])
  })

  it('reads the one-level chain from stored lanes, in both directions', async () => {
    const leaf = await newBoard()
    const middle = await newBoard([{ statusId: S1, referencesBoardId: leaf }, { statusId: S2 }])
    const fresh = await newBoard()

    // `middle` is a referencer, so it cannot be a target.
    const intoReferencer = () =>
      service().update(
        fresh,
        body([{ statusId: S1, referencesBoardId: middle }, { statusId: S2 }, { statusId: S3 }]),
      )
    // `leaf` is a target, so it cannot gain a reference lane.
    const fromTarget = () =>
      service().update(
        leaf,
        body([{ statusId: S1, referencesBoardId: fresh }, { statusId: S2 }, { statusId: S3 }]),
      )

    expect(await codeOf(intoReferencer())).toBe('referenceChainNotAllowed')
    expect(await codeOf(fromTarget())).toBe('referenceChainNotAllowed')
  })

  it('refuses a missing, archived and own-board reference as 422', async () => {
    const archived = await newBoard()
    await prisma.boards.update({
      where: { id: archived },
      data: { is_archived: true, archived_at_utc: CREATED },
    })
    const id = await newBoard()
    const attempt = (target: string) =>
      codeOf(
        service().update(
          id,
          body([{ statusId: S1, referencesBoardId: target }, { statusId: S2 }, { statusId: S3 }]),
        ),
      )

    expect(await attempt(randomUUID())).toBe('referencesBoardInvalid')
    expect(await attempt(archived)).toBe('referencesBoardInvalid')
    expect(await attempt(id)).toBe('laneReferencesOwnBoard')
  })

  it('refuses archiving a referenced board as 422 and archives it once the reference is gone', async () => {
    const target = await newBoard()
    const id = await newBoard([{ statusId: S1, referencesBoardId: target }, { statusId: S2 }])

    expect(await codeOf(service().archive(target))).toBe('referenceTargetArchived')
    expect((await prisma.boards.findUniqueOrThrow({ where: { id: target } })).is_archived).toBe(
      false,
    )

    await service().update(id, body([{ statusId: S1 }, { statusId: S2 }]))
    await service().archive(target)

    expect((await prisma.boards.findUniqueOrThrow({ where: { id: target } })).is_archived).toBe(
      true,
    )
  })

  it('locks the prefix once next_item_number moves past 1, and allows it before', async () => {
    const issued = await newBoard(undefined, { keyPrefix: 'LK1', nextItemNumber: 2 })
    const fresh = await newBoard(undefined, { keyPrefix: 'LK2' })
    const lanes = body([{ statusId: S1 }, { statusId: S2 }, { statusId: S3 }])

    expect(await codeOf(service().update(issued, { ...lanes, keyPrefix: 'LK3' }))).toBe(
      'keyPrefixLocked',
    )
    await service().update(fresh, { ...lanes, keyPrefix: 'lk4' })

    const rows = await prisma.boards.findMany({
      where: { id: { in: [issued, fresh] } },
      select: { id: true, key_prefix: true },
    })
    expect(new Map(rows.map((r) => [r.id, r.key_prefix]))).toEqual(
      new Map([
        [issued, 'LK1'],
        [fresh, 'LK4'],
      ]),
    )
  })

  it('answers a duplicate prefix on create with 409', async () => {
    await newBoard(undefined, { keyPrefix: 'DUPX' })

    await expect(
      service().create(organizationId, {
        ...body([{ statusId: S1 }, { statusId: S2 }]),
        keyPrefix: 'dupx',
      }),
    ).rejects.toThrow(ConflictError)
  })
})
