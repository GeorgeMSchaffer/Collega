# Decisions

A dated log of decisions that constrain later work. One entry per decision: what was
decided, when, and enough of the reason that a reader six months out does not reopen it
by accident. Newest first.

Supersession is recorded, not edited away — if a decision replaces an earlier one, both
stay, and the older one is marked.

---

## 2026-09-10 — `POST /auth/register` refuses a taken email generically, and no longer answers `409`

**An email address already in use is now the same field-keyed `400` every other registration
refusal produces**, keyed on `email` and worded so it does not say the account exists. The `409
"Email is already in use."` the frozen .NET API returned is gone. `SPEC/30-Contracts.md` is
updated.

**The reason is cross-tenant account enumeration by an anonymous caller.** `register()` checks
`existsByNormalizedEmail`, and `users.normalized_email` is globally `@unique`
(`packages/infrastructure/prisma/schema.prisma`) — the check therefore spans every organization,
not the one whose invite code was supplied. Anyone holding any organization's invite code, which
is a standing non-expiring credential printed on an admin screen, could ask "does this address
have an account here" about **every tenant**, Site Admins included, without signing in. A security
audit confirmed it against the running API. Scoping the check per organization is not available:
the uniqueness constraint is global and the schema is frozen at S0.2.

**The precedent this follows is three lines above it in the same function.** An archived
organization's invite code is already "surfaced identically to 'unknown code' so the API doesn't
leak archive state to an anonymous caller." Same shape of problem, same answer, and both now carry
a comment saying the sameness is deliberate — the failure mode for this kind of fix is a later
reader deciding the vague message is unhelpful and making it specific again.

**The real reason is not lost, it is moved off the wire.** The rejection writes a
`UserSelfRegistrationRejected` audit event carrying the organization, the normalized email and
`reason: 'EmailInUse'`, through the audit path that already existed; an operator can still answer
"why did this person's registration fail". Nothing new was built for it.

**Separately, `validatePassword` moved above the email check.** It stands on its own and would
have been worth doing under either outcome: a probe now costs a request carrying a policy-valid
password rather than any request at all.

**What this does not claim.** The endpoint still refuses, so a caller learns that *some* detail is
unacceptable — the residual oracle is weaker but not zero, and closing it entirely means
registration that answers `201` and sends a verification email instead, which is a feature nobody
has asked for. The rate limit added the same day bounds how fast the residue can be sampled.

**Cost: the golden case `profile.register.duplicate.anonymous` is retired, not accepted.** This is
the one place the 2026-09-09 entry's "accept and record it" answer is unavailable, and that is
deliberate rather than an oversight in the harness. `tools/golden/test/accepted.test.ts` asserts
that **no accepted-diff entry may name `status` or a header** — "would let an entry excuse
transport or an authorization outcome" — because a status that quietly moved is exactly how an
authorization regression would hide. A 409 becoming a 400 is a status change and nothing else, so
the corpus cannot express it, and an entry that tried was refused by that test. The scenario step
and its fixture are therefore removed together, leaving `register.anonymous` (201) and
`register.bad-code.anonymous` (400) still pinning the endpoint including one refusal.

**What that gives up, and how to get it back.** No recorded case now pins what a taken email
answers, so the two specs above are the only statement of it. The case should be re-recorded
against the Nest stack once F1 has replayed clean — at that point the corpus stops being a .NET
recording anyway, and this endpoint gets a pinned refusal again.

**Downstream:** `apps/web/lib/server/auth-actions.ts` already handles a `400` with an `errors` bag
and keys it onto the same field, so the register screen renders the new refusal without a change.
Its `409` branch and the two comments describing it are now dead and should be removed.

---

## 2026-09-10 — The organization's title rides on `/auth/me`, not on a second call to an admin endpoint

**`GET /auth/me` now carries `organizationTitle`.** The sidebar names the organization on every
authenticated page and the summary carried only an `organizationId`, so `apps/web` resolved the
title by calling `GET /organizations/{organizationId}` alongside it.

That workaround was not merely wasteful, it was **wrong for two of the four roles**. That endpoint
goes through `OrganizationService.getById` → `loadForAdministration`, which throws `ForbiddenError`
for anything that is not a Site Admin or an in-scope Org Admin. The web side swallowed the 403 to
`null`, and `null` is the Site Admin branch — so every `User` and `ReadOnly` account read "All
organizations" on every page, and paid a guaranteed-403 round trip per request for it. The bug was
invisible because the fallback rendered something plausible.

**The alternative considered and rejected: widening `GET /organizations/{id}`'s read scope.** The
sidebar needs a name, not an administrative view — that payload carries the invite code, the
primary contact and the AI scope statement — and loosening an admin endpoint to serve a label is a
larger authorization surface than the problem deserves. `/auth/me` is already fetched exactly once
per request, so putting the title there removes the second call instead of authorizing it.

**`null` means "belongs to no organization" and nothing else.** A Site Admin is the only caller
that gets it; `users.organization_id` carries a restricted foreign key and `organizations.title` is
`NOT NULL`, so a caller with an organization always has a string, empty if it was named that way.
The two cases must stay distinguishable or the client's branch is back to guessing, which is the
defect this entry closes.

The field is on the shared `CurrentUserSummary`, so it appears on every response that returns one —
login, the profile and portrait edits, and both identities on `POST /auth/view-as`. It cost 31
accepted golden diffs (`tools/golden/src/accepted.ts`, 2026-09-10), which is the third answer under
the 2026-09-09 entry: a deliberate improvement, recorded rather than fixed.

---

## 2026-09-10 — How the two Vercel projects are configured, and how production gets its first administrator

**Decided while writing `SPEC/50-vercel-deployment.md`**, which is now canonical for deployment and
carries the detail. This entry records only the choices that constrain later work, and the two that
were made rather than merely written down.

**The two Azure deploy workflows are deleted**, not merely dead. `.github/workflows/deploy-api.yml`
and `deploy-client.yml` were recorded as dead on 2026-09-04 when Sprint 8 was cancelled, but they
stayed on disk as a record of it and kept their `push: main` trigger — so they would have run
`dotnet test` and `dotnet publish` against the frozen stack on the next merge to `main`, and failed.
A record that still fires is not a record. `ci.yml` is now the only workflow. **Their two secrets
outlive them**: `AZURE_WEBAPP_PUBLISH_PROFILE` and `AZURE_STATIC_WEB_APPS_API_TOKEN` are stored on
the repository, deleting a workflow does not remove them, and a publish profile is a credential -
revoke both in repository settings.

**Two projects from one repository**, root directories `apps/web` and `apps/api`. Forced, not
preferred: one project would mean `apps/web` importing `packages/application` and
`packages/infrastructure`, which `biome.json` fails and `tools/boundaries` asserts. Ticket `08`
already priced the cross-origin cost. Both carry a committed `vercel.json` — framework, install,
build, ignore, regions — so the only setting that lives in a dashboard is Root Directory, which
Vercel needs before it can read the file.

**The API deploys its compiled output, not its source.** `apps/api/server.js` is a one-line
`import './dist/main.js'`, and it exists because Nest resolves constructor dependencies from
`design:paramtypes`, which only `tsc` with `emitDecoratorMetadata` emits — esbuild does not
implement it at all. A build that compiled `src/main.ts` itself would deploy an application that
looks healthy and fails to resolve every provider on the first request. Vercel prefers a root-level
entrypoint over `src/main.ts`, which is what makes the file work; `src/main.ts` already ends in a
`listen()`, so nothing else was needed.

**`prisma migrate deploy` runs in the API project's build command**, after the compile and before
the deployment serves traffic. It is the only place that reliably holds the right `DATABASE_URL`,
it runs exactly once per deployment, a failed migration fails the build so a half-migrated
deployment never goes live, and putting it after the compile means a build that was going to fail
anyway never touches the database. **The consequence for later work:** every migration must be
backward-compatible with the deployment before it, because Vercel's Instant Rollback moves code and
nothing moves the schema back. Expand now, contract in a later release.

