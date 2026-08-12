# Workstream Roadmap

> ⛔ **ARCHIVED / HISTORICAL — DO NOT PLAN FROM THIS FILE.**
> Archived 2026-08-11. Its Restart Baseline asserts that no milestone is in progress or complete and that work should begin at Milestone 1.
> That is **false**: all MVP milestones are delivered; the project is in post-MVP sprint work (Sprint 4 of 8).
>
> Current status is `SPEC/implementation-agent-tracker.md` (Current Status). Current scope is `SPEC/95-next-sprints.md` + `SPEC/sprints/`. This file is retained only as a record of the original plan.

## Purpose
Translate the implementation plan into milestone-oriented workstreams grouped by architecture responsibility.

## Restart Baseline
- This roadmap is sequencing guidance for a new implementation start.
- No milestone is currently in progress or complete.
- Before beginning a milestone or feature, read `Bug Triage.md`. Resolve its `TODO` items first unless the user explicitly approves an exception.
- Begin with Milestone 1 and update execution state in `implementation-agent-tracker.md` as work resumes.

## Milestone 1: Platform Foundation
Target outcome: the solution boots, validates requests, and exposes a protected API shell.

### API Workstream
- establish `/api/v1` routing and endpoint conventions
- implement problem-details error handling
- add request validation pipeline and OpenAPI skeleton generation

### Application Workstream
- add current-user context abstraction
- add clock abstraction and shared interfaces for persistence and auth

### Infrastructure Workstream
- set up DbContext, migrations, and core schema primitives
- add environment-driven configuration for seeded credentials

### Client Workstream
- establish shell, navigation, auth bootstrapping pattern, and Fluent UI baseline

## Milestone 2: Authentication and Access
Target outcome: users can authenticate safely and the seeded Site Admin path works.

### API Workstream
- implement auth endpoints and authorization middleware integration

### Application Workstream
- implement login orchestration, password change, lockout, and inactive-user denial

### Infrastructure Workstream
- implement password hashing, token issuance, and lockout persistence support
- implement Development-only demo environment seed data with idempotent startup behavior

### Client Workstream
- build login page and first-login password change flow

## Milestone 3: Tenant Administration
Target outcome: organizations and users can be administered within the documented role boundaries.

### API Workstream
- implement organization and user endpoints, query filters, and validation

### Application Workstream
- implement organization bootstrap, archive behavior, user CRUD, role protections, and lifecycle logic

### Infrastructure Workstream
- implement organization and user persistence, global email uniqueness, and audit persistence hooks

### Client Workstream
- build Admin section pages for organizations and users

## Milestone 4: Workflow Configuration
Target outcome: organizations can manage statuses and boards safely.

### API Workstream
- implement status and board endpoints

### Application Workstream
- implement status soft-delete rules, board validation, and swimlane reordering behavior

### Infrastructure Workstream
- implement status, board, and swimlane persistence with ordered mappings

### Client Workstream
- build status management and board administration views

## Milestone 5: Idea Collaboration
Target outcome: users can create, discuss, tag, mention, and move ideas.

### API Workstream
- implement idea, comment, and upvote endpoints plus status moves

### Application Workstream
- implement idea workflows, tag normalization, mention resolution, comment permissions, and upvote toggling

### Infrastructure Workstream
- implement ideas, tags, mentions, comments, upvotes, and supporting constraints

### Client Workstream
- build board overview, idea cards, idea detail, comment thread, tag entry, mention experience, and upvote UI

## Milestone 6: Events and Observability
Target outcome: audit and notification events are generated and persisted for MVP verification.

### API Workstream
- avoid adding event query endpoints unless scope changes

### Application Workstream
- implement audit message composition and notification event generation

### Infrastructure Workstream
- persist audit and notification events with metadata and human-readable message fields

### Client Workstream
- no required user-facing event screens in MVP

## Milestone 7: Hardening and Release
Target outcome: contracts, tests, and release boundaries are aligned.

### API Workstream
- align OpenAPI to implementation behavior

### Application Workstream
- close behavior gaps found by unit and integration tests

### Infrastructure Workstream
- harden migrations, constraints, and seed paths

### Client Workstream
- resolve final validation, navigation, and role-affordance defects

### QA Workstream
- run contract, integration, end-to-end, and regression coverage against acceptance criteria
- validate Development-only demo seed composition and non-Development seed suppression

## Milestone 8: OAuth (Post-MVP Phase 2)
Target outcome: organizations can use Microsoft Entra ID sign-in with coexistence to local login.

### API Workstream
- implement organization-scoped OAuth initiation and callback endpoints
- implement OAuth configuration endpoints and validation responses

### Application Workstream
- implement external identity completion, linking, email fallback, and auto-provision logic
- enforce inactive-user and organization-scope guardrails in OAuth flows

### Infrastructure Workstream
- implement external identity persistence and organization provider configuration
- support secure provider credential configuration and audit persistence

### Client Workstream
- add organization-scoped OAuth sign-in entry points
- preserve local login path and support OAuth session completion UX

## Milestone 9: SAML (Post-OAuth Phase)
Target outcome: organizations can use SAML 2.0 sign-in using the same identity model.

### API Workstream
- implement SAML initiation and assertion-consumption endpoints
- expose SAML organization-configuration endpoints

### Application Workstream
- map SAML assertions to the shared external identity model
- reuse linking and provisioning behaviors from OAuth phase

### Infrastructure Workstream
- persist SAML configuration metadata and certificate references
- support metadata validation and audit persistence

### Client Workstream
- add SAML sign-in initiation in org-scoped login UX
- preserve coexistence with local and OAuth login paths

## Sequencing Guidance
1. Milestones 1 and 2 are serial and should complete before broad parallel feature work.
2. Milestones 3 and 4 can overlap partially once the auth layer is stable.
3. Milestone 5 should start only after board and status contracts are stable.
4. Milestone 6 depends on working collaboration workflows from Milestone 5.
5. Milestone 7 is the release gate and closes all workstreams.
6. Milestone 8 starts only after Milestone 7 MVP release completion.
7. Milestone 9 starts after Milestone 8 stabilizes.
