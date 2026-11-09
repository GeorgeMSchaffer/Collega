# Application

Use-case orchestration, authorization and validation. Depends on `@collega/domain` only; no Nest,
Prisma or HTTP types. Business rules live here, not in controllers or React components.

- Declare ports here, implement them in infrastructure and bind them in `apps/api`. Read
  `apps/api/src/common/tokens.ts` before adding or changing a binding.
- Use kernel errors from `src/common/errors.ts`; the API maps them to Problem Details. Catch
  domain errors and translate them to the kernel error required by the contract, including field
  keys where applicable.
- Inject ambient dependencies (`Clock`, `CurrentUserContext`, `UnitOfWork`, `AuditEventWriter`);
  do not use environment time, randomness or request objects directly.
- Authorization belongs in the service. View As content is scoped to the impersonated
  organization, while audit attribution remains the administrator.
- Normalize pagination with `normalizePageRequest` and `MAX_PAGE_SIZE`.
- Match the feature's existing service filename style. Tests are hermetic; a QA agent writes tests
  for services it did not implement.
