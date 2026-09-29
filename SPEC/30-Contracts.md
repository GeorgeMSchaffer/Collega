# Contracts

## Purpose
Defines the system contracts that implementations must follow.

## Contract Authorship Rule
- Canonical contract behavior is authored in this file and related canonical `SPEC/20-feature-*.md` docs.
- Contract tests verify the API surface directly against the canonical documents under `SPEC`.
- Do not introduce API behavior without corresponding canonical updates in `SPEC`.

## Route Conventions
- HTTP APIs use path versioning under `/api/v1`.
- Resource routes use plural nouns.
- Nested routes are allowed when needed to express parent-child ownership clearly.

## MVP Boundary For External Auth
- MVP contract conformance does not require OAuth or SAML endpoints.
- OAuth/OIDC endpoints are planned for post-MVP Phase 2.
- SAML endpoints are planned for a post-OAuth phase.
- Until those phases begin, `/api/v1/auth/*` contracts are limited to local credential and password-management flows defined in this document.

## Error Envelope
- All non-2xx responses use a problem-details-style payload.
- Standard fields are `type`, `title`, `status`, `detail`, and `instance`.
- Validation failures may include an additional `errors` object keyed by field name.

## Standard Error Responses
- `400 Bad Request`: request JSON is malformed, required fields are missing, field values violate contract constraints, or the request shape is otherwise invalid.
- `401 Unauthorized`: the caller is not authenticated or the authentication token is missing, expired, or invalid.
- `403 Forbidden`: the caller is authenticated but not permitted to perform the requested action in the current scope.
- `404 Not Found`: the targeted resource does not exist or is not visible within the caller's authorized scope.

## Collection Conventions
- Organization, user, idea, and comment list endpoints support pagination in MVP.
- Smaller configuration collections such as statuses, boards, and tags may return full result sets unless a feature-specific contract says otherwise.
- Paginated collections support basic filtering plus one explicit sort field and sort direction.
- **List pattern (2026-09-27, `20-feature-client-ui.md` "List and detail pattern").** Applies to `GET /api/v1/organizations/{organizationId}/ideas` and `GET /api/v1/boards/{boardId}/ideas`; the users and organizations lists join it only when their screens move to the pattern. The list screens send `pageSize` of `10` (their default), `25`, `50` or `100`. **The API's paging is unchanged** (corrected 2026-09-27): any other value keeps its existing treatment — absent is `20`, and values are clamped to 1–100 (`packages/application/src/common/pagination.ts`) — so no caller gains a `400` and the golden corpus records no paging difference. Finite-value filters are **repeatable** (`statusId=a&statusId=b`): values of one parameter combine as any-of, different parameters as AND. `sortBy` accepts every column the list screen displays; each endpoint lists its values. Unsorted lists keep their existing default order.
- Archived organizations are hidden from list results by default unless explicitly filtered with `isArchived=true` or an equivalent include-archived flag.

## Update Conventions
- MVP update operations use last-write-wins behavior unless a feature-specific contract defines a stronger rule.

## Validation Ownership
- The API contract validates request shape, required fields, and basic field constraints.
- The Application and Domain layers enforce business rules, authorization rules, and cross-entity invariants.

## Validation Message Conventions
- API validation messages follow these canonical templates:
	- Required: `<FieldName> is required.`
	- Max length: `<FieldName> must be <N> characters or fewer.`
	- Min length: `<FieldName> must be at least <N> characters.`
	- Invalid format: `<FieldName> must be a valid <FormatName>.`
	- Invalid enum value: `<FieldName> must be one of: <Value1>, <Value2>, <Value3>.`
	- Numeric or date range: `<FieldName> must be between <Min> and <Max>.`
	- Mention resolution: `Mention '<Value>' could not be resolved to a user in your organization.`
- Validation failures use the `errors` object keyed by request field names.
- UI should mirror API validation wording where practical to reduce interpretation drift.
- **Casing (Resolved 2026-08-07)**: the `errors` object *keys* are camelCase to match wire JSON field names (e.g. `"firstName"`). The `<FieldName>` substituted into message *text* is separate and uses human-readable, spaced Title Case (e.g. `"First Name is required."`, `"Email is required."`), not the raw camelCase or PascalCase property name. This applies to every validation template in this section.

## Shared Data Rules
- Identifiers are GUID strings.
- Timestamps are UTC ISO-8601 strings.
- Enum values are serialized as strings.
- Paginated responses use:
	- `items`
	- `page`
	- `pageSize`
	- `totalCount`
	- `sortBy`
	- `sortDirection`
- User and organization text fields are trimmed before validation and persistence.
- First and last name maximum length is 100 characters.
- Company name maximum length is 200 characters.
- Address maximum length is 200 characters.
- City maximum length is 100 characters.
- State maximum length is 50 characters.
- Zip maximum length is 20 characters.
- Phone maximum length is 25 characters.
- Comment body maximum length is 2000 characters and supports plain text with line breaks only.

## Contract Index

