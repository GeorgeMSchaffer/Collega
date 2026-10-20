// The server half of the v2 turn (SPEC/contracts/ai-assist.md "v2 turn contract"). The model's
// output is untrusted: these tests pin what survives `finalizeTurnV2`, and how the caller's own
// request is normalised before it reaches the prompt.

import { FieldType, Priority } from '@collega/domain/enums'
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_TAGS,
  PROBLEM_MAX_LENGTH,
  PROPOSED_SOLUTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '@collega/domain/ideas'
import { describe, expect, it } from 'vitest'
import type {
  IdeaAssistContext,
  IdeaAssistFieldDefinition,
  IdeaAssistTurnInputV2,
} from '../../src/ai/models.js'
import { customFieldKey, TURN_V2_BOUNDS } from '../../src/ai/turn-schema-v2.js'
import {
  clampDraftV2,
  finalizeTurnV2,
  knownStepOrNull,
  prepareTurnInputV2,
} from '../../src/ai/turn-v2.js'

const TYPE_A = 'type-a'
const TYPE_B = 'type-b'
const IMPACT_A = 'impact-a'
const OPT_1 = 'opt-1'
const OPT_2 = 'opt-2'
const BUDGET = 'field-budget'
const REGION = 'field-region'
const CHANNELS = 'field-channels'
const ONLY_B = 'field-only-b'
const OPTIONS = [
  { id: OPT_1, label: 'EMEA' },
  { id: OPT_2, label: 'APAC' },
]

const budget: IdeaAssistFieldDefinition = {
  id: BUDGET,
  name: 'Budget',
  fieldType: FieldType.Number,
  isRequired: true,
  options: [],
}
const region: IdeaAssistFieldDefinition = {
  id: REGION,
  name: 'Region',
  fieldType: FieldType.Dropdown,
  isRequired: false,
  options: OPTIONS,
}
const channels: IdeaAssistFieldDefinition = {
  id: CHANNELS,
  name: 'Channels',
  fieldType: FieldType.MultiSelect,
  isRequired: false,
  options: OPTIONS,
}
const onlyB: IdeaAssistFieldDefinition = {
  id: ONLY_B,
  name: 'Only B',
  fieldType: FieldType.Text,
  isRequired: false,
  options: [],
}

const context: IdeaAssistContext = {
  organizationId: 'org',
  organizationName: 'Acme',
  scopeStatement: null,
  ideaTypes: [
    { id: TYPE_A, name: 'Feature' },
    { id: TYPE_B, name: 'Fix' },
  ],
  businessImpacts: [{ id: IMPACT_A, name: 'High' }],
  statuses: [],
  tags: ['Billing', 'mobile'],
  memberNames: [],
  prompts: {
    systemPromptTemplate: '',
    outOfScopeRedirect: '',
    conversationClosedRedirect: '',
    version: null,
  },
  fieldsByIdeaType: { [TYPE_A]: [budget, region, channels], [TYPE_B]: [onlyB] },
}

function input(overrides: Partial<IdeaAssistTurnInputV2> = {}): IdeaAssistTurnInputV2 {
  return {
    draft: { ideaTypeId: TYPE_A },
    lockedFields: [],
    step: null,
    customFields: [budget, region, channels],
    ...overrides,
  }
}

function finalize(
  changes: unknown,
  inputOverrides: Partial<IdeaAssistTurnInputV2> = {},
  extra: { suggestions?: unknown; nextStep?: string } = {},
) {
  return finalizeTurnV2(
    { changes, suggestions: extra.suggestions, nextStep: extra.nextStep ?? 'problem' },
    context,
    input(inputOverrides),
  )
}

