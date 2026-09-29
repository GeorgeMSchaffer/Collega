import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { defaultAiPromptSet } from '@collega/application/ai'
import { type Corpus, CorpusError, type EvalCase, loadCorpus } from '../src/corpus.ts'
import {
  caseContentSha256,
  fixtureContext,
  prepareFixture,
  schemaPriorities,
} from '../src/fixture-context.ts'
import { canonicalJson, nameDerivedId } from '../src/hashing.ts'
import { copyCorpus, PACKAGE_ROOT } from './helpers.ts'

const PRIORITIES = schemaPriorities()

type Json = Record<string, unknown>

/** A corpus copy with `file` rewritten by `edit`; returns its root. */
async function withEdit(file: string, edit: (json: Json) => Json | string): Promise<string> {
  const root = await copyCorpus()
  const full = path.join(root, file)
  const edited = edit(JSON.parse(await readFile(full, 'utf8')))
  await writeFile(full, typeof edited === 'string' ? edited : JSON.stringify(edited), 'utf8')
  return root
}

async function problemsOf(root: string): Promise<string[]> {
  try {
    await loadCorpus(root, PRIORITIES)
  } catch (error) {
    if (error instanceof CorpusError) return [...error.problems]
    throw error
  }
  assert.fail('the corpus loaded, but a problem was expected')
}

async function assertRefused(file: string, edit: (json: Json) => Json | string, expected: RegExp) {
  const problems = await problemsOf(await withEdit(file, edit))
  assert.ok(
    problems.some((p) => expected.test(p)),
    `expected a problem matching ${expected}, got:\n${problems.join('\n')}`,
  )
}

async function realCorpus(): Promise<Corpus> {
  return loadCorpus(PACKAGE_ROOT, PRIORITIES)
}

function byId(corpus: Corpus, id: string): EvalCase {
  const found = corpus.cases.find((c) => c.id === id)
  assert.ok(found, id)
  return found
}

// --- The corpus as committed -------------------------------------------------------------------

test('the committed corpus loads: sixteen cases over four fixtures, in file-name order', async () => {
  const corpus = await realCorpus()
  assert.equal(corpus.cases.length, 16)
  assert.deepEqual([...corpus.fixtures.keys()].sort(), [
    'acme',
    'acme-scoped',
    'acme-v2',
    'hostile-catalog',
  ])
  assert.equal(corpus.cases.filter((c) => c.assistant !== 'v2').length, 9)
  assert.equal(
    corpus.cases[0].id,
    'approval-threshold',
    'happy-approval-threshold.json sorts first',
  )
})

test('a case without "assistant" is v1, and the coffee cases are one pair', async () => {
  const corpus = await realCorpus()
  assert.equal(byId(corpus, 'approval-threshold').assistant, 'v1')
  assert.equal(byId(corpus, 'refuse-injection-limerick').assistant, 'both')
  assert.deepEqual(
    corpus.cases.filter((c) => c.pair === 'scope-coffee').map((c) => c.id),
    ['scope-coffee-narrowed', 'scope-coffee-unnarrowed'],
  )
})

// --- Refusals: every rule broken once ----------------------------------------------------------

const V1_CASE = 'cases/happy-approval-threshold.json'
const V2_CASE = 'cases/v2-custom-field.json'
const LOCKED_CASE = 'cases/v2-locked-problem.json'
const FIXTURE = 'fixtures/acme.json'
const V2_FIXTURE = 'fixtures/acme-v2.json'

test('a case with an unknown key is refused, so a misspelt key cannot go unscored', async () => {
  await assertRefused(V1_CASE, (c) => ({ ...c, expects: {} }), /unknown key "expects"/)
})

test('an unknown expectation key is refused', async () => {
  await assertRefused(
    V1_CASE,
    (c) => ({ ...c, expect: { ...(c.expect as Json), inscope: true } }),
    /unknown expectation "inscope"/,
  )
})

