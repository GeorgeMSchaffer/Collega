# Feature: AI-Assisted Idea Drafting (Idea Brainstorm Chat)

**Status:** Post-MVP. Scheduled as **Sprint 7** (`SPEC/sprints/sprint-07-ai-idea-assist.md`) — after the Postgres migration (Sprint 5) and View As (Sprint 6), before Azure deployment (Sprint 8). Design decisions locked 2026-08-11 by user interview; `Anthropic` NuGet package approved by the user the same day.

## Overview

`Components/IdeaBrainstormModal.razor` already fronts idea creation on the Ideas list with a ChatGPT-style chat. Today it is **scripted**: three canned assistant nudges cycle, and the transcript of the user's own messages is handed to `IdeaCreateModal.InitialDescription` as a seed description. This feature replaces the scripted nudges with a real model-backed conversation that additionally **maps the user's answers onto Idea form fields**, while keeping the conversation confined to idea drafting for this organization.

Two mechanisms do two different jobs, and conflating them is the failure mode this spec exists to prevent:

- **Grounding** — retrieval of the organization's own structured data, so the assistant speaks in this org's vocabulary and can map "cut the approvals down to one step" onto a real `IdeaTypeId` and `BusinessImpactId` rather than inventing values.
- **Containment** — keeping the conversation on idea drafting. **Retrieval does not do this.** A retrieval-grounded model answers off-topic questions from its own weights whenever retrieval returns nothing relevant. Containment here comes from constraining the model's *output shape*, plus an explicit scope gate.

---

## Design Decisions (Interview-Resolved 2026-08-11)

| ID | Decision | Resolution |
|---|---|---|
| **D-SCOPE** | How is "in scope" decided? | **Idea Types + an Org-Admin-editable scope statement.** Structural boundary = "could this become an Idea of one of this org's active Idea Types?"; an Org Admin additionally sets a free-text narrowing statement (e.g. *"business process improvement only"*). Per-org, retunable without a deploy. |
| **D-DEDUPE** | Does v1 retrieve similar existing ideas? | **No — deferred to v2.** v1 retrieves structured org data only. No embeddings, no `pgvector`, no dependency on the Sprint 5 migration beyond running after it. |
| **D-CREDS** | Where does the API key live? | **Single platform-level key in server configuration/secrets** for v1. The per-org override endpoints already specified in `SPEC/30-Contracts.md` stay **unimplemented** — see "Credentials" below. |
| **D-PREFILL** | Which Idea fields may the assistant pre-fill? | **Title, Description, Idea Type, Business Impact, Priority**, as editable suggestions. User-Defined Field values and tag suggestions are **out of v1 scope**. |

## UI Decisions (Comp-Resolved 2026-08-16)

Locked from the comp round — `SPEC/mockups/comp-c-review-11-ai-assist-{a-handoff,b-livedraft,c-draftstrip}.html`. **Direction C is the built one**; A and B are rejected alternatives kept for history, like Comps A and B before them.

| ID | Decision | Resolution |
|---|---|---|
| **D-SURFACE** | Where does drafting happen? | **Direction C — "Draft Strip".** One 720px surface at a time (chat modal → create modal), `CreateModalShell` unchanged, plus a slim **read-only** strip between transcript and composer showing what has been classified so far. Rejected: A (no strip — the user learns nothing until the handoff) and B (a two-pane editable sheet — needs new chrome, per-field suggested-vs-edited state, and has no narrow-viewport answer). |
| **D-SUGGEST** | How is a suggested value marked? | **Teal**, never the indigo accent — indigo already means "active/selected" throughout Comp C and a suggestion is neither. On the form: a `Suggested` chip beside the label, a tinted field, and a 3px left border. On the strip: the same teal as pills. |
| **D-SCOPEUI** | Where does an Org Admin edit the scope statement? | **A dedicated Settings page**, not the Organization detail drawer. Decisive reason: `Settings.razor` is `[Authorize(Roles = "SiteAdmin")]`, so the org drawer is unreachable for the Org Admin who owns this setting under rule 6. |
| **D-REFUSED** | What does the user see when a turn is refused? | **Ghost-then-drop.** The message renders greyed and struck through for one beat with the redirect note beneath it, then disappears. Rejected: never rendering it, which is cleaner but makes typed input vanish with no acknowledgement and reads as a bug. |

