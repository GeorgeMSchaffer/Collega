# golden — the Wave A capture and replay harness

The TypeScript conversion is a big-bang rewrite of ~60,000 lines onto a reshaped
schema, which removes both safety nets at once: there is no shippable
intermediate to diff against, and "same data, same answers" stops being true.
The 811-test .NET suite does not survive the port either. **This harness is what
replaces them** — `SPEC/50-typescript-migration.md` constraint 10, and slices
A1/A2/A3 of the Wave A table.

It records what the live .NET API answers, for every endpoint and every role,
and replays that against whatever is standing there later. Today that is .NET
itself, as a self-check. In Wave F it is Nest, and the failure list is the
remaining work.

**The capture has a deadline.** Once Sprint 8 closes and the .NET stack is
retired, the recording cannot be made and the conversion has no oracle at all.

## Running it

Node 22.18+ or 24 — the harness is plain TypeScript run through Node's own type
stripping, with no build step and no runtime dependencies.

```bash
node tools/golden/src/cli.ts inventory          # the 81 endpoints, read from the controllers
node tools/golden/src/cli.ts scaffold           # a scenario stub per controller, every endpoint × role
node tools/golden/src/cli.ts coverage           # what the corpus does and does not pin
node --test "tools/golden/test/*.test.ts"       # the harness's own tests

# capture (slice A2) — against the live .NET API, on a freshly seeded database
GOLDEN_PASSWORD='Abc123!' node tools/golden/src/cli.ts capture --base-url http://localhost:5000

# replay (slice A3) — same command, pointed at the target stack
GOLDEN_PASSWORD='Abc123!' node tools/golden/src/cli.ts replay --base-url http://localhost:3000
```

Credentials come from the environment, never from a committed file:
`GOLDEN_PASSWORD` for all four roles, or `GOLDEN_<ROLE>_PASSWORD` and
`GOLDEN_<ROLE>_EMAIL` individually. Emails default to the demo seed's four
accounts (`SPEC/implementation-agent-tracker.md`, Local DB).

## The pieces

| Path | Slice | What it is |
|---|---|---|
| `src/inventory.ts` | A1 | Reads `src/Collega.API/Controllers/*.cs` for routes, roles and declared statuses. Coverage is measured against this, so a route change shows up as a coverage hole rather than as silence. |
| `src/scenarios.ts` | A1 | The scenario format: data, never code. Loading, validation, `{{variable}}` interpolation, and the small `$.body.x[0].y` pointer used to bind an id out of one response into the next request. |
| `src/runner.ts` | A1 | One execution engine, used by both capture and replay — if they drove the API differently, a diff would report the harness. |
| `src/normalize.ts` | A1 | Volatile-value handling. See below; it is the part most worth reading. |
| `src/corpus.ts` | A1/A2 | Fixture read/write, one JSON file per case plus a manifest. |
| `src/coverage.ts` | A1 | Endpoint × role × case-kind coverage, including "happy path only". |
| `src/scaffold.ts` | A1 | Generates the full grid of stubs so A2 is filling in blanks rather than remembering which of 405 cells it has not written. |
| `replay/replay.ts` | A3 | Compare, report, exit non-zero. |
| `scenarios/` | A2 | What to ask, in what order, as whom. `auth.json` is the worked example. |
| `fixtures/` | A2 | The corpus. Committed — it *is* the oracle. |

## Normalization, and why labels rather than ordinals

Two runs of the same request differ in ways that are not behaviour: new GUIDs, a
new token, later timestamps. Blanking them all would hide real findings, because
half of what these fixtures pin is *identity relationships* — that the board on
the idea you just read is the board you just created.

So a GUID is labelled **by the position it was first seen at**, and the labels
live for the whole scenario rather than for one response:

```
create → body.id          3f2504e0-…  →  <guid@create.body.id>
read   → body.id          3f2504e0-…  →  <guid@create.body.id>   same value, same label
read   → body.boardId     3f2504e0-…  →  <guid@create.body.id>
read   → body.authorId    b1e0a5f2-…  →  <guid@read.body.authorId>
```

Replay a stack that returns a *different* board on that read and the value has
not been seen before, so it is labelled by its own position instead and the diff
reports `body.id`. That is the point: a wrong relation, or a leak across
organizations, is the most expensive defect this corpus exists to catch, and it
does not show up anywhere inside a single response.

