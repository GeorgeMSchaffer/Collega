# Feature: Issues and Delivery (Idea → Execution)

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** Slice 1 (P0) promotion, Sprints, Tasks; Slice 2 (P1) Outcomes/Roadmap, backend unbuilt.
> - **Key rules:** an Issue is the same row as its Idea, in Delivery phase; promotion is an explicit gate
>   with `Effort` required, re-promote `409`; delivery statuses fixed, Pending→Complete; completing a sprint
>   returns unfinished Issues to the backlog; Tasks are a checklist, never block Complete, are not audited;
>   an Issue sits under at most one Outcome; a Site Admin mutates only through View As.
> - **Contracts:** contracts/delivery.md, contracts/sprints.md, contracts/issue-tasks.md
> - **Decisions:** 2026-09-02 "Outcome ↔ Issue cardinality: single-parent";
>   2026-09-28 "Starting a sprint, a single-Issue read, the Roadmap's sprint rows, and tag audit events";
>   2026-09-11 "The S0.2 schema freeze is amended once, for Issues-and-Delivery Slice 1"

## Overview

- **The gap:** an idea is proposed, debated, upvoted, tagged and reaches a terminal ideation status (`Complete`); *building the thing* then happens elsewhere (a spreadsheet, Jira, nothing), That handoff is where every competitor loses the story: the moment an idea becomes committed work, its provenance (proposer, upvotes, debate, business case) is retyped away.
- **The fix:** promote the idea into a lightweight delivery track — Sprints and Issues with just enough Agile ceremony — **inside Collega**, **without creating a second object**. An Issue is the same row in a later *phase*: promotion flips **Discovery** (ideation on a board) to **Delivery** (execution in a sprint), carrying its history forward. The differentiator is **provenance-preserving delivery**, not "we also do sprints": mid-sprint, "why are we building this?" is one click away.
- Covers the Roadmap → Sprint → Issue concept captured in `SPEC/Bug Triage.md` (IDEAS), in two slices:
  - **Slice 1 — Delivery (P0).** The phase model, the promotion gate, Sprints, the fixed delivery statuses, provenance, and **Tasks** (a checklist on an Issue). This is the buildable unit.
  - **Slice 2 — Roadmap (P1).** **Outcomes**: theme grouping over time, *beside* sprints as a lens, not above them as a container. Specified so the domain shape is settled; sequenced after Slice 1. The one question that gated it — Outcome ↔ Issue cardinality — is **decided: single-parent** (see [Design Decisions](#design-decisions-interview-resolved)).
- **Explicitly deferred:** the Impact×Effort prioritization view, crowd-backlog auto-surfacing, AI-assisted promotion (see [Non-Goals](#non-goals) and [Future Considerations](#future-considerations-p1p2)).
- **Guardrail:** every field and screen must earn its place by *closing the loop* or *preserving provenance*, never by matching a Jira feature.

> **Reconciled 2026-08-31.** Tasks and Roadmap were Non-Goals in the 2026-08-10 interview resolution. Review of the delivery comps (`SPEC/mockups/comp-l-delivery-desk.html`) found that without a task checklist a team cannot *run* the sprint, and that "what are we trying to achieve this quarter" had no home in the product; the product owner brought both into scope. Design Decisions below record the agreed shape; the Non-Goals were narrowed from "not now" to "not ever, and here is the line".

---

## Design Decisions (Interview-Resolved)

| Decision | Resolution |
|---|---|
| Execution model | **Native lightweight delivery** inside Collega (not integrate-and-hand-off to Jira). Chosen 2026-08-10. |
| Idea vs Issue relationship | **Same object, two phases.** An Issue is a Delivery-phase Idea — the same row, not a new entity. Preserves provenance; no handoff data loss. |
| Phase model | An item is in exactly one `Phase`: `Discovery` (default) or `Delivery`. Promotion flips Discovery → Delivery. |
| Promotion trigger | An **explicit "Promote to Issue" decision gate**, *not* an ideation status. Overloading `Complete` to also mean "committed to delivery" is rejected as the source of the concept's awkwardness. |
| Relationship to deferred Approval Workflow | The promotion gate **is** the post-MVP approval gate deferred in `SPEC/20-feature-ideas-and-engagement.md` and `SPEC/20-feature-boards-and-statuses.md`. One build, two features. |
| Two status systems | Ideation statuses (org-configured swimlanes) govern **Discovery**; a **fixed** delivery status set governs **Delivery**. They never mix; both are retained for history. |
| Delivery statuses | Fixed enum: `Pending`, `Scoping`, `Development`, `Review`, `Complete` (from the captured concept). Not org-configurable in this slice. |
| Effort | `Effort` (`Low`/`Medium`/`High`) lands on the **Idea** as an optional Discovery field, **required at the promotion gate**. T-shirt sizing, deliberately *not* story points. |
| Per-issue dates | **Dropped.** The sprint boxes the dates; per-issue dates inside a dated sprint create "which date wins" conflicts and is not how Agile scopes work. Dates live on Sprints (and, later, Roadmap items). |
| Sprint ↔ Roadmap nesting | Sprint is **not** nested under Outcome, now or in Slice 2: a flat, time-boxed container; an Issue belongs to zero or one Sprint. An Outcome *groups* Issues; it does not own them and has no authority over sprint membership. Reaffirmed 2026-08-31. |
| Task model | **Tasks are checklist items on an Issue**, not first-class work items — no sprint of their own, no dates, no estimate. Decided 2026-08-31. The Issue is the unit that moves between sprints, so a task is never stranded in a sprint its parent left. First-class independently-assignable tasks were rejected: too heavy for "Jira light", and they reintroduce the two-object problem the phase model avoids. |
| Task assignee | Optional; **need not** be an assignee of the parent Issue — any active user in the org qualifies. The one place delivery work is divided between people; constraining it would force spurious Issue assignments to name a helper. |
| Task state | Three states (`NotStarted`, `InProgress`, `Done`), not a checkbox, because "started but not finished" is what a standup asks about. The `N of M done` rollup counts only `Done`. |
| Roadmap model | An **Outcome** is a named, dated theme Issues are grouped under — a lens, not a container. Every rollup (issue count, done count, sprint span, quarter placement) is **derived** at read time, never stored. No status field, no percent-complete field. |
| Outcome ↔ Issue cardinality | **Decided 2026-09-02 — single-parent.** An Issue sits under **at most one** Outcome (`Idea.OutcomeId`, nullable), so roadmap arithmetic is honest by construction: counts partition the delivery set, totals sum, and "done" is unambiguous without a distinct-count anywhere. Rendered in `SPEC/mockups/comp-m-roadmap-single.html`; `comp-n-roadmap-multi.html` records the rejected multi-parent alternative. **Nothing in Slice 1 depended on this.** |
| Sprint lifecycle | Explicit `Planned` → `Active` → `Completed` transitions (actions, not date-derived), because completing a sprint must handle carry-over deterministically. |
| Provenance | Nearly free because Issue *is* the Idea. The only new stored provenance fields are `PromotedAtUtc`, `PromotedByUserId`, and an `UpvoteCountAtPromotion` snapshot ("how much support did this have when we committed"). |
| Board filtering | The ideation board (`/board/{boardId}`) filters to `Phase == Discovery`; promoted items leave it (the row and its idea status are retained). Delivery items render on a new **Sprint board**. |
| Backward compatibility | All existing ideas backfill to `Phase = Discovery`; delivery views start empty; ideation boards are unchanged. |

---

## Problem Statement

An idea in Collega has a rich life — proposal, discussion, upvotes, business-impact classification — and then falls off a cliff. There is no supported way to *act* on an approved idea, so teams either recreate it by hand in another tool (losing all context) or let it die from lack of follow-through. Neither Trello (execution-only, no ideation) nor Jira (execution-heavy, ideation is a bolted-on separate product with a lossy handoff) closes this loop with the idea's history intact. Collega's stated purpose is "submitting, tracking, and **improving** process ideas" — improvement implies execution, and execution is exactly what's missing.

---

## Goals

1. **Close the loop natively.** An approved idea can become committed delivery work inside Collega, executed in lightweight time-boxed sprints, without leaving the tool or retyping anything.
2. **Preserve provenance end to end.** From inside a sprint, a viewer can trace an Issue back to the original idea, its proposer, its upvotes at promotion (and now), its business-impact rationale, and its full comment debate — with zero manual bookkeeping.
3. **Make the commitment a deliberate, auditable decision.** Promotion is an explicit gate with a clear actor, timestamp, and audit event — doubling as the deferred approval workflow.
4. **Stay lightweight on purpose.** Just enough Agile to run a sprint — no story points, velocity, burndown, or per-issue Gantt. Tasks are a flat checklist, not a second issue tracker; Outcomes are a grouping lens, not a work-breakdown structure. Ceremony is a Non-Goal until real usage demands it.
5. **Zero disruption to existing behavior.** Orgs that never promote anything see exactly today's product; ideation boards, ideas, and all existing flows are unchanged.
6. **Make the sprint runnable and the quarter legible.** An Issue can be broken into the concrete steps that finish it, and a quarter's Issues can be grouped under the outcome they serve — without either mechanism becoming a tracker in its own right.

---

## Non-Goals

- **A separate `Issue` entity/table.** A parallel object would reintroduce the provenance loss this feature solves.
- **Outcomes that own Issues, or Sprints nested under Outcomes.** An Outcome groups; it never contains. Sprint and outcome membership are independent. Deleting an Outcome never touches an Issue.
- **Dates, status, or progress fields stored on an Outcome.** Only its own target window is stored; progress, issue counts and sprint span are *derived*. No outcome-level status enum, no percent-complete column, no outcome-to-outcome dependency link.
- **Epics as a third phase.** An Outcome is not a phase or work item: never on a board, no delivery status, cannot be promoted, assigned, or commented on.
- **The Impact × Effort prioritization quadrant** and **crowd-backlog auto-surfacing** ("top-voted ideas not yet promoted"). The enabling fields land now (`Effort`, `Phase`); the views are deferred (P1).
- **AI-assisted promotion** (drafting acceptance criteria / task breakdown from the idea + comments). Deferred (P1); it rides the existing Haiku extraction pattern when built.
- **Story points, velocity, burndown/burnup, capacity planning.** Deferred (P2), gated behind demonstrated demand. `Effort` stays T-shirt sizing.
- **First-class sub-issues.** A Task has no sprint, dates, estimate, comments, upvotes, tags, nesting, or promotion path; anything needing one is an Issue. Task counts must not be surfaced as a velocity or capacity proxy (see the story-points Non-Goal).
- **Per-issue start/end dates and cross-issue dependencies.** Dropped by design.
- **Org-configurable delivery statuses.** Fixed in this slice.
- **Integrate/export to external trackers (Jira, etc.).** The direction is native; an export/link path is out of scope.

---

## Terminology

| Term | Meaning |
|---|---|
| **Idea** | An item in `Discovery` phase. Unchanged from today. |
| **Issue** | The *same* item after promotion, in `Delivery` phase. User-facing "Issue" vocabulary is a lens/label on a Delivery-phase Idea, not a new record. |
| **Promote** | The explicit gate that flips an item Discovery → Delivery. |
| **Sprint** | A time-boxed container that Issues are pulled into for execution. |
| **Delivery backlog** | Delivery-phase items not yet assigned to a Sprint (`SprintId is null`). |
| **Task** | A checklist step on an Issue. Ordered, optionally assigned, in one of three states. Exists only as a child of its Issue and moves with it. |
| **Outcome** | A named, dated theme that Issues are grouped under (Slice 2). A reporting lens — "what are we trying to achieve" — not a container. |

---

## User Stories

**Admin / Lead (OrgAdmin / SiteAdmin)**
- As an admin, I want to promote a fleshed-out idea into an Issue so my team can commit to building it, with the decision recorded.
- As an admin, I want to create a sprint with a goal and a date window and pull Issues into it, so the team has a focused, time-boxed workload.
- As an admin, I want to start and complete a sprint, with unfinished Issues returning to the backlog, so carry-over is explicit rather than lost.
- As an admin, I want to return a mis-promoted item to Discovery so an accidental commitment is recoverable.

**Idea author (User)**
- As the author of an idea, I want to promote it to an Issue (or request its promotion) so my idea doesn't die after it's approved.
- As an assignee, I want to move my Issue through delivery statuses on the sprint board so progress is visible.

**Delivery viewer (User / ReadOnly)**
- As anyone looking at an Issue, I want to see where it came from — the original idea, who proposed it, its upvotes, and the discussion — so I understand *why* we're building it without leaving the screen.
- As a stakeholder, I want the sprint board to show what's committed and in-flight so I can see delivery at a glance.

---

## Domain Model

### Modified entity: `Idea` — gains delivery facets, no new row

`Idea` already carries `IdeaTypeId`, `BusinessImpactId`, assignees, tags, comments, upvotes, and an ideation `StatusId` (verified against `dev`). This feature adds a **phase** and its delivery facets to the *same* entity.

New facets on the existing idea (no new table — the Issue IS the Idea): `packages/domain/src/ideas/idea.ts`, stored on the `ideas` table in `packages/infrastructure/prisma/schema.prisma`.
- `phase` — `Discovery` (default) or `Delivery`.
- `effort` — optional in Discovery; required at promotion.
- `deliveryStatus` — null in Discovery; `Pending` on promotion.
- `sprintId` — nullable; null is the delivery backlog (only meaningful in Delivery).

Provenance snapshot (the only genuinely new provenance storage):
- `promotedAtUtc` — nullable timestamp.
- `promotedByUserId` — nullable user id.
- `upvoteCountAtPromotion` — nullable integer.

Invariant functions, matching the existing idea mutators (each takes the clock's `nowUtc` and the actor's id): `promoteIdeaToIssue` (effort, optional sprint, current upvote count) — `PromoteToIssue` below; `returnIdeaToDiscovery` — `ReturnToDiscovery`; `changeIdeaDeliveryStatus` (target) — `ChangeDeliveryStatus`; `assignIdeaToSprint` (optional sprint) — `AssignToSprint`.

Invariants:
- `PromoteToIssue` is valid only from `Phase == Discovery`; sets `Phase = Delivery`, `DeliveryStatus = Pending`, records `Effort`, `PromotedAtUtc`, `PromotedByUserId`, `UpvoteCountAtPromotion`. Re-promoting a Delivery item is rejected.
- `ChangeDeliveryStatus` and `AssignToSprint` are valid only from `Phase == Delivery` (else `409`/`400`).
- `ReturnToDiscovery` flips `Phase = Delivery → Discovery`, clears `SprintId` and `DeliveryStatus`, and **retains** `Effort` and the promotion snapshot, so a re-promote and the audit trail stay coherent.
- The **ideation `StatusId` is never cleared** by promotion — frozen at its last Discovery value for provenance. Ideation `Complete` and delivery `Complete` are distinct terminal states; both are retained.

### New enums (`packages/domain/src/enums`)

- `IdeaPhase`: `Discovery`, `Delivery`
- `EffortLevel`: `Low`, `Medium`, `High`
- `DeliveryStatus`: `Pending`, `Scoping`, `Development`, `Review`, `Complete`
- `SprintState`: `Planned`, `Active`, `Completed`

Stored as their names; the .NET stack's integer values (in the order listed, from 0) are history.

### New entity: `Sprint` (auditable)

Org-scoped, soft-deletable, time-boxed. A flat container in this slice (no Roadmap parent). `packages/domain/src/sprints/sprint.ts`:
- `organizationId`
- `name` — required, non-empty, max 100 characters
- `goal` — optional, max 500 characters
- `startDate`, `endDate` — dates; `endDate` must be on or after `startDate`
- `ownerUserId` — optional; an active user in the same org
- `state` — `Planned` → `Active` → `Completed`
- `isDeleted`

Operations: create, update, start, complete, soft-delete — factory and invariant functions.

Invariants:
- `EndDate >= StartDate`; `Name` trimmed and non-empty (uniqueness **not** required — "Sprint 12"-style names may repeat across time).
- `Start()` requires `State == Planned` → `Active`. `Complete()` requires `State == Active` → `Completed`.
- On `Complete()`, every assigned Issue whose `DeliveryStatus != Complete` returns to the delivery backlog (`SprintId = null`). Carry-over-to-next-sprint is a P1 refinement.
- `OwnerUserId`, when set, must be an active user in the sprint's organization (validated in the Application layer, like assignee validation).

Issue ↔ Sprint is a simple nullable FK on `Idea` (`SprintId`); an Issue belongs to zero or one Sprint. No join entity.

### New entity: `IssueTask` (auditable) — Slice 1

A checklist step belonging to exactly one Issue. Org scope is inherited through the parent Idea and **not** duplicated on the row: every query reaches tasks through their Idea, so the org-scoping on `Idea` stays the single enforcement point.

`packages/domain/src/issue-tasks/issue-task.ts`:
- `ideaId` — required; the parent Issue
- `title` — required, non-empty, trimmed, max 200 characters
- `assigneeUserId` — optional; any active user in the parent's org
- `state` — `NotStarted` (default), `InProgress` or `Done`
- `sortOrder` — dense 0..n-1 within the parent Issue
- `completedAtUtc`, `completedByUserId` — nullable

Operations: create, rename, assign, change state, reorder — factory and invariant functions.

Invariants:
- `Title` is trimmed and non-empty; `SortOrder` is dense and contiguous within the parent, maintained on insert, delete, and reorder.
- `ChangeState(Done)` stamps `CompletedAtUtc`/`CompletedByUserId`; moving *off* `Done` clears both. The stamps are the only completion record — no per-task history.
- Tasks may only be created on an Idea whose `Phase == Delivery` (`400` otherwise): a task list is a delivery artifact.
- `ReturnToDiscovery` **retains** tasks (hidden, not deleted) so a re-promote is lossless — like `Effort` and the promotion snapshot.
- Deleting a Task is a hard delete; no soft-delete or audit trail on a checklist item.
- **Tasks never block a status change.** An Issue may be set to `Complete` with tasks outstanding; the UI warns, the domain permits. Enforcing "all tasks done" would make the checklist a gate — ceremony this feature refuses.

### New entity: `Outcome` (auditable) — Slice 2

Org-scoped, soft-deletable, dated. A grouping lens over Issues.

Not built (Slice 2); the shape it will take:
- `organizationId`
- `name` — required, non-empty, max 120 characters
- `description` — optional, max 1000 characters
- `targetStartDate`, `targetEndDate` — dates; `targetEndDate` must be on or after `targetStartDate`
- `ownerUserId` — optional; an active user in the same org
- `sortOrder` — row order on the roadmap grid
- `color` — `#RRGGBB`; added 2026-09-28 (comp R)
- `isDeleted`

Operations: create, update, reorder, soft-delete — factory and invariant functions.

Invariants:
- `TargetEndDate >= TargetStartDate`. The window is the Outcome's *intent*; the derived sprint span on the roadmap comes from grouped Issues and may disagree — that disagreement is the signal the view surfaces, not an error to reconcile.
- Soft-deleting an Outcome **never touches an Issue**; it only removes the grouping.
- No status, no percent-complete, and no `SprintId` — an Outcome is orthogonal to sprints.
- **`Color` (added 2026-09-28, comp R)** — the colour of the Outcome's roadmap bar, swatch and derived sprint-span line. Required; a new Outcome takes a random colour from the tag palette (`20-feature-ideas-and-engagement.md` Tags rule 9) unless one is chosen, and like a tag may be any `#RRGGBB` (answered 2026-09-28 for tags; outcomes follow). Presentation data, not a status: it says nothing about progress.
  - **For when Outcomes are built:** comp R labels the bar with dark text (`#0F1113`), which the ten palette colours clear (4.8:1 or better, measured 2026-09-28) but a custom colour may not — so the bar's label must be computed like a tag chip's text (dark or light, whichever clears 4.5:1), and the backend slice's QA asserts it.

**Outcome ↔ Issue linkage is single-parent** (resolved 2026-09-02). An Issue carries `Idea.OutcomeId` (nullable FK). Grouping is a **move**, not an add: a new Outcome clears the old one; clearing leaves the Issue ungrouped. What the rejected shape would have cost, so it is not re-argued:

| | Single-parent (**chosen**) | Multi-parent (rejected) |
|---|---|---|
| Storage | `Idea.OutcomeId` (nullable FK) | `idea_outcomes` join table (`idea_id`, `outcome_id`, PK on both) |
| Rollup arithmetic | Counts partition; totals sum to the delivery set | Counts overlap; every total needs a distinct-count beside it |
| Reassignment | A move (leaves the old outcome) | An add/remove (may belong to both) |
| Comp | `comp-m-roadmap-single.html` | `comp-n-roadmap-multi.html` |

The cost is real: work that genuinely serves two quarterly goals must pick one. Watch for **teams raising duplicate Issues** so two Outcomes can each claim the work — that reintroduces the provenance loss the phase model prevents. If it appears, single → multi is a cheap forward migration (copy the FK into the join table, drop the column); the reverse is lossy.

### New enums (Slice 1 / Slice 2)

- `IssueTaskState` (Slice 1): `NotStarted`, `InProgress`, `Done` — stored as names, like the enums above.

---

## Application Layer

### New service: `SprintService` (`packages/application/src/sprints/sprint.service.ts`)

Admin-only (an in-scope OrgAdmin, or a SiteAdmin acting through View As), mirroring existing org-scoped admin services' `ensureAdminScope` authorization, which refuses a direct SiteAdmin (`ensureNotDirectSiteAdmin`).

| Method | Purpose |
|---|---|
| `ListAsync(orgId, state?)` | List sprints for the org, optionally filtered by state |
| `GetAsync(orgId, id)` | One sprint with its assigned Issues (delivery cards) |
| `CreateAsync(orgId, cmd)` | Create a `Planned` sprint (name, goal, dates, owner) |
| `UpdateAsync(orgId, id, cmd)` | Rename/goal/dates/owner (allowed while `Planned` or `Active`; dates locked after `Completed`) |
| `StartAsync(orgId, id)` | `Planned → Active` |
| `CompleteAsync(orgId, id)` | `Active → Completed`; unfinished Issues → backlog |
| `DeleteAsync(orgId, id)` | Soft-delete; assigned Issues are first unassigned to the backlog (no Issue is deleted) |

### Idea/Issue delivery operations (extend `IdeaService`)

- **Promote:** `PromoteIdeaAsync(ideaId, effort, sprintId?, note?, actor)`. Authorizes the author or an in-scope admin, reads the current upvote count, calls `Idea.PromoteToIssue(...)`, emits a promotion audit event and notifications (below). A supplied `sprintId` must be a non-`Completed` sprint in the same org.
- **Return to Discovery:** `ReturnIdeaToDiscoveryAsync(ideaId, actor)` — admin-only; emits an audit event.
- **Change delivery status:** `ChangeDeliveryStatusAsync(ideaId, target, actor)` — the author, an assignee, or an in-scope admin; emits audit + notification (author + assignees, self-suppressed).
- **Assign to sprint:** `AssignIssueToSprintAsync(ideaId, sprintId?, actor)` — admin-only in this slice; emits an audit event. Target sprint must be a non-`Completed` sprint in the same org, or `null` for backlog.
- **Delivery queries:** a phase-aware list for the sprint board and backlog — `ListDeliveryAsync(orgId, sprintId? , deliveryStatus?)` returning the compact card projection plus `deliveryStatus`, `effort`, `sprint`, a `taskSummary` (`{ done, total }`), and provenance summary.

### New service: `IssueTaskService` (`packages/application/src/issue-tasks/issue-task.service.ts`) — Slice 1

Authorization mirrors `ChangeDeliveryStatusAsync`: the idea author, any Issue assignee, or an in-scope admin. Read: any org member who can see the Issue. Every method resolves and authorizes against the parent Idea first — tasks carry no independent scope.

| Method | Purpose |
|---|---|
| `ListAsync(ideaId, actor)` | Ordered tasks for an Issue |
| `CreateAsync(ideaId, cmd, actor)` | Append a task (`title`, optional `assigneeUserId`); rejects if the parent is not `Delivery` |
| `UpdateAsync(taskId, cmd, actor)` | Rename and/or reassign |
| `ChangeStateAsync(taskId, state, actor)` | `NotStarted` / `InProgress` / `Done`; stamps or clears completion |
| `ReorderAsync(ideaId, orderedTaskIds, actor)` | Rewrite `SortOrder` densely; the full id set must match exactly |
| `DeleteAsync(taskId, actor)` | Hard delete, then re-densify `SortOrder` |

### New service: `OutcomeService` — Slice 2, not built

Admin-only for management (an in-scope OrgAdmin, or a SiteAdmin through View As); read for all org members. Mirrors `SprintService` authorization exactly.

| Method | Purpose |
|---|---|
| `ListAsync(orgId)` | Outcomes in `SortOrder`, each with its derived rollup |
| `GetAsync(orgId, id)` | One outcome with its grouped Issues |
| `CreateAsync(orgId, cmd)` | Create (name, description, target window, optional owner) |
| `UpdateAsync(orgId, id, cmd)` | Rename / re-describe / re-window / reassign owner |
| `ReorderAsync(orgId, orderedIds)` | Roadmap row order |
| `DeleteAsync(orgId, id)` | Soft-delete; grouped Issues are ungrouped, never deleted |
| `SetIssueOutcomeAsync(ideaId, outcomeId?)` | Sets or clears the Issue's single Outcome. A null `outcomeId` ungroups it; a new one replaces any existing grouping. |
| `GetRoadmapAsync(orgId, granularity)` | The roadmap grid: outcomes × time buckets (quarters or sprints), with derived spans. *Superseded 2026-09-28 (comp R): the client draws the time axis at the zoom the viewer picks (Weeks, Months, Quarters), so the read takes no granularity — it returns every outcome with its window, colour and grouped Issues (key when one exists, title, delivery status, effort, assignees, sprint dates), and the derived sprint span. See "Client UI" below.* |

Rollups (`issueCount`, `doneCount`, derived sprint span, quarter placement) are computed in the query, never stored. Because grouping is single-parent they are plain counts: no distinct-count, and per-outcome totals sum to the delivery set.

### Board & idea-list phase filtering

- Ideation board queries add `Phase == Discovery` (promoted items drop off without data loss).
- The global `/ideas` list gains an optional `phase` filter (`All` default / `Ideas` / `Issues`) so search and provenance span both phases.

---

## API Endpoints

All under `/api/v1`, org-scoped, following existing conventions and problem-details errors.

### Promotion & delivery operations (on the idea/issue)

| Method | Route | Body | Permission |
|---|---|---|---|
| `POST` | `/ideas/{ideaId}/promote` | `{ "effort": "Medium", "sprintId": "<guid|null>", "note": "<optional>" }` | Author or in-scope admin |
| `POST` | `/ideas/{ideaId}/return-to-discovery` | — | In-scope admin |
| `PUT` | `/ideas/{ideaId}/delivery-status` | `{ "deliveryStatus": "Development" }` | Author, assignee, or in-scope admin |
| `PUT` | `/ideas/{ideaId}/sprint` | `{ "sprintId": "<guid|null>" }` | In-scope admin |

`effort` is **required** on `promote`. Promoting an already-Delivery item → `409`. A delivery-status or sprint change on a Discovery item → `400`.

### Sprints (Admin only for management; read available to all org members)

| Method | Route | Description |
|---|---|---|
| `GET` | `/organizations/{orgId}/sprints` | List sprints (`?state=Active`) |
| `POST` | `/organizations/{orgId}/sprints` | Create a `Planned` sprint |
| `GET` | `/organizations/{orgId}/sprints/{id}` | Sprint with its Issues |
| `PUT` | `/organizations/{orgId}/sprints/{id}` | Update name/goal/dates/owner |
| `POST` | `/organizations/{orgId}/sprints/{id}/start` | `Planned → Active` |
| `POST` | `/organizations/{orgId}/sprints/{id}/complete` | `Active → Completed`; unfinished Issues → backlog |
| `DELETE` | `/organizations/{orgId}/sprints/{id}` | Soft-delete; assigned Issues → backlog first |

### Delivery board / backlog query

| Method | Route | Description |
|---|---|---|
| `GET` | `/organizations/{orgId}/delivery` | Delivery cards (`?sprintId=`, `?deliveryStatus=`; omit `sprintId` for the backlog) |

### Tasks (Slice 1) — nested under the Issue that owns them

| Method | Route | Body | Permission |
|---|---|---|---|
| `GET` | `/ideas/{ideaId}/tasks` | — | Any org member who can view the Issue |
| `POST` | `/ideas/{ideaId}/tasks` | `{ "title": "...", "assigneeUserId": "<guid|null>" }` | Author, assignee, or in-scope admin |
| `PUT` | `/ideas/{ideaId}/tasks/{taskId}` | `{ "title": "...", "assigneeUserId": "<guid|null>" }` | Author, assignee, or in-scope admin |
| `PUT` | `/ideas/{ideaId}/tasks/{taskId}/state` | `{ "state": "InProgress" }` | Author, assignee, or in-scope admin |
| `PUT` | `/ideas/{ideaId}/tasks/order` | `{ "taskIds": ["<guid>", "..."] }` | Author, assignee, or in-scope admin |
| `DELETE` | `/ideas/{ideaId}/tasks/{taskId}` | — | Author, assignee, or in-scope admin |

- Creating a task on a `Discovery` item → `400`.
- A `taskId` whose parent is not `{ideaId}` → `404` (never `403`, so the route cannot probe for ideas in other orgs).
- A reorder whose id set does not exactly match the Issue's tasks → `400`.

### Outcomes (Slice 2) — Admin only for management; read available to all org members

| Method | Route | Description |
|---|---|---|
| `GET` | `/organizations/{orgId}/outcomes` | List outcomes with derived rollups |
| `POST` | `/organizations/{orgId}/outcomes` | Create an outcome |
| `GET` | `/organizations/{orgId}/outcomes/{id}` | One outcome with its grouped Issues |
| `PUT` | `/organizations/{orgId}/outcomes/{id}` | Update name/description/window/owner |
| `PUT` | `/organizations/{orgId}/outcomes/order` | Roadmap row order |
| `DELETE` | `/organizations/{orgId}/outcomes/{id}` | Soft-delete; grouped Issues are ungrouped |
| `GET` | `/organizations/{orgId}/roadmap` | Roadmap grid (`?granularity=quarter|sprint`) — *granularity superseded 2026-09-28: the client draws the axis; see `GetRoadmapAsync`* |
| `PUT` | `/ideas/{ideaId}/outcomes` | Set an Issue's outcome grouping — body `{ "outcomeId": <guid|null> }`; null ungroups |

---

## Audit & Notifications

Reuses the existing audit-event and `NotificationWriter` patterns (`SPEC/20-feature-notifications.md`); self-notifications remain suppressed.

- **Audit events** (new types): `IdeaPromotedToIssue`, `IssueReturnedToDiscovery`, `IssueDeliveryStatusChanged`, `IssueSprintAssignmentChanged`, `SprintCreated`, `SprintStarted`, `SprintCompleted`, `SprintUpdated`, `SprintDeleted`. Slice 2 adds `OutcomeCreated`, `OutcomeUpdated`, `OutcomeDeleted`, `IssueOutcomeGroupingChanged`.
- **Task mutations are deliberately NOT audited** — a conscious asymmetry with every other mutation here. A checklist ticked a dozen times a day would drown the log that answers "who committed us to this work"; `CompletedAtUtc`/`CompletedByUserId` on the row are the only record that matters.
- **Notification events** (new types, notify idea author + assignees): `IdeaPromoted` and `IssueDeliveryStatusChanged`. Stored canonical link `/ideas/{ideaId}` (drawer-addressable, the same item), per the notifications spec. *Superseded in part 2026-10-01 (`decisions.md`, "Following an idea, and an in-app notification inbox"): both notify the idea's **followers** instead — the author and assignees follow automatically (`20-feature-idea-following.md` rule 11; the delivery-status move is a default awaiting confirmation there).*
- **Task assignment notifies the new assignee only** (`IssueTaskAssigned`, self-suppressed, link `/ideas/{ideaId}`). No other task event notifies anyone — ticking a box must not page the room.

---

## Client UI (later wave, per repo convention)

Layouts here are **directional**; the locked Comp C system (`SPEC/mockups/comp-c-review-06-lockin-v5-final.html`) and its mobile gap apply. Throwaway review comps precede production UI per the working rules.

- **Promotion action** on Idea Detail: "Promote to Issue" (visible to author + in-scope admins on Discovery-phase items) opens a confirm dialog — required **Effort** selector, optional **Sprint** picker (or "Backlog"), optional note — then flips the page into its Issue/Delivery lens.
- **Issue/Delivery lens** on the same detail page: ideation Type is read-only context; a **Provenance panel** shows "Originated as an idea by *X* on *date* · *N* upvotes at promotion (*M* now) · promoted by *Y* on *date*", with the original comment thread inline. This panel is the differentiator and ships in this slice.
- **Sprint board** (`/delivery` or `/sprints/{sprintId}`): fixed 5-swimlane kanban (`Pending`→`Complete`), Issue cards reusing the compact card with an `Effort` chip and delivery status. Drag between swimlanes mirrors the idea-board move (optimistic, revert on failure); keyboard/touch use the detail status selector — consistent with existing board mechanics. *Superseded in part 2026-09-28 by "Sprint board (comp R)" below: the Effort chip becomes the effort bar, and the page gains the sprint strip.*
- **Delivery backlog** view: Delivery-phase Issues with no sprint, the source list admins pull from.
- **Sprint admin**: create/edit/start/complete sprint; a rail "Delivery" (or "Sprints") destination is added to the 64px icon rail.
- **Task checklist** on the Issue/Delivery lens: ordered list under the description with an `N of M done` counter, per-row state control, optional assignee, drag-to-reorder, and inline "+ Add task". Rendered in `comp-l-delivery-desk.html` (Issue screen). Read-only viewers see the list and counter with no controls.
- **Roadmap** (`/roadmap`, Slice 2): outcomes as rows against a quarter or sprint axis, each with derived span, issue count and done count; selecting a row lists its Issues. Rendered in `comp-m-roadmap-single.html`, the chosen shape; `comp-n-roadmap-multi.html` is only the record of the rejected alternative — do not build from it. *Superseded 2026-09-28 by "Roadmap (comp R)" below: comp R replaces comp M as the shape, and the axis is Weeks, Months or Quarters. Single-parent grouping, derived rollups and "a lens, not a container" are unchanged.*
- **Ideation board** unchanged except that promoted items no longer appear (phase filter).

### Comp R iteration (2026-09-28)

- `SPEC/mockups/comp-r-portico-prototype.html` (screens *Sprint board* and *Roadmap*) is the reference from 2026-09-28 (`decisions.md`). The Layout note above no longer applies to these two screens: comp R is their decided layout, on the list and detail pattern and the forms and controls rules of `20-feature-client-ui.md`. The prototype's sprint, outcome and issue data are samples.
- **Issue keys are a gap.** Comp R labels every Issue with a key — `IDE-01`, `OPP-04`, a board prefix and a number — on sprint cards, roadmap rows and the outcome form. No such key exists: no column, `30-Contracts.md` records that a reference "needs a per-organization sequence and therefore a schema amendment slice", and the web app dropped comp Q's `CLG-114` for the same reason. **The key slot is left out** wherever comp R draws one, and nothing is derived from the id to fill it (answered 2026-09-28). Keys are decided separately, with their own schema amendment.

#### Effort bar (comp R)

- The effort bar (`20-feature-client-ui.md` "Tag colours and the effort bar") replaces the effort chip or dot on **every Issue card and row** — Sprint board cards, Backlog rows, each Issue row under an Outcome on the Roadmap — always with its words (*Medium effort*).
- On **idea cards and rows** (a board's lanes and list, and Ideas) it shows **whenever the idea has an `effort`** (answered 2026-09-28), which in Discovery is optional; without one, nothing, not an empty bar. The idea list items carry `effort` for it (`30-Contracts.md`).

#### Sprint board (comp R)

The page for the organization's running sprint (`/delivery/sprint`, as built).

- **Header:** the sprint's name as the H1 and *Goal: {goal}* as its description. On the right **Plan next sprint** and, while the sprint is `Active`, **Complete sprint** (primary). Both are an in-scope admin's; every other role sees them disabled with *Administrators only* (a Site Admin, the View As wording the delivery screens already use).
  - **Plan next sprint** opens the **Add New Sprint** form in the drawer (answered 2026-09-28; comp R does not draw it): **Name** (required, up to 100), **Goal** (optional, up to 500), **Start** and **End** (required dates, side by side; *On or after the start.*) and **Owner** (optional, an active member). *Create sprint* calls the existing `POST /organizations/{orgId}/sprints`; the new sprint is `Planned`, the drawer closes, a toast says *Sprint created*. API field errors sit beside their fields.
- **Sprint strip** under the header, a definition list of four cells with mono uppercase terms (stacking below 900px):
  - **STATE** — *ACTIVE* or *PLANNED* (the board shows the running sprint, or the next planned one when none is running), plus *{N} DAYS PAST END* in the warning colour while an Active sprint is past its end date, counted in the viewer's local calendar days;
  - **WINDOW** (*10–24 SEP*); **ISSUES** (*{n} · {d} DONE*);
  - **PROGRESS** — one segment per Issue, filled in the Complete colour when done, labelled *{d} of {n} done* for assistive technology.
- **Five lanes**, `Pending`, `Scoping`, `Development`, `Review`, `Complete`, each with its fixed delivery-status colour tinting the header and the count beside the name, in the board's lane style. An empty lane says *No issues*. Below 900px the lanes scroll sideways.
- **Card:** the Issue key *(gap — omitted, above)* and the assignees' avatars on the first line (a dashed *—* placeholder named *Unassigned* when there are none), the title, up to two coloured tag chips with *+N* for the rest (added 2026-09-28 to match `30-Contracts.md`'s Sprint board bullet; comp R draws none), then the effort bar with its words. Cards in `Complete` are dimmed but stay readable (4.5:1 still applies).
- **Moving an Issue** keeps the existing rule: drag between lanes (optimistic, revert on failure) by the author, an assignee or an in-scope admin, through `PUT /ideas/{ideaId}/delivery-status`; keyboard and touch use the status selector in the Issue's detail. A note under the lanes says who may move one.
- **Selecting a card** opens the Issue **in the drawer** over the board (answered 2026-09-28) — see "The Issue in the drawer" below.
- **Complete sprint** confirms first — *Complete this sprint? {N} unfinished issues return to the backlog. Completed issues stay with the sprint.* — then calls `POST /organizations/{orgId}/sprints/{sprintId}/complete` and reports *Sprint completed · {N} issues back in the backlog*.
- **No running sprint — Start sprint** (the user, 2026-09-28; comp R draws no Start control):
  - When no sprint is `Active`, the board shows the **next `Planned` sprint** — earliest start date, ties by name — with the same header, strip (*PLANNED*) and five lanes of its assigned Issues, and **Start sprint** as the primary action in place of *Complete sprint*, an in-scope admin's, disabled with the reason for every other role exactly as *Complete sprint* is.
  - It confirms first — *Start this sprint? "{name}" becomes the running sprint, {n} issues.* (Cancel focused first; the action is the primary button, not the danger one) — then calls the existing `POST /organizations/{orgId}/sprints/{sprintId}/start` and reports *Sprint started*. *Plan next sprint* stays beside it.
  - Only with no `Active` and no `Planned` sprint does the existing empty state show (how many Issues wait in the backlog, with *Plan next sprint*). If several sprints are `Active` (the API allows it), the board keeps today's behaviour and shows the first the sprint list returns.

#### The Issue in the drawer (answered 2026-09-28)

An Issue selected on the Sprint board, the Backlog or (once Outcomes exist) the Roadmap opens in the list and detail pattern's drawer, in view mode, over the screen it came from (`?idea={ideaId}`, as for ideas). Eyebrow *Issue · {sprint name or Backlog} · {delivery status}*, the title, then:

- **Delivery facts:** **Status** — a select of the five delivery statuses for the author, an assignee or an in-scope admin (saving through `PUT /ideas/{ideaId}/delivery-status`; the keyboard and touch path for moving a card), plain text for everyone else; **Effort** (the bar and its words); **Sprint** (name and window, or *Backlog*); **Outcome** (*Not grouped* until Outcomes exist); and the **Provenance** panel specified above (raised by, when, upvotes at promotion and now, promoted by and when).
- **Tasks:** the checklist with its *N of M done* counter and the controls already given to the author, assignees and admins; read-only for everyone else.
- **The idea's own content**, as the idea drawer shows it: Problem, Proposed solutions, Impact rationale, Summary, custom fields and the discussion.
- **Footer:** Edit (the idea form, as for ideas) where the role may edit.
- **Data:** the delivery card, `GET /ideas/{ideaId}` and `GET /ideas/{ideaId}/tasks`. From a board it uses the card in hand; from a **deep link** (`?idea={ideaId}` on a delivery screen) or **`/delivery/issues/{ideaId}`** (kept for existing links) the card comes from **`GET /ideas/{ideaId}/delivery`** — the single-Issue read the user added on 2026-09-28 (`30-Contracts.md`), replacing the web app's fetch of every sprint and the backlog to find one Issue.

#### Roadmap (comp R)

**Sprint 11 builds the screen, not the backend** (answered 2026-09-28: "UI now, backend later"). The Outcomes backend — Slice 2's table, entity, service, routes and roadmap read — is a gap for a later sprint (`30-Contracts.md` Delivery preamble; `decisions.md` 2026-09-28). So the Roadmap is built in two layers:

**What Sprint 11 shows, from data that exists.**

- **Header:** *Roadmap* and its description as below. **Add New Outcome** renders **disabled for every role with the reason** *Outcomes arrive in a later release* — an empty state's action is disabled with a reason, never omitted (`decisions.md` 2026-09-08). The breadcrumb's mono count is *{m} ISSUES*.
- **Zoom** exactly as below: Weeks, Months, Quarters, the fixed windows, no panning, no shortcuts.
- **Timeline** with the column header, the **TODAY** rule, and a **Sprints** group of rows — one per non-deleted sprint whose window meets the visible window (`GET /organizations/{orgId}/sprints`), ordered by start date.
  - Each row's label column holds the sprint's name; its bar runs start to end date, clipped to the window, labelled in mono *{d} / {n} DONE* from the sprint item's `doneCount` / `issueCount`. The bar is a tint with the theme's ink as its text (clears 4.5:1 in every theme).
  - An `Active` sprint has a primary-colour border and *ACTIVE* in its label; a `Planned` one is a dashed outline; a `Completed` one is muted. The Active sprint's bar links to the Sprint board; the others are not interactive. With no sprint in the window the group says *No sprints in this window.*
- **Empty state** in place of the outcome rows and cards: the existing roadmap empty state — *{m} delivery issues and nothing to group them by* — with the line *Outcomes, which group issues under what the team is working toward, arrive in a later release.* The closing line about ungrouped Issues is not drawn (every Issue is ungrouped).
- **The Sprints rows are kept** (the user, 2026-09-28). Whether they stay once Outcomes exist is decided in the Outcomes sprint.

**What the Roadmap shows once Outcomes are built** (the comp R target, specified now so the later sprint does not reopen the design). Outcomes (Slice 2) on a time axis, then the Issues under each; everything drawn is derived from the Outcomes and their Issues, and nothing on the page is stored except the Outcome itself.

- **Header:** *Roadmap*, *The outcomes the team is working toward, when, and the issues under each.*, and **Add New Outcome** — an in-scope admin's, disabled with *Administrators only* for everyone else. The breadcrumb carries a mono count, *{n} OUTCOMES · {m} ISSUES*.
- **Zoom:** a segmented control at the right of the toolbar — **Weeks**, **Months** (default), **Quarters** — the only control on the toolbar. No keyboard shortcuts (the user, 2026-09-28). The zoom is URL state, like the list pattern's view.
  - The visible window is **fixed and anchored on today** (answered 2026-09-28): Weeks — 16 week columns (weeks start Monday) beginning two weeks before the current week; Months — 7 month columns beginning with the current month; Quarters — 4 quarter columns beginning with the current quarter. "Today" is the viewer's local calendar date.
  - **No panning**: anything outside the window is clipped at its edge.
- **Timeline** (a card that scrolls sideways under 760px): a header row with the column labels in mono, then **one row per Outcome** in `SortOrder` — a 260px label column (the Outcome's colour swatch and its name, which opens the Outcome drawer) and a track with faint column rules. On the track:
  - the **target-window bar** from `TargetStartDate` to `TargetEndDate`, filled in the Outcome's colour with a mono label *{done} / {total} DONE* (dark text on the colour), clipped to the visible window. Accessible name *{name}, {start} to {end}*; it opens the drawer too.
  - a **planned** Outcome — window starts after today and all its Issues `Pending` — draws the bar as a dashed outline in its colour instead of a fill, with *PLANNED · 0 / {n}*, and its swatch dashed to match.
  - beneath the bar, a thin **sprint-span line** in the Outcome's colour from the earliest start to the latest end of its Issues' sprints, when any. Where it disagrees with the window is the signal the view exists to show (see the Outcome invariants).
  - a vertical **TODAY** rule across every row, in the primary colour.
- **Outcome cards** below the timeline, two to a row (one below 900px); a card with more than two Issues spans the row.
  - Each has the swatch, the name (opens the drawer), the window as months (*SEP – NOV 2026*), a progress strip with one segment per Issue in its delivery-status colour (when it has more than one), and *{done} / {total}*.
  - Then one row per Issue: key *(gap)*, title (opens the Issue, same target as the Sprint board card), delivery status (dot and word), the effort bar with its words, and the first assignee's avatar or the dashed *Unassigned* mark. An Outcome with none says *No issues grouped here yet.*
- A closing line states how many Issues are under no Outcome, and that each Issue sits under at most one, so the counts add up to the delivery set.
- **Outcome drawer**, on the list and detail pattern:
  - *View*: eyebrow *Outcome · {start month} – {end month}*, the name, the description (or *No description yet.*), facts **Window** (dates), **Done** (*{d} of {n} issues*), **State** (derived: *Planned*, *In its window* or *Past its window*) and **Colour** (swatch), then **Issues** listed with their status. Footer: Edit and Delete, an in-scope admin's.
  - *Create and edit*: **Name** (required), **Target start** and **Target end** (required, side by side; *On or after the start.*), **Colour**, **Description**, and **Issues under this outcome** — a checklist of every Issue, where ticking one already under another Outcome says *moves from {other}*, since grouping is single-parent. Footer: Cancel and *Create outcome* / *Save changes*.
  - **Delete** confirms (comp R does not; the pattern wins) and ungroups the Outcome's Issues, never deleting one.
- **The backend does not exist yet, and Sprint 11 does not build it** (answered 2026-09-28). Slice 2 (Outcomes, the grouping mutation, the roadmap read) is specified above and unbuilt, with no `outcomes` table in the schema; the web app's outcome readers keep answering empty on purpose. `30-Contracts.md` records what the later backend slice must add.

---

## Permissions

| Action | Site Admin | Org Admin (own org) | User | Read Only |
|---|:--:|:--:|:--:|:--:|
| Promote idea → Issue | ✓ | ✓ | Author only | |
| Return Issue → Discovery | ✓ | ✓ | | |
| Change delivery status | ✓ | ✓ | Author or assignee | |
| Create / start / complete / edit / delete sprints | ✓ | ✓ | | |
| Assign / unassign Issue to a sprint | ✓ | ✓ | | |
| View Sprint board, backlog, and provenance | ✓ | ✓ | ✓ | ✓ |
| Add / edit / reorder / delete Tasks on an Issue | ✓ | ✓ | Author or assignee | |
| Change a Task's state | ✓ | ✓ | Author or assignee | |
| Create / edit / reorder / delete Outcomes *(Slice 2)* | ✓ | ✓ | | |
| Group an Issue under an Outcome *(Slice 2)* | ✓ | ✓ | | |
| View Tasks and the Roadmap | ✓ | ✓ | ✓ | ✓ |

A Site Admin tick on a **mutating** row is exercised through View As, never directly: promotion, sprint and outcome management, delivery-status and grouping changes, and tasks are organization content under `20-feature-view-as.md` rules 25/25c. Direct Site Admin access to this feature is read-only. Reconciled 2026-09-03 against the standing product rule (tracker, 2026-08-14).

---

## Requirements

### Must-Have (P0)

- **[P0] Same-object phase model.** An Issue is a Delivery-phase Idea (same row). `Idea.Phase` defaults to `Discovery`; promotion flips it to `Delivery`. No separate Issue table exists.
  - *Given* a Discovery idea *When* it is promoted *Then* `Phase` becomes `Delivery`, `DeliveryStatus` becomes `Pending`, and `Effort`, `PromotedAtUtc`, `PromotedByUserId`, `UpvoteCountAtPromotion` are recorded.
  - *Given* a Delivery item *When* promotion is attempted again *Then* it is rejected (`409`).
- **[P0] Explicit promotion gate with required Effort.** Promotion is an explicit action requiring `Effort`; no ideation status triggers it. Authorized to author + in-scope admins.
- **[P0] Provenance preserved and surfaced.** A promoted Issue exposes its originating proposer, creation date, upvote count at promotion and now, business impact, idea type, tags, and full comment thread — with no manual copy. The ideation `StatusId` is retained (not cleared) on promotion.
- **[P0] Fixed delivery lifecycle.** Delivery statuses are exactly `Pending, Scoping, Development, Review, Complete`. Delivery-status changes are valid only in `Delivery` phase and emit audit + notification.
- **[P0] Sprints.** Admins can create sprints (name, goal, start/end, optional owner), assign/unassign Issues, and transition `Planned → Active → Completed`. `EndDate >= StartDate` is enforced.
- **[P0] Deterministic carry-over.** Completing a sprint returns every unfinished Issue (`DeliveryStatus != Complete`) to the backlog (`SprintId = null`). No Issue is lost or deleted.
- **[P0] Recoverable mis-promotion.** An in-scope admin can return an Issue to Discovery; `SprintId`/`DeliveryStatus` clear, `Effort` and the promotion snapshot are retained, and an audit event is written.
- **[P0] Board phase filtering.** Ideation boards show only `Discovery` items; the Sprint board/backlog show only `Delivery` items. Neither loses data.
- **[P0] Backward compatibility.** Existing ideas backfill to `Discovery`; with no sprints and nothing promoted, the product behaves exactly as today.
- **[P0] Audit coverage.** Promotion, return, delivery-status change, sprint assignment, and all sprint lifecycle transitions generate audit events. Task mutations are exempt by design.
- **[P0] Tasks on an Issue.** An Issue carries an ordered checklist of Tasks, each with a title, an optional assignee, and one of `NotStarted` / `InProgress` / `Done`.
  - *Given* a `Delivery` item *When* a task is added *Then* it appends at the end of the list and the `N of M done` rollup updates.
  - *Given* a `Discovery` item *When* a task is added *Then* it is rejected (`400`).
  - *Given* a task moved to `Done` *Then* `CompletedAtUtc` and `CompletedByUserId` are stamped; *When* moved off `Done` *Then* both are cleared.
  - *Given* an Issue with outstanding tasks *When* its delivery status is set to `Complete` *Then* it succeeds — tasks warn but never block.
  - *Given* an Issue returned to Discovery *Then* its tasks are retained, so a re-promote is lossless.
  - *Given* a reorder *Then* `SortOrder` stays dense and contiguous, and a mismatched id set is rejected (`400`).
- **[P0] Task assignment is independent.** A Task may be assigned to any active user in the org, whether or not they are an assignee of the parent Issue. The new assignee is notified; no other task event notifies anyone.

### Nice-to-Have (P1)

- **[P1] Crowd backlog view** — a standing "Top-voted Discovery ideas not yet promoted" list (trivial query once `Phase` exists). High-signal intake funnel.
- **[P1] Carry-over-to-next-sprint** option on sprint completion (in addition to backlog default).
- **[P1] AI-assisted promotion** — draft acceptance criteria / suggested task list from the idea description + comment thread at the gate, reusing the existing Haiku extraction pattern and human-review-before-commit discipline.
- **[P1] Author self-promote toggle** — an org setting for whether plain authors may promote or only request promotion.
- **[P1] Outcomes and the Roadmap view (Slice 2).** Admins can create dated Outcomes and group Issues under them; all org members can read the roadmap grid.
  - *Given* outcomes exist *When* the roadmap is read *Then* each row shows its derived issue count, done count, and sprint span — none of which is stored.
  - *Given* an Outcome is soft-deleted *Then* every Issue grouped under it survives, merely ungrouped.
  - *Given* an Issue's sprint changes *Then* its outcome grouping is unaffected, and vice versa.
  - *Given* an Issue is grouped under an Outcome *When* it is grouped under a different one *Then* it leaves the first — an Issue sits under at most one Outcome.

### Future Considerations (P1/P2)

- **[P1→P2] Impact × Effort quadrant** — a "what to promote next" view using Business Impact × `Effort` (both fields now exist). The prioritization artifact Jira makes teams build by hand.
- **[P2] Story points / velocity / burndown** — only if demonstrated demand justifies the ceremony; `Effort` may map to points behind the scenes.
- **[P2] Cross-issue dependencies.** (Issue decomposition is no longer deferred — see Tasks, Slice 1.)
- **[P2] Outcome-level narrative and target metrics** — "reduce reporting effort by 3h/week" as a tracked number rather than prose. Only once Outcomes have earned their keep.
- **[P2] Configurable delivery statuses** per org.
- **[P2] Sprint/roadmap AI narrative** for stakeholder updates (folds into the deferred reporting phase).

---

## Migration Strategy

**EF migration `AddDeliveryAndSprints`:**
- `ideas` gains: `phase` (int, NOT NULL, default `0`/Discovery — existing rows backfill to Discovery), `effort` (int, null), `delivery_status` (int, null), `sprint_id` (guid, null, FK → `sprints`, `ON DELETE` restricted; unassignment is handled in the app layer), `promoted_at_utc` (timestamptz, null — `DateTime` with `Kind = Utc`, per the Npgsql mapping in `SPEC/50-postgres-migration.md`), `promoted_by_user_id` (guid, null), `upvote_count_at_promotion` (int, null).
- New table `sprints` (snake_case, per Infrastructure convention) with `organization_id`, `name`, `goal`, `start_date`, `end_date`, `owner_user_id`, `state`, `is_deleted`, and audit columns.
- Indexes: `(organization_id, phase)` on `ideas` (board/backlog filtering); `sprint_id` on `ideas`; `(organization_id, state)` on `sprints`.
- New table `issue_tasks` (snake_case) with `idea_id` (FK → `ideas`, `ON DELETE CASCADE` — a checklist has no meaning without its Issue; the one place in this feature where cascade is correct), `title`, `assignee_user_id`, `state`, `sort_order`, `completed_at_utc`, `completed_by_user_id`, and audit columns. Index `(idea_id, sort_order)`.
- Every existing idea backfills to `Discovery` and no sprints exist, so ideation boards and idea flows are byte-for-byte unchanged post-migration; delivery surfaces are simply empty. No existing row gains a task.

**EF migration `AddOutcomes` (Slice 2):**
- New table `outcomes` with `organization_id`, `name`, `description`, `target_start_date`, `target_end_date`, `owner_user_id`, `sort_order`, `is_deleted`, and audit columns. Index `(organization_id, sort_order)`. *Added 2026-09-28:* `color VARCHAR(7) NOT NULL` (comp R). The schema freeze needs its own amendment in `decisions.md` before this migration is written; the 2026-09-28 (fourth) amendment does **not** cover it — Outcomes are a later sprint's (answered 2026-09-28).
- Plus `ideas.outcome_id` (guid, null, FK → `outcomes`, `ON DELETE SET NULL`) — single-parent, per the 2026-09-02 decision. No join table.
- `ON DELETE SET NULL` rather than cascade: removing an Outcome must never delete an Issue, only ungroup it. Moving to multi-parent later, should the duplicate-Issue failure mode appear, is a cheap forward migration (copy the FK into the join table, drop the column); the reverse is lossy and needs a human to choose which grouping survives.
- Touches only new/changed tables, so it should merge cleanly against `CollegaDbContextModelSnapshot` provided no other in-flight slice adds a concurrent migration.

---

## Impact on Existing Specs

Approving this spec requires these canonical edits *before* implementation (per repo working rules):

1. **`SPEC/20-feature-ideas-and-engagement.md`** — introduce the Discovery/Delivery **phase** concept, the optional `Effort` field, and the **promotion gate**; note that the ideation board now filters to `Phase == Discovery`; record that the deferred *Approval Workflow* is partially realized as the promotion gate (the always-review-before-commit principle already applies to AI-assisted creation).
2. **`SPEC/20-feature-boards-and-statuses.md`** — document ideation-board phase filtering and the new **Sprint board** with its fixed delivery statuses; cross-reference the promotion gate against the deferred approval-workflow decisions.
3. **`SPEC/20-feature-notifications.md`** — add `IdeaPromoted` and `IssueDeliveryStatusChanged` notification types (recipients: idea author + assignees; self-suppressed; link `/ideas/{ideaId}`).
4. **`SPEC/30-Contracts.md`** — add the promote / return-to-discovery / delivery-status / sprint-assignment routes, the sprint CRUD + lifecycle routes, the `/delivery` query, and the six nested **task** routes. The **outcome** and **roadmap** routes follow with Slice 2.
5. **`SPEC/20-feature-client-ui.md`** and **`SPEC/20-feature-client-ui-revisions.md`** — add the Delivery rail destination, the Sprint board, the promotion dialog, the provenance panel, and the Issue task checklist; note the still-open mobile/narrow-viewport pass applies. The Roadmap destination follows with Slice 2.
6. **`SPEC/archive/70-delivery-backlog.md`** / **`SPEC/archive/80-workstream-roadmap.md`** — add this slice as a post-MVP milestone ("Idea → Delivery"), sequenced after the MVP release gate.

---

## Open Questions

- **[Product — RESOLVED 2026-09-02]** **May an Issue sit under more than one Outcome?** **No — single-parent, at most one** (see Design Decisions and the Outcome section for the reasoning and the accepted cost; `SPEC/mockups/comp-n-roadmap-multi.html` records the rejected alternative). **No open question blocks Slice 2 now.**
- **[Product]** Promotion from any Discovery status, or only after a specific ideation status (e.g. `Complete`)? *Default (chosen): any Discovery status — the gate is the explicit decision, not the status.* An org-level "require status X before promote" is a P2 option. — non-blocking.
- **[Product]** May a plain author self-promote, or only *request* promotion for an admin to confirm? *Default: author may self-promote (matches the deferred approval decision).* The P1 toggle can tighten this. — non-blocking.
- **[Product]** On sprint completion, is backlog the right default for unfinished Issues, or carry-over-to-next? *Default: backlog; carry-over is P1.* — non-blocking.
- **[Eng]** Exactly one `Active` sprint per org (single-team assumption), or several concurrently? *Default: no single-active constraint in this slice.* — non-blocking.
- **[Product]** Is `ReturnToDiscovery` the right recovery model, or should mis-promotion be prevented by a stronger confirm only? *Default: reversible return, admin-only.* — non-blocking.

---

## Effort Sizing (backend-first; Client is a later wave per repo convention)

| Layer | Work | Estimate |
|---|---|---|
| **Domain** | `IdeaPhase`/`EffortLevel`/`DeliveryStatus`/`SprintState`/`IssueTaskState` enums, `Idea` delivery facets + invariant methods, `Sprint` entity + lifecycle invariants, `IssueTask` entity + ordering invariants | M — 1.5–2 days |
| **Infrastructure / EF** | `Sprint` + `IssueTask` config, 7 new `ideas` columns, `sprints` and `issue_tasks` tables, `AddDeliveryAndSprints` migration (Discovery backfill, indexes) | M — 1.5–2 days |
| **Application** | `SprintService` (CRUD + lifecycle + carry-over), `IssueTaskService` (CRUD + state + dense reorder), idea promotion/return/delivery-status/sprint-assignment ops, board/idea-list phase filtering, delivery query + task rollup, audit + notification wiring | L — 4–5 days |
| **API** | Promotion/delivery routes (4), sprint routes (7), task routes (6), delivery query, contracts | M — 2.5 days |
| **Tests** | Promotion (phase flip, required effort, re-promote reject), provenance snapshot, delivery-status transitions, sprint lifecycle + carry-over, phase filtering, return-to-discovery, task CRUD + state stamping + dense ordering + Discovery rejection + retention across return-to-discovery + non-blocking Complete, backward-compat (no-op for un-promoted orgs) | L — 4 days |
| **Client (later wave)** | Promotion dialog, provenance panel, Sprint board + backlog, sprint admin, task checklist with drag-reorder, rail destination, phase filters | L — 6–8 days |
| **Slice 1 backend total** | | **~12–14 dev-days** |
| **Slice 2 — Outcomes & Roadmap** | `Outcome` entity, `OutcomeService`, grouping mutation, derived roadmap query, 8 routes, roadmap grid UI, tests | M–L — **~5–7 dev-days** |
