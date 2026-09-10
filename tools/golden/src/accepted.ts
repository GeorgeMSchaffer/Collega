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
// `shape` on its own cannot always keep that promise. It is a *per-side* regex, so where only a
// fraction of a value may move — seven due dates in a 3161-character CSV — anchoring it to the part
// that is stable leaves everything else unchecked on both sides, and the entry has quietly become
// the muting it was supposed to avoid. `mask` is the comparative half: both sides must be equal once
// the part that may differ is replaced. Any `reason` claiming "everything else is identical" needs
// one, because that sentence is a statement about the two sides together and no `shape` can make it.
//
// Cases are listed rather than wildcarded, so a case that starts diverging later has to be looked at
// instead of arriving pre-authorized, and so staleness can be reported per case.
//
// A stale (entry, case) pair is reported too. If an accepted difference stops occurring, the fix
// landed or the corpus moved, and the case should come off the entry — otherwise this file silently
// accumulates permission to ignore things nobody has looked at in a year.

import type { Mismatch } from './diff.ts'

/** A recorded difference and the evidence for keeping it. */
export type AcceptedDiff = {
  /** The cases this covers, each `scenario.step` as the fixtures name it. */
  readonly cases: readonly string[]
  /**
   * The mismatch path as `diff` reports it, e.g. `body.portraitDataUrl`. `[]` stands for any one
   * array index, exactly as it does in a case's `unstable` declarations: `body[].ideaCount` covers
   * a field on every element of a bare-array body without the entry having to guess how many
   * elements the scenario produced.
   */
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
  /** Both sides must be equal once every match of this is replaced. Use when only part of the value may differ. */
  readonly mask?: RegExp
  /**
   * The kind of mismatch this excuses. The way to say "the field must be gone" - `shape` cannot,
   * because a shape-less entry accepts any value and a shape rejects absence outright.
   */
  readonly kind?: Mismatch['kind']
}