Ordinal aliases (`<guid:1>`, `<guid:2>`) cannot catch it. Two structurally
identical responses holding entirely different ids normalize to identical bytes
and replay reports a match. The harness used ordinals in its first draft; a test
now pins the difference (`test/normalize.test.ts`, "a relationship that should
hold across steps, and does not, is caught").

Timestamps become `<timestamp>` and JWTs `<jwt>`, since neither carries a
relationship worth pinning. Response headers are compared against an allow list,
because `Date` and `Server` differ by stack and say nothing.

Anything genuinely unstable beyond that — a generated invite code, an expiry —
is declared per step in `unstable`, and dropped from both sides before the diff:
`"body.expiresAt"`, or `"body.items[].code"` to reach through an array. Each one
is a small hole in the oracle, so keep the list short and say why in the step's
`note`.

**Reading a failure list, one caveat.** Because labels are minted per scenario,
a step that fails outright takes its ids with it: a *later* step that would have
echoed one of them has nothing to match against, so it is labelled by its own
position and reports a mismatch too. One broken step can therefore look like
three. Triage a scenario's failures in step order and fix the first — the
followers often go with it.

## Credentials do not reach the corpus

Recorded bodies are **redacted in both directions** before they are written:
`password`, `newPassword`, `currentPassword`, `temporaryPassword`, tokens and
the like become `<redacted>`, at any depth and through arrays.

Requests, because the corpus is committed and capture runs against whatever
`GOLDEN_PASSWORD` points at — not always the demo seed — so a recorded login
body would be a credential in git. Nothing downstream needs it: replay
re-derives every request from the scenario files.

Responses, because two endpoints in the 81 *mint* credentials —
`POST /users/{userId}/temporary-password` returns a working password for a real
account, and `POST /organizations/{id}/users/import` returns one per created
row. Both are in the coverage grid, so A2 will record them. Leaving that to a
per-step `unstable` declaration would make it depend on every author
remembering, for a field they have not met yet.

And **invite codes**, which are the least obvious and the most exposed: an
invite code is a standing, non-expiring credential that self-registers anyone
into an organization, and it rides on `GET /organizations` and
`GET /organizations/{id}` — ordinary list responses in every capture, not an
endpoint anyone would think to flag.

This costs almost no coverage: `<redacted>` appears identically on both sides of
a replay, so each field's presence and position stay pinned. A **null** secret is
left alone on purpose — a rejected import row is issued no password, and a stack
that starts issuing one there is a defect, not a secret. Emails are kept too:
which identity made the call is the case.

**The one thing it does cost**, stated so nobody assumes otherwise: since every
redacted value reads the same, the corpus cannot see that a value *changed*. So
`POST /organizations/{id}/invite-code/regenerate` is pinned as "returns an invite
code, 200" but not as "returns a **different** one". That assertion belongs in a
Vitest test against the service, and Wave C or D owes it one.

## Writing a scenario

`scenarios/auth.json` is the template. Every step names the inventory endpoint it
exercises (which is what coverage counts), who makes the request, what kind of
case it is — `success`, `denied`, `invalid`, `missing` — and the status the
author expects.

`expect` is a claim, not an assertion: the API is the oracle, so a mismatch is
still recorded, and reported as a **surprise**. A corpus full of surprises is one
whose author did not know what they were pinning; work through them before
committing the fixtures.

Steps run in order within a scenario and share bound variables, which is what
makes create-then-read sequences expressible. It also makes the corpus
order-dependent: **capture and replay both start from a freshly seeded
database**. That is the price of covering mutating endpoints at all.

Scaffolded steps carry `"todo": true`. The runner skips them and `capture` exits
non-zero while any remain, so a half-written corpus cannot quietly pass for a
whole one.

**Treat the scaffold's guesses as guesses.** It reads the controller's
`[Authorize]` attribute, and most of this API's actions carry a bare one — so it
proposes `success` for all four roles. That is often wrong: the role check
frequently lives in the Application layer instead (`AiPromptService` refuses an
impersonating Site Admin; `OrgContentMutationGuard` refuses direct org-content
mutation outright), and the controller attribute cannot see it. Expect to correct
a good number of scaffolded `success` cells to `denied`. The first capture will
tell you which, as surprises.

## What "done" looks like for Wave A

- Every one of the 81 endpoints has at least one case, at every role the
  inventory says can reach it — `coverage --from fixtures` reports the holes.
- Error paths and validation failures are in there. Authorization is behaviour:
  a 403 that a rewrite turns into a 200 is the single most expensive defect this
  corpus exists to catch.
- `replay` against the .NET API the corpus was recorded from comes back clean.
  If it does not, the harness is measuring itself and the fixtures are worthless.
- The fixtures are committed.
