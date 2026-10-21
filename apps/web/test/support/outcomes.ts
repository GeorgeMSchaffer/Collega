import type { OutcomeIdea, OutcomeWithIdeas } from '@/lib/types'

/** An Outcome as `GET /roadmap` returns it; a test overrides only what it is about. */
export function outcome(overrides: Partial<OutcomeWithIdeas> = {}): OutcomeWithIdeas {
  return {
    id: 'o-1',
    name: 'Faster onboarding',
    description: null,
    targetStartDate: '2026-10-01',
    targetEndDate: '2026-12-31',
    ownerUserId: null,
    sortOrder: 1,
    color: '#336699',
    ideaCount: 0,
    doneIdeaCount: 0,
    taskCount: 0,
    doneTaskCount: 0,
    sprintStart: null,
    sprintEnd: null,
    metricTotals: [],
    ideas: [],
    ...overrides,
  }
}

export function outcomeIdea(id: string, overrides: Partial<OutcomeIdea> = {}): OutcomeIdea {
  return {
    id,
    itemKey: null,
    title: `Idea ${id}`,
    statusId: 's-open',
    effort: null,
    assigneeUserIds: [],
    sprintId: null,
    sprintStart: null,
    sprintEnd: null,
    metrics: [],
    ...overrides,
  }
}
