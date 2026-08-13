# Ideas Inbox

> Unrefined product ideas, captured so they aren't lost. **Nothing here is scheduled, specified, or approved, and nothing here blocks a sprint.**
>
> This is deliberately *not* part of `SPEC/Bug Triage.md`: that file gates feature work ("clear TODO before starting new features"), and applying that gate to raw feature ideas would block all work until the idea is built. Ideas here are only picked up when the user explicitly asks.
>
> **Promotion path:** idea → user discussion → canonical spec (`SPEC/20-feature-*.md`) → sprint plan (`SPEC/sprints/`). Once an idea is promoted, delete it here — the spec becomes its home.

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
