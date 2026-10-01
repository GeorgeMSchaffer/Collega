// Following in IdeaService (SPEC/20-feature-idea-following.md rules 4-7, 9-19): who follows
// automatically, who is notified of each action, and the one-row-per-person and self-suppression
// rules. The service is fed fake ports, so the recorded NotificationInput is what the writer is
// asked to persist; inactive recipients (rule 19a) are the writer's job and are tested with it.

import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import type { IdeaImportRow } from '../../src/ideas/models.js'
import { impersonating, member, ORG_A, orgAdmin, readOnly, siteAdmin } from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_A,
  CREATE,
  harness,
  idea,
  promotedIdea,
  STATUS_1,
  STATUS_2,
  summary,
  TYPE_A2,
  updateFrom,
} from './idea-service-harness.js'

const ASSIGNEE_1 = 'assignee-1'
const ASSIGNEE_2 = 'assignee-2'
const WATCHER = 'watcher-1'

const ASSIGNEES = [
  summary({ id: ASSIGNEE_1, email: 'a1@acme.test' }),
  summary({ id: ASSIGNEE_2, email: 'a2@acme.test' }),
  summary({ id: WATCHER, email: 'w1@acme.test' }),
]
const USERS = [summary(), ...ASSIGNEES]

function recipients(notifications: readonly { recipientUserId: string }[]): string[] {
  return notifications.map((n) => n.recipientUserId).sort()
}

describe('IdeaService follows automatically', () => {
  it('makes the author follow an idea they create', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), users: USERS })

    await h.service.create(BOARD_A, CREATE)

    const created = h.added[0]
    expect(h.followersByIdea.get(created?.id ?? '')).toEqual(new Set([AUTHOR]))
  })

  it('makes each assignee follow an idea created with them, beside the author', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), users: USERS })

    await h.service.create(BOARD_A, { ...CREATE, assigneeUserIds: [ASSIGNEE_1, ASSIGNEE_2] })

    expect(h.followersByIdea.get(h.added[0]?.id ?? '')).toEqual(
      new Set([AUTHOR, ASSIGNEE_1, ASSIGNEE_2]),
    )
  })

  it('does not make a mentioned person follow', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), users: USERS })

    await h.service.create(BOARD_A, { ...CREATE, mentionEmails: ['w1@acme.test'] })

    expect(h.followersByIdea.get(h.added[0]?.id ?? '')).toEqual(new Set([AUTHOR]))
  })

  it('makes the author of every CSV-imported idea follow it, and no rejected row', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR), users: USERS })
    const row = (rowNumber: number, title: string): IdeaImportRow => ({
      rowNumber,
      cells: new Map(
        Object.entries({
          title,
          priority: 'Medium',
          'idea type': 'Improvement',
          'business impact': 'Medium',
        }),
      ),
    })
    const bad: IdeaImportRow = { rowNumber: 3, cells: new Map([['title', '']]) }

    const result = await h.service.importBoardIdeas(BOARD_A, [row(1, 'One'), row(2, 'Two'), bad])

    expect(result.createdCount).toBe(2)
    expect(h.added).toHaveLength(2)
    for (const created of h.added) {
      expect(h.followersByIdea.get(created.id)).toEqual(new Set([AUTHOR]))
    }
    expect(h.followersByIdea.size).toBe(2)
  })

  it('makes a newly added assignee follow on a later edit', async () => {
    const existing = idea()
    const h = harness({ currentUser: member(ORG_A, AUTHOR), ideas: [existing], users: USERS })

    await h.service.update(existing.id, { ...updateFrom(existing), assigneeUserIds: [ASSIGNEE_1] })

    expect(h.followersByIdea.get(existing.id)).toEqual(new Set([AUTHOR, ASSIGNEE_1]))
  })

  it('re-follows an assignee who unfollowed, removed, and is then added again', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [AUTHOR] }, // ASSIGNEE_1 has unfollowed
    })

    // Removing them leaves them unfollowed...
    await h.service.update(existing.id, { ...updateFrom(existing), assigneeUserIds: [] })
    expect(h.followersByIdea.get(existing.id)).toEqual(new Set([AUTHOR]))

    // ...and being newly added again follows them (rule 6).
    const removed = idea({ id: existing.id, assigneeUserIds: [] })
    const again = harness({
      currentUser: member(ORG_A, AUTHOR),
      ideas: [removed],
      users: USERS,
      followers: { [removed.id]: [AUTHOR] },
    })
    await again.service.update(removed.id, {
      ...updateFrom(removed),
      assigneeUserIds: [ASSIGNEE_1],
    })
    expect(again.followersByIdea.get(removed.id)).toEqual(new Set([AUTHOR, ASSIGNEE_1]))
  })

  it('leaves an unfollowed assignee unfollowed when the edit keeps them assigned', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [AUTHOR] },
    })

    await h.service.update(existing.id, { ...updateFrom(existing), title: 'Retitled' })

    expect(h.followersByIdea.get(existing.id)).toEqual(new Set([AUTHOR]))
  })

  it('keeps a follower who is removed as an assignee', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({ currentUser: member(ORG_A, AUTHOR), ideas: [existing], users: USERS })

    await h.service.update(existing.id, { ...updateFrom(existing), assigneeUserIds: [] })

    expect(h.followersByIdea.get(existing.id)?.has(ASSIGNEE_1)).toBe(true)
  })

  it('does not make the person who edits, moves or promotes follow', async () => {
    const existing = idea()
    const admin = orgAdmin(ORG_A, 'org-admin-1')
    const h = harness({ currentUser: admin, ideas: [existing], users: USERS })

    await h.service.update(existing.id, { ...updateFrom(existing), title: 'Retitled' })
    await h.service.changeStatus(existing.id, { statusId: STATUS_2 })
    await h.service.promote(existing.id, { effort: 'Medium', sprintId: null, note: null })

    expect(h.followersByIdea.get(existing.id)).toEqual(new Set([AUTHOR]))
  })
})

