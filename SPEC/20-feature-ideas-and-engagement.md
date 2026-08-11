# Feature: Ideas and Engagement

## Outcome
Users can create, discuss, organize, and support ideas within their organization.

## Board Enhancement Decisions (Interview-Resolved 2026-08-04)
| Decision | Resolution |
|---|---|
| Field model | `Priority` remains unchanged. `Idea Type` and `Business Impact` are dedicated, required, organization-scoped configurable fields. |
| Initial values | Idea Type: `Continuous Improvement`, `Process Revision`. Business Impact: `Low` (`#16A34A`), `Medium` (`#2563EB`), `High` (`#D97706`), `Critical` (`#DC2626`). |
| Defaults | The first active option by admin-controlled sort order is the default for new ideas and CSV rows that omit the field. Existing ideas retain their assigned values when options are reordered. |
| Existing idea migration | Existing ideas are assigned `Continuous Improvement` and `Medium`. |
| Option lifecycle | Options are soft-deleted. Existing ideas retain archived values, archived values cannot be newly selected, and the last active option cannot be deleted. |
| Option appearance | Business Impact options have an admin-editable color used by chips. Idea Type options have a label and sort order only. |
| Description authorization | The idea author, an in-scope Org Admin, or Site Admin may edit the description. |
| Idea deletion | Only an in-scope Org Admin or Site Admin may soft-delete an idea after confirmation. Restore is deferred. |
| Card movement | Desktop cards use a dedicated drag handle. Keyboard and touch users move ideas with the status selector in Idea Detail. |
| Comment shortcut | The card comment action opens Idea Detail, scrolls comments into view, and focuses the comment composer. If commenting is unavailable, focus moves to the comments heading. |
| Assignment cardinality | Assignment is optional. An idea can have zero to five distinct assignees. Existing valid singular assignments migrate into the new collection. |
| Assignment scope and authorization | Assignees must be active users in the idea's organization when selected. The idea author, an in-scope Org Admin, or Site Admin can change assignments. Inactive historical assignees remain visible but cannot be newly selected. |
| Tag entry and limits | Anyone authorized to edit the idea can select or create reusable organization-scoped tags. An idea can have up to 10 tags. |
| Card metadata overflow | Cards show the first three tags alphabetically plus `+N`, and the first three assignees by first name then last name plus `+N`. Complete values remain available in Idea Detail and accessible labels or tooltips. |
| Submission age | Cards show viewer-local calendar-day age: `0 days ago`, `1 day ago`, or `{N} days ago`. Future timestamps are clamped to zero. |