export const ACCEPTED_DIFFS: readonly AcceptedDiff[] = [
  {
    cases: [
      'profile.portrait.set.orgadmin',
      'profile.portrait.set.readonly',
      'profile.portrait.set.siteadmin',
      'profile.portrait.set.user',
    ],
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
    cases: [
      'ideas.export.orgadmin',
      'ideas.export.readonly',
      'ideas.export.siteadmin',
      'ideas.export.user',
    ],
    path: 'body',
    decided: '2026-09-09',
    reason:
      'The idea CSV export embeds due dates the seed sets relative to the day it runs, and the ' +
      'capture was 2026-09-04. The mask holds the whole body to equality once those dates are ' +
      'replaced, so the header row, the thirteen data rows, their order, the quoting and the CRLF ' +
      'endings are all still compared byte for byte and only the dates may move; `content-type` is ' +
      'pinned by the header diff. Two things are deliberately not claimed here: the recorded body ' +
      'carries no BOM (the capture decoded it away - `content-length` is 3164 against 3161 ' +
      'characters), and `content-disposition` is outside HEADER_ALLOW_LIST, so the download ' +
      'filename is not compared at all. This cannot be handled by `unstable` because the body is ' +
      'one string and `omitPaths` walks object keys.',
    shape: /^Title,Description,Priority,Idea Type,Business Impact,Status,Due Date,Tags\r\n/,
    mask: /\d{4}-\d{2}-\d{2}/g,
  },
  {
    cases: ['auth.login.orgadmin'],
    path: 'body.accessToken',
    decided: '2026-09-09',
    reason:
      'Decision `08` moved the session into an httpOnly cookie. Returning the token in the body as ' +
      'well would hand it back to JavaScript and defeat the point, so the field is gone and ' +
      '`SPEC/30-Contracts.md` says so. Predicted in `SPEC/decisions.md` as the one fixture the ' +
      'decision would strand. The accepted difference is the absence itself, which is what `kind` ' +
      'says: a login that answered `null` there, or anything else, is a contract this decision ' +
      'did not make and still fails.',
    kind: 'missing',
  },
  {
    cases: [
      'boards.list.orgadmin',
      'boards.list.readonly',
      'boards.list.siteadmin',
      'boards.list.user',
      'comments.board',
      'ideaassist.board',
      'ideas.board',
    ],
    path: 'body[].ideaCount',
    decided: '2026-09-10',
    reason:
      'A deliberate improvement, not drift. To render the count on each board card the client used ' +
      'to issue GET /boards/{boardId}/ideas?pageSize=1 per board and read `totalCount` off the ' +
      'paging envelope; the board list does not page, so an organization with 200 boards fired 200 ' +
      'requests and 200 count queries from one render. The figure is now projected on the list item ' +
      'beside `swimlaneCount` and `SPEC/30-Contracts.md` names it. The accepted difference is the ' +
      "field's appearance and only that, which is what `kind` says: every other field of every " +
      'element is still compared, and so is the array length, so a board that lost `swimlaneCount` ' +
      'or a list that gained an entry still fails. Three of these cases run the board list as a ' +
      'setup step after creating a board, so they carry three elements where the four role cases ' +
      'carry two - hence `[]` rather than an entry per index. The count itself is not pinned here: ' +
      '`shape` is a per-side regex over strings and this value is a number, so any `ideaCount` on ' +
      'any element is accepted. Nothing is lost by that - the recording has no such field, so there ' +
      'was never a recorded number to compare against.',
    kind: 'extra',
  },
  {
    cases: [
      'aiassist.org',
      'auth.me.orgadmin',
      'auth.me.readonly',
      'auth.me.siteadmin',
      'auth.me.update',
      'auth.me.user',
      'boards.org',
      'businessimpacts.org',
      'comments.org',
      'fielddefinitions.org',
      'ideaassist.org',
      'ideas.org',
      'ideatypes.org',
      'organizations.org',
      'profile.me.update.orgadmin',
      'profile.me.update.readonly',
      'profile.me.update.siteadmin',
      'profile.me.update.user',
      'profile.org',
      'profile.portrait.clear.orgadmin',
      'profile.portrait.clear.readonly',
      'profile.portrait.clear.siteadmin',
      'profile.portrait.clear.user',
      'profile.portrait.set.orgadmin',
      'profile.portrait.set.readonly',
      'profile.portrait.set.siteadmin',
      'profile.portrait.set.user',
      'statuses.org',
      'tags.org',
      'users.org',
    ],
    path: 'body.organizationTitle',
    decided: '2026-09-10',
    reason:
      'A deliberate improvement, not drift. The sidebar names the organization on every ' +
      'authenticated page and the summary carried only an `organizationId`, so the client resolved ' +
      'the title through GET /organizations/{id} - an endpoint `OrganizationService` gates behind ' +
      'Site Admin or an in-scope Org Admin. A `User` or `ReadOnly` reader therefore paid a ' +
      'guaranteed 403 per request and still got no name, rendering the Site Admin branch ("All ' +
      'organizations") on every page. The title is now projected here and SPEC/30-Contracts.md and ' +
      'SPEC/decisions.md 2026-09-10 both say so. Every case listed answers a CurrentUserSummary - ' +
      'the four /auth/me role cases, the profile edits and portrait set/clear that echo it back, ' +
      'and the `*.org` setup steps that resolve the caller before doing something else. The ' +
      "accepted difference is the field's appearance and only that, which is what `kind` says: " +
      'every other field of the summary is still compared, so a `role` or `viewingAs` that moved ' +
      'still fails. The value is not pinned: `shape` is a per-side regex checked against BOTH ' +
      'sides, and the recording has no such field for it to hold - the same reason the board ' +
      "list's `ideaCount` above carries none. What it must not do is confuse the two null cases, " +
      'and the replay is the evidence it does not: the Site Admin cases answer `null` here while ' +
      'every organization member answers "Acme Robotics".',
    kind: 'extra',
  },
  {
    cases: ['auth.login.orgadmin'],
    path: 'body.user.organizationTitle',
    decided: '2026-09-10',
    reason:
      'The same field as the entry above, on the summary nested in the login response - login ' +
      'returns a CurrentUserSummary under `user`, so it gains the title with it. Listed separately ' +
      'because an entry names one path and this one is nested. This case also carries the accepted ' +
      'absence of `body.accessToken`; both are accepted here, which is what lets the case pass, and ' +
      'a case is only accepted when EVERY mismatch is.',
    kind: 'extra',
  },
  {
    cases: [
      'ideas.get.orgadmin',
      'ideas.get.readonly',
      'ideas.get.siteadmin',
      'ideas.get.user',
      'ideas.update.orgadmin',
      'ideas.update.user',
    ],
    path: 'body.author',
    decided: '2026-09-10',
    reason:
      'A deliberate improvement, not drift. The idea detail header renders "by {author}" and the ' +
      'payload carried no author at all - not even the `authorUserId` the list item has - so the ' +
      'screen stayed on fixture data while the board beside it was live, and a tester clicking a ' +
      'real card read invented names. It now carries the full persona under `author`, in the same ' +
      'shape `assignees` uses, so the name renders without a second request per idea opened; ' +
      'SPEC/30-Contracts.md names it. Both `GET /ideas/{ideaId}` and `PUT /ideas/{ideaId}` answer ' +
      'the detail, hence the update cases. The accepted difference is the appearance of the object, ' +
      'which is what `kind` says: every other field of the detail is still compared. Its contents ' +
      'are not pinned - `shape` is a per-side regex over strings and this value is an object, and ' +
      'the recording has no such field to compare against either way.',
    kind: 'extra',
  },
  {
    cases: [
      'ideas.get.orgadmin',
      'ideas.get.readonly',
      'ideas.get.siteadmin',
      'ideas.get.user',
      'ideas.update.orgadmin',
      'ideas.update.user',
    ],
    path: 'body.createdAtUtc',
    decided: '2026-09-10',
    reason:
      'The other half of the same change: the detail header renders "on {date}" beside the author ' +
      'and had no source for it. The column has been on `ideas` all along - the list item already ' +
      'projects it - so this is the detail catching up, not new data. A separate entry from ' +
      '`body.author` because an entry names one path. Not pinned to a shape: the value normalizes ' +
      'to the corpus timestamp placeholder rather than a comparable string, and the recording has ' +
      'no such field.',
    kind: 'extra',
  },
  {
    cases: [
      'comments.list.orgadmin',
      'comments.list.readonly',
      'comments.list.siteadmin',
      'comments.list.user',
    ],
    path: 'body.items[].author',
    decided: '2026-09-10',
    reason:
      'A deliberate improvement, not drift, and the same one `body.author` on the idea detail ' +
      'above is. A comment carried only an `authorUserId`, so the thread had no name and no ' +
      'avatar to render without a request per distinct commenter, and the inspector stayed on ' +
      'fixture data showing invented commenters. Each item now carries the full persona under ' +
      '`author`, in the shape `assignees` and the idea `author` already use, and ' +
      'SPEC/30-Contracts.md names it. The accepted difference is the appearance of that object ' +
      'and only that, which is what `kind` says: every other field of every item is still ' +
      'compared, and so is the array length, so a comment that lost `body` or a page that gained ' +
      'an entry still fails. `[]` rather than two indexed entries because the path is the same on ' +
      'both items. Its contents are not pinned - `shape` is a per-side regex over strings and ' +
      'this value is an object, and the recording has no such field to compare against either way.',
    kind: 'extra',
  },
  {
    cases: ['profile.register.duplicate.anonymous'],
    path: 'status',
    decided: '2026-09-10',
    reason:
      'A deliberate improvement, not drift. Registering an email that is already taken answered a ' +
      'distinguishable 409 "Email is already in use." before the password was even validated, and ' +
      "`users.normalized_email` is globally unique - so anyone holding any organization's invite " +
      'code could ask whether an address has an account in ANY tenant, Site Admins included, ' +
      'without signing in. It is now the same field-keyed 400 every other registration refusal ' +
      'produces, worded so it does not say the account exists; SPEC/30-Contracts.md and ' +
      'SPEC/decisions.md 2026-09-10 both say so, and the real reason goes to the audit log as ' +
      '`UserSelfRegistrationRejected`. What this entry costs is worth naming rather than hiding: a ' +
      'status mismatch short-circuits the comparison in `replay.ts`, so accepting it means the ' +
      'BODY of this one case is no longer compared at all. That is the harness, not a choice made ' +
      'here, and it is the reason the contract change is written down in two specs instead of ' +
      'being pinned by this file. No `shape` - the value is a number, and `shape` is a per-side ' +
      'regex over strings.',
    kind: 'value',
  },
  {
    cases: ['comments.update.user'],
    path: 'body.author',
    decided: '2026-09-10',
    reason:
      'The same field as the entry above, on the single comment `PUT /comments/{commentId}` ' +
      'answers - the edit returns the list item shape, so it gains the author with it, and the ' +
      'composer can put the edited comment back in the thread without refetching. Listed ' +
      'separately because an entry names one path and this one is not under `items`. The other ' +
      'three `comments.update.*` cases are 403s and are unaffected.',
    kind: 'extra',
  },
]