describe('IdeaService notifies followers of a status change', () => {
  it('writes one IdeaStatusChanged per follower, naming the lane at write time', async () => {
    const existing = idea({ statusId: STATUS_2, assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      currentUser: orgAdmin(ORG_A, 'org-admin-1'),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [AUTHOR, WATCHER] },
    })

    await h.service.changeStatus(existing.id, { statusId: STATUS_1 })

    expect(h.notifications.map((n) => [n.eventType, n.recipientUserId, n.statusName])).toEqual([
      ['IdeaStatusChanged', AUTHOR, 'New'],
      ['IdeaStatusChanged', WATCHER, 'New'],
    ])
  })

  it('does not notify an author or assignee who has unfollowed', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      currentUser: orgAdmin(ORG_A, 'org-admin-1'),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [WATCHER] },
    })

    await h.service.changeStatus(existing.id, { statusId: STATUS_2 })

    expect(recipients(h.notifications)).toEqual([WATCHER])
  })

  it('writes nothing for a move to the lane the idea is already in', async () => {
    const existing = idea({ statusId: STATUS_1 })
    const h = harness({ currentUser: orgAdmin(ORG_A, 'org-admin-1'), ideas: [existing] })

    await h.service.changeStatus(existing.id, { statusId: STATUS_1 })

    expect(h.notifications).toEqual([])
  })

  it('never notifies the person who moved it, even though they follow', async () => {
    const existing = idea({ statusId: STATUS_2 })
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      boards: [
        {
          boardId: BOARD_A,
          organizationId: ORG_A,
          name: 'Acme Board',
          allowUserStatusUpdate: true,
          isArchived: false,
          swimlanes: [
            { statusId: STATUS_1, displayOrder: 0 },
            { statusId: STATUS_2, displayOrder: 1 },
          ],
        },
      ],
      ideas: [existing],
      followers: { [existing.id]: [AUTHOR, WATCHER] },
    })

    await h.service.changeStatus(existing.id, { statusId: STATUS_1 })

    expect(recipients(h.notifications)).toEqual([WATCHER])
  })

  it('records a null statusName when the lane has no status info', async () => {
    // The harness only knows STATUS_1's name; STATUS_2 is a live lane with no name to capture.
    const existing = idea({ statusId: STATUS_1 })
    const h = harness({ currentUser: orgAdmin(ORG_A, 'org-admin-1'), ideas: [existing] })

    await h.service.changeStatus(existing.id, { statusId: STATUS_2 })

    expect(h.notifications.map((n) => n.statusName)).toEqual([null])
  })
})

