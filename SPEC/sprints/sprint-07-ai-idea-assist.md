# Sprint 7: AI-Assisted Idea Drafting (Idea Brainstorm Chat)

**Status:** Drafting slice built 2026-08-16 (P0 backlog complete; P1 audit/rate-limiting outstanding)
**Sequence:** 7 of 8 — see `SPEC/95-next-sprints.md` for the full sequence. Starts after Sprint 6 (`archive/sprint-06-view-as.md`, complete) **and Sprint 6.5** (`sprint-06.5-bug-fixes-and-tweaks.md`), which supersedes all other sprints per the user's 2026-08-14 decision; precedes Sprint 8 (`sprint-08-azure-deployment.md`) so the first Azure deployment ships this feature and provisions its key. Scheduled 2026-08-11 at user request ("before the Azure deployment work but after the Postgres migration"). Azure was renumbered 7 → 8 to make room.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Replace the scripted nudges in `Components/IdeaBrainstormModal.razor` with a real model-backed conversation that maps the user's answers onto Idea form fields, while keeping the conversation confined to idea drafting for the caller's organization. Canonical behavior: `SPEC/20-feature-ai-idea-assist.md`. Endpoints: `SPEC/30-Contracts.md` → "AI Idea Assist Contracts".

This is a **post-MVP feature** pulled in by explicit user decision. Unlike Sprint 6 it is **not load-bearing** — the product works with the feature dark, and must continue to (rule 31).

## Decisions — all locked 2026-08-11
| ID | Decision | Locked value |
|---|---|---|
| D-SCOPE | How "in scope" is decided | **Idea Types + an Org-Admin-editable scope statement** (max 500 chars, empty = Idea Types alone) |
| D-DEDUPE | Similar-idea retrieval in v1 | **No — deferred to v2.** Structured org data only; no embeddings, no `pgvector` |
| D-CREDS | API key location | **Single deployment-level key in server config.** The per-org `ai-key` contracts stay unimplemented |
| D-PREFILL | Fields the assistant may propose | **Title, Description, Idea Type, Business Impact, Priority** — as editable suggestions. No UDFs, no tags |

**Package approval (user, 2026-08-11):** the `Anthropic` NuGet package is approved for `Collega.Infrastructure`. This is the only new dependency the sprint may add without a fresh ask.

## Capacity
| Role | Slices | Notes |
|---|---|---|
| Backend Developer | 3 | (1) `IIdeaDraftModel` abstraction + `AnthropicIdeaDraftModel` in Infrastructure + per-request schema construction; (2) `IdeaAssistService` in Application — retrieval assembly, scope gate, response validation, rate limiting, audit; API controller + `Organization.AiScopeStatement` migration; (3) **cost control — `AiUsageRecord`, the daily token budget gate, and the two usage endpoints** (see the slice below) |
| UI/UX Developer | 1 | Comp gate **passed 2026-08-16 (Direction C)** — build against `comp-c-review-11-ai-assist-c-draftstrip.html`: the `IdeaBrainstormModal` rewrite + read-only draft strip, suggestion indicators in `IdeaCreateModal`, and the scope-statement Settings page |
| QA Developer | 1 | Contract tests, scope-gate matrix, schema-constraint tests, degradation paths, org-scoping |
| Code Reviewer | 1 (mandatory) | Handles a third-party credential and an untrusted-content path — no fast-track |

## Cost control slice (added 2026-08-16)

**P0, not a nice-to-have.** The deployment key is shared by every organization, so until this lands there is no ceiling on what the feature can spend and no way to tell which organization spent it. Canonical rules: `20-feature-ai-idea-assist.md` 28a–28e; endpoints: `30-Contracts.md`.

Decisions taken with the user (2026-08-16):

| | |
|---|---|
| Model | **`claude-sonnet-5`**, down from the previously locked `claude-opus-5` — safe because rule 16 puts containment in the schema, not the model |
| Ceiling | **500,000 tokens per UTC day, global** — one pool shared across all organizations |
| At the ceiling | `503`; the client degrades to the scripted brainstorm via the path rule 31 already defines |
| Tracking | Per organization, with rates stored per row so a future per-org key (rule 30) needs no backfill |
| Surface | Settings → API; Site Admin sees every org, Org Admin sees their own |

