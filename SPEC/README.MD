# Collega Specifications

Canonical product and delivery specifications. This file is the index; the numbered documents are the content.

## Product Behavior (canonical)

- `decisions.md` — **dated log of decisions that constrain later work.** Read before reopening a settled question; supersessions are recorded rather than edited away.
- `00-project-brief.md` — product model, stack, solution structure, architecture rules
- `10-requirements.md` — requirement set
- `30-Contracts.md` — **canonical API route and payload contracts**; authoritative for endpoint and payload details
- `Specs Overview.md` — **derived, non-canonical** single-document summary; useful for orientation only. Last reconciled 2026-08-06. **Do not implement from it**, and where it disagrees with a canonical spec, the canonical spec simply wins — that is precedence, not a conflict to escalate.

### Feature specs — `20-feature-*.md`

| File | Area | Status |
|---|---|---|
| `20-feature-auth.md` | Authentication, seeding, password policy | MVP |
| `20-feature-user-login.md` | Login and session behavior | MVP |
| `20-feature-organizations-and-users.md` | Orgs, users, invite codes, CSV import | MVP |
| `20-feature-boards-and-statuses.md` | Boards, statuses, swimlanes | MVP |
| `20-feature-ideas-and-engagement.md` | Idea CRUD, tags, mentions, comments, upvotes | MVP |
| `20-feature-notifications.md` | Notification events (persisted, not delivered) | MVP |
| `20-feature-client-ui.md` | Client UI spec — locked design direction | MVP |
| `20-feature-client-ui-revisions.md` | Numbered client UI decisions (D1…) | MVP |
| `20-feature-user-defined-fields.md` | User-defined fields | Pulled into MVP 2026-08-08 |
| `20-feature-idea-type-fields.md` | Idea types and per-type fields | In MVP scope |
| `20-feature-view-as.md` | View As (act-as impersonation) | Post-MVP, **scheduled Sprint 6** |
| `20-feature-ai-idea-assist.md` | AI-assisted idea drafting (brainstorm chat → Idea fields) | Post-MVP, **scheduled Sprint 7** |
| `20-feature-issues-and-delivery.md` | Idea → execution handoff | Post-MVP |
| `20-feature-oauth.md` | OAuth/SSO | **Deferred** |
| `20-feature-saml.md` | SAML | **Deferred** |
| `20-feature-reporting.md` | Reporting | **Deferred** |

## Delivery, Planning, and Status

Exactly two files answer "where does work stand" and "what is next". Everything else in this section is supporting detail.

- `implementation-agent-tracker.md` — **authoritative "what's built right now."** Read its Current Status section fresh before any status or planning claim (see its Ground-Truth Verification section).
- `95-next-sprints.md` — **authoritative "what's next."** Index of remaining sprint scope; per-sprint plans live in `sprints/`, completed sprints move to `sprints/archive/`.
- `Bug Triage.md` — **authoritative pre-feature bug/tweak queue**, kept short on purpose. Unresolved `TODO` items take priority over new feature work unless the user explicitly approves an exception. Fixed items move to `archive/bug-triage-completed.md`; promoted items are **deleted** once a spec or sprint file owns them. Never leave an item in two places.
- `ideas-inbox.md` — unrefined feature ideas. Nothing there is scheduled or approved, and **nothing there gates a sprint**; items are picked up only when the user asks.
- `90-definition-of-done.md` — exit criteria
- `40-test-strategy.md` — what must be covered, per feature
- `60-spec-q-and-a-backlog.md` — clarification decisions and unresolved scope questions

The original epic/milestone/estimate planning documents (`70-delivery-backlog.md`, `80-workstream-roadmap.md`, `85-implementation-timeline.md`) were **archived on 2026-08-11**: each asserted the project was unstarted, which stopped being true once T001-T067 merged. See `archive/` below.

## Technical and Deployment Plans

- `50-technical-implementation-plan.md` — implementation plan across layers
- `50-azure-deployment.md`, `50-azure-api-cicd.md` — Azure target (Sprint 8; renumbered from 7 on 2026-08-11)
- `50-postgres-migration.md` — Postgres migration plan (Sprint 5)
- `50-kubernetes-deployment.md` — Kubernetes deployment notes
- `typescript-conversion-map/` — the twelve conversion tickets and the charting map behind `50-typescript-migration.md`; its `README.md` records which tickets are answered and one open conflict on ticket `01`
- `50-typescript-migration.md` — **the costed, sequenced plan for the .NET → TypeScript conversion** (Sprint 9; assembles the `wayfinder` map in `typescript-conversion-map/`). Its Wave A has a deadline earlier than the sprint: golden capture must run **before or during Sprint 8**, while the .NET API still exists.

## Supporting Material

- `mockups/` — SVG/HTML UI mockups and throwaway review comps. **`comp-p-focus-roadmap.html` is the locked direction as of 2026-08-31** (structure locked, palette open — see `decisions.md`); earlier comps are kept for history.
- `ui-ux-spec-template.md` — start here for a new client layout/interaction spec
- `SPECKIT/specs/<NNN-feature>/spec.md` — spec-kit-style **downstream copies** of the canonical files; edit the canonical file first

## `archive/` — historical, do not plan or implement from

**Do not read these unless you are asked for history, or you need to know why a past decision was made.** They are excluded from normal spec reading on purpose: each is superseded, and several assert a world-state that is no longer true. Nothing here is canonical, and nothing here gates work.

| File | What it is | Why archived |
|---|---|---|
| `implementation-agent-tracker-archive.md` | Full narrative history — per-slice write-ups, judgment calls, UI sign-off history, the original T001-T052 backlog | Split from the live tracker to keep Current Status short |
| `70-delivery-backlog.md` | Original epic/task breakdown | Asserts every epic is "planned and pending"; T001-T067 are merged |
| `80-workstream-roadmap.md` | Original milestone/workstream sequencing | Asserts no milestone is in progress or complete |
| `85-implementation-timeline.md` | Advisory agent-day estimates | Lists `global.json`, `Collega.sln`, and the `src/` skeletons as not yet created; all exist |
| `bugs.md` | Historical bug log | Superseded by `Bug Triage.md`, the active queue |
| `bug-triage-completed.md` | Resolved bug-triage items, plus the decision record for entries promoted into specs/sprints | Split out 2026-08-12 to keep the queue short |
| `draft-porting-proposal.md` | **⛔ DO NOT IMPLEMENT.** Unapproved TypeScript/Next.js/NestJS evaluation draft | Never approved; the canonical stack is unchanged |

## Working Rules

- Update the canonical `SPEC/*.md` file **first** when an implementation decision changes behavior, then align tests and implementation.
- After editing canonical behavior, validate consistency across the requirements, feature, contract, and test documents.
- If behavior is ambiguous or two specs conflict, ask rather than silently picking one.