describe('IdeaService notifies followers of promotion and delivery moves', () => {
  it('sends IdeaPromoted to every follower except the promoter', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      currentUser: orgAdmin(ORG_A, 'org-admin-1'),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [WATCHER, 'org-admin-1'] },
    })

    await h.service.promote(existing.id, { effort: 'Medium', sprintId: null, note: null })

    expect(h.notifications.map((n) => [n.eventType, n.recipientUserId])).toEqual([
      ['IdeaPromoted', WATCHER],
    ])
  })

  it('sends IssueDeliveryStatusChanged to every follower, naming the delivery status', async () => {
    const issue = promotedIdea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      currentUser: member(ORG_A, ASSIGNEE_1),
      ideas: [issue],
      users: USERS,
      followers: { [issue.id]: [AUTHOR, ASSIGNEE_1, WATCHER] },
    })

    await h.service.changeDeliveryStatus(issue.id, { deliveryStatus: 'Development' })

    expect(h.notifications.map((n) => [n.eventType, n.recipientUserId, n.statusName])).toEqual([
      ['IssueDeliveryStatusChanged', AUTHOR, 'Development'],
      ['IssueDeliveryStatusChanged', WATCHER, 'Development'],
    ])
  })

  it('writes nothing when the delivery status does not change', async () => {
    const issue = promotedIdea()
    const h = harness({ currentUser: orgAdmin(ORG_A, 'org-admin-1'), ideas: [issue] })

    await h.service.changeDeliveryStatus(issue.id, { deliveryStatus: issue.deliveryStatus ?? '' })

    expect(h.notifications).toEqual([])
  })
})

