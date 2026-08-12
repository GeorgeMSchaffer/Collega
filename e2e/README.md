# Collega browser E2E (Playwright)

End-to-end tests that drive the **real Blazor client** in a headless Chromium browser against the
live API and a **throwaway** SQL database. These are true browser tests (clicking the UI), distinct
from the in-process `Collega.API.Tests` HTTP integration suite.

## Flows covered

| Spec | Flows |
|---|---|
| `01-site-admin-password.spec.ts` | 1. Site Admin first-login forced password change |
| `02-org-admin-users.spec.ts` | 2. Org Admin creates two users · 3. deactivates them* |
| `03-org-admin-statuses.spec.ts` | 4. Org Admin adds a status · 5. deletes it |
| `04-board-and-card.spec.ts` | 6. Org Admin creates a board · 7. User adds a card · 8. User moves the card through all statuses |
| `05-idea-drawer-engagement.spec.ts` | 9. drawer opens from the Ideas list + is URL-addressable (`?idea=`, bare `/ideas/{id}`; `/edit` retired) · 10. upvote · 11. comment (with @mention token) · 12. edit adds a tag + assignee · 13. status move from the drawer |
| `06-ideas-list-surface.spec.ts` | 14. scope chips + server-side search + clear · 15. sortable column headers · 16. page-size options |
| `07-idea-admin-delete.spec.ts` | 17. Org Admin deletes an idea from the drawer danger zone · 18. a deep-link to the deleted idea no longer loads |

\* There is no hard-delete user endpoint; "delete" is implemented as **deactivate** (status → Inactive),
which is the app's actual behavior.

**Flows 9–16 (specs `05`/`06`)** are validated green against the live stack. `05` is stateful (creates its
own throwaway board + idea, then drives the drawer on it) and runs serially; `06` is read-only against the
demo seed. Two behaviors these specs encode:

- Flow 9 avoids the `/ideas` **Add New** button on purpose — that path currently opens the brainstorm
  modal first (WIP), so the fixture idea is created from the board header, where **New idea** opens the
  create modal directly.
- **Assignee picker for Users:** the drawer/create-modal assignee picker is populated from
  `GET /organizations/{id}/members` — a minimal, non-admin member list any in-org caller may read.
  A plain **User** can therefore populate the picker and, as the creating author, change the assignee
  collection (SPEC/20-feature-ideas-and-engagement.md Permissions), so flow 12's assignee step runs as
  the authoring **User**. (The admin user listing `GET /organizations/{id}/users` stays Org-Admin+.)

## Prerequisites

1. **PostgreSQL** running (the repo's `collega-postgres` container, host port **5432** — `docker compose up -d postgres`).
2. **API on `http://localhost:5103`** against a **fresh** throwaway `CollegaE2E` database, in the
   `Development` environment (so the demo orgs/users are seeded and the Site Admin still requires a
   first-login password change). Never point these tests at your real `Collega` database.
3. **Client on `http://localhost:5098`** (its `wwwroot/appsettings.json` already targets `:5103`).

> **Reconciled to PostgreSQL 2026-08-12 (Sprint 5).** This suite was restored in `9301073` still
> carrying its original SQL Server setup — `collega-sqlserver` on port 1434, a `sqlcmd` drop, and a
> `Server=…;TrustServerCertificate=True` connection string, none of which work against the current
> stack. The commands below are the Postgres equivalents. Substitute your own `POSTGRES_PASSWORD`
> from `.env`; the value shown is the `.env.example` placeholder, not a real credential.

### Start the stack

```bash
# 1) Fresh throwaway DB (drops any previous CollegaE2E; FORCE terminates open connections,
#    the Postgres equivalent of SINGLE_USER WITH ROLLBACK IMMEDIATE — requires PG 13+)
docker exec collega-postgres psql -U collega -d postgres \
  -c 'DROP DATABASE IF EXISTS "CollegaE2E" WITH (FORCE);'

# 2) API (creates, migrates and demo-seeds CollegaE2E on boot)
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5103 \
  ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=CollegaE2E;Username=collega;Password=Ch4ngeMe!Now" \
  SiteAdmin__Email=admin@collega.local SiteAdmin__Password='Ch4ngeMe!Now' \
  dotnet run --project src/Collega.API/Collega.API.csproj --no-launch-profile

# 3) Client
dotnet run --project src/Collega.Client/Collega.Client.csproj --launch-profile http
```

## Run the tests

```bash
cd e2e
npm install
npx playwright install chromium
npm test               # headless
npm run test:headed    # watch it drive the browser
```

## Notes / caveats

- **Seeded accounts** used: Site Admin `admin@collega.local` / `rsbr220Sql!` (forced first-login
  change); demo Org Admin `orgadmin@acme-robotics.demo.collega.test` / `Abc123!`; demo User
  `user@acme-robotics.demo.collega.test` / `Abc123!`.
- **Flow 1 is one-shot per database.** It consumes the Site Admin's forced password change and changes
  the password, so re-running the full suite needs a fresh `CollegaE2E` (drop + let the API re-seed).
- **Status moves (flow 8)** are driven through the Idea drawer's status control rather than HTML5
  drag-and-drop on the Kanban — native drag under Blazor WASM is unreliable to automate. It exercises
  the same server status-change call. The board is created with "Allow Users to move ideas" enabled so
  a plain User is permitted to move.
- **FluentUI fields** (`<fluent-text-field>`, `<fluent-select>`) keep their real control in a shadow
  root; the helpers in `tests/helpers.ts` target the inner control / open the combobox accordingly.
- Tests run **serially** (`workers: 1`) because the flows are stateful and ordered.
