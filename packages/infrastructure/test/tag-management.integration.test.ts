// Settings → Tags against a live Postgres (SPEC/20-feature-ideas-and-engagement.md Tags rules 13-15,
// SPEC/30-Contracts.md "Tag colour and management"). What only a real database can show: the
// grouped usage query counts live ideas in both phases and on archived boards, in one query for any
// number of tags; the unique index answers a concurrent duplicate name as the field-keyed 400; a
// tag that vanished mid-write is a 404; and a delete removes every link - soft-deleted ideas
// included, which the foreign key would otherwise refuse - without touching the ideas.
//
// Skipped unless `DATABASE_URL` is set. Borrows a seeded organization's statuses, idea type,
// business impact and a user; creates its own boards, tags and ideas and removes them afterwards.

import { randomUUID } from 'node:crypto'
import {
  type AuditEventInput,
  type CurrentUserContext,
  NotFoundError,
  ValidationError,
} from '@collega/application/common'
import { TagService } from '@collega/application/tags'
import { Role } from '@collega/domain/enums'
import { createTag, type Tag } from '@collega/domain/tags'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaBoardRepository } from '../src/repositories/board.repository.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const AT = new Date('2026-09-20T08:00:00.000Z')
const LATER = new Date('2026-09-28T12:00:00.000Z')

async function settle(promises: readonly Promise<unknown>[]) {
  const results = await Promise.allSettled(promises)
  return {
    fulfilled: results.filter((r) => r.status === 'fulfilled').length,
    rejected: results.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : [])),
  }
}