describe('IdeaService writes IdeaEdited once per real change', () => {
  const edit = (existing: ReturnType<typeof idea>) => ({
    currentUser: orgAdmin(ORG_A, 'org-admin-1'),
    ideas: [existing],
    users: USERS,
    followers: { [existing.id]: [AUTHOR, WATCHER] },
  })

  it('notifies each follower once when a save changes several fields', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.update(existing.id, {
      ...updateFrom(existing),
      title: 'New title',
      description: 'New body',
      priority: 'High',
    })

    expect(h.notifications.map((n) => [n.eventType, n.recipientUserId])).toEqual([
      ['IdeaEdited', AUTHOR],
      ['IdeaEdited', WATCHER],
    ])
  })

  it('writes nothing for a save that changes nothing', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.update(existing.id, updateFrom(existing))

    expect(h.notifications).toEqual([])
  })

  it('writes nothing when only the order of a list-shaped field changes', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1, ASSIGNEE_2], tagIds: ['t1', 't2'] })
    const h = harness({
      ...edit(existing),
      tags: [
        { id: 't1', name: 'one', color: '#000000' },
        { id: 't2', name: 'two', color: '#000000' },
      ],
    })

    await h.service.update(existing.id, {
      ...updateFrom(existing),
      assigneeUserIds: [ASSIGNEE_2, ASSIGNEE_1],
      tagNames: ['two', 'one'],
    })

    expect(h.notifications).toEqual([])
  })

  it('writes one for a change to a custom field alone', async () => {
    const existing = idea({ fieldValues: [{ fieldDefinitionId: 'field-1', value: 'old' }] })
    const h = harness({
      ...edit(existing),
      fieldValues: {
        async getReconcileScope() {
          return ['field-1']
        },
        async resolveAndValidate() {
          return [{ fieldDefinitionId: 'field-1', value: 'new' }]
        },
      },
    })

    await h.service.update(existing.id, { ...updateFrom(existing), fieldValues: [] })

    expect(h.notifications.map((n) => n.eventType)).toEqual(['IdeaEdited', 'IdeaEdited'])
  })

  it('writes none when a submitted custom field equals the stored value', async () => {
    const existing = idea({ fieldValues: [{ fieldDefinitionId: 'field-1', value: 'same' }] })
    const h = harness({
      ...edit(existing),
      fieldValues: {
        async getReconcileScope() {
          return ['field-1']
        },
        async resolveAndValidate() {
          return [{ fieldDefinitionId: 'field-1', value: 'same' }]
        },
      },
    })

    await h.service.update(existing.id, { ...updateFrom(existing), fieldValues: [] })

    expect(h.notifications).toEqual([])
  })

  it('writes one for a due-date change', async () => {
    const existing = idea({ dueDate: '2026-12-01' })
    const h = harness(edit(existing))

    await h.service.update(existing.id, { ...updateFrom(existing), dueDate: '2026-12-02' })

    expect(h.notifications.map((n) => n.eventType)).toEqual(['IdeaEdited', 'IdeaEdited'])
  })

  it('writes none for a due date resubmitted unchanged', async () => {
    const existing = idea({ dueDate: '2026-12-01' })
    const h = harness(edit(existing))

    await h.service.update(existing.id, { ...updateFrom(existing), dueDate: '2026-12-01' })

    expect(h.notifications).toEqual([])
  })

  it('writes one for an effort change on an idea', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.update(existing.id, { ...updateFrom(existing), effort: 'High' })

    expect(h.notifications.map((n) => n.eventType)).toEqual(['IdeaEdited', 'IdeaEdited'])
  })

  it('also sends it to an assignee the same save added', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.update(existing.id, { ...updateFrom(existing), assigneeUserIds: [ASSIGNEE_1] })

    expect(recipients(h.notifications)).toEqual([ASSIGNEE_1, AUTHOR, WATCHER].sort())
  })

  it('still sends it to an assignee who was just removed, since they keep following', async () => {
    const existing = idea({ assigneeUserIds: [ASSIGNEE_1] })
    const h = harness({
      ...edit(existing),
      followers: { [existing.id]: [AUTHOR, ASSIGNEE_1] },
    })

    await h.service.update(existing.id, { ...updateFrom(existing), assigneeUserIds: [] })

    expect(recipients(h.notifications)).toEqual([ASSIGNEE_1, AUTHOR].sort())
  })

  it('gives someone newly mentioned and following only the mention', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.update(existing.id, {
      ...updateFrom(existing),
      title: 'New title',
      mentionEmails: ['w1@acme.test'],
    })

    expect(
      h.notifications.filter((n) => n.recipientUserId === WATCHER).map((n) => n.eventType),
    ).toEqual(['IdeaMention'])
    expect(
      h.notifications.filter((n) => n.recipientUserId === AUTHOR).map((n) => n.eventType),
    ).toEqual(['IdeaEdited'])
  })

  it('writes the edit event with the idea and organization it concerns', async () => {
    const existing = idea()
    const h = harness({ ...edit(existing), followers: { [existing.id]: [WATCHER] } })

    await h.service.update(existing.id, { ...updateFrom(existing), title: 'New title' })

    expect(h.notifications).toEqual([
      {
        eventType: 'IdeaEdited',
        organizationId: ORG_A,
        boardId: BOARD_A,
        ideaId: existing.id,
        ideaTitle: 'New title',
        actorUserId: 'org-admin-1',
        recipientUserId: WATCHER,
        statusName: null,
      },
    ])
  })

  it('writes one for an Idea Type reassignment', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.reassignIdeaType(ORG_A, existing.id, TYPE_A2)

    expect(h.notifications.map((n) => [n.eventType, n.recipientUserId])).toEqual([
      ['IdeaEdited', AUTHOR],
      ['IdeaEdited', WATCHER],
    ])
  })

  it('writes none when the reassignment names the type the idea already has', async () => {
    const existing = idea()
    const h = harness(edit(existing))

    await h.service.reassignIdeaType(ORG_A, existing.id, existing.ideaTypeId)

    expect(h.notifications).toEqual([])
  })
})

