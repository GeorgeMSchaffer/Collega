// Live-database test for PrismaIdeaDependencyRepository (SPEC/contracts/idea-dependencies.md):
// the blocker read hides soft-deleted items, deleteAllFor clears both directions, a replacement
// is one atomic unit with whatever else the request writes, and a pair can exist only once.
// Skipped unless `DATABASE_URL` is set; builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaDependencyRepository } from '../src/repositories/idea-dependency.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const STAMP = new Date('2026-09-20T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Idea dependencies, against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const adminId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const openStatus = randomUUID()
  const boardId = randomUUID()
  const stamps = { created_at_utc: STAMP, updated_at_utc: STAMP }
  const unitOfWork = new PrismaUnitOfWork(prisma)
  const dependencies = new PrismaIdeaDependencyRepository(prisma, unitOfWork)

  async function newIdea(over: { isDeleted?: boolean; itemNumber?: number; board?: string } = {}) {
    const id = randomUUID()
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: over.board ?? boardId,
        status_id: openStatus,
        title: `Probe ${id}`,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: adminId,
        is_deleted: over.isDeleted ?? false,
        item_number: over.itemNumber ?? null,
        phase: 'Discovery',
        ...stamps,
      },
    })
    return id
  }

  async function link(blockedId: string, blockerId: string) {
    await prisma.idea_dependencies.create({
      data: { blocked_idea_id: blockedId, blocker_idea_id: blockerId, created_at_utc: STAMP },
    })
  }

  const rows = async (ids: string[]) =>
    (
      await prisma.idea_dependencies.findMany({
        where: { OR: [{ blocked_idea_id: { in: ids } }, { blocker_idea_id: { in: ids } }] },
        select: { blocked_idea_id: true, blocker_idea_id: true },
      })
    )
      .map((r) => `${r.blocked_idea_id}<-${r.blocker_idea_id}`)
      .sort()

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `dep-probe-org-${marker}`,
        description: 'Dependency probe.',
        invite_code: `dep-${marker}`,
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
        email: `dep-admin-${marker}@example.test`,
        normalized_email: `DEP-ADMIN-${marker}@EXAMPLE.TEST`,
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
        id: openStatus,
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
        name: `Board ${boardId}`,
        allow_user_status_update: true,
        ...stamps,
      },
    })
  })

  afterAll(async () => {
    await prisma.idea_dependencies.deleteMany({
      where: { blocked: { organization_id: organizationId } },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  it('reads blocker facts per blocked item and leaves out soft-deleted blockers', async () => {
    const blocked = await newIdea()
    const other = await newIdea()
    const live = await newIdea({ itemNumber: 4 })
    const gone = await newIdea({ isDeleted: true })
    await link(blocked, live)
    await link(blocked, gone)
    await link(other, gone)

    const found = await dependencies.listBlockersByBlockedIds([blocked, other, randomUUID()])

    expect(found.get(blocked)).toEqual([
      { ideaId: live, boardId, statusId: openStatus, itemNumber: 4 },
    ])
    expect(found.has(other)).toBe(false)
    expect((await dependencies.listBlockersByBlockedIds([])).size).toBe(0)
  })

  it('keeps listBlockerIds as the raw stored set, ordered, deleted blockers included', async () => {
    const blocked = await newIdea()
    const a = await newIdea()
    const gone = await newIdea({ isDeleted: true })
    await link(blocked, a)
    await link(blocked, gone)

    expect(await dependencies.listBlockerIds(blocked)).toEqual([a, gone].sort())
  })

  it('lists the edges of one board, skipping a soft-deleted blocked item and other boards', async () => {
    const otherBoard = randomUUID()
    await prisma.boards.create({
      data: {
        id: otherBoard,
        organization_id: organizationId,
        name: `Board ${otherBoard}`,
        allow_user_status_update: true,
        ...stamps,
      },
    })
    const live = await newIdea()
    const liveBlocker = await newIdea()
    const goneBlocked = await newIdea({ isDeleted: true })
    const elsewhere = await newIdea({ board: otherBoard })
    const elsewhereBlocker = await newIdea({ board: otherBoard })
    await link(live, liveBlocker)
    await link(goneBlocked, liveBlocker)
    await link(elsewhere, elsewhereBlocker)

    const edges = await dependencies.listEdgesForBoard(boardId)

    expect(edges).toContainEqual({ blockedId: live, blockerId: liveBlocker })
    expect(edges.map((e) => e.blockedId)).not.toContain(goneBlocked)
    expect(edges.map((e) => e.blockedId)).not.toContain(elsewhere)
  })

  it('deleteAllFor removes the links where the item blocks and where it is blocked, and no others', async () => {
    const target = await newIdea()
    const upstream = await newIdea()
    const downstream = await newIdea()
    const bystanderA = await newIdea()
    const bystanderB = await newIdea()
    await link(target, upstream)
    await link(downstream, target)
    await link(bystanderA, bystanderB)

    await dependencies.deleteAllFor(target)
    await unitOfWork.saveChanges()

    expect(await rows([target, upstream, downstream])).toEqual([])
    expect(await rows([bystanderA, bystanderB])).toEqual([`${bystanderA}<-${bystanderB}`])
  })

  it('stages a write on the unit of work, so nothing changes until it is saved', async () => {
    const blocked = await newIdea()
    const old = await newIdea()
    const next = await newIdea()
    await link(blocked, old)

    await dependencies.replaceBlockers(blocked, [next], STAMP)
    expect(await rows([blocked])).toEqual([`${blocked}<-${old}`])

    await unitOfWork.saveChanges()
    expect(await rows([blocked])).toEqual([`${blocked}<-${next}`])
  })

  it('replaces the set: drops what is gone, adds what is new, and [] clears it', async () => {
    const blocked = await newIdea()
    const [a, b, c] = [await newIdea(), await newIdea(), await newIdea()]
    await link(blocked, a)
    await link(blocked, b)

    await dependencies.replaceBlockers(blocked, [b, c], STAMP)
    await unitOfWork.saveChanges()
    expect(await rows([blocked])).toEqual([`${blocked}<-${b}`, `${blocked}<-${c}`].sort())

    await dependencies.replaceBlockers(blocked, [], STAMP)
    await unitOfWork.saveChanges()
    expect(await rows([blocked])).toEqual([])
  })

  it('rolls the old set back when the new one cannot be written (atomic replace)', async () => {
    const blocked = await newIdea()
    const kept = await newIdea()
    await link(blocked, kept)

    // A blocker that does not exist violates the foreign key after the delete has run.
    await dependencies.replaceBlockers(blocked, [kept, randomUUID()], STAMP)
    await expect(unitOfWork.saveChanges()).rejects.toThrow()

    expect(await rows([blocked])).toEqual([`${blocked}<-${kept}`])
  })

  it('refuses the same pair twice but allows the reverse pair (the service guards cycles)', async () => {
    const blocked = await newIdea()
    const blocker = await newIdea()
    await link(blocked, blocker)

    await expect(link(blocked, blocker)).rejects.toThrow()
    // Reversed is a different pair and is the database's to allow; the service guards cycles.
    await expect(link(blocker, blocked)).resolves.toBeUndefined()
  })

  it('removes the links with the idea itself (cascade)', async () => {
    const blocked = await newIdea()
    const blocker = await newIdea()
    await link(blocked, blocker)

    await prisma.ideas.delete({ where: { id: blocker } })

    expect(await rows([blocked])).toEqual([])
  })
})
