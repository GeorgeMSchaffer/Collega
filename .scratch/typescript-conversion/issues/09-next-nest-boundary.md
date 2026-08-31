# 09 — Does Next talk to Nest over HTTP, or import the Application package directly?

Type: grilling
Status: open
Blocked by: —

## Question

Turborepo with layered packages (decision 8) creates an option the current architecture does not have. `apps/web` **could** import `packages/application` directly inside server components and skip the network hop entirely — or it could stay a pure HTTP client, exactly as Blazor WASM is today.

- **(a) HTTP only.** Preserves the seam `SPEC/30-Contracts.md` documents, keeps the 81 endpoints meaningful, keeps `04`'s golden-test strategy viable, and keeps a real public API for anything that ever wants one.
- **(b) Direct import in server components, HTTP for client-side mutations.** Faster, fewer round trips, but the contract stops being the boundary and the two paths drift.
- **(c) Direct import throughout**, with Nest reduced to a thin public API or dropped for internal traffic.

Three consequences worth being explicit about before deciding:

1. **It partly decides `04` for you.** Contract-level golden tests only pin behavior that actually crosses the contract. Under (b) or (c), an increasing share of behavior never crosses it and is unpinned.
2. **It decides where authorization runs.** Authorization currently lives in Application, which survives all three options — but under (b)/(c) the *request-boundary* checks in the API layer no longer sit on every path, and `07`'s ambient identity has to work identically in two different runtimes.
3. **It is very hard to reverse.** Going (a) → (b) later is a refactor; going (b) → (a) later means rebuilding a contract nobody maintained.

Strong **ADR** candidate under `docs/adr/` once decided — it satisfies all three of the hard-to-reverse / surprising-without-context / genuine-trade-off tests.
