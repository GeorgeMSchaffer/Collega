# UI Mockups

These mockups are static SVG artifacts based on the current Collega specs and shaped around Fluent UI component patterns and usability best practices.

## Screens
- `01-login-and-org-selection.svg`: legacy sign-in and organization-selection concept; retain as historical artifact and replace in implementation with globally unique email flow
- `02-admin-organizations.svg`: Site Admin organization list and creation surface
- `03-admin-users.svg`: organization-scoped user management
- `04-board-overview.svg`: selected board view with compact swimlane cards (title, priority, assigned-to, upvote)
- `05-idea-detail-panel.svg`: detail overlay edit view opened from board card title with full idea fields
- `06-status-management.svg`: organization status management with soft-delete context
- `07-auth-lockout-and-temp-reset.svg`: lockout messaging plus admin-issued temporary password reset one-time reveal workflow
- `08-first-login-password-change.svg`: seeded Site Admin forced password change flow with inline complexity checklist
- `09-board-configuration-swimlanes.svg`: final board configuration comp using Alternative B with visual swimlane mapping and immediate-save reorder cues
- `10-board-empty-state-guided-setup.svg`: final board empty-state comp using Alternative B with card-first onboarding and visible default swimlane columns
- `11-idea-detail-editorial-variant.svg`: alternate editorial visual direction for idea collaboration and activity rail
- `12-idea-card-and-overlay.svg`: dedicated compact card plus detail overlay interaction mockup

## Design System Pass + Hybrids (2026-08-31)

**All 36 comp HTML files were restyled in place** to a business-professional direction (client feedback: "think Trello, Jira, Monday"). Nothing was restructured — only palette, corner radius, and typography changed.

| Change | Detail |
|---|---|
| Palette | 224 distinct colors → 29, built from the 7 client-chosen seeds |
| Corners | All `border-radius` (805 declarations + 47 CSS variables) → `2px`; only avatars keep `50%` |
| Typography | Geist / Geist Mono via Google Fonts, with a system fallback chain |

### Palette rules

Seeds: `#5B7FA3` `#5F9E93` `#6FAF7A` `#C9A65C` `#C97A7A` `#F7F9FB` `#243447`.

Only `#243447` clears WCAG AA as body text (12.67:1). The five chromatic seeds sit at 2.3–4.2:1, so each is used **as a fill, chip, or lane marker only**, paired with a derived `-ink` for text and lighter tints for surfaces. Each `-ink` is derived to clear 4.5:1 against its OWN `-soft` tint (the worst case it appears on), not merely against white — deriving against white leaves chips at ~4.1:1:

| Role | Fill (seed) | Ink (text, ≥4.5:1) | Line | Soft |
|---|---|---|---|---|
| Blue | `#5B7FA3` | `#527292` | `#D1DBE5` | `#F0F4F7` |
| Teal | `#5F9E93` | `#4A7972` | `#D2E4E1` | `#F1F6F5` |
| Green | `#6FAF7A` | `#457C4F` | `#D1E6D5` | `#F0F7F1` |
| Amber | `#C9A65C` | `#8A6D2E` | `#EDE2C9` | `#F9F6EE` |
| Red | `#C97A7A` | `#B64B4B` | `#EACCCC` | `#F8EFEF` |

Neutrals ramp from `#243447` with saturation decaying as lightness rises, so mid-greys read neutral rather than blue: `--ink #243447`, `--ink-2 #3E4E60`, `--ink-3 #5D6C7E`, `--ink-4 #818E9C`, `--line-2 #C5CBD3`, `--line #DDE1E6`, `--surface-2 #F1F3F6`, `--bg #F7F9FB`.

**Never encode meaning in colour alone** — status, idea type, and priority are always spelled out as text.

### Hybrid comps

Three new comps mix the strongest parts of the client's preferred set (D "Focus Desk", H "Loop", I "Memory"). All use the token block above; copy it verbatim rather than re-deriving it.