describe('IdeaService suppresses the actor, including under View As', () => {
  it('does not notify the follower who edits their own idea', async () => {
    const existing = idea()
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [AUTHOR, WATCHER] },
    })

    await h.service.update(existing.id, { ...updateFrom(existing), title: 'Retitled' })

    expect(recipients(h.notifications)).toEqual([WATCHER])
  })

  it('treats the View As target as the actor: they get nothing, nor does the administrator', async () => {
    const existing = idea()
    const h = harness({
      currentUser: impersonating({
        targetUserId: AUTHOR,
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [AUTHOR, WATCHER, 'site-admin-1'] },
    })

    await h.service.update(existing.id, { ...updateFrom(existing), title: 'Retitled' })

    const notified = recipients(h.notifications)
    expect(notified).toContain(WATCHER)
    expect(notified).not.toContain(AUTHOR)
    expect(h.notifications.every((n) => n.actorUserId === AUTHOR)).toBe(true)
  })
})

describe('IdeaService edit by a role that may not edit', () => {
  it.each([
    ['Read Only', readOnly(ORG_A, 'ro-1')],
    ['a Site Admin acting as themselves', siteAdmin()],
  ])('writes no notification when %s is refused', async (_label, currentUser) => {
    const existing = idea()
    const h = harness({ currentUser, ideas: [existing] })

    await expect(
      h.service.update(existing.id, { ...updateFrom(existing), title: 'Retitled' }),
    ).rejects.toThrow()

    expect(h.notifications).toEqual([])
    expect(h.followersByIdea.get(existing.id)).toEqual(new Set([AUTHOR]))
  })
})

describe('IdeaService detail carries the caller follow state', () => {
  it('reports isFollowing and followerCount for a follower', async () => {
    const existing = idea()
    const h = harness({
      currentUser: member(ORG_A, WATCHER),
      ideas: [existing],
      users: USERS,
      followers: { [existing.id]: [AUTHOR, WATCHER, ASSIGNEE_1] },
    })

    const detail = await h.service.getById(existing.id)

    expect(detail).toMatchObject({ isFollowing: true, followerCount: 3 })
  })

  it('reports isFollowing false for a reader who does not follow, with the same count', async () => {
    const existing = idea()
    const h = harness({
      currentUser: readOnly(ORG_A, 'ro-1'),
      ideas: [existing],
      followers: { [existing.id]: [AUTHOR, WATCHER] },
    })

    const detail = await h.service.getById(existing.id)

    expect(detail).toMatchObject({ isFollowing: false, followerCount: 2 })
  })

  it('reports the View As target follow state, not the administrator', async () => {
    const existing = idea()
    const h = harness({
      currentUser: impersonating({
        targetUserId: WATCHER,
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
      ideas: [existing],
      followers: { [existing.id]: [WATCHER] },
    })

    expect((await h.service.getById(existing.id)).isFollowing).toBe(true)
  })

  it('answers the detail from an edit with the count that includes a newly added assignee', async () => {
    const existing = idea()
    const h = harness({ currentUser: member(ORG_A, AUTHOR), ideas: [existing], users: USERS })

    const detail = await h.service.update(existing.id, {
      ...updateFrom(existing),
      assigneeUserIds: [ASSIGNEE_1],
    })

    expect(detail).toMatchObject({ isFollowing: true, followerCount: 2 })
  })
})