**Known and accepted:** 500k tokens/day is a runaway stop, not a $50/month guarantee — saturated every day at a typical input/output mix it would allow roughly $99/month on Sonnet 5. Only a monthly ceiling would hard-bound the month, and that was deliberately left out of scope. The usage page is what makes real spend visible.

**Sequencing note.** This slice can be built **before** slices 1 and 2 — the entity, the budget gate and the usage endpoints stand alone. What cannot be wired until `IdeaAssistService` exists is the *call into* the gate and the recorder on each turn. Whoever builds slice 2 owns that wiring; the gate and recorder are waiting for it.

**Promoted from P2:** "Prompt-cache verification" in the backlog below is a **cost control**, not an optimization. Sonnet 5's minimum cacheable prefix is 1024 tokens — if the system prompt plus org catalog falls short of it, caching silently does nothing and per-turn input cost roughly doubles with no error to notice.

## Comp-first gate
Per the 2026-08-11 process decision, this flow gets a throwaway HTML comp in `SPEC/mockups/` for sign-off **before** production Blazor. The comp must settle: the suggestion indicator treatment on pre-filled `IdeaCreateModal` fields, the out-of-scope redirect presentation, the pending/failed turn states, and the org settings scope-statement field. Build on the locked review-09 detail-surface foundation.

### ✅ Gate passed — signed off 2026-08-16

Three directions were drawn and reviewed; **Direction C ("Draft Strip") is the build target.** The decisions are now canonical in `SPEC/20-feature-ai-idea-assist.md` → "UI Decisions (Comp-Resolved 2026-08-16)" — read them there, not here.

| Comp | Direction | Outcome |
|---|---|---|
| `mockups/comp-c-review-11-ai-assist-c-draftstrip.html` | **C · Draft Strip** | **Chosen (D-SURFACE).** Build against this one. |
| `mockups/comp-c-review-11-ai-assist-a-handoff.html` | A · Conversation → Handoff | Rejected — the user learns nothing until the handoff. Its **Settings-page treatment of the scope statement is the chosen one** (D-SCOPEUI). |
| `mockups/comp-c-review-11-ai-assist-b-livedraft.html` | B · Live Draft | Rejected — new two-pane chrome, per-field edit state, no narrow-viewport answer. |

Kept for history like Comps A and B before them; not implementation targets.

**Four things the gate settled, all now spec rules:** the surface (D-SURFACE), the teal suggestion indicator (D-SUGGEST), the scope statement's home (D-SCOPEUI), and ghost-then-drop for refused turns (D-REFUSED, spec rule 8a).

**What C buys the build:** because the strip is read-only, v1 needs **no per-field "suggested vs. user-edited" state and no overwrite rule** — the strip is a projection of the latest response, and all editing happens on the existing create form. That is the main reason it was chosen over B, and it should stay true; if a later change makes the strip editable, that state machine comes back with it.

## Sprint Backlog
| Priority | Item | Notes |
|---|---|---|
| P0 | **`IIdeaDraftModel` abstraction (Application) + Anthropic implementation (Infrastructure)** | Vendor stays out of Application/Domain per the architecture rules. Model `claude-opus-5`, adaptive thinking, structured outputs. Key read from configuration; feature is off (not broken) when absent. |
| P0 | **Per-request JSON Schema from retrieval** | `ideaTypeId` / `businessImpactId` are enums of the org's real active option ids; `additionalProperties: false`; title/description length-capped to the domain maxima. **This is the containment mechanism** — do not substitute prompt instructions for it. |
| P0 | **`IdeaAssistService` (Application)** | Assembles retrieval context scoped to the caller's org claim; applies the scope gate; validates every returned id against the retrieved set before it reaches the client; enforces the 20-turn cap and the three-strikes close. |
| P0 | **`POST /api/v1/boards/{boardId}/idea-assist/turns`** | Per the contract. Read Only refused. Rate limited per user and per org. `503` (not an error surface) when unconfigured. |
| P0 | **Client: brainstorm modal rewrite** | Swap `_NextAssistantPrompt` for the API call; render `nextQuestion`; drop out-of-scope turns from the transcript; preserve **Skip & fill manually** as an always-available, never-gated path; pending + failed-turn states. |
| P0 | **Client: pre-filled create modal** | `IdeaCreateModal` accepts the draft (title, description, idea type, business impact, priority) as editable defaults with a suggestion indicator, replacing today's `InitialDescription`-only seam. |
| P0 | **Degradation to scripted behavior** | Any timeout / rate limit / refusal / malformed response falls back to the current canned nudge for that turn with the user's text preserved. Verified by test, not by inspection. |
| P1 | **`Organization.AiScopeStatement` + settings endpoints** | `nvarchar(500)` nullable + EF migration (generated against **Postgres** — this sprint runs after Sprint 5). `GET`/`PUT .../ai-assist/settings` per contract, Org Admin + Site Admin. |
| P1 | **Org settings UI for the scope statement** | Its own Settings page (D-SCOPEUI), **not** the Organization drawer — that drawer is `[Authorize(Roles = "SiteAdmin")]` and so unreachable for the Org Admin who owns this setting. Helper text explains it narrows, and never widens, the Idea-Types boundary; shows the active Idea Types as the floor and previews the fixed redirect string. |
| P1 | **Audit + rate limiting** | Audit event per call (actor, org, board, turn count, token usage, out-of-scope outcome) — **never prompt or transcript content**. Limits are configuration. |
| P2 | **Prompt-cache verification** | Confirm the org catalog sits in a stable cached prefix — assert `cache_read_input_tokens > 0` on a second turn in a live check. A persistent zero means something volatile leaked into the prefix. |