/** One entry as it applies to one of its cases - the unit staleness is reported at. */
export type AcceptedCase = {
  readonly entry: AcceptedDiff
  readonly case: string
}

export type Classification = {
  /** Every mismatch was accepted, so the case does not fail the gate. */
  readonly accepted: boolean
  /** The entries that excused a mismatch, for staleness reporting. */
  readonly used: readonly AcceptedCase[]
}

/**
 * Does the entry's path name this mismatch's?
 *
 * A path with no `[]` is compared as the string it always was, so an entry written against one
 * literal index still means that index and nothing else. `[]` matches an array index only — `\d+`
 * inside the brackets `diff` prints — rather than an arbitrary segment, so `body[].ideaCount`
 * cannot quietly start excusing `body.total.ideaCount`. That is deliberately all it is: `unstable`
 * needs the same reach through an array and expresses it the same way (`omitPaths`), and a general
 * path-expression language on this list would be a second thing to learn about the same file.
 */
function pathMatches(pattern: string, path: string): boolean {
  if (!pattern.includes('[]')) return pattern === path
  const source = pattern
    .split('[]')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\[\\d+\\]')
  return new RegExp(`^${source}$`).test(path)
}

/**
 * Does `value` satisfy the entry's shape? A shape-less entry accepts anything, including absence.
 *
 * `match` rather than `test` because this is called twice per mismatch, once per side, and `test`
 * carries `lastIndex` between calls on a `g`-flagged regex — a shape written with one would pass on
 * the expected side and fail on the actual. No current shape has the flag; the gate is too load
 * bearing to leave that waiting for whoever adds one.
 */
