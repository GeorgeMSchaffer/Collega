// F1 is the go/no-go gate, and `src/accepted.ts` is what decides whether a replay diff counts
// against it. The design claim is that an entry asserts what a difference is ALLOWED to look like
// rather than muting a path, so every test here is an attempt to make an entry excuse something
// nobody agreed to: a value the corpus never recorded, a case the entry does not name, a real
// regression riding along with a recorded one, or — the finding that produced `mask` — the ~3100
// characters of a CSV export that a header-anchored `shape` left unchecked on both sides.
//
// The export and portrait mutations are built from the committed fixtures rather than invented,
// because the point is to pin what the corpus actually holds.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { buildReport, compare, formatReport } from '../replay/replay.ts'
import { ACCEPTED_DIFFS, type AcceptedDiff, classify, staleEntries } from '../src/accepted.ts'
import type { Fixture } from '../src/corpus.ts'
import type { Exchange } from '../src/runner.ts'

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')

function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8')) as Fixture
}

/** The recorded response, re-offered as a fresh one, so a test only has to state what moved. */
function exchange(f: Fixture, body: unknown = f.response.body): Exchange {
  return {
    scenario: f.scenario,
    step: f.step,
    endpoint: f.endpoint,
    as: f.as,
    kind: f.kind,
    unstable: f.unstable,
    request: f.request,
    response: { ...f.response, body },
  }
}

const EXPORT = fixture('ideas.export.orgadmin')
const CSV = EXPORT.normalized.body as string
const PORTRAIT = fixture('profile.portrait.set.orgadmin')
const RECORDED_PORTRAIT = (PORTRAIT.normalized.body as Record<string, unknown>).portraitDataUrl
/** A different PNG of the same shape — what a re-encode legitimately produces. */
const REENCODED_PORTRAIT = `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEU'.repeat(3)}=`

/** Every accepted (entry, case) pair on the list: three entries over nine cases. */
const ALL_PAIRS = ACCEPTED_DIFFS.reduce((n, entry) => n + entry.cases.length, 0)

test('the expected side is checked too, so an entry cannot excuse a value never recorded', () => {
  const excused = classify(
    'profile.portrait.set.orgadmin',
    [{ path: 'body.portraitDataUrl', expected: RECORDED_PORTRAIT, actual: REENCODED_PORTRAIT }],
    ACCEPTED_DIFFS,
  )
  assert.equal(excused.accepted, true, 'a re-encoded portrait is the difference that was accepted')

  const drifted = classify(
    'profile.portrait.set.orgadmin',
    [{ path: 'body.portraitDataUrl', expected: null, actual: REENCODED_PORTRAIT }],
    ACCEPTED_DIFFS,
  )
  assert.equal(drifted.accepted, false, 'the corpus never recorded a null portrait here')
  assert.deepEqual(drifted.used, [])
})

test('a shape rejects absence, emptiness and anything that is not a string', () => {
  for (const actual of [null, undefined, '', 42, {}, ['data:image/png;base64,AAAA']]) {
    const verdict = classify(
      'profile.portrait.set.orgadmin',
      [{ path: 'body.portraitDataUrl', expected: RECORDED_PORTRAIT, actual }],
      ACCEPTED_DIFFS,
    )
    assert.equal(
      verdict.accepted,
      false,
      `a portrait that became ${JSON.stringify(actual) ?? 'undefined'} was waved through`,
    )
  }
})

test('an entry does not excuse its path on a case it does not name', () => {
  // `case: '*'` used to. `auth.me.orgadmin` returns a portrait on the same path, so a variant
  // fixture with one would have arrived pre-authorized — including a different user's.
  const verdict = classify(
    'auth.me.orgadmin',
    [{ path: 'body.portraitDataUrl', expected: RECORDED_PORTRAIT, actual: REENCODED_PORTRAIT }],
    ACCEPTED_DIFFS,
  )
  assert.equal(verdict.accepted, false)
})

test('a recorded difference plus a real regression in one response is a failing case', () => {
  const verdict = classify(
    'profile.portrait.set.orgadmin',
    [
      { path: 'body.portraitDataUrl', expected: RECORDED_PORTRAIT, actual: REENCODED_PORTRAIT },
      { path: 'body.role', expected: 'OrgAdmin', actual: 'SiteAdmin' },
    ],
    ACCEPTED_DIFFS,
  )
  assert.equal(verdict.accepted, false, 'a privilege change rode in on an accepted portrait')
  assert.deepEqual(verdict.used, [], 'a rejected case must not report its half-excuses as used')
})

