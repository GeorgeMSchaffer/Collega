// `itemKey` on each item of an Outcome (SPEC/contracts/outcomes.md, owner decision 2026-10-19):
// the service hands the reads port's key through untouched on detail, roadmap and the ungrouped
// list, a real key and `null` alike. Deriving the key is the repository's, pinned against a live
// database in the infrastructure suite.

import { createOutcome, type Outcome } from '@collega/domain/outcomes'
import { describe, expect, it } from 'vitest'
import type { OutcomeIdea } from '../../src/outcomes/models.js'
import { OutcomeService } from '../../src/outcomes/outcome.service.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  orgAdmin,
  readOnly,
  recordingAudit,
} from '../support/fixtures.js'

const outcome: Outcome = createOutcome({
  id: 'o1',
  organizationId: ORG_A,
  name: 'Launch',
  description: null,
  targetStartDate: '2026-10-01',
  targetEndDate: '2026-12-31',
  ownerUserId: null,
  sortOrder: 0,
  color: '#112233',
  nowUtc: NOW,
  actorUserId: 'seed',
})

function idea(ideaId: string, itemKey: string | null): OutcomeIdea {
  return {
    ideaId,
    itemKey,
    title: `Idea ${ideaId}`,
    statusId: 's',
    effort: null,
    assigneeUserIds: [],
    sprintId: null,
    sprintStart: null,
    sprintEnd: null,
    metrics: [],
  }
}

const keyed = idea('keyed', 'PRJ-7')
const unkeyed = idea('unkeyed', null)

function build(currentUser = orgAdmin()) {
  return new OutcomeService(
    {
      getById: async (id) => (id === outcome.id ? outcome : null),
      listByOrganization: async () => [outcome],
      add: async () => {},
      save: async () => {},
      ungroupIdeas: async () => {},
    },
    {
      rollupsByOutcomeIds: async () => new Map(),
      ideasByOutcomeIds: async (ids) => new Map(ids.map((id) => [id, [keyed, unkeyed]])),
      listUngroupedIdeas: async () => [keyed, unkeyed],
    },
    { getById: async () => null, update: async () => {} },
    { listByIds: async () => [] },
    countingUnitOfWork(),
    recordingAudit(),
    currentUser,
    fixedClock(),
    { nextInt: () => 0 },
  )
}

const keysOf = (ideas: readonly OutcomeIdea[] | undefined) =>
  ideas?.map((i) => [i.ideaId, i.itemKey])

describe('itemKey on Outcome items', () => {
  const expected = [
    ['keyed', 'PRJ-7'],
    ['unkeyed', null],
  ]

  it('is a real key or null, present either way, on the detail read', async () => {
    const detail = await build().get(ORG_A, 'o1')

    expect(keysOf(detail.ideas)).toEqual(expected)
    expect(detail.ideas[1]).toHaveProperty('itemKey', null)
  })

  it('is on the roadmap grouped items and on the ungrouped list', async () => {
    const roadmap = await build().roadmap(ORG_A)

    expect(keysOf(roadmap.outcomes[0]?.ideas)).toEqual(expected)
    expect(keysOf(roadmap.ungrouped)).toEqual(expected)
  })

  it('reads the same for a Read Only member', async () => {
    const roadmap = await build(readOnly()).roadmap(ORG_A)

    expect(keysOf(roadmap.ungrouped)).toEqual(expected)
  })
})