test('the "//" note key is accepted in a fixture but not in a case', async () => {
  await loadCorpus(await withEdit(FIXTURE, (f) => ({ ...f, '//': 'a note' })), PRIORITIES)
  await assertRefused(V1_CASE, (c) => ({ ...c, '//': 'a note' }), /unknown key "\/\/"/)
})

test('a fixture with an unknown key is refused', async () => {
  await assertRefused(
    FIXTURE,
    (f) => ({ ...f, scope: 'x' }),
    /fixtures\/acme.json: unknown key "scope"/,
  )
})

test('a case naming an unknown fixture is refused', async () => {
  await assertRefused(V1_CASE, (c) => ({ ...c, fixture: 'nowhere' }), /unknown fixture "nowhere"/)
})

test('an option name the fixture lacks is refused, for idea type, impact and priority', async () => {
  const expecting = (key: string, value: string) => (c: Json) => ({
    ...c,
    expect: { ...(c.expect as Json), [key]: value },
  })
  await assertRefused(
    V1_CASE,
    expecting('ideaType', 'Kaizen'),
    /expect.ideaType "Kaizen" is not an option/,
  )
  await assertRefused(
    V1_CASE,
    expecting('businessImpact', 'Huge'),
    /expect.businessImpact "Huge" is not an option/,
  )
  await assertRefused(V1_CASE, expecting('priority', 'Urgent'), /expect.priority "Urgent"/)
})

test('an option named in a case must be spelled as the fixture spells it', async () => {
  await assertRefused(
    V1_CASE,
    (c) => ({ ...c, expect: { ...(c.expect as Json), ideaType: 'process revision' } }),
    /is not an option/,
  )
})

test('two options with one name are refused, since they would share a derived id', async () => {
  await assertRefused(
    FIXTURE,
    (f) => ({ ...f, businessImpacts: [{ name: 'High' }, { name: 'High' }] }),
    /duplicate name "High"/,
  )
})

test('two fixtures with one name are refused', async () => {
  await assertRefused(
    'fixtures/acme-scoped.json',
    (f) => ({ ...f, name: 'acme' }),
    /fixture name "acme" is used by another fixture/,
  )
})

test('two cases with one id are refused', async () => {
  await assertRefused(
    'cases/happy-calibration-checklist.json',
    (c) => ({ ...c, id: 'approval-threshold' }),
    /case id "approval-threshold" is used by another case/,
  )
})

test('an "assistant" other than v1, v2 or both is refused', async () => {
  await assertRefused(V1_CASE, (c) => ({ ...c, assistant: 'v3' }), /"assistant" must be one of/)
})

test('a pair must name exactly two cases', async () => {
  await assertRefused(
    'cases/scope-coffee-narrowed.json',
    (c) => ({ ...c, pair: undefined }),
    /pair "scope-coffee" must name exactly two cases, found 1/,
  )
  await assertRefused(
    V1_CASE,
    (c) => ({ ...c, pair: 'scope-coffee' }),
    /pair "scope-coffee" must name exactly two cases, found 3/,
  )
})

test('a blank pair name is refused', async () => {
  await assertRefused(V1_CASE, (c) => ({ ...c, pair: ' ' }), /"pair" must be a non-blank string/)
})

test('an empty expect, empty turns or a blank turn is refused', async () => {
  await assertRefused(V1_CASE, (c) => ({ ...c, expect: {} }), /at least one expectation/)
  await assertRefused(V1_CASE, (c) => ({ ...c, turns: [] }), /"turns" must be a non-empty array/)
  await assertRefused(V1_CASE, (c) => ({ ...c, turns: ['ok', '  '] }), /non-blank strings/)
})

test('a file that is not JSON is refused with its name', async () => {
  await assertRefused(V1_CASE, () => '{ not json', /happy-approval-threshold.json: not valid JSON/)
})

test('every problem is collected before failing', async () => {
  const root = await withEdit(V1_CASE, (c) => ({ ...c, fixture: 'nowhere', extra: 1 }))
  const problems = await problemsOf(root)
  assert.ok(problems.some((p) => /unknown key "extra"/.test(p)))
  assert.ok(problems.some((p) => /unknown fixture "nowhere"/.test(p)))
})