**`ACCESS_TOKEN_SIGNING_KEY` is now required when `NODE_ENV=production`** — a code change, in
`authFragment`. Absent, the key was generated per process, which is fine for one local process and
actively harmful on serverless: **every cold start is a new process**, so two warm instances sign
with different keys, sessions issued by one are rejected by the other, and users are signed out at
moments nobody would trace back to a missing environment variable. Refusing to boot is the cheaper
failure, and it matches what `SiteAdminConfig` already does.

**Production gets its first administrator from a deploy step, not from boot.** This was the gap
worth finding: the demo seed throws when `NODE_ENV=production`, so a freshly migrated production
database has **zero users and an unusable login screen**, while `apps/api` reads
`SITE_ADMIN_EMAIL`/`SITE_ADMIN_PASSWORD`, refuses to boot without them, and then does nothing with
them. `SPEC/20-feature-auth.md` requirement 8 says "created on first run", and on serverless first
run happens on every cold start — so the answer is neither boot nor the demo seed but
`packages/infrastructure/prisma/seed/bootstrap-site-admin.ts`
(`pnpm --filter @collega/infrastructure db:bootstrap-admin`), in the API build command after the
migration and runnable by hand by anyone holding `DATABASE_URL`. It creates one account with
`must_change_password` set (requirement 9), leaves an existing one untouched including its
password, logs and exits 0 when the variables are unset rather than inventing a credential, and
derives its id the same way the demo seed does so a development database that has seen both holds
one row.

**Previews point at a shared staging API and a shared staging database**, addressed through the API
project's `dev` branch alias. Two pull requests changing the API at once therefore share a backend,
and a web preview exercises `dev`'s API rather than its own branch's. Accepted for a product with
no users; the answer when it stops being acceptable is a Vercel custom environment, not a database
per pull request.

**What could not be decided from here.** The session that wrote this had no Vercel access —
`list_teams` returned empty and project reads answered 403 — so nothing was created, deployed or
observed. `SPEC/50-vercel-deployment.md` §11 lists six things that are unverified and where each
would first show itself; §12 is the ordered handoff. Read §11 before treating the first failed
deployment as a defect in this configuration.

---

## 2026-09-09 — Shipping for feedback outranks fidelity to the .NET app

**Decided by the user**, unprompted, when asked to choose between four ways of making a CSV export
fixture match a September capture date:

> *"You are too focused on the .NET application. The app was in development but not live so we are
> free as we want to change things… The most important thing right now is to get the MVP in the
> hands of end users to gather feedback. Strict adherence to what .NET was doing is not needed. I
> care about meeting the requirements but not on how we get there."*

**What this changes.** The conversion ports the frozen app's **functionality and requirements**, not
its implementation. Where the old behaviour is a good answer, match it — it is a free, well-tested
default. Where a better answer exists, take it and say so in a comment. Do not contort code to
reproduce a .NET quirk with no user value, and do not defer a fix because no fixture records the
wording.

Two things had already been blocked on the older assumption and are now unblocked. The malformed
field-option id answered `201` with a silently different id because matching .NET's `400` would have
needed invented message text; it now answers `400`, using the canonical template in
`SPEC/30-Contracts.md` rather than a transcription. And `SEED_NOW` — a proposal to make the seed's
clock injectable purely so the export fixtures could byte-match — is **dropped**. Those four diffs
are accepted instead.

**What this does NOT change: the golden corpus stays.** Its job changes, and the distinction is the
whole point of this entry. It is a **regression detector**, not the specification. Treating it as
the specification is what produced work like "the export CSV must byte-match a September 4th
capture", which buys nothing.

The corpus is also still the only broad safety net on the API: the .NET suite was discarded
(ticket `10`), and `apps/api` has 87 unit tests against 66 endpoints. So keep replaying it, and
change what a diff *means*. A diff is now a **question with three valid answers**:

1. **Fix it** — the old behaviour was right and we broke it.
2. **Accept and record it** — the difference is deliberate or harmless.
3. **Do better** — the old behaviour was wrong; improve on it and note why.

Nine accepted diffs stand today: four portrait bytes (sharp and ImageSharp encode the same PNG
differently — unfixable by matching), four CSV export dates (seeded relative to the run day), and
the `accessToken` removal under decision `08`.

**The consequence for F1, which needs deciding before that gate runs.** F1 is defined as "replay all
81 endpoints × 4 roles, clean". Under this decision "clean" can no longer mean zero diffs, or the
gate fails forever on differences we chose. It should mean **every diff is either fixed or on a
recorded accepted list** — otherwise, once diffs start being waved through case by case, the gate
quietly stops meaning anything. That list is `tools/golden/src/accepted.ts`, written the same day; `SPEC/50-typescript-migration.md` F1 now says so. An entry there asserts what the difference is *allowed to look like* rather than muting the path, so the field stays pinned to a shape, and an entry that stops excusing anything is reported as stale.

**Why this needed writing down.** Six agents built Wave D against the older assumption, and it is
baked into their briefs — "the .NET source is the specification", "the corpus is the oracle". Those
sentences are now half-true, and an agent that reads them without this entry will keep optimising
for the wrong thing.

**What it does not license.** Not a licence to diverge casually. A difference nobody decided is
still a defect — the nine defects Wave D's reviews found were real precisely because nobody had
chosen them. The change is that a difference someone *has* decided is now a legitimate outcome, and
should be recorded rather than fixed.

---

## 2026-09-09 — The drifted database is rebuilt, not migrated

**Decided by the user**, asked directly: *"there is no production data so feel free to recreate the
DB… it won't have impact."*

**What happens.** The EF-migrated database is dropped and rebuilt from the baseline migration plus
the demo seed, rather than repaired in place. Verified end to end on 2026-09-09:

```
dropdb Collega && createdb Collega
pnpm --filter @collega/infrastructure db:migrate
pnpm --filter @collega/infrastructure db:seed
```

**3.7 seconds**, producing 2 organizations, 10 users, 4 boards and 44 ideas; `db:check-enums`
reports `0 of 9 columns need migrating`, and the live-database suite passes 28/28 against the
result. Correct by construction rather than repaired.

**Why this is now available at all.** It was not, two days ago. The 2026-09-07 entry below rejected
recreation because the database was the only copy of its own contents — the seed modules were an
empty array, so nothing could rebuild the demo data. The seed landed on 2026-09-08 and removed that
constraint. **This is the second decision the seed reversed**, after `DATABASE_URL` being withheld
from cloud sessions; both were correct when taken and wrong within a day, which is worth noticing
about how fast the ground moved here.

**The in-place migration stays on disk**, at
`packages/infrastructure/prisma/manual/2026-09-08-ef-enum-drift.sql`. It is no longer the plan, but
the drift exists in every pre-existing developer database, and someone with local data they would
rather not lose still needs it. It is verified, idempotent, and documented as the exception.

**Consequence, decided the same day.** `CLAUDE.md` named the database as one of three things that
survive cutover, alongside `SPEC/` and `tools/golden`. That was load-bearing while it was
irreplaceable; it is now reproducible in under four seconds from committed code. **The database is
removed from that list.** F3 (data migration) and F4 (cutover runbook) should be planned on the new
basis — if the target is seeded fresh, F3 may not be a slice at all, which is the largest scope
reduction available in Wave F.

## 2026-09-08 — Wave G is cut from the conversion and revisited after cutover

**Decided by the user**, asked directly, with the alternatives on the table (keep it as planned;
cut it now; defer the call to the F1 gate).

**What is cut.** Wave G — Loop, decision records, the commitment strip, and Triage Mode — roughly
ten slices, and the only part of Sprint 9 that is not a re-expression of something that already
exists. It was admitted on 2026-09-03 (ticket `01`, Question C) and gated on F1 going green.

