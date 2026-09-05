# 50 — Azure Deployment Guide

How to provision and deploy Collega's three tiers to Azure at low cost. This is the
cost-optimized PaaS target that pairs with `SPEC/50-kubernetes-deployment.md` (the heavier,
self-hosted alternative). It reflects the **actual** wiring in the codebase as of this
document: the API reads three required settings and fails fast without them, migrations run
automatically on startup, and the client is Blazor **WebAssembly** (static files).

---

## 1. Architecture and cost

The client (`src/Collega.Client`) is Blazor WebAssembly — it compiles to static
html/wasm/js and calls the API as a **separate origin**. So the frontend is nearly free to
host, and the only real cost drivers are the API compute and the database.

| Tier | Azure service | Why | Approx. monthly (USD) |
|---|---|---|---|
| Frontend (`Collega.Client`) | **Static Web Apps** — Free tier | Purpose-built for Blazor WASM; includes global CDN + free TLS | **$0** |
| Backend (`Collega.API`) | **App Service** — Linux, B1 | Runs the ASP.NET Core 8 host; simplest managed compute for .NET | ~$13 (or **F1 Free** for dev) |
| Database | **Azure Database for PostgreSQL — Flexible Server**, **Burstable B1ms** | Cheapest managed Postgres tier; managed backups + PITR; can be **manually stopped** when idle to save compute | ~$13–20 depending on usage |

**Total: ~$26–33/mo** for a small always-available deployment, less if you use the App
Service Free tier and stop the database when idle.

> **No auto-pause.** Unlike Azure SQL Serverless, PostgreSQL Flexible Server does **not**
> auto-pause on idle. You can **manually stop** the server (it stays stopped up to 7 days, then
> auto-starts) to avoid compute charges on a dev box — see §9. For always-on, Burstable B1ms is
> the floor.

```
 Browser ──HTTPS──> Static Web Apps (WASM bundle, CDN)
    │
    └──HTTPS (CORS, bearer token)──> App Service (Collega.API) ──TLS/5432──> Azure Database for PostgreSQL
```

> **Region:** put all three in the **same Azure region** (examples below use `eastus`) to
> avoid cross-region latency and egress. Static Web Apps Free picks its own edge region; that
> is fine — only App Service ↔ database locality matters for latency.

---

## 2. Prerequisites

- An Azure subscription and the **Azure CLI** (`az`) signed in: `az login`.
- The **.NET 8 SDK** locally (matches `global.json` → `8.0.118`, `latestFeature` roll-forward).
- A GitHub repository for the code (Static Web Apps Free deploys via a GitHub Actions workflow it generates for you).
- Choose values now and reuse them throughout:

```bash
# --- edit these ---
export LOC=eastus
export RG=collega-rg
export PG_SERVER=collega-pg-$RANDOM        # must be globally unique -> <PG_SERVER>.postgres.database.azure.com
export PG_DB=collega
export PG_ADMIN=collegaadmin
export PG_PASSWORD='<a-strong-password>'   # 8+ chars, upper/lower/digit/symbol
export API_PLAN=collega-plan
export API_APP=collega-api-$RANDOM         # must be globally unique -> https://<API_APP>.azurewebsites.net
export SWA_NAME=collega-web
# Site Admin seed (auth requirement #8) — the app REQUIRES these or it will not boot
export SITEADMIN_EMAIL='admin@yourdomain.com'
export SITEADMIN_PASSWORD='<a-strong-initial-password>'   # forced to change on first login
```

---

## 3. Configuration reference (what the app actually requires)

The API validates configuration in one pass at startup and **exits with a non-zero code and a
banner** if any of the three required settings are missing (`StartupConfigurationValidator`).
On App Service, provide these as **Application settings** using the double-underscore form.

### Required — the app will not start without these

| App setting (env var) | Maps to config key | Purpose |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `ConnectionStrings:DefaultConnection` | Azure Database for PostgreSQL connection string (Npgsql format) |
| `SiteAdmin__Email` | `SiteAdmin:Email` | Seed Site Admin login (created on first run) |
| `SiteAdmin__Password` | `SiteAdmin:Password` | Seed Site Admin initial password (must change on first login) |

### Strongly recommended in production

