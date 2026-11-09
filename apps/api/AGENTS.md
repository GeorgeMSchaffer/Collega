# API

Nest.js request boundary and the only application layer that talks to the database. It may import
`@collega/application`, `@collega/infrastructure` and `@collega/domain`; it may not import the web
app or design system.

## Feature modules

Each feature owns `src/<feature>/<feature>.module.ts`. Build and typecheck hooks run the module
generator, which builds `src/app.modules.generated.ts`; generated files and `src/app.module.ts`
are not hand-edited. `auth/` and `common/` are excluded from generation and wired directly by the
host.

## Request and error boundaries

- Controllers parse, delegate and return; application services own business rules and
  authorization.
- Throw shared application errors. `common/errors/problem-details.filter.ts` maps them to HTTP;
  controllers do not construct error bodies or set status codes.
- Bind ports by tokens in `common/tokens.ts`; read its leading comment before adding one.
- Only `src/auth/` reads credentials. Request context uses `AsyncLocalStorage`; do not thread
  request objects through layers.
- Routes use the global `/api/v1` prefix. Read `SPEC/30-Contracts.md` and the relevant
  `SPEC/contracts/` file before API work; contracts are read-only.
- `trust proxy` and the per-IP rate limiter are load-bearing. Read `bootstrap.ts` comments before
  changing either.

## Build and deployment

Read `SPEC/50-vercel-deployment.md` §2 for build and ignore-step behavior. The API deployment runs
`db:migrate` and `db:bootstrap-admin`; the latter runs under plain Node, so its imports must not use
`.js` specifiers to reach sibling `.ts` files.

Tests are hermetic and route-level. A QA agent, not the endpoint implementer, writes endpoint tests.