**Why now rather than at the gate.** The plan named Wave G as the part that could be cut without
the conversion failing, and the conversion is where the risk is: Wave D owes all 81 endpoints and
has built one. Deciding now removes it from every estimate and every sequencing conversation
between here and cutover, instead of leaving ten slices of ambiguity attached to the gate. Deferring
the call was offered and not taken.

**What this does not mean.** Not cancelled — *revisited after cutover*, with a working product in
hand and the real cost of D and F known rather than estimated. Nothing about its scope is
retracted; `SPEC/50-typescript-migration.md` §5 keeps the wave's definition so it can be picked up
as written.

**What it changes downstream.** F1 stays the gate, but it now releases only F6 (deleting the .NET
solution) rather than F6 and Wave G. The schema amendment slice that ticket `06` says Wave G buys —
S0.2 deliberately did not lay down Wave G's entities — is deferred with it, and is still owed
whenever the wave is picked back up.

**Supersedes** the 2026-09-03 answer to `01` Question C to the extent that it scheduled Wave G
inside this effort. The scope decision itself stands.

## 2026-09-08 — Application-layer test coverage is paid down alongside Wave D, not after it

**Decided by the user**, asked directly, with "after Wave D lands" and "rely on the golden corpus
instead" offered.

**The measurement.** Counted from the tree on 2026-09-08: `packages/application` is the largest
package at **14,876 lines**, it carries authorization, and it has **35 tests**. `apps/web` has
**94** over 8,544 lines. The ratio is inverted against risk — a defect in the web layer shows a
wrong screen, a defect here shows one organization another organization's data.

**Why not wait for the gate.** The golden corpus does cover authorization at four roles across all
81 endpoints, so F1 would eventually catch a role regression. But only end to end, only once Wave D
is finished, and it cannot localise a failure to a use case. Wave D slices are about to build
controllers over these use cases; catching a defect while the use case is being read is cheaper
than catching it at the gate.

**Shape.** A QA slice in its own worktree, per `CLAUDE.md`'s rule that the agent who wrote code does
not test it, run in parallel with Wave D rather than after. The Wave E precedent is the model:
102 tests, and **every rule verified by breaking it** — 21 mutations, 21 caught. A suite that has
not been shown to fail has not been shown to do anything.

## 2026-09-08 — An empty state's action is disabled with a reason, never omitted

**The conflict.** Comp Q applies two different rules to the same situation. Its delivery screens
(`s-sprint`, `s-roadmap`, `s-issue` tasks) render an empty state's action three ways under
`data-roles`: live for an Org Admin, `aria-disabled` for a Site Admin with *"Act as an Acme Robotics
administrator to …"*, `aria-disabled` for a member with *"Administrators only"*. But `s-home`,
`s-boards`, `s-board` and `s-outcome` simply **omit** the control for roles that cannot use it, and
let the sentence carry the explanation instead.

**Decided: disabled with a reason, everywhere.** `apps/web/components/common/gated-action.tsx` is
the single implementation, and every empty state goes through it.

**Why, given it diverges from four comp Q screens.** `20-feature-client-ui.md` already settled this
on 2026-09-02 — *"Denied is shown, not hidden"* — for controls generally, and an empty state's
action is a control. Shipping both conventions would teach a reader two rules for one situation and
make the product's shape depend on which screen they happened to reach. The omitting variant also
loses something the disabled one keeps: a member who never sees the control cannot learn that the
capability exists or who to ask for it.

**What this does not change.** Page-level gating stays as it is: a whole route closed to a role
still shows the refusal panel rather than a reduced screen, and the settings hub still leaves an
administrative section **absent rather than refused**. The rule here is about a control inside a
screen the reader may legitimately be on, which is the case comp Q's own delivery screens already
answer this way.

---

## 2026-09-07 — The live database cannot accept a Prisma write on seven columns

**Found, and verified against the running `collega-postgres`:** the database has **zero**
user-defined enum types. `schema.prisma` declares **nine**. Seven columns Prisma expects to be
native Postgres enums are not:

| column | live | schema |
|---|---|---|
| `users.role`, `users.status` | `character varying` | `Role`, `UserStatus` |
| `notification_events.event_type` | `character varying` | `NotificationEventType` |
| `ai_usage_records.outcome`, `.key_source` | `character varying` | enum |
| `field_definitions.field_type` | **`integer`** | `FieldType` |
| `idea_types.field_mode` | **`integer`** | `IdeaTypeFieldMode` |

`__EFMigrationsHistory` is present, so this is the EF-migrated database — the one slice S0.2
introspected and then reshaped. The reshape promoted nine enum columns to native types; the
database was never migrated to match.

> **Partly superseded 2026-09-09.** The paragraph below argues recreation is unavailable because the database is irreplaceable. That stopped being true when the demo seed landed on 2026-09-08; the chosen resolution is now a rebuild. The description of the defect itself still stands.

**Why this blocks rather than annoys.** Prisma emits a `::"public"."<Enum>"` cast, so *every write
through any of those columns fails*. That is users, notifications, custom fields, idea types and AI
usage — most of the product. The last two rows are worse than a missing type: `integer` to enum is a
**storage** change, so creating the enum types does not close it. And `CLAUDE.md` lists the database
as one of three things that survive cutover, so "recreate it" is not available either. This is a data
migration, and it does not exist.

**Corroborating evidence already in the tree:** `packages/infrastructure/test/constraint-errors.test.ts`
records that the dev database still has `field_type` as `integer`. That was written down as an honest
disclosure and never resolved.

**Why it was found by accident.** A fix agent needed a live database to prove a notification write
committed, hit `type "public.NotificationEventType" does not exist`, and worked around it on a scratch
database built by `prisma db push`. No test touches the real database except one that is
`skipIf(!DATABASE_URL)` and skips in CI, so nothing in the suite would ever have said this.

**Do this before F1.** Golden replay against Nest will otherwise present as a mass failure with a
misleading cause — it will look like the port is broken rather than the database being unmigrated.

---

## 2026-09-07 — Golden replay cannot authenticate against the Nest API, and F1 is the gate

**Found:** `tools/golden` authenticates with a bearer token read from the login response body.
`apps/api` issues and reads an httpOnly session cookie. Neither is wrong; they disagree, and F1
— "all 81 endpoints × 4 roles replay clean against Nest", the gate before cutover — fails on every
authenticated case as a result. That is 447 of 447.

**Why they disagree.** Decision `08` (2026-09-04) chose the cookie and explicitly rejected a bearer
token in client-reachable JavaScript as "the exact defect that cost a sprint to find". Wave D
implemented that correctly — `apps/api/src/auth/session-cookie.ts` sets `httpOnly`, `secure`,
`sameSite`, and `auth.guard.ts` reads the cookie. But the corpus was recorded in Wave A against the
**.NET** API, which is bearer-only, and decision `08` was never propagated into
`SPEC/30-Contracts.md` — the string "cookie" appears there **zero times**.

**The evidence, so nobody re-derives it:**
- `tools/golden/src/runner.ts:115-118` throws `login as ${role} returned no accessToken`.
- `runner.ts:133` sends `authorization: Bearer …` on every subsequent request; there is no cookie jar.
- `tools/golden/fixtures/auth.login.*.json` pin `accessToken` in the 200 body.

**Not yet decided, and not this note's to decide:** the corpus cannot simply be re-recorded, because
the only thing that can record it is the bearer-only .NET app. The likely shape is that the harness
gains a cookie jar and the **login fixture alone** becomes an explicitly marked non-replayable
deviation — everything downstream of it replays normally once the jar carries the `Set-Cookie`.
That keeps the deviation to one fixture rather than a class of them.

**Why this is logged rather than fixed.** It sits across `tools/golden`, `apps/api` and
`SPEC/30-Contracts.md` — the seam belongs to whoever owns Wave D, and that owner was not reachable
when this was found. Recorded so it is caught **before** the cutover gate rather than at it, which
is the worst possible moment to discover the oracle cannot run.

Raised by the identity security review, 2026-09-07. That review's own headline — that Wave D was
heading into the rejected bearer design — was **wrong**, and is corrected here: it read an older
file state. Wave D built the cookie correctly. Only the corpus is stale.

