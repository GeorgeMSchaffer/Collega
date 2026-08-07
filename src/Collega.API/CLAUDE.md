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

`POST /api/v1/auth/login` · `GET /api/v1/auth/me` · `POST /api/v1/auth/change-password` · `POST /api/v1/auth/register` · `POST /api/v1/users/{userId}/temporary-password` · `GET /api/v1/health`

Canonical contracts (including unbuilt routes) live in `SPEC/30-Contracts.md` — read it before adding an endpoint.
