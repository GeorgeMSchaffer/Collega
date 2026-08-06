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