---

## 2026-09-06 — The .NET stack is frozen; its code and instructions are no longer applicable

**Decided:** `src/Collega.*`, `tests/`, `Collega.sln` and every .NET instruction file are
**frozen**. They describe a stack that is being replaced, not the one being built. From today:

- **Do not read the .NET code or its `CLAUDE.md` files for guidance on how to build anything.**
  They are not the house style for the TypeScript stack; `packages/*` and `apps/*` are.
- **Do not fix bugs, add features, write tests, or refactor there.** A defect found in .NET is
  recorded against the TypeScript port, not repaired in C#.
- **Do not add a .NET migration, package, or endpoint.** The schema is frozen at S0.2 and Prisma
  owns it now.

The code stays on disk until **F1 is green** — all 81 endpoints × 4 roles replaying clean against
Nest — and its deletion is a named slice, **F6**. Then `src/`, `tests/`, `Collega.sln`,
`global.json` and the compose `api` service go, in one commit.

**Why frozen now rather than deleted now.** The one thing the .NET app is still good for is
**re-recording a golden fixture**. Wave A banked 447 cases over all 81 endpoints on 2026-09-03, which is what bought
the freedom to stop maintaining .NET at all — but Waves D and E are exactly where a missing or
subtly wrong fixture surfaces, and the corpus is the *only* oracle this conversion has
(constraint 10; the standing risk in §1). Deleting the recorder before the recording has been
used against Nest would give that up for nothing. Git history is not a substitute: replaying from
an old commit means resurrecting a schema Prisma has since reshaped.

**Why the docs needed this at all.** The direction was never in doubt — §8 has said "the .NET
solution is not converted, it is replaced" since charting, and Sprint 8's cancellation on
2026-09-04 means it is never even deployed. But every instruction file still *read* as though
.NET were the live stack: root `CLAUDE.md` said "only the first one exists" and "there is no
`package.json`", `AGENTS.md` documented .NET conventions with no caveat, and each layer's
`CLAUDE.md` gave detailed guidance with nothing marking it dead. An agent opening
`src/Collega.Application/CLAUDE.md` had no way to know it was reading an epitaph. That is the
drift this entry closes.

**What this does not change.** The .NET app remains the only *runnable* application until Wave D
and E land, so `demo.md` and the README still document how to start it — as the thing to look at
and to re-record from, explicitly not as the thing to extend.

**Supersedes** the `pnpm-workspace.yaml` note and §7's rollback posture, both of which assumed a
deployed .NET stack to fall back to. Sprint 8's cancellation removed it; there is no deployment
to roll back to, and F4 must state the rollback unit in terms of the database alone.

---

## 2026-09-06 — Unresolved comment mentions are rejected, not ignored; the contract was wrong

**Decided:** an unresolved `mentionEmails` address is rejected with a 400 keyed on
`mentionEmails`, for comments exactly as for ideas. `30-Contracts.md` line 1232 is corrected;
no code changes.

**Why the spec lost.** That line said "unresolved addresses are ignored" and described
behaviour the implementation has never had. Ideas and comments call the **same**
`IMentionResolver`, whose contract is explicit that a mention which does not resolve to a
same-organization user throws a `ValidationAppException` keyed on the field. Sprint 9 is a
re-expression, not a redesign, so the port follows the implementation and the document is
corrected to match.

**Two things that made this worth stopping for.** No golden fixture exercises an unresolved
mention, so the F1 replay cannot adjudicate it — this is one of the gaps the corpus's own
README names, and it is exactly where a spec error survives unnoticed. And `Mentions` #4 in
`20-feature-ideas-and-engagement.md` — "the UI must show inline validation and block save" —
is a **client** rule, not a server one; reading it as a server rule is what makes this look
like a spec-versus-spec conflict when it is a spec-versus-implementation one.

**Raised by the B4 partition**, which read the two documents as conflicting and resolved it
by following the merged Ideas partition's precedent rather than blocking. The precedent was
right; the reasoning needed checking.

---

## 2026-09-06 — Wave B conventions: commits, validation errors, and house style

Settled after reviewing the first three partitions together, which had each answered these
differently while individually looking correct. Recorded here because Waves B4-B7 and C
will copy whatever the first three did.

**Commits go through `UnitOfWork.saveChanges()`, explicitly.** Not repository autocommit.
This is not a preference: the .NET application layer calls `SaveChangesAsync` **59 times
across twelve services**, and behaviour is pinned by the corpus. `StatusService.Reorder` is
the clearest case — the C# loops over the statuses and commits **once, after the loop**,
which is the only reason a reorder is atomic. B1 ported this faithfully; B2 and B3 assumed
autocommit, and B2's reorder can therefore leave a partially reordered catalog if it fails
mid-loop, while its own docstring promises atomicity. Wave C1 builds repositories against
this contract, so it had to be settled before C1 starts.

**Domain invariant failures must become `ValidationError`, thrown from the application
layer, with field-keyed failures.** A bare `Error` escaping a service is a 500, and the
corpus records **eight 400s and no 500s at all**. The recorded body is field-keyed —
`{"errors": {"firstName": ["First Name is required."]}}` — so both the **field key** and the
**message text** are pinned, not just the status code.

Note the C# domain's own `ArgumentException` is a *defensive backstop*, not the path that
produces those 400s: `AppExceptionHandler` explicitly passes non-`AppException` through to
the default renderer. The 400 comes from a `ValidationAppException` raised **before** the
domain is reached. Port that shape, not the backstop.

B3's `IdeaDomainError` + `runDomain()` translation wrapper is the reference implementation.
B1 had no domain error type at all; B2 defined `*InvariantError` classes and never caught
them.

**One documented exception to the Site Admin guard.** AI prompt-version management does NOT
call `ensureNotDirectSiteAdmin`. It requires the caller to *be* an effective Site Admin, which
is a structurally different requirement rather than an inversion: the system prompt is
deployment configuration (`20-feature-ai-idea-assist.md` rule 34), not organization content, so
it must be refused **during** a View As session — exactly when `ensureNotDirectSiteAdmin` stops
firing, because the effective role has become the target's. This mirrors `AiPromptService.cs`'s
`RequireSiteAdmin()` call for call. The scope statement on the same service is organization
content and does use the shared guard. Recorded because it is the only place in seven
partitions that does not call it, and it would otherwise read as an oversight.

**House style, so seven partitions read as one codebase.** Import ACROSS packages by
specifier (`@collega/domain/enums`); import WITHIN a package by relative path
(`../common/index.js`). A package must not reference itself by its own package name: the
specifier resolves through the `exports` map to `dist/`, and turbo's `typecheck` depends on
`^build` — upstream packages — not on the package's own build, so from a clean checkout the
package's own `dist` does not exist yet and every self-import fails `TS2307`. This was
recorded the other way round on first writing, and B1 refused it with a reproduction rather
than shipping a check that only passes when a stale `dist` happens to be lying around.
Generate ids with
`randomUUID` imported from `node:crypto`, not the global. Take dependencies as a positional
constructor, not a `deps` object. Name the audit port `auditEvents`. None of these is better
than its alternative; being the same is what has value, and the first three partitions
produced three answers to each.

---

## 2026-09-06 — Entity ids are generated in the application layer, not the domain

**Decided:** `crypto.randomUUID()` in the application service, passed into the domain
constructor. `packages/domain` never generates an id.

**Why:** the .NET `EntityBase` defaulted `Id = Guid.NewGuid()` ambiently, so constructing an
entity had a hidden random effect. Every Wave B partition independently settled on immutable
entities with pure transition functions, and ambient randomness is the one thing that breaks
that — an entity that generates its own id cannot be constructed twice and compared.

**Why this is not the same call as `Clock`.** Time got a port because a service cannot
supply "now" without one and remain testable. An id needs no port: the caller simply passes
one. Adding an `IdGenerator` interface would be a single-implementation abstraction, which
CLAUDE.md rules out.

