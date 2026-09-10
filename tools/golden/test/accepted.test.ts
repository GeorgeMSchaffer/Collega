// F1 is the go/no-go gate, and `src/accepted.ts` is what decides whether a replay diff counts
// against it. The design claim is that an entry asserts what a difference is ALLOWED to look like
// rather than muting a path, so every test here is an attempt to make an entry excuse something
// nobody agreed to: a value the corpus never recorded, a case the entry does not name, a mismatch
// of a kind the entry did not accept, a real regression riding along with a recorded one, or — the
// finding that produced `mask` — the ~3100 characters of a CSV export that a header-anchored
// `shape` left unchecked on both sides.
//
// The mismatches are produced by `diff` over two bodies rather than written by hand, and the bodies
// come from the committed fixtures wherever one exists. `diff` is the only thing that feeds
// `classify` in a real run, so that pins the producer and the consumer together instead of pinning
// a mismatch shape the harness would never actually emit.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { buildReport, compare, formatReport } from '../replay/replay.ts'
import { ACCEPTED_DIFFS, type AcceptedDiff, classify, staleEntries } from '../src/accepted.ts'
import type { Fixture } from '../src/corpus.ts'
import { diff, type Mismatch } from '../src/diff.ts'
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
const RECORDED_PORTRAIT = PORTRAIT.normalized.body as Record<string, unknown>
/** A different PNG of the same shape — what a re-encode legitimately produces. */
const REENCODED_PORTRAIT = `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEU'.repeat(3)}=`
const LOGIN = fixture('auth.login.orgadmin')
const RECORDED_LOGIN = LOGIN.normalized.body as Record<string, unknown>
/** A bare-array body: the two boards the org admin's list step recorded. */
const RECORDED_BOARDS = fixture('boards.list.orgadmin').normalized.body as BoardItem[]
/** The same endpoint as a setup step, where three boards exist — the reason the entry says `[]`. */
const RECORDED_THREE_BOARDS = fixture('ideas.board').normalized.body as BoardItem[]

type BoardItem = Record<string, unknown>

/** The projection the client now reads instead of one paged ideas request per board. */
const withIdeaCount = (boards: readonly BoardItem[]): BoardItem[] =>
  boards.map((board, i) => ({ ...board, ideaCount: 7 + i }))

const IDEA_COUNT: AcceptedDiff =
  ACCEPTED_DIFFS.find((entry) => entry.path === 'body[].ideaCount') ??
  assert.fail('the board list entry is gone, so the tests below assert nothing')

/** The seed sets due dates relative to the day it runs, which is the whole reason that entry exists. */
const shift = (csv: string) => csv.replace(/2026-09-(\d\d)/g, (_, day) => `2027-01-${day}`)

/** Every accepted (entry, case) pair on the list: four entries over sixteen cases. */
const ALL_PAIRS = ACCEPTED_DIFFS.reduce((n, entry) => n + entry.cases.length, 0)

test('the expected side is checked too, so an entry cannot excuse a value never recorded', () => {
  const reencoded = diff(RECORDED_PORTRAIT, {
    ...RECORDED_PORTRAIT,
    portraitDataUrl: REENCODED_PORTRAIT,
  })
  assert.deepEqual(
    reencoded.map((m) => [m.path, m.kind]),
    [['body.portraitDataUrl', 'value']],
  )
  assert.equal(
    classify('profile.portrait.set.orgadmin', reencoded, ACCEPTED_DIFFS).accepted,
    true,
    'a re-encoded portrait is the difference that was accepted',
  )

  const drifted = classify(
    'profile.portrait.set.orgadmin',
    diff(
      { ...RECORDED_PORTRAIT, portraitDataUrl: null },
      { ...RECORDED_PORTRAIT, portraitDataUrl: REENCODED_PORTRAIT },
    ),
    ACCEPTED_DIFFS,
  )
  assert.equal(drifted.accepted, false, 'the corpus never recorded a null portrait here')
  assert.deepEqual(drifted.used, [])
})