test('the export accepts a due date that moved with the seed day', () => {
  // The whole reason the entry exists: the seed sets due dates relative to the day it runs, and
  // the capture was 2026-09-04.
  const shifted = CSV.replace(/2026-09-(\d\d)/g, (_, day) => `2027-01-${day}`)
  assert.notEqual(shifted, CSV, 'the recorded export carries the dates this entry is about')
  const verdict = classify(
    'ideas.export.orgadmin',
    [{ path: 'body', expected: CSV, actual: shifted }],
    ACCEPTED_DIFFS,
  )
  assert.equal(verdict.accepted, true)
  assert.deepEqual(verdict.used, [
    { entry: ACCEPTED_DIFFS.find((e) => e.path === 'body'), case: 'ideas.export.orgadmin' },
  ])
})

test('everything in the export but the dates is still compared byte for byte', () => {
  // The review finding: a `shape` anchored to the header row left ~3100 characters unchecked on
  // both sides. These four fixtures are the only coverage of that endpoint, org scoping included.
  const rows = CSV.split('\r\n')
  const mutations: [string, string][] = [
    ['truncated to the first two rows', `${rows.slice(0, 2).join('\r\n')}\r\n`],
    ['half the ideas dropped', `${rows.slice(0, Math.floor(rows.length / 2)).join('\r\n')}\r\n`],
    [
      'a row appended from another organization',
      `${CSV}Leaked idea,Belongs to Northwind,High,Process Revision,High,New / Pending,,\r\n`,
    ],
    ['a priority flipped', CSV.replace(',Low,', ',High,')],
    ['a description column blanked', CSV.replace(/,Map the current handoffs[^,]*,/, ',,')],
    ['trailing junk', `${CSV}x`],
    // The recorded body carries no BOM — the capture decoded it away, which is why the entry's
    // reason says so rather than leaving an optional one in the shape.
    ['a BOM prepended', `\uFEFF${CSV}`],
  ]

  for (const [what, actual] of mutations) {
    assert.notEqual(actual, CSV, `"${what}" changed nothing, so it proves nothing`)
    const verdict = classify(
      'ideas.export.orgadmin',
      [{ path: 'body', expected: CSV, actual }],
      ACCEPTED_DIFFS,
    )
    assert.equal(verdict.accepted, false, `an export with ${what} was accepted`)
  }
})

test('a due date that vanished is not the same as one that moved', () => {
  // Why the mask replaces with a literal rather than the empty string: masking to nothing makes a
  // value with the varying part deleted equal to one that still has it.
  const blanked = CSV.replace(/\d{4}-\d{2}-\d{2}/g, '')
  const verdict = classify(
    'ideas.export.orgadmin',
    [{ path: 'body', expected: CSV, actual: blanked }],
    ACCEPTED_DIFFS,
  )
  assert.equal(verdict.accepted, false, 'an export that stopped emitting due dates was accepted')
})

test('a g-flagged shape gives the same answer on both sides', () => {
  // `satisfies` runs twice per mismatch and `RegExp.test` carries lastIndex, so a g-flagged shape
  // would pass on the expected side and fail on the actual. No entry carries the flag today.
  const list: AcceptedDiff[] = [
    {
      cases: ['export.body'],
      path: 'body.code',
      decided: '2026-09-09',
      reason: 'stand-in for whoever writes the first g-flagged shape.',
      shape: /^[A-Z]{4}$/g,
    },
  ]
  const mismatches = [{ path: 'body.code', expected: 'ABCD', actual: 'WXYZ' }]
  assert.equal(classify('export.body', mismatches, list).accepted, true)
  assert.equal(
    classify('export.body', mismatches, list).accepted,
    true,
    'lastIndex leaked between the two sides',
  )
})

test('no entry names a header or the status, so the oracle still holds around one', () => {
  for (const entry of ACCEPTED_DIFFS) {
    assert.ok(
      !entry.path.startsWith('headers.') && entry.path !== 'status',
      `${entry.path} would let an entry excuse transport or an authorization outcome`,
    )
  }
})

test('a header change riding on an accepted body difference fails the case', () => {
  const shifted = CSV.replace(/2026-09-(\d\d)/g, (_, day) => `2027-01-${day}`)
  const result = compare(EXPORT, {
    status: EXPORT.normalized.status,
    headers: { ...EXPORT.normalized.headers, 'content-type': 'application/octet-stream' },
    body: shifted,
  })
  assert.equal(result.status, 'body')
  assert.ok(
    result.mismatches.some((m) => m.path === 'headers.content-type'),
    'compare must fold the header mismatch into the body result, or nothing can see it',
  )
  assert.equal(
    classify('ideas.export.orgadmin', result.mismatches, ACCEPTED_DIFFS).accepted,
    false,
    'an export that stopped being text/csv was accepted',
  )
})

test('a status mismatch is reported alone, before any body the list could excuse', () => {
  const result = compare(EXPORT, {
    status: 500,
    headers: EXPORT.normalized.headers,
    body: CSV,
  })
  assert.equal(result.status, 'status')
  assert.deepEqual(
    result.mismatches.map((m) => m.path),
    ['status'],
  )
  assert.equal(classify('ideas.export.orgadmin', result.mismatches, ACCEPTED_DIFFS).accepted, false)
})

