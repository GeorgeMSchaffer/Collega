# Bug Triage

This document is the authoritative queue for bugs and minor tweaks that must be addressed before new feature work begins.

## Workflow

- Read this document before starting or resuming feature implementation.
- Items under `TODO` take priority over new features. Do not start a new feature while `TODO` contains unresolved items unless the user explicitly approves an exception.
- When an item is fixed and its focused validation passes, remove it from `TODO` and add it to `COMPLETED` with the completion date and a concise verification note.
- Do not duplicate an item between sections. If a change is incomplete, unverified, or deferred, keep it under `TODO` and note its status there.
- New bugs and minor tweaks belong under `TODO`; feature ideas remain in the delivery backlog.

Updates the icons to use from the following icon family
https://github.com/microsoft/fluentui-system-icons, updates the Nav icons to use these.

* List Views
    * Number of results (10,25,50,100)
    * Should have pagination controls
    * Search box which should search all columns displayed in the list.
    * Ideas List should have aj additional Idea Type, Idea Status dropdown filters.



## TODO
No unresolved items.

## IDEAS

Help me come up with a new feature.  The overall idea is that the board is used to manage the process of brainstorming and fleshing out ideas.  However, I also want to enable the user to manage the process of implementing the idea using AGILE Best practices.  I also want user's to be able to create a roadmap with a start and end date, and assign

    * Main Fun
        * Create a Roadmap
        * Create sprint(s) and assign them to a roadmap
        * An Idea that marked as complete should be added as an issue but not assigned to a Road,


## COMPLETED
- 2026-08-09 — Site Admin global visibility and stale-session handling completed: Site Admin Home, Boards, Ideas, Users, Statuses, and User-Defined Fields aggregate every active organization with explicit organization labels and scoped management links; Board and Idea detail derive related-data context from the owning board rather than an account membership. Every authenticated API path now clears an invalid persisted token and redirects to Login with the expired-session message, and Development HTTP hosting no longer runs HTTPS redirection. Verified by two clean Release solution builds, two full 425-test passes, and a live browser reproduction that cleared the stale token and reached `/login?sessionExpired=true` instead of leaving the page on 401.
- 2026-08-09 — Settings information architecture completed: `/settings` is a role-scoped link-card hub; organizations moved to `/settings/organizations`; Org Admin users moved to `/settings/users`; and Users, Statuses, and User-Defined Fields link to dedicated list/form views. Site Admin organization rows expose scoped Users, Statuses, and Fields actions. Verified by focused and full solution builds plus live Org Admin/member browser checks, including invite-code preservation, authorization, and a 375px responsive pass.
- 2026-08-09 — Session lifetime completed: verified the 480-minute absolute expiry in persisted browser state, the warning dialog and countdown after 28 minutes idle, activity reset through Stay signed in, automatic logout after 30 minutes idle, expired-session confirmation, and logout synchronization across two browser tabs.
- 2026-08-09 — Password-change redirect completed: changed a demo Org Admin password through Profile, verified authentication was cleared and the user was redirected to Login with confirmation, signed in with the new password, and restored the original demo password through the same flow.
- 2026-08-09 — Text input vertical centering completed: verified Profile's Fluent fields render at 36px with 34px inner inputs and zero vertical input padding; at 375px all fields fit without horizontal page overflow.
- 2026-08-09 — Fluent icon refresh completed: verified Fluent System Icons render in the navigation rail and board drag handles with accessible names, stable 20px rail dimensions, and responsive desktop/mobile account-menu behavior.
- 2026-08-09 — Development seeder completed: exactly 2 organizations, each with one Org Admin, two Users, two boards, and 11 ideas per board distributed `3/2/2/1/3`; one global Site Admin remains organization-independent. Verified by 10 focused seeder tests, full 417-test solution pass, and a fresh LocalDB `Collega` run showing 2 organizations, 6 organization users, 1 global Site Admin, 4 boards, 44 ideas, and zero cross-organization ownership violations.
