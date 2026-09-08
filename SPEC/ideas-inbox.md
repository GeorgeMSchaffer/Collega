# Ideas Inbox

> Unrefined product ideas, captured so they aren't lost. **Nothing here is scheduled, specified, or approved, and nothing here blocks a sprint.**
>
> This is deliberately *not* part of `SPEC/Bug Triage.md`: that file gates feature work ("clear TODO before starting new features"), and applying that gate to raw feature ideas would block all work until the idea is built. Ideas here are only picked up when the user explicitly asks.
>
> **Promotion path:** idea → user discussion → canonical spec (`SPEC/20-feature-*.md`) → sprint plan (`SPEC/sprints/`). Once an idea is promoted, delete it here — the spec becomes its home.

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
- **A locked colour rule is knowingly bent.** The comp uses indigo for unread badges and markers, arguing an unread notification *is* "a primary action waiting for you" — an extension of the accent's existing meaning rather than a new one. It presents this as a reviewer decision and offers a no-hue fallback (weight + filled ink dot + left rule). Per `src/Collega.Client/CLAUDE.md`, introducing or extending a state colour is a deliberate decision, so this needs an explicit yes or no.

Mentioning does not grant access — a Read Only member mentioned on an idea still sees it read-only.

## Memory — idea links, decision records, read-only share links

*Parked 2026-08-27 from `mockups/comp-i-memory.html`. Proposal items #4, #6, #7.*

Grouped by one thesis: *each is about the board still making sense to someone who wasn't there.* Links say how ideas relate, decisions say why something stopped, and the share link is how someone outside the organization reads either.

- **Typed idea links** — Relates to / Supersedes / Duplicate of / blocks–is blocked by, two-way with auto-inverse, with an optional note on why. Plus **non-AI duplicate suggestions** by text overlap ("82% overlap") — explicitly nothing linked automatically — and a separate confirmed **merge** step (votes deduped by voter, description quoted into a comment rather than merged, reversible for 30 days).
- **Decision on close** — closing an idea into a closed/declined status requires an outcome category, reasoning of at least 20 characters, a decided-by person, and an optional revisit date; these surface as an org-wide searchable **Decisions page**. Deliberately **not retroactive**: already-closed ideas read "No decision recorded — closed before this was captured."
- **Read-only board share links** — Org-Admin-only tokenized URL with granular visibility toggles (people and comments **off** by default, names masked), default 30-day expiry, optional passphrase, revoke/regenerate, and an anonymous access log.

**The linking half has a real deadline, and it is already running.** Sprint 7 shipped AI drafting with dedupe **deferred to v2** — so an assistant is now generating near-duplicate ideas into a system with no way to express "this is the same as that." Manual links are both the stopgap and the training data an automated dedupe would later need.

**The share link is the one proposal with a genuine security surface**, and the comp says so itself: an unauthenticated tokenized URL is a new way for organization-scoped data to leave the organization, and *the role model has no concept of "not a member."* It is deliberately **not** the Read Only role — Read Only is a member with an account; a share link is for someone who will never have one. Four choices in it are unconfirmed by design: token-only credential unless a passphrase is set, the 30-day default, people/comments defaulting off, and Org-Admin-only creation. This one needs a security decision before a spec, not after.

## Comps D / E / F — alternate shells, not adopted

*Recorded 2026-08-27. **Comp C "Fluent Editorial" remains locked** — these are not implementation targets.*

Three alternate directions produced 2026-08-16 and labelled as such in their own markup: **D "Focus Desk"** (denser rows, labelled sidebar over icon rail, Ctrl-K command palette, docked non-modal inspector instead of a drawer), **E "Workspace Canvas"** (board as the home screen, "group by" regrouping the same cards by owner/type/priority, where dropping a card in another person's lane reassigns it), **F "Editorial Brief"** (idea as document with an outline rail and margin comments anchored to paragraphs, plus a compose form that splits free-text Description into three named prompts — problem / proposal / what it would take).

None introduces a new capability; all three restructure chrome around the existing model. No review decision was ever recorded against them. Two ideas inside them survive independently of their shells and are worth stealing whatever happens to the shells:

- **Comp F's structured compose prompts.** *"A free-form 'Description' box produces one-line ideas that nobody can evaluate; three named questions produce something a reviewer can act on."* An optional scaffold, not a gate.
- **Comp D's answer to the drawer bug.** A docked inspector as a third grid column *"is never covered and never needs `inert`. There is no focus trap to get wrong"* — precisely the class of defect the open `DrawerShell` item in `SPEC/Bug Triage.md` describes. Comp D also demonstrates working fixes for two other open queue items: a native `<button type="submit">` so Enter submits, and `autocomplete="username"`.
