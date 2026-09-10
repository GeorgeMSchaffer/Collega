# 50 — API CI/CD to Azure App Service

> ## ⛔ SUPERSEDED — describes the frozen .NET stack
>
> This document sets up `.github/workflows/deploy-api.yml`, which builds and deploys
> `src/Collega.API` — **frozen and never deployed**: Sprint 8 was cancelled on 2026-09-04, and the
> .NET code is deleted in slice F6 (`SPEC/decisions.md`). The shipping stack deploys to **Vercel
> with Prisma Postgres**: see `SPEC/50-vercel-deployment.md`, which is canonical for deployment.
>
> Kept as the record of what that pipeline was. **Nothing here is a build instruction**, and the
> workflow it describes is not a gate on anything.

Setup for `.github/workflows/deploy-api.yml`, which builds and deploys `Collega.API` to the App
Service from `SPEC/50-azure-deployment.md`. On every push to `main` (or a manual run from the
**Actions** tab) it publishes the API and deploys it. Migrations run automatically when the new
build boots.

Two one-time values, both in **Settings → Secrets and variables → Actions**:

## 1. Secret — the publish profile

```bash
# $API_APP and $RG are from SPEC/50-azure-deployment.md
az webapp deployment list-publishing-profiles \
  --name $API_APP --resource-group $RG --xml
```

Copy the whole XML output into a repo **secret** named `AZURE_WEBAPP_PUBLISH_PROFILE`
(Secrets tab → New repository secret).

## 2. Variable — the app name

Add a repo **variable** (Variables tab → New repository variable):

| Name | Value |
|---|---|
| `AZURE_WEBAPP_NAME` | your App Service name, e.g. `collega-api-1234` |

That's it — push to `main` and it deploys.

---

**App settings are not in this pipeline.** The runtime config the API needs
(`ConnectionStrings__DefaultConnection`, `SiteAdmin__Email`, `SiteAdmin__Password`,
`Cors__AllowedOrigins__0`, `Auth__TokenSigningKey`) lives on the App Service itself — see §3 of
`SPEC/50-azure-deployment.md`. The workflow ships code only; it never sees those secrets.

**Rotating the credential:** if the publish profile leaks, reset it in the portal (App Service →
Deployment Center → Manage publish profile → Reset), then paste the new XML into the secret.
