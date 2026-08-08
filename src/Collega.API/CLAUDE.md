# Collega.API

HTTP host and request boundary. Depends on Application and Infrastructure. **Controllers stay thin** — no business rules here; delegate to Application services.

## Run

```bash
dotnet run --project src/Collega.API/Collega.API.csproj
```

| Surface | URL |
|---|---|
| API | http://localhost:5103 |
| Swagger UI (Development only) | http://localhost:5103/swagger |
| Health check | http://localhost:5103/api/v1/health |

Port comes from `Properties/launchSettings.json`, so `ASPNETCORE_URLS` alone is ignored — bypass the profile to override:

```bash
ASPNETCORE_URLS='http://localhost:5027' \
  dotnet run --project src/Collega.API/Collega.API.csproj --no-launch-profile
```

## Seeding flags

Seeding runs inside startup and is idempotent (see [Startup](#conventions) / [`StartupSeeder`](../Collega.Infrastructure/Seeding/StartupSeeder.cs)). Two optional command-line flags let you trigger each part manually instead of relying on the environment:

```bash
dotnet watch --project ./src/Collega.API -- --seed:auth --seed:demo
```

- **No flag (default):** the Site Admin is always seeded; demo data is seeded only under the `Development` environment. Unchanged historical behavior.
- **Any `--seed:*` flag present:** explicit mode — *only* the seeds you name run, regardless of environment. `--seed:auth` seeds the Site Admin; `--seed:demo` seeds the three demo orgs. So `--seed:auth` alone suppresses the demo seed even in Development, and `--seed:demo` seeds demo data even outside Development.
- Forms accepted per flag: `--seed:demo`, `/seed:demo`, `--seed:demo=false`. Parsed from raw `args` in [`Program.cs`](Program.cs), independent of the config system.
- The startup fail-fast on `SiteAdmin:Email` / `SiteAdmin:Password` still applies regardless of flags — those keys are a deployment-validity requirement (#8), not a seeding toggle. Note user-secrets only load under `Development`, so a non-Development run needs the keys via environment variables.

Stop any API/watch process you started before finishing a session.

## Required configuration

Startup **fails fast** if `SiteAdmin:Email` or `SiteAdmin:Password` is missing ([Program.cs:18-26](Program.cs#L18-L26), per `SPEC/20-feature-auth.md` requirement #8). Store secrets in user-secrets — `appsettings.Development.json` is committed and must never hold a real password.

```bash
cd src/Collega.API
dotnet user-secrets set "SiteAdmin:Email" "admin@collega.local"
dotnet user-secrets set "SiteAdmin:Password" "<your-password>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Server=localhost,1433;Database=Collega;User Id=sa;Password=<your-password>;TrustServerCertificate=True;"
```

Environment variables work too, with a **double** underscore: `SiteAdmin__Email`, `ConnectionStrings__DefaultConnection`.

Optional: `Auth:TokenSigningKey` (base64; a random per-process key is generated if unset, so tokens don't survive a restart) and `Auth:AccessTokenLifetimeMinutes` (default 480).

## Conventions

**Routing** — never write the version segment in a controller. [`ApiVersionRoutePrefixConvention`](Conventions/ApiVersionRoutePrefixConvention.cs) prefixes every controller with `api/v1`, so `[Route("auth")]` serves `/api/v1/auth`. Use plural-noun resource routes per `SPEC/30-Contracts.md`.

**Errors** — every non-2xx response is a problem-details envelope. Throw the Application-layer `AppException` subtype and let [`AppExceptionHandler`](ErrorHandling/AppExceptionHandler.cs) map it; don't hand-build error responses in a controller.

| Thrown | Status |
|---|---|
| `ValidationAppException` | 400 |
| `UnauthorizedAppException` | 401 |
| `ForbiddenAppException` | 403 |
| `NotFoundAppException` | 404 |
| `ConflictAppException` | 409 |
| `LockedOutAppException` | 423 |

`UseStatusCodePages` covers bodiless 401/403/404s from routing and auth.

**Contracts** — request/response DTOs live in `Contracts/<Area>/`, separate from Application models. Validate with the repo's own attributes in [`Validation/`](Validation/) (`RequiredFieldAttribute`, `EmailFormatAttribute`, `MinLengthFieldAttribute`, …) rather than raw `System.ComponentModel.DataAnnotations`, so messages stay consistent with [`ValidationMessages`](Validation/ValidationMessages.cs). `SpacedDisplayNameMetadataProvider` turns `PascalCase` property names into spaced field labels.

**Auth** — custom scheme in [`Authentication/`](Authentication/): `BearerTokenAuthenticationHandler` validates the JWT, `HttpContextCurrentUserContext` adapts it to Application's `ICurrentUserContext`, `ClaimsPrincipalExtensions` reads claims. Mark protected actions `[Authorize]`.

**Startup** — [`Program.cs`](Program.cs) migrates the schema (or `EnsureCreated` for the non-relational InMemory provider used by tests) and runs idempotent seeding on every boot. `public partial class Program` at the bottom is a testing-only shim for `WebApplicationFactory<Program>`.

## Current routes

Auth: `POST /api/v1/auth/login` · `GET /api/v1/auth/me` · `PUT /api/v1/auth/me` · `POST /api/v1/auth/change-password` · `POST /api/v1/auth/register`

Organizations: `GET /api/v1/organizations` · `POST /api/v1/organizations` · `GET /api/v1/organizations/{id}` · `PUT /api/v1/organizations/{id}` · `POST /api/v1/organizations/{id}/invite-code/regenerate` · `POST /api/v1/organizations/{id}/archive`

Users: `GET /api/v1/organizations/{organizationId}/users` · `POST /api/v1/organizations/{organizationId}/users` · `POST /api/v1/organizations/{organizationId}/users/import` (CSV) · `GET /api/v1/users/{userId}` · `PUT /api/v1/users/{userId}` · `POST /api/v1/users/{userId}/temporary-password`

Diagnostics: `GET /api/v1/health`

Not yet built (Tenant Administration follow-ups): organization binary logo upload (`PUT /organizations/{id}/logo`) and organization AI-key management. User CSV import (`POST /organizations/{id}/users/import`) and board/status management endpoints are now built.

Canonical contracts (including unbuilt routes) live in `SPEC/30-Contracts.md` — read it before adding an endpoint.
