// Slice 099's rules in IdeaService: who may change the structured fields (rule 2a follows
// Description's author-or-Org-Admin rule), what an archived board refuses with 409 and what it
// still allows (SPEC/20-feature-boards-and-statuses.md rule 13), that a role refusal is still 403 on
// an archived board, the list tag-filter normalization, and CSV import's backfill and round trip.

import { SprintState } from '@collega/domain/enums'
import { NOT_CAPTURED_TEXT, PROBLEM_MAX_LENGTH } from '@collega/domain/ideas'
import { describe, expect, it } from 'vitest'
import { ConflictError, ForbiddenError, ValidationError } from '../../src/common/index.js'
import type { IdeaImportRow } from '../../src/ideas/models.js'
import { member, ORG_A, orgAdmin, readOnly, siteAdmin } from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_A,
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  LIST_QUERY,
  ORG_LIST_QUERY,
  promotedIdea,
  STATUS_2,
  TYPE_A,
  updateFrom,
} from './idea-service-harness.js'

const STRANGER = 'someone-else'
const archivedBoard = board({ isArchived: true })

function failuresOf(error: unknown): Readonly<Record<string, readonly string[]>> {
  if (error instanceof ValidationError) {
    return error.failures
  }
  throw error
}

// Structured content authorization ---------------------------------------------------------

describe('IdeaService structured fields: author or Org Admin only', () => {
  it.each([
    ['problem', { problem: 'A different problem.' }],
    ['proposed solutions', { proposedSolutions: ['Cut the number of forms.', 'Add SSO.'] }],
    ['proposed solutions order', { proposedSolutions: ['Another solution.'] }],
    ['impact rationale', { impactRationale: 'A different rationale.' }],
    ['description', { description: null }],
  ])('refuses a non-author User changing the %s', async (_label, change) => {
    const { service, saved } = harness({
      currentUser: member(ORG_A, STRANGER),
      ideas: [idea()],
    })

    await expect(service.update('idea-1', { ...updateFrom(idea()), ...change })).rejects.toThrow(
      ForbiddenError,
    )
    expect(saved).toHaveLength(0)
  })

  it('does not count resubmitting the stored values, padded and with a blank solution, as a change', async () => {
    const { service, saved } = harness({
      currentUser: member(ORG_A, STRANGER),
      ideas: [idea()],
    })

    await service.update('idea-1', {
      ...updateFrom(idea()),
      title: 'A better title',
      problem: '  Onboarding takes too long.  ',
      proposedSolutions: [' Cut the number of forms. ', '   '],
      impactRationale: '\tFaster activation.\n',
    })

    expect(saved).toHaveLength(1)
    expect(saved[0]?.title).toBe('A better title')
  })

  it.each([
    ['the author', member(ORG_A, AUTHOR)],
    ['an Org Admin of the idea’s organization', orgAdmin(ORG_A)],
  ])('lets %s change every structured field', async (_label, currentUser) => {
    const { service, saved } = harness({ currentUser, ideas: [idea()] })

    await service.update('idea-1', {
      ...updateFrom(idea()),
      problem: 'New problem.',
      proposedSolutions: ['One.', 'Two.'],
      impactRationale: 'New rationale.',
    })

    expect(saved[0]).toMatchObject({
      problem: 'New problem.',
      proposedSolutions: ['One.', 'Two.'],
      impactRationale: 'New rationale.',
    })
  })

  it('keys a missing proposed solutions list to its field as a validation failure', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    const error = await service
      .create(BOARD_A, { ...CREATE, proposedSolutions: null as unknown as string[] })
      .catch((e: unknown) => e)

    expect(Object.keys(failuresOf(error))).toEqual(['proposedSolutions'])
    expect(added).toHaveLength(0)
  })

  it.each([
    ['problem', { problem: '  ' }],
    ['impactRationale', { impactRationale: '' }],
    ['proposedSolutions', { proposedSolutions: ['a', 'b', 'c', 'd', 'e', 'f'] }],
  ])('keys an invalid %s on create to that field', async (field, change) => {
    const { service } = harness({ currentUser: member(ORG_A, AUTHOR) })

    const error = await service.create(BOARD_A, { ...CREATE, ...change }).catch((e: unknown) => e)

    expect(Object.keys(failuresOf(error))).toEqual([field])
  })

  it('leaves stored custom field values untouched when an update sends fieldValues: null', async () => {
    const withValues = idea({ fieldValues: [{ fieldDefinitionId: 'field-1', value: 'kept' }] })
    const { service, saved } = harness({ currentUser: orgAdmin(ORG_A), ideas: [withValues] })

    await service.update('idea-1', {
      ...updateFrom(withValues),
      title: 'Renamed',
      fieldValues: null,
    })

    expect(saved[0]?.fieldValues).toEqual(withValues.fieldValues)
  })
})

// Archived board: refused -----------------------------------------------------------------