| App setting | Maps to | Why it matters |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` = `Production` | — | Disables Swagger, enables HTTPS redirect, disables demo-data seeding. App Service sets this to `Production` by default, but set it explicitly. |
| `Cors__AllowedOrigins__0` = `https://<your-swa-host>` | `Cors:AllowedOrigins[0]` | The WASM frontend is a different origin; **without this the browser blocks every API call.** Defaults only to `localhost:5098`. Add `__1`, `__2`, … for more origins (e.g. a custom domain). |
| `Auth__TokenSigningKey` = `<base64 32 bytes>` | `Auth:TokenSigningKey` | **Important.** If unset, the API generates a *random* signing key per process, so every App Service restart or scale-out **invalidates all existing tokens** (users get logged out). Set a stable key. Generate one with: `openssl rand -base64 32` |

### Optional

| App setting | Maps to | Default |
|---|---|---|
| `Auth__AccessTokenLifetimeMinutes` | `Auth:AccessTokenLifetimeMinutes` | `480` (8h) |
| `Ai__ApiKey` | `Ai:ApiKey` | *(unset)* — **a secret.** The single deployment-level Anthropic key every organization shares (`SPEC/20-feature-ai-idea-assist.md` rule 29). Leaving it unset is a **supported** state, not a misconfiguration: AI idea assist runs dark, the brainstorm falls back to its scripted prompts, and the API answers "not configured" rather than erroring (rule 31). Unlike `SiteAdmin__*` it must never fail startup. |
| `Ai__DailyTokenLimit` | `Ai:DailyTokenLimit` | `500000` tokens per UTC day, one global pool across all organizations. Non-positive disables the budget gate — local use only, never in Azure. |
| `Ai__Model` / `Ai__Effort` | `Ai:Model` / `Ai:Effort` | `claude-sonnet-5` / `low` |
| `Ai__Pricing__InputPerMillion` / `Ai__Pricing__OutputPerMillion` | `Ai:Pricing:*` | `3.00` / `15.00` — display only, for the usage page's cost estimate |

> **Migrations are automatic.** On startup the API runs `Database.MigrateAsync()` against the
> relational provider, so the schema is created/upgraded on first boot — no separate migration
> step in the pipeline. The consequence: the Postgres role in the connection string must be able
> to **create and alter schema** (the `collegaadmin` admin role below satisfies this; if you
> later switch to a least-privilege app role, grant it ownership of — or `CREATE` on — the
> `public` schema plus table-level `SELECT`/`INSERT`/`UPDATE`/`DELETE`, or run migrations
> out-of-band).

---

## 4. Provision the database (Azure Database for PostgreSQL — Flexible Server)

```bash
az group create --name $RG --location $LOC

# Flexible Server, Burstable B1ms (cheapest tier), PostgreSQL 16.
# --public-access 0.0.0.0 adds the "Allow Azure services" firewall rule so App Service can reach it.
az postgres flexible-server create \
  --name $PG_SERVER --resource-group $RG --location $LOC \
  --admin-user $PG_ADMIN --admin-password "$PG_PASSWORD" \
  --tier Burstable --sku-name Standard_B1ms \
  --version 16 --storage-size 32 \
  --public-access 0.0.0.0 \
  --yes

# Create the application database on the server.
az postgres flexible-server db create \
  --resource-group $RG --server-name $PG_SERVER --database-name $PG_DB
```

> **Firewall note:** `--public-access 0.0.0.0` means "allow other Azure services" (App Service),
> not the public internet. To add or adjust rules later use
> `az postgres flexible-server firewall-rule create --resource-group $RG --name $PG_SERVER ...`.
> For tighter security use **Private Access (VNet integration)** at create time instead — see §8.

> **No auto-pause / cold start.** Flexible Server does not auto-pause, so there is no wake-up
> latency, but it also bills compute whenever it is running. Burstable B1ms is the cheapest
> always-on option; to save money on a dev box, **stop the server** when idle (§9). SSL/TLS is
> required by default (`Ssl Mode=Require` in the connection string below).

Build the connection string (Npgsql format — used as an App Service setting next):

```bash
export CONN="Host=$PG_SERVER.postgres.database.azure.com;Port=5432;Database=$PG_DB;Username=$PG_ADMIN;Password=$PG_PASSWORD;Ssl Mode=Require;Trust Server Certificate=true"
```

> **On `Trust Server Certificate=true`:** it encrypts the connection but skips CA validation —
> fine to get running. For stronger security use `Ssl Mode=VerifyFull` with the Azure PostgreSQL
> root CA bundled/trusted on the host instead.