---

## Problem Statement

The scripted chat collects prose and nothing else. Everything the user says about *what kind* of idea this is, *who it affects*, and *how urgent* it is has to be re-entered by hand as classification on the create form — and the org's Idea Types, Business Impacts, and required per-type fields are invisible during the conversation that should be shaping them. Meanwhile, a naively-added general-purpose chat box inside a business tool becomes a general-purpose chatbot: users ask it unrelated questions, it answers, and the org is paying inference costs to run a worse ChatGPT inside its idea tracker.

## Goals

1. **Draft faster.** A user finishes the chat with a title, a description, and a correct classification, not just a block of prose.
2. **Classify correctly.** Suggested `IdeaTypeId` / `BusinessImpactId` are always real, active options in the caller's organization — never invented, never from another org.
3. **Stay on topic.** Off-topic turns are refused consistently and cheaply, with a boundary each organization can tune itself.
4. **Never become a write path.** The assistant drafts; the user confirms; existing Application-layer validation is the only thing that authorizes a write.

---

## Rules

### Entry and conversation

1. The assistant is reachable **only** from the New Idea flow on the Ideas list and board (the existing `IdeaBrainstormModal`). There is no general chat surface, no persistent chat history across sessions, and no chat entry point elsewhere in the product.
2. Each user turn produces exactly one model call. The model returns a structured object (see "Response contract"); the client renders its `nextQuestion` as the assistant bubble.
3. The user may leave the chat at any time via **Skip & fill manually**, which opens the create modal with whatever has been drafted so far (possibly nothing). This path must remain available and must never be gated on a successful model call.
4. **Continue to idea form** hands the drafted fields to `IdeaCreateModal` as pre-filled, fully editable values. Nothing is committed at this point.
5. A conversation is capped at **20 transcript entries** — user and assistant messages combined — which is the cap `30-Contracts.md` states for the request body. Because a transcript alternates roles and must end with a user entry (rule 2), the largest valid request carries 19 entries, so the practical ceiling is **10 user turns**. On reaching the cap the assistant stops accepting input and offers only Continue / Skip.

    5a. This rule previously read "20 user turns", which contradicted the contract's "max 20 entries" and described a conversation twice as long. Resolved 2026-08-17 in favour of the contract: the cap counts **entries**, not user turns. A refused turn is dropped from the transcript (rule 8) and therefore does not consume the budget.

### Scope gate (D-SCOPE)

6. An organization has a **scope statement**: optional free text, max 500 characters, editable by Org Admin (and Site Admin acting on that org). Empty is valid and means "no narrowing beyond Idea Types."
7. In-scope is evaluated per user turn and returned by the model as `inScope`. The structural test is *"could this plausibly become an Idea of one of this organization's active Idea Types?"*; the scope statement narrows it further.
8. When `inScope` is `false`, the client renders a **fixed, server-supplied redirect string** and the offending turn is **dropped from the transcript** rather than appended. Off-topic content must not accumulate in context, because accumulated off-topic context is what drifts a constrained assistant into a general one.

    8a. *Presentation (D-REFUSED):* the refused message is shown **greyed and struck through for one beat**, with the redirect rendered as a system note — not as an assistant bubble, so refusals never read as conversation — then removed. It is never added to the history sent on the next turn; the ghost is a client-side acknowledgement only. The draft strip is annotated **unchanged**, since a refused turn moves nothing.
9. The scope statement is org configuration, not user input to the model's instruction channel — it is placed in the system prompt by the server. It is written by an Org Admin, who is a trusted operator in this system; it is nonetheless length-capped and never concatenated with end-user text.
10. Three consecutive out-of-scope turns close the chat with the redirect message and the Skip-to-form option. This bounds the cost of someone probing the boundary.

### Grounding / retrieval

