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
4. Clicking the idea title from a board card opens a detail overlay for full idea review and editing without leaving the board page.
5. The detail overlay must support all editable idea fields and collaboration fields, including tags, mentions, due date, assignment, comments, and upvote state.
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

## Organization-Managed Idea Fields
1. Site Admin and Org Admin can create, rename, reorder, and soft-delete Idea Type and Business Impact options within their authorized organization scope.
2. The dedicated management surface is **Settings > Idea Fields** at `/settings/organizations/{organizationId}/idea-fields`.
3. Site Admin selects the target organization. Org Admin can manage only their own organization.
4. Option labels are trimmed, compared case-insensitively, and unique among active options of the same field and organization.
5. Sort order is admin-controlled. The first active option in sort order is the default.
6. Each field must always have at least one active option. Deleting the last active option is rejected.
7. Deleting an option performs a soft delete even when ideas reference it. Existing references continue to display the prior label with an archived indicator.
8. Archived options cannot be assigned to new ideas or selected during an edit.
9. Business Impact options include an editable color used by the board-card and detail chips. Idea Type options do not include a color.
10. New organizations receive the initial option sets listed in the decision table.

## Rich Content and Attachments Direction (Resolved)
1. MVP idea descriptions and comment bodies remain plain text only.
2. Rich text formatting (HTML, Markdown rendering, WYSIWYG controls) is out of MVP scope.
3. File attachments and embedded media are out of MVP scope.
4. URLs may appear as plain text content but are not treated as trusted embedded content.
5. Rich-content and attachment support is deferred to a future post-MVP phase and requires explicit security and storage contracts before implementation.

## Permissions
- Site Admin, Org Admin, and User can create and edit ideas.
- Site Admin and Org Admin can soft-delete ideas within their authorized scope; soft-deleted ideas are excluded from board views and list queries.
- The Delete action is visible in Idea Detail only to an authorized Site Admin or Org Admin, requires confirmation, closes the overlay after success, and removes the card from the board immediately.
- Only the creating author, an in-scope Org Admin, or Site Admin can edit an idea description or change its assignee collection. Other editable fields retain the general idea-edit permission unless a narrower rule is specified.
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
- [ ] Clicking an idea title from a board card opens a detail overlay instead of navigating away
- [ ] The detail overlay supports all idea edit fields including tags, mentions, assignment, and optional due date
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
- [ ] Rich text, embedded media, and file attachments are excluded from MVP implementation