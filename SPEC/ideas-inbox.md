# Ideas Inbox

> Unrefined product ideas, captured so they aren't lost. **Nothing here is scheduled, specified, or approved, and nothing here blocks a sprint.**
>
> This is deliberately *not* part of `SPEC/Bug Triage.md`: that file gates feature work ("clear TODO before starting new features"), and applying that gate to raw feature ideas would block all work until the idea is built. Ideas here are only picked up when the user explicitly asks.
>
> **Promotion path:** idea → user discussion → canonical spec (`SPEC/20-feature-*.md`) → sprint plan (`SPEC/sprints/`). Once an idea is promoted, delete it here — the spec becomes its home.

## Chat assistant: ingestion, and refining ideas that already exist (needs a spec)

> Raised 2026-09-13. **Still unrefined, but no longer unowned:** the AI integration is rescoped and
> respecified after the current batch (`SPEC/decisions.md` 2026-09-13), and this is one of the things
> that rescope has to answer. Captured because the gap is visible in shipped code rather than
> hypothetical: `SPEC/20-feature-ai-idea-assist.md` is live behind eleven endpoints, and it is scoped
> to exactly one job.

What exists today drafts **one new idea**, in a chat, from a standing start. The spec is explicit
about its edges, which is what makes the missing half easy to name:

- The conversation confines itself to idea drafting and maps answers onto form fields.
- **D-DEDUPE defers similar-idea retrieval to v2** — v1 retrieves structured org data only. No
  embeddings, no `pgvector`.
- Rule 14 also defers **org playbook / SOP documents** to v2.
- Board and Status are never proposed; board is chosen before the chat opens.

So two things have no spec at all, and they are different problems wearing one name:

**Ingestion.** Getting material *in* that did not start as a chat turn — a pasted transcript, a
meeting note, a document, a list of requests, a backlog exported from somewhere else. Today the only
door is a person typing into a 20-entry conversation, capped at roughly ten user turns. The
questions a spec has to answer: what formats, one idea or many out of one input, what happens to
the source after extraction, and whether a human confirms each extracted idea or a batch.

**Refinement of ideas that already exist.** The assistant can help write an idea and then never
speaks to it again. There is no way to ask it to sharpen a thin description, reconcile two ideas
that say the same thing, or re-classify something filed under the wrong idea type. This is where
D-DEDUPE's deferral actually bites — "this looks like idea #214" is the cheapest version of it, and
it needs embeddings.

**Why they are worth separating before either is specified:** ingestion is a *write* problem, with
provenance and confirmation at its centre; refinement is a *read-then-suggest* problem over records
that already have authors, upvotes and history. Conflating them produces a feature that rewrites
somebody else's idea without asking, which is the same failure mode the existing spec's containment
rules exist to prevent.

**Both are blocked on the same thing:** `pgvector`, which rule 14 and D-DEDUPE both wait on. A spec
should say whether that dependency is still the intended route.

Read `SPEC/20-feature-ai-idea-assist.md` before opening this — it already answers what the assistant
does today, and several of its rules constrain what either of these may do.

---

## Roadmaps → Sprints → Issues (still being explored)

> **Kept here deliberately, not an oversight** (user decision, 2026-08-27). The promote-and-delete rule below would normally send this to its spec and delete it here — but the user is still exploring the shape and expects to revisit it **after the MVP, or immediately before it**. Until then this stays as the original unrefined brainstorm.
>
> **A canonical spec already exists for the first slice: `SPEC/20-feature-issues-and-delivery.md`** (interview-resolved 2026-08-10, post-MVP, not scheduled). Where the two disagree, the spec is the considered version and this text is the raw prompt that produced it. The differences are the interesting part:
>
> - This text makes **Roadmaps** core scope. The spec **explicitly defers** Roadmaps/Epics, the Impact×Effort prioritization view, crowd-backlog auto-surfacing, and AI-assisted promotion to later slices.
> - This text reads as *"Issues are an extension of an Idea"* — a second object. The spec resolves that to **same object, two phases**: an item carries a `Phase` of `Discovery` or `Delivery`, and promotion flips it. Same row, so provenance survives. The spec calls overloading a terminal status like `Complete` to also mean "committed to delivery" the source of the concept's awkwardness — which is the awkwardness the brainstorm below names but does not resolve.
> - The spec adds an explicit **"Promote to Issue" decision gate** rather than promotion-by-status.
>
> Read the spec before re-opening this; it already answers several of the questions below.

