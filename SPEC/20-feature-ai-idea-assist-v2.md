# Feature: Idea Assistant v2 — a co-author for new ideas

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** the idea assistant as a co-author of structured idea fields; specified 2026-09-27, not
>   built; supersedes v1 for all new work.
> - **Key rules:** ships only after a TypeScript `tools/prompt-eval` runner reports scope-gate and mapping
>   results; an edited field is owned, `lockedFields` output dropped server-side; skip never gated; any
>   failed turn hands off to the form, no scripted fallback; never a write path; `ai-draft`/`ai-polish` gone.
> - **Contracts:** contracts/ai-assist.md, contracts/ideas.md
> - **Decisions:** 2026-09-27 "The idea assistant is rescoped as a co-author, and ideas gain structured
>   fields"; 2026-09-13 "The AI integration is rescoped and respecified after the current batch"

**Status:** Specified 2026-09-27 as the rescope `SPEC/decisions.md` 2026-09-13 scheduled. **Not
built.** Supersedes `20-feature-ai-idea-assist.md` for all new work; that spec describes what is
live today and stays authoritative for it until this one ships. Reference rendering: comp R,
`SPEC/mockups/comp-r-portico-prototype.html` (the New Idea flow on any board or the Ideas list).
Open questions answered 2026-09-27; see "Resolved questions" at the end.

## Why this exists

v1 drafts a title, a description and three classifications, but the idea is still one block of
prose, and what a reviewer needs (what is wrong, what we would do, why it is worth doing) is mixed
together or missing. v2 changes two things:

1. **The idea itself gains structure.** Problem, Proposed solutions and Impact rationale become
   first-class fields (`20-feature-ideas-and-engagement.md` rule 2, `30-Contracts.md` idea
   contracts). The assistant exists to fill them well.
2. **The assistant works with the person, not only for the form.** At minimum it maps free text
   onto fields and asks for what is missing. Beyond that it brainstorms solutions, offers a sharper
   problem statement, and suggests measurable rationales, each a suggestion the person accepts or
   ignores.

## Goals

1. **Every submitted idea states a problem, at least one proposed solution, and a business case.**
2. **Mapping first.** Anything typed that fits a field lands in that field, visibly.
3. **Interview for the gaps**, one question at a time, in a fixed order.
4. **Brainstorm on request**, never on the person's behalf: suggestions are offered, never applied
   silently.
5. **The form is always the source of truth and always reachable**: skip at any time; any
   assistant failure hands off to the form with everything captured so far.
6. Unchanged from v1: stay on topic, stay grounded in the organization's own options, and **never
   become a write path**. The person submits; existing validation authorizes the write.

## Non-goals (this spec)

- **Refining existing ideas** (editing with the assistant): separate spec; `decisions.md`
  2026-09-13 explains why it must not be conflated with drafting.
- **Ingestion** of pasted documents, transcripts or backlogs (`SPEC/ideas-inbox.md`).
- **Similar-idea retrieval / dedupe** (v2 of D-DEDUPE, needs embeddings).
- **Per-organization API keys** (tracker rule 30 stands).

## Prerequisite: measurement

`decisions.md` 2026-09-13: "A rescope that adds AI surface area without restoring measurement is
adding unmeasured security-relevant behaviour." **v2 does not ship until a TypeScript runner for
`tools/prompt-eval` exists** and reports at least scope-gate precision/recall and field-mapping
accuracy over the corpus, extended with v2 cases (structured fields, brainstorm turns, locked
fields). The runner is its own slice, lands before the v2 prompt is enabled, and is specified in
`20-feature-prompt-eval-runner.md`.

## Surface