---

## 5. Provision and deploy the API (App Service, Linux .NET 8)

### 5.1 Create the plan and web app

```bash
# B1 (~$13/mo). For a dev deployment use: --sku F1  (Free)
az appservice plan create \
  --name $API_PLAN --resource-group $RG --location $LOC \
  --is-linux --sku B1

az webapp create \
  --name $API_APP --resource-group $RG --plan $API_PLAN \
  --runtime "DOTNETCORE:8.0"

# Enforce HTTPS-only at the platform edge.
az webapp update --name $API_APP --resource-group $RG --https-only true
```

### 5.2 Apply configuration

Set the frontend origin **after** you know the Static Web App host (Section 6); you can rerun
this command to add it, or set a placeholder now and update it later.

```bash
az webapp config appsettings set --name $API_APP --resource-group $RG --settings \
  ASPNETCORE_ENVIRONMENT=Production \
  ConnectionStrings__DefaultConnection="$CONN" \
  SiteAdmin__Email="$SITEADMIN_EMAIL" \
  SiteAdmin__Password="$SITEADMIN_PASSWORD" \
  Auth__TokenSigningKey="$(openssl rand -base64 32)" \
  Cors__AllowedOrigins__0="https://REPLACE-WITH-SWA-HOST"
```

### 5.3 Publish the code

```bash
dotnet publish src/Collega.API/Collega.API.csproj -c Release -o ./publish
(cd publish && zip -r ../collega-api.zip .)

az webapp deploy \
  --name $API_APP --resource-group $RG \
  --type zip --src-path ./collega-api.zip
```

On first boot the API connects to PostgreSQL, runs migrations, and seeds the Site Admin. Verify:

```bash
# 401 (not 404/500) from a protected route means the host is up and auth is wired.
curl -i https://$API_APP.azurewebsites.net/api/v1/organizations
# Tail logs if it isn't healthy — the startup banner names any missing setting.
az webapp log tail --name $API_APP --resource-group $RG
```

> Swagger is intentionally **off** in Production, so there is no `/swagger` to hit — that is
> expected, not a failure.

---

## 6. Provision and deploy the frontend (Static Web Apps)

The WASM client reads its API base URL **at runtime** from a static file in `wwwroot`, so you
point it at the deployed API by adding a Production settings file — no rebuild logic required.

### 6.1 Set the production API URL

`src/Collega.Client/wwwroot/appsettings.Production.json` **already exists in the repo** with a
placeholder host — edit it, don't create it. (The WASM host loads `appsettings.json` then
`appsettings.{Environment}.json`, and a published app runs as `Production`.)

```json
{
  "Api": {
    "BaseUrl": "https://<API_APP>.azurewebsites.net"
  },
  "Session": {
    "IdleTimeoutMinutes": 30,
    "WarningAfterMinutes": 28
  }
}
```

Replace the placeholder `BaseUrl` with the real API host and commit. Leaving it unedited ships a
frontend that calls a nonexistent host over plain HTTP — every request fails on mixed content.

### 6.1a SPA routing fallback (already in the repo)

`src/Collega.Client/wwwroot/staticwebapp.config.json` gives Static Web Apps a navigation fallback
to `/index.html`. Blazor WASM routes on the client, so **without it every deep link and every
browser refresh returns 404** — Blazor's publish does not generate this file. It needs no editing;
it is listed here so it is not mistaken for stray config and deleted.

### 6.2 Create the Static Web App

The repo already has a hand-written deploy workflow — `.github/workflows/deploy-client.yml` —
so create the SWA **without** `--source`. Passing `--source`/`--login-with-github` makes Azure
generate its *own* workflow, and you would end up with two pipelines deploying the same app:

```bash
az staticwebapp create \
  --name $SWA_NAME --resource-group $RG --location $LOC --sku Free
```

Then publish the deployment token as a repo **secret** so the workflow can authenticate
(**Settings → Secrets and variables → Actions → New repository secret**):

```bash
az staticwebapp secrets list --name $SWA_NAME --resource-group $RG \
  --query properties.apiKey -o tsv
```

| Secret name | Value |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | the `apiKey` printed above |

That is the only secret the frontend pipeline needs — the API host is runtime config
(§6.1), not a build input. Pushes to `main` that touch `src/Collega.Client/**` now deploy
automatically; you can also trigger a run by hand from the **Actions** tab.

