// The inbox query and read state against a live Postgres (SPEC/20-feature-idea-following.md rules
// 20-27, 32; SPEC/contracts/notifications.md). The window, the order, paging, the soft-deleted
// idea filter and "keeps the first read time" are all SQL, so only a database shows them. The
// writer's round trip (`status_name`, the new `IdeaEdited` type) rides along.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organization and removes it afterwards.

import { randomUUID } from 'node:crypto'
import { NotificationInboxService } from '@collega/application/notifications'
import type { NotificationEventType } from '@collega/domain/enums'
import { Role } from '@collega/domain/enums'
import { createNotificationEvent } from '@collega/domain/notifications'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaNotificationEventRepository } from '../src/repositories/notification-event.repository.js'
import { type ProbeOrg, probeOrg } from './support/following-probe.js'

const DATABASE_URL = process.env.DATABASE_URL
const NOW = new Date('2026-09-29T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS)

describe.skipIf(!DATABASE_URL)('The notification inbox, against a live database', () => {
  const prisma = new PrismaClient()
  const repository = new PrismaNotificationEventRepository(prisma)
  let org: ProbeOrg
  let actor: string
  let ideaId: string

  /** A fresh recipient, so each test reads an inbox nobody else wrote to. */
  async function recipient(): Promise<string> {
    return org.newUser('recipient')
  }

  async function write(
    recipientUserId: string,
    options: {
      at: Date
      id?: string
      ideaId?: string
      eventType?: NotificationEventType
      statusName?: string | null
      readAt?: Date | null
      actorUserId?: string
    },
  ): Promise<string> {
    const id = options.id ?? randomUUID()
    await prisma.notification_events.create({
      data: {
        id,
        event_type: options.eventType ?? 'CommentAdded',
        organization_id: org.organizationId,
        board_id: org.boardId,
        idea_id: options.ideaId ?? ideaId,
        idea_title: 'Probe title',
        actor_user_id: options.actorUserId ?? actor,
        recipient_user_id: recipientUserId,
        link: `/ideas/${options.ideaId ?? ideaId}`,
        occurred_at_utc: options.at,
        read_at_utc: options.readAt ?? null,
        status_name: options.statusName ?? null,
      },
    })
    return id
  }

  const window = (days = 90) => daysAgo(days)
  const listAll = (recipientUserId: string, page = 1, pageSize = 100) =>
    repository.listForRecipient({
      recipientUserId,
      sinceUtc: window(),
      page: { page, pageSize },
    })

  beforeAll(async () => {
    org = probeOrg(prisma)
    await org.setUp()
    actor = await org.newUser('actor')
    ideaId = await org.newIdea(actor)
  })

  afterAll(async () => {
    await org.remove()
    await prisma.$disconnect()
  })

  describe('listForRecipient', () => {
    it('returns only the recipient’s own rows', async () => {
      const me = await recipient()
      const someoneElse = await recipient()
      const mine = await write(me, { at: daysAgo(1) })
      await write(someoneElse, { at: daysAgo(1) })

      const page = await listAll(me)

      expect(page.items.map((i) => i.id)).toEqual([mine])
      expect(page.totalCount).toBe(1)
    })

    it('orders newest first by occurred time', async () => {
      const me = await recipient()
      const oldest = await write(me, { at: daysAgo(30) })
      const newest = await write(me, { at: daysAgo(1) })
      const middle = await write(me, { at: daysAgo(10) })

      expect((await listAll(me)).items.map((i) => i.id)).toEqual([newest, middle, oldest])
    })

    it('breaks a tie on occurred time by id, descending, so paging is stable', async () => {
      const me = await recipient()
      const at = daysAgo(2)
      const ids = [
        '00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000a3',
        '00000000-0000-4000-8000-0000000000a2',
      ]
      for (const id of ids) await write(me, { at, id })

      const onePerPage = [
        (await listAll(me, 1, 1)).items[0]?.id,
        (await listAll(me, 2, 1)).items[0]?.id,
        (await listAll(me, 3, 1)).items[0]?.id,
      ]

      expect(onePerPage).toEqual([
        '00000000-0000-4000-8000-0000000000a3',
        '00000000-0000-4000-8000-0000000000a2',
        '00000000-0000-4000-8000-0000000000a1',
      ])
    })

    it('includes a row exactly at the window start and leaves out one a moment before it', async () => {
      const me = await recipient()
      const edge = await write(me, { at: window() })
      await write(me, { at: new Date(window().getTime() - 1) })

      expect((await listAll(me)).items.map((i) => i.id)).toEqual([edge])
    })

    it('leaves older rows in the table but out of the list and the total', async () => {
      const me = await recipient()
      await write(me, { at: daysAgo(91) })
      await write(me, { at: daysAgo(400) })
      const recent = await write(me, { at: daysAgo(89) })

      const page = await listAll(me)

      expect(page.items.map((i) => i.id)).toEqual([recent])
      expect(page.totalCount).toBe(1)
      expect(await prisma.notification_events.count({ where: { recipient_user_id: me } })).toBe(3)
    })

    it('pages with a total that spans every page', async () => {
      const me = await recipient()
      const ids: string[] = []
      for (let day = 1; day <= 5; day++) ids.push(await write(me, { at: daysAgo(day) }))

      const first = await listAll(me, 1, 2)
      const third = await listAll(me, 3, 2)
      const beyond = await listAll(me, 4, 2)

      expect(first.items.map((i) => i.id)).toEqual([ids[0], ids[1]])
      expect(third.items.map((i) => i.id)).toEqual([ids[4]])
      expect([first.totalCount, third.totalCount, beyond.totalCount]).toEqual([5, 5, 5])
      expect(beyond.items).toEqual([])
      expect([first.page, first.pageSize]).toEqual([1, 2])
    })

    it('hides a soft-deleted idea’s notifications and shows them again if it is restored', async () => {
      const me = await recipient()
      const doomed = await org.newIdea(actor)
      const kept = await write(me, { at: daysAgo(1) })
      await write(me, { at: daysAgo(2), ideaId: doomed })

      await prisma.ideas.update({ where: { id: doomed }, data: { is_deleted: true } })
      expect((await listAll(me)).items.map((i) => i.id)).toEqual([kept])
      expect((await listAll(me)).totalCount).toBe(1)

      await prisma.ideas.update({ where: { id: doomed }, data: { is_deleted: false } })
      expect((await listAll(me)).totalCount).toBe(2)
    })

    it('leaves out a notification whose idea row no longer exists', async () => {
      const me = await recipient()
      const gone = await org.newIdea(actor)
      await write(me, { at: daysAgo(1), ideaId: gone })
      await prisma.ideas.delete({ where: { id: gone } })

      expect((await listAll(me)).items).toEqual([])
    })

    it('maps the stored fields, the status name and read state', async () => {
      const me = await recipient()
      const read = new Date('2026-09-28T08:00:00.000Z')
      const id = await write(me, {
        at: daysAgo(1),
        eventType: 'IdeaStatusChanged',
        statusName: 'In Review',
        readAt: read,
      })

      const [item] = (await listAll(me)).items

      expect(item).toMatchObject({
        id,
        eventType: 'IdeaStatusChanged',
        ideaId,
        ideaTitle: 'Probe title',
        link: `/ideas/${ideaId}`,
        statusName: 'In Review',
        occurredAtUtc: daysAgo(1),
        readAtUtc: read,
        actor: { userId: actor, firstName: 'actor', lastName: 'Probe', status: 'Active' },
      })
    })

    it('answers a null actor when no user row exists for the actor id', async () => {
      const me = await recipient()
      await write(me, { at: daysAgo(1), actorUserId: randomUUID() })

      expect((await listAll(me)).items[0]?.actor).toBeNull()
    })

    it('reports an inactive actor as inactive', async () => {
      const me = await recipient()
      const gone = await org.newUser('gone', 'Inactive')
      await write(me, { at: daysAgo(1), actorUserId: gone })

      expect((await listAll(me)).items[0]?.actor?.status).toBe('Inactive')
    })
  })

  describe('countUnread', () => {
    it('counts the recipient’s unread rows in the window only', async () => {
      const me = await recipient()
      const someoneElse = await recipient()
      await write(me, { at: daysAgo(1) })
      await write(me, { at: daysAgo(2) })
      await write(me, { at: daysAgo(3), readAt: daysAgo(2) })
      await write(me, { at: daysAgo(120) })
      await write(someoneElse, { at: daysAgo(1) })

      expect(await repository.countUnread(me, window())).toBe(2)
    })

    it('agrees with the list about which rows exist, soft-deleted ideas included', async () => {
      const me = await recipient()
      const doomed = await org.newIdea(actor, { isDeleted: true })
      await write(me, { at: daysAgo(1) })
      await write(me, { at: daysAgo(1), ideaId: doomed })

      expect(await repository.countUnread(me, window())).toBe(1)
      expect((await listAll(me)).totalCount).toBe(1)
    })

    it('is zero for an empty inbox', async () => {
      expect(await repository.countUnread(await recipient(), window())).toBe(0)
    })
  })

  describe('markRead', () => {
    const first = new Date('2026-09-29T09:00:00.000Z')
    const later = new Date('2026-09-29T10:00:00.000Z')

    it('sets the read time and reports the row as the recipient’s', async () => {
      const me = await recipient()
      const id = await write(me, { at: daysAgo(1) })

      expect(await repository.markRead(id, me, first)).toBe(true)

      const stored = await prisma.notification_events.findUniqueOrThrow({ where: { id } })
      expect(stored.read_at_utc).toEqual(first)
    })

    it('keeps the first read time when marked again, and still reports found', async () => {
      const me = await recipient()
      const id = await write(me, { at: daysAgo(1) })
      await repository.markRead(id, me, first)

      expect(await repository.markRead(id, me, later)).toBe(true)

      const stored = await prisma.notification_events.findUniqueOrThrow({ where: { id } })
      expect(stored.read_at_utc).toEqual(first)
    })

    it('reports not found, and changes nothing, for another recipient’s notification', async () => {
      const me = await recipient()
      const owner = await recipient()
      const id = await write(owner, { at: daysAgo(1) })

      expect(await repository.markRead(id, me, first)).toBe(false)

      const stored = await prisma.notification_events.findUniqueOrThrow({ where: { id } })
      expect(stored.read_at_utc).toBeNull()
    })

    it('reports not found for an id that does not exist', async () => {
      expect(await repository.markRead(randomUUID(), await recipient(), first)).toBe(false)
    })

    it('drops the row out of the unread count and leaves it in the list', async () => {
      const me = await recipient()
      const id = await write(me, { at: daysAgo(1) })

      await repository.markRead(id, me, first)

      expect(await repository.countUnread(me, window())).toBe(0)
      expect((await listAll(me)).items.map((i) => i.readAtUtc)).toEqual([first])
    })
  })

  describe('markAllRead', () => {
    const stamp = new Date('2026-09-29T09:30:00.000Z')

    it('marks every unread row of the recipient’s, inside the window or not', async () => {
      const me = await recipient()
      const recent = await write(me, { at: daysAgo(1) })
      const old = await write(me, { at: daysAgo(200) })

      await repository.markAllRead(me, stamp)

      for (const id of [recent, old]) {
        const stored = await prisma.notification_events.findUniqueOrThrow({ where: { id } })
        expect(stored.read_at_utc).toEqual(stamp)
      }
    })

    it('keeps an earlier read time', async () => {
      const me = await recipient()
      const before = new Date('2026-09-20T00:00:00.000Z')
      const id = await write(me, { at: daysAgo(12), readAt: before })

      await repository.markAllRead(me, stamp)

      expect(
        (await prisma.notification_events.findUniqueOrThrow({ where: { id } })).read_at_utc,
      ).toEqual(before)
    })

    it('leaves other recipients’ rows unread', async () => {
      const me = await recipient()
      const other = await recipient()
      const theirs = await write(other, { at: daysAgo(1) })

      await repository.markAllRead(me, stamp)

      expect(
        (await prisma.notification_events.findUniqueOrThrow({ where: { id: theirs } })).read_at_utc,
      ).toBeNull()
      expect(await repository.countUnread(other, window())).toBe(1)
    })
  })

  describe('add', () => {
    it('round-trips a status event with the status name, and the IdeaEdited type', async () => {
      const me = await recipient()
      const make = (eventType: NotificationEventType, statusName: string | null) =>
        createNotificationEvent({
          id: randomUUID(),
          eventType,
          organizationId: org.organizationId,
          boardId: org.boardId,
          ideaId,
          ideaTitle: 'Probe title',
          actorUserId: actor,
          recipientUserId: me,
          statusName,
          occurredAtUtc: daysAgo(1),
        })
      const status = make('IdeaStatusChanged' as NotificationEventType, 'In Review')
      const edited = make('IdeaEdited' as NotificationEventType, null)

      await repository.add(status)
      await repository.add(edited)

      const items = new Map((await listAll(me)).items.map((i) => [i.id, i]))
      expect(items.get(status.id)).toMatchObject({
        eventType: 'IdeaStatusChanged',
        statusName: 'In Review',
        readAtUtc: null,
      })
      expect(items.get(edited.id)).toMatchObject({ eventType: 'IdeaEdited', statusName: null })
    })
  })

  describe('NotificationInboxService over the real repository', () => {
    it('reads and marks the target’s inbox under View As, with the window on the injected clock', async () => {
      const target = await recipient()
      const admin = await recipient()
      const inWindow = await write(target, { at: daysAgo(89) })
      await write(target, { at: daysAgo(91) })
      await write(admin, { at: daysAgo(1) })

      const service = new NotificationInboxService(
        repository,
        {
          isAuthenticated: true,
          userId: target,
          organizationId: org.organizationId,
          role: Role.User,
          isImpersonating: true,
          realUserId: admin,
        },
        { now: () => NOW },
      )

      const page = await service.list({ page: null, pageSize: null })
      expect(page.items.map((i) => i.notificationId)).toEqual([inWindow])
      expect(await service.unreadCount()).toEqual({ unreadCount: 1 })

      await service.markAllRead()
      expect(await service.unreadCount()).toEqual({ unreadCount: 0 })
      expect(await repository.countUnread(admin, window())).toBe(1)
    })
  })
})