// --- v2 keys ------------------------------------------------------------------------------------

test('a v2 expectation is refused on a v1 case and on a "both" case', async () => {
  await assertRefused(
    V1_CASE,
    (c) => ({ ...c, expect: { ...(c.expect as Json), problemSet: true } }),
    /expect.problemSet needs "assistant": "v2"/,
  )
  await assertRefused(
    'cases/refuse-injection-limerick.json',
    (c) => ({ ...c, expect: { ...(c.expect as Json), nextStep: 'problem' } }),
    /expect.nextStep needs "assistant": "v2"/,
  )
})

test('draft and lockedFields are refused on a case that is not v2', async () => {
  await assertRefused(
    V1_CASE,
    (c) => ({ ...c, draft: { title: 'x' } }),
    /"draft" needs "assistant": "v2"/,
  )
  await assertRefused(
    V1_CASE,
    (c) => ({ ...c, lockedFields: ['title'] }),
    /"lockedFields" needs "assistant": "v2"/,
  )
})

test('a v2 draft with an unknown key, an unknown option or too many solutions is refused', async () => {
  await assertRefused(
    LOCKED_CASE,
    (c) => ({ ...c, draft: { summary: 'x' } }),
    /draft has unknown key "summary"/,
  )
  await assertRefused(
    LOCKED_CASE,
    (c) => ({ ...c, draft: { ideaType: 'Kaizen' } }),
    /draft.ideaType must name an option/,
  )
  await assertRefused(
    LOCKED_CASE,
    (c) => ({ ...c, draft: { proposedSolutions: ['1', '2', '3', '4', '5', '6'] } }),
    /draft.proposedSolutions must hold 1 to 5 items/,
  )
  await assertRefused(
    LOCKED_CASE,
    (c) => ({ ...c, draft: { tags: ['not-a-tag'] } }),
    /draft.tags must name tags of the fixture/,
  )
})

test('a v2 draft field value must fit the field type', async () => {
  const draftValue = (name: string, value: unknown) => (c: Json) => ({
    ...c,
    draft: { fieldValues: { [name]: value } },
  })
  await assertRefused(
    LOCKED_CASE,
    draftValue('Estimated saving (hours per month)', 'twelve'),
    /draft.fieldValues.Estimated saving \(hours per month\) is not a valid value/,
  )
  await assertRefused(LOCKED_CASE, draftValue('Line', 'Painting'), /draft.fieldValues.Line/)
  await assertRefused(
    LOCKED_CASE,
    draftValue('No such field', 'x'),
    /draft.fieldValues.No such field/,
  )
  await loadCorpus(await withEdit(LOCKED_CASE, draftValue('Line', 'Packing')), PRIORITIES)
})

test('lockedFields must use the v2 contract names, a custom field by its name', async () => {
  await assertRefused(
    LOCKED_CASE,
    (c) => ({ ...c, lockedFields: ['ideaType'] }),
    /lockedFields names "ideaType", which is not a v2 draft field/,
  )
  await assertRefused(
    LOCKED_CASE,
    (c) => ({ ...c, lockedFields: ['fieldValues.Colour'] }),
    /lockedFields names "fieldValues.Colour"/,
  )
  await loadCorpus(
    await withEdit(LOCKED_CASE, (c) => ({
      ...c,
      lockedFields: ['ideaTypeId', 'fieldValues.Line'],
    })),
    PRIORITIES,
  )
})

test('nextStep must be a field the interview asks about, or done', async () => {
  const next = (value: unknown) => (c: Json) => ({
    ...c,
    expect: { ...(c.expect as Json), nextStep: value },
  })
  await assertRefused(V2_CASE, next('tagNames'), /expect.nextStep must be a field/)
  await assertRefused(V2_CASE, next('fieldValues.Colour'), /expect.nextStep must be a field/)
  await loadCorpus(await withEdit(V2_CASE, next('fieldValues.Line')), PRIORITIES)
  await loadCorpus(await withEdit(V2_CASE, next('done')), PRIORITIES)
})