**Recorded because three partitions asked.** B1, B2 and B3 each hit the missing
`packages/domain/src/common` and each resolved it slightly differently. This and the kernel
promotion alongside it (`Clock`, `AuditEventWriter`, `Auditable`, `LockedOutError`,
`RateLimitedError`) are what stop the fourth through seventh partitions doing it a fourth
way.

---

## 2026-09-06 — `.env` is the single home for configuration; a typed config module reads it

**Decided:** every environment value the TypeScript stack needs lives in **`.env`** at the
repository root in local development, and in Vercel project environment variables in
deployment. There is no second home for any credential. The Anthropic key is
**`ANTHROPIC_API_KEY`** — the environment variable name and the config key are the same
string, with no prefix or nesting to get wrong.

**Why, concretely.** The .NET stack reached that one key through three names at once:
`Ai:ApiKey` in user-secrets, `CLAUDE_API_KEY` in `.env`, and `ANTHROPIC_API_KEY` in the
code. Two of the three were read by nothing, so the feature was silently dark while the
configuration looked complete in two places. Nothing failed; the assistant just never
appeared. One name, one home, is what prevents that.

**The module.** `apps/api/src/common/config/` composes **per-feature fragments** — a slice
adds a file under `fragments/` and registers it, and nobody edits a shared body of
validation. This is the artifact `50-typescript-migration.md` §4.2 required of Foundation
and that Wave 0 did not deliver; it lands as **S0.4**. Node 24 reads `.env` natively, so
there is no dotenv dependency. Existing environment variables win over the file, which is
what lets CI and Vercel — which inject real variables and ship no `.env` — work with no
special case.

**The asymmetry is deliberate and is the part to preserve.** A missing `ANTHROPIC_API_KEY`
is a **supported state**: the feature runs dark (`20-feature-ai-idea-assist.md` rule 31) and
the application boots. Missing `SITE_ADMIN_*` **refuses to boot**, because a deployment with
no Site Admin cannot create the first organization and would look healthy while being
unusable. Getting these the wrong way round breaks a deployment that has no AI.

**Still duplicated, and dying with the .NET solution:** the key also sits in .NET
user-secrets, which is what the Blazor stack reads. That copy is deliberately left alone
rather than removed, since removing it would take AI assist out of the app while it is still
the only runnable one. It goes at cutover with the rest of the .NET solution.

---

## 2026-09-06 — Layer boundaries are enforced by Biome, not eslint-plugin-boundaries

**Decided:** the layer rules in `50-typescript-migration.md` section 3 are enforced by
`noRestrictedImports` overrides in `biome.json`, one per layer. **Supersedes** the plan's
three references to `eslint-plugin-boundaries` and ticket `07` section 7's
`tools/eslint-plugin-collega/`, which named a mechanism rather than a requirement.

**Why:** the ESLint stack was deliberately removed on 2026-09-05 (`6fd75d5`) in favour of
Biome, which cannot load an ESLint plugin. Restoring ESLint just for the boundary rules
would mean two lint tools in the task graph, so the requirement moved to the tool that is
actually there. The requirement is unchanged and is the point: **a lint error, not a code
review note**, is what stops constraint 11 eroding.

**The trap this walked into, recorded because it is not obvious.** The first version used
`noRestrictedImports` `paths`, which matches exact specifiers only. It correctly blocked
`@collega/application` and silently allowed `@collega/application/ideas` — and section 4.2
mandates subpath exports, so every real import would have evaded it. The config read as
correct and enforced nothing. The working form is `patterns` with a `group` listing both
`@collega/<pkg>` and `@collega/<pkg>/*`.

**So the enforcement is itself tested.** `tools/boundaries/boundaries.test.ts` asserts the
full 6x5 matrix — every illegal import is reported and every legal one is not — using the
subpath form specifically, because the bare specifier was never the one that leaked. A lint
rule that stops firing is worse than no rule, since it is read as a guarantee. This is the
same lesson as the list-endpoint tie-break test that sat green and worthless.

**Consequence for ticket `07`.** The identity chokepoint keeps its lint enforcement, now as
a Biome override, and keeps the exact-equality architecture test the finding already
required. S0.3 owns both.

---

## 2026-09-04 — .NET development stops; the conversion starts now

**Decided:** no further feature, paydown or polish work on the .NET solution. **Sprint 9
— the TypeScript conversion — is the active sprint**, starting at Wave 0.

**The distinction that matters:** development stops, the stack stays **runnable**. The
golden corpus can only be recorded against a live .NET API, and cutover deletes that API
permanently. So `dotnet run` and `dotnet test` must keep working until Wave F, and a change
that breaks the API's boot path is a problem even though nobody is developing on it.

**Sprint 7.5 closes where it is: implemented, not fully verified.** All ten backlog items
plus four found during the work are committed and the suite is green, but a third browser
pass and a code review of its second slice were still outstanding. Both are stood down.
The sprint existed so the first real-user deployment would not ship known accessibility
defects; with Sprint 8 cancelled there is no such deployment, so continuing to verify a
client that Wave E deletes buys nothing. What the work bought instead is a set of rules
recorded surface-neutrally (`20-feature-client-ui.md:243`) that bind the comp P build, and
that is the part which actually crosses over.

**Known-unverified, carried into Wave E rather than fixed here** — these are Blazor
defects and their value now is as requirements for the Next.js build:

- List rows overflow at 375px. Pre-existing, aggravated by this sprint's additions.
- The focus-restore and Space-scroll fixes are committed but never browser-confirmed.
- Rail labels sit at 8.5px; `ChangePassword` has no username field for password managers.
- The priority chip reads "Medium" where the sprint text said "Med".

**What does not stop:** keeping the .NET stack buildable and bootable, and re-capturing the
corpus if the API surface ever changes before cutover.

---

## 2026-09-04 — Sprint 8 is cancelled: the .NET stack is never deployed

**Decided:** drop the Azure deployment entirely. Both applications and the database go to
**Vercel** — `apps/web`, `apps/api`, and Prisma Postgres — and that happens at the end of
the conversion, not before it. **Sprint 9 is now the next sprint.**

**Why.** Sprint 8 was planned before the conversion was, and it would have provisioned
Azure, shipped the Blazor client and the ASP.NET API to it, built CI/CD for both, and then
been thrown away a sprint later when `02` sent the TypeScript stack to Vercel. Paying for a
deployment target twice, and running the second migration under production traffic, is
worse than not shipping the first one.

**What this costs, stated plainly.** There is now **no production deployment until the
conversion completes**. That is a long window with nothing running for real users, and the
conversion is a big-bang rewrite of ~60,000 lines — so the first thing ever deployed will
be the new stack, on its first day, rather than a known-good stack that was already up.
Wave F's gate does not change and is now carrying more weight than it was designed for:
F1 green — all 81 endpoints × 4 roles replaying clean — plus F2's adapted Playwright suite.

**What is *not* affected.** The golden corpus was captured on 2026-09-03 and is committed,
so the oracle survives the .NET stack regardless of whether it is ever deployed. Its
standing rule still holds for a different reason: re-capture only while the .NET code still
runs locally, because after cutover deletes it the recording can never be made again.

**Consequences to carry:**

- **Sprint 7.5's justification changes.** It exists so the first real-user deployment does
  not ship known accessibility defects. There is now no such deployment. The work is not
  wasted — the rules are recorded surface-neutrally in `20-feature-client-ui.md:243` and
  bind the comp P build too — but it is now paydown on a client that Wave E deletes, and
  that is worth knowing before anything further is spent on the Blazor UI.
- **Rule 32c's AI-unavailable flash moves to Wave E.** It was parked in Sprint 8 so the
  first deployment would ship it. Building it in Blazor now would be building into a client
  that gets deleted, so it belongs in the Next.js create surface instead.
