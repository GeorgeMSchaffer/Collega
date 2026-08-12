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