## Explicitly out of scope
- Similar-idea dedupe / semantic search and any `pgvector` work (D-DEDUPE — v2).
- Per-org API keys. The `PUT`/`DELETE /api/v1/organizations/{organizationId}/ai-key` contracts already in `SPEC/30-Contracts.md` are **not** built here (rule 30) — a future agent reading those contracts must not treat them as this sprint's scope.
- UDF and tag pre-fill (D-PREFILL).
- Any AI on the write path, any general assistant surface, and any model-driven assignee/mention selection.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Containment implemented as prompt text instead of schema constraint | The chat becomes a general-purpose chatbot inside the product; org pays for a worse ChatGPT | Enums built from retrieval; `nextQuestion` is the only free-text output field; scope gate returns a boolean the server acts on. Code Reviewer checks specifically for this. |
| Cross-org data leak through retrieval | Critical tenant-isolation breach | Context assembled server-side from the token's org claim only; client sends no context; returned ids re-validated against the retrieved set before reaching the client; org-scoping tests mirror the existing service-level suite |
| Prompt injection via existing idea/tag text | Assistant follows attacker instructions from stored content | Retrieved content fenced and labeled as untrusted data; the model has no tool access and no write path, so the blast radius is a bad suggestion the user can see and edit |
| Deployment key leaks into logs, audit, or client | Credential compromise | Key never returned by any endpoint, never logged, never sent to the client; audit records outcomes and usage, not content; Code Reviewer verifies |
| Unbounded cost from probing or long conversations | Runaway spend | 20-turn cap, three-strikes close on out-of-scope, per-user and per-org rate limits, cached stable prefix |
| Feature failure blocks idea creation | Core flow broken by an optional feature | Degradation rule (P0) plus an always-available Skip path; the unconfigured case returns `503` and the client falls back silently |

## Definition of Done
- [x] All four decisions (D-SCOPE / D-DEDUPE / D-CREDS / D-PREFILL) locked and recorded 2026-08-11
- [x] `SPEC/20-feature-ai-idea-assist.md` written and `SPEC/30-Contracts.md` updated with the endpoints (2026-08-11, ahead of the sprint)
- [x] Comp signed off in `SPEC/mockups/` before any production Blazor
- [x] `IIdeaDraftModel` + Anthropic implementation; vendor types absent from Application and Domain
- [x] Per-request schema proven to constrain classification: a test asserts an out-of-org / inactive option id can never reach the client
- [x] Scope gate covered by a matrix of in-scope and out-of-scope turns, including the transcript-drop and three-strikes-close behaviors
- [x] Degradation path tested: timeout, rate limit, malformed response, and unconfigured key each fall back without blocking idea creation
- [x] Org-scoping tests confirm no cross-tenant retrieval
- [x] Audit events assert content is **absent** from the log
- [x] `Organization.AiScopeStatement` migration generated against Postgres and applied cleanly
- [ ] Code Reviewer has signed off (mandatory — credential handling + untrusted content)
- [ ] Sprint 8 (`sprint-08-azure-deployment.md`) updated with the key as required App Service configuration
