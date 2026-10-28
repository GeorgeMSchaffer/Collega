# Feature: Restricted boards and user groups

*Written 2026-10-26 (slice 348, spec) from the owner's answers; approved by the owner the same day.
Decision: `SPEC/decisions.md` 2026-10-26 "A board can be Restricted to named users and groups".
Contracts: `SPEC/contracts/groups.md` and `contracts/boards.md` "Board access", both proposed.
Promotes `SPEC/ideas-inbox.md` "Teams and private boards", deleted from the inbox. Status:
**specified, not built**.*

## Intent

Let an organization keep a board visible only to the people who need it, and grant that access to
a **group** rather than one person at a time. Joining or leaving a group then changes access to
every board the group is on, with no board edited.

## Scope

- **Groups:** named sets of an organization's users, managed by Org Admins.
- **Board visibility:** each board is *Organization* (today's behavior, the default) or
  *Restricted*. A Restricted board has an access list of users and groups.
- **One visibility rule, applied everywhere** an idea, task or board is read, listed, counted or
  notified.

## Non-goals

- Per-grant permission levels (viewer/editor). A grant decides *visibility*; the role still
  decides what the person may do (owner, 2026-10-26).
- Per-idea or per-status permissions.
- Groups that a User creates or owns; nested groups; groups spanning organizations.
- Groups for anything other than board access (mentions of `@group`, assigning to a group,
  notifying a group). Recorded as possible follow-ups, not built.
- SSO/SCIM group sync (deferred with SSO, `AGENTS.md`).
- Restricted Statuses, idea types, tags or fields. They stay organization-wide; only *ideas* on a
  restricted board are hidden.

## Terms

| Term | Meaning |
|---|---|
| **Group** | An organization-scoped, named set of users. Name ≤ 100 characters, trimmed, unique within the organization case-insensitively. Optional description ≤ 500. |
| **Visibility** | `Organization` or `Restricted`, on a board. New boards and every existing board are `Organization`. |
| **Access list** | A Restricted board's granted users and granted groups. Meaningless (kept, ignored) while the board is `Organization`. |
| **Can see a board** | The caller is the organization's Org Admin; **or** the board is `Organization`; **or** the caller is on its access list directly, through a group, or is the board's creator. |
| **Visible board set** | The set of board ids the caller can see in their organization, computed once per request. |

## Requirements

Each requirement has scenarios and an oracle. IDs are stable; later slices cite them.

### BAG-1 Groups exist and are managed by Org Admins — Added

- **1a** An Org Admin creates, renames, re-describes and deletes groups, and adds and removes
  members (any user of the same organization, any role, any status).
- **1b** A User or Read Only member may **list** groups and their members (needed to understand a
  board's access list) but may not change them: `403`.
- **1c** A duplicate name (case-insensitive, trimmed) is `400` keyed `name`; a user id that is not
  a user of the group's organization is `400` keyed `userIds` (validation, per
  `30-Contracts.md`).
- **1d** Deleting a group removes its memberships and every board grant that names it. Boards are
  not otherwise touched.
- **1e** Every change writes an audit event (`GroupCreated`, `GroupUpdated`, `GroupDeleted`,
  `GroupMembersChanged` with added/removed user ids).
- **1f** A Site Admin acting directly reads groups (`200`) and is refused every change (`403`);
  View As is the path, as for tags.

*Oracle:* application tests on `GroupService`; API tests per route × role.

### BAG-2 A board can be Restricted, with an access list — Added

- **2a** The board read gains `visibility`, `accessUserIds`, `accessGroupIds` and
  `canManageAccess`. List items gain `visibility` only.
- **2b** `PUT /boards/{id}/access` `{ visibility, userIds, groupIds }` replaces the whole setting.
  Allowed for the board's organization's Org Admin, the board's creator while an active User or
  Org Admin, and a Site Admin through View As acting as the target; anyone else `403`. An
  archived board is `409`. On create, the same three fields are optional (default `Organization`,
  empty lists).
- **2c** Ids from another organization, or unknown ids, are `400` keyed `userIds` / `groupIds`.
- **2d** Restricting a board with an empty list is allowed: then only Org Admins and the creator
  see it.
- **2e** Switching back to `Organization` keeps the stored list (so a toggle back restores it) but
  the list grants nothing while the board is `Organization`.
- **2f** Audit `BoardAccessChanged` with old/new visibility and added/removed users and groups.
- **2g** Archived boards keep their visibility; archiving changes nothing about who can see one.

*Oracle:* application tests on `BoardService.setAccess`; API tests; migration leaves every existing
board `Organization` (seeded-DB assertion).

### BAG-3 Who can see a board — Added

- **3a** The "can see" rule in Terms is the **only** rule. It lives in `packages/application`
  (one function computing the visible board set) and every read below goes through it.
- **3b** Org Admin: always sees every board in their organization, listed or not.
- **3c** Site Admin acting directly: sees every board (as today). Site Admin in **View As**: sees
  exactly what the viewed user sees.
- **3d** Membership is evaluated at request time. Adding a user to a group grants access to every
  board the group is on on their next request; removing them revokes it on their next request.
  No board is written.
- **3e** A deactivated user's memberships and grants are kept; they cannot sign in, so they see
  nothing. Reactivation restores access.
- **3f** Role is unchanged by access: a Read Only member of a group on a Restricted board comments
  and upvotes there, and edits nothing.

*Oracle:* a table-driven application test over {Org Admin, creator, direct grant, group grant,
not granted} × {Organization, Restricted} → sees / does not see; one test for 3d that changes
membership and re-reads without touching the board.

### BAG-4 A non-member cannot learn a Restricted board's content exists — Added

For a caller who cannot see board B, every item on B (idea, Issue, task) behaves as if it did not
exist (owner, 2026-10-26: "filtered out", not a redacted placeholder).

- **4a** Direct reads by id — board, idea, comments, attachments, fields, dependencies, followers,
  upvotes, history — answer `404`, never `403`.
- **4b** Writes addressed to such an item (comment, upvote, follow, edit, move, assign) answer
  `404`.
- **4c** Lists and counts leave such items out: the board list, Ideas list and search, Home tiles
  and feed, Inbox / notifications, the Backlog, `/tasks`, sprint pages and planning, the Roadmap
  and Outcome counts, pull candidates, CSV export, and the tag catalog's usage counts.
- **4d** A Board References lane that references B shows no cards from B to that caller; the
  lane's header and count reflect only what they can see. Configuring a lane to reference B
  requires being able to see B (otherwise `422` `referencesBoardInvalid`, exactly as for an unknown board; owner, 2026-10-28).
- **4e** Pickers leave out what the caller cannot see: dependency targets, pull candidates, the
  move-to-board list. Mention and assignee candidates **for an idea on a Restricted board** are only
  users who can see that board.
- **4f** Notifications about an item on B are not delivered to, or listed for, a user who cannot
  see B at read time. Stored events are kept, so regaining access restores them.
- **4g** CSV import naming B is refused per row as an unknown board.
- **4h** Mentioning or assigning a user who cannot see the idea's board is `400` keyed
  `mentionEmails` / `assigneeUserIds` (an Issue checklist item: `assigneeUserId`).
- **4i** Audit views: Org Admins see all (unchanged); no other role reads audit.
- **4j** The MCP server (`SPEC/20-feature-mcp-server.md`, not built) inherits this rule; its spec
  gets a one-line pointer.

*Oracle:* one API test per surface in 4a–4h with a fixture of two users (granted, not granted) and
a Restricted board holding one idea, one Issue and one task — the "leak matrix". A non-member
response must not contain the idea's id or title anywhere in its body (asserted by string search,
not only by shape).