test('a shape rejects absence, emptiness and anything that is not a string', () => {
  const dropped = { ...RECORDED_PORTRAIT }
  delete dropped.portraitDataUrl
  const variants = [
    { ...RECORDED_PORTRAIT, portraitDataUrl: null },
    { ...RECORDED_PORTRAIT, portraitDataUrl: '' },
    { ...RECORDED_PORTRAIT, portraitDataUrl: 42 },
    { ...RECORDED_PORTRAIT, portraitDataUrl: {} },
    { ...RECORDED_PORTRAIT, portraitDataUrl: ['data:image/png;base64,AAAA'] },
    dropped,
  ]

  for (const variant of variants) {
    const mismatches = diff(RECORDED_PORTRAIT, variant)
    const became = JSON.stringify(variant.portraitDataUrl) ?? 'absent'
    assert.deepEqual(
      mismatches.map((m) => m.path),
      ['body.portraitDataUrl'],
      `a portrait that became ${became} moved something else too`,
    )
    assert.equal(
      classify('profile.portrait.set.orgadmin', mismatches, ACCEPTED_DIFFS).accepted,
      false,
      `a portrait that became ${became} was waved through`,
    )
  }
})

test('an entry does not excuse its path on a case it does not name', () => {
  // `case: '*'` used to. `auth.me.orgadmin` returns a portrait on the same path, so a variant
  // fixture with one would have arrived pre-authorized — including a different user's.
  const verdict = classify(
    'auth.me.orgadmin',
    diff(RECORDED_PORTRAIT, { ...RECORDED_PORTRAIT, portraitDataUrl: REENCODED_PORTRAIT }),
    ACCEPTED_DIFFS,
  )
  assert.equal(verdict.accepted, false)
})

test('a recorded difference plus a real regression in one response is a failing case', () => {
  const mismatches = diff(RECORDED_PORTRAIT, {
    ...RECORDED_PORTRAIT,
    portraitDataUrl: REENCODED_PORTRAIT,
    role: 'SiteAdmin',
  })
  assert.equal(mismatches.length, 2)
  const verdict = classify('profile.portrait.set.orgadmin', mismatches, ACCEPTED_DIFFS)
  assert.equal(verdict.accepted, false, 'a privilege change rode in on an accepted portrait')
  assert.deepEqual(verdict.used, [], 'a rejected case must not report its half-excuses as used')
})

test('the export accepts a due date that moved with the seed day', () => {
  const shifted = shift(CSV)
  assert.notEqual(shifted, CSV, 'the recorded export carries the dates this entry is about')
  const verdict = classify('ideas.export.orgadmin', diff(CSV, shifted), ACCEPTED_DIFFS)
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
    const verdict = classify('ideas.export.orgadmin', diff(CSV, actual), ACCEPTED_DIFFS)
    assert.equal(verdict.accepted, false, `an export with ${what} was accepted`)
  }
})

test('a due date that vanished is not the same as one that moved', () => {
  // Why the mask replaces with a literal rather than the empty string: masking to nothing makes a
  // value with the varying part deleted equal to one that still has it.
  const blanked = CSV.replace(/\d{4}-\d{2}-\d{2}/g, '')
  const verdict = classify('ideas.export.orgadmin', diff(CSV, blanked), ACCEPTED_DIFFS)
  assert.equal(verdict.accepted, false, 'an export that stopped emitting due dates was accepted')
})

test('the login token being gone is the difference decision 08 made, and it is accepted', () => {
  const withoutToken = { ...RECORDED_LOGIN }
  delete withoutToken.accessToken
  const mismatches = diff(RECORDED_LOGIN, withoutToken)
  assert.deepEqual(
    mismatches.map((m) => [m.path, m.kind, m.expected, m.actual]),
    [['body.accessToken', 'missing', '<redacted>', undefined]],
    'the recorded body carries a redacted token, so absence is what the target must answer with',
  )
  assert.equal(classify('auth.login.orgadmin', mismatches, ACCEPTED_DIFFS).accepted, true)
})

test('a login that answers null on the token path is not the absence that was accepted', () => {
  // The entry excuses the field being gone. A body that still carries the key, holding null or
  // false or an object, is a contract `SPEC/30-Contracts.md` does not describe and decision 08 did
  // not make — and with no `shape` to reject it, `kind` is the only thing standing in its way.
  for (const value of [null, false, {}, '']) {
    const mismatches = diff(RECORDED_LOGIN, { ...RECORDED_LOGIN, accessToken: value })
    assert.equal(
      classify('auth.login.orgadmin', mismatches, ACCEPTED_DIFFS).accepted,
      false,
      `a login answering ${JSON.stringify(value)} on body.accessToken was waved through`,
    )
  }
})