function satisfies(entry: AcceptedDiff, value: unknown): boolean {
  if (entry.shape === undefined) return true
  return typeof value === 'string' && value.match(entry.shape) !== null
}

/**
 * Do the two sides agree once the entry's mask is replaced out of both?
 *
 * The placeholder is a literal rather than the empty string on purpose: masking to nothing would
 * make a value with the varying part *deleted* equal to one that still has it.
 */
function equalUnderMask(entry: AcceptedDiff, expected: unknown, actual: unknown): boolean {
  if (entry.mask === undefined) return true
  if (typeof expected !== 'string' || typeof actual !== 'string') return false
  return expected.replace(entry.mask, '<masked>') === actual.replace(entry.mask, '<masked>')
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
  mismatches: readonly Mismatch[],
  list: readonly AcceptedDiff[],
): Classification {
  if (mismatches.length === 0) return { accepted: false, used: [] }

  const used: AcceptedCase[] = []
  for (const mismatch of mismatches) {
    const entry = list.find(
      (candidate) =>
        candidate.cases.includes(caseKey) &&
        pathMatches(candidate.path, mismatch.path) &&
        (candidate.kind === undefined || candidate.kind === mismatch.kind) &&
        satisfies(candidate, mismatch.expected) &&
        satisfies(candidate, mismatch.actual) &&
        equalUnderMask(candidate, mismatch.expected, mismatch.actual),
    )
    if (entry === undefined) return { accepted: false, used: [] }
    used.push({ entry, case: caseKey })
  }
  return { accepted: true, used }
}

/**
 * The (entry, case) pairs that excused nothing in this run - the fix landed, or the corpus moved.
 *
 * Per case rather than per entry, so an entry whose four cases are down to one says so instead of
 * looking as alive as the day it was written.
 */
export function staleEntries(
  used: readonly AcceptedCase[],
  list: readonly AcceptedDiff[],
): readonly AcceptedCase[] {
  const excused = new Map<AcceptedDiff, Set<string>>()
  for (const pair of used) {
    const cases = excused.get(pair.entry)
    if (cases) cases.add(pair.case)
    else excused.set(pair.entry, new Set([pair.case]))
  }
  return list.flatMap((entry) =>
    entry.cases
      .filter((caseKey) => !excused.get(entry)?.has(caseKey))
      .map((caseKey) => ({ entry, case: caseKey })),
  )
}