- `comp-j-desk-slideout.html` — **Hybrid A: Desk + Slideout.** Comp D's shell, rail and lane board, with every create/edit surface converted to comp I's right-hand 620px slideout (`.drawer` + `.scrim`) instead of a route change or centred modal. Screens: board, new idea, idea detail, add status, invite user.
- `comp-k-desk-loop.html` — **Hybrid B: Desk + Loop rail.** Comp D's shell with comp H's activity surface docked as a permanent 340px rail beside the idea (discussion / mentions / history tabs), so the debate never has to be reopened elsewhere. Screens: idea + rail, inbox, thread, preferences.
- `comp-l-delivery-desk.html` — **Hybrid C: Delivery Desk.** Hybrid A plus the delivery surfaces. Screens: promote gate, sprint board, issue + tasks, backlog & planning, roadmap.
- `comp-m-roadmap-single.html` / `comp-n-roadmap-multi.html` — **decision comps**, not directions. Same shell and token block; see the cardinality section below.

### Delivery scope, reconciled

`comp-l-delivery-desk.html` renders **Tasks** and **Roadmap**, both of which were explicit Non-Goals in `SPEC/20-feature-issues-and-delivery.md` when the comp was built. Reviewing the comp is what settled it: the product owner brought both into scope on 2026-08-31, and **the canonical spec was reconciled the same day**. It now specifies Tasks as Slice 1 (P0) and Outcomes/Roadmap as Slice 2 (P1), with the Non-Goals rewritten from "not now" to a much narrower "not ever, and here is the line".

Where Comp L follows the spec, it follows it exactly: Idea and Issue are the same row in two phases (`Discovery` -> `Delivery`), promotion is an explicit audited gate, delivery statuses are the fixed set (`Pending / Scoping / Development / Review / Complete`), and `Effort` is T-shirt sizing rather than story points.

**Task model (decided 2026-08-31, now canonical):** Tasks are checklist items belonging to an **Issue**; the Issue is the unit assigned to a sprint. A task therefore can never be stranded in a sprint its parent has left. First-class independently-assignable tasks were considered and rejected as too heavy for "Jira light".

### Roadmap cardinality: comp M vs comp N (2026-08-31)

One question gates Slice 2: **may an Issue sit under more than one Outcome?** These two comps exist to settle it, and are **generated from a single template** so they differ *only* where that decision bites — diff them screen for screen and what you see is exactly what the choice costs.

- `comp-m-roadmap-single.html` — **Single-parent.** An issue has one home. `Idea.OutcomeId`, one nullable FK.
- `comp-n-roadmap-multi.html` — **Multi-parent.** An issue serves every outcome it advances. A join table.

Both carry the same five screens (Roadmap / Outcome detail / Issue / Grouping drawer / What it costs) over the **same 16 delivery issues**, so the arithmetic is directly comparable:

| | comp M (single) | comp N (multi) |
|---|---|---|
| Memberships | 14 | 18 over 14 distinct |
| Row totals | Partition the delivery set — they sum to it | A cover — `18 != 16`, every total needs a distinct-count beside it |
| Derived spans | Clean staircase | Smeared: a shared issue drags an outcome's bar into a quarter its own work does not start in |
| Issue field | One value, same grammar as the Sprint picker | A chip list with an add affordance and a defined empty case |
| Grouping action | A **move** — leaves the previous outcome | An **add/remove** — nothing is displaced |
| Reversibility | single -> multi later is a cheap forward migration | multi -> single later is **lossy**; a human picks which grouping survives |

Each comp's final screen argues its own side *and* states its own cost, including the failure mode to watch for. No default is asserted in the spec — this is a genuine fork, and it is recorded as the one **blocking** Open Question in `SPEC/20-feature-issues-and-delivery.md`. Slice 1 does not depend on the answer and can be built while it is open.

## Full-App Comps (2026-07-30)

Three interactive HTML comps covering every page (Login, First Login, Home, Admin Hub, Organizations, Users, Statuses, Board, Idea Detail, Change Password). Open in a browser and use the top tab bar to switch screens. Each explores a distinct direction inspired by Jira/Trello best practices while staying implementable with Fluent UI Blazor components.

**Selection (2026-07-30): Comp A "Command Center" is the chosen UI/UX layout for implementation**, restyled to use the typography and color palette from the SVG mockups (01–12): `"Segoe UI", Arial, sans-serif`, slate neutrals (`#0f172a`/`#334155`/`#64748b`), `#f8fafc` background, and `#1d4ed8`/`#1e3a8a` blue accent. See `SPEC/20-feature-client-ui.md` for the full design-direction spec. Comps B and C are retained as explored alternatives.

