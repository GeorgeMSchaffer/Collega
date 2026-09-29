# Feature: AI-Assisted Idea Drafting (Idea Brainstorm Chat)

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** v1 brainstorm chat, built and live; authoritative for it until v2 ships, superseded for new
>   work by `20-feature-ai-idea-assist-v2.md`.
> - **Key rules:** only from New Idea (1); 20 transcript entries (5, 5a); off-topic turns dropped, three
>   close the chat (8, 10); per-request schema enums of the org's ids (15-17); never a write path (23);
>   `429` not `503` for rate limits (26d); daily budget (28a); one deployment key, no per-org keys (29-30).
> - **Contracts:** contracts/ai-assist.md
> - **Decisions:** 2026-09-13 "The AI integration is rescoped and respecified after the current batch";
>   2026-09-27 "The idea assistant is rescoped as a co-author, and ideas gain structured fields"

**Status:** Post-MVP. Scheduled as **Sprint 7** (`SPEC/sprints/sprint-07-ai-idea-assist.md`), after the Postgres migration (Sprint 5) and View As (Sprint 6), before Azure deployment (Sprint 8). Design decisions locked 2026-08-11 by user interview; `Anthropic` NuGet package approved by the user the same day.

> **Superseded for new work by `20-feature-ai-idea-assist-v2.md` (2026-09-27)**, the rescope the next
> paragraph scheduled. Everything below still describes what is built and live and stays
> authoritative for it until v2 ships; no new work starts from this file.
>
> **A rescope is scheduled (`SPEC/decisions.md` 2026-09-13).** What is specified below is built, live,
> and stays, but it covers exactly one job: draft one new idea, in a chat, from a standing start. **No
> further AI feature work starts on this spec**: the integration is rescoped and respecified after the
> current batch of work. Ingestion and refinement of existing ideas have no spec, and prompt changes
> are currently unmeasurable because F6 deleted the evaluation runner. Read that entry before
> building anything AI-shaped.

## Overview

The Blazor client's brainstorm modal (`IdeaBrainstormModal`, deleted with that client in F6) fronted idea creation on the Ideas list with a ChatGPT-style chat. It was **scripted**: three canned assistant nudges cycle, and the user's messages are handed to `IdeaCreateModal.InitialDescription` as a seed description. This feature replaces the nudges with a model-backed conversation that also **maps the user's answers onto Idea form fields**, confined to idea drafting for this organization.

Two mechanisms, two jobs; conflating them is the failure mode this spec prevents:

- **Grounding**: retrieval of the organization's own structured data, so the assistant speaks this org's vocabulary and maps "cut the approvals down to one step" onto a real `IdeaTypeId` and `BusinessImpactId` instead of inventing values.
- **Containment**: keeping the conversation on idea drafting. **Retrieval does not do this**: a retrieval-grounded model answers off-topic questions from its own weights when retrieval finds nothing relevant. Containment comes from constraining the model's *output shape*, plus an explicit scope gate.

---

## Design Decisions (Interview-Resolved 2026-08-11)

| ID | Decision | Resolution |
|---|---|---|
| **D-SCOPE** | How is "in scope" decided? | **Idea Types + an Org-Admin-editable scope statement.** Structural boundary = "could this become an Idea of one of this org's active Idea Types?"; an Org Admin may add a free-text narrowing statement (e.g. *"business process improvement only"*). Per-org, retunable without a deploy. |
| **D-DEDUPE** | Does v1 retrieve similar existing ideas? | **No — deferred to v2.** v1 retrieves structured org data only: no embeddings, no `pgvector`, no dependency on the Sprint 5 migration beyond running after it. |
| **D-CREDS** | Where does the API key live? | **Single platform-level key in server configuration/secrets** for v1. The per-org override endpoints in `SPEC/contracts/organizations.md` stay **unimplemented** — see "Credentials" below. |
| **D-PREFILL** | Which Idea fields may the assistant pre-fill? | **Title, Description, Idea Type, Business Impact, Priority**, as editable suggestions. User-Defined Field values and tag suggestions are **out of v1 scope**. |

## UI Decisions (Comp-Resolved 2026-08-16)

Locked from the comp round, `SPEC/mockups/comp-c-review-11-ai-assist-{a-handoff,b-livedraft,c-draftstrip}.html`. **Direction C is the built one**; A and B are rejected alternatives kept for history, like Comps A and B before them.

