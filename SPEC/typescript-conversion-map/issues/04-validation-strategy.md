# 04 — What replaces the safety nets a big-bang reshape removes?

Type: grilling
Status: open
Blocked by: —

## Question

A ~61,000-line rewrite is about to happen with no oracle. What pins the behavior?

## Options — select one or more

- [ ] **A — Contract-level golden tests** *(recommended)*. Record request/response pairs for all 81 endpoints against the live .NET API **before** cutover, replay against Nest. Survives a reshaped schema because it pins the HTTP surface, not the tables.
- [ ] **B — Dual-run comparison.** Run both stacks against a copy of production data and diff the responses. Strongest signal, most setup.
- [ ] **C — Spec-derived re-derivation.** Treat `SPEC/*.md` as the oracle and rewrite tests from it. Audits the specs as a side effect; expensive.
- [ ] **D — Accept the risk.** Port fast, rely on manual QA and the existing `e2e/` Playwright suite.

A and B combine well. C is really an answer to `10` as much as this ticket.

## The scheduling consequence — read before answering

If the answer includes **A or B**, those slices must run **while the .NET API is still alive** — that is, *before or during Sprint 8*, not after it. Everything else on this map can wait for Sprint 8 to close. This one cannot. Answering this ticket therefore changes the sprint calendar, not just the estimate.

## Background

Charting decisions 6 and 7 compound:

- **Big-bang cutover** — no shippable intermediate, so nothing to diff against in flight.
- **Reshaped schema under Prisma** — "same data, same answers" stops being valid.
- **The 16,615-line test suite does not survive the port** — the ~811 assertions currently pinning behavior are gone on day one.

The user was shown this and chose both deliberately, so this ticket is not "reconsider" — it is what goes in their place.

Prior evidence that this is not theoretical: Sprint 5's four Postgres defects were invisible to 561 green tests, because the InMemory provider saw neither collation, SQL translation, nor DDL. A full rewrite has a much larger version of that same blind spot.

`10` (test suite fate) is blocked on this answer.
