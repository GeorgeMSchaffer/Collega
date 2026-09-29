# 50 — API CI/CD to Azure App Service

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** SUPERSEDED — GitHub Actions deploy of the frozen .NET API to Azure App Service; never deployed.
> - **Key rules:** superseded by `SPEC/50-vercel-deployment.md`, canonical for deployment; nothing here is a
>   build instruction or a gate.
> - **Contracts:** none
> - **Decisions:** 2026-09-04 "Sprint 8 is cancelled: the .NET stack is never deployed"; 2026-09-13 "The .NET
>   stack is deleted; stale pointers go, inherited rationale stays"

> ## ⛔ SUPERSEDED — describes the frozen .NET stack
>
> - This document sets up the `deploy-api.yml` workflow (deleted 2026-09-10), which built and deployed the
>   `Collega.API` project — **never deployed**: Sprint 8 was cancelled on 2026-09-04, and the .NET code was
>   deleted in slice F6 (`SPEC/decisions.md` 2026-09-13).
> - The shipping stack deploys to **Vercel with Prisma Postgres**: see `SPEC/50-vercel-deployment.md`, which
>   is canonical for deployment.
> - Kept as the record of what that pipeline was. **Nothing here is a build instruction**, and the
>   workflow it describes is not a gate on anything.

Setup for the `deploy-api.yml` workflow (deleted 2026-09-10), which built and deployed `Collega.API` to the App
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

- **App settings are not in this pipeline.** The runtime config the API needs
  (`ConnectionStrings__DefaultConnection`, `SiteAdmin__Email`, `SiteAdmin__Password`,
  `Cors__AllowedOrigins__0`, `Auth__TokenSigningKey`) lives on the App Service itself — see §3 of
  `SPEC/50-azure-deployment.md`. The workflow ships code only; it never sees those secrets.
- **Rotating the credential:** if the publish profile leaks, reset it in the portal (App Service →
  Deployment Center → Manage publish profile → Reset), then paste the new XML into the secret.
