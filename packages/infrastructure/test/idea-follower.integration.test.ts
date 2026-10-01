// `idea_followers` and the follow routes' use case, against a live Postgres
// (SPEC/20-feature-idea-following.md rules 1-8 and 36). What only a database shows: the unique
// (idea, person) pair, the cascade from ideas and the RESTRICT from users, that staged writes
// commit with the unit of work and not before, and that `FollowService` over the real adapters
// leaves no audit row and does not touch the idea.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { NotFoundError } from '@collega/application/common'
import { FollowService } from '@collega/application/following'
import { Role } from '@collega/domain/enums'
import { createIdeaFollower } from '@collega/domain/followers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaFollowerRepository } from '../src/repositories/idea-follower.repository.js'
import { IdeaLookupRepository } from '../src/repositories/idea-lookup.repository.js'
import { type ProbeOrg, probeOrg } from './support/following-probe.js'

const DATABASE_URL = process.env.DATABASE_URL
const T0 = new Date('2026-09-25T10:00:00.000Z')
const T1 = new Date('2026-09-25T11:00:00.000Z')
const T2 = new Date('2026-09-25T12:00:00.000Z')

describe.skipIf(!DATABASE_URL)('Idea followers, against a live database', () => {
  const prisma = new PrismaClient()
  let org: ProbeOrg

  function repository() {
    const unitOfWork = new PrismaUnitOfWork(prisma)
    return { unitOfWork, followers: new PrismaIdeaFollowerRepository(prisma, unitOfWork) }
  }

  function row(ideaId: string, userId: string, nowUtc: Date = T0) {
    return createIdeaFollower({ id: randomUUID(), ideaId, userId, nowUtc })
  }

  async function rowsFor(ideaId: string) {
    return prisma.idea_followers.findMany({
      where: { idea_id: ideaId },
      select: { user_id: true, created_at_utc: true },
    })
  }

  beforeAll(async () => {
    org = probeOrg(prisma)
    await org.setUp()
  })

  afterAll(async () => {
    await org.remove()
    await prisma.$disconnect()
  })

  describe('the repository', () => {
    it('stages an add until the unit of work commits it', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()

      await followers.add([row(ideaId, author)])
      expect(await rowsFor(ideaId)).toEqual([])

      await unitOfWork.saveChanges()
      expect((await rowsFor(ideaId)).map((r) => r.user_id)).toEqual([author])
    })

    it('stores the follower row with the id, the pair and the creation time given', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()
      const follower = row(ideaId, author, T1)

      await followers.add([follower])
      await unitOfWork.saveChanges()

      expect(await prisma.idea_followers.findUniqueOrThrow({ where: { id: follower.id } })).toEqual(
        { id: follower.id, idea_id: ideaId, user_id: author, created_at_utc: T1 },
      )
    })

    it('leaves an existing pair as it is when it is added again, and keeps the first id and time', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const first = repository()
      const original = row(ideaId, author, T0)
      await first.followers.add([original])
      await first.unitOfWork.saveChanges()

      const second = repository()
      await second.followers.add([row(ideaId, author, T2), row(ideaId, await org.newUser('b'), T2)])
      await expect(second.unitOfWork.saveChanges()).resolves.not.toThrow()

      const rows = await prisma.idea_followers.findMany({ where: { idea_id: ideaId } })
      expect(rows).toHaveLength(2)
      expect(rows.find((r) => r.user_id === author)).toMatchObject({
        id: original.id,
        created_at_utc: T0,
      })
    })

    it('does nothing, and enqueues nothing, for an empty add', async () => {
      const { unitOfWork, followers } = repository()

      await followers.add([])

      await expect(unitOfWork.saveChanges()).resolves.not.toThrow()
    })

    it('rejects a second row for the same pair at the database', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const insert = () =>
        prisma.idea_followers.create({
          data: { id: randomUUID(), idea_id: ideaId, user_id: author, created_at_utc: T0 },
        })
      await insert()

      await expect(insert()).rejects.toMatchObject({ code: 'P2002' })
    })

    it('answers isFollowing and countByIdea per idea and per person', async () => {
      const author = await org.newUser('author')
      const other = await org.newUser('other')
      const ideaId = await org.newIdea(author)
      const elsewhere = await org.newIdea(author)
      const { unitOfWork, followers } = repository()
      await followers.add([row(ideaId, author), row(ideaId, other), row(elsewhere, author)])
      await unitOfWork.saveChanges()

      expect(await followers.isFollowing(ideaId, author)).toBe(true)
      expect(await followers.isFollowing(elsewhere, other)).toBe(false)
      expect(await followers.countByIdea(ideaId)).toBe(2)
      expect(await followers.countByIdea(elsewhere)).toBe(1)
      expect(await followers.countByIdea(randomUUID())).toBe(0)
    })

    it('lists follower ids oldest follow first', async () => {
      const [a, b, c] = [
        await org.newUser('a'),
        await org.newUser('b'),
        await org.newUser('c'),
      ] as const
      const ideaId = await org.newIdea(a)
      const { unitOfWork, followers } = repository()
      await followers.add([row(ideaId, c, T2), row(ideaId, a, T0), row(ideaId, b, T1)])
      await unitOfWork.saveChanges()

      expect(await followers.listFollowerIds(ideaId)).toEqual([a, b, c])
    })

    it('removes only the named person from the named idea', async () => {
      const author = await org.newUser('author')
      const other = await org.newUser('other')
      const ideaId = await org.newIdea(author)
      const elsewhere = await org.newIdea(author)
      const seed = repository()
      await seed.followers.add([row(ideaId, author), row(ideaId, other), row(elsewhere, author)])
      await seed.unitOfWork.saveChanges()

      const { unitOfWork, followers } = repository()
      await followers.remove(ideaId, author)
      expect(await followers.isFollowing(ideaId, author)).toBe(true) // staged, not yet committed
      await unitOfWork.saveChanges()

      expect(await followers.listFollowerIds(ideaId)).toEqual([other])
      expect(await followers.listFollowerIds(elsewhere)).toEqual([author])
    })

    it('removing a pair that does not exist is not an error', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()

      await followers.remove(ideaId, author)

      await expect(unitOfWork.saveChanges()).resolves.not.toThrow()
    })

    it('commits an idea’s followers together with another staged write, or neither', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()
      await followers.add([row(ideaId, author)])
      // A second staged write that must fail: a follower for a user that does not exist.
      await followers.add([row(ideaId, randomUUID())])

      await expect(unitOfWork.saveChanges()).rejects.toBeDefined()

      expect(await rowsFor(ideaId)).toEqual([])
    })
  })

  describe('the schema', () => {
    it('deletes follower rows with a hard-deleted idea (ON DELETE CASCADE)', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()
      await followers.add([row(ideaId, author)])
      await unitOfWork.saveChanges()

      await prisma.ideas.delete({ where: { id: ideaId } })

      expect(await rowsFor(ideaId)).toEqual([])
    })

    it('refuses to delete a user who still follows an idea (ON DELETE RESTRICT)', async () => {
      const author = await org.newUser('author')
      const follower = await org.newUser('follower')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()
      await followers.add([row(ideaId, follower)])
      await unitOfWork.saveChanges()

      await expect(prisma.users.delete({ where: { id: follower } })).rejects.toMatchObject({
        code: 'P2003',
      })
      expect(await followers.isFollowing(ideaId, follower)).toBe(true)
    })

    it('keeps follower rows when the idea is only soft-deleted', async () => {
      const author = await org.newUser('author')
      const ideaId = await org.newIdea(author)
      const { unitOfWork, followers } = repository()
      await followers.add([row(ideaId, author)])
      await unitOfWork.saveChanges()

      await prisma.ideas.update({ where: { id: ideaId }, data: { is_deleted: true } })

      expect(await followers.countByIdea(ideaId)).toBe(1)
    })
  })

  describe('FollowService over the real adapters', () => {
    async function followService(userId: string, organizationId = org.organizationId) {
      const { unitOfWork, followers } = repository()
      return new FollowService(
        followers,
        new IdeaLookupRepository(prisma),
        unitOfWork,
        {
          isAuthenticated: true,
          userId,
          organizationId,
          role: Role.ReadOnly,
          isImpersonating: false,
          realUserId: userId,
        },
        { now: () => T1 },
      )
    }

    it('follows and unfollows idempotently, answering the count', async () => {
      const author = await org.newUser('author')
      const reader = await org.newUser('reader')
      const ideaId = await org.newIdea(author)

      const service = await followService(reader)
      expect(await service.follow(ideaId)).toEqual({ ideaId, isFollowing: true, followerCount: 1 })
      expect(await (await followService(reader)).follow(ideaId)).toEqual({
        ideaId,
        isFollowing: true,
        followerCount: 1,
      })
      expect(await (await followService(reader)).unfollow(ideaId)).toEqual({
        ideaId,
        isFollowing: false,
        followerCount: 0,
      })
      expect(await (await followService(reader)).unfollow(ideaId)).toMatchObject({
        isFollowing: false,
      })
    })

    it('writes no audit event, no notification, and does not touch the idea’s updated time', async () => {
      const author = await org.newUser('author')
      const reader = await org.newUser('reader')
      const ideaId = await org.newIdea(author)
      const before = await prisma.ideas.findUniqueOrThrow({
        where: { id: ideaId },
        select: { updated_at_utc: true, updated_by_user_id: true },
      })
      const auditBefore = await prisma.audit_events.count({
        where: { organization_id: org.organizationId },
      })
      const notificationsBefore = await prisma.notification_events.count({
        where: { organization_id: org.organizationId },
      })

      await (await followService(reader)).follow(ideaId)
      await (await followService(reader)).unfollow(ideaId)

      expect(
        await prisma.ideas.findUniqueOrThrow({
          where: { id: ideaId },
          select: { updated_at_utc: true, updated_by_user_id: true },
        }),
      ).toEqual(before)
      expect(
        await prisma.audit_events.count({ where: { organization_id: org.organizationId } }),
      ).toBe(auditBefore)
      expect(
        await prisma.notification_events.count({ where: { organization_id: org.organizationId } }),
      ).toBe(notificationsBefore)
    })

    it('answers 404 for a soft-deleted idea and for an idea in another organization', async () => {
      const author = await org.newUser('author')
      const reader = await org.newUser('reader')
      const deleted = await org.newIdea(author, { isDeleted: true })
      const live = await org.newIdea(author)

      await expect((await followService(reader)).follow(deleted)).rejects.toBeInstanceOf(
        NotFoundError,
      )
      await expect((await followService(reader, randomUUID())).follow(live)).rejects.toBeInstanceOf(
        NotFoundError,
      )
      expect(await rowsFor(deleted)).toEqual([])
      expect(await rowsFor(live)).toEqual([])
    })
  })
})