| ID | Decision | Resolution |
|---|---|---|
| **D-SURFACE** | Where does drafting happen? | **Direction C — "Draft Strip".** One 720px surface at a time (chat modal → create modal), `CreateModalShell` unchanged, plus a slim **read-only** strip between transcript and composer showing what is classified so far. Rejected: A (no strip; the user learns nothing until the handoff) and B (two-pane editable sheet; needs new chrome and per-field suggested-vs-edited state, and has no narrow-viewport answer). |
| **D-SUGGEST** | How is a suggested value marked? | **Teal**, never the indigo accent: indigo already means "active/selected" in Comp C and a suggestion is neither. On the form: a `Suggested` chip beside the label, a tinted field, a 3px left border. On the strip: the same teal as pills. |
| **D-SCOPEUI** | Where does an Org Admin edit the scope statement? | **A dedicated Settings page**, not the Organization detail drawer, because the Blazor client's Settings page that held the drawer was Site-Admin-only, so the drawer was unreachable for the Org Admin who owns this setting (rule 6). |
| **D-REFUSED** | What does the user see when a turn is refused? | **Ghost-then-drop.** The message renders greyed and struck through for one beat with the redirect note beneath, then disappears. Rejected: never rendering it — cleaner, but typed input vanishes unacknowledged and reads as a bug. |

---

## Problem Statement

The scripted chat collects prose only. What kind of idea it is, who it affects and how urgent it is must be re-entered by hand as classification on the create form, and the org's Idea Types, Business Impacts and required per-type fields are invisible during the conversation that should shape them. And a naive chat box in a business tool becomes a general-purpose chatbot: users ask unrelated questions, it answers, and the org pays inference costs for a worse ChatGPT inside its idea tracker.

## Goals

1. **Draft faster.** The chat ends with a title, a description and a correct classification, not just prose.
2. **Classify correctly.** Suggested `IdeaTypeId` / `BusinessImpactId` are always real, active options in the caller's organization — never invented, never from another org.
3. **Stay on topic.** Off-topic turns are refused consistently and cheaply, with a boundary each organization tunes.
4. **Never become a write path.** The assistant drafts, the user confirms, and existing Application-layer validation alone authorizes a write.

---

## Rules

### Entry and conversation

1. The assistant is reachable **only** from the New Idea flow on the Ideas list and board (the existing `IdeaBrainstormModal`). No general chat surface, no persistent chat history across sessions, no other entry point.
2. Each user turn produces exactly one model call. The model returns a structured object (see "Response contract"); the client renders its `nextQuestion` as the assistant bubble.
3. The user may leave at any time via **Skip & fill manually**, which opens the create modal with whatever is drafted (possibly nothing). This path must remain available and never be gated on a successful model call.
4. **Continue to idea form** hands the drafted fields to `IdeaCreateModal` as pre-filled, fully editable values. Nothing is committed at this point.
5. A conversation is capped at **20 transcript entries** (user and assistant combined), the cap `30-Contracts.md` states for the request body. A transcript alternates roles and must end with a user entry (rule 2), so the largest valid request carries 19 entries and the practical ceiling is **10 user turns**. At the cap the assistant stops accepting input and offers only Continue / Skip.

    5a. This rule once read "20 user turns", contradicting the contract's "max 20 entries" and describing a conversation twice as long. Resolved 2026-08-17 for the contract: the cap counts **entries**, not user turns. A refused turn is dropped from the transcript (rule 8), so it does not consume the budget.

### Scope gate (D-SCOPE)

6. An organization has a **scope statement**: optional free text, max 500 characters, editable by Org Admin (and Site Admin acting on that org). Empty is valid and means "no narrowing beyond Idea Types."
7. In-scope is evaluated per user turn and returned by the model as `inScope`. The structural test is *"could this plausibly become an Idea of one of this organization's active Idea Types?"*; the scope statement narrows it.
8. When `inScope` is `false`, the client renders a **fixed, server-supplied redirect string** and the turn is **dropped from the transcript**, not appended. Off-topic content must not accumulate in context, because accumulated off-topic context is what drifts a constrained assistant into a general one.

    8a. *Presentation (D-REFUSED):* the refused message shows **greyed and struck through for one beat**, with the redirect as a system note (not an assistant bubble, so refusals never read as conversation), then is removed. It is never sent in the next turn's history; the ghost is client-side only. The draft strip is annotated **unchanged**, since a refused turn moves nothing.
