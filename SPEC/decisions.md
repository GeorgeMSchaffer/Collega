# Decisions

A dated log of decisions that constrain later work. One entry per decision: what was
decided, when, and enough of the reason that a reader six months out does not reopen it
by accident. Newest first.

Supersession is recorded, not edited away — if a decision replaces an earlier one, both
stay, and the older one is marked.

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
