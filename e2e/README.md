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

\* There is no hard-delete user endpoint; "delete" is implemented as **deactivate** (status → Inactive),
which is the app's actual behavior.

## Prerequisites

1. **SQL Server** running (the repo's `collega-sqlserver` container, host port **1434**).
2. **API on `http://localhost:5103`** against a **fresh** throwaway `CollegaE2E` database, in the
   `Development` environment (so the demo orgs/users are seeded and the Site Admin still requires a
   first-login password change). Never point these tests at your real `Collega` database.
3. **Client on `http://localhost:5098`** (its `wwwroot/appsettings.json` already targets `:5103`).

### Start the stack (PowerShell / bash)

```bash
# 1) Fresh throwaway DB (drops any previous CollegaE2E)
docker exec collega-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'rsbr220Sql!' -C \
  -Q "IF DB_ID('CollegaE2E') IS NOT NULL BEGIN ALTER DATABASE CollegaE2E SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE CollegaE2E; END"

# 2) API (migrates + demo-seeds CollegaE2E on boot)
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5103 \
  ConnectionStrings__DefaultConnection="Server=localhost,1434;Database=CollegaE2E;User Id=sa;Password=rsbr220Sql!;TrustServerCertificate=True;" \
  SiteAdmin__Email=admin@collega.local SiteAdmin__Password=rsbr220Sql! \
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