Help me come up with a new feature.  The overall idea is that the board is used to manage the process of brainstorming and fleshing out ideas, think of it as a Trello, Jira, Workspace hybrid.  I want to enable the user to manage the process of implementing the idea using AGILE Best practices.  Admins should be able to create Roadmaps. These roadmaps, will consit of Sprints, which consits of Tasks, which are Ideas translated to tasks.  However the idea seems a bit uncooked and potential akward.  Help me to refine the idea for this feature by making recommendations, referencing best practices, and ideas that could differantiate product from Trello and Jira.

    * Main Funtionality
        * Create Roadmap(s)
            * Should have the following fields
                * Title
                * Goal Description Field
                * Start Date
                * End Date
                * The ability to assign Roadmap Owner(s)

        * Sprints should be assignable to a Road Map, the fields on the Sprint:
            * Title
            * Start Date
            * End Date
            * Sprint Goal
            * Sprint Owner
            * Tags
        * Sprints will consits of one to many Issues.  Issues are an extension of an Idea, however it should have additional fields for:
            * Start Date
            * End Date
            * Effort (Low, Medium, High)
            * Sprint Tags
            * Status: Pending, Scoping, Development, Review and Complete

---

## Org bootstrap templates

*Parked 2026-08-13 after a brainstorm on "should the Site Admin be able to edit the default statuses?" — explored, recommendation was **don't build now**. Captured so the reasoning isn't re-derived.*

**What is actually hardcoded.** Statuses, Idea Types, and Business Impacts are already fully editable per organization (`StatusesAdmin.razor`, `IdeaTypesAdmin.razor`). The only hardcoded thing is the *starting template* — `OrganizationDefaults` in `Collega.Application/Organizations/`, read in one place (`OrganizationBootstrapService`) at organization-creation time, plus the demo seeder. Any change to it affects only organizations that do not exist yet.

**Three separable features hide under "editable defaults":**

- **A — editable global template.** Site Admin edits the default catalog; applies to future orgs only.
- **B — multiple starter templates.** Per-vertical sets chosen at org creation. This is where the real product value is, if it ever arrives.
- **C — retroactive push to existing orgs.** *Rejected, not parked.* Statuses are referenced by ideas and board swimlanes, so a push means rename/merge/conflict handling against live data, and it overwrites deliberate per-org customization.

**Why it was deferred.** Org creation is rare and hand-onboarded by the Site Admin (confirmed 2026-08-13), so the value realized is near zero — and a Site Admin present at every org creation can tune that org's set *in context*, which beats a template guessed in advance. Against that: four test files couple to the constant, `StartupSeeder` gains an ordering dependency on a provisioned catalog, and a new failure mode appears (a bad saved template breaks *every* future org bootstrap, requiring the `MinimumActiveStatusesPerOrganization` floor to be mirrored at template level).

**The deciding argument — no compounding cost of delay.** Because the defaults touch only bootstrap, retrofitting a DB-backed catalog later needs *no data migration for existing organizations*; they already own their rows. The refactor is the same size later as now, with better information. Deferral is free.

**Revisit if either trigger fires:** self-serve organization signup ships (defaults become the first-run experience — and then the right feature is B, not A), or a third organization's starting set has to be hand-fixed.

**Cheapest hedge, if one is ever wanted:** bind `OrganizationDefaults` to `IOptions<T>` from configuration with the current values as the in-code fallback. No table, no migration, no admin page, no new failure surface — but also not a Site Admin feature.

---

## Signal — status semantics, ageing, effort, triage grid, saved views