9. The scope statement is org configuration, not user input to the instruction channel: the server places it in the system prompt. Its author, an Org Admin, is a trusted operator; it is still length-capped and never concatenated with end-user text.
10. Three consecutive out-of-scope turns close the chat with the redirect message and the Skip-to-form option, bounding the cost of probing the boundary.

### Grounding / retrieval

11. Retrieved context is assembled **server-side**, scoped to the caller's organization from their token claims. The client never sends context, a prompt, a model name, or a scope statement.
12. v1 retrieval set, all from existing persistence — **plain EF/SQL queries, no vector search**:
    - active `IdeaType` options, with each type's resolved field set (`IdeaTypeFieldResolver`) as *context for question-asking only*; v1 does not fill those values (D-PREFILL);
    - active Business Impact options;
    - the target board's statuses;
    - the org's existing tags (vocabulary only; v1 does not suggest tags);
    - org members (as exposed by `GET /api/v1/organizations/{organizationId}/members`), to recognize names; v1 does not assign or mention.
13. Retrieval is **not** the containment mechanism. No rule here may be restated as "the retrieved context will keep it on topic."
14. **v2 (not this sprint):** similar-idea retrieval for dedupe ("this looks like idea #214"), where embeddings earn their keep, and optional org playbook/SOP documents. Both wait on `pgvector` post-Sprint-5.

### Containment via response shape

15. The model is called with **structured outputs** (`output_config.format`, JSON Schema). No free-form text channel: the only user-visible string it can emit is `nextQuestion`, so there is no field for a limerick, a recipe or a general-knowledge answer.
16. The JSON Schema is built **per request** from the retrieval result, so `ideaTypeId` and `businessImpactId` are `enum`s of that organization's real, active option ids. An invalid or cross-org classification is **structurally impossible**, not prompt-discouraged.
17. `additionalProperties` is `false` and every enum is closed. Schema construction is server-side only.
18. Suggested `title` and `description` are length-capped in the schema to `Idea.TitleMaxLength` (150) and `Idea.DescriptionMaxLength` (4000), so a suggestion never exceeds what the domain accepts.

### Pre-fill (D-PREFILL)

19. The assistant may propose `title`, `description`, `ideaTypeId`, `businessImpactId`, `priority`. All optional in the response; an early turn may return only `nextQuestion`.
20. Every proposed value arrives in `IdeaCreateModal` as an **editable default**, marked as a suggestion (D-SUGGEST: teal chip, tinted field, 3px left border). The user may change or clear any of them.

    20a. *During the conversation (D-SURFACE):* Idea Type, Business Impact and Priority also show live on a **read-only** draft strip above the composer. Unchosen values render explicitly ("Priority not set yet"), so "the assistant chose nothing" is distinguishable from "the assistant hasn't got there". The strip projects the latest response and is **never editable**; editing happens on the create form, which keeps per-field suggested-vs-user-edited state out of v1.
21. UDF values and tags are **out of v1 scope**: the resolved field set changes with the Idea Type, which makes the drafting loop materially more complex; deferred rather than half-built.
22. Board and Status are **never** proposed: the board is chosen before the chat opens, and status defaults to the board's left-most swimlane per existing idea rules.

### Security

23. **The model is never a write path.** Its output seeds a form; the user submits it. `IdeaService`'s existing validation (active-option checks, org scoping, role checks) runs unchanged and alone decides whether an idea is created. No AI endpoint may create, update, or delete an idea.
24. Client-supplied ids are not trusted at commit, as today. This rule exists so a future change cannot "optimize" the confirm step away.
25. Everything retrieved is **untrusted data**, not instructions. Idea text, tag names and (in v2) uploaded documents are user-authored and may carry injection attempts, so retrieved content is fenced in the prompt and explicitly labeled as data the assistant must not follow instructions from.
26. Requests are rate limited per user and per organization. The limits are configuration, not hard-coded.

    26a. *Mechanism.* A sliding window counted from rule 28c's usage records, not a separate counter: they already carry organization, actor and timestamp, are written for every turn, and so count correctly across instances once a deployment scales past one. Settings: `rateLimitWindowSeconds`, `perUserCallsPerWindow`, `perOrganizationCallsPerWindow` in `DEFAULT_AI_USAGE_LIMITS` (`packages/application/src/ai/models.ts`; the .NET stack read them as `Ai:RateLimit:*` configuration); non-positive disables, matching the budget convention.

    26b. *The per-user allowance follows the real administrator, not the impersonated user.* Otherwise a Site Admin could reset their quota by moving between View As targets, which would make the per-user limit decorative for exactly the account that needs it least.

    26c. *Refused and failed turns count.* Rule 10 bounds one conversation; this bounds opening many, so probing the boundary spends allowance.

    26d. *Rate limiting answers `429` with `Retry-After`, never the `503` of rule 31.* They mean opposite things to a client — "you asked too fast, come back shortly" versus "the assistant is gone, work without it" — and a client that cannot tell them apart either abandons a working feature or hammers a dead endpoint. The gate runs **after** the availability check: with nothing to spend there is nothing to limit.
