// Slice 138 accepted the idea CSV export's two deliberate changes in one `body` entry dated
// 2026-09-30: three new columns after Description, and five ideas fewer per first board. Because the
// cells hold arbitrary text and the row set moved, no `mask` can hold the rest of the body to
// equality, so the entry's `shape` is all that stands between "the export changed on purpose" and
// "the export is broken and the gate waved it through". These tests try to make it excuse a body
// nobody agreed to, and confirm it accepts the two it was written for.
//
// As in `accepted.test.ts`, the mismatch is produced by `diff` over the recorded body and the
// candidate, because `diff` is the only thing that feeds `classify` in a real run.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { ACCEPTED_DIFFS, classify } from '../src/accepted.ts'
import type { Fixture } from '../src/corpus.ts'
import { diff } from '../src/diff.ts'

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures')
const CASES = [
  'ideas.export.orgadmin',
  'ideas.export.readonly',
  'ideas.export.siteadmin',
  'ideas.export.user',
] as const

const RECORDED = (
  JSON.parse(readFileSync(path.join(FIXTURES, 'ideas.export.orgadmin.json'), 'utf8')) as Fixture
).normalized.body as string

const OLD_HEADER = 'Title,Description,Priority,Idea Type,Business Impact,Status,Due Date,Tags'
const NEW_HEADER =
  'Title,Description,Problem,Proposed Solutions,Impact Rationale,Priority,Idea Type,Business Impact,Status,Due Date,Tags'
const NEW_ROWS =
  'Conveyor jam,Belt stops,Jams,Re-tension,Saves time,High,Problem,High,New / Pending,,\r\n' +
  'Tidy dock,Clear the dock,,,,Low,Continuous Improvement,Low,New / Pending,2026-12-01,5s\r\n'
const NEW_BODY = `${NEW_HEADER}\r\n${NEW_ROWS}`

assert.ok(RECORDED.startsWith(`${OLD_HEADER}\r\n`), 'the recording is the old header, as assumed')

/** Whether the replay would excuse the body, for one of the entry's cases. */
function accepted(actual: unknown, caseKey: string = CASES[0]): boolean {
  return classify(caseKey, diff(RECORDED, actual), ACCEPTED_DIFFS).accepted
}

test('the export entry covers exactly the four authenticated export cases', () => {
  const entry = ACCEPTED_DIFFS.find(
    (e) => e.decided === '2026-09-30' && e.cases.includes('ideas.export.orgadmin'),
  )
  assert.ok(entry, 'the 2026-09-30 export entry is gone')
  assert.deepEqual([...entry.cases].sort(), [...CASES].sort())
  assert.equal(entry.path, 'body')
  assert.equal(entry.kind, 'value')
})

for (const caseKey of CASES) {
  test(`${caseKey}: accepts the new header with fewer rows than were recorded`, () => {
    assert.equal(accepted(NEW_BODY, caseKey), true)
  })

  test(`${caseKey}: accepts the recorded header with different rows`, () => {
    const moved = RECORDED.replace('Low', 'High')
    assert.notEqual(moved, RECORDED)
    assert.equal(accepted(moved, caseKey), true)
  })
}

test('accepts the new header with a single data row', () => {
  assert.equal(
    accepted(`${NEW_HEADER}\r\nOnly row,d,p,s,r,Low,Problem,Low,New / Pending,,\r\n`),
    true,
  )
})

test('rejects an empty body', () => {
  assert.equal(accepted(''), false)
})

test('rejects a header with no data rows, under either header', () => {
  assert.equal(accepted(`${NEW_HEADER}\r\n`), false)
  assert.equal(accepted(`${OLD_HEADER}\r\n`), false)
})

test('rejects a header with no rows and no line ending', () => {
  assert.equal(accepted(NEW_HEADER), false)
})

test('rejects a body without its closing CRLF', () => {
  assert.equal(accepted(NEW_BODY.slice(0, -2)), false)
  assert.equal(accepted(RECORDED.slice(0, -2)), false)
})