### BAG-5 Existing behavior is unchanged until someone restricts a board — Modified

- **5a** After migration every board is `Organization` and every existing response is identical
  apart from the added fields in 2a.
- **5b** The golden corpus replays with only the additive `visibility` / `canManageAccess` /
  `access*` differences, accepted and recorded (`SPEC/decisions.md` 2026-09-11 rule).

*Oracle:* `tools/golden` replay; `pnpm check`.

### BAG-6 Web: Settings → Groups, and a board's Access section — Added

- **6a** *Settings → Groups* (Org Admin; read-only list for others): list with member counts;
  drawer to create/edit name, description and members (member picker over the organization's
  users); delete with confirmation that names the boards it is on.
- **6b** Board form (drawer and Settings): an **Access** section shown when `canManageAccess` —
  *Everyone in the organization* / *Only people and groups I choose*, then a combined picker of
  users and groups. Shows the effective count ("12 people can see this board").
- **6c** A Restricted board shows a lock mark in the board list, the sidebar and its header.
- **6d** Layout is not settled: a throwaway comp in `SPEC/mockups/` is approved before React
  (`AGENTS.md`, Client Design Direction).

*Oracle:* web unit tests; Playwright `e2e/tests/restricted-board.spec.ts` (Org Admin restricts a
board to a group; a group member sees it; a non-member gets 404 on its URL; removing the member
hides it); checked in the browser on desktop and at 375px, Graphite and Terrazzo.

## Design

**The fact that makes this safe:** visibility defaults to `Organization`, and the filter is a set
of board ids. An organization that never restricts a board gets the same rows as today, so the
cross-cutting filter can land surface by surface behind tests without changing any current
response.

**Persistence** (an S0.2 amendment, numbered when its migration merges):

```
enum BoardVisibility { Organization  Restricted }

boards.visibility           BoardVisibility NOT NULL DEFAULT 'Organization'

user_groups                 id uuid PK, organization_id uuid FK, name varchar(100),
                            normalized_name varchar(100), description varchar(500) NULL,
                            created/updated_at_utc, created/updated_by_user_id
                            UNIQUE (organization_id, normalized_name)
user_group_members          group_id FK CASCADE, user_id FK CASCADE, PK (group_id, user_id),
                            INDEX (user_id)
board_access_users          board_id FK CASCADE, user_id FK CASCADE, PK (board_id, user_id)
board_access_groups         board_id FK CASCADE, group_id FK CASCADE, PK (board_id, group_id),
                            INDEX (group_id)
```

