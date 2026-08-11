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
5. A conversation is capped at **20 user turns**. On reaching the cap the assistant stops accepting input and offers only Continue / Skip.

### Scope gate (D-SCOPE)

6. An organization has a **scope statement**: optional free text, max 500 characters, editable by Org Admin (and Site Admin acting on that org). Empty is valid and means "no narrowing beyond Idea Types."
7. In-scope is evaluated per user turn and returned by the model as `inScope`. The structural test is *"could this plausibly become an Idea of one of this organization's active Idea Types?"*; the scope statement narrows it further.
8. When `inScope` is `false`, the client renders a **fixed, server-supplied redirect string** and the offending turn is **dropped from the transcript** rather than appended. Off-topic content must not accumulate in context, because accumulated off-topic context is what drifts a constrained assistant into a general one.
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
20. Every proposed value arrives in `IdeaCreateModal` as an **editable default**, visually indicated as a suggestion. The user may change or clear any of them.
21. UDF values and tags are **out of v1 scope**. The resolved field set changes when the Idea Type changes, which makes the drafting loop materially more complex; deferred rather than half-built.
22. Board and Status are **never** proposed — board is chosen before the chat opens, and status defaults to the board's left-most swimlane per existing idea rules.

### Security

23. **The model is never a write path.** Its output seeds a form. The user submits the form. `IdeaService`'s existing validation — active-option checks, org scoping, role checks — runs unchanged and is the sole authority on whether an idea is created. No AI endpoint may create, update, or delete an idea.
24. Client-supplied ids are not trusted at commit, exactly as today. This rule exists so a future change cannot "optimize" the confirm step away.
25. Everything retrieved is **untrusted data**, not instructions. Existing idea text, tag names, and (in v2) uploaded documents are authored by users and may contain injection attempts. Retrieved content is fenced in the prompt and explicitly labeled as data the assistant must not follow instructions from.
26. Requests are rate limited per user and per organization. The limits are configuration, not hard-coded.
27. Each call records an audit event: acting user, organization, board, turn count, token usage, and whether the turn was refused as out of scope. **Prompt and transcript content are not written to the audit log.**
28. API keys are never returned by any endpoint, never logged, and never sent to the client.

### Credentials (D-CREDS)

29. v1 uses a **single deployment-level key** from server configuration (user-secrets locally, App Service configuration in Azure — see `SPEC/50-azure-deployment.md`). All organizations share it.
30. `SPEC/30-Contracts.md` already specifies `PUT`/`DELETE /api/v1/organizations/{organizationId}/ai-key` for a **per-org key overriding the deployment default**. Those contracts stay in the spec and stay **unimplemented in v1** — they are the "Org AI credentials" backlog item. This is a deliberate deferral, not an oversight: a future agent reading those contracts must not build them as part of this sprint.
31. If no key is configured, the feature is **off**: the brainstorm modal falls back to its current scripted behavior and the API returns a clear "not configured" response rather than an error. The product must work with the feature dark.

### Degradation

32. Any model failure — timeout, rate limit, refusal, malformed response — degrades to the scripted-nudge behavior for that turn, with the user's typed text preserved. The user is never blocked from reaching the create form.
33. Model calls have a request timeout. The client shows a pending state and remains cancellable.

---

## Model Configuration

Implementation detail, recorded here because it is behavior-affecting:

- **Model:** `claude-opus-5`.
- **Thinking:** adaptive (`thinking: {type: "adaptive"}`). Note that on this model thinking is on by default and `max_tokens` caps thinking *plus* response — size it accordingly.
- **Structured outputs:** `output_config.format` with the per-request JSON Schema described above. Not prefill (prefill returns 400 on current models), not prose parsing.
- **Prompt caching:** the system prompt and the org catalog form a **stable prefix** — identical across every turn and every user in the organization — and carry the `cache_control` breakpoint. Only the transcript varies, and it sits after the breakpoint. Verify with `usage.cache_read_input_tokens`; a persistent zero means something volatile (a timestamp, a per-request id) has leaked into the prefix.
- The vendor is reached through an Application-layer abstraction (`IIdeaDraftModel`) implemented in Infrastructure, so Application and Domain keep no vendor dependency.

## Data Model Additions

| Entity | Change |
|---|---|
| `Organization` | `AiScopeStatement` — `nvarchar(500)`, nullable. Org-Admin editable. Empty/null = Idea Types alone define scope. |

No other schema change in v1. The per-org AI key fields implied by the `ai-key` contracts are **not** added in this sprint (rule 30).

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
