// Structured idea fields (SPEC/20-feature-ideas-and-engagement.md rule 2a): Problem and Impact
// rationale are required and bounded; Proposed solutions is 1 to 5 trimmed, non-blank, one-line
// entries of bounded length; Description became optional. Limits are judged on the trimmed value.

import { describe, expect, it } from 'vitest'
import { Priority } from '../../src/enums/index.js'
import {
  type CreateIdeaProps,
  createIdea,
  DESCRIPTION_MAX_LENGTH,
  type Idea,
  IdeaDomainError,
  IMPACT_RATIONALE_MAX_LENGTH,
  MAX_PROPOSED_SOLUTIONS,
  PROBLEM_MAX_LENGTH,
  PROPOSED_SOLUTION_MAX_LENGTH,
  updateIdeaContent,
} from '../../src/ideas/index.js'

const NOW = new Date('2026-09-27T12:00:00.000Z')
const LATER = new Date('2026-09-28T12:00:00.000Z')

const BASE: CreateIdeaProps = {
  id: 'idea-1',
  organizationId: 'org-1',
  boardId: 'board-1',
  statusId: 'status-1',
  title: 'Reduce onboarding friction',
  description: null,
  problem: 'Onboarding takes too long.',
  proposedSolutions: ['Cut the number of forms.'],
  impactRationale: 'Faster activation.',
  priority: Priority.Medium,
  ideaTypeId: 'type-1',
  businessImpactId: 'impact-1',
  dueDate: null,
  authorUserId: 'user-1',
  assigneeUserIds: [],
  tagIds: [],
  mentionedUserIds: [],
  nowUtc: NOW,
}

function create(overrides: Partial<CreateIdeaProps> = {}): Idea {
  return createIdea({ ...BASE, ...overrides })
}

function update(idea: Idea, overrides: Partial<Parameters<typeof updateIdeaContent>[1]> = {}) {
  return updateIdeaContent(
    idea,
    {
      title: idea.title,
      description: idea.description,
      problem: idea.problem,
      proposedSolutions: idea.proposedSolutions,
      impactRationale: idea.impactRationale,
      priority: idea.priority,
      businessImpactId: idea.businessImpactId,
      dueDate: idea.dueDate,
      ...overrides,
    },
    LATER,
    'user-2',
  )
}

function fieldOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof IdeaDomainError) {
      return error.field
    }
    throw error
  }
  throw new Error('expected an IdeaDomainError, but nothing was thrown')
}

describe('Problem and Impact rationale', () => {
  it('stores both trimmed', () => {
    const idea = create({ problem: '  Slow.\n', impactRationale: '\tFaster.  ' })

    expect(idea.problem).toBe('Slow.')
    expect(idea.impactRationale).toBe('Faster.')
  })

  it.each([
    ['problem', { problem: '' }],
    ['problem', { problem: '   \n ' }],
    ['impactRationale', { impactRationale: '' }],
    ['impactRationale', { impactRationale: ' \t ' }],
  ] as const)('requires %s, refusing blank as missing', (field, overrides) => {
    expect(fieldOf(() => create(overrides))).toBe(field)
  })

  it('accepts Problem at its limit, padding not counted, and refuses one character more', () => {
    const atLimit = 'p'.repeat(PROBLEM_MAX_LENGTH)

    expect(create({ problem: `  ${atLimit}  ` }).problem).toBe(atLimit)
    expect(fieldOf(() => create({ problem: `${atLimit}p` }))).toBe('problem')
  })

  it('accepts Impact rationale at its limit and refuses one character more', () => {
    const atLimit = 'r'.repeat(IMPACT_RATIONALE_MAX_LENGTH)

    expect(create({ impactRationale: atLimit }).impactRationale).toBe(atLimit)
    expect(fieldOf(() => create({ impactRationale: `${atLimit}r` }))).toBe('impactRationale')
  })

  it('pins the limits the contract names', () => {
    expect([PROBLEM_MAX_LENGTH, IMPACT_RATIONALE_MAX_LENGTH]).toEqual([2000, 1000])
    expect([MAX_PROPOSED_SOLUTIONS, PROPOSED_SOLUTION_MAX_LENGTH]).toEqual([5, 500])
  })
})