11. Retrieved context is assembled **server-side**, scoped to the caller's organization as resolved from their token claims. The client never sends context, a prompt, a model name, or a scope statement.
12. v1 retrieval set, all from existing persistence — **plain EF/SQL queries, no vector search**:
    - active `IdeaType` options for the org, with each type's resolved field set (`IdeaTypeFieldResolver`) included as *context for question-asking only* — v1 does not fill those values (D-PREFILL);
    - active Business Impact options;
    - the target board's statuses;
    - the org's existing tags (for vocabulary; v1 does not suggest tags);
    - org members (as already exposed by `GET /api/v1/organizations/{organizationId}/members`), for recognizing names — v1 does not assign or mention.
13. Retrieval is **not** the containment mechanism. No rule in this spec may be restated as "the retrieved context will keep it on topic."
14. **v2 (not this sprint):** similar-idea retrieval for dedupe ("this looks like idea #214"), which is where embeddings earn their keep, and optional org playbook/SOP documents. Both wait on `pgvector` post-Sprint-5.

### Containment via response shape

15. The model is called with **structured outputs** (`output_config.format`, JSON Schema). It has no free-form text channel: the only user-visible string it can emit is `nextQuestion`. There is no field in which a limerick, a recipe, or a general-knowledge answer can be returned.
16. The JSON Schema is built **per request** from the retrieval result, so `ideaTypeId` and `businessImpactId` are `enum`s of that organization's real, active option ids. An invalid or cross-org classification is therefore **structurally impossible**, not prompt-discouraged.
17. `additionalProperties` is `false` and every enum is closed. Schema construction is server-side only.
18. Suggested `title` and `description` are length-capped in the schema to `Idea.TitleMaxLength` (150) and `Idea.DescriptionMaxLength` (4000) so a suggestion can never exceed what the domain accepts.

### Pre-fill (D-PREFILL)

19. The assistant may propose: `title`, `description`, `ideaTypeId`, `businessImpactId`, `priority`. All are optional in the response — an early turn may return only `nextQuestion`.
20. Every proposed value arrives in `IdeaCreateModal` as an **editable default**, visually indicated as a suggestion (D-SUGGEST: teal chip, tinted field, 3px left border). The user may change or clear any of them.

    20a. *During the conversation (D-SURFACE):* the classification values — Idea Type, Business Impact, Priority — are also shown live on a **read-only** draft strip above the composer, with values not yet chosen rendered explicitly ("Priority not set yet") rather than omitted, so "the assistant chose nothing" is distinguishable from "the assistant hasn't got there". The strip is a projection of the latest response and is **never editable**; editing happens on the create form, which is what keeps per-field suggested-vs-user-edited state out of v1.
21. UDF values and tags are **out of v1 scope**. The resolved field set changes when the Idea Type changes, which makes the drafting loop materially more complex; deferred rather than half-built.
22. Board and Status are **never** proposed — board is chosen before the chat opens, and status defaults to the board's left-most swimlane per existing idea rules.

### Security

23. **The model is never a write path.** Its output seeds a form. The user submits the form. `IdeaService`'s existing validation — active-option checks, org scoping, role checks — runs unchanged and is the sole authority on whether an idea is created. No AI endpoint may create, update, or delete an idea.
24. Client-supplied ids are not trusted at commit, exactly as today. This rule exists so a future change cannot "optimize" the confirm step away.
25. Everything retrieved is **untrusted data**, not instructions. Existing idea text, tag names, and (in v2) uploaded documents are authored by users and may contain injection attempts. Retrieved content is fenced in the prompt and explicitly labeled as data the assistant must not follow instructions from.
26. Requests are rate limited per user and per organization. The limits are configuration, not hard-coded.

    26a. *Mechanism.* A sliding window counted from the usage records of rule 28c, not a separate counter — they already carry organization, actor and timestamp, they are already written for every turn, and the tally is therefore correct across instances the moment a deployment scales past one. Keys: `Ai:RateLimit:WindowSeconds`, `Ai:RateLimit:PerUserCalls`, `Ai:RateLimit:PerOrganizationCalls`; non-positive disables, matching the budget convention.

    26b. *The per-user allowance follows the real administrator, not the impersonated user.* Otherwise a Site Admin could reset their own quota by moving between View As targets, which would make the per-user limit decorative for exactly the account that needs it least.

    26c. *Refused and failed turns count.* Rule 10's three-strikes close bounds a single conversation; this bounds the attempt to open many, so probing the boundary has to spend allowance.

    26d. *Rate limiting answers `429` with `Retry-After`, never the `503` of rule 31.* The two mean opposite things to a client — "you asked too fast, come back shortly" versus "the assistant is gone, work without it" — and a client that cannot tell them apart will either give up on a working feature or hammer a dead endpoint. The gate runs **after** the availability check: with nothing to spend there is nothing to limit.
