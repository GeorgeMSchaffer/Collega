# Collega.Application

Use-case orchestration, authorization, and validation. Depends on Domain only. This and Domain are where business rules live — never in controllers or Blazor components.

## Layout

| Folder | Holds |
|---|---|
| `Abstractions/` | Interfaces Infrastructure implements — `IUserRepository`, `IOrganizationRepository`, `IUnitOfWork`, `IPasswordHasher`, `IAccessToken*`, `IAuditEventWriter`, `IStartupSeeder`, `IClock`, `ICurrentUserContext` |
| `Auth/` | `AuthService` / `IAuthService`, `TokenAuthenticationService`, request-response models in `AuthModels.cs` |
| `Exceptions/` | `AppException` and its subtypes |

## Conventions

**Depend on abstractions, define them here.** Application owns the interface; Infrastructure implements it and registers it in DI. Adding a persistence or external-service need means adding an interface to `Abstractions/` first.

**Signal failures with `AppException` subtypes** — `ValidationAppException`, `UnauthorizedAppException`, `ForbiddenAppException`, `NotFoundAppException`, `ConflictAppException`, `LockedOutAppException`. The API layer maps each to a status code and problem-details body, so a use case never needs to know about HTTP.

**Never read ambient state.** Time comes from `IClock`, the caller's identity from `ICurrentUserContext`. No `DateTime.Now`, no `HttpContext`, no static randomness — this is what keeps the test suite hermetic.

**Authorization is a use-case concern.** Role checks (Site Admin → Org Admin → User → Read Only) and organization scoping happen here, not in controllers. A non-Site-Admin user belongs to exactly one organization; every query and mutation must be scoped to it.

**Commit through `IUnitOfWork`.** Repositories stage changes; the use case decides the transaction boundary.

Read the relevant `SPEC/20-feature-*.md` before implementing, and `SPEC/30-Contracts.md` for the shape the API expects back.
