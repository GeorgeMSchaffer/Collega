# Collega Specifications

Canonical product and delivery specifications. This file is the index; the numbered documents are the content.

## Product Behavior (canonical)

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
| `20-feature-ai-idea-assist.md` | AI-assisted idea drafting (brainstorm chat → Idea fields) | Post-MVP, **scheduled Sprint 7** |
| `20-feature-issues-and-delivery.md` | Idea → execution handoff | Post-MVP |
| `20-feature-oauth.md` | OAuth/SSO | **Deferred** |
| `20-feature-saml.md` | SAML | **Deferred** |
| `20-feature-reporting.md` | Reporting | **Deferred** |

## Delivery, Planning, and Status

- `implementation-agent-tracker.md` — **authoritative "what's built right now."** Read its Current Status section fresh before any status or planning claim (see its Ground-Truth Verification section).
- `implementation-agent-tracker-archive.md` — full narrative history; per-slice write-ups, judgment calls, UI sign-off history, the original T001-T052 backlog.
- `Bug Triage.md` — **authoritative pre-feature bug/tweak queue.** Unresolved `TODO` items take priority over new feature work unless the user explicitly approves an exception. Move fixes to `COMPLETED` with date and verification note; never leave an item in both sections.
- `95-next-sprints.md` — index for remaining pre-MVP sprint scope. Per-sprint plans live in `sprints/`; completed sprints move to `sprints/archive/`.
- `70-delivery-backlog.md` — task-level delivery backlog
- `80-workstream-roadmap.md` — workstream sequencing
- `85-implementation-timeline.md` — advisory effort/timeline estimates; **not canonical behavior**
- `90-definition-of-done.md` — exit criteria
- `40-test-strategy.md` — what must be covered, per feature
- `60-spec-q-and-a-backlog.md` — clarification decisions and unresolved scope questions

## Technical and Deployment Plans

- `50-technical-implementation-plan.md` — implementation plan across layers
- `50-azure-deployment.md`, `50-azure-api-cicd.md` — Azure target (Sprint 8; renumbered from 7 on 2026-08-11)
- `50-postgres-migration.md` — Postgres migration plan (Sprint 5)
- `50-kubernetes-deployment.md` — Kubernetes deployment notes

## Supporting Material

- `mockups/` — SVG/HTML UI mockups and throwaway review comps; `comp-c-*` is the live direction, `comp-a-*`/`comp-b-*` are rejected alternatives kept for history
- `ui-ux-spec-template.md` — start here for a new client layout/interaction spec
- `SPECKIT/specs/<NNN-feature>/spec.md` — spec-kit-style **downstream copies** of the canonical files; edit the canonical file first
- `bugs.md` — historical bug log, retained as completed history. `Bug Triage.md` is the active queue.
- `draft-porting-proposal.md` — **⛔ DO NOT IMPLEMENT.** An unapproved TypeScript/Next.js/NestJS evaluation draft. The canonical stack is unchanged.

## Working Rules

- Update the canonical `SPEC/*.md` file **first** when an implementation decision changes behavior, then align tests and implementation.
- After editing canonical behavior, validate consistency across the requirements, feature, contract, and test documents.
- If behavior is ambiguous or two specs conflict, ask rather than silently picking one.