describe('Proposed solutions', () => {
  it('trims each solution, drops blank ones and keeps the order', () => {
    const idea = create({ proposedSolutions: ['  second  ', '', '   ', 'first', '\tthird'] })

    expect(idea.proposedSolutions).toEqual(['second', 'first', 'third'])
  })

  it('requires at least one non-blank solution', () => {
    expect(fieldOf(() => create({ proposedSolutions: [] }))).toBe('proposedSolutions')
    expect(fieldOf(() => create({ proposedSolutions: ['', '  '] }))).toBe('proposedSolutions')
  })

  it('accepts five and refuses six', () => {
    const five = ['a', 'b', 'c', 'd', 'e']

    expect(create({ proposedSolutions: five }).proposedSolutions).toEqual(five)
    expect(fieldOf(() => create({ proposedSolutions: [...five, 'f'] }))).toBe('proposedSolutions')
  })

  it('counts only the non-blank solutions against the limit of five', () => {
    const idea = create({ proposedSolutions: ['a', ' ', 'b', '', 'c', 'd', '  ', 'e'] })

    expect(idea.proposedSolutions).toHaveLength(5)
  })

  it('accepts a solution at its limit, padding not counted, and refuses one character more', () => {
    const atLimit = 's'.repeat(PROPOSED_SOLUTION_MAX_LENGTH)

    expect(create({ proposedSolutions: [` ${atLimit} `] }).proposedSolutions).toEqual([atLimit])
    expect(fieldOf(() => create({ proposedSolutions: ['ok', `${atLimit}s`] }))).toBe(
      'proposedSolutions',
    )
  })

  it.each([
    ['a line feed', 'first line\nsecond line'],
    ['a carriage return', 'first line\rsecond line'],
    ['a CRLF', 'first line\r\nsecond line'],
  ])('refuses a solution containing %s, since CSV writes one solution per line', (_label, text) => {
    expect(fieldOf(() => create({ proposedSolutions: [text] }))).toBe('proposedSolutions')
  })

  it('allows a line break only as surrounding whitespace, which trimming removes', () => {
    expect(create({ proposedSolutions: ['\nOne line.\r\n'] }).proposedSolutions).toEqual([
      'One line.',
    ])
  })
})

describe('Description', () => {
  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace only', ' \n\t '],
  ])('stores a %s description as none', (_label, description) => {
    expect(create({ description }).description).toBeNull()
  })

  it('stores a description trimmed, at its limit, and refuses one character more', () => {
    const atLimit = 'd'.repeat(DESCRIPTION_MAX_LENGTH)

    expect(create({ description: ` ${atLimit} ` }).description).toBe(atLimit)
    expect(fieldOf(() => create({ description: `${atLimit}d` }))).toBe('description')
  })
})

describe('updateIdeaContent structured fields', () => {
  it('applies the same normalization as create', () => {
    const updated = update(create({ description: 'Old summary.' }), {
      description: '   ',
      problem: ' New problem. ',
      proposedSolutions: [' x ', '', 'y'],
      impactRationale: ' New rationale. ',
    })

    expect(updated.description).toBeNull()
    expect(updated.problem).toBe('New problem.')
    expect(updated.proposedSolutions).toEqual(['x', 'y'])
    expect(updated.impactRationale).toBe('New rationale.')
    expect(updated.updatedAtUtc).toEqual(LATER)
  })

  it.each([
    ['problem', { problem: ' ' }],
    ['proposedSolutions', { proposedSolutions: [' '] }],
    ['proposedSolutions', { proposedSolutions: ['a', 'b', 'c', 'd', 'e', 'f'] }],
    ['proposedSolutions', { proposedSolutions: ['two\nlines'] }],
    ['impactRationale', { impactRationale: '' }],
  ] as const)('refuses an invalid %s on update', (field, overrides) => {
    expect(fieldOf(() => update(create(), overrides))).toBe(field)
  })
})
