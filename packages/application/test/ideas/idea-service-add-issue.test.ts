// IdeaService.addIssue: `POST /organizations/{organizationId}/issues` (SPEC/contracts/delivery.md).
// An Issue added directly is a board-less idea created and promoted in one unit of work. The
// properties under test: who may do it, that authorization precedes validation, that nothing is
// persisted when a rule refuses, and that what is persisted is already a Delivery-phase row.

import { DeliveryStatus, EffortLevel, IdeaPhase, Role, SprintState } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import type { AddIssueCommand } from '../../src/ideas/models.js'
import type { SprintSummary } from '../../src/ideas/ports.js'
import {
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import { CREATE, harness, STATUS_2, summary } from './idea-service-harness.js'

const { statusId: _statusId, ...POOL_FIELDS } = CREATE

const ISSUE: AddIssueCommand = { ...POOL_FIELDS, effort: 'Medium', sprintId: null }

function sprint(overrides: Partial<SprintSummary> = {}): SprintSummary {
  return {
    id: 'sprint-1',
    organizationId: ORG_A,
    name: 'Sprint 1',
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    state: SprintState.Planned,
    isDeleted: false,
    ...overrides,
  }
}

function validationFields(error: unknown): Record<string, readonly string[]> {
  expect(error).toBeInstanceOf(ValidationError)
  return (error as ValidationError).failures
}

async function refusal(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('expected the call to be refused')
}

describe('IdeaService.addIssue roles', () => {
  it.each([
    ['User', member(ORG_A, 'user-1')],
    ['Org Admin', orgAdmin(ORG_A, 'org-admin-1')],
  ])('lets a %s add an Issue', async (_label, currentUser) => {
    const h = harness({ currentUser })

    const result = await h.service.addIssue(ORG_A, () => ISSUE)

    expect(h.added).toHaveLength(1)
    expect(result.ideaId).toBe(h.added[0]?.id)
  })

  it('refuses Read Only with 403 and persists nothing', async () => {
    const h = harness({ currentUser: readOnly(ORG_A) })

    await expect(h.service.addIssue(ORG_A, () => ISSUE)).rejects.toThrow(ForbiddenError)
    expect(h.added).toEqual([])
    expect(h.audit.events).toEqual([])
  })

  it('refuses a Site Admin acting as themselves with 403', async () => {
    const h = harness({ currentUser: siteAdmin() })

    await expect(h.service.addIssue(ORG_A, () => ISSUE)).rejects.toThrow(ForbiddenError)
    expect(h.added).toEqual([])
  })

  it('acts as the target during View As: the target is the author, the admin is the actor', async () => {
    const h = harness({
      currentUser: impersonating({
        targetUserId: 'user-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await h.service.addIssue(ORG_A, () => ISSUE)

    expect(h.added[0]?.authorUserId).toBe('user-1')
    expect(h.added[0]?.promotedByUserId).toBe('user-1')
    const created = h.audit.events.find((e) => e.eventType === 'IdeaCreated')
    const promoted = h.audit.events.find((e) => e.eventType === 'IdeaPromotedToIssue')
    for (const event of [created, promoted]) {
      expect(event?.attribution.actorUserId).toBe('site-admin-1')
      expect(event?.attribution.onBehalfOfUserId).toBe('user-1')
    }
  })

  it('answers 404 for another organization and persists nothing', async () => {
    const h = harness({ currentUser: member(ORG_A) })

    await expect(h.service.addIssue(ORG_B, () => ISSUE)).rejects.toThrow(NotFoundError)
    expect(h.added).toEqual([])
  })
})

describe('IdeaService.addIssue ordering', () => {
  it('refuses Read Only with 403 before reading the body, even when the body is invalid', async () => {
    const h = harness({ currentUser: readOnly(ORG_A) })
    let bodyRead = false

    await expect(
      h.service.addIssue(ORG_A, () => {
        bodyRead = true
        throw new ValidationError('One or more fields are invalid.', { title: ['Required.'] })
      }),
    ).rejects.toThrow(ForbiddenError)
    expect(bodyRead).toBe(false)
  })

  it('answers 404 for another organization before reading the body', async () => {
    const h = harness({ currentUser: member(ORG_A) })
    let bodyRead = false

    await expect(
      h.service.addIssue(ORG_B, () => {
        bodyRead = true
        return ISSUE
      }),
    ).rejects.toThrow(NotFoundError)
    expect(bodyRead).toBe(false)
  })
})

describe('IdeaService.addIssue effort', () => {
  it.each(['Low', 'Medium', 'High'])('accepts %s', async (effort) => {
    const h = harness({ currentUser: member(ORG_A) })

    await h.service.addIssue(ORG_A, () => ({ ...ISSUE, effort }))

    expect(h.added[0]?.effort).toBe(effort)
  })

  it.each(['', 'Huge', 'Extreme'])('refuses %j with a field error keyed effort', async (effort) => {
    const h = harness({ currentUser: member(ORG_A) })

    const error = await refusal(() => h.service.addIssue(ORG_A, () => ({ ...ISSUE, effort })))

    expect(Object.keys(validationFields(error))).toEqual(['effort'])
    expect(h.added).toEqual([])
    expect(h.audit.events).toEqual([])
  })
})

describe('IdeaService.addIssue sprint', () => {
  it('adds to the backlog when sprintId is null', async () => {
    const h = harness({ currentUser: member(ORG_A), sprints: [sprint()] })

    await h.service.addIssue(ORG_A, () => ({ ...ISSUE, sprintId: null }))

    expect(h.added[0]?.sprintId).toBeNull()
  })

  it.each([SprintState.Planned, SprintState.Active])(
    'assigns a %s sprint of the organization',
    async (state) => {
      const h = harness({ currentUser: member(ORG_A), sprints: [sprint({ state })] })

      await h.service.addIssue(ORG_A, () => ({ ...ISSUE, sprintId: 'sprint-1' }))

      expect(h.added[0]?.sprintId).toBe('sprint-1')
    },
  )

  it.each([
    ['a Completed sprint', sprint({ state: SprintState.Completed })],
    ['another organization’s sprint', sprint({ organizationId: ORG_B })],
    ['a deleted sprint', sprint({ isDeleted: true })],
  ])('refuses %s with a field error keyed sprintId and adds nothing', async (_label, target) => {
    const h = harness({ currentUser: member(ORG_A), sprints: [target] })

    const error = await refusal(() =>
      h.service.addIssue(ORG_A, () => ({ ...ISSUE, sprintId: 'sprint-1' })),
    )

    expect(Object.keys(validationFields(error))).toEqual(['sprintId'])
    expect(h.added).toEqual([])
    expect(h.audit.events).toEqual([])
    expect(h.notifications).toEqual([])
  })

  it('refuses an unknown sprint id with a field error keyed sprintId', async () => {
    const h = harness({ currentUser: member(ORG_A) })

    const error = await refusal(() =>
      h.service.addIssue(ORG_A, () => ({ ...ISSUE, sprintId: 'no-such-sprint' })),
    )

    expect(Object.keys(validationFields(error))).toEqual(['sprintId'])
  })
})

describe('IdeaService.addIssue status placement', () => {
  it('places the idea on the organization’s first active status, ignoring any statusId sent', async () => {
    const h = harness({ currentUser: member(ORG_A), firstActiveStatusId: 'first-status' })

    const result = await h.service.addIssue(
      ORG_A,
      () => ({ ...ISSUE, statusId: STATUS_2 }) as AddIssueCommand,
    )

    expect(h.added[0]?.statusId).toBe('first-status')
    expect(result.statusId).toBe('first-status')
  })

  it('refuses with a field error keyed statusId when the organization has no active status', async () => {
    const h = harness({ currentUser: member(ORG_A), firstActiveStatusId: null })

    const error = await refusal(() => h.service.addIssue(ORG_A, () => ISSUE))

    expect(validationFields(error)).toEqual({
      statusId: ['The organization has no active status to place the idea in.'],
    })
    expect(h.added).toEqual([])
  })
})

describe('IdeaService.addIssue result', () => {
  it('persists one Delivery-phase, board-less Pending row promoted by the author at the clock', async () => {
    const h = harness({ currentUser: member(ORG_A, 'user-1') })

    const result = await h.service.addIssue(ORG_A, () => ({ ...ISSUE, effort: 'High' }))

    expect(h.added).toHaveLength(1)
    // Never written as Discovery and then updated: one row, already promoted.
    expect(h.saved).toEqual([])
    expect(h.added[0]).toMatchObject({
      organizationId: ORG_A,
      boardId: null,
      phase: IdeaPhase.Delivery,
      deliveryStatus: DeliveryStatus.Pending,
      effort: EffortLevel.High,
      sprintId: null,
      promotedAtUtc: NOW,
      promotedByUserId: 'user-1',
      upvoteCountAtPromotion: 0,
      authorUserId: 'user-1',
    })
    expect(result).toMatchObject({
      ideaId: h.added[0]?.id,
      boardId: null,
      title: ISSUE.title,
    })
  })

  it('commits once and makes the author follow', async () => {
    const h = harness({ currentUser: member(ORG_A, 'user-1') })

    const result = await h.service.addIssue(ORG_A, () => ISSUE)

    expect(h.followersByIdea.get(result.ideaId)?.has('user-1')).toBe(true)
  })

  it('records IdeaCreated then IdeaPromotedToIssue with the promotion payload', async () => {
    const h = harness({ currentUser: member(ORG_A, 'user-1'), sprints: [sprint()] })

    await h.service.addIssue(ORG_A, () => ({ ...ISSUE, effort: 'Low', sprintId: 'sprint-1' }))

    const types = h.audit.events.map((e) => e.eventType)
    expect(types.indexOf('IdeaCreated')).toBeGreaterThanOrEqual(0)
    expect(types.indexOf('IdeaPromotedToIssue')).toBeGreaterThan(types.indexOf('IdeaCreated'))
    const promoted = h.audit.events.find((e) => e.eventType === 'IdeaPromotedToIssue')
    expect(JSON.parse(promoted?.metadataJson ?? 'null')).toEqual({
      effort: 'Low',
      sprintId: 'sprint-1',
      upvoteCountAtPromotion: 0,
      note: null,
    })
    expect(promoted?.occurredAtUtc).toEqual(NOW)
  })
})

describe('IdeaService.addIssue notifications', () => {
  const ASSIGNEE = 'assignee-1'
  const USERS = [summary({ id: 'user-1' }), summary({ id: ASSIGNEE, email: 'as@acme.test' })]

  it('sends IdeaPromoted to followers other than the actor', async () => {
    const h = harness({ currentUser: member(ORG_A, 'user-1'), users: USERS })

    await h.service.addIssue(ORG_A, () => ({ ...ISSUE, assigneeUserIds: [ASSIGNEE] }))

    const promoted = h.notifications.filter((n) => n.eventType === 'IdeaPromoted')
    expect(promoted.map((n) => n.recipientUserId)).toEqual([ASSIGNEE])
    expect(promoted[0]?.actorUserId).toBe('user-1')
  })

  it('sends no IdeaPromoted when the creator is the only follower', async () => {
    const h = harness({ currentUser: member(ORG_A, 'user-1'), users: USERS })

    await h.service.addIssue(ORG_A, () => ISSUE)

    expect(h.notifications.filter((n) => n.eventType === 'IdeaPromoted')).toEqual([])
  })

  it('still notifies a mentioned user', async () => {
    const h = harness({ currentUser: member(ORG_A, 'user-1'), users: USERS })

    await h.service.addIssue(ORG_A, () => ({ ...ISSUE, mentionEmails: ['as@acme.test'] }))

    const mentions = h.notifications.filter((n) => n.eventType !== 'IdeaPromoted')
    expect(mentions.map((n) => n.recipientUserId)).toEqual([ASSIGNEE])
  })
})

describe('IdeaService.addIssue inherits the pool create’s rules', () => {
  it('refuses a missing title with a field error and adds nothing', async () => {
    const h = harness({ currentUser: member(ORG_A) })

    const error = await refusal(() => h.service.addIssue(ORG_A, () => ({ ...ISSUE, title: '   ' })))

    expect(Object.keys(validationFields(error))).toEqual(['title'])
    expect(h.added).toEqual([])
    expect(h.audit.events).toEqual([])
  })

  it('refuses an assignee from another organization and adds nothing', async () => {
    const h = harness({
      currentUser: member(ORG_A),
      users: [summary({ id: 'outsider', organizationId: ORG_B, email: 'out@beta.test' })],
    })

    await expect(
      h.service.addIssue(ORG_A, () => ({ ...ISSUE, assigneeUserIds: ['outsider'] })),
    ).rejects.toThrow(ValidationError)
    expect(h.added).toEqual([])
  })
})