Two grant tables rather than one polymorphic table: real foreign keys and cascades, no check
constraint, and each is a plain join.

**Application:** one port method, `BoardAccessLookup.visibleBoardIds(organizationId, userId)`,
implemented as a single SQL query (Organization boards ∪ created-by ∪ direct grants ∪ group
grants). A `BoardVisibility` helper in `packages/application/src/boards` returns `all` for Org
Admin / direct Site Admin, otherwise the id set. Services pass the set into repository filters
(`boardIds`) and check single items with `ensureCanSeeBoard(boardId)` → `NotFoundError`. Computed
at most once per request (request-scoped memo on the existing `AsyncLocalStorage` context).

**Rejected:** (a) every board needs grants — forces a migration and per-board admin on every
customer; (b) a redacted placeholder — leaks titles' existence and needs a second rendering on
every surface; (c) per-grant levels — every edit check would consult grants. All three were put to
the owner 2026-10-26.

## Requirement → task → evidence map

| Req | Slice | Evidence |
|---|---|---|
| BAG-1 | 349 | `GroupService` tests; groups API tests × 4 roles |
| BAG-2 | 350 | `BoardService.setAccess` tests; access route tests; migration assertion |
| BAG-3 | 350 | visibility table test; membership-change test |
| BAG-4a,b | 351 | leak matrix: by-id reads and writes |
| BAG-4c–h | 352 | leak matrix: lists, counts, pickers, references, notifications, import |
| BAG-5 | 351, 352 | golden replay recorded; `pnpm check` |
| BAG-6 | 354–356 | comp approved; web tests; Playwright spec; browser check |

## Slice plan

Sequential except where noted. Each backend slice starts with failing tests for its requirements.

| Slice | Role | Outcome | Owns | Depends on |
|---|---|---|---|---|
| **348** | Spec | This file; decision entry; contract sections *Groups* (new `contracts/groups.md`) and *Board access* in `contracts/boards.md`, marked proposed; inbox entry removed; tracker row; pointer in the MCP spec | `SPEC/` | — |
| **349** | Backend | Groups: migration for `user_groups`, `user_group_members`; domain `Group` (name rules); `GroupService`; routes `GET/POST /organizations/{orgId}/groups`, `GET/PUT/DELETE /groups/{id}`, `PUT /groups/{id}/members`; audit; demo seed adds one group per org | domain `groups`, application `groups`, infrastructure repo + migration, api `groups.controller.ts` | 348 |
| **350** | Backend | Visibility: migration for `boards.visibility` and both grant tables; `visibleBoardIds` port + SQL; `ensureCanSeeBoard`; board list/get filtered and 404; `PUT /boards/{id}/access`; create accepts access fields; audit | application `boards`, infrastructure board repo, api boards controller | 349 |
| **351** | Backend | By-id chokepoint: every idea/Issue/task read and write resolves the item's board and calls `ensureCanSeeBoard` (comments, upvotes, following, fields, dependencies, issue tasks, delivery) | application services that load an idea by id | 350 |
| **352** | Backend | Lists and aggregates: thread `boardIds` through idea list/search, Home, notifications, backlog, `/tasks`, sprints, outcomes/roadmap counts, pull candidates, references lanes, CSV import/export, mention/assignee candidates and validation | the matching repositories and services | 351 (same files touched; not parallel) |
| **353** | QA | Leak matrix API suite (BAG-4) and visibility table (BAG-3); golden replay, differences recorded | `apps/api` tests, `tools/golden` notes | 352 |
| **354** | UI/UX | Throwaway comp: Settings → Groups and the board Access section; owner approves | `SPEC/mockups/comp-*-board-access.html` | 348 (may run beside 349–353) |
| **355** | UI | Settings → Groups page and drawer; board form Access section; lock marks | `apps/web` | 350, 354 |
| **356** | QA | Web unit tests; `e2e/tests/restricted-board.spec.ts`; browser check | `apps/web` tests, `e2e/` | 355 |

Code Reviewer gates each slice before it merges into `dev`.

## Verification commands

```bash
pnpm --filter @collega/infrastructure db:migrate
pnpm --filter @collega/infrastructure db:seed
pnpm --filter @collega/application test
pnpm --filter @collega/api test
pnpm check
pnpm test:e2e -- restricted-board
```

## Assumptions and open points

- **Settled with the approval (2026-10-26):** the board's creator always sees it, even if left off
  the list; if the creator is deleted, only Org Admins and the list remain. Groups and their members
  are listed to every member (1b).
- **Open, non-blocking:** whether the Restricted board's lock mark tells non-admins *who* has
  access (the access list is visible to anyone who can see the board as proposed).
- **Open, non-blocking:** public portal targeting a Restricted board — no portal exists yet; decide
  when one is specified.