describe('IdeaService on an archived board', () => {
  const refused: readonly [string, (h: ReturnType<typeof harness>) => Promise<unknown>][] = [
    ['create', (h) => h.service.create(BOARD_A, CREATE)],
    ['update', (h) => h.service.update('idea-1', { ...updateFrom(idea()), title: 'Renamed' })],
    ['move', (h) => h.service.changeStatus('idea-1', { statusId: STATUS_2 })],
    ['delete', (h) => h.service.delete('idea-1')],
    ['CSV import', (h) => h.service.importBoardIdeas(BOARD_A, [])],
    ['Idea Type reassignment', (h) => h.service.reassignIdeaType(ORG_A, 'idea-1', TYPE_A)],
    [
      'promote',
      (h) => h.service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ],
  ]

  it.each(refused)('refuses an Org Admin’s %s with 409', async (_label, act) => {
    const h = harness({ currentUser: orgAdmin(ORG_A), boards: [archivedBoard], ideas: [idea()] })

    await expect(act(h)).rejects.toThrow(ConflictError)
    expect(h.added).toHaveLength(0)
    expect(h.saved).toHaveLength(0)
  })

  it('refuses returning a promoted Issue to Discovery with 409', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [archivedBoard],
      ideas: [promotedIdea()],
    })

    await expect(h.service.returnToDiscovery('idea-1')).rejects.toThrow(ConflictError)
    expect(h.saved).toHaveLength(0)
  })

  it('accepts the same update once the board is active', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [idea()] })

    await h.service.update('idea-1', { ...updateFrom(idea()), title: 'Renamed' })

    expect(h.saved).toHaveLength(1)
  })
})

// Archived board: still allowed --------------------------------------------------------------

describe('IdeaService on an archived board still allows', () => {
  it('reading an idea and the board list', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      boards: [archivedBoard],
      ideas: [idea()],
    })

    await expect(service.getById('idea-1')).resolves.toMatchObject({ ideaId: 'idea-1' })
    await expect(service.listByBoard(BOARD_A, LIST_QUERY)).resolves.toMatchObject({
      totalCount: 1,
    })
  })

  it('exporting its ideas', async () => {
    const { service } = harness({
      currentUser: readOnly(ORG_A),
      boards: [archivedBoard],
      ideas: [idea()],
    })

    const exported = await service.exportBoardIdeas(BOARD_A)

    expect(exported.rows).toHaveLength(1)
  })

  it('a delivery status change on an Issue already promoted from it', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [archivedBoard],
      ideas: [promotedIdea()],
    })

    await service.changeDeliveryStatus('idea-1', { deliveryStatus: 'Development' })

    expect(saved[0]?.deliveryStatus).toBe('Development')
  })

  it('a sprint assignment on an Issue already promoted from it', async () => {
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [archivedBoard],
      ideas: [promotedIdea()],
      sprints: [
        {
          id: 'sprint-a',
          organizationId: ORG_A,
          name: 'Sprint 1',
          startDate: '2026-09-21',
          endDate: '2026-10-04',
          state: SprintState.Planned,
          isDeleted: false,
        },
      ],
    })

    await service.assignToSprint('idea-1', { sprintId: 'sprint-a' })

    expect(saved[0]?.sprintId).toBe('sprint-a')
  })
})

// 403 before 409 ------------------------------------------------------------------------------

describe('IdeaService answers a role refusal with 403 even on an archived board', () => {
  const cases: readonly [
    string,
    () => ReturnType<typeof orgAdmin>,
    (h: ReturnType<typeof harness>) => Promise<unknown>,
  ][] = [
    ['a direct Site Admin creating', () => siteAdmin(), (h) => h.service.create(BOARD_A, CREATE)],
    ['Read Only creating', () => readOnly(ORG_A), (h) => h.service.create(BOARD_A, CREATE)],
    [
      'Read Only editing',
      () => readOnly(ORG_A),
      (h) => h.service.update('idea-1', updateFrom(idea())),
    ],
    ['Read Only importing', () => readOnly(ORG_A), (h) => h.service.importBoardIdeas(BOARD_A, [])],
    ['a User deleting', () => member(ORG_A, AUTHOR), (h) => h.service.delete('idea-1')],
    [
      'a User reassigning the type',
      () => member(ORG_A, AUTHOR),
      (h) => h.service.reassignIdeaType(ORG_A, 'idea-1', TYPE_A),
    ],
    [
      'a bystander promoting',
      () => member(ORG_A, STRANGER),
      (h) => h.service.promote('idea-1', { effort: 'Medium', sprintId: null, note: null }),
    ],
    [
      'a User moving on a board that does not opt users in',
      () => member(ORG_A, AUTHOR),
      (h) => h.service.changeStatus('idea-1', { statusId: STATUS_2 }),
    ],
  ]

  it.each(cases)('%s', async (_label, caller, act) => {
    const h = harness({ currentUser: caller(), boards: [archivedBoard], ideas: [idea()] })

    await expect(act(h)).rejects.toThrow(ForbiddenError)
  })
})

// Tag filters -----------------------------------------------------------------------------