describe('finalizeTurnV2 locked fields', () => {
  it.each([
    ['title', { title: 'T' }],
    ['problem', { problem: 'P' }],
    ['proposedSolutions', { proposedSolutions: ['S'] }],
    ['impactRationale', { impactRationale: 'R' }],
    ['businessImpactId', { businessImpactId: IMPACT_A }],
    ['ideaTypeId', { ideaTypeId: TYPE_B }],
    ['priority', { priority: Priority.High }],
    ['tagNames', { tagNames: ['Billing'] }],
    ['description', { description: 'D' }],
  ])('strips a locked %s from changes', (key, change) => {
    const { changes } = finalize(change, { lockedFields: [key] })

    expect(changes).toEqual({})
  })

  it('keeps an unlocked field set in the same response as a locked one', () => {
    const { changes } = finalize({ title: 'T', problem: 'P' }, { lockedFields: ['title'] })

    expect(changes).toEqual({ problem: 'P' })
  })

  it('strips a locked custom field but keeps its unlocked sibling', () => {
    const { changes } = finalize(
      {
        fieldValues: [
          { fieldDefinitionId: BUDGET, value: '5000' },
          { fieldDefinitionId: REGION, value: OPT_1 },
        ],
      },
      { lockedFields: [customFieldKey(BUDGET)] },
    )

    expect(changes.fieldValues).toEqual([{ fieldDefinitionId: REGION, value: OPT_1 }])
  })

  it('omits fieldValues entirely when every offered entry is locked', () => {
    const { changes } = finalize(
      { fieldValues: [{ fieldDefinitionId: BUDGET, value: '5000' }] },
      { lockedFields: [customFieldKey(BUDGET)] },
    )

    expect('fieldValues' in changes).toBe(false)
  })

  it('omits suggestions for a locked field and keeps the others', () => {
    const { suggestions } = finalize(
      {},
      { lockedFields: ['proposedSolutions', 'problem'] },
      {
        suggestions: {
          solutions: ['S'],
          problemRewrite: 'Rewrite',
          rationales: ['Because'],
        },
      },
    )

    expect(suggestions).toEqual({ rationales: ['Because'] })
  })

  it('drops suggestions altogether when every suggested field is locked', () => {
    const result = finalize(
      {},
      { lockedFields: ['proposedSolutions', 'problem', 'impactRationale'] },
      { suggestions: { solutions: ['S'], problemRewrite: 'R', rationales: ['X'] } },
    )

    expect('suggestions' in result).toBe(false)
  })
})

