# Feature: Issues and Delivery (Idea → Execution)

## Overview

Today Collega ends where most idea tools end: an idea gets proposed, debated, upvoted, tagged, and eventually reaches a terminal ideation status (`Complete`). What happens next — *actually building the thing* — happens somewhere else (a spreadsheet, Jira, nothing). That handoff is where every competitor loses the story: the moment an idea becomes committed work, its provenance (who proposed it, who upvoted it, the debate, the business case) is retyped away.

This feature closes that loop **inside Collega** by promoting an idea into a lightweight delivery track — Sprints and Issues executed with just enough Agile ceremony — **without creating a second object**. An Issue is not a copy of an Idea; it is the same row in a later *phase* of its life. Promotion flips an item from **Discovery** (ideation on a board) to **Delivery** (execution in a sprint), and the item carries its entire history forward. The differentiator is not "we also do sprints" — it is **provenance-preserving delivery**: mid-sprint, "why are we building this?" is one click away.

This is the deliberately-scoped **first slice** ("Now") of the Roadmap → Sprint → Issue concept, which originated as a user brainstorm and was promoted into this spec — this file is now its only canonical home. Roadmaps/Epics, the Impact×Effort prioritization view, crowd-backlog auto-surfacing, and AI-assisted promotion are **explicitly deferred** to later slices (see [Non-Goals](#non-goals) and [Future Considerations](#future-considerations-p1p2)). The guardrail throughout: every field and screen must earn its place by *closing the loop* or *preserving provenance*, never by matching a Jira feature.

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
| Sprint ↔ Roadmap nesting | Sprint is **not** nested under Roadmap in this slice (Roadmap is deferred). Sprint is a flat, time-boxed container; an Issue belongs to zero or one Sprint. |
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
4. **Stay lightweight on purpose.** Just enough Agile to run a sprint — no story points, velocity, burndown, sub-tasks, or per-issue Gantt in this slice. Ceremony is a Non-Goal until real usage demands it.
5. **Zero disruption to existing behavior.** Orgs that never promote anything see exactly today's product; ideation boards, ideas, and all existing flows are unchanged.

---

## Non-Goals

- **A separate `Issue` entity/table.** An Issue is a Delivery-phase Idea. A parallel object would reintroduce the provenance-loss problem this feature exists to solve.
- **Roadmaps / Epics / outcome grouping over time.** Deferred to the next slice. Sprints are flat here.
- **The Impact × Effort prioritization quadrant** and **crowd-backlog auto-surfacing** ("top-voted ideas not yet promoted"). The enabling fields land now (`Effort`, `Phase`), but the views are deferred (P1).
- **AI-assisted promotion** (drafting acceptance criteria / task breakdown from the idea + comments). Deferred (P1); it rides the existing Haiku extraction pattern when built.
- **Story points, velocity, burndown/burnup, capacity planning.** Deferred (P2), gated behind demonstrated demand. `Effort` stays T-shirt sizing.
- **Sub-task / task decomposition** of an Issue into child work items. Deferred (P2).
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
- **Delivery queries:** a phase-aware list for the sprint board and backlog — `ListDeliveryAsync(orgId, sprintId? , deliveryStatus?)` returning the existing compact card projection plus `deliveryStatus`, `effort`, `sprint`, and provenance summary.

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

---

## Audit & Notifications

Reuses the existing audit-event and `INotificationWriter` patterns (`SPEC/20-feature-notifications.md`); self-notifications remain suppressed.

- **Audit events** (new types): `IdeaPromotedToIssue`, `IssueReturnedToDiscovery`, `IssueDeliveryStatusChanged`, `IssueSprintAssignmentChanged`, `SprintCreated`, `SprintStarted`, `SprintCompleted`, `SprintUpdated`, `SprintDeleted`.
- **Notification events** (new types, notify idea author + assignees): `IdeaPromoted` and `IssueDeliveryStatusChanged`. The stored canonical link is `/ideas/{ideaId}` (drawer-addressable, the same item), consistent with the notifications spec.

---

## Client UI (later wave, per repo convention)

Layouts here are **directional**; the locked Comp C system (`SPEC/mockups/comp-c-review-06-lockin-v5-final.html`) and its mobile gap apply. Throwaway review comps should precede production Blazor per the working rules.

- **Promotion action** on Idea Detail: a "Promote to Issue" button (visible to author + in-scope admins on Discovery-phase items) opens a small confirm dialog — required **Effort** selector, optional **Sprint** picker (or "Backlog"), optional note — then flips the page into its Issue/Delivery lens.
- **Issue/Delivery lens** on the same detail page: ideation Type is read-only context; a **Provenance panel** shows "Originated as an idea by *X* on *date* · *N* upvotes at promotion (*M* now) · promoted by *Y* on *date*", with the original comment thread inline. This panel is the differentiator — it ships in this slice.
- **Sprint board** (`/delivery` or `/sprints/{sprintId}`): fixed 5-swimlane kanban (`Pending`→`Complete`), Issue cards reusing the existing compact card with an `Effort` chip and delivery status. Drag between swimlanes mirrors the idea-board move (optimistic, revert on failure); keyboard/touch use the detail status selector — consistent with existing board mechanics.
- **Delivery backlog** view: Delivery-phase Issues with no sprint, the source list admins pull from.
- **Sprint admin**: create/edit/start/complete sprint; a rail "Delivery" (or "Sprints") destination is added to the 64px icon rail.
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
- **[P0] Audit coverage.** Promotion, return, delivery-status change, sprint assignment, and all sprint lifecycle transitions generate audit events.

### Nice-to-Have (P1)

- **[P1] Crowd backlog view** — a standing "Top-voted Discovery ideas not yet promoted" list (trivial query once `Phase` exists). High-signal intake funnel.
- **[P1] Carry-over-to-next-sprint** option on sprint completion (in addition to backlog default).
- **[P1] AI-assisted promotion** — draft acceptance criteria / suggested task list from the idea description + comment thread at the gate, reusing the existing Haiku extraction pattern and human-review-before-commit discipline.
- **[P1] Author self-promote toggle** — an org setting for whether plain authors may promote or only request promotion.

### Future Considerations (P1/P2)

- **[P1→P2] Impact × Effort quadrant** — a "what to promote next" view using Business Impact × `Effort` (both fields now exist). The prioritization artifact Jira makes teams build by hand.
- **[P2] Roadmaps / Epics** — outcome/theme grouping over time, with Issues rolling up and dates living on roadmap items (Gantt-ish). Sprints stay orthogonal (not nested under Roadmap).
- **[P2] Story points / velocity / burndown** — only if demonstrated demand justifies the ceremony; `Effort` may map to points behind the scenes.
- **[P2] Sub-tasks / Issue decomposition** and **cross-issue dependencies.**
- **[P2] Configurable delivery statuses** per org.
- **[P2] Sprint/roadmap AI narrative** for stakeholder updates (folds into the deferred reporting phase).

---

## Migration Strategy

**EF migration `AddDeliveryAndSprints`:**
- `ideas` gains: `phase` (int, NOT NULL, default `0`/Discovery — existing rows backfill to Discovery), `effort` (int, null), `delivery_status` (int, null), `sprint_id` (guid, null, FK → `sprints`, `ON DELETE` restricted; unassignment is handled in the app layer), `promoted_at_utc` (timestamptz, null — `DateTime` with `Kind = Utc`, per the Npgsql mapping in `SPEC/50-postgres-migration.md`), `promoted_by_user_id` (guid, null), `upvote_count_at_promotion` (int, null).
- New table `sprints` (snake_case, per Infrastructure convention) with `organization_id`, `name`, `goal`, `start_date`, `end_date`, `owner_user_id`, `state`, `is_deleted`, and audit columns.
- Indexes: `(organization_id, phase)` on `ideas` (board/backlog filtering); `sprint_id` on `ideas`; `(organization_id, state)` on `sprints`.
- Because every existing idea backfills to `Discovery` and no sprints exist, all ideation boards and idea flows are byte-for-byte unchanged post-migration; delivery surfaces are simply empty.
- Touches only new/changed tables, so it should merge cleanly against `CollegaDbContextModelSnapshot` provided no other in-flight slice adds a concurrent migration.

---

## Impact on Existing Specs

Approving this spec requires these canonical edits *before* implementation (per repo working rules):

1. **`SPEC/20-feature-ideas-and-engagement.md`** — introduce the Discovery/Delivery **phase** concept, the optional `Effort` field, and the **promotion gate**; note that the ideation board now filters to `Phase == Discovery`; record that the deferred *Approval Workflow* is partially realized as the promotion gate (the always-review-before-commit principle already applies to AI-assisted creation).
2. **`SPEC/20-feature-boards-and-statuses.md`** — document ideation-board phase filtering and the new **Sprint board** with its fixed delivery statuses; cross-reference the promotion gate against the deferred approval-workflow decisions.
3. **`SPEC/20-feature-notifications.md`** — add `IdeaPromoted` and `IssueDeliveryStatusChanged` notification types (recipients: idea author + assignees; self-suppressed; link `/ideas/{ideaId}`).
4. **`SPEC/30-Contracts.md`** — add the promote / return-to-discovery / delivery-status / sprint-assignment routes and the sprint CRUD + lifecycle routes and the `/delivery` query.
5. **`SPEC/20-feature-client-ui.md`** and **`SPEC/20-feature-client-ui-revisions.md`** — add the Delivery rail destination, the Sprint board, the promotion dialog, and the provenance panel; note the still-open mobile/narrow-viewport pass applies.
6. **`SPEC/archive/70-delivery-backlog.md`** / **`SPEC/archive/80-workstream-roadmap.md`** — add this slice as a post-MVP milestone ("Idea → Delivery"), sequenced after the MVP release gate.

---

## Open Questions

- **[Product]** Should promotion be allowed from any Discovery status, or gated on the item first reaching a specific ideation status (e.g. `Complete`)? *Default (chosen): any Discovery status — the gate is the explicit decision, not the status.* An org-level "require status X before promote" is a P2 option. — non-blocking.
- **[Product]** May a plain author self-promote, or only *request* promotion for an admin to confirm? *Default: author may self-promote (matches the deferred approval decision).* The P1 toggle can tighten this. — non-blocking.
- **[Product]** On sprint completion, is backlog the right default for unfinished Issues, or should carry-over-to-next be the default? *Default: backlog; carry-over is P1.* — non-blocking.
- **[Eng]** Should exactly one sprint be `Active` per org at a time (single-team assumption), or may multiple run concurrently? *Default: no single-active constraint in this slice.* — non-blocking.
- **[Product]** Is `ReturnToDiscovery` the right recovery model, or should mis-promotion be prevented by a stronger confirm only? *Default: reversible return, admin-only.* — non-blocking.

---

## Effort Sizing (backend-first; Client is a later wave per repo convention)

| Layer | Work | Estimate |
|---|---|---|
| **Domain** | `IdeaPhase`/`EffortLevel`/`DeliveryStatus`/`SprintState` enums, `Idea` delivery facets + invariant methods, `Sprint` entity + lifecycle invariants | S–M — 1–1.5 days |
| **Infrastructure / EF** | `Sprint` config, 7 new `ideas` columns, `sprints` table, `AddDeliveryAndSprints` migration (Discovery backfill, indexes) | S–M — 1–1.5 days |
| **Application** | `ISprintService` (CRUD + lifecycle + carry-over), idea promotion/return/delivery-status/sprint-assignment ops, board/idea-list phase filtering, delivery query, audit + notification wiring | M–L — 3–4 days |
| **API** | Promotion/delivery routes (4), sprint routes (7), delivery query, contracts | M — 2 days |
| **Tests** | Promotion (phase flip, required effort, re-promote reject), provenance snapshot, delivery-status transitions, sprint lifecycle + carry-over, phase filtering, return-to-discovery, backward-compat (no-op for un-promoted orgs) | M–L — 3 days |
| **Client (later wave)** | Promotion dialog, provenance panel, Sprint board + backlog, sprint admin, rail destination, phase filters | L — 5–7 days |
| **Backend total** | | **~10–12 dev-days** |