- **`.github/workflows/deploy-api.yml` and `deploy-client.yml` are dead**, as are
  `SPEC/50-azure-deployment.md`, `SPEC/50-azure-api-cicd.md` and
  `SPEC/50-kubernetes-deployment.md`. Superseded, not deleted — they record what was
  intended and why.

**Supersedes** the deployment half of `95-next-sprints.md`'s sequencing, where Sprint 8 was
the hard-gated final pre-MVP sprint. The gate it carried — that Sprint 5's Postgres
migration must be verified against a real instance before deploying — is satisfied and now
belongs to Wave F instead.

---

## 2026-09-04 — The idea-type badge moves to the tag row on swimlane cards

**Decided:** accept visible drift from comp C v5 on board cards. The idea-type badge
always renders its name, and on swimlane cards it moves from the title row down to the
tag row, capped at 92px with an ellipsis and the full name on the tooltip.

**Why there was no free option.** The badge was an empty coloured span with the name on a
`title` tooltip — nothing for a screen reader, nothing reachable by touch, and colour
carrying the meaning alone, which the 2026-08-31 rule forbids outright. Fixing it means
rendering text, and text needs room. A 280px lane leaves about 225px of inner width; grip,
title, a text badge and the priority chip on one row left the title around 36px. So the
choice was which of the two to make unreadable, and the title is what people scan.

**Scope of the drift:** swimlane and List cards only. Detail, admin and create surfaces
already rendered the name and are unchanged. Comp C v5 never drew a text badge in this
slot, so this refines a case the lock did not cover rather than reversing something it
decided.

**Short-lived by construction.** Wave E rebuilds the client on comp P, so this styling
does not have to survive the conversion — but shipping a WCAG 1.4.1 failure into Sprint
8's first real-user deployment would have, which is the trade this sprint exists to refuse.

**Taken with it:** the List-view priority marker (`BoardDetail.razor:250`) had the identical
defect and is fixed the same way, matching the swimlane chip that already renders `High` as
text.

---

## 2026-09-04 — The session lives in a cookie Nest issues; the reshape takes only what introspection forces

The last two conversion tickets that gate Wave 0, closing `08` and `06`. Both were
answerable only because the `05`/`07` research pair ran first — findings in
`SPEC/typescript-conversion-map/findings/`.

### `08` — Nest issues the session cookie directly; Next stays a pure client

**Decided:** option C. Nest sets and clears an httpOnly, `Secure`, `SameSite` cookie on
login, View As start and View As exit. Next holds no session of its own: it forwards the
cookie and renders from `/auth/me`.

**Why C over B.** Both put the credential in an httpOnly cookie, which is what makes the
Sprint 6.5 client-twin bug *structurally* impossible rather than merely disciplined — the
browser never holds a decodable principal, so there is nothing to cache stale. C wins on
trust model. Under B, Next terminates the session and forwards an identity, and Next
already knows the impersonation target from `/auth/me`; forwarding *that* would make Next
the impersonation authority. It is the natural implementation and it is wrong, because
Next is a client from the API's perspective — an `apps/web` bug would become privilege
escalation, and rule 7 says the client can neither forge nor extend a session. C removes
the temptation by removing the forwarding step.

**Why not A.** A bearer token in client JS is the smallest conceptual change and it ports
the exact defect that cost a sprint to find.

**What comes with it:** cross-origin setup between the two Vercel apps is now in scope for
S0.3 and E0 — the cookie must be issued for a domain both apps share, or the API must be
reached through a path on the web app's origin. That is the cost C is being chosen with,
not a surprise to discover later.

**Non-negotiable, from `07`:** the cookie names **only the real user**. Effective identity
is derived inside Nest, per request, from `impersonation_sessions`. This is rule 1, and it
is what makes a captured credential carry no impersonation authority and makes idle
expiry, central revocation and non-nestability enforceable at all.

### `06` — forced reshapes only, plus the enum decision

**Decided:** take what introspection forces, plus one deliberate change.

Forced, because `05` measured them:
- **The three partial unique indexes**, re-added as raw SQL in the first migration with a
  test that fails if any is absent. `prisma db pull` drops them and `migrate diff` reports
  an empty migration, so nothing in a normal Prisma workflow says they are gone. One of
  them is what makes "at most one open View As session per user" a database guarantee
  rather than a race.
- **Relation field names.** Introspection generates
  `impersonation_sessions_impersonation_sessions_real_user_idTousers`. Renaming touches
  every query, so it happens before Wave B rather than during it.

Deliberate, and the one optional change taken: **promote all nine enum converters.** Seven
are stored as `string` and two as `int`, and the `int` pair is the reason — a column that
reads as a plain `Int` where `0`, `1`, `2` carry meaning defined only in C#. The `int`
columns need a data migration either way; F3 already rewrites every row, so doing it there
costs a `CASE` expression, while doing it afterwards costs a migration of its own against
live data.

**Explicitly deferred:** EAV field storage (`FieldDefinition` / `FieldDefinitionOption` /
`IdeaFieldValue`), audit and event table shapes, EF-flavored naming, the `Status.Name`
length cap. The ticket's own rule applies — every optional reshape widens the gap F1's
replay has to cover, and none of these has a reason beyond preference.

**Consequence for Wave G, which `06` also had to settle** (`50-typescript-migration.md`
§6): the Prisma schema freezes after S0.2, and Wave G's four net-new entities are not a
forced reshape. So **S0.2 does not lay them down, and Wave G buys a schema amendment
slice.** That follows from "forced only" rather than being a separate choice, and it is
the cheaper error of the two — an amendment slice in Wave G costs a slice, whereas four
speculative tables frozen into S0.2 would sit in every replay diff from F1 onward for a
design that has not been drawn yet. Reversible until S0.2 starts, and only until then.

---

## 2026-09-03 — The conversion's remaining gates: net-new scope, the test suite, and where it deploys

Three answers taken together, closing conversion tickets `01` Question C, `10` and `02`.

### Ticket `01` Question C — Loop and the three low-risk concepts are IN, as their own wave

**Decided:** Comp H's **Loop** (@mentions, a notification inbox, and the activity feed Home
already advertises as "coming soon"), **decision records** (a written rationale required on
Decline only, never on Plan; permanent, visible, surviving a reopen), the **commitment
strip** (a roadmap band above every board plus the admin surface that sets it), and
**Triage Mode** (a filtered, ordered one-idea-at-a-time queue over actions that already
exist) enter the conversion's scope. The three that carry unpriced risk — momentum over
totals, duplicate clustering, vote budget — do **not**, and stay in round 2.

Cost, from `01`'s own table: **4 entities · 11 endpoints · 6 surfaces · ~10 agent-slices**,
none of it carrying unpriced risk.

**They are a wave of their own, and they do not blur into the port.** Wave G starts when
**F1 is green** — the golden corpus replays clean against Nest — so what the corpus pins is
a re-expression of the .NET API and nothing else. New endpoints have no golden fixtures by
definition; each gets a spec and its own Vitest coverage instead. Wave G never blocks F,
and it may ship on either side of cutover.

**Why the reservation about scope does not apply here.** A conversion that also grows the
product usually loses its oracle. These four keep it: they are additive surfaces, so the
oracle covers the port completely and the new work is measured the ordinary way.

### Ticket `10` — the .NET test suite is not ported

**Decided:** the 16,900-line suite is **discarded**. Behaviour is pinned by the golden
contract corpus at the HTTP surface (constraint 10), and each slice writes fresh **Vitest**
coverage for its own layer — **written by a QA agent, never by the agent that wrote the
code under test** (`CLAUDE.md`, and `SPEC/40-test-strategy.md`).

**The gap this accepts, stated plainly:** unit-level Domain and Application assertions —
142 + 324 tests — disappear on day one and come back only as each slice re-writes them.
The golden corpus does not see an invariant that never reaches an endpoint. Sprint 5 is the
standing warning: four Postgres defects were invisible to 561 green tests because the
provider under test was not the provider that shipped. Slices whose logic is not fully
observable through HTTP owe their QA pass more than a happy path.

