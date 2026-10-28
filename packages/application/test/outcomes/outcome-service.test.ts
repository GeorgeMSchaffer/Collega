// Outcomes (SPEC/contracts/outcomes.md): the rules this slice introduces. Roles, rollup counts and
// the full validation matrix belong to the QA slice.

import { Priority, UserStatus } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createOutcome, type Outcome } from '@collega/domain/outcomes'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext, RandomSource } from '../../src/common/index.js'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { CreateOutcomeCommand } from '../../src/outcomes/models.js'
import { OutcomeService } from '../../src/outcomes/outcome.service.js'
import type {
  OutcomeIdeasPort,
  OutcomeReadsPort,
  OutcomeRepository,
  OutcomeUserSummary,
  OutcomeUsersPort,
} from '../../src/outcomes/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  ORG_B,
  openBoards,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

function outcome(id: string, sortOrder: number, overrides: Partial<Outcome> = {}): Outcome {
  return {
    ...createOutcome({
      id,
      organizationId: ORG_A,
      name: `Outcome ${id}`,
      description: null,
      targetStartDate: '2026-10-01',
      targetEndDate: '2026-12-31',
      ownerUserId: null,
      sortOrder,
      color: '#112233',
      nowUtc: NOW,
      actorUserId: 'seed',
    }),
    ...overrides,
  }
}

function idea(id: string, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id,
      organizationId: ORG_A,
      boardId: 'board-a',
      statusId: 'status-1',
      title: `Idea ${id}`,
      description: 'Body',
      problem: 'A problem',
      proposedSolutions: ['A solution'],
      impactRationale: 'A rationale',
      priority: Priority.Medium,
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
      dueDate: null,
      authorUserId: 'author-1',
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    ...overrides,
  }
}

const CREATE: CreateOutcomeCommand = {
  name: 'Launch',
  description: null,
  targetStartDate: '2026-10-01',
  targetEndDate: '2026-12-31',
  ownerUserId: null,
  color: null,
}

function harness(options: {
  currentUser: CurrentUserContext
  outcomes?: readonly Outcome[]
  ideas?: readonly Idea[]
  users?: readonly OutcomeUserSummary[]
}) {
  const byId = new Map((options.outcomes ?? []).map((o) => [o.id, o]))
  const ideasById = new Map((options.ideas ?? []).map((i) => [i.id, i]))
  const added: Outcome[] = []
  const saved: Outcome[] = []
  const ideaUpdates: Idea[] = []
  const ungrouped: string[] = []

  const outcomes: OutcomeRepository = {
    async getById(id) {
      return byId.get(id) ?? null
    },
    async listByOrganization(organizationId) {
      return [...byId.values()]
        .filter((o) => o.organizationId === organizationId && !o.isDeleted)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    },
    async add(o) {
      added.push(o)
      byId.set(o.id, o)
    },
    async save(o) {
      saved.push(o)
      byId.set(o.id, o)
    },
    async ungroupIdeas(id) {
      ungrouped.push(id)
    },
  }
  const reads: OutcomeReadsPort = {
    async rollupsByOutcomeIds() {
      return new Map()
    },
    async ideasByOutcomeIds() {
      return new Map()
    },
    async listUngroupedIdeas() {
      return []
    },
  }
  const ideasPort: OutcomeIdeasPort = {
    async getById(id) {
      return ideasById.get(id) ?? null
    },
    async update(i) {
      ideaUpdates.push(i)
    },
  }
  const usersById = new Map((options.users ?? []).map((u) => [u.id, u]))
  const users: OutcomeUsersPort = {
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const found = usersById.get(id)
        return found ? [found] : []
      })
    },
  }
  const random: RandomSource = { nextInt: () => 0 }
  const audit = recordingAudit()

  return {
    service: new OutcomeService(
      outcomes,
      reads,
      ideasPort,
      users,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
      random,
      openBoards(),
    ),
    added,
    saved,
    ideaUpdates,
    ungrouped,
    audit,
  }
}

