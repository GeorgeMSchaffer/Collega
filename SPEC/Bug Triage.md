# Bug Triage

This document is the authoritative queue for bugs and minor tweaks that must be addressed before new feature work begins.

## Workflow

- Read this document before starting or resuming feature implementation.
- Items under `TODO` take priority over new features. Do not start a new feature while `TODO` contains unresolved items unless the user explicitly approves an exception.
- When an item is fixed and its focused validation passes, remove it from `TODO` and add it to `COMPLETED` with the completion date and a concise verification note.
- Do not duplicate an item between sections. If a change is incomplete, unverified, or deferred, keep it under `TODO` and note its status there.
- New bugs and minor tweaks belong under `TODO`; feature ideas remain in the delivery backlog.

## TODO
 * Move the add new button on list pages to be on the right.
 * 

### T-UI-3 · Idea Detail slide-in drawer + create modal — **NEXT MAJOR ITEM (pre-MVP)**
Design locked 2026-08-10 (user-approved as the exception to this triage gate). Replace the full-page Idea Detail with a right slide-in **drawer** (detail + inline edit, ≈620px) and a centered **create modal** (≈760px), used from every idea entry point (Ideas list, Board List rows, Swim Lane cards). Canonical spec: `SPEC/20-feature-client-ui.md` → **Idea Detail Surface**; reference comp `SPEC/mockups/comp-c-review-09-detail-surfaces.html` (Right slide-in pattern); full decision log in `SPEC/implementation-agent-tracker.md`.
- Drawer = read view with Edit (in-place swap, Cancel/Save changes footer); create = modal, returns to list on success (no auto-open drawer).
- Full parity in the drawer: all fields + UDFs, tags, mentions, 0–5 assignees, comments, upvote, status move (live re-slot behind the drawer), admin-only delete.
- URL-addressable via `?idea={ideaId}` on the current route; bare `/ideas/{ideaId}` opens the list with the drawer open; the `/ideas/{ideaId}/edit` route is retired; notification `ideaLink` → `/ideas/{ideaId}`.
- Inaccessible id → underlying list/board with a not-found/permission notice, no drawer. Narrow viewport: full-width drawer sheet + full-screen modal.
- **Fold in T-UI-2's Ideas-list gaps** (uniform page-size options, all-column search, Idea Type/Status dropdown filters) as part of this pass since it rebuilds the list interactions.
- Confirm with the user before spawning a UI/UX Developer implementation pass (scoped decision per CLAUDE.md).

### T-UI-1 · Navigation icon family
Replace the current navigation icons with the [Fluent System Icons](https://github.com/microsoft/fluentui-system-icons) family across the rail/navigation.
- *Status note (2026-08-10):* a Fluent System Icons 4.11.0 refresh already landed for the rail / reorder / drag surfaces (see COMPLETED 2026-08-09). Confirm whether that pass fully satisfies this item or a broader icon sweep is still wanted before closing.

### T-UI-2 · List View enhancements
Apply consistently across the list/table views (Users, Organizations, Ideas, Boards, Statuses where applicable):
- Page-size selector: 10 / 25 / 50 / 100 results.
- Pagination controls.
- Search box that searches **all columns shown in the list**, not just the title.
- Ideas List: add **Idea Type** and **Idea Status** dropdown filters (alongside the existing filter chips).
- *Status note (2026-08-10):* the `/ideas` global list already ships server-side paging (25/50/100/250) + search + filter chips; scope this to the gaps — uniform page-size options across all lists, all-column search, and the Ideas Type/Status dropdowns — rather than rebuilding what exists.

## IDEAS

Help me come up with a new feature.  The overall idea is that the board is used to manage the process of brainstorming and fleshing out ideas, think of it as a Trello, Jira, Workspace hybrid.  I want to enable the user to manage the process of implementing the idea using AGILE Best practices.  Admins should be able to create Roadmaps. These roadmaps, will consit of Sprints, which consits of Tasks, which are Ideas translated to tasks.  However the idea seems a bit uncooked and potential akward.  Help me to refine the idea for this feature by making recommendations, referencing best practices, and ideas that could differantiate product from Trello and Jira.

    * Main Funtionality
        * Create Roadmap(s)
            * Should have the following fields
                * Title
                * Goal Description Field
                * Start Date
                * End Date
                * The ability to assign Roadmap Owner(s)

        * Sprints should be assignable to a Road Map, the fields on the Sprint:
            * Title
            * Start Date
            * End Date
            * Sprint Goal
            * Sprint Owner
            * Tags
        * Sprints will consits of one to many Issues.  Issues are an extension of an Idea, however it should have additional fields for:
            * Start Date
            * End Date
            * Effort (Low, Medium, High)
            * Sprint Tags
            * Status: Pending, Scoping, Development, Review and Complete


## COMPLETED
- 2026-08-09 — Site Admin global visibility and stale-session handling completed: Site Admin Home, Boards, Ideas, Users, Statuses, and User-Defined Fields aggregate every active organization with explicit organization labels and scoped management links; Board and Idea detail derive related-data context from the owning board rather than an account membership. Every authenticated API path now clears an invalid persisted token and redirects to Login with the expired-session message, and Development HTTP hosting no longer runs HTTPS redirection. Verified by two clean Release solution builds, two full 425-test passes, and a live browser reproduction that cleared the stale token and reached `/login?sessionExpired=true` instead of leaving the page on 401.
- 2026-08-09 — Settings information architecture completed: `/settings` is a role-scoped link-card hub; organizations moved to `/settings/organizations`; Org Admin users moved to `/settings/users`; and Users, Statuses, and User-Defined Fields link to dedicated list/form views. Site Admin organization rows expose scoped Users, Statuses, and Fields actions. Verified by focused and full solution builds plus live Org Admin/member browser checks, including invite-code preservation, authorization, and a 375px responsive pass.
- 2026-08-09 — Session lifetime completed: verified the 480-minute absolute expiry in persisted browser state, the warning dialog and countdown after 28 minutes idle, activity reset through Stay signed in, automatic logout after 30 minutes idle, expired-session confirmation, and logout synchronization across two browser tabs.
- 2026-08-09 — Password-change redirect completed: changed a demo Org Admin password through Profile, verified authentication was cleared and the user was redirected to Login with confirmation, signed in with the new password, and restored the original demo password through the same flow.
- 2026-08-09 — Text input vertical centering completed: verified Profile's Fluent fields render at 36px with 34px inner inputs and zero vertical input padding; at 375px all fields fit without horizontal page overflow.
- 2026-08-09 — Fluent icon refresh completed: verified Fluent System Icons render in the navigation rail and board drag handles with accessible names, stable 20px rail dimensions, and responsive desktop/mobile account-menu behavior.
- 2026-08-09 — Development seeder completed: exactly 2 organizations, each with one Org Admin, two Users, two boards, and 11 ideas per board distributed `3/2/2/1/3`; one global Site Admin remains organization-independent. Verified by 10 focused seeder tests, full 417-test solution pass, and a fresh LocalDB `Collega` run showing 2 organizations, 6 organization users, 1 global Site Admin, 4 boards, 44 ideas, and zero cross-organization ownership violations.
