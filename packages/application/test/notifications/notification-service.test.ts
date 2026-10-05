// The notification writer: the rules every caller shares (SPEC/20-feature-idea-following.md rules
// 19 and 19a, SPEC/20-feature-notifications.md). Who the recipients are is each service's decision;
// whether a given recipient is written to is decided here.

import { NotificationEventType, UserStatus } from '@collega/domain/enums'
import type { NotificationEvent } from '@collega/domain/notifications'
import { describe, expect, it } from 'vitest'
import { NotificationService } from '../../src/notifications/index.js'
import type { NotificationInput } from '../../src/notifications/models.js'
import type {
  NotificationEventRepository,
  NotificationRecipientsPort,
} from '../../src/notifications/ports.js'
import { fixedClock, NOW, ORG_A } from '../support/fixtures.js'

const INPUT: NotificationInput = {
  eventType: NotificationEventType.CommentAdded,
  organizationId: ORG_A,
  boardId: 'board-1',
  ideaId: 'idea-1',
  ideaTitle: 'An idea',
  actorUserId: 'actor-1',
  recipientUserId: 'recipient-1',
}

function writerHarness(users: Record<string, UserStatus>) {
  const written: NotificationEvent[] = []
  const lookups: string[] = []
  const repository: NotificationEventRepository = {
    async add(event) {
      written.push(event)
    },
  }
  const recipients: NotificationRecipientsPort = {
    async getById(userId) {
      lookups.push(userId)
      const status = users[userId]
      return status === undefined ? null : { status }
    },
  }
  return {
    service: new NotificationService(repository, recipients, fixedClock()),
    written,
    lookups,
  }
}

describe('NotificationService.notify', () => {
  it('writes one event for an active recipient, stamped by the injected clock', async () => {
    const h = writerHarness({ 'recipient-1': UserStatus.Active })

    await h.service.notify(INPUT)

    expect(h.written).toHaveLength(1)
    expect(h.written[0]).toMatchObject({
      eventType: 'CommentAdded',
      organizationId: ORG_A,
      boardId: 'board-1',
      ideaId: 'idea-1',
      ideaTitle: 'An idea',
      actorUserId: 'actor-1',
      recipientUserId: 'recipient-1',
      link: '/ideas/idea-1',
      statusName: null,
      occurredAtUtc: NOW,
    })
  })

  it('captures the status name given at write time', async () => {
    const h = writerHarness({ 'recipient-1': UserStatus.Active })

    await h.service.notify({
      ...INPUT,
      eventType: NotificationEventType.IdeaStatusChanged,
      statusName: 'In Review',
    })

    expect(h.written[0]?.statusName).toBe('In Review')
  })

  it('writes nothing to a recipient who is the actor', async () => {
    const h = writerHarness({ 'actor-1': UserStatus.Active })

    await h.service.notify({ ...INPUT, recipientUserId: 'actor-1' })

    expect(h.written).toEqual([])
  })

  it('writes nothing for an empty recipient id', async () => {
    const h = writerHarness({})

    await h.service.notify({ ...INPUT, recipientUserId: '' })

    expect(h.written).toEqual([])
  })

  it.each([['inactive', UserStatus.Inactive]])(
    'writes nothing to a recipient whose account is %s (rule 19a)',
    async (_label, status) => {
      const h = writerHarness({ 'recipient-1': status })

      await h.service.notify(INPUT)

      expect(h.written).toEqual([])
    },
  )

  it('writes nothing when no user row exists for the recipient', async () => {
    const h = writerHarness({})

    await h.service.notify(INPUT)

    expect(h.written).toEqual([])
  })

  it('applies to every event type alike, mentions and task assignments included', async () => {
    const h = writerHarness({ 'recipient-1': UserStatus.Inactive })

    for (const eventType of [
      NotificationEventType.IdeaMention,
      NotificationEventType.CommentMention,
      NotificationEventType.IssueTaskAssigned,
      NotificationEventType.IdeaEdited,
    ]) {
      await h.service.notify({ ...INPUT, eventType })
    }

    expect(h.written).toEqual([])
  })

  it('notifies a reactivated account again, from that point on', async () => {
    const users: Record<string, UserStatus> = { 'recipient-1': UserStatus.Inactive }
    const h = writerHarness(users)

    await h.service.notify(INPUT)
    users['recipient-1'] = UserStatus.Active
    await h.service.notify(INPUT)

    expect(h.written).toHaveLength(1)
  })
})
