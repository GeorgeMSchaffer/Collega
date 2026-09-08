# 09 — Does Next talk to Nest over HTTP, or import the Application package directly?

Type: grilling
Status: open
Blocked by: —

## Question

Turborepo with layered packages creates an option the current architecture does not have: `apps/web` could import `packages/application` directly in server components and skip the network hop.

## Options — select one

- [ ] **A — HTTP only** *(recommended)*. Preserves the seam `SPEC/30-Contracts.md` documents, keeps the 81 endpoints meaningful, keeps `04`'s golden-test strategy viable, and keeps a real public API.
- [ ] **B — Direct import in server components, HTTP for client mutations.** Faster, fewer round trips. The contract stops being the boundary and the two paths drift.
- [ ] **C — Direct import throughout.** Nest reduced to a thin public API, or dropped for internal traffic.

## Three consequences before you pick

1. **It partly decides `04` for you.** Contract-level golden tests only pin behavior that crosses the contract. Under B or C, a growing share never crosses it and goes unpinned.
2. **It decides where authorization runs.** Authorization lives in Application under all three options — but under B/C the request-boundary checks no longer sit on every path, and `07`'s ambient identity has to work identically in two runtimes.
3. **It is very hard to reverse.** A → B later is a refactor. B → A later means rebuilding a contract nobody maintained.

Strong **ADR** candidate under `docs/adr/` once decided: hard to reverse, surprising without context, and a genuine trade-off.
