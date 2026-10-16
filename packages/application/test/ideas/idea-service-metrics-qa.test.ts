// QA for the `metrics` array on the idea detail read (SPEC/contracts/ideas.md, SPEC/contracts/metric-types.md
// "GET /ideas/{ideaId}/metrics"): the detail returns the same array as the metrics route, and `[]`
// for a card with a parent.

import { describe, expect, it, vi } from 'vitest'
import type { IdeaMetric } from '../../src/metric-types/models.js'
import { member, ORG_A } from '../support/fixtures.js'
import { board, harness, idea } from './idea-service-harness.js'

const VALUE: IdeaMetric = {
  metricTypeId: 'mt-1',
  name: 'Savings',
  unit: '$',
  isArchived: false,
  projected: 10.5,
  realized: null,
}
const ARCHIVED: IdeaMetric = { ...VALUE, metricTypeId: 'mt-2', isArchived: true }

describe('IdeaService.getById: metrics', () => {
  it('returns the stored values, archived ones included and flagged', async () => {
    const listByIdea = vi.fn(async () => [VALUE, ARCHIVED])
    const h = harness({
      currentUser: member(ORG_A),
      boards: [board()],
      ideas: [idea()],
      metricValues: { listByIdea },
    })

    const detail = await h.service.getById('idea-1')

    expect(detail.metrics).toEqual([VALUE, ARCHIVED])
    expect(listByIdea).toHaveBeenCalledWith('idea-1')
  })

  it('returns an empty array for an item with no values', async () => {
    const h = harness({
      currentUser: member(ORG_A),
      boards: [board()],
      ideas: [idea()],
      metricValues: { listByIdea: async () => [] },
    })

    expect((await h.service.getById('idea-1')).metrics).toEqual([])
  })

  it('returns an empty array for a card with a parent, without reading values', async () => {
    const listByIdea = vi.fn(async () => [VALUE])
    const h = harness({
      currentUser: member(ORG_A),
      boards: [board()],
      ideas: [idea({ id: 'task-1', parentIdeaId: 'idea-1' })],
      metricValues: { listByIdea },
    })

    const detail = await h.service.getById('task-1')

    expect(detail.metrics).toEqual([])
    expect(listByIdea).not.toHaveBeenCalled()
  })
})