27. Each call records an audit event: acting user, organization, board, turn count, token usage, and whether the turn was refused as out of scope. **Prompt and transcript content are not written to the audit log.**
28. API keys are never returned by any endpoint, never logged, and never sent to the client.

### Cost control (added 2026-08-16)

The deployment key is shared by every organization (rule 29), so without a ceiling any one organization — or one defect — can spend the whole budget. These rules bound that and make the spend attributable.

28a. **Daily token budget.** A configured ceiling on total tokens consumed across *all* organizations, measured on the **UTC day**. It is checked **before** each model call against the day's running total; when the total has reached the ceiling the endpoint returns `503` and the client degrades exactly as it does for an unconfigured key (rule 31). Because usage is only known after a call returns, overshoot is bounded by one in-flight turn — acceptable against a ceiling measured in hundreds of thousands of tokens. The ceiling is configuration, not hard-coded.

28b. **The budget is a runaway stop, not a forecast.** It exists so a defect or an abusive user cannot run up an unbounded bill. It does not by itself hold a monthly figure — a daily ceiling bounds the month only at thirty times itself. Watching actual spend is the job of the usage surface in 28d, not of the cap.

28c. **Per-organization usage attribution.** Every model call writes a usage record carrying the organization, the acting user, the board, the model id, the four token counts the provider reports, and the per-million rates applied at the time. **While a View As session is live the record is attributed to the impersonated user's organization** — the org whose work is being done — never to the administrator's (Site Admin has no organization). The rates are stored on the record rather than looked up at read time: usage is intended to support cost pass-through, and re-pricing history when configuration changes would corrupt a chargeback.

28d. **Usage is visible in the product.** A Site Admin can see consumption for every organization; an Org Admin can see their own organization's and no other's. This is the surface that answers "who is heavy" and "what do we bill them".

28e. Usage records carry **no prompt and no transcript content**, the same constraint rule 27 places on the audit log. They are a meter, not a log.

### Credentials (D-CREDS)

29. v1 uses a **single deployment-level key** from server configuration (user-secrets locally, App Service configuration in Azure — see `SPEC/50-azure-deployment.md`). All organizations share it. The configuration key is **`Ai:ApiKey`**, alongside the other `Ai:*` settings the cost controls read; the environment-variable form is `Ai__ApiKey`, and `docker-compose.yml` binds it from `CLAUDE_API_KEY` in `.env`. It is a secret and never belongs in `appsettings*.json`.
30. `SPEC/30-Contracts.md` already specifies `PUT`/`DELETE /api/v1/organizations/{organizationId}/ai-key` for a **per-org key overriding the deployment default**. Those contracts stay in the spec and stay **unimplemented in v1** — they are the "Org AI credentials" backlog item. This is a deliberate deferral, not an oversight: a future agent reading those contracts must not build them as part of this sprint.
31. If no key is configured, the feature is **off**: the brainstorm modal falls back to its current scripted behavior and the API returns a clear "not configured" response rather than an error. The product must work with the feature dark.

### Degradation

32. Any model failure — timeout, rate limit, refusal, malformed response — degrades to the scripted-nudge behavior for that turn, with the user's typed text preserved. The user is never blocked from reaching the create form.
33. Model calls have a request timeout. The client shows a pending state and remains cancellable.

---

## Model Configuration

