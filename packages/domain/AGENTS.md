# packages/domain

Entities, enums, value objects, and the invariants over them. **Depends on nothing** — no Nest, no
Prisma, no `@collega/*` import of any kind. If a rule needs a database, an HTTP request, or the
current time from the environment, it does not belong here.

## Layout

| Path | Holds |
|---|---|
| `src/<feature>/` | One folder per aggregate: `<entity>.ts`, `errors.ts`, `index.ts` |
| `src/enums/` | Shared enums (`Role`, `IdeaPhase`, `DeliveryStatus`, …) |
| `src/common/` | `Auditable` plus `markCreated`/`markUpdated` |
| `test/` | Vitest, mirroring `src/` |

Consumers import the feature subpath — `@collega/domain/ideas`, `@collega/domain/enums` — never a
deep file path. Inside the package, relative imports carry the `.js` extension (`nodenext`).

## Conventions

- **Immutable data plus pure transition functions, not classes.** `Idea` is a type;
  `createIdea`, `changeIdeaStatus`, `promoteIdeaToIssue` are functions that take the current value
  and return the next one. This replaced C#'s abstract entity base deliberately — see the comment
  at the top of `src/common/index.ts` before reintroducing a base class.
- **No ambient time or randomness.** Every operation takes an explicit `nowUtc`. Ids are generated
  by the application layer with `crypto.randomUUID()` and passed in, which is what keeps these
  functions trivially testable without a port.
- **Errors are per-feature classes** (`IdeaDomainError`, keyed on `field`). The kernel error model
  (`ValidationError`, `ConflictError`, …) lives in `packages/application/src/common` and cannot be
  imported here; the application layer catches a domain error and re-throws it as the kernel one.
  A new error type that must map to a different HTTP status should be a **sibling** class, not a
  subclass — a subclass silently inherits the existing catch site's status code.
- Limits that the contract pins (`TITLE_MAX_LENGTH`, `MAX_ASSIGNEES`, …) are exported constants,
  so the application layer validates against the same number the entity enforces.

There is deliberately no root entrypoint: `package.json` exports only `./*`, so
`@collega/domain` on its own does not resolve. Import the feature subpath.