27. Each call records an audit event: acting user, organization, board, turn count, token usage, and whether the turn was refused as out of scope. **Prompt and transcript content are not written to the audit log.**
28. API keys are never returned by any endpoint, never logged, and never sent to the client.

### Cost control (added 2026-08-16)

The deployment key is shared by every organization (rule 29), so without a ceiling one organization — or one defect — can spend the whole budget. These rules bound that and make spend attributable.

28a. **Daily token budget.** A configured ceiling on total tokens across *all* organizations per **UTC day**, checked **before** each model call against the day's running total. At the ceiling the endpoint returns `503` and the client degrades as for an unconfigured key (rule 31). Usage is known only after a call returns, so overshoot is bounded by one in-flight turn — acceptable against a ceiling of hundreds of thousands of tokens. The ceiling is configuration, not hard-coded.

28b. **The budget is a runaway stop, not a forecast.** It stops a defect or an abusive user running up an unbounded bill. It does not by itself hold a monthly figure — a daily ceiling bounds the month only at thirty times itself. Watching actual spend is the job of 28d's usage surface, not the cap.

28c. **Per-organization usage attribution.** Every model call writes a usage record: organization, acting user, board, model id, the four token counts the provider reports, and the per-million rates applied at the time. **While a View As session is live the record is attributed to the impersonated user's organization** (the org whose work is done), never the administrator's (Site Admin has no organization). Rates are stored on the record, not looked up at read time, because usage supports cost pass-through and re-pricing history on a configuration change would corrupt a chargeback.

28d. **Usage is visible in the product.** A Site Admin sees consumption for every organization; an Org Admin sees their own organization's and no other's. This answers "who is heavy" and "what do we bill them".

28e. Usage records carry **no prompt and no transcript content**, as rule 27 requires of the audit log. They are a meter, not a log.

### Credentials (D-CREDS)