- **Where:** *Add New Idea* on the Ideas list and on a board opens the drawer in **create mode, wide**:
  `clamp(720px, 62vw, 1100px)`, still an overlay (`20-feature-client-ui.md` "List and detail
  pattern"). Assistant is the left pane (~42%), form the right; on narrow viewports they stack,
  chat above form.
- **Skip is never gated** (v1 rule 3 carried): *Fill out manually* in the assistant header and
  *Skip the assistant and fill out the form* under the composer each collapse the chat, narrow the
  drawer to normal width, and keep every value already in the form. *Use the assistant* in the
  footer brings it back with the conversation intact.
- **Availability** is v1 rules 32a–32c unchanged: the client reads `GET /ai-assist/availability`
  once per page load; when unavailable, *Add New Idea* opens the form directly with the rule 32c
  notice.

## Fields the assistant may fill

Supersedes v1 D-PREFILL.

| Field | Filled from | Notes |
|---|---|---|
| Title | the first clause of the first description of the problem | ≤ 150 characters |
| Problem | the person's description of what is wrong | |
| Proposed solutions | the person's own proposals, or accepted brainstorm suggestions | a list; each accepted suggestion is one item |
| Impact rationale | the person's answer, or an accepted measurable suggestion | |
| Business impact | explicit level words, else inferred (safety → Critical; time, cost, downtime → High) | an active option id |
| Idea type | explicit, else inferred from the kind of change | an active option id |
| Priority | urgency cues only ("urgent", "asap") | otherwise left at the default |
| Tags | matches against the organization's existing tag vocabulary | never invents a tag |
| Custom fields | values for the fields the chosen Idea Type carries: numbers, dropdown options, names | only fields visible for that type; option values must be real option ids |
| Summary (Description) | drafted from Problem + Proposed solutions | optional summary (Q2) |

Never proposed: Board, Status, Assignees, Due date. Assignees and dates are the person's call;
Board and Status come from where *Add New Idea* was pressed.

## Suggested vs owned

- A value the assistant writes is **Suggested**: `✦ Suggested` beside the label, field tinted in the
  theme's **suggestion hue** (`--suggest-tint`, border `--suggest`), distinct from the accent so a
  suggestion never reads as "selected" (Q5; carries v1 D-SUGGEST). It animates once when filled
  (skipped under reduced motion).
- **Once the person edits a field it is theirs.** The mark clears and the assistant never
  overwrites it for the rest of the conversation. When a later turn would have changed it, the reply
  says so ("I kept your edit to Problem").
- The client sends the owned field names with every turn (`lockedFields`); the server drops any
  model output for them. Enforced server-side, not only in the UI.

## Conversation

1. **Opening:** one greeting saying what will happen, plus 2–3 starter prompts drawn from the
   organization's recent idea titles or, failing that, fixed examples.
2. **Every turn:** the model returns the structured turn object (below); the server validates it,
   removes locked fields, and returns what changed. The UI fills changed fields, then shows the
   reply with a *Filled in: …* line naming them.
3. **Interview order** for the next question: Problem → Proposed solutions → Impact rationale →
   Business impact → Idea type → required custom fields of that type. Title is asked last, only
   if still empty. One question per turn.
4. **Brainstorm offers** appear as chips on the relevant question:
   - at *Proposed solutions*: up to 3 solution ideas grounded in the problem (multi-select; each
     accepted chip becomes a list item), plus *Sharpen the problem first*;
   - *Sharpen the problem*: one rewrite of Problem, offered as a chip, applied only if chosen;
   - at *Impact rationale*: up to 3 measurable rationales; after completion, *Make the rationale
     measurable* offers them again.
5. **Completion:** when every required field is filled the assistant says so and offers *Review
   and create*, which validates the form and moves focus to *Create idea*. It does not submit.
6. **Cap, scope gate, refusal UI and cancellable pending state** are v1 rules 5/5a, 6–10, 8a and 33
   unchanged (20 transcript entries; ghost-then-drop; three consecutive off-topic turns close the
   chat to skip-only).

## Failure and hand-off

Carries v1 rules 32 and 32b, tightened because v2 is the only path to the new fields:

- Any failure on any turn (timeout, rate limit, refusal, malformed output, `503`) ends the
  conversation for this idea and **hands off to the form** with the notice "AI assist is unavailable
  right now. Everything captured so far is filled in; finish the idea here." No scripted-nudge
  fallback in v2: it would keep the person in a chat that can no longer fill the form.
- **Nothing typed is lost.** Earlier successful turns' draft is already in the form. The failing
  turn's text is placed by the client, without a model call: into the field the assistant had just
  asked about when that field is empty and not owned, else into Problem when Problem is empty, else
  appended to Problem on a new line. Title, when empty, takes the text's first clause.
- `429` keeps its v1 meaning (`Retry-After`), shown as "Too many requests; try again in N seconds"
  with the form still usable. It does not end the conversation.

## Contract changes

`POST /api/v1/boards/{boardId}/idea-assist/turns` (v1 contract in `30-Contracts.md` "AI Idea
Assist") changes as follows; everything else about it stands.

Request adds:
- `draft` extends to the full v2 field set: `title`, `problem`, `proposedSolutions` (string array),
  `impactRationale`, `businessImpactId`, `ideaTypeId`, `priority`, `tagNames`, `fieldValues`
  (`[{ fieldDefinitionId, value }]`), `description`.
- `lockedFields` string array: field names the person owns. Custom fields are named
  `fieldValues.<fieldDefinitionId>`.
- `step` optional: the field the previous assistant turn asked about.

Response replaces `draft` with:
- `changes`: only the fields this turn set, same shapes as the request draft. Never contains a
  locked field or an id outside the organization's active options (schema enum, v1 rule 15).
- `suggestions` optional: `{ solutions?: string[≤3], problemRewrite?: string, rationales?: string[≤3] }`.
- `nextStep`: the field the reply asks about, or `done`.
- `nextQuestion`, `inScope`, `conversationClosed`, `turnsRemaining` as v1.

The JSON Schema sent to the model is built per request as in v1 rules 15–18, now including the
custom fields of the draft's Idea Type (types and option-id enums).

`ai-draft` and `ai-polish` (specified, never built) are **withdrawn**: v2's turn endpoint covers
extraction, and polishing belongs to the refinement spec.

## Acceptance criteria

- [ ] *Add New Idea* opens the wide create drawer with assistant and form side by side; with the
      assistant unavailable it opens the normal-width form with the 32c notice.
- [ ] A first message describing a problem fills Title and Problem, and any impact, type, tag and
      custom-field value it states, each marked Suggested, and the reply names them.
- [ ] The assistant asks for the next missing required field in the specified order.
- [ ] Solution chips add list items; *Sharpen the problem* and measurable rationales apply only
      when chosen.
- [ ] A field the person edited is never changed by a later turn, and the reply says it was kept;
      the server drops model output for locked fields.
- [ ] *Fill out manually* at any point keeps every value; *Use the assistant* restores the chat.
- [ ] A failed turn hands off to the form with prior values and the failing turn's text placed as
      specified.
- [ ] Off-topic, cap and cancel behave as v1.
- [ ] The prompt-eval runner reports v2 mapping accuracy and scope-gate results before enablement.

## Resolved questions (2026-09-27)

- **Q1 — existing ideas.** Required on every create and save; the migration backfills older ideas
  (`20-feature-ideas-and-engagement.md` rule 2a).
- **Q2 — Description.** Kept as an optional summary, drafted by the assistant.
- **Q3 — solution-list size.** 1 to 5 items.
- **Q4 — an archived board's page.** Opens read-only with an *Archived* banner
  (`20-feature-boards-and-statuses.md` rule 13).
- **Q5 — the Suggested colour.** A per-theme suggestion hue distinct from the accent, plus the label.
- **Edit rights.** Problem, Proposed solutions and Impact rationale are editable by the idea's author
  or an in-scope Org Admin (Site Admin through View As), the same rule as Description
  (`20-feature-ideas-and-engagement.md` rule 2a).
