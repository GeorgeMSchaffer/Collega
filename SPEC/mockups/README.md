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

## Redesign Comps for the TypeScript Conversion (2026-08-30)

**These four comps are for a prospective stack conversion, not for the current Blazor app.** They exist to answer ticket `01` of the wayfinder map at `.scratch/typescript-conversion/map.md`, where Comp C "Fluent Editorial" is deliberately **unlocked** so the redesign can be argued on merit. Comp C remains the locked direction for the .NET client; nothing here changes that, and nothing here should be built against until ticket `01` is resolved.

Each comp commits to a different design language *and* a different component library, so the comparison tests both at once. All four render identical seed content (Northwind Labs, 4 boards, 6 statuses, the same 12 ideas) across the same five surfaces — board, ideas list, idea detail, statuses admin, login — plus an app shell with board switcher, user menu, a toggleable View As banner, and an AI draft strip. Open in a browser; all interactions are live.

- `comp-j-command-deck.html` — **Command Deck** (Tailwind, hand-rolled primitives): dense, keyboard-first, dark-by-default, in the Linear/Height idiom. Real Cmd/Ctrl+K command palette, `J`/`K` selection movement, `U` to upvote. Grayscale ground with a single cyan accent.
- `comp-k-material-workspace.html` — **Material Workspace** (Material Design 3 via CSS custom properties): navigation rail, rail-FAB, real MD3 color roles with independently correct light/dark schemes, five elevation levels, state layers and ripples. The argument that familiarity is a feature.
- `comp-l-canvas-board.html` — **Canvas Board** (Bootstrap 5.3, heavily re-themed): warm bone/sand ground with a terracotta accent, cards as physical objects, working drag-and-drop between columns with a keyboard-equivalent "Move to" menu. The argument that idea tracking should feel inviting.
- `comp-m-editorial-continuum.html` — **Editorial Continuum** (Tailwind): Comp C's typographic language carried forward and freed from Fluent's component constraints. Geist for chrome, Fraunces for content headings, hierarchy from type rather than containers, idea detail as a magazine article. Teal reserved exclusively for AI affordances.

### Findings worth carrying into the decision

Three critiques surfaced independently while the comps were built, and they are more useful than the comps themselves:

1. **Board density is contested by the product's own roadmap.** Comps L and M each flagged, without prompting, that a spacious board surface fights the seeded idea "Faster board load for 500+ ideas." Two directions converging on this suggests the board and the idea-detail surface may want different density treatments regardless of which direction wins.
2. **The real axis is who the primary user is.** Comp J's density serves someone who lives in the tool all day and reads as intimidating to an org admin triaging a handful of ideas weekly. Comp K's MD3 vocabulary is the inverse trade. That is a product question, not a taste question, and it should be settled before the look is.
3. **A Tailwind trap worth remembering in the real build:** an element carrying both the `hidden` attribute and a `flex`/`grid` display class renders visible, because the display class overrides the UA `[hidden]{display:none}` rule. It silently exposed drawers, modals and banners on load. A global `[hidden]{display:none!important}` fixes it.

Comps J and K were additionally verified by driving them in a real browser rather than by inspection, which caught several bugs that static review had missed.