### Ticket `02` — Vercel, with Prisma Postgres

**Decided:** the formal deployment target is **Vercel** for both apps, with **Prisma
Postgres** in production — confirming what `CLAUDE.md`'s stack section already stated, and
consistent with "ecosystem" as the conversion's motive.

**The consequence to design against:** Vercel runs Nest as serverless functions. No
long-lived in-process state — no in-memory rate-limit counters, no per-instance caches, no
background timers — and every request pays a cold start. **AI idea assist is where this
bites first**: its turns are the longest requests in the product, and its daily-budget gate
and per-organization usage counters (rules 28a–28e) must be storage-backed rather than
process-backed. Check it early in Wave D rather than discovering it at cutover.

Sprint 8 deploys the **.NET** stack to Azure; that is not superseded by this and does not
bind the TypeScript stack.

---

## 2026-09-03 — Comp P is the canonical comp; the client is built on Tailwind CSS + shadcn/ui

**Decided:** comp P is the canonical UI comp for the product and the target of the
TypeScript conversion's Wave E — its structure, information architecture and copy model are
what ships. The client is built on a framework rather than hand-rolled CSS: **Tailwind CSS
v4 with shadcn/ui** (Radix primitives), the Next.js idiom, used as intended — its theme
variables, its component set, its defaults for radius, type scale and control geometry. The
user's words: *keep things as straightforward as possible and not reinvent a wheel.*