> **Why the workflow builds the app itself.** It runs `dotnet publish` and hands Static Web Apps
> the finished output (`skip_app_build: true`). The alternative — letting SWA's Oryx builder
> compile the project — uses an SDK Oryx chooses, which does not honour `global.json`'s `8.0.118`
> pin. Building in the workflow keeps CI and local builds on the same SDK.

> **First deploy, or no GitHub:** you can push the same output straight from a workstation:
> ```bash
> dotnet publish src/Collega.Client/Collega.Client.csproj -c Release -o ./client-publish
> npx @azure/static-web-apps-cli deploy ./client-publish/wwwroot \
>   --deployment-token "$(az staticwebapp secrets list --name $SWA_NAME --resource-group $RG --query properties.apiKey -o tsv)"
> ```

### 6.3 Get the frontend host and close the CORS loop

```bash
export SWA_HOST=$(az staticwebapp show --name $SWA_NAME --resource-group $RG --query defaultHostname -o tsv)
echo "Frontend: https://$SWA_HOST"

# Now that we know the origin, allow it on the API (re-run of 5.2 for just this key):
az webapp config appsettings set --name $API_APP --resource-group $RG --settings \
  Cors__AllowedOrigins__0="https://$SWA_HOST"
```

Setting an app setting restarts the API automatically. After this, browse to
`https://$SWA_HOST`, sign in as the Site Admin, and complete the forced password change.

---

## 7. Post-deploy checklist

- [ ] `https://$SWA_HOST` loads the Collega sign-in page.
- [ ] Sign in with `SITEADMIN_EMAIL` / `SITEADMIN_PASSWORD`; you are forced to change the password.
- [ ] Network tab shows API calls to `https://$API_APP.azurewebsites.net` returning `200`, **not** blocked by CORS.
- [ ] App Service log tail shows migrations applied and no missing-configuration banner.
- [ ] `Auth__TokenSigningKey` is set (restart the app and confirm you are **not** logged out).

---

## 8. Security & hardening notes

- **Secrets:** `PG_PASSWORD`, `SiteAdmin__Password`, and `Auth__TokenSigningKey` are set as App
  Service application settings (encrypted at rest). For stronger separation, store them in
  **Azure Key Vault** and reference them via `@Microsoft.KeyVault(...)` settings.
- **DB firewall:** the `--public-access 0.0.0.0` rule means "Azure services," not the public
  internet, but it is broad. For production, prefer **Private Access (VNet integration)** at
  server-create time so the DB has no public path. Never open the server to `0.0.0.0/0` client IPs.
- **Least-privilege DB role:** the admin role is used above for simplicity because startup runs
  migrations. To reduce blast radius, create a dedicated app role that owns (or has `CREATE` on)
  the `public` schema plus table-level `SELECT`/`INSERT`/`UPDATE`/`DELETE`, and use it in the
  connection string.
- **HTTPS only:** enabled on the App Service in 5.1; Static Web Apps is HTTPS-only by default.
- **Rotate the seed Site Admin password** immediately (the forced first-login change covers this),
  and treat `SiteAdmin__Password` as a bootstrap secret, not a standing credential.
- **Custom domains:** add them on the SWA and on the App Service; then append each frontend origin
  as `Cors__AllowedOrigins__1`, `__2`, … on the API.

---

## 9. Cost controls

- PostgreSQL Flexible Server has **no auto-pause**. On a dev box, **stop the server when idle** to
  avoid compute charges — `az postgres flexible-server stop --resource-group $RG --name $PG_SERVER`
  (stays stopped up to 7 days, then auto-starts; `... start` to resume). You still pay for storage
  while stopped. Burstable **B1ms** is the cheapest always-on tier.
- Use the App Service **F1 Free** SKU for non-production; scale to B1 only when you need
  always-on / custom domains / more memory.
- Static Web Apps **Free** covers the frontend indefinitely for this scale.
- Set a **budget alert**: `az consumption budget` or the portal Cost Management → Budgets.

---

## 10. Teardown

```bash
az group delete --name $RG --yes --no-wait
```

Deletes every resource above in one shot. (The GitHub Actions workflow that SWA added to your
repo is not removed by this — delete `.github/workflows/azure-static-web-apps-*.yml` manually if
you want it gone.)
