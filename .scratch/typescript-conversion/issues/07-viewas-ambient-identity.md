# 07 — How does ambient identity work in Nest?

Type: research
Status: open
Blocked by: —

## Question

AFK research. `ICurrentUserContext` is the single server-side identity chokepoint in the current system. The tracker flags it twice as load-bearing and notes that any service reading claims directly **silently opts itself out of View As**. Its client twin: the `ClaimsPrincipal` must be re-read from `/auth/me` rather than cached into a local field, or every role-gated surface renders for the real administrator mid-impersonation.

Both halves need a Nest/Next equivalent, and getting either subtly wrong fails **silently and in the direction of over-permission**. That is the worst available failure mode, which is why this is a dedicated slice rather than a line item inside the auth work.

Research and report:

- Nest **request-scoped providers** vs **`AsyncLocalStorage`** for ambient per-request identity — performance characteristics, testability, and how each behaves across async boundaries and in background work
- How either survives the **Next.js** side, where server components, route handlers, and server actions each have a different request-context story
- Whether the chokepoint property can be **mechanically enforced** rather than documented — e.g. an ESLint rule banning direct claim/JWT reads outside the auth module, mirroring how `eslint-plugin-boundaries` enforces the layer boundaries (decision 8). Documentation did not prevent this class of bug before; a lint rule would.
- **Dual attribution** — Sprint 6 shipped "acting as X on behalf of Y" in audit records. How that threads through whichever mechanism is chosen.
- How `OrgContentMutationGuard`'s server-side enforcement translates. The product rule it encodes: *a Site Admin creates organizations and users for organizations; every other activity goes through Act As.* Client affordances were previously found to be route-shaped and bypassable, so this must stay server-side.

**Resolve by:** a findings document on a throwaway `research/nest-ambient-identity` branch, linked here, with a recommendation and a worked example of the request path.

`08` is blocked on this.