**Comp Q is the rendering of that decision.** `SPEC/mockups/comp-q-*.html`, built by
`SPEC/mockups/_build/build_q.py` from the *same fragments* as comp P, expands every
semantic class into the utility string the matching shadcn/ui component renders and
compiles Tailwind over the result — so the files are what a shadcn project would put in
the DOM. Where the framework's defaults differ from comp P's hand-drawn values, comp Q
takes the framework's: 14px UI text and 36px controls (denser than comp P's 15/16px),
`--radius: 0.3rem` (shadcn's small preset), Badge / Card / Dialog / Sidebar / Command
shapes, Geist (shadcn's default face). The docked inspector stays a layout column, not a
Sheet, because the comp P lock says it is never a modal. The component map is the registry
at the top of `build_q.py` and is summarised in `_build/README.md`.

**Theme:** comp Q carries the business-professional palette chosen 2026-08-31 as shadcn
theme variables. The palette remains open; changing it is one `:root` block in `q.css`.

**What this closes:** conversion ticket `01` Question B (direction: comp P) and Question D
(library: Tailwind + shadcn/ui — the map branch's 2026-09-01 Tailwind answer stands, with
shadcn/ui named on top). `50-typescript-migration.md` constraint 9 and Wave E0 now say so.
**Still open on ticket `01`:** Question C — Loop and comp N's decision records, commitment
strip and triage mode as net-new scope. Nothing in E0–E5 waits on it.
*Answered later the same day — see the entry above: all four are in, as Wave G.*

**Consequence:** `SPEC/20-feature-client-ui.md` is reconciled against comp P as of this
date — sidebar shell, docked inspector, inline create, Tailwind + shadcn/ui — with the
shipped Blazor client's rail-and-drawer surfaces recorded once under *Superseded surfaces*;
that client runs unchanged until cutover. `CLAUDE.md`'s stack line names the framework.

---

## 2026-09-02 — Outcome ↔ Issue cardinality: single-parent

**Decided:** an Issue sits under **at most one** Outcome. Storage is `Idea.OutcomeId`, a
nullable FK with `ON DELETE SET NULL`. The `idea_outcomes` join table is rejected. Grouping
is a **move**: assigning a new Outcome clears the old one. This closes the one blocking
Open Question in `SPEC/20-feature-issues-and-delivery.md` and unblocks Slice 2 and E6.

**Why:** roadmap arithmetic is then honest by construction. Counts partition the delivery
set, per-outcome totals sum to it, and "done" is unambiguous — so no rollup anywhere needs
a distinct-count beside it. Under multi-parent every total on the page is a cover rather
than a partition, and the comps made that concrete: over the same 16 delivery issues, comp
N produced 18 memberships over 14 distinct issues, so its ledger reads `sum != the delivery
set`. It also smeared derived spans — a shared issue drags an outcome's bar into a quarter
its own work does not start in — which is a second, less obvious tax nobody asked for.

**What it costs:** work that genuinely serves two quarterly goals must pick one home. That
is a real loss and was accepted knowingly. **The failure mode to watch for is teams raising
duplicate Issues** so two Outcomes can each claim the work — which would reintroduce exactly
the provenance loss the phase model exists to prevent. If that appears in practice, treat it
as the signal to revisit, not as user error.

**Reversibility:** single → multi is a cheap forward migration (copy the FK into the join
table, drop the column). The reverse is lossy and needs a human to choose which grouping
survives. Choosing the cheap-to-undo direction is part of why this side won.

**Consequence — comp P is now stale in three places.** Comp P was built on comp N's
multi-parent mechanics while this question was open, and remains the locked direction for
shell, IA, navigation and copy. Its roadmap surfaces are not: the Issue inspector shows an
Outcomes chip list, the command palette reports a `2 shared` count that cannot occur, and
the roadmap carries the dashed shared-bar treatment and its `sum != the delivery set`
ledger. Those need regenerating from comp M's mechanics via `SPEC/mockups/_build/build_p.py`.
`comp-n-roadmap-multi.html` is retained only as the record of the rejected alternative.
*Regenerated 2026-09-03; see `SPEC/mockups/README.md`.*

---

## 2026-08-31 — Golden capture (Wave A) starts now, not with Sprint 9

**Decided:** Wave A of the TypeScript conversion — recording request/response pairs for all
81 endpoints across all four roles against the **live .NET API** — starts immediately and
runs alongside Sprint 7.5 and Sprint 8. It is not held until Sprint 9 opens.

**Why:** the golden corpus is the conversion's only oracle, and it can only be captured
while the .NET stack still exists. Sprint 8 retires that stack. Every other slice in the
conversion can wait for Sprint 8 to close; this one cannot, so its deadline is Sprint 8's
close rather than Sprint 9's start.

**Why it is safe to run early:** Wave A touches `tools/golden/` and nothing else. Under the
plan's collision model it owns paths no Sprint 7.5 or Sprint 8 slice owns, so it runs
concurrently with both without contention.

**Consequence:** A1 (capture harness), A2 (corpus, 81 endpoints × 4 roles, error paths
included) and A3 (replay harness) are live work now and belong on Sprint 8's calendar.
`SPEC/95-next-sprints.md` and the tracker should show them as in-flight, not queued.

---

## 2026-08-31 — Comp P is the locked UI direction; colour stays open

**Decided:** `SPEC/mockups/comp-p-focus-roadmap.html` is the locked structural direction
for the client UI. Its **layout, information architecture, and copy model are locked**.
Its **palette is explicitly not locked** and is expected to be tweaked.

**Why:** Comp P is comp D's Focus Desk carrying comp N's multi-parent roadmap, restyled on
the `DESIGN.md` token layer. It covers all ten screens (Login, Home, Ideas list, Board,
docked inspector, Roadmap, Issue, Grouping, Settings, Command palette) rather than a
fragment, so there is a whole product to lock rather than a mood.

**What "structure" means here, concretely:**

- The desk shell: fixed left sidebar with grouped nav, top bar with breadcrumb and page
  actions, a single scrolling work column.
- The **docked inspector as a third grid column**, never a modal. No focus trap, nothing
  covered, Escape closes the column.
- **Inline create beside the list it adds to**, rather than a drawer, for short forms.
  Longer edits use the docked inspector.
- Home answers *"what needs me now"*, not *"what exists"* — KPI row, attention queue,
  activity feed, all filtered queries rather than dead-end summaries.
- **Two copy voices, kept apart**: product copy inside the app frame, reviewer/comp
  commentary outside it. See below.
- The dot-plus-label marker as the single encoding for type, status, and priority.

**What is not locked:** the palette. `DESIGN.md`'s sticker colours are placeholders at
this point; comp P proves the structure survives whatever hue set replaces them, because
no colour in it carries meaning alone.

**Supersedes:** the 2026-07-30 selection of Comp A "Command Center" as the implementation
layout, recorded in `SPEC/mockups/README.md` and `SPEC/20-feature-client-ui.md`. That
selection assumed the .NET/Blazor/Fluent UI stack. Both the stack and the direction have
moved; `SPEC/20-feature-client-ui.md` should be reconciled against comp P before any UI
work starts on the new stack.

**Consequence for the TypeScript conversion:** this closes the UI half of conversion
ticket `01` (redesign direction). The component library question inside that ticket is
still open — comp P is hand-rolled CSS on tokens and does not presume a library.

---

## 2026-08-31 — Colour may never be the only carrier of meaning

**Decided:** in any Collega UI, a colour may reinforce a category but may never be the
only thing that distinguishes it. Every coloured dot, bar, or fill carries a text label
in the same component.

**Why:** it reconciles two rulebooks that looked contradictory. `DESIGN.md` forbids
colour that *structures* a layout while permitting a sticker palette for category dots;
Collega's own accessibility rule forbids colour carrying meaning *alone*. An 8px dot plus
an always-present label satisfies both, and it is the reason comp P could collapse comp
D's three separate chip families into one `.marker` component.

**Corollary — the roadmap's "shared" encoding.** Comp N distinguished shared outcomes
with a tinted bar. That is a structural fill, which `DESIGN.md` forbids, and comp O-3
demonstrated that plain neutral bars lose the outcome at a glance. Comp P encodes
"shared" in **border style — a dashed outline — rather than hue**. Border style is not
colour, so it survives greyscale, colour blindness, and print. Keep this even if the
`DESIGN.md` direction is later dropped.

---

## 2026-08-31 — Home carries two voices, kept apart

**Decided:** in the comps and in the shipped product, **product copy lives inside the app
frame** and is written to be lifted straight into the UI. **Anything addressed to a
reviewer** — screen inventories, keyboard shortcuts for navigating the comp, notes about
which screens carry open questions — lives in the comp chrome band outside the app frame.

**Why:** a reviewer should never have to guess which sentences would ship. In comp P this
means Home carries a real first-run strip, a definition under each KPI saying what it
counts, and a standfirst on each panel saying how the list is ordered — all shippable —
while the orientation text sits in the band above the frame.

---

## 2026-08-31 — TypeScript conversion: three constraints settled

Answers to open tickets on the `wayfinder` conversion map
(`.scratch/typescript-conversion/` on `feature/068-typescript-conversion-map`). Full
reasoning in `SPEC/50-typescript-migration.md`.

| Ticket | Decision | Consequence |
|---|---|---|
| `04` validation strategy | **Golden contract tests.** Record request/response pairs for all 81 endpoints against the live .NET API, replay against Nest. | **Has a calendar consequence.** The capture slices must run *before or during Sprint 8*, while the .NET API still exists. Everything else in the conversion can wait for Sprint 8 to close; this cannot. |
| `09` Next ↔ Nest boundary | **HTTP only.** `apps/web` calls `apps/api` over HTTP, the same shape as today's Blazor → API. No direct imports of `packages/application` from Next server components. | Web slices and API slices never open the same file, so they parallelise cleanly. This is the decision that makes the agent partition work. |
| `03` conversion scope | **Everything ports. View As gets its own slice.** Nothing is deferred, but impersonation is carved out of the auth work rather than riding inside it. | No reduction in first-cut scope. View As is isolated because it is the one genuinely high-risk substitution. |

**Still open on that map:** `01` (component library half), `02`, `05`, `06`, `07`, `08`,
`10`, `11`. The plan states what each would change if answered differently.

---

## 2026-09-02 — A denied admin route shows a refusal, not a disabled page

The comp P refresh plan settled that denied actions should render **disabled with a
reason** rather than hidden, which is the right rule for a control inside a page the
caller is allowed to see. It does not decide what happens when the caller is not allowed
to see the page at all, and the two cases were being read as one.

They are separate gates in the shipped client. `<AuthorizeView>` hides individual controls
inside a page; `[Authorize(Roles = …)]` on the page closes the route outright, so a `User`
never reaches `/settings/statuses` in any form.

**Decided: a denied route renders a short refusal panel** — the page title, who the route
is for, and a way back to Settings. Not the live page with every control disabled.

Disabling the page would put the organization's configuration in front of members who
cannot act on it, which is a disclosure change dressed as an accessibility one, and it
would contradict the route's own `[Authorize]` attribute. The refusal panel still honours
what the rule is actually for: the denial is *explained where the user hit it* rather than
being a silent redirect. Controls **inside** a page the caller may see — a Site Admin's
read-only view of an organization's statuses — keep `aria-disabled` plus a reason exactly
as the plan says.

Applies to all 23 `/settings/*` screens in `comp-p-admin.html`, generated by the `GUARD`
token in `SPEC/mockups/_build/build_p.py`.

---

## 2026-09-02 — Conversion slices merge to `dev`, not to an integration branch

Considered a long-lived `typescript-conversion` branch acting as `dev` for the conversion,
with feature branches merging into it and one merge to `dev` at cutover. **Rejected.**

The isolation it offers is isolation that already exists. Both deploy workflows fire on
`main` only (`deploy-client.yml` is further path-scoped to `src/Collega.Client/**`), so
nothing ships from `dev` regardless of what lands there. The conversion tree is `apps/`,
`packages/` and `tools/` — disjoint from `src/` by the plan's own layout. And there is no
root `package.json` today, so the monorepo skeleton creates the root tooling rather than
disrupting anyone's existing commands.

Three costs decided it:

- **Wave A cannot live on a conversion branch.** `tools/golden/` drives the *live .NET
  API* and its deadline is Sprint 8's close. Sequestering it means the people changing
  that API during Sprint 8 cannot run the capture as they go — and the corpus is the
  oracle the whole validation strategy rests on.
- **The shared files conflict continuously.** `implementation-agent-tracker.md`,
  `30-Contracts.md`, `decisions.md` and the comps are edited by both .NET sprint work and
  conversion work. §4.3 already requires the tracker to serialize on the merge; a
  months-long branch turns every one of them into a recurring conflict.
- **Cutover deletes the .NET solution.** That is the highest-risk change in the project.
  It should land as its own reviewed slice against a current `dev`, not inside a merge
  that has been diverging for months.

**Consequence:** `dev` carries half-built TypeScript for the duration. That is accepted —
`main` is the deploy gate, and per §7 the rollback unit is the deployment, not the code.

---

## 2026-09-02 — The board is a scrolling rail of fixed-width columns

**Decided:** board swimlanes render as **288px columns in a horizontally scrolling
rail**, each with its own ground, rather than as N equal fractions of the work column.

**Why:** a board's swimlanes are chosen per board from the organization's statuses, with
no upper bound. Dividing the available width means every status anyone adds makes every
existing column narrower — at five lanes the titles already wrapped to two lines, and the
failure is unbounded. A fixed column degrades by scrolling instead, which costs a gesture
rather than legibility. Trello and Jira both took this trade.

**Constraint that comes with it:** the *rail* scrolls, never the page. Verified at 1280px
and 1440px.

**Not a supersession.** The 2026-08-31 comp P lock enumerates what "structure" covers —
the desk shell, the docked inspector, inline create, Home's question, the two voices, the
dot-plus-label marker. Column arrangement inside the board is not in that list, so this
refines the locked direction rather than reversing part of it.

---

## Earlier decisions

Decisions made before this log existed are recorded in the documents they constrain —
chiefly `SPEC/95-next-sprints.md` (sprint sequencing and the paydown-first rule),
`SPEC/implementation-agent-tracker.md` (build state and standing rules), and the
"Settled during charting" table in the conversion map. They are not restated here; this
log starts 2026-08-31 and runs forward.
