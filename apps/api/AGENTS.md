# apps/api

The Nest.js host and the request boundary. **The only thing in the repo that talks to the
database.** May import `@collega/application`, `@collega/infrastructure` and `@collega/domain`;
may not import `@collega/design-system` or `apps/web`.

Runs serverless on Vercel. `server.js` and `bootstrap.ts` are one entrypoint, not two.

## Layout

| Path | Holds |
|---|---|
| `src/<feature>/<feature>.controller.ts` | Routes only — parse, delegate, return |
| `src/<feature>/<feature>.module.ts` | The feature's own Nest module |
| `src/app.modules.generated.ts` | **Generated. Never edit.** |
| `src/app.module.ts` | Host wiring — `auth` and `common`, plus the generated barrel |
| `src/common/` | `config`, `errors`, `request-context`, `persistence`, `health`, pipes, `tokens.ts` |
| `src/auth/` | The identity chokepoint — the only place a credential is read |
| `test/` | Vitest, mirroring `src/` |

## The generated module barrel

Each feature creates **only** its own `src/<feature>/<feature>.module.ts`;
`scripts/generate-modules.mjs` scans for them and rewrites `app.modules.generated.ts`. It is wired
into `build` and `typecheck` through the package.json `pre*` hooks, so it runs on its own. Nobody
edits `app.module.ts` or the generated file by hand — that is what kept seven Wave D partitions off
the same contended import list. `auth/` and `common/` are excluded on purpose: the host imports
them directly.

## Conventions

- **Controllers hold no business rules.** Parse the request, call the application service, return
  the result. Authorization is the service's job.
- **Errors:** throw the application kernel's errors. `common/errors/problem-details.filter.ts`
  maps them to the response body; don't hand-build one, and don't set a status code in a
  controller.
- **Ports are bound by string token** — `common/tokens.ts` to
  `common/persistence/adapters.providers.ts`. Read the comment at the top of `tokens.ts` before
  adding a token; a new one is often not needed.
- **Request context is `AsyncLocalStorage`** (`common/request-context/`), because serverless leaves
  no long-lived in-process state. Don't thread a request object through the layers.
- **Every route lives under `/api/v1`**, set as a global prefix in `bootstrap.ts`.
  `SPEC/30-Contracts.md` is canonical for routes and payloads, and is **read, not edited**, by an
  API slice.
- `trust proxy` and the per-IP rate limiter are deliberate and load-bearing; read the comments in
  `bootstrap.ts` before changing either.

Tests are route-level and hermetic. An agent does not write tests for its own endpoints.