describe('OutcomeService access', () => {
  it('refuses a direct Site Admin on reads as well as writes', async () => {
    const { service } = harness({ currentUser: siteAdmin() })

    await expect(service.list(ORG_A, undefined)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(service.roadmap(ORG_A)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(service.create(ORG_A, CREATE)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lets a Read Only member read but not manage', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A) })

    await expect(service.list(ORG_A, undefined)).resolves.toMatchObject({ totalCount: 0 })
    await expect(service.create(ORG_A, CREATE)).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('OutcomeService create and update', () => {
  it('appends at the end of the order, takes a palette colour, and allows a duplicate name', async () => {
    const { service, added, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0, { name: 'Launch' }), outcome('o2', 4)],
    })

    const created = await service.create(ORG_A, CREATE)

    expect(created.sortOrder).toBe(5)
    expect(created.color).toMatch(/^#[0-9A-F]{6}$/)
    expect(added).toHaveLength(1)
    expect(audit.events.map((e) => e.eventType)).toEqual(['OutcomeCreated'])
  })

  it('upper-cases a supplied colour and refuses a bad one', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    await expect(service.create(ORG_A, { ...CREATE, color: '#abcdef' })).resolves.toMatchObject({
      color: '#ABCDEF',
    })
    await expect(service.create(ORG_A, { ...CREATE, color: 'red' })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('keeps the colour when absent on update, refuses null, and writes no audit when nothing changed', async () => {
    const existing = outcome('o1', 0)
    const { service, saved, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [existing],
    })
    const same = {
      name: existing.name,
      description: null,
      targetStartDate: existing.targetStartDate,
      targetEndDate: existing.targetEndDate,
      ownerUserId: null,
    }

    await expect(service.update(ORG_A, 'o1', { ...same, color: undefined })).resolves.toMatchObject(
      { color: '#112233' },
    )
    expect(saved).toHaveLength(0)
    expect(audit.events).toHaveLength(0)

    await expect(service.update(ORG_A, 'o1', { ...same, color: null })).rejects.toBeInstanceOf(
      ValidationError,
    )

    await service.update(ORG_A, 'o1', { ...same, name: 'Renamed', color: undefined })
    expect(audit.events).toHaveLength(1)
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toEqual({
      changes: { name: { from: existing.name, to: 'Renamed' } },
    })
  })

  it('refuses an owner who is not an active user of the organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [{ id: 'u1', organizationId: ORG_B, status: UserStatus.Active }],
    })

    await expect(service.create(ORG_A, { ...CREATE, ownerUserId: 'u1' })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})

describe('OutcomeService reorder', () => {
  it('moves the listed Outcomes first and renumbers the rest 0..n-1', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('a', 0), outcome('b', 1), outcome('c', 2), outcome('d', 3)],
    })

    await service.reorder(ORG_A, ['c', 'b'])

    const order = new Map(saved.map((o) => [o.id, o.sortOrder]))
    expect(order.get('c')).toBe(0)
    expect(order.has('b')).toBe(false) // already at position 1: not rewritten
    expect(order.get('a')).toBe(2)
    expect(order.has('d')).toBe(false)
  })

  it('refuses an empty list, a duplicate, and an id outside the active set', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('a', 0), outcome('gone', 1, { isDeleted: true })],
    })

    for (const ids of [null, [], ['a', 'a'], ['nope'], ['gone']]) {
      await expect(service.reorder(ORG_A, ids)).rejects.toBeInstanceOf(ValidationError)
    }
  })
})

describe('OutcomeService delete', () => {
  it('ungroups the items, soft deletes, and answers a repeat delete without a second audit', async () => {
    const { service, saved, ungrouped, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
    })

    await service.delete(ORG_A, 'o1')
    await service.delete(ORG_A, 'o1')

    expect(ungrouped).toEqual(['o1'])
    expect(saved).toHaveLength(1)
    expect(saved[0]?.isDeleted).toBe(true)
    expect(audit.events.map((e) => e.eventType)).toEqual(['OutcomeDeleted'])
  })

  it('answers 404 for an Outcome that never existed or belongs to another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('other', 0, { organizationId: ORG_B })],
    })

    await expect(service.delete(ORG_A, 'missing')).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.delete(ORG_A, 'other')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('OutcomeService grouping', () => {
  it('groups a standalone card on a child board and audits the change with names', async () => {
    const { service, ideaUpdates, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
      ideas: [idea('standalone', { boardId: 'child-board', parentIdeaId: null })],
    })

    await expect(service.setIdeaOutcome('standalone', 'o1')).resolves.toEqual({
      ideaId: 'standalone',
      outcomeId: 'o1',
    })
    expect(ideaUpdates[0]?.outcomeId).toBe('o1')
    expect(JSON.parse(audit.events[0]?.metadataJson ?? '{}')).toMatchObject({
      ideaId: 'standalone',
      fromOutcomeId: null,
      toOutcomeId: 'o1',
      toOutcomeName: 'Outcome o1',
    })
  })

  it('refuses a task (an item with a parent) with 422 taskCannotBeGrouped', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0)],
      ideas: [idea('task', { parentIdeaId: 'parent' })],
    })

    const error = await service.setIdeaOutcome('task', 'o1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UnprocessableError)
    expect((error as UnprocessableError).code).toBe('taskCannotBeGrouped')
  })

  it('writes nothing for a no-op, moves between Outcomes, and ungroups with null', async () => {
    const { service, ideaUpdates, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [outcome('o1', 0), outcome('o2', 1)],
      ideas: [idea('i1', { outcomeId: 'o1' })],
    })

    await service.setIdeaOutcome('i1', 'o1')
    expect(ideaUpdates).toHaveLength(0)
    expect(audit.events).toHaveLength(0)

    await service.setIdeaOutcome('i1', 'o2')
    await service.setIdeaOutcome('i1', null)
    expect(ideaUpdates.map((i) => i.outcomeId)).toEqual(['o2', null])
    expect(audit.events.map((e) => e.eventType)).toEqual([
      'IssueOutcomeGroupingChanged',
      'IssueOutcomeGroupingChanged',
    ])
  })

  it('answers 404 for an unknown idea before 400 for the Outcome, and 400 outcomeId for a bad Outcome', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      outcomes: [
        outcome('deleted', 0, { isDeleted: true }),
        outcome('other', 1, { organizationId: ORG_B }),
      ],
      ideas: [idea('i1')],
    })

    await expect(service.setIdeaOutcome('missing', 'nope')).rejects.toBeInstanceOf(NotFoundError)
    for (const id of ['nope', 'deleted', 'other']) {
      const error = await service.setIdeaOutcome('i1', id).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toHaveProperty('outcomeId')
    }
  })
})
