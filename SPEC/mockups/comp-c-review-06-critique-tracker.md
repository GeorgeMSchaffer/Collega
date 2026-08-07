# Comp C Lock-in — Critique & Fix Tracker

Tracks the UI/UX review of the locked `comp-c-review-06-lockin-v4-combined.html` reference, the decisions made in response, and the fix status of every finding. Companion to the "Locked" / "Still open" bullets in `CLAUDE.md`.

- **Reviewed:** 2026-08-07, `ui-ux-designer` agent, against v4 + `comp-c-review-01/-03/-04/-05` and `SPEC/20-feature-client-ui.md`, `SPEC/20-feature-client-ui-revisions.md`.
- **Result:** `SPEC/mockups/comp-c-review-06-lockin-v5-final.html` — supersedes v4 as the reference for Sign in, Home, Settings (Orgs/Users), Board List, Swim Lanes, and Idea Detail. v1–v4 are kept for history only. `comp-c-review-04` and `comp-c-review-05` were patched in place (see §3) rather than rebuilt, since they remain the CRUD-state reference per `CLAUDE.md`.

## 1. Decisions made

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Swimlane card treatment | **Flat**, left-border accent | Same visual grammar as List view's own left-border accent; lower contrast risk than a full tinted band; keeps focus on card content over a "rainbow row" of lane headers. |
| 2 | Identity / sign-out affordance | **Rail avatar only**, with a click-to-open popover (Profile, Sign Out) | No comp ever rendered a header bar; `SPEC/20-feature-client-ui.md` NAVIGATION already states there's no separate header bar. The popover gives the avatar the interactive affordance it was missing in v4. |
| 3 | "Admin" vs "Settings" naming | **Rename to "Settings"** everywhere (rail label, breadcrumbs, page titles) | Matches the acceptance checkbox in `SPEC/20-feature-client-ui-revisions.md`; the "Admin" text in v4/comp-02/comp-05 was stale. |
| 4 | Priority color encoding in Swim Lanes | **Priority-colored chip** (red/amber/green), matching List view | Restores at-a-glance priority scanning within a lane; removes the redundant "chip color = lane color" pattern v4 had. |
| 5 | `Ideas` rail entry (open gap flagged directly in `SPEC/20-feature-client-ui.md`) | **Add a dedicated Ideas icon** (💡) | Matches `client-ui-revisions.md`'s literal "Home, Boards, Ideas" menu list; gives `/ideas` a first-class, discoverable entry point distinct from any one board. |

All five are now reflected in v5 and should be considered locked pending final sign-off; `CLAUDE.md`'s "Still open" section has been updated accordingly.

## 2. Fix status — v5 (`comp-c-review-06-lockin-v5-final.html`)

### Must-fix

| Finding | Status | Where |
|---|---|---|
| No explicit Save/Cancel/Move-in-Board/Delete on Idea Detail (only an ambiguous "Close") | **Fixed** | `.actionbar` in `#s-idea` — Save Idea, Move in Board (popover status picker), Cancel, admin-only Delete Idea with inline confirm |
| No Idea Type / Business Impact fields | **Fixed** | Idea Detail `.facts` sidebar; Business Impact also shown as a card-face color chip (List + Swim Lanes) per spec — Idea Type intentionally stays detail-only per `SPEC/40-test-strategy.md` |
| "Admin" vs "Settings" naming drift | **Fixed** | Rail label, breadcrumbs, page notes across all Settings screens |
| No `:focus-visible` states on buttons/rail/cards | **Fixed** | Single shared focus-visible rule covers `.btn`, `.rail a`, `.rowcard`, `.kcard`, `.ptabs a`, `.viewswitch a`, `.up`, `.cmt`, `.chip`, `.avatarbtn`, popover items, tiles |
| Rail icon set changed per screen | **Fixed** | Every logged-in screen now shows the same four icons (Home, Boards, Ideas, Settings) + avatar; `aria-current="page"` on the active one |

### Should-fix

| Finding | Status | Where |
|---|---|---|
| `--ink-3` contrast borderline (~4.5:1) | **Fixed** | Darkened `#797672` → `#5f5b56`; now 6.74:1 against white (verified programmatically) |
| Priority color inconsistent between List and Swim Lanes | **Fixed** | Decision #4 above — both views now use the same priority-colored encoding |
| Custom-hex status color picker had no contrast guardrail | **Fixed directly in `comp-c-review-05-admin-statuses.html`** | Added a WCAG relative-luminance/contrast check in JS; shows an inline warning when a custom hex falls below 4.5:1 against white, for both the New and Edit status forms |
| Missing filter chip row (All / Created by me / Assigned to me) | **Fixed** | `.chipbar` above the search/filter row on both List and Swim Lanes |
| Upvote hit target under 24px | **Fixed** | `.up` padding increased (`3px 11px` → `6px 13px`); now ~26px tall |
| "Create idea" buried at the bottom of the New Idea sidebar | **Fixed directly in `comp-c-review-04-idea-detail.html`** | Moved next to Cancel in the header action row, consistent with every other form in the comp set |

### Nice-to-have — not built into v5, tracked here instead

| Item | Status | Notes |
|---|---|---|
| `+N` tag/assignee overflow demonstration | **Fixed** (partial, opportunistic) | The "Dark mode support" card in both List and Swim Lanes now shows real tag (`+2`) and assignee (`+1`) overflow, proving the layout accommodates it. Not exhaustively re-tested at extreme values (5 assignees, 10 tags). |
| Mobile / narrow-viewport pass | **Deferred** | No breakpoint behavior defined yet for the 64px rail + fixed two-column Idea Detail grid. Needs its own pass once a real viewport target is picked. |
| `aria-pressed` / accessible name guidance for upvote toggle | **Deferred** | Belongs in developer handoff notes, not a static HTML comp — flag for the UI/UX Developer agent when Client build work reaches the board. |
| Dedicated `/ideas` page design | **Deferred** | Decision #5 adds the rail icon, but the page it points to (`/ideas` — user-focused idea list/search, distinct from a board view) has no comp yet. Needs its own design pass before Client build reaches it. |

### Incidental fix found while implementing

The Idea Detail "Assignee" field in v4/comp-04 was a **single-select dropdown**, which directly contradicts the spec's zero-to-five multi-assignee requirement. v5 replaces it with a multi-value pill field (matching the existing Tags pattern), showing "2 / 5" and a "+ add" affordance.

## 3. Direct patches (outside v5)

Two should-fix items were small, targeted, and specific to CRUD-state comps that v5 doesn't repeat — patched in place rather than duplicated:

- **`comp-c-review-04-idea-detail.html`** — New Idea screen: "Create idea" moved from the bottom of the metadata sidebar into the header action row (next to Cancel). Idea Type / Business Impact fields also added to the New Idea facts sidebar for consistency with Idea Detail's edit mode.
- **`comp-c-review-05-admin-statuses.html`** — Custom-hex color picker (New and Edit status forms): added a live WCAG contrast check against white; an inline red warning appears when the typed hex falls below 4.5:1.

## 4. Not carried into this pass

Everything in the original critique's "Gaps" and "Anti-patterns" sections is accounted for above except:

- Loading/error/network-failure states (only one empty-state comp exists, for Boards list) — out of scope for a visual lock-in pass, flagged for a dedicated states/edge-cases comp later.
- Full role-matrix pass (Site Admin / Org Admin / User / Read Only differences beyond what `comp-c-review-04`'s Read Only screen already shows) — not re-audited here.
