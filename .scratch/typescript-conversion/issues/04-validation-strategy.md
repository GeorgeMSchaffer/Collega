# 04 — What replaces the safety nets a big-bang reshape removes?

Type: grilling
Status: open
Blocked by: —

## Question

**This is the highest-leverage ticket on the map.** Charting decisions 6 and 7 compound:

- **Big-bang cutover** means no shippable intermediate — nothing to diff behavior against while in flight.
- **Reshaping the schema under Prisma** means "same data, same answers" stops being a valid check.
- The **16,615-line test suite does not survive the port**, so the ~811 assertions currently pinning behavior are gone on day one.

That is a ~61,000-line rewrite with no oracle. The user chose both deliberately after being shown this, so the question is not "reconsider" — it is **what goes in their place**.

Candidates to put to the user:

- **Contract-level golden tests.** Record request/response pairs for all 81 endpoints against the live .NET API *before* cutover, then replay against Nest. Cheap, high value, and survives a reshaped schema because it pins the HTTP surface rather than the tables. Strongest candidate.
- **Dual-run comparison.** Both stacks against a copy of production data, diff the responses.
- **Spec-derived re-derivation.** Treat `SPEC/*.md` as the oracle and rewrite tests from it. Expensive, but audits the specs as a side effect.
- **Accept the risk.** Port fast, rely on manual QA and the existing `e2e/` Playwright suite.

**Resolve by:** choosing the validation strategy and sizing it.

Whatever is chosen becomes a large, early, non-optional block of the estimate — and note the scheduling consequence: **golden-test capture must run while the .NET API is still alive**, which puts those slices *before or during* Sprint 8, not after it. That is the one part of this effort that cannot wait for the rest.

Prior evidence that this matters: Sprint 5's four Postgres defects were invisible to 561 green tests. The InMemory provider saw neither collation, SQL translation, nor DDL. A rewrite has a much larger version of exactly that blind spot.

`10` (test suite fate) is blocked on this answer.
