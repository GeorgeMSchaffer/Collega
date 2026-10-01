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
  // Since 2026-09-27 the export also writes Problem, Proposed Solutions and Impact Rationale
  // (SPEC/decisions.md, rule 2a), so the header and every row differ and this entry no longer
  // excuses these cases. The 2026-09-30 entry for them, at the end of this list, accepts the new
  // header and the seed change that took five ideas out of the export; it pins the header row only,
  // because no `mask` could hold the rest to equality - see its reason.
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
      'boards.list.orgadmin',
      'boards.list.readonly',
      'boards.list.siteadmin',
      'boards.list.user',
      'comments.board',
      'ideaassist.board',
      'ideas.board',
    ],
    path: 'body[].description',
    decided: '2026-09-27',
    reason:
      'A deliberate improvement, not drift (SPEC/decisions.md 2026-09-27, "Boards gain a ' +
      'description"). The Boards page renders richer cards - a description, the ideas across the ' +
      "board's lanes, its most-used tags, and who created it and when - and the list item now " +
      'carries each of them, computed for the whole list in a fixed number of grouped queries so ' +
      'the client does not fan out per board. SPEC/30-Contracts.md names every field. Same cases ' +
      'and same reasoning as `body[].ideaCount` above: the accepted difference is the appearance of ' +
      'the field and only that, which is what `kind` says, so every recorded field of every element ' +
      'and the array length are still compared. Not pinned to a shape - the recording has no such ' +
      'field to compare against. One entry per new field, because an entry names one path.',
    kind: 'extra',
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
    path: 'body[].createdAtUtc',
    decided: '2026-09-27',
    reason:
      "The same change as `body[].description` above, which carries the full reasoning: the board's creation time, from the column `boards` has always had. " +
      'Accepted as the field appearing, and only that.',
    kind: 'extra',
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
    path: 'body[].createdBy',
    decided: '2026-09-27',
    reason:
      'The same change as `body[].description` above, which carries the full reasoning: who created the board, `{ userId, displayName }` or null. ' +
      'Accepted as the field appearing, and only that.',
    kind: 'extra',
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
    path: 'body[].laneCounts',
    decided: '2026-09-27',
    reason:
      "The same change as `body[].description` above, which carries the full reasoning: the board's ideas per swimlane, every lane included. " +
      'Accepted as the field appearing, and only that.',
    kind: 'extra',
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
    path: 'body[].topTags',
    decided: '2026-09-27',
    reason:
      "The same change as `body[].description` above, which carries the full reasoning: up to three of the tags most used on the board's ideas. " +
      'Accepted as the field appearing, and only that. Since 2026-09-28 each item also carries ' +
      "the tag's `color` (SPEC/decisions.md 2026-09-28, the fourth S0.2 amendment); the recording " +
      'has no `topTags` at all, so that addition reports as part of this same `extra` and needs no ' +
      'entry of its own - one for `body[].topTags[].color` would excuse nothing and read as stale.',
    kind: 'extra',
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
    path: 'body[].tagCount',
    decided: '2026-09-27',
    reason:
      "The same change as `body[].description` above, which carries the full reasoning: the number of distinct tags on the board's ideas. " +
      'Accepted as the field appearing, and only that.',
    kind: 'extra',
  },
  {
    cases: [
      'boards.get.orgadmin',
      'boards.get.readonly',
      'boards.get.siteadmin',
      'boards.get.user',
      'boards.update.orgadmin',
    ],
    path: 'body.description',
    decided: '2026-09-27',
    reason:
      'A deliberate addition, not drift (SPEC/decisions.md 2026-09-27, "Boards gain a ' +
      'description"): boards gained an optional description, and the board detail returns it. ' +
      '`PUT /boards/{boardId}` answers the same detail, hence the one successful update case; the ' +
      'other update roles are refused before a body is built. The accepted difference is the ' +
      'appearance of the field, which is what `kind` says: every recorded field of the detail, ' +
      'swimlanes included, is still compared. Create and reorder are unaffected - the create ' +
      'response does not carry the description and reorder answers 204.',
    kind: 'extra',
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
    path: 'body[].isArchived',
    decided: '2026-09-27',
    reason:
      'A deliberate addition, not drift (SPEC/decisions.md 2026-09-27, "One list and detail ' +
      'pattern" - boards are archived, not deleted - and "The S0.2 schema freeze is amended a ' +
      'third time"). Every list item carries whether its board is archived; SPEC/30-Contracts.md ' +
      'names the field. The default list leaves archived boards out, and no recorded board is ' +
      'archived, so the recorded elements and the array length are all still compared - the ' +
      'accepted difference is the appearance of the field and only that, which is what `kind` ' +
      'says. Not pinned to a shape: `shape` is a per-side regex over strings, and this is a ' +
      'boolean the recording has no counterpart for.',
    kind: 'extra',
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
    path: 'body[].archivedAtUtc',
    decided: '2026-09-27',
    reason:
      'The other half of `body[].isArchived` above, which carries the full reasoning: when the ' +
      'board was archived, or null. Accepted as the field appearing, and only that.',
    kind: 'extra',
  },
  {
    cases: [
      'boards.get.orgadmin',
      'boards.get.readonly',
      'boards.get.siteadmin',
      'boards.get.user',
      'boards.update.orgadmin',
    ],
    path: 'body.isArchived',
    decided: '2026-09-27',
    reason:
      "The list item change above, on the board detail: an archived board's own page opens " +
      'read-only with a banner (SPEC/20-feature-boards-and-statuses.md rule 13), so the detail ' +
      'says whether it is archived. `PUT /boards/{boardId}` answers the same detail, hence the one ' +
      'successful update case, exactly as for `body.description`. Accepted as the field appearing, ' +
      'and only that; every recorded field of the detail, swimlanes included, is still compared.',
    kind: 'extra',
  },
  {
    cases: [
      'boards.get.orgadmin',
      'boards.get.readonly',
      'boards.get.siteadmin',
      'boards.get.user',
      'boards.update.orgadmin',
    ],
    path: 'body.archivedAtUtc',
    decided: '2026-09-27',
    reason:
      'The other half of `body.isArchived` above: when the board was archived, or null. Accepted ' +
      'as the field appearing, and only that.',
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
      'ideas.get.orgadmin',
      'ideas.get.readonly',
      'ideas.get.siteadmin',
      'ideas.get.user',
      'ideas.update.orgadmin',
      'ideas.update.user',
    ],
    path: 'body.problem',
    decided: '2026-09-27',
    reason:
      'A deliberate change, not drift (SPEC/decisions.md 2026-09-27, "The idea assistant is ' +
      'rescoped as a co-author, and ideas gain structured fields" and "The S0.2 schema freeze is ' +
      'amended a third time"; SPEC/20-feature-ideas-and-engagement.md rule 2a). Ideas gained three ' +
      'required fields - Problem, Proposed solutions, Impact rationale - and the detail returns ' +
      'them; `PUT /ideas/{ideaId}` answers the same detail, hence the update cases. Because the ' +
      'fields are required on every create and save, the `ideas` scenario now sends them on each ' +
      'create and update request (the recorded requests predate them and would answer 400); the ' +
      'recorded responses are untouched. The accepted difference is the appearance of the field ' +
      'and only that, which is what `kind` says: every recorded field of the detail is still ' +
      'compared. The same change made `description` nullable, which the corpus cannot show - every ' +
      'recorded request supplies a description, so every recorded response still carries one and ' +
      'it is compared as before. Not pinned to a shape: the recording has no such field.',
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
    path: 'body.proposedSolutions',
    decided: '2026-09-27',
    reason:
      'The same change as `body.problem` above, which carries the full reasoning: the ordered list ' +
      'of 1 to 5 proposed solutions. Accepted as the field appearing, and only that - an array, so ' +
      'no `shape` could pin it anyway.',
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
    path: 'body.impactRationale',
    decided: '2026-09-27',
    reason:
      'The same change as `body.problem` above, which carries the full reasoning: why the idea ' +
      'matters to the business. Accepted as the field appearing, and only that.',
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
    path: 'body.formFields',
    decided: '2026-09-27',
    reason:
      'A deliberate change, not drift (SPEC/decisions.md 2026-09-27, "The API sends the custom ' +
      'field list"). The detail carries the idea\'s own custom fields with their stored values in ' +
      'write format, so the edit form stops reversing display labels to option ids and can edit an ' +
      'idea whose type is archived. `PUT /ideas/{ideaId}` answers the same detail, hence the ' +
      'update cases. `fieldValues` is unchanged and still compared. Accepted as the field ' +
      'appearing, and only that - an array, so no `shape` could pin it.',
    kind: 'extra',
  },
  {
    cases: [
      'ideas.types',
      'ideas.types2',
      'ideatypes.list.orgadmin',
      'ideatypes.list.readonly',
      'ideatypes.list.siteadmin',
      'ideatypes.list.user',
      'ideatypes.relist',
    ],
    path: 'body[].effectiveFields',
    decided: '2026-09-27',
    reason:
      'The same change as `body.formFields` above: every Idea Type item carries the custom fields ' +
      'an idea of that type shows, resolved by the domain rule, so the create form stops ' +
      're-deriving it in the browser. The two `ideas.*` cases list the types as a setup step. The ' +
      'accepted difference is the appearance of the field and only that, which is what `kind` ' +
      'says: every recorded field of every element and the array length are still compared.',
    kind: 'extra',
  },
  {
    cases: ['ideatypes.create.orgadmin', 'ideatypes.update.orgadmin'],
    path: 'body.effectiveFields',
    decided: '2026-09-27',
    reason:
      'The same field as `body[].effectiveFields` above, on the single Idea Type item create and ' +
      'update answer - SPEC/30-Contracts.md gives both the list item shape. Listed separately ' +
      'because an entry names one path. The other role cases are 401/403s and are unaffected.',
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
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].tags',
    decided: '2026-09-28',
    reason:
      'A deliberate addition, not drift (SPEC/decisions.md 2026-09-28, "The S0.2 schema freeze is ' +
      'amended a fourth time, for tag colours"). Every tag has a colour now, and an idea list item ' +
      'carries its tags as `{ tagId, name, color }` beside `tagNames`, in the same order, so a card ' +
      'colours its chips without a second request; `tagNames` stays unchanged for older clients. ' +
      'Both idea lists - the board list and the organization list - share the item shape; ' +
      '`comments.ideas` reads the board list as a setup step. The accepted difference is the ' +
      'appearance of the field and only that, which is what `kind` says: every recorded field of ' +
      'every item, `tagNames` included, and the array length are still compared. Not pinned to a ' +
      'shape - it is an array, and the recording has no such field.',
    kind: 'extra',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].effort',
    decided: '2026-09-28',
    reason:
      'A deliberate addition, not drift (SPEC/decisions.md 2026-09-28, answer 6: "The effort bar is ' +
      'on idea cards and rows too"). The idea list item carries the `effort` of the idea - `Low`, ' +
      '`Medium`, `High` or null - the same field the delivery card already had, from the column ' +
      '`ideas` has carried since the delivery amendment. Same cases and the same reasoning as ' +
      '`body.items[].tags` above. Accepted as the field appearing, and only that; not pinned to a ' +
      'shape, since no recorded idea was ever promoted and every value is null.',
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
    path: 'body.tags',
    decided: '2026-09-28',
    reason:
      'The same change as `body.items[].tags` above, on the idea detail: `{ tagId, name, color }` ' +
      'in `tagNames` order. `PUT /ideas/{ideaId}` answers the same detail, hence the two successful ' +
      'update cases. Accepted as the field appearing, and only that; every recorded field of the ' +
      'detail, `tagNames` included, is still compared.',
    kind: 'extra',
  },
  {
    cases: [
      'ideas.create.orgadmin',
      'ideas.create.user',
      'ideas.get.orgadmin',
      'ideas.get.readonly',
      'ideas.get.siteadmin',
      'ideas.get.user',
      'ideas.own-idea',
      'ideas.update.orgadmin',
      'ideas.update.user',
    ],
    path: 'body.statusId',
    decided: '2026-09-29',
    reason:
      'Not a different status - a different label for the same one. The `ideas` scenario lists ' +
      "the organization's boards before it lists its statuses, and since 2026-09-27 each board " +
      'list item carries `laneCounts` (accepted above as `body[].laneCounts`), one entry per lane ' +
      'with its `statusId`, in swimlane order. A GUID is labelled where it is first seen, so the ' +
      'lane statuses are now first seen on the board list rather than on the statuses list, and ' +
      'every later `statusId` in the scenario carries the lane label. The mask holds the relation: ' +
      'both sides must name the same index once the two prefixes are masked, so an idea that ' +
      'landed in the second status rather than the first still fails. The shape confines both ' +
      'sides to those two sources, so a status id minted anywhere else is a different mismatch.',
    shape: /^<guid@(statuses\.body|board\.body\[0\]\.laneCounts)\[\d+\]\.statusId>$/,
    mask: /statuses\.body|board\.body\[0\]\.laneCounts/g,
  },
  {
    cases: ['ideas.statuses'],
    path: 'body[].statusId',
    decided: '2026-09-29',
    reason:
      'The same labelling as `body.statusId` above, on the statuses list itself: each status is ' +
      'first seen as a lane on the board list, so its label moves while its position does not. ' +
      'The mask requires status N to carry the label of lane N, which is the order both lists ' +
      'are in, so a reordered or substituted status still fails.',
    shape: /^<guid@(statuses\.body|board\.body\[0\]\.laneCounts)\[\d+\]\.statusId>$/,
    mask: /statuses\.body|board\.body\[0\]\.laneCounts/g,
  },
  {
    cases: [
      'aiassist.usage.org.orgadmin',
      'aiassist.usage.org.siteadmin',
      'aiassist.usage.platform.siteadmin',
    ],
    path: 'body.totals',
    decided: '2026-09-13',
    reason:
      'Deliberately better (SPEC/decisions.md 2026-09-13, "The usage report returns the ' +
      "contract's `totals`, not the frozen app's flat fields\"). Both usage reports return a " +
      '`totals` object with the six summed fields `SPEC/contracts/ai-assist.md` specifies; the ' +
      'recorded app returned three flat totals with no token breakdown. Accepted as the object ' +
      'appearing, which is what `kind` says; every other recorded field, the organization rows ' +
      'included, is still compared. Not pinned to a shape - it is an object.',
    kind: 'extra',
  },
  {
    cases: [
      'aiassist.usage.org.orgadmin',
      'aiassist.usage.org.siteadmin',
      'aiassist.usage.platform.siteadmin',
    ],
    path: 'body.totalCalls',
    decided: '2026-09-13',
    reason:
      'The other half of `body.totals` above: the flat field it replaces is gone. Accepted as ' +
      'an absence and only that, which is what `kind` says.',
    kind: 'missing',
  },
  {
    cases: [
      'aiassist.usage.org.orgadmin',
      'aiassist.usage.org.siteadmin',
      'aiassist.usage.platform.siteadmin',
    ],
    path: 'body.totalTokens',
    decided: '2026-09-13',
    reason:
      'The other half of `body.totals` above: the flat field it replaces is gone. Accepted as ' +
      'an absence and only that, which is what `kind` says.',
    kind: 'missing',
  },
  {
    cases: [
      'aiassist.usage.org.orgadmin',
      'aiassist.usage.org.siteadmin',
      'aiassist.usage.platform.siteadmin',
    ],
    path: 'body.totalEstimatedCost',
    decided: '2026-09-13',
    reason:
      'The other half of `body.totals` above: the flat field it replaces is gone. Accepted as ' +
      'an absence and only that, which is what `kind` says.',
    kind: 'missing',
  },
  {
    cases: ['auth.viewas.start', 'auth.viewas.start.orgadmin'],
    path: 'body.impersonating.organizationTitle',
    decided: '2026-09-10',
    reason:
      'The CurrentUserSummary field accepted above as `body.organizationTitle`, which carries the ' +
      'full reasoning, on the summaries a View As start returns: `SPEC/contracts/view-as.md` gives ' +
      '`impersonating` the same shape as `GET /auth/me`. Listed separately because an entry names ' +
      'one path. Accepted as the field appearing, and only that.',
    kind: 'extra',
  },
  {
    cases: ['auth.viewas.start', 'auth.viewas.start.orgadmin'],
    path: 'body.realUser.organizationTitle',
    decided: '2026-09-10',
    reason:
      'The same field on `realUser`, which the contract also gives the `GET /auth/me` shape - ' +
      '`null` for a Site Admin, the organization for an Org Admin. Accepted as the field ' +
      'appearing, and only that.',
    kind: 'extra',
  },
  {
    cases: [
      'ideas.export.orgadmin',
      'ideas.export.readonly',
      'ideas.export.siteadmin',
      'ideas.export.user',
    ],
    path: 'body',
    decided: '2026-09-30',
    reason:
      'Two deliberate changes, not drift (SPEC/decisions.md 2026-09-30, "What the MVP release ' +
      'includes", item 3). The export gained Problem, Proposed Solutions and Impact Rationale ' +
      'after Description (2026-09-27, "The idea assistant is rescoped as a co-author, and ideas ' +
      'gain structured fields"), so the header and every row carry three more cells. And the demo ' +
      "seed's delivery module (commit a1ddb39) promotes five ideas per first board to issues, " +
      'which takes them out of the board list the export reads - eight data rows where the ' +
      'recording holds thirteen. The cells hold arbitrary text and the row set moved, so no `mask` ' +
      'could hold the rest of the body to equality without muting it; the shape pins what can be ' +
      'pinned, on BOTH sides: the recorded header row or the new one, at least one data row and ' +
      'the closing CRLF, so a truncated or empty body still fails. The date-mask entry for these cases (2026-09-09, above) no longer applies and is ' +
      'left in place as the record of how the export used to match.',
    shape:
      /^Title,Description,(?:Problem,Proposed Solutions,Impact Rationale,)?Priority,Idea Type,Business Impact,Status,Due Date,Tags\r\n[\s\S]+\r\n$/,
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items',
    decided: '2026-09-30',
    reason:
      'A deliberate seed change, not drift (SPEC/decisions.md 2026-09-30, "What the MVP release ' +
      'includes", item 3). The demo seed\'s delivery module (commit a1ddb39) promotes five ideas ' +
      'per first board to issues, and a promoted idea leaves the Discovery-only board list, so ' +
      'the first board holds 6 ideas where the recording holds 11 and the ideas and comments ' +
      'cases that list it answer a different set. The corpus was recorded before delivery ' +
      "existed and cannot be re-recorded. Accepted as the list's length differing, which is " +
      'what `kind` says; the fields each element carries are accepted by the entries that ' +
      'follow, one per path, and every field not named in one is still compared.',
    kind: 'length',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].assignees',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is how many assignees an idea carries. Accepted as that value ' +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'length',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].authorUserId',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is who authored the idea at that position (a placeholder ' +
      'label bound earlier in the replay, so it moves with the idea). Accepted as that value ' +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].businessImpactColor',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's business impact colour. Accepted as that value " +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].businessImpactName',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's business impact name. Accepted as that value " +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].commentCount',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is how many comments the idea has. Accepted as that value ' +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: ['comments.ideas', 'ideas.list.board.orgadmin', 'ideas.list.board.user'],
    path: 'body.items[].hasUpvoted',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is whether the caller upvoted the idea. Accepted as that ' +
      'value differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].ideaTypeName',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's type name. Accepted as that value differing, " +
      'and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].priority',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's priority. Accepted as that value differing, and " +
      'only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].statusId',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's status, as a placeholder label bound earlier in " +
      'the replay. Accepted as that value differing, and only that - a field that went missing ' +
      'or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].statusName',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's status name. Accepted as that value differing, " +
      'and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].tagNames',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is how many tags an idea carries. Accepted as that value ' +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'length',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].title',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's title. Accepted as that value differing, and " +
      'only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].upvoteCount',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's upvote count. Accepted as that value differing, " +
      'and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].assignees[].displayName',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is an assignee's display name. Accepted as that value " +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].assignees[].firstName',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is an assignee's first name. Accepted as that value " +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].assignees[].lastName',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is an assignee's last name. Accepted as that value differing, " +
      'and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].assignees[].userId',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is an assignee's id, as a placeholder label bound earlier in " +
      'the replay. Accepted as that value differing, and only that - a field that went missing ' +
      'or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.ideas',
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.totalCount',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is the total the endpoint reports. Accepted as that value ' +
      'differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'comments.list.orgadmin',
      'comments.list.readonly',
      'comments.list.siteadmin',
      'comments.list.user',
    ],
    path: 'body.items',
    decided: '2026-09-30',
    reason:
      'The same change as `body.items` above, reaching the comments endpoints: these cases read ' +
      "the first idea of the first board's list (`$.body.items[0]`), and once the delivery " +
      'module promotes five ideas out of that list the first idea is a different one - it has ' +
      'no comments, where the recorded one has two. Accepted as that value differing, which is ' +
      'what `kind` says; the comment fields themselves are still compared wherever there are ' +
      'comments.',
    kind: 'length',
  },
  {
    cases: [
      'comments.list.orgadmin',
      'comments.list.readonly',
      'comments.list.siteadmin',
      'comments.list.user',
    ],
    path: 'body.totalCount',
    decided: '2026-09-30',
    reason:
      'The same change as `body.items` above, reaching the comments endpoints: these cases read ' +
      "the first idea of the first board's list (`$.body.items[0]`), and once the delivery " +
      'module promotes five ideas out of that list the first idea is a different one - it has ' +
      'no comments, where the recorded one has two. Accepted as that value differing, which is ' +
      'what `kind` says; the comment fields themselves are still compared wherever there are ' +
      'comments.',
    kind: 'value',
  },
  {
    cases: ['comments.update.user'],
    path: 'body.authorUserId',
    decided: '2026-09-30',
    reason:
      'The same change as `body.items` above, reaching the comments endpoints: these cases read ' +
      "the first idea of the first board's list (`$.body.items[0]`), and once the delivery " +
      'module promotes five ideas out of that list the first idea is a different one - so the ' +
      'author id label bound from the idea list moved with it. Accepted as that value ' +
      'differing, which is what `kind` says; the comment fields themselves are still compared ' +
      'wherever there are comments.',
    kind: 'value',
  },
  {
    cases: [
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].businessImpactId',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's business impact id, as a placeholder label. " +
      'Accepted as that value differing, and only that - a field that went missing or appeared ' +
      'still fails.',
    kind: 'value',
  },
  {
    cases: [
      'ideas.list.board.orgadmin',
      'ideas.list.board.readonly',
      'ideas.list.board.siteadmin',
      'ideas.list.board.user',
    ],
    path: 'body.items[].ideaTypeId',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      "the counts moved. This one is the idea's type id, as a placeholder label. Accepted as " +
      'that value differing, and only that - a field that went missing or appeared still fails.',
    kind: 'value',
  },
  {
    cases: [
      'ideas.list.org.orgadmin',
      'ideas.list.org.readonly',
      'ideas.list.org.siteadmin',
      'ideas.list.org.user',
    ],
    path: 'body.items[].ideaId',
    decided: '2026-09-30',
    reason:
      "The same change as `body.items` above, which carries the full reasoning: the demo seed's " +
      "delivery module promotes five ideas out of the first board's list, so the elements and " +
      'the counts moved. This one is the id of the idea at that position, as a placeholder ' +
      'label. Accepted as that value differing, and only that - a field that went missing or ' +
      'appeared still fails.',
    kind: 'value',
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