test('suggestions must be bounded counts of known kinds', async () => {
  const suggest = (value: unknown) => (c: Json) => ({
    ...c,
    expect: { ...(c.expect as Json), suggestions: value },
  })
  await assertRefused(
    V2_CASE,
    suggest({ solutions: { max: 4 } }),
    /solutions.max must be a whole number from 0 to 3/,
  )
  await assertRefused(V2_CASE, suggest({ solutions: { min: 3, max: 1 } }), /min is above max/)
  await assertRefused(V2_CASE, suggest({ ideas: { min: 1 } }), /unknown key "ideas"/)
  await assertRefused(
    V2_CASE,
    suggest({ problemRewrite: 'yes' }),
    /problemRewrite must be a boolean/,
  )
  await assertRefused(V2_CASE, suggest({}), /at least one kind of suggestion/)
})

test('v2 field expectations must name fields and options of the fixture', async () => {
  const values = (value: unknown) => (c: Json) => ({
    ...c,
    expect: { ...(c.expect as Json), fieldValues: value },
  })
  await assertRefused(
    V2_CASE,
    values({ Colour: 'set' }),
    /"Colour" is not a field of fixture "acme-v2"/,
  )
  await assertRefused(
    V2_CASE,
    values({ Line: 'Painting' }),
    /fieldValues.Line must be "set" or one of/,
  )
  await assertRefused(
    V2_CASE,
    (c) => ({ ...c, expect: { ...(c.expect as Json), proposedSolutions: { min: 0 } } }),
    /proposedSolutions must be \{ "min": n \}/,
  )
  await assertRefused(
    V2_CASE,
    (c) => ({ ...c, expect: { ...(c.expect as Json), tags: ['not-a-tag'] } }),
    /"not-a-tag" is not a tag of fixture/,
  )
})

test('typed fixture fields are validated: dropdown options, attachments and required names', async () => {
  const withFields = (edit: (f: Json) => Json) => edit
  await assertRefused(
    V2_FIXTURE,
    withFields((f) => ({ ...f, fields: [{ name: 'Line', type: 'dropdown', options: [] }] })),
    /a dropdown needs a non-empty list of unique "options"/,
  )
  await assertRefused(
    V2_FIXTURE,
    withFields((f) => ({
      ...f,
      fields: [...(f.fields as Json[]), { name: 'Size', type: 'text', options: ['a'] }],
    })),
    /only a dropdown has "options"/,
  )
  await assertRefused(
    V2_FIXTURE,
    withFields((f) => ({ ...f, fields: [{ name: 'Line', type: 'colour' }] })),
    /"type" must be one of/,
  )
  await assertRefused(
    V2_FIXTURE,
    withFields((f) => ({
      ...f,
      ideaTypes: [
        {
          name: 'Continuous Improvement',
          fieldNames: ['Current state'],
          requiredFieldNames: ['Line'],
        },
        { name: 'Process Revision' },
      ],
    })),
    /requires "Line", not in its fieldNames/,
  )
  await assertRefused(
    V2_FIXTURE,
    withFields((f) => ({
      ...f,
      ideaTypes: [
        { name: 'Continuous Improvement', fieldNames: ['Colour'] },
        { name: 'Process Revision' },
      ],
    })),
    /names field "Colour", not in "fields"/,
  )
})

// --- Ids and hashes -----------------------------------------------------------------------------

test('a derived id is a deterministic, UUID-shaped name-based id', () => {
  const id = nameDerivedId('acme/ideaType/Continuous Improvement')
  assert.equal(id, nameDerivedId('acme/ideaType/Continuous Improvement'))
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.notEqual(id, nameDerivedId('acme-scoped/ideaType/Continuous Improvement'))
})