Each contract section lives in its own file under `SPEC/contracts/`, under the same heading it
had here, so a pointer such as "30-Contracts.md § Idea Contracts" resolves through this table.
Read the conventions above and then only the file you need. **The whole set is canonical and is
read, not edited, by implementation slices** — the same rule that covered this file when it held
everything. Every route is under `/api/v1`.

Each route in those files follows one template: a heading naming the method and path, a one-line
purpose, then **Roles**, **Request**, **Response**, **Errors** and **Rules**. A `—` means the
contract states nothing for that item, and the conventions above apply.

| Section | File | Routes |
|---|---|---|
| Authentication Contracts | [`contracts/auth.md`](contracts/auth.md) | `/auth/login`, `/auth/me` (and `/portrait`), `/auth/change-password`, `/auth/password-reset/*`, `/users/{userId}/temporary-password`; also the session, password-rotation and rate-limiting rules. Subsections: Access Token Format and Session Revocation; Mandatory Password Rotation Gate; Rate limiting on the authentication surface |
| View As Contracts | [`contracts/view-as.md`](contracts/view-as.md) | `/auth/view-as`, `/auth/view-as/candidates`; the effect on `/auth/me` |
| Organization Contracts | [`contracts/organizations.md`](contracts/organizations.md) | `/organizations`, `/organizations/{organizationId}` (and `/logo`, `/invite-code/regenerate`, `/archive`, `/ai-key`) |
| User Contracts | [`contracts/users.md`](contracts/users.md) | `/auth/register`, `/organizations/{organizationId}/users` (and `/import`), `/organizations/{organizationId}/members`, `/users/{userId}` |
| Status Contracts | [`contracts/statuses.md`](contracts/statuses.md) | `/organizations/{organizationId}/statuses` (and `/reorder`), `/statuses/{statusId}` |
| Idea Field Option Contracts | [`contracts/idea-field-options.md`](contracts/idea-field-options.md) | `/organizations/{organizationId}/idea-types`, `/idea-types/{ideaTypeId}`, `/organizations/{organizationId}/business-impacts`, `/business-impacts/{businessImpactId}`. Merged from two sections of this name; the differences between them were decided 2026-09-28 (`SPEC/decisions.md`). |
| User-Defined Field Contracts | [`contracts/field-definitions.md`](contracts/field-definitions.md) | `/organizations/{organizationId}/field-definitions` (and `/{id}`, `/reorder`). Written from the code 2026-09-29 (`SPEC/decisions.md`). |
| Idea-Type Field Contracts | [`contracts/idea-type-fields.md`](contracts/idea-type-fields.md) | `/organizations/{organizationId}/idea-types/{ideaTypeId}/fields` and `/appearance`, `/organizations/{organizationId}/ideas/{ideaId}/idea-type` |
| Board Contracts | [`contracts/boards.md`](contracts/boards.md) | `/organizations/{organizationId}/boards`, `/boards/{boardId}` (and `/archive`, `/unarchive`, `/swimlanes/reorder`) |
| Idea Contracts | [`contracts/ideas.md`](contracts/ideas.md) | `/boards/{boardId}/ideas` (and `/export`, `/import`, `/ai-draft`, `/ai-polish`), `/organizations/{organizationId}/ideas`, `/ideas/{ideaId}` (and `/status`) |
| Delivery Contracts | [`contracts/delivery.md`](contracts/delivery.md) | `/ideas/{ideaId}/promote`, `/return-to-discovery`, `/delivery-status`, `/sprint`, `/delivery`; `/organizations/{organizationId}/delivery` |
| Sprint Contracts | [`contracts/sprints.md`](contracts/sprints.md) | `/organizations/{organizationId}/sprints` (and `/{sprintId}`, `/start`, `/complete`) |
| Issue Task Contracts | [`contracts/issue-tasks.md`](contracts/issue-tasks.md) | `/ideas/{ideaId}/tasks` (and `/{taskId}`, `/{taskId}/state`, `/order`) |
| Tag Contracts | [`contracts/tags.md`](contracts/tags.md) | `/organizations/{organizationId}/tags` (and `/catalog`), `/tags/{tagId}`. Subsection: Tag colour and management |
| Comment Contracts | [`contracts/comments.md`](contracts/comments.md) | `/ideas/{ideaId}/comments`, `/comments/{commentId}` |
| Upvote Contracts | [`contracts/upvotes.md`](contracts/upvotes.md) | `/ideas/{ideaId}/upvote/toggle` |
| AI Idea Assist Contracts | [`contracts/ai-assist.md`](contracts/ai-assist.md) | `/boards/{boardId}/idea-assist/turns`, `/ai-assist/*` (availability, prompt, usage), `/organizations/{organizationId}/ai-assist/*` (settings, usage) |
| Notification Event Contract | [`contracts/notifications.md`](contracts/notifications.md) | No route: the internal notification event types and payload |

## Notes
- API routes, request/response schemas, and validation rules should be defined here.
- Contract tests should stay aligned with this file.