// Differences from the recorded corpus that someone decided to keep.
//
// `SPEC/decisions.md` 2026-09-09 makes the corpus a regression detector rather than the
// specification: shipping for feedback outranks fidelity to the frozen .NET app, so a diff is a
// question with three answers — fix it, accept and record it, or deliberately do better. This file
// is the second answer, and it exists because F1 is the go/no-go gate and "fix until clean" cannot
// mean zero diffs once some differences are chosen. It has to mean *every diff is fixed or listed
// here*, or the gate quietly stops meaning anything the first time one is waved through.
//
// **An entry asserts what the difference is ALLOWED to look like. It does not mute a path.**
//
// That is the whole design, and it is the lesson from `unstable`. `omitPaths` deletes the path from
// both sides before the comparison, so declaring `body.portraitDataUrl` unstable would stop pinning
// that a portrait comes back at all — an endpoint that silently returned `null` would pass. Here the
// comparison still runs; a mismatch is only excused if it also matches the shape the entry
// describes. A portrait that turns into `null` is a different mismatch and still fails.
//
// A stale entry is reported too. If an accepted difference stops occurring, the fix landed or the
// corpus moved, and the entry should go — otherwise this file silently accumulates permission to
// ignore things nobody has looked at in a year.

/** A recorded difference and the evidence for keeping it. */
export type AcceptedDiff = {
  /** `scenario.step`, as the fixtures name it. `*` accepts the path across every case. */
  readonly case: string
  /** The mismatch path exactly as `diff` reports it, e.g. `body.portraitDataUrl`. */
  readonly path: string
  /** ISO date the difference was accepted, so an old entry is visibly old. */
  readonly decided: string
  /** Why this is not a defect. Written for someone deciding whether to reopen it. */
  readonly reason: string
  /**
   * What the difference may look like. Both sides must satisfy it, so the field is still pinned to
   * a shape even though its exact value is not. Omit only when the values cannot be characterised
   * at all, which should be rare enough to argue about.
   */
  readonly shape?: RegExp
}

export const ACCEPTED_DIFFS: readonly AcceptedDiff[] = [
  {
    case: '*',
    path: 'body.portraitDataUrl',
    decided: '2026-09-09',
    reason:
      'sharp and ImageSharp encode the same pixels differently - a different zlib stream and a ' +
      'different chunk set (the recording carries a pHYs chunk). No sharp option reproduces the ' +
      'other encoder, and matching bytes is not a property anyone wants pinned. The shape still ' +
      'requires a PNG data URL, so a portrait that silently became null or a bare string fails.',
    shape: /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/,
  },
  {
    case: '*',
    path: 'body',
    decided: '2026-09-09',
    reason:
      'The idea CSV export embeds due dates the seed sets relative to the day it runs, and the ' +
      'capture was 2026-09-04. Everything else about the export is byte-identical - header row, ' +
      'CRLF endings, quoting, the UTF-8 BOM, content type and disposition. This cannot be handled ' +
      'by `unstable` because the body is one string and `omitPaths` walks object keys. The shape ' +
      'holds the export to its recorded header row, so a truncated or reordered export still fails.',
    shape: /^﻿?Title,Description,Priority,Idea Type,Business Impact,Status,Due Date,Tags\r\n/,
  },
  {
    case: 'auth.login.orgadmin',
    path: 'body.accessToken',
    decided: '2026-09-09',
    reason:
      'Decision `08` moved the session into an httpOnly cookie. Returning the token in the body as ' +
      'well would hand it back to JavaScript and defeat the point, so the field is gone and ' +
      '`SPEC/30-Contracts.md` says so. Predicted in `SPEC/decisions.md` as the one fixture the ' +
      'decision would strand. No shape: the accepted difference is the absence itself.',
  },
]

export type Classification = {
  /** Every mismatch was accepted, so the case does not fail the gate. */
  readonly accepted: boolean
  /** The entries that excused a mismatch, for staleness reporting. */
  readonly used: readonly AcceptedDiff[]
}

/** Does `value` satisfy the entry's shape? A shape-less entry accepts anything, including absence. */
function satisfies(entry: AcceptedDiff, value: unknown): boolean {
  if (entry.shape === undefined) return true
  return typeof value === 'string' && entry.shape.test(value)
}

/**
 * Classify one case's mismatches against the list.
 *
 * A case is accepted only when EVERY mismatch is, deliberately: a recorded difference plus a real
 * regression in the same response is a failing case, not a passing one with a footnote.
 *
 * `expected` is checked against the shape as well as `actual`, so an entry cannot drift into
 * excusing a value the corpus never recorded.
 */
export function classify(
  caseKey: string,
  mismatches: readonly { path: string; expected: unknown; actual: unknown }[],
  list: readonly AcceptedDiff[] = ACCEPTED_DIFFS,
): Classification {
  if (mismatches.length === 0) return { accepted: false, used: [] }

  const used: AcceptedDiff[] = []
  for (const mismatch of mismatches) {
    const entry = list.find(
      (candidate) =>
        (candidate.case === '*' || candidate.case === caseKey) &&
        candidate.path === mismatch.path &&
        satisfies(candidate, mismatch.expected) &&
        satisfies(candidate, mismatch.actual),
    )
    if (entry === undefined) return { accepted: false, used: [] }
    used.push(entry)
  }
  return { accepted: true, used }
}

/** Entries that excused nothing in this run - the fix landed, or the corpus moved. */
export function staleEntries(
  used: readonly AcceptedDiff[],
  list: readonly AcceptedDiff[] = ACCEPTED_DIFFS,
): readonly AcceptedDiff[] {
  const seen = new Set(used)
  return list.filter((entry) => !seen.has(entry))
}