Implementation detail, recorded here because it is behavior-affecting:

- **Model:** `claude-sonnet-5` (changed from `claude-opus-5`, 2026-08-16). **Why the cheaper tier is safe here:** rule 16 makes an invalid or cross-org classification *structurally impossible* — the per-request JSON Schema constrains `ideaTypeId` and `businessImpactId` to enums of the org's real active ids. Containment rests on the schema, not on model capability, so the model tier is a pure quality-versus-cost decision. The task itself — ask one follow-up question and pick from a handful of closed options — does not need frontier reasoning. The model id is configuration, so this can be re-tested against a larger model without a code change.
- **Effort:** `output_config.effort`, starting at `low`. This is the single largest cost lever available: effort defaults to `high`, and on this model thinking is on by default and bills as output at 5× the input rate. Tune upward only if question quality demands it.
- **Thinking:** adaptive (`thinking: {type: "adaptive"}`). Note that on this model thinking is on by default and `max_tokens` caps thinking *plus* response — size it accordingly. Do **not** disable thinking to save cost; lower the effort instead.
- **Structured outputs:** `output_config.format` with the per-request JSON Schema described above. Not prefill (prefill returns 400 on current models), not prose parsing.
- **Prompt caching:** the system prompt and the org catalog form a **stable prefix** — identical across every turn and every user in the organization — and carry the `cache_control` breakpoint. Only the transcript varies, and it sits after the breakpoint. Verify with `usage.cache_read_input_tokens`; a persistent zero means something volatile (a timestamp, a per-request id) has leaked into the prefix.
- The vendor is reached through an Application-layer abstraction (`IIdeaDraftModel`) implemented in Infrastructure, so Application and Domain keep no vendor dependency.

## Data Model Additions

| Entity | Change |
|---|---|
| `Organization` | `AiScopeStatement` — `character varying(500)`, nullable (Postgres; the pre-Sprint-5 wording said `nvarchar`). Org-Admin editable. Empty/null = Idea Types alone define scope. |
| `AiUsageRecord` *(new)* | One row per model call (rule 28c). Organization (**required** — the attribution axis), acting user, impersonated user, board, occurred-at, model id, the four token counts, the input/output rates applied, a key-source discriminator, and the call's outcome. Indexed on `(OrganizationId, OccurredAtUtc)` — both the budget check and every report read on that pair. |

The per-org AI key fields implied by the `ai-key` contracts are **not** added in this sprint (rule 30). `AiUsageRecord` nonetheless carries a **key-source discriminator**, always `Platform` in v1: when per-org keys do land, each org's own key can be metered separately with no backfill and no schema change to historical rows.

**Why a dedicated table rather than the audit log.** Rule 27's audit event already records token usage, but it records it as accountability prose plus metadata. The budget check in 28a runs a `SUM` over the current UTC day on *every call*, and the usage surface aggregates by organization — neither should be parsing JSON out of audit rows. Both records are written: the audit event is the accountability trail, the usage record is the queryable meter. Neither is derived from the other.

## Non-Goals

- Similar-idea dedupe / semantic search (v2, D-DEDUPE).
- Per-org API keys (D-CREDS; existing backlog item).
- UDF and tag pre-fill (D-PREFILL).
- Any general-purpose assistant surface anywhere in the product.
- AI anywhere on the write path.
- Assignee/mention assignment by the model.

## Related Specs

- `SPEC/30-Contracts.md` → "AI Idea Assist Contracts" — the endpoint contract.
- `SPEC/20-feature-ideas-and-engagement.md` — Idea rules the drafted values must satisfy.
- `SPEC/20-feature-idea-type-fields.md` — Idea Types and per-type field resolution used as retrieval context.
- `SPEC/20-feature-client-ui.md` — Comp C design direction; this feature is **comp-first** (2026-08-11 process decision) and needs a mockup for the suggestion-indicator treatment before production Blazor.
- `SPEC/40-test-strategy.md` → "AI Idea Assist" — required coverage.
- `SPEC/sprints/sprint-07-ai-idea-assist.md` — the sprint plan.