## Idea Rules
1. A board can contain zero or more ideas.
2. Each idea must include:
   - Title (required, max 150 characters)
   - Description (required, max 4000 characters)
   - Priority (required): `Low`, `Medium`, `High`, or `Critical`
   - Idea Type (required): one active organization-configured Idea Type
   - Business Impact (required): one active organization-configured Business Impact
   - Due Date (optional)
   - Status (required) this is set by which Swim Lane the idea is in.  The default is the left most lane.
   - Assignees (optional, zero to five distinct users from the idea's organization)
   - Tags
   - Mentions
   - Comments
   - Number of Upvotes
3. Board cards must remain compact and display:
   - Title
   - Priority
   - Business Impact as a color chip
   - Up to three assigned-user personas, ordered by first name then last name, followed by `+N` when more are assigned
   - Up to three tags alphabetically, followed by `+N` when more are assigned
   - Submission age in viewer-local calendar days
   - Upvote icon button and count
   - Add Comment icon button and comment count
4. Clicking the idea title from a board card opens the Idea Detail drawer (right slide-in overlay) for full idea review and editing (URL gains `?idea={ideaId}`; addressable as `/ideas/{ideaId}`; see `SPEC/20-feature-client-ui.md` Idea Detail Surface). This is the same drawer reached from the Ideas list, not a separate surface.
5. Idea Detail must support all editable idea fields and collaboration fields, including tags, mentions, due date, assignment, comments, and upvote state.
6. Ideas in the `Complete` status remain editable and continue to allow comments, mentions, and upvotes.
7. When a `statusId` is provided on idea create or status update, it must correspond to an active swimlane on the idea's target board; providing a status that is not on the board is a validation error.
8. Idea creation, edits, status changes, comments, upvote toggles, and deletions must generate audit events.
9. In Development, seeded demo boards include example ideas whose description fields contain sample spec-style detail text.
10. Moving an idea by drag-and-drop or by the Idea Detail status selector updates the card immediately to the swimlane mapped to the selected status. A failed API update restores the prior swimlane and shows an error.
11. Soft-deleted ideas are excluded from normal board, list, and detail queries. The row and deletion audit metadata are retained; restoring deleted ideas is out of scope for this release.
12. An idea may have zero to five distinct assignees. Every newly selected assignee must be an active user in the idea's organization. Inactive users already assigned to an idea remain visible for historical accuracy but cannot be newly selected.
13. Assignment changes replace the complete assignee collection atomically. Duplicate user IDs, more than five IDs, inactive users, or users from another organization are validation errors.
14. Existing non-null singular assignments are migrated to one idea-assignee relationship each before the legacy singular assignment column and foreign key are removed.
15. `Assigned to me` matches an idea when the current user belongs to its assignee collection.
16. The global Ideas list (`GET /api/v1/organizations/{organizationId}/ideas`, backing the `/ideas` page) filters and sorts **server-side**:
    - **All-column search** covers every column the list displays — Title, Created By (author name), Assigned To (assignee names), Status (status name), and Created Date — plus the values of Text/Url User-Defined Fields. Text columns match as a case-insensitive substring; the Created Date column matches when the search term is a full ISO `YYYY-MM-DD` date (ideas created on that UTC calendar day).
    - **Tag filter** narrows to ideas carrying a tag with the given (normalized) name.
    - **User-association filter** narrows to ideas a specific chosen user either authored or is assigned to (the user search box in `SPEC/Bug Triage.md`), distinct from the caller-scoped `All`/`Created by me`/`Assigned to me` chips.
    - **Column sort** is supported on Title, Created By, Assigned To (alphabetically-first assignee), Status, and Created Date, ascending or descending, with a stable idea-id tiebreaker so paging is deterministic.

## Organization-Managed Idea Fields
1. Site Admin and Org Admin can create, rename, reorder, and soft-delete Idea Type and Business Impact options within their authorized organization scope.
2. The dedicated management surface is **Settings > Idea Fields** at `/settings/organizations/{organizationId}/idea-fields`.
3. Site Admin selects the target organization. Org Admin can manage only their own organization.
4. Option labels are trimmed, compared case-insensitively, and unique among active options of the same field and organization.
5. Sort order is admin-controlled. The first active option in sort order is the default.
6. Each field must always have at least one active option. Deleting the last active option is rejected.
7. Deleting an option performs a soft delete even when ideas reference it. Existing references continue to display the prior label with an archived indicator.
8. Archived options cannot be assigned to new ideas or selected during an edit.
9. Business Impact options include an editable color used by the board-card and detail chips. **Idea Type options carry an editable color and icon, rendered as a badge** on cards, the ideas list, and idea detail (`SPEC/20-feature-idea-type-fields.md`). *(Supersedes the earlier "Idea Type options do not include a color" rule.)*
10. New organizations receive the initial option sets listed in the decision table.
11. **Idea Type is immutable after an idea is created** — it is chosen at creation and cannot be changed on the normal edit path (`SPEC/20-feature-idea-type-fields.md`). An update that supplies a differing Idea Type is rejected with `400`. The sole exception is an **admin-only reassignment** action (`PUT /organizations/{organizationId}/ideas/{ideaId}/idea-type`), which re-resolves the idea's fields and archives out-of-scope values. (Business Impact mutability is unchanged.)
12. **Idea Type directly maps an ordered selection of the organization's User-Defined Fields** — each marked required-or-optional for that type — that scopes which UDFs appear on ideas of that type. A type in `AllActiveFields` mode (the default) shows all active org UDFs; a `Curated` type shows only its mapped fields. Full behavior in `SPEC/20-feature-idea-type-fields.md`.

## Rich Content and Attachments Direction (Resolved)
1. MVP idea descriptions and comment bodies remain plain text only.
2. Rich text formatting (HTML, Markdown rendering, WYSIWYG controls) is out of MVP scope.
3. File attachments and embedded media are out of MVP scope.
4. URLs may appear as plain text content but are not treated as trusted embedded content.
5. Rich-content and attachment support is deferred to a future post-MVP phase and requires explicit security and storage contracts before implementation.

## Permissions
- Site Admin, Org Admin, and User can create and edit ideas.
- Site Admin and Org Admin can soft-delete ideas within their authorized scope; soft-deleted ideas are excluded from board views and list queries.
- The Delete action is visible in Idea Detail only to an authorized Site Admin or Org Admin, requires confirmation, returns to the board after success, and removes the card from the board immediately.
- Only the creating author, an in-scope Org Admin, or Site Admin can edit an idea description or change its assignee collection. Other editable fields retain the general idea-edit permission unless a narrower rule is specified.
- To support assignee selection and mention lookup, any authenticated caller scoped to an organization (User and Read Only included, not only admins) can read a minimal list of its active members — id, name, and email only — via `GET /organizations/{organizationId}/members`. This is deliberately narrower than the admin user listing (`GET /organizations/{organizationId}/users`), which exposes roles, status filters, and full user administration and remains Org-Admin+. Callers outside the organization receive a 404.
- Idea deletion generates an audit event.
- Read Only cannot edit or delete idea content.
- User can update idea status for any idea on a board if allowed by board configuration.

## Site Admin Organization Context
- Site Admin operates in the context of the specific resource being accessed or modified; org-scoped operations (board, idea, status, tag management) use the organization that owns the resource.
- When creating org-scoped resources (e.g., creating a new board), Site Admin must specify the target `organizationId`.
- Site Admin has no organization affiliation and therefore cannot be @mentioned and will not appear in mention lookup results.

## Tags
1. Tags are scoped to the organization.
2. Users who can edit ideas can create new tags.
3. Users can select existing tags or create new ones up to 100 characters.
4. Tag autocomplete begins after 2 entered characters.
5. If no match exists, the new tag is created when the idea is saved.
6. Tags are trimmed, compared case-insensitively, and must be unique within an organization.
7. If concurrent saves attempt to create the same normalized tag, the system merges them into a single tag.
8. An idea can have no more than 10 distinct tags. Duplicate normalized names in one request are treated as one tag.

## Mentions
1. Users can mention other users in their organization using the `@` trigger and an email-based lookup.
2. Mention suggestions are limited to users in the same organization.
3. Mentions are resolved to the matching user when the idea or comment is saved.
4. If a typed mention does not resolve to a same-organization user, the UI must show inline validation and block save until the unresolved mention is removed or corrected.

## Comments
1. All authenticated users, including Read Only, can comment on ideas.
2. Comments are displayed chronologically.
3. Comment authors can edit and delete their own comments.
4. Site Admin and Org Admin can delete any comment within their authorized scope.
5. Comments support the same email-based mention behavior as ideas.
6. Comment bodies are plain text, may include line breaks, and are limited to 2000 characters.
7. Comment entry shows a live character counter and inline validation when the maximum length is exceeded.
8. Development startup seed includes example comments on seeded ideas for collaboration walkthroughs.

## Upvotes
1. All authenticated users, including Read Only, can upvote ideas.
2. Upvoting is a toggle.
3. A user can have at most one active upvote per idea.
4, Upvotes are counted per Idea and displayed next to the upvote icon.
5. Only the user who cast an upvote can remove it.
6. Board cards use a thumbs-up icon button. The icon is unfilled when the current user has not upvoted and filled when the current user has an active upvote.
7. Toggling from a board card updates the icon and count immediately. On failure, the prior state and count are restored and an error is shown.

## CSV Import

### Rules
1. Only Site Admin and Org Admin can upload ideas via CSV to a board.
2. The CSV file must use UTF-8 encoding with a header row.
3. Supported columns:

   | Column       | Required | Constraints                                                                |
   |--------------|----------|----------------------------------------------------------------------------|
   | `Title`      | Yes      | max 150 characters                                                         |
   | `Description`| Yes      | max 4000 characters                                                        |
   | `Priority`   | Yes      | must be `Low`, `Medium`, `High`, or `Critical`                             |
   | `IdeaType`   | No       | active organization-configured option name; defaults to the first active Idea Type |
   | `BusinessImpact` | No   | active organization-configured option name; defaults to the first active Business Impact |
   | `DueDate`    | No       | ISO-8601 date format (`YYYY-MM-DD`); omit or leave blank to skip           |
   | `Status`     | No       | status name string; matched case-insensitively against the org's configured statuses; if omitted, defaults to the leftmost swimlane on the board |
   | `AssignedTo` | No       | pipe-delimited (`\|`) email addresses of zero to five distinct active users in the same organization |
   | `Tags`       | No       | pipe-delimited (`\|`) list of up to 10 distinct tag values; max 100 characters per tag |

4. Validation runs against the entire file before any ideas are created. If any row fails validation, the entire upload is rejected and all errors are returned. No partial imports occur.
5. A single upload is limited to 500 data rows. Files exceeding this limit are rejected.
6. If two or more rows within the same CSV share the same `Title` (case-insensitive), the second and any subsequent duplicate rows are validation errors.
7. If a row's `Title` (case-insensitive) already exists as an idea on the target board, that row is silently skipped without error.
8. Each `AssignedTo` email must resolve to a distinct active user in the same organization. An unresolved, duplicate, cross-organization, or more-than-five assignment is a validation error.
9. The `Status` column value is a **status name string**. The validator performs a case-insensitive name lookup against the organization's configured statuses. If a match is found, the idea is assigned that status. If no org status with that name exists, it is a validation error.
10. New `Tags` values that do not yet exist in the organization are created automatically using the same normalization rules as manual tag creation (trimmed, case-insensitive deduplication).
11. The creation phase (after validation passes) runs inside a single database transaction. If any row fails to persist, all created ideas are rolled back.
12. A successful import generates one bulk-import audit event for the upload action, plus one individual audit event per idea created (same event type as manual idea creation). The bulk-import audit event fires even when all rows were skipped (`importedCount: 0`).

### Acceptance Criteria
- [ ] Only Site Admin and Org Admin can access the CSV upload action for a board
- [ ] CSV files exceeding 500 data rows are rejected before processing
- [ ] Validation covers all rows before any ideas are created
- [ ] A file with any invalid row is rejected entirely and all errors are reported
- [ ] `Title`, `Description`, and `Priority` are required per row; missing or blank values are validation errors
- [ ] `Title` is validated to max 150 characters per row
- [ ] `Description` is validated to max 4000 characters per row
- [ ] `Priority` must be one of `Low`, `Medium`, `High`, or `Critical`; unrecognized values are validation errors
- [ ] `DueDate` must be a valid `YYYY-MM-DD` date when provided; invalid formats are validation errors
- [ ] `Status` is a name string matched case-insensitively against the organization's configured statuses; a value that does not match any org status is a validation error
- [ ] Ideas with no `Status` value default to the leftmost swimlane of the target board
- [ ] `AssignedTo` contains zero to five pipe-delimited email addresses; each resolves to a distinct active user in the same organization
- [ ] `Tags` contains no more than 10 pipe-delimited distinct values; new values are auto-created using existing normalization rules
- [ ] Rows whose `Title` (case-insensitive) already exists on the target board are silently skipped
- [ ] Two or more rows within the same CSV sharing the same `Title` (case-insensitive) are validation errors
- [ ] The creation phase runs inside a single transaction; a persistence failure rolls back all created ideas
- [ ] A bulk-import audit event is generated for the upload action, including when all rows are skipped
- [ ] One individual audit event is generated per idea created, matching the manual idea-creation audit event type

## AI-Assisted Idea Creation (Interview-Resolved 2026-08-07)

### Outcome
Users can start a new idea by describing it in plain English instead of filling every field by hand. The system extracts as many fields as it can confidently determine, asks a single batched round of clarifying questions only for fields it cannot confidently determine, and always presents the result on the same idea form used for manual entry for review before the idea is created.

### Decisions
| Decision | Resolution |
|---|---|
| Entry point | The board's New Idea action opens a plain-English prompt box by default. A visible link/toggle lets the user skip directly to the blank manual field-by-field form instead. |
| Board context | This flow is launched from within a specific board, the same entry point as the existing manual New Idea action. The board is always known from context and is never inferred or asked about. |
| Trust model | The extracted result always populates the standard idea form as a pre-filled, fully editable, unsaved draft. No idea is created directly from the prompt; the user must review and submit Create. |
| Scope of one submission | One prompt submission produces exactly one idea. Detecting and splitting multiple candidate ideas out of a single input (e.g., a pasted meeting-notes dump covering several topics) is out of MVP scope. |
| Title and Description | Always synthesized/derived; neither is ever blocked on or triggers a clarifying question. Description defaults to a lightly cleaned version of the user's raw input with no generative rewrite, so the mandatory extraction call stays cheap. An explicit opt-in "Polish with AI" action may rewrite the description on request. |
| Priority, Idea Type, Business Impact | Required fields. Always inferred when the input gives any reasonable signal, and shown on the review form as visually distinguished "inferred, unconfirmed" until the user interacts with the field. A clarifying question is triggered only when there is no usable signal at all for a given field. |
| Due Date, Assignees, Tags | Optional; only surfaced when mentioned in the input. An ambiguous mention (e.g., a name matching more than one active org user) triggers a disambiguation question; an unmentioned optional field is simply left blank/default. |
| Clarifying questions | Batched into a single round after the initial extraction pass, not serial back-and-forth. Enum fields (Priority, Idea Type, Business Impact) are presented as multiple-choice sourced from the org's current active options. MVP supports at most one clarification round; any field still unresolved afterward is left blank/default on the review form for manual correction. |
| Entity resolution | The extraction step never receives the org's full user or tag lists. It returns raw plain-text mentions (person names, tag-like keywords, date phrases); resolving those mentions against actual org users, tags, and dates happens in deterministic backend logic (fuzzy match, date parsing), not inside the model prompt. This keeps prompt size independent of org size and keeps resolution grounded in real data rather than model recall. |
| Model tier | MVP uses a single fixed, low-cost model tier appropriate to a classification/short-synthesis task. The mandatory extraction call uses Claude Haiku 4.5. The opt-in "Polish with AI" action uses Claude Sonnet 5, because rewriting is a generation task rather than a classification one. No multi-model escalation/cascade in MVP. |
| Provider naming | Configuration keys and API contract fields are deliberately vendor-neutral (`Ai__ApiKey`, `aiApiKey`, `aiKeyConfigured`) rather than naming a provider. Changing providers is then a spec-and-adapter change instead of a breaking contract change. |
| Credential source | Extraction and polish calls authenticate with the organization's own AI API key when one is configured, and otherwise with the deployment-wide default key. Key management, precedence, and failure behavior are specified in `SPEC/20-feature-organizations-and-users.md` ("Organization AI Credentials"). |
| Input guardrails | The client enforces a minimum input length before allowing submission, to avoid wasted calls on trivially empty input. The API enforces a maximum input length aligned to the Description field limit, since multi-idea handling is out of scope. |
| Relationship to Approval Workflow | Consistent with the deferred Approval Workflow decision that AI-generated content is untrusted until reviewed by a human (below): the always-review-before-create trust model already satisfies that principle for this feature, independent of whether the approval workflow itself is ever built. |

### Flow
1. From within a board, the user opens New Idea, which opens a prompt box with a link to skip to the manual form.
2. The user describes the idea in their own words and submits.
3. The extraction step runs once against the input, constrained to the target org's active Idea Type options and active Business Impact options, and returns: a synthesized title; Priority, Idea Type, and Business Impact each either confidently classified or marked as no-signal; and any raw mentions of people, dates, or tag-like terms found in the text. The extraction response does not carry a description — because the description is a lightly cleaned copy of the user's own input rather than generated prose, backend code produces it deterministically (trim, collapse whitespace runs, normalize line endings, enforce the 4000-character limit). This preserves the specified behavior exactly while removing the single largest output-token cost in the call.
4. Backend logic resolves raw mentions against the org's active users, tags, and a date parser. Ambiguous or unresolved mentions are queued for the clarifying round; unambiguous matches are pre-filled directly.
5. If any required field has no signal, or any mention is ambiguous, the user is shown one batched round of clarifying questions (multiple-choice for enum fields, a short picker for name/tag disambiguation). If nothing needs clarifying, this step is skipped.
6. The standard idea form opens pre-filled with everything extracted and resolved. Inferred-but-unconfirmed fields are visually distinguished from user-confirmed or user-edited fields.
7. The user reviews, edits any field, and submits Create through the existing idea-creation path, generating the same audit event as manual creation (see Idea Rules).

### Cost Architecture Principles
1. The model never receives the org's full user or tag list; it only extracts raw mentions, which deterministic backend code resolves. This bounds prompt size independent of org size.
2. Output is schema/tool-constrained with per-field token limits aligned to existing field length limits (Title 150 characters, Description 4000 characters), not open-ended generation.
3. Description defaults to cleaned raw input rather than a generated rewrite, and that cleaning is performed in backend code rather than by the model, so the mandatory call never spends output tokens echoing the user's own text back. Generative rewriting is opt-in and separate from the mandatory extraction call.
4. A single fixed low-cost model is used for MVP. Multi-model escalation, self-hosted model infrastructure, and per-organization usage quotas are deferred until real usage data justifies the added engineering cost (see Out of Scope below).
5. Prompt caching is not applicable at this prompt size and is therefore deferred at no cost: the extraction system prompt is well under the minimum cacheable prefix length for the chosen model tier, so a cache entry would never be created even if caching were configured. Revisit only if the system prompt grows substantially.
6. Because organizations may supply their own API key, per-call cost can fall on either the deployment's account or the organization's own account. Neither the extraction prompt nor the polish prompt changes based on which key is in use — key selection is purely a credential concern and must not alter model behavior or output shape.

### Out of Scope (MVP)
- Detecting or splitting multiple candidate ideas from one input.
- A global (not board-scoped) entry point, and any board inference/selection question.
- Multi-model escalation/cascade based on confidence or validation failure.
- Prompt caching infrastructure and self-hosted model infrastructure.
- Per-organization AI usage quotas, spend caps, and usage reporting. Organization-supplied API keys (see `SPEC/20-feature-organizations-and-users.md`) shift *who pays* but deliberately do not introduce any usage ceiling, per-user rate limit, or consumption dashboard in MVP.
- Per-organization provider selection. One provider is configured deployment-wide; an organization supplies its own key for that provider, not a key for a different one.
- Ambient capture (e.g., email- or Slack-forwarded idea creation).

### Permissions
Same as manual idea creation: Site Admin, Org Admin, and User can use AI-assisted creation. Read Only cannot create ideas by any path.

### Acceptance Criteria
- [ ] New Idea on a board opens a plain-English prompt box by default, with a visible option to go directly to the blank manual form
- [ ] The board context for an AI-assisted idea is always the board the flow was launched from; it is never inferred or asked about
- [ ] Submitting a prompt never creates an idea directly; the result always populates the standard idea form as an editable, unsaved draft
- [ ] Title and Description are always populated without triggering a clarifying question; Description defaults to the user's cleaned raw input unless the user explicitly requests an AI rewrite
- [ ] Priority, Idea Type, and Business Impact are inferred when the input gives any signal and are visually marked as inferred/unconfirmed until the user interacts with them
- [ ] A clarifying question is shown only when a required field has no usable signal, or an optional mention (assignee, tag) is ambiguous against active org data
- [ ] All clarifying questions for one submission are presented together in a single round; enum fields use multiple-choice sourced from the org's active options
- [ ] Any field still unresolved after one clarification round is left blank/default on the review form rather than triggering a second round
- [ ] The extraction call never includes the org's full user or tag list; name/tag/date resolution happens in backend logic against raw extracted mentions
- [ ] Client rejects submission below a minimum input length before any extraction call is made
- [ ] API enforces a maximum input length aligned to the Description field limit
- [ ] AI-assisted idea creation is available to the same roles as manual idea creation (Site Admin, Org Admin, User) and generates the same audit event as manual creation
- [ ] The extraction call authenticates with the organization's own AI API key when one is configured, and with the deployment default key otherwise
- [ ] The extracted result is identical in shape and behavior regardless of which key authenticated the call
- [ ] When an organization's own key fails at request time, the call is retried once against the deployment default key and the user's flow completes normally
- [ ] The description on the review form is produced by backend cleaning of the user's raw input, and no description text is requested from or returned by the extraction call
- [ ] AI-assisted idea creation is unavailable, with a clear message and a direct path to the manual form, when neither an organization key nor a deployment default key is configured

## Approval Workflow Decisions (Post-MVP — Deferred)
The following decisions are captured for a future post-MVP approval workflow feature. **None of these behaviors are implemented in MVP.** No API contracts, data model fields, background scheduler, or acceptance criteria for approval are required for the MVP release.

When this feature is implemented it must address:
- Approval modeled as a workflow state transition, not as a separate entity.
- Only Org Admins and the idea author can initiate or resolve approval actions.
- Site Admin can always initiate or resolve approval actions within any org.
- A pending approval request expires after 24 hours and automatically returns to the previous state if no action is taken (requires a background scheduler).
- Rejection returns the idea to the last non-terminal state; rejection reason and prior state must be persisted.
- Concurrent edit concurrency during a pending approval requires an explicit decision (optimistic concurrency token recommended).
- AI-generated or AI-assisted content is treated as untrusted until reviewed by a human; the system must not auto-approve AI-generated submissions.

## Acceptance Criteria
- [ ] Required idea fields are enforced
- [ ] Idea title is limited to 150 characters
- [ ] Idea description is limited to 4000 characters
- [ ] Idea priority is required and limited to `Low`, `Medium`, `High`, or `Critical`
- [ ] Idea Type and Business Impact are required dedicated fields and do not replace Priority
- [ ] New organizations receive the canonical Idea Type and Business Impact options
- [ ] Existing ideas are migrated to `Continuous Improvement` and `Medium`
- [ ] The first active option by sort order is used when a new idea or CSV row omits the corresponding field
- [ ] Admins can create, rename, reorder, and soft-delete field options within organization scope
- [ ] The last active Idea Type or Business Impact option cannot be deleted
- [ ] Archived options remain visible on existing ideas but cannot be newly selected
- [ ] Business Impact options support admin-editable chip colors
- [ ] Idea due date is optional
- [ ] Tag autocomplete begins after 2 characters
- [ ] Tag values are limited to 100 characters
- [ ] New tags can be created on save
- [ ] Tags are trimmed, case-insensitive, and unique within an organization
- [ ] An idea accepts at most 10 distinct tags
- [ ] Concurrent creation of the same normalized tag results in a single shared tag
- [ ] Read Only users cannot create new tags because they cannot edit ideas
- [ ] Mention lookup resolves users by email within the same organization
- [ ] Mentions in comments resolve users by email within the same organization
- [ ] Unresolved mentions show inline validation and block save until corrected or removed
- [ ] Ideas in `Complete` status remain editable and collaborative
- [ ] An idea accepts zero to five distinct assignees, all newly selected assignees are active users in the idea's organization, and duplicate, inactive, cross-organization, or excess IDs are rejected
- [ ] The idea author, an in-scope Org Admin, or Site Admin can change the assignee collection; other users cannot
- [ ] Existing valid singular assignments migrate without data loss to the idea-assignee collection
- [ ] `Assigned to me` matches membership in the assignee collection
- [ ] Board cards show title, priority, Business Impact chip, assigned-user personas, tags, viewer-local submission age, upvote control/count, and comment control/count
- [ ] Cards show at most three assignees ordered by first name then last name and at most three tags alphabetically, using `+N` overflow indicators and exposing complete values in Idea Detail and accessible text
- [ ] Each displayed assignee persona contains the first letter of the first name and first letter of the last name followed by the first name; missing-name fallbacks remain accessible
- [ ] Submission age uses viewer-local calendar dates, displays `0 days ago`, singular `1 day ago`, or plural `{N} days ago`, and clamps future values to zero
- [ ] Card upvote state reflects whether the current user has upvoted and toggles with optimistic rollback on failure
- [ ] Clicking the card comment control opens Idea Detail and focuses the comment composer
- [ ] Clicking an idea title from a board card opens the Idea Detail drawer (URL gains `?idea={ideaId}`; addressable as `/ideas/{ideaId}`)
- [ ] Idea Detail supports all idea edit fields including tags, mentions, assignment, and optional due date
- [ ] Mentions are restricted to users in the same organization
- [ ] Comment authors can edit and delete their own comments
- [ ] Site Admin and Org Admin can delete comments in their authorized scope
- [ ] Comment bodies are plain text with line breaks and are limited to 2000 characters
- [ ] Comment entry shows a live character counter and inline overflow validation
- [ ] When enabled by board configuration, Users can update the status of any idea on that board
- [ ] A successful status change immediately moves the card to the corresponding swimlane without closing Idea Detail
- [ ] Desktop drag-and-drop uses a dedicated handle and reverts the card on API failure
- [ ] Keyboard and touch users can move an idea through the Idea Detail status selector
- [ ] Only the idea author or an in-scope admin can edit the description
- [ ] Only an in-scope Org Admin or Site Admin sees and can confirm the Idea Detail soft-delete action
- [ ] Soft-deleted ideas are excluded from normal queries and cannot be restored in this release
- [ ] Read Only can comment and upvote
- [ ] Upvoting toggles on second click
- [ ] Only the user who cast an upvote can remove it
- [ ] Idea lifecycle actions generate audit events
- [ ] Development startup seed provides example ideas with description-based spec content
- [ ] Development startup seed provides example comments on seeded ideas
- [ ] MVP idea and comment content remains plain text only
- [ ] Rich text, embedded media, and file attachments are excluded from MVP implementation`