29. v1 uses a **single deployment-level key** from server configuration (`.env` locally, the API project's environment variables on Vercel — see `SPEC/50-vercel-deployment.md` §6), shared by all organizations. The configuration key is **`ANTHROPIC_API_KEY`** (user decision, 2026-08-25, replacing the vendor-neutral `Ai:ApiKey` — rule 29a). It has no `:` segment, so the configuration key and the environment-variable form are the **same string**, with no `__` mapping to get wrong. It is a secret and never belongs in a committed file; `.env.example` lists it empty. The cost controls' other settings are constants in `DEFAULT_AI_USAGE_LIMITS`, not configuration.

    29a. **The key name is provider-specific, deliberately.** It was `Ai:ApiKey` so a provider change would be a spec-and-adapter change, not a configuration change. Reversed 2026-08-25: `ANTHROPIC_API_KEY` is what the vendor's tooling, SDKs and shells already export, so the neutral name made every developer and deployment keep a redundant copy of the same secret. A second provider gets its own provider-named key, not a shared neutral one. **API contract fields stay vendor-neutral** (`aiApiKey`, `aiKeyConfigured`); only the server-side configuration key changed, so no client contract breaks.
30. `SPEC/contracts/organizations.md` specifies `PUT`/`DELETE /api/v1/organizations/{organizationId}/ai-key` for a **per-org key overriding the deployment default**. Those contracts stay in the spec and stay **unimplemented in v1** — the "Org AI credentials" backlog item. A deliberate deferral: a future agent must not build them as part of this sprint.
31. If no key is configured, the feature is **off**: the turn endpoint answers `503` — the same undifferentiated `503` as an unavailable provider or an exhausted daily budget (`contracts/ai-assist.md`) — and `GET /ai-assist/availability` reports `false`, so the client degrades (rules 32–32c) instead of surfacing an error. The product must work with the feature dark. *Corrected 2026-09-29 (`SPEC/decisions.md` 2026-09-29, "Spec contradictions resolved"): this said the API returns a clear "not configured" response rather than an error.*

### Degradation

32. Any model failure — timeout, rate limit, refusal, malformed response — degrades to the scripted-nudge behavior for that turn, with the user's typed text preserved. The user is never blocked from reaching the create form.

    32a. **Pre-check (added 2026-08-17, user decision).** `+ New idea` must not open the chat when the assistant is known to be unavailable: a scripted chat the user must escape is worse than the plain form. The client reads `GET /ai-assist/availability` once per page load and caches it; when it reports `false`, the create **drawer** opens directly and the chat is skipped. The endpoint returns a bare boolean and never distinguishes unconfigured from provider-down from budget-exhausted, for the same reason the turn endpoint's `503` does not (rule 31).

    32b. **First-turn bailout.** The pre-check is a page-load snapshot and cannot see the daily budget exhausted mid-session (rule 28a), the likeliest real cause. So a `503` on the **first** turn hands off to the create drawer immediately, carrying the user's typed text, instead of scripted nudges. Scripted nudges remain the fallback for a `503` on any *later* turn, where a sudden surface change would lose the user's place. The two mechanisms cover different failures; neither replaces the other.

    32c. **Say why the form appeared (added 2026-08-18, user decision).** Both paths above are otherwise silent, which reads as the feature broken or missing rather than temporarily unavailable. So whenever the create drawer opens *because* the assistant is unavailable (the 32a skip or the 32b bailout), it shows a flash message that AI assist is currently unavailable and the idea can be filled in manually. It is **informational, not an error** (nothing the user did failed and the form works normally); it **names no cause**, for the same reason 32a's endpoint returns a bare boolean and the turn endpoint returns an undifferentiated `503` (rule 31); it appears **only** on the unavailable paths, never on a normal open or after a completed chat; and it never blocks the form, gates submission, or takes focus.
33. Model calls have a request timeout. The client shows a pending state and remains cancellable.

### Managed prompt (added 2026-08-17, user decision)

34. The system prompt and the two fixed redirect strings (rules 8 and 10) are **deployment configuration editable by a Site Admin**, not compiled constants. Site-Admin scope for the same reason as the API key (rule 29): one deployment-wide setting, not organization content, so it does not conflict with the rule that a Site Admin touches organization content only through View As.

35. What is editable is a **template**, not the finished prompt. Two placeholders are **required**; a save omitting either is rejected:

    - `{{ORGANIZATION_CATALOG}}` — the server renders the fenced, escaped catalog here (rules 11–12, 25).
    - `{{SCOPE_STATEMENT}}` — the server renders the fenced scope block, or nothing when the organization has none. Required because omitting it would silently disable every organization's scope statement (rule 6) with no error.

    **The escaping is not editable.** `Fence()` and the assembly of `<organization_data>` stay in code, so no edit can reintroduce the fence-closing defect the Sprint 7 review found. Residual risk: an admin **can** delete the prose telling the model to distrust that block — the escaping survives, the instruction does not. Rule 37 exists for that.

36. Versions are **immutable and appended**. Publishing writes a new version and moves the active pointer; restoring publishes a **copy** of the earlier version as a new one, never mutating history. With no active version the built-in default compiled into the product is used, so an empty table is the normal initial state and "reset to default" is deactivating all. Publishing writes an audit event with actor and version number — **never the body** (rule 27), which already lives in the version table.

37. Publishing offers **advisory safety probes**: the injection, fence-closing and off-topic prompts run against the draft and the outcomes show before publish. They never block publishing. They exist because the failure mode here is not obvious: removing the scope instructions measurably *improves* classification while weakening refusal, so the dangerous edit is the one that feels like an improvement.

    37a. Probes run against a **synthetic catalog**, never a real organization's: a Site Admin has no organization, borrowing one would pick a winner arbitrarily and expose its private option names to a platform admin, and synthetic makes a probe run reproducible.

    37c. **How much the probes prove — measured 2026-08-17, and less than they look.** Removing the scope sentence from the default template still returned **3 of 3 refused**, identical to the unmodified default. Two reasons, both worth knowing before trusting a green run: the `inScope` **schema description independently defines scope**, so the prompt sentence is not load-bearing alone (the strongest argument yet for the deferred schema-description work); and three probes is low-powered for an effect the playground measured at roughly 7%. Treat a passing run as *"nothing is grossly broken"*, never *"this edit is safe"*. Real measurement is over a corpus, with repeats — `tools/prompt-eval` holds that corpus, but its runner was deleted with its stack (slice F6), so that measurement cannot currently be taken. Read `tools/prompt-eval/README.md` before relying on a probe run.

    37b. *Metering.* The global daily budget gate (28a) applies, but probes are **not** per-organization rate limited and **not** written to the usage meter: both need an organization to attribute spend to, and `AiUsageRecord.OrganizationId` is deliberately required (28c). Exposure is bounded by construction instead: a fixed three prompts, Site Admin only, no loop. A failed probe call is reported as unavailable, never as a passed probe — turning an outage into a clean bill of health is the one wrong answer this surface can give.

38. Editing the prompt changes the cached stable prefix, so the provider's prompt cache misses until it re-warms (rule 28's caching note). A one-off cost per publish, not a regression; the editing surface says so.