test('the board list accepts an ideaCount on every element, at whatever length the case ran', () => {
  const mismatches = diff(RECORDED_BOARDS, withIdeaCount(RECORDED_BOARDS))
  assert.deepEqual(
    mismatches.map((m) => [m.path, m.kind]),
    [
      ['body[0].ideaCount', 'extra'],
      ['body[1].ideaCount', 'extra'],
    ],
  )
  const verdict = classify('boards.list.orgadmin', mismatches, ACCEPTED_DIFFS)
  assert.equal(verdict.accepted, true)
  assert.deepEqual(verdict.used, [
    { entry: IDEA_COUNT, case: 'boards.list.orgadmin' },
    { entry: IDEA_COUNT, case: 'boards.list.orgadmin' },
  ])

  // The three-element case is what `[]` is for: an entry written per index would cover the four
  // role cases and quietly fail the three setup steps, which list a board they just created.
  assert.equal(RECORDED_THREE_BOARDS.length, 3)
  const setup = diff(RECORDED_THREE_BOARDS, withIdeaCount(RECORDED_THREE_BOARDS))
  assert.equal(classify('ideas.board', setup, ACCEPTED_DIFFS).accepted, true)
})

test('a swimlaneCount that moved is not excused by the ideaCount arriving beside it', () => {
  const drifted = withIdeaCount(RECORDED_BOARDS)
  drifted[1] = { ...drifted[1], swimlaneCount: 4 }
  const verdict = classify('boards.list.orgadmin', diff(RECORDED_BOARDS, drifted), ACCEPTED_DIFFS)
  assert.equal(verdict.accepted, false, 'a board that lost a swimlane rode in on the new count')
  assert.deepEqual(verdict.used, [])
})

test('a list that gained or lost a board still fails, so `[]` is not a mute on the array', () => {
  // The length mismatch is the one that stops an entry over array elements from becoming an entry
  // over the array: an organization whose second board vanished is a regression, not a projection.
  const gained = withIdeaCount([...RECORDED_BOARDS, { ...RECORDED_BOARDS[0], name: 'Extra' }])
  const lost = withIdeaCount(RECORDED_BOARDS.slice(0, 1))
  for (const [what, actual] of [
    ['gained a board', gained],
    ['lost a board', lost],
  ] as const) {
    const mismatches = diff(RECORDED_BOARDS, actual)
    assert.ok(
      mismatches.some((m) => m.kind === 'length'),
      `a list that ${what} produced no length mismatch, so this proves nothing`,
    )
    assert.equal(
      classify('boards.list.orgadmin', mismatches, ACCEPTED_DIFFS).accepted,
      false,
      `a list that ${what} was accepted`,
    )
  }
})

test('an ideaCount that vanished is not the appearance that was accepted', () => {
  // The reverse direction. Once the corpus is re-recorded the count is on both sides, and an
  // endpoint that then stopped projecting it reports `missing` on the same path — which the entry
  // must not excuse, or the field can be added and removed again without the gate noticing.
  const recorded = withIdeaCount(RECORDED_BOARDS)
  const mismatches = diff(recorded, RECORDED_BOARDS)
  assert.deepEqual(
    mismatches.map((m) => [m.path, m.kind]),
    [
      ['body[0].ideaCount', 'missing'],
      ['body[1].ideaCount', 'missing'],
    ],
  )
  assert.equal(classify('boards.list.orgadmin', mismatches, ACCEPTED_DIFFS).accepted, false)
})

test('`[]` stands for an array index, not for any segment', () => {
  // `body[].ideaCount` must not reach `body.total.ideaCount`. Nothing on this endpoint answers an
  // envelope today, but every other list does (`WirePage`), so a board list that grew paging would
  // arrive with its count pre-authorized on a path nobody wrote down.
  const mismatches = diff({ total: { name: 'Ideas' } }, { total: { name: 'Ideas', ideaCount: 7 } })
  assert.deepEqual(
    mismatches.map((m) => [m.path, m.kind]),
    [['body.total.ideaCount', 'extra']],
  )
  assert.equal(classify('boards.list.orgadmin', mismatches, ACCEPTED_DIFFS).accepted, false)
})

test('a literal index in an entry path still means that index and nothing else', () => {
  // A path with no `[]` is compared as the string it always was. An entry someone wrote against
  // one recorded element must not turn into a wildcard now that brackets carry meaning.
  const list: AcceptedDiff[] = [{ ...IDEA_COUNT, path: 'body[0].ideaCount' }]
  const onFirst = diff(RECORDED_BOARDS, [
    { ...RECORDED_BOARDS[0], ideaCount: 7 },
    RECORDED_BOARDS[1],
  ])
  const onSecond = diff(RECORDED_BOARDS, [
    RECORDED_BOARDS[0],
    { ...RECORDED_BOARDS[1], ideaCount: 7 },
  ])
  assert.equal(classify('boards.list.orgadmin', onFirst, list).accepted, true)
  assert.equal(
    classify('boards.list.orgadmin', onSecond, list).accepted,
    false,
    'an entry against body[0] excused a difference on body[1]',
  )
})

