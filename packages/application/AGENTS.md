# packages/application

Use-case orchestration, authorization, and validation. Depends on `@collega/domain` and nothing
else — no Nest, no Prisma, no HTTP types. This is where a request's *rules* live; `apps/api` only
carries it to and from the wire.

## Layout

| Path | Holds |
|---|---|
| `src/<feature>/*-service.ts` | The use cases — one service per feature area |
| `src/<feature>/models.ts` | Command and result shapes the service takes and returns |
| `src/<feature>/ports.ts` | The interfaces infrastructure implements for this feature |
| `src/common/` | The kernel: `errors`, `clock`, `current-user-context`, `unit-of-work`, `pagination`, `audit`, `audit-attribution`, `org-content-mutation-guard` |
| `test/` | Vitest, mirroring `src/` |

The service file is named `<thing>-service.ts` in half the features and `<thing>.service.ts` in
the other half — ten each, so neither is "the convention". Match the feature you are in; don't
rename someone else's.

## Conventions

- **Ports are declared here, implemented in infrastructure, and bound in `apps/api`.** A feature
  declares the exact shape it needs, even where another feature declares one under the same name —
  `apps/api/src/common/tokens.ts` binds one adapter to one shared token and explains why.
- **Errors come from `common/errors.ts`** — `ValidationError`, `ForbiddenError`, `UnauthorizedError`,
  `NotFoundError`, `ConflictError`, `LockedOutError`, `RateLimitedError`. Never build an HTTP
  response or a status code here; `ProblemDetailsFilter` in `apps/api` maps these.
- **Catch domain errors and re-throw them as kernel errors**, keyed on `field` where the contract
  wants a per-field `400`.
- **Everything ambient is injected**: `Clock`, `CurrentUserContext`, `UnitOfWork`, `AuditEventWriter`.
  No `new Date()`, no `Math.random()`, no reading a request object.
- **Authorization lives in the service**, not in a controller guard and not in the repository.
  View As and audit attribution are opposites on purpose — content belongs to the impersonated
  organization, the audit entry to the administrator (tracker rules 14 and 15).
- Pagination goes through `normalizePageRequest`/`MAX_PAGE_SIZE`; don't re-derive page maths.

Tests here are the bulk of the suite (19 files) and are hermetic: fake clock, in-memory port
doubles, fixed ids. An agent does not write tests for its own service — a QA agent does.