describe('finalizeTurnV2 value validation', () => {
  it('discards an id outside the retrieved set and keeps the rest of the response', () => {
    const { changes } = finalize({
      ideaTypeId: 'type-from-org-b',
      businessImpactId: 'impact-from-org-b',
      title: 'Kept',
    })

    expect(changes).toEqual({ title: 'Kept' })
  })

  it('keeps ids that are in the retrieved set', () => {
    const { changes } = finalize({ ideaTypeId: TYPE_B, businessImpactId: IMPACT_A })

    expect(changes).toEqual({ ideaTypeId: TYPE_B, businessImpactId: IMPACT_A })
  })

  it('discards a priority that is not a Priority member', () => {
    expect(finalize({ priority: 'Catastrophic' }).changes).toEqual({})
    expect(finalize({ priority: Priority.Critical }).changes).toEqual({ priority: 'Critical' })
  })

  it('matches tags case-insensitively, returns them as stored, drops unknown ones and duplicates', () => {
    const { changes } = finalize({ tagNames: ['billing', ' BILLING ', 'Mobile', 'unknown', 7] })

    expect(changes.tagNames).toEqual(['Billing', 'mobile'])
  })

  it('omits tagNames when no tag survives the vocabulary check', () => {
    expect('tagNames' in finalize({ tagNames: ['unknown'] }).changes).toBe(false)
  })

  it('caps tags at the domain maximum', () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag${i}`)
    const wide = { ...context, tags: many }

    const { changes } = finalizeTurnV2(
      { changes: { tagNames: many }, suggestions: undefined, nextStep: 'done' },
      wide,
      input(),
    )

    expect(changes.tagNames).toHaveLength(TURN_V2_BOUNDS.tagNames.max)
  })

  it('cuts proposedSolutions to the maximum and each entry to its length, dropping blanks', () => {
    const long = 'x'.repeat(PROPOSED_SOLUTION_MAX_LENGTH + 10)
    const { changes } = finalize({
      proposedSolutions: [long, '  ', 'b', 'c', 'd', 'e', 'f', 'g'],
    })

    expect(changes.proposedSolutions).toHaveLength(TURN_V2_BOUNDS.proposedSolutions.max)
    expect(changes.proposedSolutions?.[0]).toHaveLength(PROPOSED_SOLUTION_MAX_LENGTH)
    expect(changes.proposedSolutions).not.toContain('')
  })

  it('omits proposedSolutions when nothing but blanks was returned', () => {
    expect('proposedSolutions' in finalize({ proposedSolutions: ['', '   '] }).changes).toBe(false)
  })

  it('trims text and cuts it to the domain maxima without splitting a surrogate pair', () => {
    const { changes } = finalize({
      title: `  ${'t'.repeat(TITLE_MAX_LENGTH + 20)}  `,
      problem: `${'p'.repeat(PROBLEM_MAX_LENGTH - 1)}😀`,
      description: 'd'.repeat(DESCRIPTION_MAX_LENGTH + 1),
    })

    expect(changes.title).toHaveLength(TITLE_MAX_LENGTH)
    expect(changes.problem).toBe('p'.repeat(PROBLEM_MAX_LENGTH - 1))
    expect(changes.description).toHaveLength(DESCRIPTION_MAX_LENGTH)
  })

  it('omits a blank or non-string text field', () => {
    expect(finalize({ title: '   ', problem: 4, description: null }).changes).toEqual({})
  })

  it.each([null, undefined, 'text', 12, ['not', 'a', 'record']])(
    'reduces an unusable changes value (%j) to no changes',
    (junk) => {
      expect(finalize(junk).changes).toEqual({})
    },
  )

  it('ignores a key the contract does not know', () => {
    expect(finalize({ createdBy: 'attacker', title: 'T' }).changes).toEqual({ title: 'T' })
  })
})

describe('finalizeTurnV2 custom field values', () => {
  it.each([
    ['a Number', BUDGET, '12.5', true],
    ['a non-numeric Number', BUDGET, 'a lot', false],
    ['a Dropdown option', REGION, OPT_1, true],
    ['a Dropdown id outside its options', REGION, 'opt-9', false],
    ['a MultiSelect of known options', CHANNELS, `${OPT_1},${OPT_2}`, true],
    ['a MultiSelect with a duplicate', CHANNELS, `${OPT_1},${OPT_1}`, false],
    ['a MultiSelect with an unknown option', CHANNELS, `${OPT_1},opt-9`, false],
  ])('%s', (_label, fieldDefinitionId, value, kept) => {
    const { changes } = finalize({ fieldValues: [{ fieldDefinitionId, value }] })

    expect(changes.fieldValues).toEqual(kept ? [{ fieldDefinitionId, value }] : undefined)
  })

  it('discards a value for a field that is not offered for the draft’s type', () => {
    const { changes } = finalize({ fieldValues: [{ fieldDefinitionId: ONLY_B, value: 'x' }] })

    expect('fieldValues' in changes).toBe(false)
  })

  it('discards a Dropdown whose definition has no options, as it cannot express a value', () => {
    const empty = { ...region, options: [] }
    const { changes } = finalize(
      { fieldValues: [{ fieldDefinitionId: REGION, value: OPT_1 }] },
      { customFields: [empty] },
    )

    expect('fieldValues' in changes).toBe(false)
  })

  it('lets the last entry for a field win', () => {
    const { changes } = finalize({
      fieldValues: [
        { fieldDefinitionId: BUDGET, value: '1' },
        { fieldDefinitionId: BUDGET, value: '2' },
      ],
    })

    expect(changes.fieldValues).toEqual([{ fieldDefinitionId: BUDGET, value: '2' }])
  })

  it('skips malformed entries without losing the good ones', () => {
    const { changes } = finalize({
      fieldValues: [
        null,
        'x',
        { fieldDefinitionId: 3, value: '1' },
        { fieldDefinitionId: BUDGET },
        {
          fieldDefinitionId: REGION,
          value: OPT_2,
        },
      ],
    })

    expect(changes.fieldValues).toEqual([{ fieldDefinitionId: REGION, value: OPT_2 }])
  })
})

describe('finalizeTurnV2 suggestions', () => {
  it('caps solutions and rationales at their brainstorm bounds', () => {
    const { suggestions } = finalize(
      {},
      {},
      {
        suggestions: {
          solutions: ['a', 'b', 'c', 'd', 'e'],
          rationales: ['a', 'b', 'c', 'd', 'e'],
        },
      },
    )

    expect(suggestions?.solutions).toHaveLength(TURN_V2_BOUNDS.solutionSuggestions.max)
    expect(suggestions?.rationales).toHaveLength(TURN_V2_BOUNDS.rationaleSuggestions.max)
  })

  it('is absent when the model returned none, or something that is not an object', () => {
    for (const suggestions of [undefined, null, 'x', ['a'], {}, { solutions: [' '] }]) {
      expect('suggestions' in finalize({}, {}, { suggestions })).toBe(false)
    }
  })
})

describe('finalizeTurnV2 nextStep', () => {
  it('keeps a step in the vocabulary', () => {
    expect(finalize({}, {}, { nextStep: 'impactRationale' }).nextStep).toBe('impactRationale')
    expect(finalize({}, {}, { nextStep: 'done' }).nextStep).toBe('done')
  })

  it('accepts a required custom field as a step', () => {
    expect(finalize({}, {}, { nextStep: customFieldKey(BUDGET) }).nextStep).toBe(
      customFieldKey(BUDGET),
    )
  })

  it('falls back to the first empty interview step when the model names a locked field', () => {
    const result = finalize(
      {},
      { draft: { ideaTypeId: TYPE_A, problem: 'Known' }, lockedFields: ['proposedSolutions'] },
      { nextStep: 'proposedSolutions' },
    )

    expect(result.nextStep).toBe('impactRationale')
  })

  it('treats a field the response just filled as no longer empty', () => {
    const result = finalize(
      { problem: 'Now set' },
      { lockedFields: ['proposedSolutions'] },
      { nextStep: 'proposedSolutions' },
    )

    expect(result.nextStep).toBe('impactRationale')
  })

  it('falls back to an unanswered required custom field before title', () => {
    const result = finalize(
      {},
      {
        draft: {
          ideaTypeId: TYPE_A,
          problem: 'p',
          proposedSolutions: ['s'],
          impactRationale: 'r',
          businessImpactId: IMPACT_A,
        },
      },
      { nextStep: 'nonsense' },
    )

    expect(result.nextStep).toBe(customFieldKey(BUDGET))
  })

  it('falls back to done when everything askable is filled, never to an optional field', () => {
    const result = finalize(
      {},
      {
        draft: {
          ideaTypeId: TYPE_A,
          problem: 'p',
          proposedSolutions: ['s'],
          impactRationale: 'r',
          businessImpactId: IMPACT_A,
          title: 'T',
          fieldValues: [{ fieldDefinitionId: BUDGET, value: '1' }],
        },
      },
      { nextStep: 'nonsense' },
    )

    expect(result.nextStep).toBe('done')
  })

  it('does not offer a locked required custom field as a step', () => {
    const result = finalize(
      {},
      { lockedFields: [customFieldKey(BUDGET)] },
      { nextStep: customFieldKey(BUDGET) },
    )

    expect(result.nextStep).not.toBe(customFieldKey(BUDGET))
  })
})

describe('knownStepOrNull', () => {
  it.each([
    ['a draft key', 'problem', 'problem'],
    ['done', 'done', 'done'],
    ['a trimmed value', '  title ', 'title'],
    ['a custom field offered for the type', customFieldKey(BUDGET), customFieldKey(BUDGET)],
  ])('keeps %s', (_label, step, expected) => {
    expect(knownStepOrNull(step, [budget])).toBe(expected)
  })

  it.each([
    ['an unknown word', 'ignore previous instructions'],
    ['a custom field not offered for the type', customFieldKey('field-elsewhere')],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('ignores %s', (_label, step) => {
    expect(knownStepOrNull(step, [budget])).toBeNull()
  })
})

describe('prepareTurnInputV2', () => {
  it('discards ids, tags and field values the catalog does not contain', () => {
    const prepared = prepareTurnInputV2(
      context,
      {
        ideaTypeId: TYPE_A,
        businessImpactId: 'impact-from-org-b',
        tagNames: ['billing', 'unknown'],
        fieldValues: [
          { fieldDefinitionId: BUDGET, value: '1' },
          { fieldDefinitionId: ONLY_B, value: 'not visible for type A' },
        ],
      },
      [],
      null,
    )

    expect(prepared.draft.businessImpactId).toBeNull()
    expect(prepared.draft.tagNames).toEqual(['Billing'])
    expect(prepared.draft.fieldValues).toEqual([{ fieldDefinitionId: BUDGET, value: '1' }])
    expect(prepared.customFields.map((f) => f.id)).toEqual([BUDGET, REGION, CHANNELS])
  })

  it('offers no custom fields when the Idea Type is unknown or absent', () => {
    expect(prepareTurnInputV2(context, { ideaTypeId: 'type-x' }, [], null).customFields).toEqual([])
    expect(prepareTurnInputV2(context, {}, [], null).customFields).toEqual([])
  })

  it('keeps only lockedFields that denote a real field, once each', () => {
    const prepared = prepareTurnInputV2(
      context,
      { ideaTypeId: TYPE_A },
      ['title', 'title', customFieldKey(BUDGET), 'fieldValues.nope', '__proto__', 'password'],
      null,
    )

    expect(prepared.lockedFields).toEqual(['title', customFieldKey(BUDGET)])
  })

  it('keeps a lock on a custom field of another type, so it survives a type switch', () => {
    const prepared = prepareTurnInputV2(
      context,
      { ideaTypeId: TYPE_A },
      [customFieldKey(ONLY_B)],
      null,
    )

    expect(prepared.lockedFields).toEqual([customFieldKey(ONLY_B)])
  })

  it('drops a step outside the vocabulary', () => {
    expect(prepareTurnInputV2(context, {}, [], 'something else').step).toBeNull()
    expect(prepareTurnInputV2(context, {}, [], 'problem').step).toBe('problem')
  })
})

describe('clampDraftV2', () => {
  it('cuts text to the domain maxima and nulls blanks', () => {
    const clamped = clampDraftV2({
      title: 'T'.repeat(TITLE_MAX_LENGTH + 5),
      problem: '   ',
    })

    expect(clamped.title).toHaveLength(TITLE_MAX_LENGTH)
    expect(clamped.problem).toBeNull()
    expect(clamped.description).toBeNull()
  })

  it('bounds the lists and drops an invalid priority', () => {
    const clamped = clampDraftV2({
      proposedSolutions: Array.from({ length: 12 }, (_, i) => `s${i}`),
      tagNames: Array.from({ length: 30 }, (_, i) => `t${i}`),
      priority: 'Catastrophic' as Priority,
    })

    expect(clamped.proposedSolutions).toHaveLength(TURN_V2_BOUNDS.proposedSolutions.max)
    expect(clamped.tagNames).toHaveLength(MAX_TAGS)
    expect(clamped.priority).toBeNull()
  })

  it('drops over-long custom field values and caps the entry count', () => {
    const clamped = clampDraftV2({
      fieldValues: [
        { fieldDefinitionId: 'a', value: 'x'.repeat(2049) },
        ...Array.from({ length: 150 }, (_, i) => ({ fieldDefinitionId: `f${i}`, value: '1' })),
      ],
    })

    expect(clamped.fieldValues).toHaveLength(100)
    expect(clamped.fieldValues?.some((v) => v.fieldDefinitionId === 'a')).toBe(false)
  })

  it('turns an empty draft into an all-null one', () => {
    expect(clampDraftV2({})).toMatchObject({
      title: null,
      proposedSolutions: null,
      tagNames: null,
      fieldValues: null,
    })
  })
})