test('the entry excuses ideaCount and not whatever else appears in the same position', () => {
  const others = ['commentCount', 'ideaCountTotal', 'inviteCode']
  for (const field of others) {
    const mismatches = diff(
      RECORDED_BOARDS,
      RECORDED_BOARDS.map((board) => ({ ...board, [field]: 7 })),
    )
    assert.equal(
      classify('boards.list.orgadmin', mismatches, ACCEPTED_DIFFS).accepted,
      false,
      `a board list that grew ${field} was accepted`,
    )
  }
})

test('the board list entry does not reach a case nobody has listed', () => {
  // Three scenarios list boards as a setup step and are named on the entry. A fourth added later
  // produces exactly this diff, and has to be looked at rather than arriving pre-authorized —
  // which is why `cases` is a list and not `boards.*`.
  const mismatches = diff(RECORDED_BOARDS, withIdeaCount(RECORDED_BOARDS))
  assert.equal(classify('tags.board', mismatches, ACCEPTED_DIFFS).accepted, false)
})

test('a kind-less entry still excuses whatever kind the diff reports', () => {
  // The two standing entries that carry no `kind` must be unaffected by its arrival: the portrait
  // is a `value` mismatch and the export another, but neither entry says so, and neither should
  // have to. Injected rather than fixture-built, because no recorded pair produces two different
  // kinds on one path.
  const entry: AcceptedDiff = {
    cases: ['boards.list'],
    path: 'body.version',
    decided: '2026-09-09',
    reason: 'stands in for an entry whose author did not care which kind the diff reported.',
  }
  const changed = diff({ version: 'v1' }, { version: 'v2' })
  const gone = diff({ version: 'v1' }, {})
  assert.deepEqual([changed[0].kind, gone[0].kind], ['value', 'missing'])
  assert.equal(classify('boards.list', changed, [entry]).accepted, true)
  assert.equal(classify('boards.list', gone, [entry]).accepted, true)

  const narrowed: AcceptedDiff[] = [{ ...entry, kind: 'value' }]
  assert.equal(classify('boards.list', changed, narrowed).accepted, true)
  assert.equal(classify('boards.list', gone, narrowed).accepted, false)
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
  const mismatches = diff({ code: 'ABCD' }, { code: 'WXYZ' })
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
  const result = compare(EXPORT, {
    status: EXPORT.normalized.status,
    headers: { ...EXPORT.normalized.headers, 'content-type': 'application/octet-stream' },
    body: shift(CSV),
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

  const used = classify('ideas.export.orgadmin', diff(CSV, shift(CSV)), ACCEPTED_DIFFS).used
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
  const used = classify('boards.list', diff({ version: 'v1' }, { version: 'v2' }), injected).used
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
  const report = buildReport([EXPORT, LOGIN], [])
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
  const user = fixture('ideas.export.user')
  const withoutToken = { ...(LOGIN.response.body as Record<string, unknown>) }
  delete withoutToken.accessToken

  const report = buildReport(
    [EXPORT, user, LOGIN],
    [
      exchange(EXPORT, shift(EXPORT.response.body as string)),
      exchange(user, shift(user.response.body as string)),
      exchange(LOGIN, withoutToken),
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

test('every kind the entries name is one diff can actually report', () => {
  // The type allows any Mismatch['kind']; an entry naming one `diff` never emits for its path
  // would be an entry that excuses nothing while looking alive.
  const emitted = new Set<Mismatch['kind']>([
    ...diff({ a: 'x' }, { a: 'y' }).map((m) => m.kind),
    ...diff({ a: 'x' }, {}).map((m) => m.kind),
    ...diff({}, { a: 'x' }).map((m) => m.kind),
    ...diff({ a: 'x' }, { a: null }).map((m) => m.kind),
    ...diff([1, 2], [1]).map((m) => m.kind),
  ])
  assert.deepEqual([...emitted].sort(), ['extra', 'length', 'missing', 'type', 'value'])
  for (const entry of ACCEPTED_DIFFS) {
    if (entry.kind !== undefined) assert.ok(emitted.has(entry.kind), `${entry.kind} is unreachable`)
  }
})