- `comp-a-command-center.html` — **Command Center** (Jira-inspired): persistent left nav rail with grouped sections, breadcrumbs, dense data tables with command bars, KPI dashboard, swimlane board with priority edge accents, and a two-pane idea overlay (content + metadata sidebar). Best for power users and admin-heavy workflows.
- `comp-b-board-first.html` — **Board First** (Trello-inspired): top app bar only (no sidebar), board tiles on Home, full-bleed colored board canvas, card-based org management, and a Trello-style idea overlay with side action buttons. Best for approachability and collaboration-first orgs.
- `comp-c-fluent-editorial.html` — **Fluent Editorial**: slim icon rail, large page headers with pivot tabs, list-style lanes (grouped rows instead of columns), and a full-page article-style idea detail with a facts rail. Best for readability, accessibility, and discussion-heavy usage.

All three comps demonstrate spec behaviors: globally unique email sign-in (no org picker), lockout after 5 failed attempts, one-time temporary passwords, first-login forced password change with inline complexity checklist, soft-delete status retirement with minimum-lane guardrail, immediate-save reorder cues, compact cards (title, priority, assignee, upvote) with title-click detail, mention highlighting, and comment character-count feedback.

## Design Intent
- Fluent UI component language: top app bar, nav, cards, command bars, tables, panels, buttons, badges, and dialogs
- Accessibility and usability focus: strong hierarchy, visible labels, predictable actions, readable density, and clear empty-state/help text
- Role-aware surfaces: admin tools are distinct from day-to-day collaboration views
- Error prevention cues should include inline mention validation, comment character-count feedback, and guided empty states with primary actions

## Visual Directions in This Set
- Command Center: denser, operational views for admin and board-configuration workflows
- Guided Setup: onboarding-heavy screens with strong helper content and primary actions
- Editorial: readability-focused collaboration layout with clearer narrative hierarchy

## Board Direction Selection (2026-07-24)
- Alternative B was selected for board configuration and board empty-state flows.
- The selected direction emphasizes card-first scanning with visible lane mapping and guided setup actions.
- Cards are intentionally compact in-lane and move full editing into an in-context overlay.

## Spec Coverage Mapping
- Authentication and Access (`SPEC/20-feature-auth.md`)
	- `07-auth-lockout-and-temp-reset.svg` covers lockout feedback (5 failed attempts in 15 minutes), temporary-password issuance cues, and one-time display guidance.
	- `08-first-login-password-change.svg` covers seeded Site Admin first-login password change requirement and complexity rule feedback.
- Organizations and Users (`SPEC/20-feature-organizations-and-users.md`)
	- `10-board-empty-state-guided-setup.svg` demonstrates guided empty-state behavior pattern with a clear primary action.
- Boards and Statuses (`SPEC/20-feature-boards-and-statuses.md`)
	- `09-board-configuration-swimlanes.svg` covers swimlane subset configuration, minimum-lane guardrail, and immediate save after reorder.
	- `10-board-empty-state-guided-setup.svg` covers board empty-state guidance and default-lane orientation.
- Ideas and Engagement (`SPEC/20-feature-ideas-and-engagement.md`)
	- `04-board-overview.svg` and `12-idea-card-and-overlay.svg` cover compact card fields and title-click overlay interaction.
	- `05-idea-detail-panel.svg` and `12-idea-card-and-overlay.svg` cover full in-overlay editing for idea fields, tags, mentions, assignment, optional due date, comments, and upvote behavior.
	- `11-idea-detail-editorial-variant.svg` reinforces tag/mention/comment/upvote affordances and role-aware collaboration cues.
- Notifications and Audit (`SPEC/20-feature-notifications.md`)
	- `07-auth-lockout-and-temp-reset.svg` and `11-idea-detail-editorial-variant.svg` include event-oriented cues that align with deferred delivery and audit-focused MVP behavior.

## Fluent UI Blazor Implementation Notes
- These artifacts are intended for implementation with Fluent UI Blazor components and services.
- Keep required provider components in root layout when implementing service-based UI: `FluentToastProvider`, `FluentDialogProvider`, `FluentMessageBarProvider`, `FluentTooltipProvider`, and `FluentKeyCodeProvider`.
- Use service patterns for dialogs and toasts during implementation rather than toggling dialog visibility directly.
- Do not add manual script or stylesheet tags for the Fluent library; rely on package-provided assets and initializers.
