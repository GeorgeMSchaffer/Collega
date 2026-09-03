# Feature: Issues and Delivery (Idea → Execution)

## Overview

Today Collega ends where most idea tools end: an idea gets proposed, debated, upvoted, tagged, and eventually reaches a terminal ideation status (`Complete`). What happens next — *actually building the thing* — happens somewhere else (a spreadsheet, Jira, nothing). That handoff is where every competitor loses the story: the moment an idea becomes committed work, its provenance (who proposed it, who upvoted it, the debate, the business case) is retyped away.

This feature closes that loop **inside Collega** by promoting an idea into a lightweight delivery track — Sprints and Issues executed with just enough Agile ceremony — **without creating a second object**. An Issue is not a copy of an Idea; it is the same row in a later *phase* of its life. Promotion flips an item from **Discovery** (ideation on a board) to **Delivery** (execution in a sprint), and the item carries its entire history forward. The differentiator is not "we also do sprints" — it is **provenance-preserving delivery**: mid-sprint, "why are we building this?" is one click away.

This spec covers the Roadmap → Sprint → Issue concept captured in `SPEC/Bug Triage.md` (IDEAS), delivered in two slices:

- **Slice 1 — Delivery (P0).** The phase model, the promotion gate, Sprints, the fixed delivery statuses, provenance, and **Tasks** (a checklist on an Issue). This is the buildable unit.
- **Slice 2 — Roadmap (P1).** **Outcomes**: theme grouping over time, sitting *beside* sprints as a lens rather than above them as a container. Specified here so the domain shape is settled and sequenced after Slice 1. The one question that gated it — Outcome ↔ Issue cardinality — is **decided: single-parent** (see [Design Decisions](#design-decisions-interview-resolved)).

The Impact×Effort prioritization view, crowd-backlog auto-surfacing, and AI-assisted promotion remain **explicitly deferred** (see [Non-Goals](#non-goals) and [Future Considerations](#future-considerations-p1p2)). The guardrail throughout: every field and screen must earn its place by *closing the loop* or *preserving provenance*, never by matching a Jira feature.

> **Reconciled 2026-08-31.** Tasks and Roadmap were Non-Goals in the 2026-08-10 interview resolution. Review of the delivery comps (`SPEC/mockups/comp-l-delivery-desk.html`) established that an Issue with no task checklist does not actually let a team *run* the sprint this feature promises, and that "what are we trying to achieve this quarter" had no home anywhere in the product. The product owner brought both into scope. The Design Decisions below record the shape agreed at that review; the Non-Goals were rewritten from "not now" to the much narrower "not ever, and here is the line".

---

## Design Decisions (Interview-Resolved)

| Decision | Resolution |
|---|---|
| Execution model | **Native lightweight delivery** inside Collega (not integrate-and-hand-off to Jira). Chosen 2026-08-10. |
| Idea vs Issue relationship | **Same object, two phases.** An Issue is a Delivery-phase Idea — the same row, not a new entity. Preserves provenance and eliminates handoff data loss. |
| Phase model | An item is in exactly one `Phase`: `Discovery` (default) or `Delivery`. Promotion flips Discovery → Delivery. |
| Promotion trigger | An **explicit "Promote to Issue" decision gate**, *not* an idea reaching a particular ideation status. Overloading the `Complete` status to also mean "committed to delivery" is rejected as the source of the concept's awkwardness. |
| Relationship to deferred Approval Workflow | The promotion gate **is** the realization of the post-MVP approval gate deferred in `SPEC/20-feature-ideas-and-engagement.md` and `SPEC/20-feature-boards-and-statuses.md`. One build, two features. |
| Two status systems | Ideation statuses (org-configured swimlanes) govern **Discovery**; a **fixed** delivery status set governs **Delivery**. They never mix; both are retained for history. |
| Delivery statuses | Fixed enum: `Pending`, `Scoping`, `Development`, `Review`, `Complete` (from the captured concept). Not org-configurable in this slice. |
| Effort | `Effort` (`Low`/`Medium`/`High`) lands on the **Idea** as an optional Discovery field and is **required at the promotion gate**. T-shirt sizing, deliberately *not* story points. |
| Per-issue dates | **Dropped.** The sprint boxes the dates; per-issue start/end inside a dated sprint creates "which date wins" conflicts and is not how Agile scopes work. Dates live on Sprints (and, later, Roadmap items). |
| Sprint ↔ Roadmap nesting | Sprint is **not** nested under Outcome, and does not become so in Slice 2. Sprint is a flat, time-boxed container; an Issue belongs to zero or one Sprint. An Outcome *groups* Issues; it does not own them and has no authority over sprint membership. Reaffirmed 2026-08-31. |
| Task model | **Tasks are checklist items on an Issue**, not first-class work items — no sprint of their own, no dates, no estimate. Decided 2026-08-31. Because the Issue is the unit that moves between sprints, a task can never be stranded in a sprint its parent has left. First-class independently-assignable tasks were considered and rejected as too heavy for "Jira light", and because they would reintroduce the two-object problem the phase model exists to avoid. |
| Task assignee | A Task may carry an optional assignee, who **need not** be an assignee of the parent Issue — any active user in the org qualifies. This is the one place delivery work is divided between people; constraining it to the Issue's assignees would force spurious Issue assignments just to name a helper. |
| Task state | Three states (`NotStarted`, `InProgress`, `Done`) rather than a bare checkbox, because "started but not finished" is the state a standup actually asks about. The `N of M done` rollup counts only `Done`. |
| Roadmap model | An **Outcome** is a named, dated theme that Issues are grouped under — a lens, not a container. Every rollup (issue count, done count, sprint span, quarter placement) is **derived** at read time, never stored. An Outcome has no status field and no percent-complete field. |
| Outcome ↔ Issue cardinality | **Decided 2026-09-02 — single-parent.** An Issue sits under **at most one** Outcome (`Idea.OutcomeId`, nullable). Chosen so roadmap arithmetic is honest by construction: counts partition the delivery set, totals sum, and "done" is unambiguous without a distinct-count anywhere. Rendered in `SPEC/mockups/comp-m-roadmap-single.html`; `comp-n-roadmap-multi.html` records the rejected multi-parent alternative. **Nothing in Slice 1 depended on this.** |
| Sprint lifecycle | Explicit `Planned` → `Active` → `Completed` transitions (start/complete are actions, not date-derived), because completing a sprint must handle carry-over deterministically. |
| Provenance | Nearly free because Issue *is* the Idea. Only new stored provenance fields are `PromotedAtUtc`, `PromotedByUserId`, and an `UpvoteCountAtPromotion` snapshot ("how much support did this have when we committed"). |
| Board filtering | The ideation board (`/board/{boardId}`) filters to `Phase == Discovery`; promoted items leave it (no data loss — the row and its idea status are retained). Delivery items render on a new **Sprint board**. |
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

- **A separate `Issue` entity/table.** An Issue is a Delivery-phase Idea. A parallel object would reintroduce the provenance-loss problem this feature exists to solve.
- **Outcomes that own Issues, or Sprints nested under Outcomes.** An Outcome groups; it never contains. Sprint membership is unaffected by outcome membership and vice versa. Deleting an Outcome never touches an Issue.
- **Dates, status, or progress fields stored on an Outcome.** Only the Outcome's own target window is stored. Its progress, issue counts, and sprint span are *derived* from the Issues grouped under it. There is no outcome-level status enum, no percent-complete column, and no outcome-to-outcome dependency link.
- **Epics as a third phase.** An Outcome is not a phase and not a work item; it never appears on a board, has no delivery status, and cannot be promoted, assigned, or commented on.
- **The Impact × Effort prioritization quadrant** and **crowd-backlog auto-surfacing** ("top-voted ideas not yet promoted"). The enabling fields land now (`Effort`, `Phase`), but the views are deferred (P1).
- **AI-assisted promotion** (drafting acceptance criteria / task breakdown from the idea + comments). Deferred (P1); it rides the existing Haiku extraction pattern when built.
- **Story points, velocity, burndown/burnup, capacity planning.** Deferred (P2), gated behind demonstrated demand. `Effort` stays T-shirt sizing.
- **First-class sub-issues.** A Task is a checklist item on an Issue: no sprint of its own, no dates, no estimate, no comments, no upvotes, no tags, no nesting, and no promotion path. Anything needing one of those is an Issue, not a Task. Task counts must not be surfaced as a velocity or capacity proxy — see the story-points Non-Goal below.
- **Per-issue start/end dates and cross-issue dependencies.** Dropped by design.
- **Org-configurable delivery statuses.** The delivery status set is fixed in this slice.
- **Integrate/export to external trackers (Jira, etc.).** The chosen direction is native; an export/link path is out of scope here.

---

## Terminology

| Term | Meaning |
|---|---|
| **Idea** | An item in `Discovery` phase. Unchanged from today. |
| **Issue** | The *same* item after promotion, in `Delivery` phase. User-facing "Issue" vocabulary is a lens/label on a Delivery-phase Idea, not a new record. |
| **Promote** | The explicit gate that flips an item Discovery → Delivery. |
| **Sprint** | A time-boxed container that Issues are pulled into for execution. |
| **Delivery backlog** | Delivery-phase items not yet assigned to a Sprint (`SprintId is null`). |
| **Task** | A checklist step on an Issue. Ordered, optionally assigned, in one of three states. Has no independent life: it exists only as a child of its Issue and moves with it. |
| **Outcome** | A named, dated theme that Issues are grouped under (Slice 2). A reporting lens over Issues — "what are we trying to achieve" — not a container that owns them. |

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

```csharp
// New facets on the existing Idea entity (no new table — the Issue IS the Idea):
public IdeaPhase Phase { get; private set; }              // Discovery (default) | Delivery
public EffortLevel? Effort { get; private set; }          // optional in Discovery; required at promotion
public DeliveryStatus? DeliveryStatus { get; private set; } // null in Discovery; Pending on promotion
public Guid? SprintId { get; private set; }               // null = delivery backlog (only meaningful in Delivery)

// Provenance snapshot (the only genuinely new provenance storage):
public DateTime? PromotedAtUtc { get; private set; }
public Guid? PromotedByUserId { get; private set; }
public int? UpvoteCountAtPromotion { get; private set; }

// Invariant methods (factory-style, matching existing Idea mutators):
public void PromoteToIssue(EffortLevel effort, Guid? sprintId, int currentUpvoteCount,
                           DateTime nowUtc, Guid actorUserId);
public void ReturnToDiscovery(DateTime nowUtc, Guid actorUserId);
public void ChangeDeliveryStatus(DeliveryStatus target, DateTime nowUtc, Guid actorUserId);
public void AssignToSprint(Guid? sprintId, DateTime nowUtc, Guid actorUserId);
```

Invariants:
- `PromoteToIssue` is valid only from `Phase == Discovery`; sets `Phase = Delivery`, `DeliveryStatus = Pending`, records `Effort`, `PromotedAtUtc`, `PromotedByUserId`, `UpvoteCountAtPromotion`. Re-promoting a Delivery item is rejected.
- `ChangeDeliveryStatus` and `AssignToSprint` are valid only from `Phase == Delivery` (else `409`/`400`).
- `ReturnToDiscovery` flips `Phase = Delivery → Discovery`, clears `SprintId` and `DeliveryStatus`, and **retains** `Effort` and the promotion snapshot for history (so a re-promote and audit trail remain coherent).
- The **ideation `StatusId` is never cleared** by promotion — it is frozen at its last Discovery value for provenance. Ideation `Complete` and delivery `Complete` are distinct terminal states and both are retained.

### New enums (`Collega.Domain`)

```csharp
public enum IdeaPhase     { Discovery = 0, Delivery = 1 }
public enum EffortLevel   { Low = 0, Medium = 1, High = 2 }
public enum DeliveryStatus{ Pending = 0, Scoping = 1, Development = 2, Review = 3, Complete = 4 }
public enum SprintState   { Planned = 0, Active = 1, Completed = 2 }
```

### New entity: `Sprint` (`AuditableEntityBase`)

Org-scoped, soft-deletable, time-boxed. A flat container in this slice (no Roadmap parent).

```csharp
public sealed class Sprint : AuditableEntityBase
{
    public const int NameMaxLength = 100;
    public const int GoalMaxLength = 500;

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; }            // required, non-empty
    public string? Goal { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }       // must be >= StartDate
    public Guid? OwnerUserId { get; private set; }      // optional; active user in the same org
    public SprintState State { get; private set; }      // Planned → Active → Completed
    public bool IsDeleted { get; private set; }

    // Create / Update / Start / Complete / SoftDelete — factory + invariant methods.
}
```

Invariants:
- `EndDate >= StartDate`; `Name` trimmed and non-empty (uniqueness **not** required — "Sprint 12"-style names may repeat across time).
- `Start()` requires `State == Planned` → `Active`. `Complete()` requires `State == Active` → `Completed`.
- On `Complete()`, every assigned Issue whose `DeliveryStatus != Complete` is unassigned back to the delivery backlog (`SprintId = null`). Carry-over-to-next-sprint is a P1 refinement.
- `OwnerUserId`, when set, must be an active user in the sprint's organization (validated in the Application layer, consistent with assignee validation).

Issue ↔ Sprint is a simple nullable FK on `Idea` (`SprintId`); an Issue belongs to zero or one Sprint. There is no join entity.

### New entity: `IssueTask` (`AuditableEntityBase`) — Slice 1

A checklist step belonging to exactly one Issue. Org scope is inherited through the parent Idea and is **not** duplicated on the row; every query reaches tasks through their Idea, so the existing org-scoping on `Idea` remains the single enforcement point.

```csharp
public sealed class IssueTask : AuditableEntityBase
{
    public const int TitleMaxLength = 200;

    public Guid IdeaId { get; private set; }            // required; the parent Issue
    public string Title { get; private set; }           // required, non-empty, trimmed
    public Guid? AssigneeUserId { get; private set; }   // optional; any active user in the parent's org
    public IssueTaskState State { get; private set; }   // NotStarted (default) | InProgress | Done
    public int SortOrder { get; private set; }          // dense 0..n-1 within the parent Issue
    public DateTime? CompletedAtUtc { get; private set; }
    public Guid? CompletedByUserId { get; private set; }

    // Create / Rename / Assign / ChangeState / Reorder — factory + invariant methods.
}
```

Invariants:
- `Title` is trimmed and non-empty; `SortOrder` is dense and contiguous within the parent, maintained on insert, delete, and reorder.
- `ChangeState(Done)` stamps `CompletedAtUtc`/`CompletedByUserId`; moving *off* `Done` clears both. The stamps are the only completion record — there is no per-task history.
- Tasks may only be created on an Idea whose `Phase == Delivery` (`400` otherwise). A task list is a delivery artifact; ideas in Discovery do not have one.
- `ReturnToDiscovery` **retains** tasks (hidden, not deleted) so a re-promote is lossless — consistent with retaining `Effort` and the promotion snapshot.
- Deleting a Task is a hard delete; there is no soft-delete or audit trail on a checklist item.
- **Tasks never block a status change.** An Issue may be set to `Complete` with tasks outstanding; the UI warns, the domain permits. Enforcing "all tasks done" would make the checklist a gate, which is a ceremony this feature explicitly refuses.

### New entity: `Outcome` (`AuditableEntityBase`) — Slice 2

Org-scoped, soft-deletable, dated. A grouping lens over Issues.

```csharp
public sealed class Outcome : AuditableEntityBase
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 1000;

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; }             // required, non-empty
    public string? Description { get; private set; }
    public DateOnly TargetStartDate { get; private set; }
    public DateOnly TargetEndDate { get; private set; }  // must be >= TargetStartDate
    public Guid? OwnerUserId { get; private set; }       // optional; active user in the same org
    public int SortOrder { get; private set; }           // row order on the roadmap grid
    public bool IsDeleted { get; private set; }

    // Create / Update / Reorder / SoftDelete — factory + invariant methods.
}
```

Invariants:
- `TargetEndDate >= TargetStartDate`. The window is the Outcome's *intent*; the derived sprint span shown on the roadmap is computed from grouped Issues and may disagree with it — that disagreement is the signal the view exists to surface, not an error to reconcile.
- Soft-deleting an Outcome **never touches an Issue**; it only removes the grouping.
- No status, no percent-complete, and no `SprintId` — an Outcome is orthogonal to sprints.

**Outcome ↔ Issue linkage is single-parent.** An Issue carries `Idea.OutcomeId` (nullable FK). Grouping it under an Outcome is a **move**, not an add: assigning a new Outcome clears the old one, and clearing it leaves the Issue ungrouped.

This was a genuine fork, resolved 2026-09-02. What the rejected shape would have cost, recorded so it is not re-argued:

| | Single-parent (**chosen**) | Multi-parent (rejected) |
|---|---|---|
| Storage | `Idea.OutcomeId` (nullable FK) | `idea_outcomes` join table (`idea_id`, `outcome_id`, PK on both) |
| Rollup arithmetic | Counts partition; totals sum to the delivery set | Counts overlap; every total needs a distinct-count beside it |
| Reassignment | A move (leaves the old outcome) | An add/remove (may belong to both) |
| Comp | `comp-m-roadmap-single.html` | `comp-n-roadmap-multi.html` |

The cost of the choice is real: work that genuinely serves two quarterly goals must pick one. The failure mode to watch for is **teams raising duplicate Issues** so two Outcomes can each claim the work — which would reintroduce exactly the provenance loss the phase model exists to prevent. If that appears in practice, single → multi is a cheap forward migration (copy the FK into the join table, drop the column); the reverse is lossy.

### New enums (Slice 1 / Slice 2)

```csharp
public enum IssueTaskState { NotStarted = 0, InProgress = 1, Done = 2 }   // Slice 1
```

---

## Application Layer

### New service: `ISprintService` (`Collega.Application/Sprints/`)

Admin-only (in-scope OrgAdmin, or SiteAdmin), mirroring existing org-scoped admin services' `EnsureAdminScope` authorization.

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

- **Promote:** `PromoteIdeaAsync(ideaId, effort, sprintId?, note?, actor)`. Authorizes actor (author or in-scope admin), reads the idea's current upvote count, calls `Idea.PromoteToIssue(...)`, emits a promotion audit event and notifications (below). If `sprintId` is supplied it must be a non-`Completed` sprint in the same org.
- **Return to Discovery:** `ReturnIdeaToDiscoveryAsync(ideaId, actor)` — admin-only; emits an audit event.
- **Change delivery status:** `ChangeDeliveryStatusAsync(ideaId, target, actor)` — authorizes author, an assignee, or an in-scope admin; emits audit + notification (author + assignees, self-suppressed).
- **Assign to sprint:** `AssignIssueToSprintAsync(ideaId, sprintId?, actor)` — admin-only in this slice; emits an audit event. Target sprint must be a non-`Completed` sprint in the same org, or `null` for backlog.
- **Delivery queries:** a phase-aware list for the sprint board and backlog — `ListDeliveryAsync(orgId, sprintId? , deliveryStatus?)` returning the existing compact card projection plus `deliveryStatus`, `effort`, `sprint`, a `taskSummary` (`{ done, total }`), and provenance summary.

### New service: `IIssueTaskService` (`Collega.Application/Delivery/`) — Slice 1

Authorization mirrors `ChangeDeliveryStatusAsync`: the idea author, any Issue assignee, or an in-scope admin. Read is available to any org member who can see the Issue. Every method resolves the parent Idea first and authorizes against it — tasks carry no independent scope.

| Method | Purpose |
|---|---|
| `ListAsync(ideaId, actor)` | Ordered tasks for an Issue |
| `CreateAsync(ideaId, cmd, actor)` | Append a task (`title`, optional `assigneeUserId`); rejects if the parent is not `Delivery` |
| `UpdateAsync(taskId, cmd, actor)` | Rename and/or reassign |
| `ChangeStateAsync(taskId, state, actor)` | `NotStarted` / `InProgress` / `Done`; stamps or clears completion |
| `ReorderAsync(ideaId, orderedTaskIds, actor)` | Rewrite `SortOrder` densely; the full id set must match exactly |
| `DeleteAsync(taskId, actor)` | Hard delete, then re-densify `SortOrder` |

### New service: `IOutcomeService` (`Collega.Application/Delivery/`) — Slice 2

Admin-only for management (in-scope OrgAdmin or SiteAdmin); read available to all org members. Mirrors `ISprintService` authorization exactly.

| Method | Purpose |
|---|---|
| `ListAsync(orgId)` | Outcomes in `SortOrder`, each with its derived rollup |
| `GetAsync(orgId, id)` | One outcome with its grouped Issues |
| `CreateAsync(orgId, cmd)` | Create (name, description, target window, optional owner) |
| `UpdateAsync(orgId, id, cmd)` | Rename / re-describe / re-window / reassign owner |
| `ReorderAsync(orgId, orderedIds)` | Roadmap row order |
| `DeleteAsync(orgId, id)` | Soft-delete; grouped Issues are ungrouped, never deleted |
| `SetIssueOutcomeAsync(ideaId, outcomeId?)` | Grouping mutation — sets or clears the Issue's single Outcome. A null `outcomeId` ungroups it; assigning a new one replaces any existing grouping. |
| `GetRoadmapAsync(orgId, granularity)` | The roadmap grid: outcomes × time buckets (quarters or sprints), with derived spans |

Rollups (`issueCount`, `doneCount`, derived sprint span, quarter placement) are computed in the query, never stored. Because grouping is single-parent these are plain counts: no rollup carries a distinct-count beside it, and the per-outcome totals sum to the delivery set.

### Board & idea-list phase filtering

- Existing ideation board queries add `Phase == Discovery` (promoted items drop off the ideation board without data loss).
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

Creating a task on a `Discovery` item → `400`. A `taskId` whose parent is not `{ideaId}` → `404` (never `403`, so the route cannot be used to probe for ideas in other orgs). A reorder whose id set does not exactly match the Issue's tasks → `400`.

### Outcomes (Slice 2) — Admin only for management; read available to all org members

| Method | Route | Description |
|---|---|---|
| `GET` | `/organizations/{orgId}/outcomes` | List outcomes with derived rollups |
| `POST` | `/organizations/{orgId}/outcomes` | Create an outcome |
| `GET` | `/organizations/{orgId}/outcomes/{id}` | One outcome with its grouped Issues |
| `PUT` | `/organizations/{orgId}/outcomes/{id}` | Update name/description/window/owner |
| `PUT` | `/organizations/{orgId}/outcomes/order` | Roadmap row order |
| `DELETE` | `/organizations/{orgId}/outcomes/{id}` | Soft-delete; grouped Issues are ungrouped |
| `GET` | `/organizations/{orgId}/roadmap` | Roadmap grid (`?granularity=quarter|sprint`) |
| `PUT` | `/ideas/{ideaId}/outcomes` | Set an Issue's outcome grouping — body `{ "outcomeId": <guid|null> }`; null ungroups |

---

## Audit & Notifications

Reuses the existing audit-event and `INotificationWriter` patterns (`SPEC/20-feature-notifications.md`); self-notifications remain suppressed.

- **Audit events** (new types): `IdeaPromotedToIssue`, `IssueReturnedToDiscovery`, `IssueDeliveryStatusChanged`, `IssueSprintAssignmentChanged`, `SprintCreated`, `SprintStarted`, `SprintCompleted`, `SprintUpdated`, `SprintDeleted`. Slice 2 adds `OutcomeCreated`, `OutcomeUpdated`, `OutcomeDeleted`, `IssueOutcomeGroupingChanged`.
- **Task mutations are deliberately NOT audited.** A checklist ticked a dozen times a day would drown the audit log that exists to answer "who committed us to this work". `CompletedAtUtc`/`CompletedByUserId` on the row carry the only record that matters. This is a conscious asymmetry with every other mutation in the feature.
- **Notification events** (new types, notify idea author + assignees): `IdeaPromoted` and `IssueDeliveryStatusChanged`. The stored canonical link is `/ideas/{ideaId}` (drawer-addressable, the same item), consistent with the notifications spec.
- **Task assignment notifies the new assignee only** (`IssueTaskAssigned`, self-suppressed, link `/ideas/{ideaId}`). No other task event notifies anyone — ticking a box must not page the room.

---

## Client UI (later wave, per repo convention)

Layouts here are **directional**; the locked Comp C system (`SPEC/mockups/comp-c-review-06-lockin-v5-final.html`) and its mobile gap apply. Throwaway review comps should precede production Blazor per the working rules.

- **Promotion action** on Idea Detail: a "Promote to Issue" button (visible to author + in-scope admins on Discovery-phase items) opens a small confirm dialog — required **Effort** selector, optional **Sprint** picker (or "Backlog"), optional note — then flips the page into its Issue/Delivery lens.
- **Issue/Delivery lens** on the same detail page: ideation Type is read-only context; a **Provenance panel** shows "Originated as an idea by *X* on *date* · *N* upvotes at promotion (*M* now) · promoted by *Y* on *date*", with the original comment thread inline. This panel is the differentiator — it ships in this slice.
- **Sprint board** (`/delivery` or `/sprints/{sprintId}`): fixed 5-swimlane kanban (`Pending`→`Complete`), Issue cards reusing the existing compact card with an `Effort` chip and delivery status. Drag between swimlanes mirrors the idea-board move (optimistic, revert on failure); keyboard/touch use the detail status selector — consistent with existing board mechanics.
- **Delivery backlog** view: Delivery-phase Issues with no sprint, the source list admins pull from.
- **Sprint admin**: create/edit/start/complete sprint; a rail "Delivery" (or "Sprints") destination is added to the 64px icon rail.
- **Task checklist** on the Issue/Delivery lens: an ordered list under the description with an `N of M done` counter, per-row state control, optional assignee, drag-to-reorder, and an inline "+ Add task" affordance. Rendered in `comp-l-delivery-desk.html` (Issue screen). Read-only viewers see the list and the counter with no controls.
- **Roadmap** (`/roadmap`, Slice 2): outcomes as rows against a quarter or sprint axis, each row showing its derived span, issue count, and done count; selecting a row lists its Issues. Rendered in `comp-m-roadmap-single.html`, which is the chosen shape. `comp-n-roadmap-multi.html` is retained only as the record of the rejected alternative — do not build from it.
- **Ideation board** unchanged except that promoted items no longer appear (phase filter).

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
- **[P0] Explicit promotion gate with required Effort.** Promotion is an explicit action requiring `Effort`; it is not triggered by any ideation status. Authorized to author + in-scope admins.
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
- New table `issue_tasks` (snake_case) with `idea_id` (FK → `ideas`, `ON DELETE CASCADE` — a checklist has no meaning without its Issue, and it is the one place in this feature where cascade is correct), `title`, `assignee_user_id`, `state`, `sort_order`, `completed_at_utc`, `completed_by_user_id`, and audit columns. Index `(idea_id, sort_order)`.
- Because every existing idea backfills to `Discovery` and no sprints exist, all ideation boards and idea flows are byte-for-byte unchanged post-migration; delivery surfaces are simply empty. No existing row gains a task.

**EF migration `AddOutcomes` (Slice 2):**
- New table `outcomes` with `organization_id`, `name`, `description`, `target_start_date`, `target_end_date`, `owner_user_id`, `sort_order`, `is_deleted`, and audit columns. Index `(organization_id, sort_order)`.
- Plus `ideas.outcome_id` (guid, null, FK → `outcomes`, `ON DELETE SET NULL`) — single-parent, per the 2026-09-02 decision. There is no join table.
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

- **[Product — RESOLVED 2026-09-02]** **May an Issue sit under more than one Outcome?** **No — single-parent, at most one.** Roadmap arithmetic is then honest by construction: counts partition, totals sum, "done" is unambiguous, and no rollup needs a distinct-count. The accepted cost is that work genuinely serving two quarterly goals must pick one; the failure mode to watch is teams raising duplicate Issues so two Outcomes can each claim the work. `SPEC/mockups/comp-n-roadmap-multi.html` records the rejected alternative. **No open question blocks Slice 2 now.**
- **[Product]** Should promotion be allowed from any Discovery status, or gated on the item first reaching a specific ideation status (e.g. `Complete`)? *Default (chosen): any Discovery status — the gate is the explicit decision, not the status.* An org-level "require status X before promote" is a P2 option. — non-blocking.
- **[Product]** May a plain author self-promote, or only *request* promotion for an admin to confirm? *Default: author may self-promote (matches the deferred approval decision).* The P1 toggle can tighten this. — non-blocking.
- **[Product]** On sprint completion, is backlog the right default for unfinished Issues, or should carry-over-to-next be the default? *Default: backlog; carry-over is P1.* — non-blocking.
- **[Eng]** Should exactly one sprint be `Active` per org at a time (single-team assumption), or may multiple run concurrently? *Default: no single-active constraint in this slice.* — non-blocking.
- **[Product]** Is `ReturnToDiscovery` the right recovery model, or should mis-promotion be prevented by a stronger confirm only? *Default: reversible return, admin-only.* — non-blocking.

---

## Effort Sizing (backend-first; Client is a later wave per repo convention)

| Layer | Work | Estimate |
|---|---|---|
| **Domain** | `IdeaPhase`/`EffortLevel`/`DeliveryStatus`/`SprintState`/`IssueTaskState` enums, `Idea` delivery facets + invariant methods, `Sprint` entity + lifecycle invariants, `IssueTask` entity + ordering invariants | M — 1.5–2 days |
| **Infrastructure / EF** | `Sprint` + `IssueTask` config, 7 new `ideas` columns, `sprints` and `issue_tasks` tables, `AddDeliveryAndSprints` migration (Discovery backfill, indexes) | M — 1.5–2 days |
| **Application** | `ISprintService` (CRUD + lifecycle + carry-over), `IIssueTaskService` (CRUD + state + dense reorder), idea promotion/return/delivery-status/sprint-assignment ops, board/idea-list phase filtering, delivery query + task rollup, audit + notification wiring | L — 4–5 days |
| **API** | Promotion/delivery routes (4), sprint routes (7), task routes (6), delivery query, contracts | M — 2.5 days |
| **Tests** | Promotion (phase flip, required effort, re-promote reject), provenance snapshot, delivery-status transitions, sprint lifecycle + carry-over, phase filtering, return-to-discovery, task CRUD + state stamping + dense ordering + Discovery rejection + retention across return-to-discovery + non-blocking Complete, backward-compat (no-op for un-promoted orgs) | L — 4 days |
| **Client (later wave)** | Promotion dialog, provenance panel, Sprint board + backlog, sprint admin, task checklist with drag-reorder, rail destination, phase filters | L — 6–8 days |
| **Slice 1 backend total** | | **~12–14 dev-days** |
| **Slice 2 — Outcomes & Roadmap** | `Outcome` entity, `IOutcomeService`, grouping mutation, derived roadmap query, 8 routes, roadmap grid UI, tests | M–L — **~5–7 dev-days** |