describe.skipIf(!DATABASE_URL)('Tag management against a live database', () => {
  const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
  let queries = 0
  prisma.$on('query', () => {
    queries++
  })
  const tags = new PrismaTagRepository(prisma)
  const boards = new PrismaBoardRepository(prisma, new PrismaUnitOfWork(prisma))
  const run = randomUUID().slice(0, 8)
  const liveBoardId = randomUUID()
  const archivedBoardId = randomUUID()
  const ideaIds = {
    discovery: randomUUID(),
    delivery: randomUUID(),
    softDeleted: randomUUID(),
    archivedBoard: randomUUID(),
  }
  let organizationId: string
  let adminId: string
  let target: Tag
  let keep: Tag

  const newTag = (name: string, color: string): Tag =>
    createTag({ id: randomUUID(), organizationId, name, color, nowUtc: AT, actorUserId: null })

  beforeAll(async () => {
    const organization = await prisma.organizations.findFirst({
      where: {
        statuses: { some: {} },
        idea_types: { some: {} },
        business_impacts: { some: {} },
        users: { some: { role: 'OrgAdmin' } },
      },
      select: {
        id: true,
        statuses: { select: { id: true }, take: 1 },
        idea_types: { select: { id: true }, take: 1 },
        business_impacts: { select: { id: true }, take: 1 },
        users: { select: { id: true }, where: { role: 'OrgAdmin' }, take: 1 },
      },
    })
    const status = organization?.statuses[0]
    const ideaType = organization?.idea_types[0]
    const impact = organization?.business_impacts[0]
    const admin = organization?.users[0]
    if (!organization || !status || !ideaType || !impact || !admin) {
      throw new Error('Fixture requires a seeded organization with an Org Admin.')
    }
    organizationId = organization.id
    adminId = admin.id

    for (const [id, archived] of [
      [liveBoardId, false],
      [archivedBoardId, true],
    ] as const) {
      await prisma.boards.create({
        data: {
          id,
          organization_id: organizationId,
          name: `probe-tags-${run}-${archived ? 'archived' : 'live'}`,
          allow_user_status_update: true,
          is_archived: archived,
          archived_at_utc: archived ? AT : null,
          created_at_utc: AT,
          updated_at_utc: AT,
          board_swimlanes: {
            create: [{ id: randomUUID(), status_id: status.id, display_order: 0 }],
          },
        },
      })
    }

    target = newTag(`probe-target-${run}`, '#E5484D')
    keep = newTag(`probe-keep-${run}`, '#3FB86B')
    await tags.add(target)
    await tags.add(keep)

    const idea = async (
      id: string,
      boardId: string,
      tagIds: readonly string[],
      options: { isDeleted?: boolean; delivery?: boolean } = {},
    ) => {
      await prisma.ideas.create({
        data: {
          id,
          organization_id: organizationId,
          board_id: boardId,
          status_id: status.id,
          title: 'Probe idea',
          problem: 'Probe problem.',
          proposed_solutions: ['Probe solution.'],
          impact_rationale: 'Probe rationale.',
          priority: 'Medium',
          idea_type_id: ideaType.id,
          business_impact_id: impact.id,
          author_user_id: admin.id,
          is_deleted: options.isDeleted ?? false,
          phase: options.delivery ? 'Delivery' : 'Discovery',
          created_at_utc: AT,
          updated_at_utc: AT,
          idea_tags: { create: tagIds.map((tag_id) => ({ id: randomUUID(), tag_id })) },
        },
      })
    }
    await idea(ideaIds.discovery, liveBoardId, [target.id, keep.id])
    await idea(ideaIds.delivery, liveBoardId, [target.id], { delivery: true })
    await idea(ideaIds.softDeleted, liveBoardId, [target.id], { isDeleted: true })
    await idea(ideaIds.archivedBoard, archivedBoardId, [target.id])
  }, 60_000)

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { board_id: { in: [liveBoardId, archivedBoardId] } } })
    await prisma.boards.deleteMany({ where: { id: { in: [liveBoardId, archivedBoardId] } } })
    await prisma.tags.deleteMany({
      where: { organization_id: organizationId, normalized_name: { contains: run } },
    })
    await prisma.$disconnect()
  })

  it('counts live ideas in both phases and on archived boards, never soft-deleted ones', async () => {
    const usage = await tags.usageByTagIds([target.id, keep.id])

    expect(usage.get(target.id)?.ideaCount).toBe(3)
    expect(
      usage
        .get(target.id)
        ?.boards.map((b) => b.boardId)
        .sort(),
    ).toEqual([liveBoardId, archivedBoardId].sort())
    expect(usage.get(keep.id)).toEqual({
      ideaCount: 1,
      boards: [{ boardId: liveBoardId, name: `probe-tags-${run}-live` }],
    })
  })

  it('reads usage for any number of tags in one query', async () => {
    const extra = await prisma.tags.findMany({
      where: { organization_id: organizationId },
      select: { id: true },
      take: 20,
    })

    queries = 0
    await tags.usageByTagIds([target.id])
    const forOne = queries

    queries = 0
    await tags.usageByTagIds([target.id, keep.id, ...extra.map((t) => t.id)])
    expect(queries).toBe(forOne)
    expect(forOne).toBe(1)
  })

  it("carries each tag's own colour on the board's top tags", async () => {
    const rows = await boards.countIdeasByBoardAndTag([liveBoardId])
    expect(Object.fromEntries(rows.map((r) => [r.tagName, r.tagColor]))).toEqual({
      [target.name]: '#E5484D',
      [keep.name]: '#3FB86B',
    })
  })

  it('refuses a name that differs only in case, keyed name', async () => {
    const error = await tags.add(newTag(target.name.toUpperCase(), '#000000')).catch((e) => e)
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).failures).toEqual({
      name: ['A tag with this name already exists.'],
    })
  })

  it('lets exactly one of several concurrent creates of one name win; the rest are 400s', async () => {
    const name = `probe-race-${run}`
    const { fulfilled, rejected } = await settle(
      [name, name.toUpperCase(), ` ${name} `, name, name].map((n) =>
        tags.add(newTag(n, '#6B9BF2')),
      ),
    )

    expect(fulfilled).toBe(1)
    expect(rejected).toHaveLength(4)
    for (const error of rejected) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toEqual({
        name: ['A tag with this name already exists.'],
      })
    }
    expect(
      await prisma.tags.count({
        where: { organization_id: organizationId, normalized_name: name },
      }),
    ).toBe(1)
  })

  it('answers a concurrent rename onto one name the same way', async () => {
    const a = newTag(`probe-rename-a-${run}`, '#000000')
    const b = newTag(`probe-rename-b-${run}`, '#000000')
    await tags.add(a)
    await tags.add(b)
    const taken = `probe-rename-taken-${run}`
    const rename = (tag: Tag) =>
      tags.save({ ...tag, name: taken, normalizedName: taken, updatedAtUtc: LATER })

    const { fulfilled, rejected } = await settle([rename(a), rename(b)])

    expect(fulfilled).toBe(1)
    expect(rejected[0]).toBeInstanceOf(ValidationError)
    expect((rejected[0] as ValidationError).failures).toHaveProperty('name')
  })

  it('answers 404 when the tag is gone before the write', async () => {
    const ghost = newTag(`probe-ghost-${run}`, '#000000')
    expect(await tags.save(ghost).catch((e) => e)).toBeInstanceOf(NotFoundError)
    expect(await tags.delete(ghost.id).catch((e) => e)).toBeInstanceOf(NotFoundError)
  })

  it('renames through the service with one TagRenamed event and the ideas untouched', async () => {
    const events: AuditEventInput[] = []
    const admin: CurrentUserContext = {
      isAuthenticated: true,
      userId: adminId,
      organizationId,
      role: Role.OrgAdmin,
      isImpersonating: false,
      realUserId: adminId,
    }
    const service = new TagService(
      tags,
      { existsById: async () => true },
      {
        write: async (event) => {
          events.push(event)
        },
      },
      admin,
      { now: () => LATER },
      { nextInt: () => 0 },
    )

    const renamed = `probe-target-renamed-${run}`
    const item = await service.update(target.id, { name: renamed, color: null })
    await service.update(target.id, { name: renamed, color: '#abcdef' })

    expect(item.ideaCount).toBe(3)
    expect(events.map((e) => e.eventType)).toEqual(['TagRenamed'])
    expect(JSON.parse(events[0]?.metadataJson ?? '{}')).toMatchObject({ ideaCount: 3 })
    const stored = await prisma.tags.findUniqueOrThrow({ where: { id: target.id } })
    expect([stored.name, stored.color]).toEqual([renamed, '#ABCDEF'])
    const ideas = await prisma.ideas.findMany({
      where: { id: { in: Object.values(ideaIds) } },
      select: { updated_at_utc: true },
    })
    expect(ideas.map((i) => i.updated_at_utc.toISOString())).toEqual(
      Array(4).fill(AT.toISOString()),
    )
  })

  it('deletes every link, soft-deleted and Delivery ideas included, and leaves the ideas alone', async () => {
    await tags.delete(target.id)

    expect(await prisma.tags.findUnique({ where: { id: target.id } })).toBeNull()
    expect(await prisma.idea_tags.count({ where: { tag_id: target.id } })).toBe(0)
    expect(
      await prisma.idea_tags.findMany({
        where: { idea_id: { in: Object.values(ideaIds) } },
        select: { idea_id: true, tag_id: true },
      }),
    ).toEqual([{ idea_id: ideaIds.discovery, tag_id: keep.id }])

    const ideas = await prisma.ideas.findMany({
      where: { id: { in: Object.values(ideaIds) } },
      select: { updated_at_utc: true, is_deleted: true },
    })
    expect(ideas).toHaveLength(4)
    expect(new Set(ideas.map((i) => i.updated_at_utc.toISOString()))).toEqual(
      new Set([AT.toISOString()]),
    )
  })
})
