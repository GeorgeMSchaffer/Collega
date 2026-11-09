# Domain

Entities, enums, value objects and invariants. This package has no dependencies or ambient
environment access; database, HTTP and current-time rules belong elsewhere.

Consumers import feature subpaths such as `@collega/domain/ideas` or
`@collega/domain/enums`, never deep file paths or the package root. Internal relative imports use
`.js` extensions.

- Use immutable data and pure transition functions. Operations take explicit `nowUtc`; the
  application layer generates IDs and passes them in.
- Keep domain errors feature-local. The application layer translates them into kernel errors. A
  new error mapping to another HTTP status must be a sibling class, not a subclass, because
  subclasses may inherit an existing catch site's status.
- Export contract-pinned limits (for example `TITLE_MAX_LENGTH`) so application validation and
  entity invariants use the same value.
