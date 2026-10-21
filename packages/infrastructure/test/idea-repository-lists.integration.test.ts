// Live-database QA for `PrismaIdeaRepository.listByIds` and `listChildren` (slices 298 to 300: the
// Tasks section, the Blockers picker and `parentItemKey` read through them).
//
//  - `listByIds` answers [] for no ids, returns only the ids asked for, and skips a soft-deleted idea;
//  - `listChildren` returns a parent's live children only, oldest first, a title and then an id
//    breaking a creation-time tie, and never another parent's.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-10-15T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('PrismaIdeaRepository.listByIds and listChildren', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID()
  const organizationId = randomUUID()
  const userId = randomUUID()
  const statusId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
  const repository = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))

  async function newIdea(input: {
    id?: string
    title: string
    parentId?: string | null
    at?: Date
    isDeleted?: boolean
  }): Promise<string> {
    const id = input.id ?? randomUUID()
    const at = input.at ?? CREATED
    await prisma.ideas.create({
      data: {
        id,
        organization_id: organizationId,
        board_id: null,
        status_id: statusId,
        parent_idea_id: input.parentId ?? null,
        title: input.title,
        problem: 'p',
        proposed_solutions: ['s'],
        impact_rationale: 'r',
        priority: 'Medium',
        idea_type_id: ideaTypeId,
        business_impact_id: impactId,
        author_user_id: userId,
        is_deleted: input.isDeleted ?? false,
        phase: 'Discovery',
        effort: null,
        created_at_utc: at,
        updated_at_utc: at,
      },
    })
    return id
  }

  const secondsAfter = (seconds: number) => new Date(CREATED.getTime() + seconds * 1000)

  beforeAll(async () => {
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-lists-${marker}`,
        description: 'Idea repository lists QA probe.',
        invite_code: `probe-lists-${marker}`,
        is_archived: false,
        ...stamps,
      },
    })
    await prisma.users.create({
      data: {
        id: userId,
        organization_id: organizationId,
        first_name: 'Probe',
        last_name: 'Lists',
        email: `probe-lists-${marker}@example.test`,
        normalized_email: `PROBE-LISTS-${marker}@EXAMPLE.TEST`.toUpperCase(),
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
        name: 'Lane',
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
    await prisma.ideas.updateMany({
      where: { organization_id: organizationId },
      data: { parent_idea_id: null },
    })
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  describe('listByIds', () => {
    it('answers an empty list for no ids', async () => {
      expect(await repository.listByIds([])).toEqual([])
    })

    it('returns only the ideas asked for', async () => {
      const wanted = await newIdea({ title: 'Wanted' })
      await newIdea({ title: 'Not asked for' })

      const found = await repository.listByIds([wanted])

      expect(found.map((idea) => idea.id)).toEqual([wanted])
    })

    it('skips a soft-deleted idea and an id that does not exist', async () => {
      const live = await newIdea({ title: 'Live' })
      const gone = await newIdea({ title: 'Deleted', isDeleted: true })

      const found = await repository.listByIds([live, gone, randomUUID()])

      expect(found.map((idea) => idea.id)).toEqual([live])
    })
  })

  describe('listChildren', () => {
    it('answers an empty list for a parent with no children', async () => {
      const parent = await newIdea({ title: 'Childless' })

      expect(await repository.listChildren(parent)).toEqual([])
    })

    it('returns the live children oldest first, and never another parent’s or a deleted one', async () => {
      const parent = await newIdea({ title: 'Parent' })
      const other = await newIdea({ title: 'Other parent' })
      const second = await newIdea({ title: 'Second', parentId: parent, at: secondsAfter(20) })
      const first = await newIdea({ title: 'First', parentId: parent, at: secondsAfter(10) })
      await newIdea({
        title: 'Deleted child',
        parentId: parent,
        at: secondsAfter(5),
        isDeleted: true,
      })
      await newIdea({ title: 'Foreign child', parentId: other, at: secondsAfter(1) })

      const children = await repository.listChildren(parent)

      expect(children.map((idea) => idea.id)).toEqual([first, second])
    })

    it('breaks a creation-time tie by title, then by id', async () => {
      const parent = await newIdea({ title: 'Tie parent' })
      const tie = secondsAfter(30)
      const beta = await newIdea({ title: 'Beta', parentId: parent, at: tie })
      const alpha = await newIdea({ title: 'Alpha', parentId: parent, at: tie })
      const lowId = randomUUID().replace(/^./, '0')
      const highId = randomUUID().replace(/^./, 'f')
      await newIdea({ id: highId, title: 'Same', parentId: parent, at: tie })
      await newIdea({ id: lowId, title: 'Same', parentId: parent, at: tie })

      const children = await repository.listChildren(parent)

      expect(children.map((idea) => idea.id)).toEqual([alpha, beta, lowId, highId])
    })
  })
})