test('staleness is reported per (entry, case) pair, not per entry', () => {
  assert.equal(staleEntries([], ACCEPTED_DIFFS).length, ALL_PAIRS)

  const shifted = CSV.replace(/2026-09-(\d\d)/g, (_, day) => `2027-01-${day}`)
  const used = classify(
    'ideas.export.orgadmin',
    [{ path: 'body', expected: CSV, actual: shifted }],
    ACCEPTED_DIFFS,
  ).used
  const stale = staleEntries(used, ACCEPTED_DIFFS)
  assert.equal(stale.length, ALL_PAIRS - 1, 'an entry with one live case still has three stale')
  assert.equal(
    stale.some((pair) => pair.case === 'ideas.export.orgadmin'),
    false,
  )
  assert.ok(stale.some((pair) => pair.case === 'ideas.export.user' && pair.entry.path === 'body'))
})

test('classify and staleEntries must be handed the same list, since entry identity is the link', () => {
  const injected: AcceptedDiff[] = [
    {
      cases: ['boards.list'],
      path: 'body.version',
      decided: '2026-09-09',
      reason: 'a caller that supplies its own list is the one most likely to trip over this.',
      shape: /^v\d$/,
    },
  ]
  const used = classify(
    'boards.list',
    [{ path: 'body.version', expected: 'v1', actual: 'v2' }],
    injected,
  ).used
  assert.equal(used.length, 1)
  assert.deepEqual(staleEntries(used, injected), [])

  const clone: AcceptedDiff[] = [{ ...injected[0] }]
  assert.equal(
    staleEntries(used, clone).length,
    1,
    'a structurally equal entry is a different entry, which is why both take the list',
  )
})

test('a step that never ran stays a failure, even where its case is on the list', () => {
  const report = buildReport([EXPORT, fixture('auth.login.orgadmin')], [])
  assert.equal(report.total, 2)
  assert.equal(report.accepted, 0)
  assert.equal(report.matched, 0)
  assert.deepEqual(
    report.results.map((r) => r.status),
    ['absent', 'absent'],
  )
  assert.equal(report.stale.length, ALL_PAIRS, 'nothing was excused, so every pair is stale')
})

test('accepted cases accumulate across the run, and each takes its pair off the stale list', () => {
  const shift = (csv: string) => csv.replace(/2026-09-(\d\d)/g, (_, day) => `2027-01-${day}`)
  const user = fixture('ideas.export.user')
  const login = fixture('auth.login.orgadmin')
  const withoutToken = { ...(login.response.body as Record<string, unknown>) }
  delete withoutToken.accessToken

  const report = buildReport(
    [EXPORT, user, login],
    [
      exchange(EXPORT, shift(EXPORT.response.body as string)),
      exchange(user, shift(user.response.body as string)),
      exchange(login, withoutToken),
    ],
  )
  assert.equal(report.accepted, 3, JSON.stringify(report.results, null, 2))
  assert.equal(report.matched, 0)
  assert.equal(report.stale.length, ALL_PAIRS - 3)
})

test('total minus matched minus accepted is the number the gate reads', () => {
  const readonly = fixture('ideas.export.readonly')
  const user = fixture('ideas.export.user')
  const report = buildReport(
    [readonly, EXPORT, user],
    [
      exchange(readonly),
      exchange(EXPORT, (EXPORT.response.body as string).replace('2026-09-12', '2027-01-12')),
      exchange(user, (user.response.body as string).slice(0, 200)),
    ],
  )
  assert.equal(report.total, 3)
  assert.equal(report.matched, 1)
  assert.equal(report.accepted, 1)
  assert.equal(report.total - report.matched - report.accepted, 1)
  assert.equal(report.results.find((r) => r.step === 'export.user')?.status, 'body')
})

test('the report says how many matched, how many were accepted and how many are unexplained', () => {
  const readonly = fixture('ideas.export.readonly')
  const user = fixture('ideas.export.user')
  const text = formatReport(
    buildReport(
      [readonly, EXPORT, user],
      [
        exchange(readonly),
        exchange(EXPORT, (EXPORT.response.body as string).replace('2026-09-12', '2027-01-12')),
        exchange(user, (user.response.body as string).slice(0, 200)),
      ],
    ),
  )
  assert.match(text, /1\/3 cases match/)
  assert.match(text, /1 accepted \(src\/accepted\.ts\)/)
  assert.match(text, /1 unexplained/)
  assert.match(text, /ideas\.export\.user/, 'the failing case is named')
  assert.match(text, /did not occur against this target/, 'staleness is reported either way')
})

test('a clean run says so without mentioning acceptance at all', () => {
  const readonly = fixture('ideas.export.readonly')
  const text = formatReport(buildReport([readonly], [exchange(readonly)]))
  assert.match(text, /replay: 1\/1 cases match/)
  assert.equal(text.includes('accepted ('), false, '"363 matched and 4 accepted" is the honest one')
})
