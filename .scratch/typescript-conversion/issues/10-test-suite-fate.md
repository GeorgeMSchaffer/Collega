# 10 — Port the assertions, or re-derive from spec?

Type: grilling
Status: open
Blocked by: 04

## Question

16,615 lines of C# tests, roughly 811 assertions, none of which run on the new stack.

- **Port** — translate xUnit to Vitest case by case. Preserves hard-won edge cases, but is mechanical, large, and faithfully ports the *old* design's seams into a codebase that no longer has them.
- **Re-derive** — write tests from `SPEC/*.md` against the new architecture. Cleaner, audits the specs as a side effect, and loses every edge case that was never written down.
- **Split by layer** — Domain ports nearly literally (pure logic, no framework). Infrastructure is re-derived, because the persistence layer is genuinely different under Prisma. Application and API land somewhere between.

The case for taking the edge cases seriously: Sprint 5's four Postgres defects were invisible to 561 green tests, and the tests that would have caught them did not exist until afterward. Those later tests are exactly the undocumented knowledge that "re-derive from spec" discards.

Two constraints that survive regardless of the choice:

- **Unit tests must be hermetic** — no network, filesystem, `DateTime.Now`, or randomness.
- **No test may reach a model provider.** The current suite enforces this by blanking the API key *and* swapping in an unconfigured model. This is not theoretical: before that guard existed, the integration suite made a live billed Anthropic call, and the only symptom was one test running five seconds instead of one. The TS suite needs the same guard from its first day.

Blocked by `04`: if the validation strategy is contract-level golden tests, a large share of the API-tier suite is **generated** rather than either ported or re-derived, which changes this answer materially.