test('fixture ids, the organization id included, derive from fixture, kind and name', async () => {
  const acme = (await realCorpus()).fixtures.get('acme')
  assert.ok(acme)
  const context = fixtureContext(acme, defaultAiPromptSet())
  assert.equal(context.organizationId, nameDerivedId('acme/organization/acme'))
  assert.equal(context.ideaTypes[0].id, nameDerivedId('acme/ideaType/Continuous Improvement'))
  assert.equal(context.businessImpacts[0].id, nameDerivedId('acme/businessImpact/Critical'))
})

test('the rendered prompt and its hashes are identical across two loads', async () => {
  const [a, b] = [await realCorpus(), await loadCorpus(await copyCorpus(), PRIORITIES)]
  for (const [name, fixture] of a.fixtures) {
    const one = prepareFixture(fixture, defaultAiPromptSet())
    const other = prepareFixture(b.fixtures.get(name) as typeof fixture, defaultAiPromptSet())
    assert.equal(one.systemPrompt, other.systemPrompt, name)
    assert.equal(one.contentSha256, other.contentSha256, name)
    assert.equal(one.catalogSha256, other.catalogSha256, name)
  }
  for (const c of a.cases) assert.equal(caseContentSha256(c), caseContentSha256(byId(b, c.id)))
})

test('a case hash ignores note, pair and assistant', async () => {
  const c = byId(await realCorpus(), 'scope-coffee-narrowed')
  const hash = caseContentSha256(c)
  assert.equal(caseContentSha256({ ...c, note: 'edited' }), hash)
  assert.equal(caseContentSha256({ ...c, pair: null }), hash)
  assert.equal(caseContentSha256({ ...c, assistant: 'v1' }), hash)
})

test('a case hash moves with fixture, turns, expect, draft and lockedFields', async () => {
  const c = byId(await realCorpus(), 'approval-threshold')
  const hash = caseContentSha256(c)
  assert.notEqual(caseContentSha256({ ...c, fixture: 'acme-scoped' }), hash)
  assert.notEqual(caseContentSha256({ ...c, turns: [...c.turns, 'more'] }), hash)
  assert.notEqual(caseContentSha256({ ...c, expect: { ...c.expect, titleSet: false } }), hash)
  assert.notEqual(caseContentSha256({ ...c, draft: { title: 'x' } }), hash)
  assert.notEqual(caseContentSha256({ ...c, lockedFields: ['title'] }), hash)
})

test('a case hash does not depend on the order of keys in its file', async () => {
  const c = byId(await realCorpus(), 'approval-threshold')
  const reversed = Object.fromEntries(Object.entries(c.expect).reverse())
  assert.equal(caseContentSha256({ ...c, expect: reversed }), caseContentSha256(c))
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}')
})

test('a template change moves the fixture hash but not the catalog hash', async () => {
  const acme = (await realCorpus()).fixtures.get('acme')
  assert.ok(acme)
  const defaults = defaultAiPromptSet()
  const before = prepareFixture(acme, defaults)
  const after = prepareFixture(acme, {
    ...defaults,
    systemPromptTemplate: `${defaults.systemPromptTemplate}\nOne more sentence.`,
  })
  assert.notEqual(after.contentSha256, before.contentSha256)
  assert.equal(after.catalogSha256, before.catalogSha256)
})

test('a catalog change moves both fixture hashes', async () => {
  const corpus = await realCorpus()
  const defaults = defaultAiPromptSet()
  for (const [name, edit] of [
    ['acme', { scopeStatement: 'Only manufacturing.' }],
    ['acme', { tags: ['assembly'] }],
    ['acme-v2', { fields: [{ name: 'Line', type: 'dropdown', options: ['Assembly'] }] }],
  ] as const) {
    const fixture = corpus.fixtures.get(name)
    assert.ok(fixture)
    const before = prepareFixture(fixture, defaults)
    const after = prepareFixture({ ...fixture, ...edit }, defaults)
    assert.notEqual(after.catalogSha256, before.catalogSha256, `${name} ${Object.keys(edit)}`)
    assert.notEqual(after.contentSha256, before.contentSha256, `${name} ${Object.keys(edit)}`)
  }
})
