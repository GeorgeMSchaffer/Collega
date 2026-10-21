// The per-idea `metrics` of an Outcome's items (SPEC/contracts/outcomes.md, 2026-10-19) and the
// metric totals beside the rollup: the service hands the reads port's values through untouched on
// detail, roadmap and the ungrouped list, and never invents totals for a new Outcome.

import { createOutcome, type Outcome } from '@collega/domain/outcomes'
import { describe, expect, it } from 'vitest'
import type { OutcomeIdea, OutcomeRollup } from '../../src/outcomes/models.js'
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

const withMetrics: OutcomeIdea = {
  ideaId: 'i1',
  title: 'Saves money',
  itemKey: null,
  statusId: 's',
  effort: null,
  assigneeUserIds: [],
  sprintId: null,
  sprintStart: null,
  sprintEnd: null,
  metrics: [
    { metricTypeId: 'm-a', projected: 1.5, realized: null },
    { metricTypeId: 'm-b', projected: null, realized: 2 },
  ],
}
const free: OutcomeIdea = { ...withMetrics, ideaId: 'i2', metrics: [] }

const totals: OutcomeRollup = {
  ideaCount: 1,
  doneIdeaCount: 0,
  taskCount: 0,
  doneTaskCount: 0,
  sprintStart: null,
  sprintEnd: null,
  metricTotals: [
    { metricTypeId: 'm-a', name: 'Savings', unit: '$', projected: 1.5, realized: null },
  ],
}

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
      rollupsByOutcomeIds: async (ids) => new Map(ids.map((id) => [id, totals])),
      ideasByOutcomeIds: async (ids) => new Map(ids.map((id) => [id, [withMetrics]])),
      listUngroupedIdeas: async () => [free],
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

describe('Outcome metrics through the service', () => {
  it('detail returns each item with its metrics and the totals flat beside the item fields', async () => {
    const detail = await build().get(ORG_A, 'o1')

    expect(detail.ideas).toEqual([withMetrics])
    expect(detail.metricTotals).toEqual(totals.metricTotals)
    expect(detail).not.toHaveProperty('ownerDisplayName')
  })

  it('roadmap returns metrics on the grouped and on the ungrouped items', async () => {
    const roadmap = await build().roadmap(ORG_A)

    expect(roadmap.outcomes[0]?.ideas[0]?.metrics).toEqual(withMetrics.metrics)
    expect(roadmap.outcomes[0]?.metricTotals).toEqual(totals.metricTotals)
    expect(roadmap.ungrouped).toEqual([free])
    expect(roadmap.ungrouped[0]?.metrics).toEqual([])
  })

  it('list items carry the totals but not the items', async () => {
    const page = await build().list(ORG_A, undefined)

    expect(page.items[0]?.metricTotals).toEqual(totals.metricTotals)
    expect(page.items[0]).not.toHaveProperty('ideas')
  })

  it('a Read Only member reads the metrics too', async () => {
    const roadmap = await build(readOnly()).roadmap(ORG_A)

    expect(roadmap.outcomes[0]?.ideas[0]?.metrics).toHaveLength(2)
  })

  it('a new Outcome answers an empty metricTotals, whatever else exists', async () => {
    const created = await build().create(ORG_A, {
      name: 'Fresh',
      description: null,
      targetStartDate: '2026-10-01',
      targetEndDate: '2026-12-31',
      ownerUserId: null,
      color: null,
    })

    expect(created.metricTotals).toEqual([])
    expect(created).not.toHaveProperty('ideas')
  })
})