*Parked 2026-08-27 from `mockups/comp-g-signal.html` (drawn 2026-08-16 in the locked Comp C language, so only the feature is under review, not the look). Proposal items #1, #2, #5.*

Five capabilities the comp argues are worth little alone and a lot together — they turn the board from *a list of what exists* into *a list of what needs attention*:

- **Status semantics — "Counts as".** Every status gets one of four meanings: Open / Waiting–external / Closed–succeeded / Closed–declined. Today a status is a name, a colour and a sort order, so **nothing in the product can tell "In Review" from "Complete"** — no other item here works without this.
- **Per-status ageing.** A "flag after N days" threshold per status; an idea past it reads as stalled, with an age badge on the list and a stalled count in statuses admin.
- **Effort.** A third sizing field beside Priority and Business Impact (Low/Medium/High/Not sized), deliberately rendered with **no colour at all**.
- **Triage grid.** A 3×3 Impact × Effort view as a third board mode; dragging between cells edits both. The comp rejects a single computed score (RICE/ICE) on the grounds that *"a single computed number hides the disagreement that actually matters."*
- **Saved views.** Named filter+sort+column sets, personal or org-pinned, with a dirty-state "Update view" affordance.

**Sequencing is stated in the comp, not invented here:** status semantics (#1) must precede the triage grid (#5), because the grid *"is only honest if 'open' is real."*

**Open question the comp leaves deliberately unanswered:** existing organizations have statuses with no meaning recorded. It assumes *default everything to Open, then prompt the Org Admin once* — flagged as needing confirmation before building. A "Declined" default status also appears, which would change `OrganizationDefaults`.

## Loop — mentions, notification inbox, activity feed

*Parked 2026-08-27 from `mockups/comp-h-loop.html`. Proposal item #3.*

One loop, not three features: *mention → notification → reply → read*. The comp's argument for building them together is that *"a notification with nothing to notify about is empty, and an activity feed nobody is addressed by is noise."* Covers @mention autocomplete in the comment composer, an Inbox rail item with unread badge and tabbed filters (mentions / assigned / replies / archived) each carrying a "why" line, an org activity feed that **replaces the existing "Activity feed coming soon" placeholder**, a separate "Waiting on you" panel (the subset addressed to you — the actual to-do list), unread markers in threads, snooze as well as archive, and a per-event-type preferences screen.

Two things to settle before this could be specced:

- **The email column is a promise the platform has not made.** `SPEC/00-project-brief.md` defers guaranteed outbound email delivery; the comp flags its own email toggles as writing a cheque against that. In-app inbox only is the safe first slice.
- **A locked colour rule is knowingly bent.** The comp uses indigo for unread badges and markers, arguing an unread notification *is* "a primary action waiting for you" — an extension of the accent's existing meaning rather than a new one. It presents this as a reviewer decision and offers a no-hue fallback (weight + filled ink dot + left rule). Introducing or extending a state colour is a deliberate decision — the design system is locked to comp P/Q — so this needs an explicit yes or no.

Mentioning does not grant access — a Read Only member mentioned on an idea still sees it read-only.

## Memory — idea links, decision records, read-only share links

*Parked 2026-08-27 from `mockups/comp-i-memory.html`. Proposal items #4, #6, #7.*

Grouped by one thesis: *each is about the board still making sense to someone who wasn't there.* Links say how ideas relate, decisions say why something stopped, and the share link is how someone outside the organization reads either.

- **Typed idea links** — Relates to / Supersedes / Duplicate of / blocks–is blocked by, two-way with auto-inverse, with an optional note on why. Plus **non-AI duplicate suggestions** by text overlap ("82% overlap") — explicitly nothing linked automatically — and a separate confirmed **merge** step (votes deduped by voter, description quoted into a comment rather than merged, reversible for 30 days).
- **Decision on close** — closing an idea into a closed/declined status requires an outcome category, reasoning of at least 20 characters, a decided-by person, and an optional revisit date; these surface as an org-wide searchable **Decisions page**. Deliberately **not retroactive**: already-closed ideas read "No decision recorded — closed before this was captured."
- **Read-only board share links** — Org-Admin-only tokenized URL with granular visibility toggles (people and comments **off** by default, names masked), default 30-day expiry, optional passphrase, revoke/regenerate, and an anonymous access log.

**The linking half has a real deadline, and it is already running.** Sprint 7 shipped AI drafting with dedupe **deferred to v2** — so an assistant is now generating near-duplicate ideas into a system with no way to express "this is the same as that." Manual links are both the stopgap and the training data an automated dedupe would later need.

**The share link is the one proposal with a genuine security surface**, and the comp says so itself: an unauthenticated tokenized URL is a new way for organization-scoped data to leave the organization, and *the role model has no concept of "not a member."* It is deliberately **not** the Read Only role — Read Only is a member with an account; a share link is for someone who will never have one. Four choices in it are unconfirmed by design: token-only credential unless a passphrase is set, the 30-day default, people/comments defaulting off, and Org-Admin-only creation. This one needs a security decision before a spec, not after.

## Status categories — mark which status means Complete or In Review

> Raised 2026-09-30 by slice 132. **User decision 2026-09-30:** Home's *Open ideas* and *Awaiting
> review* tiles stay "not tracked yet" for now; this is the later fix.

Statuses are organization-defined and their names are free text, so nothing tells the client which
one means Complete and which means In Review. Home (comp Q `s-home`) needs exactly that to count
open ideas and ideas awaiting review. Guessing from the default names breaks on the first rename,
and guessing from lane position would be a business rule written in the client.

The idea: a category on each status (for example `Open`, `InReview`, `Complete`), set by an Org
Admin, defaulted for the seeded five, and served on the statuses routes — a schema change. A
cheaper partial alternative is a server-side `open` filter on the idea lists, defined as not in a
board's last lane; it answers *Open ideas* but not *Awaiting review*.

## Status-change times — a read route for when ideas moved

> Raised 2026-09-30 by slice 132. **User decision 2026-09-30:** Home's *Completed · 30d* tile, the
> "a week without moving" filter and *Recent activity* stay as "not tracked yet" placeholders for
> now; this is the later fix.

All three need to know when an idea's status changed. Only `audit_events` records that
(`IdeaStatusChanged`), and no route reads it. The idea: a read-only route over those events, scoped
to the caller's organization and role, that Home can ask for recent moves and for ideas unmoved
since a date. It overlaps the Loop's org activity feed above; build one route that serves both.

## Portals — public and seatless submissions via public links

*Refined 2026-09-28 in an ideation session; audience widened and embed code added 2026-09-30. Comp: `mockups/comp-s-portal-form.html` (branded-shell mode, Terrazzo).*

**How might we** let people without a Collega account (employees without a seat, or the general public) submit ideas that arrive structured enough to triage without chasing the submitter, from a shareable or embeddable link, without turning an anonymous write endpoint into an abuse channel?

For **anyone without an account**. That includes an internal suggestion box for employees without seats, and a public one for customers, citizens or any outside audience. The mechanism is the same either way: a portal is publicly reachable by URL, and the org decides who gets the link and whether to add a passphrase. Success is **quality, not volume**: submissions a triager can act on without a follow-up conversation.

- **Portal.** An Org Admin creates one with a title, a slug, a target **idea type**, which of that type's fields to show (each visible/required, with portal-specific help text), and an **optional** passphrase. The "form" is portal configuration over an existing idea type, not a new form-builder concept.
- **URL: `{domain}/public/{orgSlug}/{slug}`, publicly reachable with no sign-in.** The fixed `/public` prefix stays clear of app routes, so no org slug needs reserving (2026-09-30: `/{orgSlug}/public/{slug}` was considered and rejected for that reason). Portal slugs are unique **per organization**. This needs a new `organizations.slug`, globally unique, derived from the title and editable at creation, then **immutable**, because every shared link depends on it.
- **Two ways to present one portal.** The link opens a **branded shell** (org name + `logo_url`, no desk navigation, since an unauthenticated visitor can't use it). An **embed** variant of the same URL renders the form only, for iframes. Every portal offers both, so this isn't a per-portal setting.
- **Embed code generator.** The portal's Settings page has a **Get embed code** action that produces a copyable snippet, for example `<iframe src="{domain}/public/{orgSlug}/{slug}?embed=1" title="{portal title}" width="100%" height="…" style="border:0" loading="lazy"></iframe>`, so an external party can paste it into their own site. The embed variant should report its content height to the parent page (`postMessage`), so a host page can size the frame without a scrollbar. The exact query parameter or path is settled at spec time.
- **Guided form.** It follows the structured-idea shape (problem → proposed solutions → impact) with inline examples and a completeness meter. **Only the title is always required**; everything else is per-portal configuration. The meter, not validation, pushes for quality.
- **Optional name and email**, so a triager can follow up. No account is created.
- **Triage queue, not a board.** Submissions appear as a **tab or filter on the Ideas list**. **Org Admins only** accept or reject. Accepting means filling in what the submitter couldn't know (board, status, business impact, priority and any missing required fields); the accepter becomes the idea's author, and the submitter's name and email stay on the submission record and show on the idea. The queue is what makes this fit: `ideas` requires an author, board, status and impact, and keeping submissions separate until accepted avoids a nullable-author or placeholder-user hack.
- **Passphrase is optional.** It's off for a public portal and on for an internal one where casual outsiders should be kept out. It's a speed bump, not access control, and is entered once per browser session.

**Settled in the session:** Org-Admin-only triage; queue on the Ideas list; title-only minimum; rejected submissions **soft-deleted and kept indefinitely**; **any site may embed**; a disabled portal keeps its slug (only deleting frees it); **no attachments** in the MVP. **2026-09-30:** the general public is a supported audience, not just employees without seats; the passphrase is optional; one portal serves both the branded link and the embed; embed code is generated in Settings.

**MVP scope:** portal CRUD in Settings; per-portal field overrides; optional passphrase; branded shell and embed variant of every portal; embed-code generator; a rate-limited anonymous submit endpoint; queue accept/reject; enable/disable. A schema amendment (`organizations.slug`, `portals`, `portal_fields`, `portal_submissions`) recorded in `SPEC/decisions.md`, and contracts in `SPEC/30-Contracts.md`.

**Not doing:** a reusable form builder (idea type + overrides covers it); AI-assisted intake (cost and prompt-injection surface on an anonymous endpoint, and the scope gate is currently unmeasurable); the full desk frame; email receipts or status notifications (outbound email is deferred); a submitter status page or receipt codes (closing the loop isn't the goal yet); captcha, SSO or domain-verified email; "similar ideas" suggestions while typing (would leak internal ideas to anonymous visitors); merging with read-only board share links above (same primitive family, separate scope).

**Assumptions to validate:** guided prompts beat free text (run ~10 real ideas through the comp); Org Admins will actually work the queue (watch queue age); a rate limit alone keeps a public, passphrase-free portal's queue workable; enough submitters leave an email to make follow-up real; one idea type per portal covers real use.

**The anonymous write surface is the real risk, and it is new.** Every anonymous endpoint today is auth; this is the first that writes organization data. Its only bound is the auth rate limiter's design, which is per warm instance on serverless — the same limitation `SPEC/30-Contracts.md` already records. A spam run lands in a queue an admin must clear by hand. It belongs with the shared-store work the lockout and rate-limit items already wait on. **Supporting the general public sharpens this:** a public, passphrase-free portal embedded on a busy site will be found by bots, so "no captcha" in the Not doing list should be re-read before the spec. A honeypot field and a minimum fill time are cheap first steps that need no new dependency.

**Three settled answers carry costs worth re-reading before a spec:**
- **Indefinite retention of rejected submissions keeps personal data (name, email) with no purge.** Fine with no tenants; a first real tenant may need a retention period or an erase path. Public submitters make this more pressing, since they're members of the public and not employees under an existing agreement.
- **Any site may embed** means a hostile page can frame the form. The blast radius is small (it only accepts submissions, and no session exists to hijack), but it rules out `frame-ancestors` as a defense later without a migration of existing embeds.
- **A title-only minimum** works against the quality goal. The meter is the bet; if accepted submissions still need chasing, the fix is per-portal required fields, which the configuration already allows.

## Goals — board key results with a closed loop to shipped ideas

*Refined 2026-09-30 in an ideation session. Post-MVP; picked as the first of the 2026-09-30 batch because it is the differentiator from a generic idea board. No customer is pulling for it yet.*

**How might we** tie a board's ideas to a measurable outcome ("improve X by Y") so triage asks "does this move the number?" and leaders can see shipped ideas beside the number's movement?

**Recommended direction: a staged closed loop.**

- **Stage 1: board key results.** A board carries one or more **Key Results**, each with a statement, unit, baseline, target and current value. The current value is updated by a manual **check-in log** (value, date, note, author) and drawn as a sparkline in the board header. Ideas link to one or more of their board's KRs.
- **Stage 2: challenges.** A portal can target a KR. Its form leads with the goal ("Help us cut wait times from 14 → 10 min") and submissions arrive pre-linked. Idea-management tools sell this as campaigns or challenges, so it is table stakes there, but new for a board tool.
- **Stage 3: the closed loop.** When a linked idea reaches a Complete-category status, the KR owner is prompted to check in, and the KR timeline marks the shipped idea beside the value.
- **Org-level Objectives** are an optional parent for board KRs (OKR vocabulary), added later without migration.

**The honest claim is correlation on one timeline, never per-idea attribution.** With hand-entered values, Collega can show that ideas shipped and the number moved. It cannot show that one caused the other.

**Assumptions to validate:** KR owners check in on a cadence (pilot one program for 6 weeks and count check-ins); goal-framed portals yield better submissions than open ones (~10 real ideas through both framings); leaders value "shipped vs. the number" (a mocked timeline shown to 3 prospective buyers).

**MVP scope (Stage 1):** KR CRUD on a board (Org Admin and board owner); check-in log; board-header sparkline and progress; idea ↔ KR links on the idea drawer; filter the Ideas list by KR. A schema amendment (`key_results`, `key_result_checkins`, `idea_key_results`) recorded in `SPEC/decisions.md`.

**Not doing:** per-idea contribution percentages (manual data can't support causal attribution); automatic measurement from external systems (waits for the integration layer below); org-level Objectives in Stage 1 (the board level tests the bet); check-in reminders by email (outbound email is deferred, so reminders ride Loop's in-app inbox); goal-weighted idea scoring (a ranking model before we know KRs get maintained).

**Stale numbers are the likeliest failure.** Hand-updated KRs rot within about a quarter without a cadence and a reminder. That makes Stage 3 depend on **Status categories** (for "Complete") and **Loop** (for the in-app prompt), both above and both unbuilt.

**Open questions:** who owns a KR (one named user, or the board owner by default)? Schedule Status categories and Loop before Stage 3, or ship its prompt as a banner on the idea drawer? Do Read Only users see KR values?

## Teams and private boards

*Captured 2026-09-30. Not yet refined. Anticipated need, no customer pulling.*

**How might we** let an org keep some boards visible only to the people who should see them, without making admins manage access one board and one person at a time?

- **Lean direction: private boards before teams.** Add a board visibility setting of *Org* or *Private*, with a member list of users. A **Team** is then just a named group of users you can add to that list. Per-idea permissions are out.
- **The cost is cross-cutting, not local.** Every read that lists or aggregates ideas has to filter by visibility: Home, search, mentions, member and assignee pickers, portal routing to a board, CSV import, audit views, and View As.
- **Open:** do Org Admins always see private boards? Can a private board be the target of a public portal?

## Integration suite

*Captured 2026-09-30. Not yet refined. A major post-MVP goal: Jira, Zapier, ServiceDesk, Footprints and similar.*

**How might we** add a new vendor integration in days rather than as a rewrite each time?

- **Foundation first: webhooks + API tokens.** Build signed outbound webhooks from a domain-event outbox, plus org API tokens on the existing REST contracts. Zapier mostly works from that alone, and it covers the long tail of vendors.
- **Then a connector port.** Native adapters (Jira first, when a customer pulls for one) implement one port that maps Collega events to vendor calls and back. Inbound sync lands in the intake-channel queue (see email intake below), not directly on a board.
- **Open:** which direction matters first, pushing ideas out to delivery tools or pulling tickets in? Storing vendor credentials per org is the same problem tracker rule 30 deliberately left unsolved for AI credentials, so it needs its own decision.

## Email submission

*Captured 2026-09-30. Not yet refined.*

**How might we** accept ideas from an inbox when the only reliable fields are subject and body?

- **Treat email as a second intake channel for Portals**, not a separate feature. Each portal gets an inbound address. Subject maps to title, body to description, and sender to the submitter's name and email.
- **Per-channel defaults** (board, status, assignee, business impact, priority, other required fields) prefill the accept form in the triage queue. An optional **auto-accept with defaults** switch serves trusted sources. The queue already solves the problem that `ideas` requires an author, board, status and impact.
- **Open:** inbound mail provider (a new dependency and a new cost); how to handle attachments (Portals has none in the MVP); spoofed senders, since an email address is not identity; and whether replies to the same thread are ignored or attached as comments.

## Act-As opt-out for sensitive organizations

*Captured 2026-09-30. Not yet refined. Builds on `SPEC/20-feature-view-as.md`.*

**How might we** let an org holding sensitive information keep the platform operator out of its data?

- **Direction chosen 2026-09-30:** an org-level setting, owned by the Org Admin, that stops Site Admins from starting View As sessions for that org's users. If support is needed, the Org Admin turns it back on temporarily. Turning it on and off is audited.
- **Word it honestly.** It stops operator access *through the product*, not database access, so the setting should read "Site Admins can't view as users in this org", not "your data is sealed".
- **New-org setup depends on View As.** A Site Admin cannot write directly and fills a new org by acting as its Org Admin, so the setting should only be available once the org has an active Org Admin.
- **Open:** does it also cover an Org Admin acting as users inside their own org? Is emergency access ever needed (a break-glass path, audited and notified), or is "the org turns it back on" enough?

## Showcase demo organizations — one org per use case, for sales demos

*Refined 2026-09-30 in an ideation session. Revisits the demo seed (`packages/infrastructure/src/demo-seed/`).*

**How might we** show a prospect, in a few minutes, that one Collega fits very different kinds of team just through configuration (statuses, idea types, custom fields, tags and boards)?

For **sales demos to prospects**: each org is a story a presenter walks someone through. Success is that each org feels like a different product. It has its own vocabulary, workflow and content, not the default catalog with a new name.

**The five orgs:**

| Org | Use case | Story |
|---|---|---|
| **Apex Manufacturing** | Business process improvement | A Lean/PDCA program, e.g. Identify → Analyze → Pilot → Standardize → Sustained |
| **Beta Co** | General Trello-style boards | A small team running everything on simple boards: the "you don't have to configure anything" pitch |
| **Rubicon Technology** | Product development | Discovery through release, with product-shaped idea types and fields |
| **Gamma LLC** | Marketing agency | Client work and campaigns, with client and channel as fields or tags |
| **Delta Inc** | Support queue | New → Triaged → In progress → Waiting on customer → Resolved, with a Severity field |

"ACME Co" was renamed to **Apex Manufacturing** because **Acme Robotics** stays (below), and two Acmes in the org and View As pickers would confuse a demo.

**Recommended direction.**

- **A flagged showcase seed.** `db:seed` stays exactly as it is. A flag (e.g. `db:seed --showcase` or `SEED_SHOWCASE=1`) adds the five orgs on top. **Acme Robotics and Blue Harbor Logistics stay as the test fixture**: about 60 golden fixtures, the E2E suite and `apps/web`'s test fixtures reference them by slug, and the golden corpus cannot be re-recorded. Keeping the showcase out of the default seed also keeps it out of every test cycle, so demo content can change without breaking a test.
- **Deep configuration per org.** Each org has its own statuses, idea types, custom fields and tags; 15–20 domain-credible ideas with comments and assignees; and users in every role from Org Admin to Read Only.
- **A demo script per org**, kept beside its data (e.g. "sign in as Delta's agent, open the P1 that has been Waiting on customer longest, show the drawer, then act as the Read Only user"). The data is shaped so every beat of the script is true.
- **Catalogs shaped to be liftable.** Each vertical's statuses, idea types, fields and tags are one named constant **inside the seed**, not in `@collega/application`. They are the natural content for **Org bootstrap templates** option B (above), but putting them in application code would commit the product to a feature that entry deliberately parked. Lifting them later is a file move.

**Assumptions to validate:**

- **A demo environment exists.** The seed refuses production by design, so a prospect demo needs a non-production deployment (a Vercel preview or staging environment with its own database) that someone seeds and keeps alive. No spec covers that yet, and without it the showcase is local-only. **This is the likeliest thing to sink the idea.**
- **Scripts stay true.** One smoke test should seed the showcase and assert each script's key facts (the P1 exists and is the oldest waiting item, and so on), not just that seeding succeeds.
- **Content quality is the product.** Generic ideas reused across five orgs would undercut the pitch. The writing, roughly 80–100 domain-credible ideas, is the real cost, not the code.

**MVP scope:** the flag; five orgs with catalogs, users in every role, boards, ideas, comments and assignees; one demo script per org; a smoke test for seeding and each script's key facts. It needs no schema change and no new route.

**Not doing:** replacing or renaming Acme Robotics and Blue Harbor (breaks the golden corpus); an org-template picker at org creation (Org bootstrap templates stays parked until its own trigger fires); moving catalogs into `@collega/application` (pre-commits to that feature); backdated, time-shaped activity (it needs an injected clock through the seed, so it comes later and matters most for Delta's ageing story); showcase content for unbuilt features such as Goals and Portals (add each as it ships, e.g. a key result on Apex).

**Open questions:** where the demo environment lives and who re-seeds it; whether the Development-only guard should allow a named demo environment; how many boards each org needs (Gamma may want one per client; Beta should stay minimal); and the user naming scheme (today's `orgadmin@{slug}.demo.collega.test` with one shared password, or named personas per org).

## Comps D / E / F — alternate shells, not adopted

*Recorded 2026-08-27. **Comp C "Fluent Editorial" remains locked** — these are not implementation targets.*

Three alternate directions produced 2026-08-16 and labelled as such in their own markup: **D "Focus Desk"** (denser rows, labelled sidebar over icon rail, Ctrl-K command palette, docked non-modal inspector instead of a drawer), **E "Workspace Canvas"** (board as the home screen, "group by" regrouping the same cards by owner/type/priority, where dropping a card in another person's lane reassigns it), **F "Editorial Brief"** (idea as document with an outline rail and margin comments anchored to paragraphs, plus a compose form that splits free-text Description into three named prompts — problem / proposal / what it would take).

None introduces a new capability; all three restructure chrome around the existing model. No review decision was ever recorded against them. Two ideas inside them survive independently of their shells and are worth stealing whatever happens to the shells:

- **Comp F's structured compose prompts.** *"A free-form 'Description' box produces one-line ideas that nobody can evaluate; three named questions produce something a reviewer can act on."* An optional scaffold, not a gate.
- **Comp D's answer to the drawer bug.** A docked inspector as a third grid column *"is never covered and never needs `inert`. There is no focus trap to get wrong"* — precisely the class of defect the open `DrawerShell` item in `SPEC/Bug Triage.md` describes. Comp D also demonstrates working fixes for two other open queue items: a native `<button type="submit">` so Enter submits, and `autocomplete="username"`.