test('rejects LF line endings, with or without a closing one', () => {
  assert.equal(accepted(NEW_BODY.replaceAll('\r\n', '\n')), false)
  assert.equal(accepted(NEW_BODY.replaceAll('\r\n', '\n').slice(0, -1)), false)
})

test('rejects a header that dropped a column', () => {
  for (const column of [
    'Title',
    'Description',
    'Problem',
    'Proposed Solutions',
    'Impact Rationale',
    'Priority',
    'Idea Type',
    'Business Impact',
    'Status',
    'Due Date',
    'Tags',
  ]) {
    const header = NEW_HEADER.split(',')
      .filter((name) => name !== column)
      .join(',')
    assert.equal(accepted(`${header}\r\n${NEW_ROWS}`), false, `without ${column}`)
  }
})

test('rejects a header that renamed a column', () => {
  for (const [from, to] of [
    ['Idea Type', 'Type'],
    ['Business Impact', 'Impact'],
    ['Due Date', 'Due date'],
    ['Problem', 'Problems'],
    ['Tags', 'Labels'],
  ] as const) {
    const header = NEW_HEADER.replace(from, to)
    assert.notEqual(header, NEW_HEADER)
    assert.equal(accepted(`${header}\r\n${NEW_ROWS}`), false, `${from} renamed to ${to}`)
  }
})

test('rejects a header that reordered columns', () => {
  const columns = NEW_HEADER.split(',')
  for (const [a, b] of [
    [0, 1],
    [2, 3],
    [5, 6],
    [9, 10],
    [1, 2],
  ] as const) {
    const swapped = [...columns]
    ;[swapped[a], swapped[b]] = [swapped[b] as string, swapped[a] as string]
    assert.equal(accepted(`${swapped.join(',')}\r\n${NEW_ROWS}`), false, `${a} and ${b} swapped`)
  }
})

test('rejects a header with only some of the three new columns', () => {
  assert.equal(
    accepted(
      'Title,Description,Problem,Priority,Idea Type,Business Impact,Status,Due Date,Tags\r\n' +
        NEW_ROWS,
    ),
    false,
  )
  assert.equal(
    accepted(
      'Title,Description,Proposed Solutions,Impact Rationale,Priority,Idea Type,Business Impact,Status,Due Date,Tags\r\n' +
        NEW_ROWS,
    ),
    false,
  )
})

test('rejects a header with a column added at either end', () => {
  assert.equal(accepted(`${NEW_HEADER},Extra\r\n${NEW_ROWS}`), false)
  assert.equal(accepted(`Id,${NEW_HEADER}\r\n${NEW_ROWS}`), false)
})

test('rejects a header preceded by a byte order mark or a blank line', () => {
  assert.equal(accepted(`﻿${NEW_BODY}`), false)
  assert.equal(accepted(`\r\n${NEW_BODY}`), false)
})

test('rejects a body that is not a string', () => {
  for (const body of [null, undefined, 0, {}, [], [NEW_BODY]]) {
    assert.equal(accepted(body), false, `${JSON.stringify(body)}`)
  }
})

test('rejects a JSON error body that replaced the CSV', () => {
  assert.equal(accepted({ title: 'Forbidden', status: 403 }), false)
})

test('does not excuse the anonymous export, which is not one of its cases', () => {
  assert.equal(accepted(NEW_BODY, 'ideas.export.anonymous'), false)
})

test('does not excuse a different path of an export case', () => {
  const mismatches = diff({ body: RECORDED }, { body: NEW_BODY }).map((m) => ({
    ...m,
    path: m.path.replace('body', 'headers.content-type'),
  }))
  assert.equal(classify(CASES[0], mismatches, ACCEPTED_DIFFS).accepted, false)
})

test('rejects when the body is acceptable but the recorded side is not an export at all', () => {
  const verdict = classify(CASES[0], diff('not a csv', NEW_BODY), ACCEPTED_DIFFS)
  assert.equal(verdict.accepted, false, 'the expected side is held to the shape too')
})