---

## Model Configuration

Implementation detail, recorded because it affects behavior:

- **Model:** `claude-sonnet-5` (changed from `claude-opus-5`, 2026-08-16). **Why the cheaper tier is safe:** rule 16 makes an invalid or cross-org classification *structurally impossible* (the per-request JSON Schema enums the org's real active ids for `ideaTypeId` and `businessImpactId`). Containment rests on the schema, not model capability, so the tier is a pure quality-versus-cost choice, and asking one follow-up question and picking from a few closed options does not need frontier reasoning. The model id is configuration, so a larger model can be re-tested without a code change.
- **Effort:** `output_config.effort`, starting at `low` — the largest cost lever: effort defaults to `high`, and on this model thinking is on by default and bills as output at 5× the input rate. Tune upward only if question quality demands it.
- **Thinking:** adaptive (`thinking: {type: "adaptive"}`). On this model thinking is on by default and `max_tokens` caps thinking *plus* response, so size it accordingly. Do **not** disable thinking to save cost; lower the effort instead.
- **Structured outputs:** `output_config.format` with the per-request JSON Schema above. Not prefill (prefill returns 400 on current models), not prose parsing.
- **Prompt caching:** the system prompt and org catalog form a **stable prefix**, identical across every turn and user in the organization, and carry the `cache_control` breakpoint; only the transcript varies, after it. Verify with `usage.cache_read_input_tokens`: a persistent zero means something volatile (a timestamp, a per-request id) leaked into the prefix.
- The vendor is reached through an Application-layer abstraction (`IIdeaDraftModel`) implemented in Infrastructure, so Application and Domain carry no vendor dependency.

## Data Model Additions

| Entity | Change |
|---|---|
| `Organization` | `AiScopeStatement` — `character varying(500)`, nullable (Postgres; the pre-Sprint-5 wording said `nvarchar`). Org-Admin editable. Empty/null = Idea Types alone define scope. |
| `AiUsageRecord` *(new)* | One row per model call (rule 28c). Organization (**required** — the attribution axis), acting user, impersonated user, board, occurred-at, model id, the four token counts, the input/output rates applied, a key-source discriminator, and the call's outcome. Indexed on `(OrganizationId, OccurredAtUtc)`, the pair the budget check and every report read on. |

The per-org AI key fields implied by the `ai-key` contracts are **not** added in this sprint (rule 30). `AiUsageRecord` still carries a **key-source discriminator**, always `Platform` in v1, so per-org keys can later be metered separately with no backfill and no schema change to historical rows.

**Why a dedicated table rather than the audit log.** Rule 27's audit event records token usage as accountability prose plus metadata, but 28a runs a `SUM` over the current UTC day on *every call* and the usage surface aggregates by organization — neither should parse JSON out of audit rows. Both are written: the audit event is the accountability trail, the usage record the queryable meter; neither is derived from the other.

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
- `SPEC/20-feature-client-ui.md` — Comp C design direction; this feature is **comp-first** (2026-08-11 process decision) and needed a mockup for the suggestion-indicator treatment before production UI.
- `SPEC/40-test-strategy.md` → "AI Idea Assist" — required coverage.
- `SPEC/sprints/sprint-07-ai-idea-assist.md` — the sprint plan.