describe('IdeaService list tag filters', () => {
  const tags = [' Alpha ', 'alpha', 'BETA', '', '   ', 'beta']

  it('trims, lowercases, drops blanks and de-duplicates the organization list’s tags', async () => {
    const { service, orgFilters } = harness({ currentUser: member(ORG_A) })

    await service.listByOrganization(ORG_A, { ...ORG_LIST_QUERY, tags })

    expect(orgFilters[0]?.tags).toEqual(['alpha', 'beta'])
  })

  it('normalizes a board list’s tags the same way', async () => {
    const { service, boardFilters } = harness({ currentUser: member(ORG_A) })

    await service.listByBoard(BOARD_A, { ...LIST_QUERY, tags })

    expect(boardFilters[0]?.tags).toEqual(['alpha', 'beta'])
  })
})

// CSV import backfill and round trip ------------------------------------------------------

function row(rowNumber: number, cells: Record<string, string | null>): IdeaImportRow {
  return {
    rowNumber,
    cells: new Map(
      Object.entries({
        title: 'Imported idea',
        priority: 'Medium',
        'idea type': 'Improvement',
        'business impact': 'Medium',
        ...cells,
      }),
    ),
  }
}

describe('IdeaService CSV import of the structured fields', () => {
  it('backfills every structured field of a row without the new columns', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    const result = await service.importBoardIdeas(BOARD_A, [row(1, {})])

    expect(result.createdCount).toBe(1)
    expect(added[0]).toMatchObject({
      description: null,
      problem: NOT_CAPTURED_TEXT,
      proposedSolutions: [NOT_CAPTURED_TEXT],
      impactRationale: NOT_CAPTURED_TEXT,
    })
  })

  it('backfills Problem from the Description when the row has one', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    await service.importBoardIdeas(BOARD_A, [row(1, { description: 'The old free text.' })])

    expect(added[0]).toMatchObject({
      description: 'The old free text.',
      problem: 'The old free text.',
    })
  })

  it('treats blank structured cells like missing ones', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    await service.importBoardIdeas(BOARD_A, [
      row(1, { problem: '  ', 'proposed solutions': '', 'impact rationale': null }),
    ])

    expect(added[0]).toMatchObject({
      problem: NOT_CAPTURED_TEXT,
      proposedSolutions: [NOT_CAPTURED_TEXT],
      impactRationale: NOT_CAPTURED_TEXT,
    })
  })

  it('backfills only the first 2000 characters of a longer Description as Problem', async () => {
    const description = `${'a'.repeat(PROBLEM_MAX_LENGTH - 1)} ${'b'.repeat(500)}`
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    const result = await service.importBoardIdeas(BOARD_A, [row(1, { description })])

    expect(result.createdCount).toBe(1)
    // The cut lands on the space, which trimEnd drops.
    expect(added[0]?.problem).toBe('a'.repeat(PROBLEM_MAX_LENGTH - 1))
  })

  it('reads one solution per line of the cell', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    await service.importBoardIdeas(BOARD_A, [
      row(1, { 'proposed solutions': 'First.\r\nSecond.\n\nThird.' }),
    ])

    expect(added[0]?.proposedSolutions).toEqual(['First.', 'Second.', 'Third.'])
  })

  it('rejects only the row with six solutions, and creates the rest', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, AUTHOR) })

    const result = await service.importBoardIdeas(BOARD_A, [
      row(1, { 'proposed solutions': 'a\nb\nc\nd\ne\nf' }),
      row(2, { title: 'Fine', 'proposed solutions': 'a' }),
    ])

    expect(result).toMatchObject({ createdCount: 1, rejectedCount: 1 })
    expect(result.rows[0]).toMatchObject({ rowNumber: 1, outcome: 'Rejected' })
    expect(added.map((i) => i.title)).toEqual(['Fine'])
  })

  it('round-trips an exported idea’s structured fields through import', async () => {
    const original = idea({
      description: null,
      problem: 'Forms are slow.',
      proposedSolutions: ['Cut a form.', 'Prefill, from the directory.', 'Add SSO.'],
      impactRationale: 'Activation, "measured" weekly.',
    })
    const source = harness({ currentUser: orgAdmin(ORG_A), ideas: [original] })
    const exported = await source.service.exportBoardIdeas(BOARD_A)
    const [cells] = exported.rows
    if (!cells) throw new Error('expected one exported row')
    const imported: IdeaImportRow = {
      rowNumber: 1,
      cells: new Map(exported.headers.map((header, i) => [header.toLowerCase(), cells[i] ?? null])),
    }

    const target = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [board({ boardId: BOARD_B })],
    })
    const result = await target.service.importBoardIdeas(BOARD_B, [imported])

    expect(result.createdCount).toBe(1)
    expect(target.added[0]).toMatchObject({
      title: original.title,
      description: null,
      problem: original.problem,
      proposedSolutions: original.proposedSolutions,
      impactRationale: original.impactRationale,
    })
  })
})
