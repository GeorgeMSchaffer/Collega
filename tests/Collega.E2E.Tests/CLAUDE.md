# Collega.E2E.Tests — Playwright browser test suite

End-to-end browser tests that drive the **running** Blazor Client (and, transitively, the API + database) with [Playwright for .NET](https://playwright.dev/dotnet/). Unlike the other `tests/` projects, these are **not hermetic** — they need a live app and a seeded database.

This file is the **living use-case catalog** for the suite. When we add or change a browser-level behavior to cover, update the tables below in the same change. Treat `SPEC/40-test-strategy.md` as the upstream source of truth for *what* to verify; this file tracks *how* it maps to tests and *whether* each case is implemented.

## What this suite is (and is not)

- **Is:** black-box verification of real user journeys through the browser — auth/session, routing, board and idea CRUD, cross-tab behavior, accessibility affordances.
- **Is not:** a replacement for the in-process layers. Domain/Application/Infrastructure/API logic is covered by the hermetic xUnit projects. Don't re-assert business rules here that a cheaper unit/integration test already owns.

## Prerequisites

1. **.NET 8 SDK** (repo `global.json`).
2. **Playwright browsers installed once** after the first build:
   ```bash
   dotnet build tests/Collega.E2E.Tests/Collega.E2E.Tests.csproj
   pwsh tests/Collega.E2E.Tests/bin/Debug/net8.0/playwright.ps1 install
   ```
   (Install PowerShell with `brew install --cask powershell` if `pwsh` is missing.)
3. **A running app in Development** (so the demo seed is present):
   ```bash
   dotnet run --project src/Collega.API/Collega.API.csproj     # http://localhost:5103
   dotnet run --project src/Collega.Client/Collega.Client.csproj # http://localhost:5098
   ```
   The API needs a reachable PostgreSQL instance (see repo root `docker-compose.yml`).

## Running

These tests are **skipped by default** (each `[Fact(Skip=...)]`), so `dotnet test Collega.sln` still compiles this project but reports the cases as *skipped* rather than depending on a live browser or server. To run them:

```bash
# 1. app running in Development, browsers installed (see above)
# 2. remove the Skip= on the cases you want, or run the whole project:
dotnet test tests/Collega.E2E.Tests/Collega.E2E.Tests.csproj
```

Useful environment overrides (see `Infrastructure/E2ETestConfig.cs`):

| Variable | Default | Purpose |
|---|---|---|
| `COLLEGA_E2E_BASEURL` | `http://localhost:5098` | Client root URL |
| `COLLEGA_E2E_ORGADMIN_EMAIL` / `_PASSWORD` | `orgadmin@acme-robotics.demo.collega.test` / `Abc123!` | Default sign-in identity |
| `COLLEGA_E2E_USER_EMAIL` / `_PASSWORD` | `user@acme-robotics.demo.collega.test` / `Abc123!` | Ordinary-user identity |
| `HEADED=1` | (headless) | Playwright: show the browser |
| `COLLEGA_E2E_SLOWMO` | `0` | Slow actions (ms) for debugging |

Traces/screenshots/video on failure follow the standard Playwright-xUnit settings; configure via `.runsettings` if desired.

## Conventions

- **Locators:** prefer `GetByRole` / `GetByText` / `GetByLabel` over CSS. `GetByRole` `Name` is a case-insensitive substring match unless `Exact = true`.
- **Fluent UI web-component gotcha:** `<fluent-text-field>`, `<fluent-button>`, etc. render their real `<input>`/control inside an **open shadow root**, and `<label for>` points at the *host* element, so `GetByLabel` is unreliable for text fields. Use `CollegaPageTest.FillFluentFieldAsync("<host-id>", value)`, which targets the inner input through the host id (Playwright pierces open shadow DOM). Fluent buttons *do* expose an accessible name, so `GetByRole(AriaRole.Button, new(){ Name = "…" })` works for them.
- **Isolation:** all classes join the `e2e` collection (`DisableParallelization = true`) — they share one running app and mutate demo data, so they run serially.
- **Test data:** rely on the Development demo seed for read paths. For write paths, create uniquely-named entities (e.g. suffix with a run marker) and don't assume a clean DB between runs. Do not hard-delete seeded data.
- **Base class:** extend `CollegaPageTest` for base-URL wiring, `SignInAsync(...)`, and `FillFluentFieldAsync(...)`.

## Use-case catalog

Status legend: ✅ implemented & passing · 🟡 scaffolded (written, `Skip`ped, selectors need verification vs. running app) · ⬜ not started.

### Smoke / critical path — `Tests/SmokeTests.cs`
| Case | Status | Notes |
|---|---|---|
| Sign in with seeded account → reach workspace | 🟡 | `Signin_lands_on_workspace` |
| Create a board with default status structure | 🟡 | part of `Create_board_then_create_idea_on_it`; verify new-board form field ids/labels |
| Create an idea → appears without validation errors | 🟡 | same test; verify create-modal field ids and success behavior |

### Authentication & session — `Tests/AuthNavigationTests.cs`
| Case | Status | Notes |
|---|---|---|
| Protected route redirects anonymous → `/login` | 🟡 | `Protected_route_redirects_anonymous_to_login` |
| Successful login lands on `/` | 🟡 | `Successful_login_lands_on_home` |
| `/logout` clears session; protected route re-bounces to `/login` | 🟡 | `Logout_clears_session_and_returns_to_login` |
| Valid session survives browser reload (token restoration) | 🟡 | `Valid_session_survives_browser_reload` |
| Forced first-login password change is gated by `MustChangePassword` | ⬜ | needs an account seeded with forced change (Site Admin has it; demo Org Admin does not) |
| Expired/API-unknown token clears client auth and returns to `/login` | ⬜ | drive via manipulated/expired token or `/me` rejection |
| Active-session `401` signs out only when `/me` also rejects | ⬜ | distinguish protected-request 401 from wrong-current-password 401 |
| Password change stays authenticated after reload (API still up) | ⬜ | |

### Board navigation & terminology — `Tests/BoardNavigationTests.cs`
| Case | Status | Notes |
|---|---|---|
| `/boards` lists boards | 🟡 | `Boards_route_lists_boards` |
| No user-facing "Workflow" terminology leaks | 🟡 | `No_workflow_terminology_leaks_into_the_ui`; extend across key pages |
| `/board/{boardId}` opens detail | ⬜ | |
| Legacy routes redirect to canonical routes | ⬜ | enumerate legacy→canonical pairs from the Client router |

### Settings navigation — Bug Triage regressions — `Tests/SettingsNavigationTests.cs`
| Case | Status | Notes |
|---|---|---|
| Every list view (one level below root) shows a "Back" control, all roles | 🟡 | `Every_list_view_shows_a_back_button` |
| Admin list views show an "Add New" action for a role that can create | 🟡 | `Admin_lists_show_an_add_new_action`; button on inline-edit pages, link on routed-form pages |
| "Back" returns to the previous page | 🟡 | `Back_button_returns_to_the_previous_page` |
| Site Admin *global* aggregated views route "Add New" to the Organizations list | ⬜ | needs a Site Admin seed without a forced password change |

### Ideas & idea-detail drawer — (no .NET file; covered in the TS `e2e/` suite)
Locked design: right slide-in **drawer** + centered **create modal**, URL-addressable via `?idea={id}` and `/ideas/{id}` (SPEC/20-feature-client-ui.md → Idea Detail Surface). **These cases live in the TypeScript Playwright suite** (`e2e/tests/05-idea-drawer-engagement.spec.ts`, `06-ideas-list-surface.spec.ts`), not this .NET project — see `e2e/README.md`. Status below reflects that suite.

> **Note on this section's history.** The `e2e/` suite was deleted in `3c367f3` and these rows were re-marked ⬜ uncovered as a result. It was **restored in `9301073`** (2026-08-12) after the removal was identified as a mistake, so the original statuses are reinstated. Before trusting a ✅ here, re-run the suite: its setup targets SQL Server and has not yet been reconciled to PostgreSQL (see `e2e/README.md`).

| Case | Status | Notes |
|---|---|---|
| `/ideas` list + search + All/Created-by-me/Assigned-to-me filter chips | ✅ | `e2e/06` — chips, server-side search, sortable headers, 25/50/100/250 page sizes |
| Idea detail opens as a drawer from Ideas list, board rows, and swim-lane cards | 🟡 | `e2e/05` covers Ideas-list + board card (spec 04); swim-lane-card entry still ⬜ |
| `?idea={id}` / bare `/ideas/{id}` deep-link opens the drawer | ✅ | `e2e/05` — also asserts retired `/ideas/{id}/edit` opens no editor |
| Create idea via modal returns to list on success (no auto-open) | 🟡 | board path proven by `e2e/04`; `/ideas` Add New path opens brainstorm-modal-first (WIP), unautomated |
| Idea engagement: upvote, comment, tags, mentions, 0–5 assignees, status move | ✅ | `e2e/05` — upvote, comment(+@mention token), add tag+assignee, status move; assignee driven as Org Admin (User picker is empty — org-user list is Org-Admin+); mention *delivery* stays server-verified |
| Admin delete of an idea | ✅ | `e2e/07` — Org Admin arms + confirms the drawer danger-zone; idea leaves the list and a deep-link to it can no longer load (soft-deleted) |

### Board detail — List & Swim Lanes — (no file yet)
| Case | Status | Notes |
|---|---|---|
| Card face shows title, priority badge, business-impact chip, ≤3 tags +N, ≤3 assignees +N, age, upvote state/count, comment count | ⬜ | SPEC/40 "Card rendering" |
| Persona initials/ordering rules (incl. `?` / "Unknown user") | ⬜ | SPEC/40 "Persona rendering" |
| List rows/headers colored per status; swim-lane flat treatment | ⬜ | locked comp-c-review-06 |
| Move an idea between statuses | ⬜ | |

### Administration (Settings) — (no file yet)
| Case | Status | Notes |
|---|---|---|
| Org CRUD (Site Admin) | ⬜ | |
| User CRUD + role assignment | ⬜ | |
| CSV user import (template download, upload, problem-details errors) | ⬜ | |
| Status management + color picker | ⬜ | |
| Invite-code self-registration (`/register`) + regenerate | ⬜ | |
| "Settings" (not "Admin") terminology everywhere | ⬜ | rail label, breadcrumbs, titles |

### Manual acceptance — hard to automate reliably (track here, may stay manual)
| Case | Status | Notes |
|---|---|---|
| Idle-timeout warning at 28 min → 30-min deadline; "Stay signed in" resets only idle | ⬜ | needs clock control / long wait; consider driving via injected time |
| Cross-tab sync of activity/logout/expiry signals | ⬜ | multi-context/multi-page test |
| Profile edits; read-only email/role; password-change flows | ⬜ | |
| Control sizing (stable 36px) + Fluent icon a11y (names, tooltips, focus, disabled) | ⬜ | |

## Maintaining this catalog

When you touch the suite:
1. Add/adjust the row(s) here and flip the status emoji.
2. Keep case names in the table matching the actual `[Fact]` method names.
3. If a behavior changes in `SPEC/`, update the spec first (repo rule), then reflect it here.
4. When you un-`Skip` a case, verify its locators against the running app and move it to ✅ only once it passes.

## Use Cases
I as a site admin want to login for the first time.
I as an org admin want to login to the application and logout.
I as a site admin, need to create a new organization, update it and delete it.
I as a site admin, need to create users for an organization, update it and delete it.
I as a site admin can create a UDF and assign it to a Idea Type
I as user need to create a new idea, update it and delete it.
I as a user, need to vote on an idea and comment on it.
I as a user, need to create an idea and update it.
I as a user, need to use the swimlanes to move an idea from one status to another untill completion
