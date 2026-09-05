# 10 — Port the assertions, or re-derive from spec?

> **Answered 2026-09-03; see `SPEC/decisions.md`.** The suite is discarded. The golden
> corpus pins the HTTP surface, and each slice writes fresh Vitest coverage for its own
> layer, by a QA agent rather than by the agent that wrote the code. The accepted gap is
> the 142 Domain + 324 Application unit assertions, which return only as slices re-write
> them. This file is kept as written.

Type: grilling
Status: answered 2026-09-03 in `SPEC/decisions.md` (discard; golden tests + per-slice Vitest)
Blocked by: 04

## Question

16,615 lines of C# tests, roughly 811 assertions, none of which run on the new stack. What happens to them?

## Options — select one

- [ ] **A — Split by layer** *(recommended)*. Domain ports nearly literally (pure logic, no framework). Infrastructure is re-derived, because Prisma is genuinely a different persistence layer. Application and API land between, guided by `04`'s answer.
- [ ] **B — Port everything.** Translate xUnit to Vitest case by case. Preserves hard-won edge cases; mechanical, large, and ports the old design's seams into a codebase that no longer has them.
- [ ] **C — Re-derive everything from spec.** Cleaner, audits the specs as a side effect, and discards every edge case nobody wrote down.

## Why the edge cases deserve weight

Sprint 5's four Postgres defects were invisible to 561 green tests, and the tests that would have caught them did not exist until afterward. Those later tests are exactly the undocumented knowledge that option C throws away.

## Constraints that survive whichever option wins

- **Unit tests must be hermetic** — no network, filesystem, `DateTime.Now`, or randomness.
- **No test may reach a model provider.** The current suite blanks the API key *and* swaps in an unconfigured model. Not theoretical: before that guard existed the integration suite made a live billed Anthropic call, and the only symptom was one test taking five seconds instead of one. The TS suite needs this guard on day one, not after it happens again.

## Blocked by `04`

If the validation strategy is contract-level golden tests, a large share of the API-tier suite is **generated** rather than ported or re-derived, which materially changes this answer. Do not resolve this ticket first.
