# Collega — Product Definition (DERIVED — NOT CANONICAL)

> ⚠️ **This file is a derived, consolidated view. It is not a source of truth and it is not maintained in lockstep with the canonical specs.**
>
> - **Do not implement from this file.** Read the canonical spec for the area you are changing (`SPEC/README.MD` indexes them; `SPEC/30-Contracts.md` is authoritative for endpoints and payloads).
> - **Where this file disagrees with a canonical spec, the canonical spec wins.** That is a precedence rule, not a conflict — resolve it and move on. It is *not* the "specs conflict, ask the user" case in `CLAUDE.md`, which covers disagreement between two **canonical** specs.
> - **Do not edit behavior here.** Update the canonical spec first, then regenerate.
>
> **Generated 2026-09-14 from `70e349e`** (`claude/jolly-carson-68z3pt`, tree clean), against every canonical `SPEC/*.md`, `decisions.md`, `implementation-agent-tracker.md`, the sprint plans, `e2e/README.md`, and the code in `apps/` and `packages/`.
>
> **Relationship to `Specs Overview.md`:** that file is also derived, last reconciled 2026-08-06, and answers a different question — it summarizes *rules*. This file answers *what the product is, who it is for, and what state each capability is in*, as user stories with acceptance criteria. Where the two disagree, this one is newer; where either disagrees with a canonical spec, the canonical spec wins.

---

## 1. What Collega Is

**Collega is a tenant-scoped collaboration tool for submitting, tracking and improving process ideas.**

Anyone in an organization can raise an idea about how work gets done. The idea becomes a card on a board, moves through the organization's own workflow statuses, and collects the things that tell you whether it matters: tags, assignees, comments, @mentions and upvotes. Admins configure the vocabulary — statuses, idea types, business impact levels, and custom fields — so the board speaks the organization's language rather than a generic one.

The shape is deliberately familiar: Trello or Jira, narrowed to continuous-improvement intake. Every organization is a hard data boundary; a single global Site Admin creates organizations and their first users and otherwise works *through* the organizations rather than inside them.

Two capabilities distinguish it from a generic board:

- **AI Idea Assist** turns idea capture into a short conversation. Instead of filling in eight fields, you describe the problem in plain English and the assistant asks a few questions, then hands you a pre-filled, fully editable form. It classifies against the organization's *real* active options, and it is never a write path — the user still submits the form.
- **Issues & Delivery** (specified, unbuilt) lets an approved idea be *promoted* into delivery — sprints, a fixed five-stage lifecycle, and a task checklist — without becoming a second object. Mid-sprint, "why are we building this?" is one click away, because the Issue *is* the Idea.

---

## 2. Personas and Roles

| Role | Core responsibility | Notable limits |
|---|---|---|
| **Site Admin** | Global platform administration across all organizations | Belongs to **no** organization. Cannot be @mentioned. Cannot mutate organization content directly — see §2.2 |
| **Org Admin** | Full administration within their own organization | Cannot administer any other organization |
| **User** | Creates and edits ideas, collaborates | No administration. Some actions are author-only |
| **Read Only** | Participates through comments and upvotes | Cannot edit idea content, create tags, or change board configuration |

`UserStatus` is `Active` or `Inactive` only. There is no "suspended" state anywhere in the domain.

### 2.1 Permission matrix

Canonical source: `SPEC/10-requirements.md`.

| Permission | Site Admin | Org Admin | User | Read Only |
|---|:---:|:---:|:---:|:---:|
| Create organizations | ✓ | | | |
| Edit own organization | ✓ | ✓ | | |
| Manage users (all orgs) | ✓ | | | |
| Manage users (own org) | ✓ | ✓ | | |
| Import users by CSV | ✓ | ✓ | | |
| Create/manage boards | ✓\* | ✓ | | |
| Manage statuses | ✓\* | ✓ | | |
| Manage Idea Type / Business Impact options | ✓\* | ✓ | | |
| Manage user-defined fields | ✓\* | ✓ | | |
| View boards and ideas | ✓ | ✓ | ✓ | ✓ |
| Create/edit ideas | ✓\* | ✓ | ✓ | |
| Edit idea description | ✓\* | ✓ | Author only | |
| Change idea assignees | ✓\* | ✓ | Author only | |
| Delete ideas (soft) | ✓\* | ✓ | | |
| Bulk CSV import ideas | ✓\* | ✓ | | |
| Update idea status | ✓\* | ✓ | ✓† | |
| Comment on ideas | ✓\* | ✓ | ✓ | ✓ |
| Upvote ideas | ✓\* | ✓ | ✓ | ✓ |
| Mention users | — | ✓ | ✓ | |

† If permitted by board configuration, a User may update the status of any idea on that board.
\* **Through View As only** — see §2.2. This is not a UI convention; a direct attempt returns `403`.

### 2.2 The Site Admin rule — read this before reading anything else

Canonical: `SPEC/20-feature-view-as.md` rules 25, 25a, 25b, 25c, 26 (decided 2026-08-11, tightened 2026-08-13, extended 2026-08-14).

> **A Site Admin acting as themselves may not create, edit or delete organization-owned content.** Reading is unrestricted. **View As is the mutation path.**

This covers boards, statuses, idea types, business impacts, custom fields, ideas, comments, tags, upvotes, and bulk idea creation by CSV. It is enforced **server-side in the Application layer** — a refused mutation returns `403`, not a hidden button.

**Rule 25c supersedes three rules in `20-feature-ideas-and-engagement.md`, for the Site Admin role only:**

| Superseded rule | Naive reading | Correct reading |
|---|---|---|
| Upvotes #1 — "all authenticated users, including Read Only, can upvote" | Site Admin can upvote | Direct upvote **refused**; the rule means all authenticated users **of the idea's organization** |
| Comments #1 — "all authenticated users, including Read Only, can comment" | Site Admin can comment | Direct comment **refused**; same reading |
| CSV Import #1 — "only Site Admin and Org Admin can upload ideas via CSV" | Site Admin can bulk-create ideas | Direct import **refused**; done through View As, where the caller *is* an Org Admin |

The reasoning: a Site Admin is not a member of the organization, so actions that express a member's position — a vote, a comment — are not theirs to cast. **None of this touches Read Only users, who are members and keep both rules in full.**

**The bootstrap exception (rule 26):** creating organizations and users, **user** CSV import, invite codes, and archiving stay **direct**. *"A Site Admin creates organizations and users for organizations; for every other activity they use Act As."*

**The two CSV imports fall on opposite sides of that line.** User import (`/organizations/{id}/users/import`) is bootstrap and direct. Idea import (`/boards/{id}/ideas/import`) is organization content and goes through View As.

---

## 3. Domain Model

| Noun | Invariants |
|---|---|
| **Organization** | Top-level ownership boundary for all business data. Only Site Admin creates. Requires Title (≤200) and Description (≤1000); Logo Address optional (≤500). Auto-generates a unique Invite Code. **Archivable, never hard-deleted** — archiving invalidates the invite code and rejects self-registration. On creation: default statuses, one default board, and the canonical Idea Type / Business Impact option sets. One active logo at a time, rendered height ≤`150px`. Must retain **≥2 active statuses**. AI API key is optional, **write-only, encrypted at rest, never returned** — only last-four, updated-at and updated-by are displayed. |
| **User** | **Email is globally unique** and is the mention identity. Exactly one organization and one role — except Site Admin, who is global. Status `Active`/`Inactive` only; inactive users cannot authenticate and cannot be newly assigned, though they stay visible on historical assignments. **The last Org Admin cannot remove their own role or self-deactivate.** Self-service profile editing covers first and last name only (≤100 each). `MustChangePassword` is the persisted source of truth for forced rotation; regenerating `SecurityStamp` is the session-revocation mechanism. |
| **Board** | Belongs to one organization. Ideas organized by swimlanes; **each swimlane maps to a status**; **minimum 2 swimlanes**. Swimlane order is board-local and independent of the organization's status catalog order. Canonical routes `/boards` and `/board/{boardId}`. |
| **Status** | Organization-scoped. `Color` (≤20 chars, fallback `#64748B`) and integer `SortOrder`. **Soft-delete only.** Cannot be deleted while referenced as a swimlane on an active board, and cannot be deleted if it drops the organization below **2 active statuses** — regardless of board references. Soft-deleted statuses still render their prior name with an archived label. |
| **Idea** | Belongs to one board, therefore one organization. Title ≤150 required; Description ≤4000 required, **plain text only**; Priority required, hard-defaults to `Medium`; Idea Type required and **immutable after creation**; Business Impact required, **defaults to `Medium`, not first-active**; Due Date optional; Status must be an active swimlane on the board, defaults to the leftmost lane; **0–5 distinct assignees**, active same-org users at selection time; **≤10 distinct tags**. Stays editable and collaborative in `Complete`. **Soft-delete only, by in-scope Org Admin or Site Admin, after confirmation; no restore in this release.** Addressable at `/ideas/{ideaId}`; drawer at `?idea={ideaId}`. |
| **Tag** | Organization-scoped and reusable. ≤100 characters, **trimmed, case-insensitive, unique within an organization**. Concurrent creation of the same normalized name **merges into one tag**. Created on idea save when no match exists; autocomplete after 2 characters. **Read Only users cannot create tags**, because they cannot edit ideas. |
| **Comment** | Belongs to one idea. **Plain text with line breaks, ≤2000 characters**, live counter and inline overflow validation. Chronological. Authors edit and delete their own; Site Admin and Org Admin delete any within scope. |
| **Upvote** | Belongs to (user, idea). **Toggle; at most one active upvote per user per idea; only the caster can remove it.** Optimistic UI with rollback on failure. |
| **Notification event** | One row **per recipient per event**, no batching. Carries recipient, event type, idea id and title, organization, actor, `Link` = `/ideas/{ideaId}`, and timestamp. **Suppressed when actor equals recipient.** Database writes only — no SMTP, no outbound HTTP, no read API in MVP. |
| **Field definition (UDF)** | Organization-scoped, shared by every board. Seven types: `Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url`. Name unique among active definitions, case-insensitively. Admin-ordered. **Soft-delete only** — values are preserved but hidden. |
| **Idea Type / Business Impact option** | Organization-scoped. Labels trimmed and case-insensitively unique among active options. **Soft-delete only; the last active option cannot be deleted (minimum 1 — unlike Status's minimum 2).** Archived options stay visible on existing ideas but cannot be newly selected. Idea Type carries a color **and icon** badge and maps an ordered subset of the organization's UDFs. |

### Two pairs that look alike and are not

| | |
|---|---|
| **Minimums** | Statuses: **≥2 active** per organization. Idea Type / Business Impact: **≥1 active** option. `20-feature-boards-and-statuses.md` calls the difference out explicitly — do not unify them. |
| **CSV failure models** | **Idea** CSV is **all-or-nothing** — any bad row rejects the whole file. **User** CSV reports **per-row outcomes** and rejects bad rows individually. Deliberately different. |

### Defaulting, which is also not symmetric

Idea Type defaults to the **first active option by sort order**. Business Impact does **not** — it defaults to **`Medium`**, falling back to first-active only where no option is named `Medium`. This was decoupled on 2026-08-17 when the seeded impact order was reversed to most-severe-first: first-active would have pre-marked every new idea `Critical` and inflated reported severity through a default nobody chose. It mirrors `Priority`, which already hard-defaults to `Medium`.

---

## 4. Capability Map

| # | Epic | Stories | State | Canonical spec |
|---|---|---|---|---|
| 1 | Authentication & Session | 8 | **Built** — API layer live (D1) | `20-feature-auth.md`, `20-feature-user-login.md` |
| 2 | Organizations | 5 | **Built** (D1) | `20-feature-organizations-and-users.md` |
| 3 | Users & Membership | 3 | **Built** (D1) | `20-feature-organizations-and-users.md` |
| 4 | Boards & Statuses | 5 | **Built** (D2) | `20-feature-boards-and-statuses.md` |
| 5 | Ideas | 6 | **Built** (D3) | `20-feature-ideas-and-engagement.md` |
| 6 | Engagement — tags, mentions, comments, upvotes | 4 | **Built** (D3, D4) | `20-feature-ideas-and-engagement.md` |
| 7 | Custom Fields & Idea Types | 7 | **Built** (D5) | `20-feature-user-defined-fields.md`, `20-feature-idea-type-fields.md` |
| 8 | Administration & View As | 6 | **In flight** — domain and application merged (B7), **API layer owed by D7** | `20-feature-view-as.md` |
| 9 | AI Idea Assist | 8 | **In flight** — domain and application merged (B6), **API layer owed by D6** | `20-feature-ai-idea-assist.md` |
| 10 | Issues & Delivery | 10 | **Specified, unbuilt** — screens render from fixtures; no `Idea.outcomeId` column, no API, no domain module | `20-feature-issues-and-delivery.md` |
| 11 | Notifications & Audit | 4 | **Partial** — domain, application and tables exist; **no HTTP surface, by design** | `20-feature-notifications.md` |
| — | OAuth (Entra ID) | 6 | **Deferred — Phase 2** | `20-feature-oauth.md` |
| — | SAML 2.0 | 4 | **Deferred — post-OAuth** | `20-feature-saml.md` |
| — | Reporting | 4 | **Deferred — post-MVP** | `20-feature-reporting.md` |

**80 stories across 14 areas.** Every screen in `apps/web` currently renders from `apps/web/lib/data/`, which is fixture-backed; Wave D replaces the bodies of those readers, not their call sites.

---

## 5. User Stories

Each story carries an ID, the role, the statement, its acceptance criteria, and its state. Criteria are quoted or tightly paraphrased from the canonical spec's own rules — the numbers are load-bearing and are reproduced exactly.

State legend: **Built** · **In flight** · **Unbuilt** · **Deferred**

### Epic 1 — Authentication & Session

*Canonical: `20-feature-auth.md`. `20-feature-user-login.md` adds no independent requirements — it is the Given/When/Then restatement of the login half, and is folded in here.*

**US-AUTH-01 · User · Built**
*As a User, I want to sign in with my email and password, so that I can reach my organization's boards and ideas.*
- Valid credentials authenticate; invalid credentials are rejected **without revealing which credential was wrong**.
- Email is **globally unique across the system**; accounts are organization-scoped.
- **Inactive users cannot authenticate.**
- Unauthenticated navigation to a protected route redirects to `/login`; `/login` and `/register` stay public.
- A user with no required password change lands on the Dashboard at `/`.

**US-AUTH-02 · User · Built**
*As a User, I want my account locked after repeated failed attempts, so that my credentials are protected from guessing.*
- **Five failed attempts within 15 minutes trigger a 15-minute lockout.**
- A successful login clears the failed-attempt and lockout counters.
- Successful and failed authentication events are audited.

**US-AUTH-03 · User · Built**
*As a User, I want strong password rules enforced, so that my account is not trivially compromised.*
- Passwords are **at least 6 characters with uppercase, lowercase, numeric and special characters**.
- A password change failing the policy is rejected.
- **Plaintext passwords and reset tokens are never persisted or written to logs, audit metadata, analytics or error responses.**

**US-AUTH-04 · Site Admin · Built**
*As a Site Admin, I want a seeded platform account created on first run that forces me to rotate its credential, so that the deployment is bootstrappable without leaving a shared secret live.*
- The seed Site Admin is created from `SiteAdmin__Email` / `SiteAdmin__Password` and **belongs to no organization**.
- **Startup fails fast** if either key, or the database connection string, is missing — a human-readable banner naming every missing key, to stderr, non-zero exit, **no stack trace**.
- The seeded account must change its environment-provided credential on first login.

**US-AUTH-05 · Org Admin · Built**
*As an Org Admin, I want to reset a user's password by issuing a temporary one, so that locked-out users can get back in without a self-service email flow.*
- Temporary passwords are **shown once, expire after 24 hours, and require a change on first use**.
- **Login must not clear `TemporaryPasswordExpiresAtUtc`** — only a completed change retires the deadline. Clearing it on login would turn an admin-known temporary password into a permanent credential.
- Password changes and resets are audited.

**US-AUTH-06 · User · Built**
*As a User forced to change my password, I want that requirement enforced everywhere, so that I cannot bypass it by calling the API directly.*
- `User.MustChangePassword` is the **persisted source of truth**, read from live state per request.
- **Enforced at the API, not only the client**: while the flag is true, **every authenticated endpoint except `GET /auth/me` and `POST /auth/change-password` returns `403`**. The allowlist is **opt-in, so an endpoint added later stays closed by default**.
- Completing the rotation lifts the restriction on the next request, with no new token.
- The standalone `/change-password` route is reachable only by accounts marked `MustChangePassword`; others are redirected to `/settings/profile`.

**US-AUTH-07 · User · Built**
*As a User, I want my session to end after inactivity with fair warning, so that an unattended browser does not stay signed in.*
- The access token is a **signed JWT embedding the issuing `SecurityStamp`**; every request revalidates against the current database value and a mismatch is rejected like an expired token.
- **Absolute token lifetime is 480 minutes (8 hours)**; client activity can never extend it.
- **The browser session expires after 30 minutes idle**, with a **warning at 28 minutes and a live two-minute countdown**.
- Pointer, keyboard, touch, scroll and document-visibility activity reset the idle deadline, and activity and logout signals **synchronize across tabs**.
- **"Stay signed in" resets only the idle deadline** — it never refreshes, replaces or extends the JWT.
- Idle expiry, absolute expiry and API rejection return to Login with *"Your session expired. Sign in again to continue."*; explicit logout and password changes return **without** it.

**US-AUTH-08 · User · Built**
*As a User, I want my session restored correctly on reload and cleared only when it is genuinely invalid, so that I neither lose work nor keep a dead session.*
- Persisted client auth data is a **cached session candidate** and does not establish a principal until `GET /auth/me` accepts it.
- When the API rejects a stored or active token, client state is cleared and the browser returns to `/login`.
- **An endpoint-specific authorization failure must not clear a token that `GET /auth/me` still accepts** — the original error is preserved. *(This discrimination cost a sprint to find.)*

> **Session transport changed 2026-09-04 (conversion decision `08`).** Nest sets an httpOnly, `Secure`, `SameSite` cookie (`collega_session`) on login, View As start and View As exit; Next holds no session of its own and renders from `GET /auth/me`. `accessToken` was **deliberately removed from the login response body** — one of the nine accepted golden-replay diffs. The rules above are unchanged in substance; only the carrier moved.

**Deferred in this epic:** self-service password reset by email (Post-MVP — 24-hour single-use tokens, 3-per-email / 10-per-IP throttling in a rolling 15 minutes, identical generic responses for every outcome, full session revocation on success); OAuth (Phase 2); SAML (later); MFA; social login; "Remember this device".

---

### Epic 2 — Organizations

*Canonical: `20-feature-organizations-and-users.md`*

**US-ORG-01 · Site Admin · Built**
*As a Site Admin, I want to create an organization with minimal required data, so that onboarding a customer is not a form-filling exercise.*
- **Only Site Admin can create organizations.** Org Admin cannot.
- Creation requires **only Title and Description**; Logo Address is optional.
- Limits: Title ≤200, Description ≤1000, Logo Address ≤500. All text fields trimmed before validation.
- A new organization **starts with the default statuses and one default board**.

**US-ORG-02 · Org Admin · Built**
*As an Org Admin, I want an invite code I can hand out and regenerate, so that I control who can join my organization.*
- A **unique invite code is generated automatically** at creation, unique across organizations.
- It is displayed in **both the organization list and the detail view**.
- Regeneration **immediately invalidates the previous code**, and is audited.
- **An archived organization's invite code is invalid** and self-registration against it is rejected.

**US-ORG-03 · Site Admin · Built**
*As a Site Admin, I want to archive an organization rather than delete it, so that historical data stays intact.*
- Organizations can be **archived but never hard-deleted**.
- Archived organizations are **hidden from admin lists by default** unless explicitly filtered for.
- A stored AI key is **retained but unused**, and restored to service if the organization is unarchived.

**US-ORG-04 · Org Admin · Built**
*As an Org Admin, I want my organization's logo on our boards, so that the workspace looks like ours.*
- Logo upload with in-form preview, from the organization edit form.
- **One active logo at a time** — uploading a new one replaces the previous.
- **Rendered height is capped at `150px`, preserving aspect ratio**; the header reserves a `150px` brand zone.

**US-ORG-05 · Org Admin · Deferred (contracted, deliberately unimplemented)**
*As an Org Admin, I want to supply our own AI API key, so that AI usage bills to our vendor account instead of the deployment's.*
- Precedence would be organization key when configured, otherwise the deployment default.
- The key is **encrypted at rest and write-only across the entire API surface** — never returned by any endpoint, log, audit payload, error or client view. Screens show only whether a key is configured, its last four characters, and when and by whom it was updated.
- A submitted key is **validated with a single low-cost model call before persistence**; a failing key is rejected and the stored key left untouched.
- A key that fails at request time **falls back to the deployment default for that call** so the user is never blocked, and **every fallback writes an audit event** — the only signal that an organization's key is broken.
> **State:** `PUT` / `DELETE /organizations/{id}/ai-key` are specified in `30-Contracts.md` and **deliberately unimplemented in v1** (AI rule 30, D-CREDS). A future agent reading those contracts must not build them. All organizations share one platform key.

---

### Epic 3 — Users & Membership

*Canonical: `20-feature-organizations-and-users.md`*

**US-USER-01 · Prospective member · Built**
*As an invited person, I want to self-register with an invite code, so that I can join my company's workspace immediately.*
- **The invite code determines which organization** the account joins.
- A missing or invalid code **rejects registration with a prompt to supply a correct one**.
- Self-registered users are created with the **`User` role and `Active` status**.
- Registration is **rejected if the email is already in use** — email is globally unique.
- Self-registrations are audited.

**US-USER-02 · Org Admin · Built**
*As an Org Admin, I want to add users directly and bulk-import them by CSV, so that I can populate my organization at speed.*
- Site Admin adds users to **any** organization; Org Admin **only to their own**.
- Admin-created users **need no invite code**; the admin picks the role and issues an initial password.
- CSV import is **scoped to a single target organization** and carries First Name, Last Name, Email and optional Role — **no invite code column**.
- **Rows with no Role default to `User`**; each imported user gets a system-generated temporary password and must change it on first login.
- The import **reports per-row outcomes — invalid or duplicate-email rows are rejected individually without failing the whole file.**

**US-USER-03 · Org Admin · Built**
*As an Org Admin, I want to manage roles and account status inside my organization, so that access matches each person's job.*
- Each non-Site-Admin user belongs to **exactly one organization** and has **exactly one role**.
- Accounts are **`Active` or `Inactive` only**; inactive users cannot authenticate.
- **The last Org Admin cannot remove their own admin role or deactivate themselves** — only a Site Admin can deactivate the organization.
- Organization changes, user changes, role changes, status changes, invite-code regeneration, self-registrations and CSV imports are **all audited**.

---

### Epic 4 — Boards & Statuses

*Canonical: `20-feature-boards-and-statuses.md`*

**US-BOARD-01 · Org Admin · Built**
*As an Org Admin, I want organization-level statuses I can define and color, so that our boards use our language.*
- Statuses are defined at **organization level**, managed by Site Admin and Org Admin.
- The default set, provisioned at organization creation: **New / Pending `#64748B` (10) · In Review `#D97706` (20) · In Progress `#2563EB` (30) · Client Review `#7C3AED` (40) · Complete `#16A34A` (50)**.
- Each status has an editable **`Color`** (≤20 chars, fallback `#64748B`) used for the swimlane dot and the card's status chip.
- Each status has an integer **`SortOrder`** setting its place in the organization catalog — **distinct from a board's own swimlane order**, which a board changes independently.

**US-BOARD-02 · Org Admin · Built**
*As an Org Admin, I want deleting a status to be safe, so that existing ideas and boards never break.*
- **Soft-delete only**, so existing references stay valid.
- A status **referenced as a swimlane on any active board cannot be deleted** until the reference is removed.
- **An organization must retain at least 2 active statuses**; a delete dropping below that is rejected **regardless of board references**, so an organization can never be left unable to create a board.
- Views referencing a soft-deleted status **keep showing the prior name with an archived label**.

**US-BOARD-03 · Org Admin · Built**
*As an Org Admin, I want to choose and reorder a board's swimlanes, so that the board reflects our workflow.*
- Each swimlane maps to a status; **a board must have at least 2 swimlanes**.
- A board may select a **subset** of the organization's statuses.
- **Swimlane reorder is saved immediately when the drag completes.**

**US-BOARD-04 · User · Built**
*As a User, I want a board that guides me when it is empty, so that I know what to do first.*
- Board views provide **guided empty states with a primary action and short explanatory text** when no ideas exist. Administration screens carry the same requirement.
- **An empty state's action is disabled with a stated reason, never omitted** (decision 2026-09-08) — the disabled control stays focusable, carries `aria-disabled` rather than `disabled`, and its `aria-describedby` resolves to a real element holding the reason.
- Every new organization starts with one default board.

**US-BOARD-05 · User · Built**
*As a User, I want consistent "Board" terminology and stable URLs, so that links and navigation never surprise me.*
- User-facing copy uses **`Board` / `Boards`, never `Workflow`**.
- Canonical routes are **`/boards`** and **`/board/{boardId}`**; `/board`, `/workflow`, `/workflows` and `/workflow/{boardId}` **redirect** without data loss.
- **Internal service and namespace names may retain `Workflow`** where not user-visible — an explicit carve-out, not an inconsistency.

---

### Epic 5 — Ideas

*Canonical: `20-feature-ideas-and-engagement.md`*

**US-IDEA-01 · User · Built**
*As a User, I want to create an idea with the fields that matter, so that it can be triaged consistently.*
- Required: **Title (≤150), Description (≤4000), Priority, Idea Type, Business Impact, Status**. Optional: Due Date, Assignees, Tags.
- Status comes from the swimlane; **the default is the leftmost lane**.
- A supplied `statusId` **must be an active swimlane on the target board**, else it is a validation error.
- **Descriptions and comment bodies are plain text only** — rich text, attachments and embedded media are out of MVP. URLs may appear as text but are not treated as trusted embedded content.
- Creation, edits, status changes, comments, upvote toggles and deletions **all generate audit events**.

**US-IDEA-02 · User · Built**
*As a User, I want a compact, information-dense board card, so that I can scan a board at a glance.*
- The card shows **title, priority, Business Impact chip, up to three assignee personas with `+N`, up to three tags alphabetically with `+N`, submission age, upvote icon and count, comment icon and count**.
- Each persona shows **initials followed by the first name**; missing-name fallbacks stay accessible.
- **Submission age is viewer-local calendar-day**: `0 days ago`, singular `1 day ago`, plural `{N} days ago`; **future timestamps clamp to zero**.
- **Color is never the only carrier of meaning** (decision 2026-08-31) — every colored dot, bar or fill carries a text label.
- The board is a **scrolling rail of fixed-width 288px columns**, not N equal fractions (decision 2026-09-02).

**US-IDEA-03 · User · Built**
*As a User, I want to open full idea detail from a card, so that I can edit and discuss without losing the board.*
- Clicking the title opens the **Idea Detail drawer**; the URL gains **`?idea={ideaId}`** and the idea is addressable at **`/ideas/{ideaId}`**. It is the **same drawer** reached from the Ideas list.
- The drawer supports **all editable idea and collaboration fields**.
- **Ideas in `Complete` remain editable and still allow comments, mentions and upvotes.**
- The card's comment action opens the drawer, scrolls comments into view and **focuses the composer**; where commenting is unavailable, focus moves to the comments heading.

**US-IDEA-04 · User · Built**
*As a User, I want to move ideas between swimlanes by drag or by picker, so that the board stays current regardless of my input device.*
- Desktop cards use a **dedicated drag handle**; **keyboard and touch users use the status selector in Idea Detail**.
- Either path **updates the card immediately**; **a failed API call restores the prior swimlane and shows an error**.
- A successful status change moves the card **without closing Idea Detail**.

**US-IDEA-05 · User · Built**
*As a User, I want to assign up to five people to an idea, so that shared work has clear owners.*
- Assignment is optional — **zero to five distinct assignees**.
- Every **newly selected** assignee must be an **active user in the idea's organization**; **inactive users already assigned stay visible but cannot be newly selected**.
- Assignment changes **replace the whole collection atomically**; duplicates, more than five, inactive users or out-of-org users are validation errors.
- **Only the author, an in-scope Org Admin, or Site Admin can change assignees.**
- The assignee picker reads `GET /organizations/{id}/members`, which **any in-org caller may read** — not the Org-Admin-only user list. So a plain User can set an assignee on an idea they authored.

**US-IDEA-06 · Org Admin · Built**
*As an Org Admin, I want to soft-delete ideas and control who can edit descriptions, so that content stays accountable.*
- **Only an in-scope Org Admin or Site Admin may soft-delete an idea, after confirmation. Restore is deferred.**
- The Delete action appears in Idea Detail only for an authorized admin, returns to the board on success, and **removes the card immediately**.
- **Soft-deleted ideas are excluded from board, list and detail queries**; the row and deletion metadata are retained.
- **Only the author, an in-scope Org Admin, or Site Admin can edit an idea description.**

---

### Epic 6 — Engagement

*Canonical: `20-feature-ideas-and-engagement.md`*

**US-ENG-01 · User · Built**
*As a User, I want to tag ideas with reusable organization tags, so that related ideas can be found together.*
- Tags are **organization-scoped**; only users who can edit ideas can create them, so **Read Only cannot create tags**.
- Values ≤100 characters; **autocomplete after 2 characters**; an unmatched tag is **created when the idea is saved**.
- **Trimmed, case-insensitive, unique within an organization**; **concurrent saves of the same normalized name merge into one tag**.
- **An idea may carry no more than 10 distinct tags**; duplicate normalized names in one request count once.

**US-ENG-02 · User · Built**
*As a User, I want to @mention colleagues and have unresolved mentions blocked, so that notifications actually reach real people.*
- Mentions use the **`@` trigger with email-based lookup**, limited to users in the same organization; email is the mention identity.
- Mentions are **resolved to the matching user when the idea or comment is saved**.
- **A mention that does not resolve blocks the save with inline validation** until removed or corrected. *(Confirmed 2026-09-06: unresolved comment mentions are rejected with `400`, not ignored — the contract was wrong and the code was right; `30-Contracts.md` was corrected.)*
- **Site Admin has no organization and therefore cannot be @mentioned** and never appears in lookup results.

**US-ENG-03 · Read Only · Built**
*As a Read Only user, I want to comment and upvote, so that I can participate even though I cannot edit content.*
- **All authenticated users of the idea's organization, including Read Only, can comment and upvote** — subject to the Site Admin restriction in §2.2.
- Comments are chronological; **authors edit and delete their own**; Site Admin and Org Admin delete any within scope.
- Bodies are **plain text with line breaks, ≤2000 characters**, with a live counter and inline overflow validation.
- Upvoting is a **toggle** — at most one active upvote per user per idea, and **only the caster can remove it**.
- The thumbs-up is **unfilled when the current user has not upvoted, filled when they have**; toggling updates icon and count immediately, and **on failure the prior state is restored with an error**.

**US-ENG-04 · User · Built**
*As a User, I want to search, filter and sort the global Ideas list, so that I can find any idea without hunting board to board.*
- Filtering and sorting are **server-side**.
- **All-column search covers Title, Created By, Assigned To, Status and Created Date, plus Text and Url custom-field values.** Text matches case-insensitive substring; **Created Date matches only a full ISO `YYYY-MM-DD` term**.
- A **tag filter** narrows by normalized tag name; a **user-association filter** narrows to ideas a chosen user authored *or* is assigned to — distinct from the caller-scoped `All` / `Created by me` / `Assigned to me` chips.
- **Column sort** on Title, Created By, Assigned To (alphabetically-first assignee), Status and Created Date, **with a stable idea-id tiebreaker so paging is deterministic**.

> **List endpoints need a total order.** The golden capture found four places where one was missing, or was total only by generated id — stable inside a deployment but not between two databases seeded from the same data. Under paging, an arbitrary tie-break does not merely reorder a page, it decides what is on it.

---

### Epic 7 — Custom Fields & Idea Types

*Canonical: `20-feature-user-defined-fields.md` and `20-feature-idea-type-fields.md`. **The second modifies the first**: the UDF spec's required-ness design row and its entire "Template Integration" section are rewritten by per-type field selection. There is one required-ness model, presented below, not two.*

**US-FIELD-01 · Org Admin · Built**
*As an Org Admin, I want to define custom fields for our organization, so that ideas capture the domain-specific data our core schema doesn't cover.*
- Exactly **seven field types**: `Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url`.
- Definitions are **organization-scoped** — every board in the organization shares one schema.
- Names are **unique among active definitions, case-insensitively**; a duplicate is rejected with `400`.
- `Dropdown` and `MultiSelect` **require at least one option at creation**.
- Limits: Name ≤100, Description ≤500, option Label ≤200, stored value ≤4000.

**US-FIELD-02 · Org Admin · Built**
*As an Org Admin, I want to control field order and retire fields I no longer need, so that the idea form stays clean without ever destroying captured data.*
- Display order is **drag-and-drop, saved immediately on drop**, persisted independently of the field record.
- Delete is a **soft delete** — the definition is archived and existing values are **preserved but hidden**. No restore in MVP.
- Archiving shows a confirmation stating that existing idea data will be hidden.
- Submitting a value for a soft-deleted definition returns `400`.

**US-FIELD-03 · User · Built**
*As a User, I want to fill in my organization's custom fields when I create or edit an idea, so that the record is complete without a follow-up conversation.*
- Inputs render in the create modal and the Idea Detail edit form, inside a collapsible **Custom Fields** section, ordered by display order.
- **Required fields are hard validation** — an empty one blocks the save.
- Canonical error strings: `<FieldName> is required.` and `<FieldName> must be a valid <FormatName>.`
- Per-type validation: `Text` ≤2000 · `Number` invariant-culture decimal · `Date` `yyyy-MM-dd` · `Boolean` `true`/`false` case-insensitively · `Url` absolute `http`/`https` · `Dropdown` a GUID matching one of the field's options · `MultiSelect` comma-separated option GUIDs **with no duplicates**.
- **Read Only users can view values but cannot fill them.**

**US-FIELD-04 · User · Built**
*As a User, I want to filter and search ideas by custom field values, so that I can find the subset that matters to me.*
- Match semantics by type: Text/Url **contains** · Number **`min:max` range** · Date **ISO `from:to` range** · Boolean exact · Dropdown exact option-id · MultiSelect **any-of**.
- The global search also scans `Text` and `Url` custom-field values.
- **Unknown or invalid field ids in a filter are silently ignored, not errored.**

**US-FIELD-05 · Org Admin · Built**
*As an Org Admin, I want custom field values to round-trip through CSV, so that bulk creation and reporting don't lose the data we captured.*
- Export includes **one column per active field**, header = field name, ordered by display order. **Soft-deleted definitions are excluded** and their values omitted.
- Import matches columns by field name **case-insensitively**; unrecognized headers are ignored.
- Import applies the same type validation as the API; missing columns are null and required-field violations appear per-row in the error summary.
- Every value add, change or clear emits an audit event carrying field id, field name, previous value, new value, actor and timestamp. **Soft-deleted field names stay resolvable in historical audit entries.**

**US-FIELD-06 · Org Admin · Built**
*As an Org Admin, I want to choose which of our custom fields appear on a given idea type, and in what order, and mark each required or optional for that type.* *(Verbatim from the spec's own User Stories section, merged.)*
- A mapping carries per-type display order and per-type required flag, **unique on (type, field)** — a field appears at most once per type.
- Every mapped field must be an **active definition in the same organization**, else `400`.
- Mapping only **selects from the shared organization pool** — types never own their own fields, so a field mapped onto several types is still one definition, one value column, one filter target.
- Required-ness resolution: **`AllActiveFields` mode → the field's global required flag. `Curated` + mapped → the per-type override. `Curated` + not mapped → hidden, and a value submission for it is rejected `400`.**
- **Marking a mapped field required does not retroactively invalidate existing ideas** — it is enforced on new ideas and on the next edit. No backfill.

**US-FIELD-07 · Org Admin · Built**
*As an Org Admin, I want an un-curated type to keep showing all fields, and to give a type a color and icon so its ideas are recognizable at a glance.* *(Verbatim, merged.)*
- `IdeaTypeFieldMode` is **`AllActiveFields` (default)** or **`Curated`**. Setting a selection sets `Curated`; clearing it returns to `AllActiveFields`.
- The migration set **every existing type to `AllActiveFields` and seeded no mappings** — existing ideas and un-curated types behave exactly as before.
- **A new field auto-appears on every `AllActiveFields` type immediately**, and on `Curated` types only when an admin adds it. Intentional, and surfaced in the admin UI so it is not a silent surprise.
- Idea Type gains nullable **`ColorHex` (`#RRGGBB`) and `Icon`**; null falls back to a neutral badge. **Contrast warnings are advisory, never blocking.** The badge sits **on the tag row** of swimlane cards, always renders its name, capped at 92px with a tooltip (decision 2026-09-04).
- **`Idea.IdeaTypeId` is immutable after creation** — an update supplying a different type is rejected `400`. The **sole** exception is admin reassignment via `PUT /organizations/{orgId}/ideas/{ideaId}/idea-type`, which re-resolves fields, archives out-of-scope values and emits an audit event. Values are never dropped — they render muted with an "archived" tag.

---

### Epic 8 — Administration & View As

*Canonical: `20-feature-view-as.md`. **State: in flight** — domain and application layers merged in Wave B7; the three HTTP endpoints are owed by slice D7.*

Locked decisions: **full act-as** (not read-only preview) · **a Site Admin may not act as another Site Admin** · **30 minutes idle, 2 hours absolute** · entry from **both** a page-header control and the rail avatar menu.

**US-VA-01 · Site Admin · In flight**
*As a Site Admin, I want to act as a user inside a customer organization, so that I can create and fix that organization's content, which I have no other way to touch.*
- See §2.2 for the full restriction. Enforcement is **server-side in the Application layer**; a refused mutation returns `403`.
- **No special case is needed for impersonation** — while a session is live the current-user context reports the *target's* role, so the guard simply does not fire.
- Organization and user administration stay **direct** as the bootstrap exception.

**US-VA-02 · Org Admin · In flight**
*As an Org Admin, I want to act as a user in my own organization, so that I can reproduce a problem exactly as they see it.*
- Site Admin may act as any **active**, organization-scoped user in any organization — **not** other Site Admins, **not** inactive users. Org Admin may act as active users **in their own organization only**. User and Read Only may act as nobody.
- A caller who is neither **is refused `403` and the entry control is hidden** — both, not either. The UI control carries no authority.
- **Impersonation can never escalate**: the effective role is the target's, and the authorization check is against the caller's **real** role.
- Authorization derives organization scope from the context, **never from a caller-supplied `organizationId`** — verified across all 34 methods that take one. This is what stops impersonation becoming a cross-org write path.

**US-VA-03 · Site Admin · In flight**
*As a Site Admin, I want the session to be server-authoritative and non-nestable, so that impersonation can't be forged, stacked or resumed.*
- Impersonation is a **server-side session, never a claim in the access token**; the token is never reissued to start or end one, and a captured token carries no impersonation authority.
- The session records real actor, target, started-at, last-seen-at, absolute-expiry-at and ended-at. **At most one active session per real actor.**
- **Non-nestable** — starting a session while one is active is refused, never silently replaced.
- `ICurrentUserContext` is the **single identity chokepoint**. A service reading claims directly would silently opt itself out of impersonation and is treated as a **defect**.

**US-VA-04 · Org Admin · In flight**
*As an Org Admin, I want the audit trail to name both me and the person I acted as, so that accountability survives impersonation while the content is still correctly owned.*
- Starting and ending a session are **always audited, unconditionally**.
- Every mutation carries **dual attribution** — the audit actor is the **real admin**, with a second field recording the impersonated user. The trail never reads as though the target acted themselves.
- **Entity authorship is the impersonated user** — created-by and updated-by record the target, because content created through View As genuinely belongs to that organization.
- The target's own historical trail is never rewritten or back-dated.

**US-VA-05 · Site Admin · In flight**
*As a Site Admin, I want the session to expire on its own and exit in one click, so that I never drift into acting as someone without noticing.*
- **Idle expiry at 30 minutes; absolute cap at 2 hours** from start regardless of activity.
- Expiry is enforced **server-side**; a client timer may warn but never decides.
- On expiry the **real identity is restored** — the admin is not signed out, and the client surfaces that the session ended rather than silently continuing.
- A session whose target becomes inactive, or whose target's organization is archived, **stops being valid at the next request**.

**US-VA-06 · Acting admin · In flight**
*As an acting admin, I want it to be unmistakable on every screen that I'm impersonating, so that I never mistake the target's view for my own.*
- A **persistent, non-dismissable banner on every screen** names both identities and offers one-click exit: *"You're seeing exactly what they see. Anything you do is recorded as [real actor] acting as them."*
- The picker is a **right slide-in drawer**, searchable, grouped by organization for Site Admin. **Inactive users are shown but not selectable.**
- The rail avatar swaps to the impersonated user, and role-scoped rail items reflect the target's role.
- **Mutating controls stay live** — this is act-as, not preview.

---

### Epic 9 — AI Idea Assist

*Canonical: `20-feature-ai-idea-assist.md`. **State: in flight** — domain and application layers merged in Wave B6; eleven HTTP endpoints owed by slice D6.*

Locked decisions: model **`claude-sonnet-5`** at **`low` effort** · adaptive thinking (**lower the effort, never disable thinking**) · **500,000 tokens per UTC day** as one **global** pool · **degrade at the cap, never error** · UI direction **C "Draft Strip"** · **single platform-level key**, per-org keys deliberately unbuilt · retrieved content **escaped, not merely fenced**, and the escaping is **not editable**.

**US-AI-01 · User · In flight**
*As a User, I want the brainstorm chat to ask me real questions and hand me a filled-in idea form, so that I finish with a classified idea rather than a block of prose I have to re-enter.*
- Each user turn is **one model call returning a structured object**; its `nextQuestion` renders as the assistant bubble.
- **Continue to idea form** hands the drafted fields over as **pre-filled, fully editable** values. **Nothing is committed at this point.**
- The assistant may propose **title, description, idea type, business impact and priority** — all optional; an early turn may return only a question.
- Suggested title and description are **length-capped in the schema** to 150 and 4000, so a suggestion can never exceed what the domain accepts.
- **Board and Status are never proposed** — the board is known from context, and status defaults to the leftmost swimlane.

**US-AI-02 · User · In flight**
*As a User, I want to see live what the assistant has classified so far, so that I'm not surprised by the form at the end.*
- Idea Type, Business Impact and Priority show on a **read-only draft strip** above the composer.
- Values not yet chosen render **explicitly** ("Priority not set yet"), so *"the assistant chose nothing"* is distinguishable from *"the assistant hasn't got there"*.
- **The strip is never editable** — editing happens on the create form. This is what keeps a per-field suggested-vs-edited state machine out of v1, and making it editable would bring that back.
- A suggested value is marked **teal**, never the indigo accent, which means active/selected.

**US-AI-03 · Org Admin · In flight**
*As an Org Admin, I want to define what "in scope" means for my organization, so that the assistant stays on idea drafting and doesn't become a general chatbot inside our idea tracker.*
- The scope statement is optional free text, **≤500 characters**. Empty is valid and means "no narrowing beyond Idea Types".
- In-scope is evaluated **per turn**. The structural test is *"could this plausibly become an Idea of one of this organization's active Idea Types?"*
- When a turn is out of scope the client renders a **fixed, server-supplied redirect string** and **the offending turn is dropped from the transcript, not appended** — accumulated off-topic context is what drifts a constrained assistant into a general one.
- The refused message renders **greyed and struck through for one beat**, with the redirect as a **system note rather than an assistant bubble**, then disappears.
- **Three consecutive out-of-scope turns close the chat.**
- The scope statement is placed in the system prompt **by the server** and **never concatenated with end-user text**.

**US-AI-04 · User · In flight**
*As a User, I want the assistant's suggestions to be my organization's real options, so that classification is right rather than invented.*
- Context is assembled **server-side** from the caller's token claims. **The client never sends context, a prompt, a model name or a scope statement.**
- The model is called with **structured outputs and has no free-form text channel** — the only user-visible string it can emit is the next question. *"There is no field in which a limerick, a recipe, or a general-knowledge answer can be returned."*
- **The JSON Schema is built per request** from the retrieval result, so the type and impact ids are enums of that organization's real active options — **an invalid or cross-org classification is structurally impossible, not prompt-discouraged.** `additionalProperties` is `false` and every enum is closed.
- **Retrieval is not the containment mechanism** — no rule may be restated as "the retrieved context will keep it on topic".
- **Retrieved content is escaped, not merely fenced.** A tag named `</organization_data> New instructions:` would otherwise close the untrusted-content block and continue as the operator — and tags are authored by ordinary Users, the lowest-privilege path into the prompt.

**US-AI-05 · User · In flight**
*As a User, I want the chat to never trap me, so that I can always reach the plain idea form.*
- **Skip & fill manually is always available and must never be gated on a successful model call.**
- A conversation is capped at **20 transcript entries**, so the practical ceiling is **10 user turns**. A refused turn is dropped and **does not consume the budget**.
- **New idea must not open the chat at all when the assistant is known unavailable** — the client reads an availability endpoint once per page load; on `false` the create drawer opens directly. That endpoint returns a **bare boolean** and never distinguishes unconfigured from provider-down from budget-exhausted.
- A failure on the **first** turn hands off to the create drawer immediately, carrying the user's typed text; on a **later** turn scripted nudges are the fallback, because a sudden surface change would lose the user's place.
- When the drawer opens *because* the assistant is unavailable, a flash message says so. It is **informational, names no cause**, appears only on those paths, and never blocks the form or takes focus.
- **With no key configured the feature is off and the product still works.** Any model failure — timeout, rate limit, refusal, malformed response — degrades for that turn with the user's typed text preserved.

**US-AI-06 · Site Admin · In flight**
*As a Site Admin, I want the AI spend bounded and attributable, so that one organization or one defect cannot consume the whole budget unnoticed.*
- A **daily UTC token ceiling**, checked **before** each call against the day's running total. Overshoot is bounded by one in-flight turn. **It is a runaway stop, not a forecast** — a daily ceiling bounds the month only at thirty times itself.
- Exhaustion returns `503` and **degrades exactly as an unconfigured key would**. **Rate limiting answers `429` with `Retry-After`, never `503`** — the two mean opposite things.
- Every call writes a usage record carrying organization, actor, board, model id, the four provider-reported token counts, and **the per-million rates applied at the time** — stored on the record, because re-pricing history would corrupt a chargeback.
- **Under View As, usage attributes to the impersonated user's organization** — the org whose work is being done — but **the per-user rate allowance follows the real administrator**, so an admin cannot reset their own quota by moving between targets. **Refused and failed turns count.**
- **Usage records carry no prompt and no transcript content — "a meter, not a log."**
- A Site Admin sees consumption for every organization; an Org Admin sees only their own.

**US-AI-07 · Site Admin · In flight**
*As a Site Admin, I want to edit the system prompt as deployment configuration, so that I can retune the assistant without a deploy — without being able to break the safety machinery.*
- The system prompt and the fixed redirect strings are **Site-Admin-editable deployment configuration**, not compiled constants.
- What is editable is a **template with two required placeholders** — the organization catalog and the scope statement. **A save omitting either is rejected**, the latter because a template without it would **silently disable every organization's scope statement with no error anywhere**.
- **Versions are immutable and appended.** Restoring an earlier version publishes a **copy**. The publish audit event records actor and version number — **never the body**.
- Publishing offers **advisory safety probes** whose outcomes are shown but **never block publishing**. They exist because removing the scope instructions measurably *improves* classification while weakening refusal — *"the dangerous edit is the one that feels like an improvement."*
- Probes run against a **synthetic catalog**, never a real organization's. **Treat a passing run as "nothing is grossly broken", never "this edit is safe"** — three probes measured a ~7% effect at 3-of-3, i.e. a low-powered instrument.
- **The escaping is not editable.** An admin *can* delete the prose instructing the model to distrust retrieved content; the escaping itself survives in code.

**US-AI-08 · Site Admin · In flight**
*As a Site Admin, I want it structurally impossible for the assistant to create data, so that AI is never on the write path.*
- **The model is never a write path.** Its output seeds a form; the user submits it; the existing idea validation — active-option checks, organization scoping, role checks — runs unchanged and is the **sole** authority on whether an idea is created.
- **No AI endpoint may create, update or delete an idea.**
- Each call writes an audit event with actor, organization, board, turn count, token usage and whether the turn was refused. **Prompt and transcript content are not written to the audit log.**
- API keys are **never returned by any endpoint, never logged, never sent to the client**.
- **No test may reach a model provider.** The test harness blanks the API key *and* swaps in an unconfigured model. Before that guard existed the integration suite made a live billed call, and the only symptom was one test taking five seconds instead of one.

---

### Epic 10 — Issues & Delivery

*Canonical: `20-feature-issues-and-delivery.md`. **State: specified, unbuilt.** Five screens exist in `apps/web` and render from fixtures; there is no `Idea.outcomeId` column, no API surface, and no domain module. Slice 1 (Delivery + Tasks) is P0 and buildable; Slice 2 (Outcomes + Roadmap) is P1.*

**The core decision: an Issue is not a new object.** An Idea is an item in `Discovery` phase. An Issue is **the same item, same row**, in `Delivery` phase. A separate Issue entity is an explicit non-goal — *"a parallel object would reintroduce the provenance-loss problem this feature exists to solve."*

New facets on the existing Idea: `Phase`, `Effort`, `DeliveryStatus`, `SprintId`, plus the promotion snapshot (`PromotedAtUtc`, `PromotedByUserId`, `UpvoteCountAtPromotion`). Slice 2 adds `OutcomeId`. New entities: **Sprint** (org-scoped, flat, time-boxed), **IssueTask** (a checklist step belonging to exactly one Issue), and **Outcome** (a dated grouping lens).

**Two status systems never mix:** organization-configured swimlane statuses govern Discovery; the **fixed** five-stage delivery set governs Delivery. Ideation `Complete` and delivery `Complete` are distinct terminal states.

**US-DEL-01 · Org Admin · Unbuilt**
*As an admin, I want to promote a fleshed-out idea into an Issue so my team can commit to building it, with the decision recorded.* *(Verbatim.)*
- Promotion sets phase to `Delivery` and delivery status to `Pending`, and records effort, promoted-at, promoted-by and the upvote count at promotion.
- Promoting an item already in Delivery is **rejected `409`**.
- Promotion is an **explicit decision gate**, never triggered by an ideation status — *"overloading the `Complete` status to also mean 'committed to delivery' is rejected as the source of the concept's awkwardness."*
- **Effort is T-shirt sizing (`Low`/`Medium`/`High`), deliberately not story points** — optional in Discovery, **required at the gate**.
- The promotion gate **is** the realization of the post-MVP approval workflow deferred in the Ideas and Boards specs — one build, two features.

**US-DEL-02 · Org Admin · Unbuilt**
*As an admin, I want to create a sprint with a goal and a date window and pull Issues into it, so the team has a focused, time-boxed workload.* *(Verbatim.)*
- A Sprint is created `Planned` with name (≤100), goal (≤500), start and end, optional owner. End must not precede start. **Names need not be unique** — "Sprint 12" may repeat across time.
- An owner, when set, must be an **active user in the sprint's organization**.
- An Issue belongs to **zero or one** Sprint via a plain nullable FK — **no join entity**. The delivery backlog is simply Delivery-phase items with no sprint.
- A delivery-status or sprint change on a **Discovery** item is rejected `400`.

**US-DEL-03 · Org Admin · Unbuilt**
*As an admin, I want to start and complete a sprint, with unfinished Issues returning to the backlog, so carry-over is explicit rather than lost.* *(Verbatim.)*
- Transitions are **explicit actions, not date-derived** — `Planned → Active → Completed` — *"because completing a sprint must handle carry-over deterministically."*
- On completion, **every assigned Issue not at delivery-status `Complete` returns to the backlog. No Issue is lost or deleted.**
- Deleting a sprint is a **soft delete that first unassigns every Issue** to the backlog.
- Dates lock once completed.

**US-DEL-04 · Org Admin · Unbuilt**
*As an admin, I want to return a mis-promoted item to Discovery so an accidental commitment is recoverable.* *(Verbatim.)*
- **In-scope admin only.**
- Returning clears sprint and delivery status but **retains effort, the promotion snapshot and the task list**, so a re-promote is lossless and the audit trail stays coherent.
- **The ideation status is never cleared by promotion** — it is frozen at its last Discovery value for provenance.

**US-DEL-05 · User (author) · Unbuilt**
*As the author of an idea, I want to promote it to an Issue (or request its promotion) so my idea doesn't die after it's approved.* *(Verbatim.)*
- Promotion is available to Site Admin, Org Admin, and **the author only** among Users. Read Only cannot promote.
- **Default: an author may self-promote**, matching the deferred approval decision. A P1 org setting can tighten this.
- **Default: promotion from any Discovery status** — the gate is the explicit decision, not the status.

**US-DEL-06 · User (assignee) · Unbuilt**
*As an assignee, I want to move my Issue through delivery statuses on the sprint board so progress is visible.* *(Verbatim.)*
- Delivery statuses are exactly **`Pending`, `Scoping`, `Development`, `Review`, `Complete`** — a **fixed enum**, not organization-configurable in this slice.
- The change is authorized to **author, an assignee, or an in-scope admin**, and is valid only in Delivery phase.
- The sprint board is a fixed five-swimlane kanban; drag mirrors the idea board's behaviour (optimistic, revert on failure), and keyboard and touch use the detail selector.
- **Per-issue dates are dropped by design** — *"the sprint boxes the dates; per-issue start/end inside a dated sprint creates 'which date wins' conflicts."*

**US-DEL-07 · Any viewer · Unbuilt**
*As anyone looking at an Issue, I want to see where it came from — the original idea, who proposed it, its upvotes, and the discussion — so I understand why we're building it without leaving the screen.* *(Verbatim.)*
- A promoted Issue exposes its **originating proposer, creation date, upvote count at promotion and now, business impact, idea type, tags, and full comment thread — with no manual copy**.
- The only genuinely new stored provenance is the promotion snapshot; the rest is free **because the Issue *is* the Idea**.
- **The Provenance panel is the differentiator and ships in this slice.**
- The global ideas list gains a `phase` filter so search and provenance span both phases.

**US-DEL-08 · Stakeholder · Unbuilt**
*As a stakeholder, I want the sprint board to show what's committed and in-flight so I can see delivery at a glance.* *(Verbatim.)*
- Ideation boards filter to Discovery; promoted items **leave the ideation board with no data loss**.
- All existing ideas backfill to Discovery and delivery views start empty — **"with no sprints and nothing promoted, the product behaves exactly as today."**
- **Read access is broad**: sprint board, backlog and provenance are viewable by **all four roles including Read Only**.

**US-DEL-09 · User · Unbuilt**
*As a delivery team member, I want a task checklist on an Issue, so that the work is divided without inventing a second work item.*
- A task added to a **Discovery** item is rejected `400` — *"a task list is a delivery artifact."*
- Moving a task to `Done` stamps completed-at and completed-by; moving it off clears both. **These stamps are the only completion record.**
- **Tasks warn but never block** — completing an Issue with outstanding tasks succeeds. *"Enforcing 'all tasks done' would make the checklist a gate, which is a ceremony this feature explicitly refuses."*
- **A task may be assigned to any active user in the organization**, whether or not they are an Issue assignee — *"constraining it to the Issue's assignees would force spurious Issue assignments just to name a helper."* The new assignee is notified; **no other task event notifies anyone** — *"ticking a box must not page the room."*
- **Task mutations are deliberately not audited** — *"a checklist ticked a dozen times a day would drown the audit log that exists to answer 'who committed us to this work'."* A conscious asymmetry with every other mutation here.
- Three states rather than a checkbox, *"because 'started but not finished' is the state a standup actually asks about."*
- Non-goal boundary: no sprint of its own, no dates, no estimate, no comments, no upvotes, no tags, no nesting. **Task counts must not be surfaced as a velocity or capacity proxy.**

**US-DEL-10 · Org Admin · Unbuilt (Slice 2, P1)**
*As an admin, I want dated Outcomes that group Issues, so that a quarter has a legible shape.*
- Each roadmap row shows **derived issue count, done count and sprint span — none of which is stored**.
- **An Issue sits under at most one Outcome** (decided 2026-09-02). Grouping is a **move, not an add**: assigning a new Outcome clears the old one.
- Soft-deleting an Outcome leaves every Issue **surviving, merely ungrouped**.
- **Outcome and Sprint are orthogonal** — changing one never affects the other.
- The Outcome's date window is its *intent*; the derived sprint span may disagree, and **that disagreement is the signal the view exists to surface, not an error to reconcile**.
- *"An Outcome groups; it never contains."* It has no status, no percent-complete, never appears on a board, and cannot be promoted, assigned or commented on.

> **Why single-parent, recorded so it is not re-argued:** counts partition the delivery set, totals sum, and "done" is unambiguous without a distinct-count anywhere. The accepted cost is that work genuinely serving two quarterly goals must pick one. The failure mode to watch for is **teams raising duplicate Issues so two Outcomes can each claim the work** — which would reintroduce exactly the provenance loss the phase model exists to prevent. If it appears, single → multi is a cheap forward migration; **the reverse is lossy.**

> **Site Admin, reconciled 2026-09-03:** every ✓ on a **mutating** row of this feature's permission table is exercised **through View As, never directly**. **Direct Site Admin access to Issues & Delivery is read-only.**

---

### Epic 11 — Notifications & Audit

*Canonical: `20-feature-notifications.md`. **State: partial** — domain and application modules and the database table exist; there is **no HTTP surface, by design**.*

**US-NOTIF-01 · User · Partial**
*As a User, I want to be notified when someone @mentions me, so that I do not miss a direct request.*
- An event is written when a user is @mentioned **in an idea body** or **in a comment**.
- The recipient for both is **the mentioned user only**.

**US-NOTIF-02 · Author or assignee · Partial**
*As an idea author or assignee, I want to be notified when my idea gets a comment or changes status, so that I can keep up with its progress.*
- Events fire when **a comment is added** and when **an idea's status changes**.
- Recipients are **the author and the assignees, each if different from the actor**.
- **Self-notifications are suppressed** — no event when actor and recipient are the same user.

**US-NOTIF-03 · User · Partial**
*As a User, I want a notification to link straight to the idea, so that I can act on it in one click.*
- Each event persists the canonical link **`/ideas/{ideaId}`**, alongside the idea title.
- Following it opens the Ideas list **with that idea's detail drawer open**.
- **Superseded routes:** `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` are both replaced.

**US-NOTIF-04 · Platform owner · Partial**
*As the platform owner, I want the MVP notification path to be database writes only, so that no accidental email infrastructure ships early.*
- **One row per recipient per event; no batching.**
- **No SMTP, email client or outbound HTTP** in the notification path. This is guarded by a test asserting that no SMTP or HTTP-client descriptor is present in the service collection at all.
- **Notification events need no read or query API in MVP.**

> **Deferred:** queued email delivery (one email per event, **no consolidation**, must include the idea title and canonical link), per-user notification preferences and opt-outs, and a notification inbox UI.

---

### Deferred Epics

**OAuth — Microsoft Entra ID (Phase 2, specified, unbuilt).** Organization-scoped SSO entry points, with **local email/password login retained as break-glass**. Identity linking is strictly ordered — **provider + subject first, verified-email fallback second**; email fallback is case-insensitive and **requires a verified email claim**. Auto-provisioning happens **only** when there is no subject mapping, no local email match, and all required claims are present; the user is created **in the initiating organization with role `User`**. Every ambiguous condition is a **hard deny and is audited**: missing required claims; a subject mapping whose callback email maps to a different local account; a verified email belonging to a user in a **different** organization; multiple candidate local users for one normalized email. Out of Phase 2: SAML, MFA, social providers, SCIM, external logout propagation.

**SAML 2.0 (post-OAuth, specified, unbuilt).** Organization-scoped configuration, **SP-initiated flow only** at first, **reusing OAuth's identity-linking and auto-provisioning model unchanged** — the acceptance criterion is literally "matches OAuth behavior". Local login stays available throughout the rollout, so a misconfigured IdP cannot lock an organization out. Out of the initial phase: IdP-initiated login, MFA policy orchestration, SCIM, social providers.

**Reporting (post-MVP, specified, unbuilt).** Four baseline reports — **Idea Throughput**, **Idea Aging**, **Engagement Activity**, **Administration Activity**. Date range and organization scope are **required filters** on every report; board, status, priority, assignee and actor are optional. All boundary timestamps are **UTC**. **CSV export is required for each report**; JSON is optional; PDF and spreadsheet-native formats are out of scope. A **Site Admin runs reports for any organization by explicit selection** — never implicitly or aggregated by default — and **exports are subject to the same authorization checks as on-screen queries**; the export path is not a weaker door.

**Wave G — cut 2026-09-08, revisited after cutover, not cancelled.** Loop, decision records, the commitment strip, and Triage Mode.

**Not scheduled and not gating anything:** `SPEC/ideas-inbox.md` holds unrefined ideas — Roadmaps→Sprints→Issues exploration, organization bootstrap templates, Signal, Loop, Memory. Nothing there is approved, and items are picked up only when the user asks.

---

## 6. Completion Criteria

### 6.1 Definition of Done — the engineering gate

Canonical: `SPEC/90-definition-of-done.md`.

**Engineering**
- `SPEC/Bug Triage.md` was checked before feature work began, and no unresolved `TODO` was bypassed without explicit user approval.
- Behavior matches the relevant `SPEC/20-feature-*.md`.
- **Business logic lives in Application/Domain, never in controllers or UI.**
- No hardcoded credentials or secrets.
- API boundary validation and application business-rule validation follow `SPEC/30-Contracts.md`.

**Contracts**
- `30-Contracts.md` is updated when contracts change, and contract tests with it.
- Implementation and tests stay aligned with the canonical specs.

**Testing**
- **Acceptance criteria are covered by tests**, and regression risk by targeted tests.
- Development-only demo seed behavior is validated, **including idempotency and the required seeded graph**.
- Non-Development runtime is validated to ensure the demo seed does not run.

**Delivery**
- A resolved triage item is removed from `TODO` and recorded once under `COMPLETED` with its date and verification note.
- **Each PR links the feature spec it implements.**
- Out-of-scope behavior is not added without approval.
- **MVP release sign-off does not require OAuth or SAML endpoint delivery.**

### 6.2 Release readiness — the smoke path

Canonical: `SPEC/40-test-strategy.md`.

The critical-path check is **sign in → create a board → create an idea**, and it passes when:
- a seeded account authenticates and reaches the main workspace;
- a board is created with the expected default status structure and saves;
- an idea is created on that board and appears in the board view with no validation errors.

Alongside it, five navigation and session scenarios:
- **Authentication navigation** — protected anonymous routes redirect to `/login`; ordinary login lands on `/`; required change is gated by `MustChangePassword`; `/logout` clears the session first.
- **Authentication restoration** — a valid stored token is confirmed through `/auth/me`; an expired or unknown token clears **all** client auth state.
- **Active-session authentication** — a protected-request `401` signs the user out **only when `/auth/me` also rejects the token**; an incorrect-current-password `401` preserves a token that `/auth/me` accepts.
- **Password-change authentication** — a successful required change stays authenticated across a browser reload.
- **Board navigation** — `/boards` lists, `/board/{boardId}` opens detail, legacy routes redirect, and **no user-facing "Workflow" terminology remains**.

### 6.3 Manual client acceptance

Six items requiring a human at a browser: the 28-minute idle warning and its countdown to the 30-minute deadline, with "Stay signed in" resetting **only** the idle deadline; cross-tab synchronization of activity and logout signals; the session-expired message appearing on idle and absolute expiry but **not** on explicit logout or password change; My Profile updating the displayed name immediately while email and role stay read-only; and control geometry and icon accessibility across desktop and narrow layouts.

> ⚠️ **Items 4 and 5 name Blazor-era surfaces** ("Dashboard", "Fluent icon actions", FluentUI's 36px control geometry). The client is now Tailwind v4 + shadcn/ui on comp P, and the seven Blazor e2e specs were retired 2026-09-08. **These acceptance items need rewriting against `apps/web`** — that is Wave F2's and F5's work, and it has not happened. Their intent is preserved in `e2e/README.md`.

### 6.4 What the golden corpus cannot prove

`tools/golden` holds **447 cases across all 81 endpoints** at four roles and anonymous. It is the conversion's only oracle, and it has three known blind spots that are completion criteria in their own right:

- **It only sends the requests it recorded.** Boundary validation — over-length names, malformed ids, non-array bodies — was never exercised, and a review found three classes of reachable `500` on inputs no fixture sends. **Every slice transcribes its DTO's validation attributes rather than trusting a green replay.**
- **A fixture matching is not proof the ordering rule is right.** The organization list's default sort was inverted and the fixture matched anyway, because the seed's two organizations happen to be created in alphabetical order.
- **It redacts credentials in both directions**, so a *change* in a redacted value is invisible. "Regenerating an invite code returns a different code" must be a unit test; a replay diff can never see it.

Read a replay run correctly: the per-scenario `failed` column counts steps that **did not run**, not diffs. **`0 failed` is not `0 diffs`** — the diff list printed at the end of the run is the thing to read.

---

## 7. Delivery State

**Verified 2026-09-14 against `70e349e`** (`claude/jolly-carson-68z3pt`, tree clean). Counted from the working tree in this sitting, not carried forward. `SPEC/implementation-agent-tracker.md` remains the authoritative live record; re-derive from `git log` before making any planning claim.

| | |
|---|---|
| **MVP epics** | T001–T067 merged. Foundation → Hardening, User-Defined Fields, Idea-Type Fields. Done. |
| **Sprints** | 1–7 complete · 7.5 closed · **8 cancelled** (the .NET stack is never deployed) · **9, the TypeScript conversion, is active**. |
| **The conversion** | Waves A, 0, B (all 7), C (both) and E (E0–E7) merged. **Wave D is the critical path, at D5 of D7.** F and G not started; **G is cut.** |
| **API surface** | **67 route decorators across 12 controllers** — 66 product routes plus a health check. **14 endpoints remain**, exactly D6 (AI assist, 11) and D7 (View As, 3). Both features' domain and application layers already merged in B6/B7, which materially lowers what is left. |
| **Client** | 31 pages across `(auth)`, `(desk)`, delivery and settings groups. **Every screen renders from `apps/web/lib/data/`, which is fixture-backed.** Wave D replaces reader bodies, not call sites. |
| **Golden replay** | 367 of 447 at last measurement. The remaining 80 are 71 D6/D7 fixture cases returning 404 plus nine accepted differences — four portrait-encoder byte diffs, four CSV-export date diffs, and the deliberate `accessToken` removal. |
| **Database** | Schema drift resolved 2026-09-09 by rebuild rather than migration: `dropdb` → `db:migrate` → `db:seed` in 3.7 seconds. Five seed modules produce **2 organizations, 10 users, 4 boards, 44 ideas**, ideas spread **3/2/2/1/3** across statuses on every board, with accounts that really sign in. Idempotent — ids derive from stable names, so two seeded databases agree about every id, which a golden fixture depends on. |
| **Frozen** | `src/Collega.*`, `tests/`, `Collega.sln` are the .NET 8 / Blazor / EF Core original. **Frozen 2026-09-06; deleted in slice F6.** They stay on disk only as a golden-fixture recorder and the last runnable reference. **The .NET test suite is discarded, not ported** — do not cite its 826 green tests as current coverage. |

### Test suite — counted 2026-09-14 at `70e349e`

**360 passing, 0 skipped**, from one `pnpm test --force` run: 14 of 14 tasks successful, nothing cached.

| Package | Tests |
|---|---:|
| `apps/web` | 94 |
| `apps/api` | 87 |
| `tools/golden` | 48 |
| `packages/application` | 35 |
| boundaries (Biome layer rules) | 30 |
| `packages/domain` | 28 |
| `packages/infrastructure` | 28 |
| `packages/design-system` | 8 |
| arch | 2 |

Two changes since the tracker's 297-passing / 2-skipped figure of 2026-09-08. `apps/api` went **26 → 87** when the D1 QA slice landed — written by an agent that had not touched the source, and it found two divergences neither the implementer nor the reviewer had spotted. And `packages/infrastructure` shows **28 passing with no skips** because this session has a seeded database: the live-database suite is guarded by `skipIf(!DATABASE_URL)`, so it skips wherever that variable is absent. **CI must continue not to set it** — present but pointing at no database, the suite runs and fails.

### Known quality gap

**Coverage is inverted against risk.** `packages/application` is the largest package at 14,876 lines, carries authorization, and still has **35 tests** — while `apps/web` has 94 over 8,544 lines. A QA slice against Application, written by an agent that did not write the code, was scheduled 2026-09-08 to run in parallel with Wave D. It has not started, and **`packages/application` is the only layer of consequence with no such pass over it** — the layer where a mistake means one organization reads another's data.

The pattern it would follow is proven twice. Wave E's QA slice produced 102 tests and **verified every rule by breaking it — 21 mutations, 21 caught**. D1's produced 87 tests from 26 and found two divergences that neither the implementer nor the reviewer had spotted.

---

## 8. Appendix — Discrepancies Found

These are defects in the canonical specs, surfaced by this reconciliation and **reported rather than fixed**: canonical files are edited deliberately, first, and with the user's agreement. Each needs a decision.

**1. `30-Contracts.md` duplicates a whole section.** `## Idea Field Option Contracts` appears **twice** — lines 702–796 and 1128–1209 — repeating the idea-type and business-impact blocks. Eight are exact duplicates. **Two conflict on method**: `POST /organizations/{id}/idea-types/reorder` (line 733) versus `PUT` (line 1161), and the same for business-impacts (779 versus 1199). **Both implementations use `POST`, so the `PUT` variants are stale.**

**2. Ten routes are built but undocumented.** Present in the .NET reference and absent from `30-Contracts.md`: `PUT /auth/me/portrait`, `DELETE /auth/me/portrait`, `DELETE /organizations/{id}/logo`, `GET /health`, and all six `field-definitions` routes — whose contracts live in `20-feature-user-defined-fields.md` instead. Add `POST /ai-assist/prompt/reset`, which exists in .NET with no heading anywhere.

**3. Six contracted endpoints were never built in either stack.** Two `password-reset` routes (the document itself labels them Post-MVP), two `ai-key` routes (deliberately unimplemented per AI rule 30), and `ai-draft` / `ai-polish` (no controller action ever existed).

*Items 1–3 mean the Definition of Done's own Contracts clause — "implementation and tests remain aligned with canonical SPEC docs" — is currently violated by `30-Contracts.md`. Slice **F5** owns spec reconciliation and is the natural home for the fix.*

**4. Endpoint counts disagree across sources.** `### METHOD /path` headings in `30-Contracts.md`: **86**. Unique method+path after removing the duplication: **78**. The `[Http*]` attributes the golden inventory counts: **81**. The commonly quoted "81 endpoints" comes from the .NET controllers, **not** from the contracts document.

**5. Superseded text still reads as current.** The Idea Type decision table's "Option appearance" row says label and sort order only — but rule #9 gives Idea Type options a color **and** icon. The row is the superseded text and should be struck.

**6. Source typos worth not propagating.** In `20-feature-ideas-and-engagement.md`: the Upvotes rule uses `4,` where it means `4.`, and the file ends with a stray backtick. In `20-feature-auth.md`: requirement numbering **skips #3** (it runs 1, 2, 4, 5…).

---

## 9. Traceability

| Epic | Story IDs | Canonical specs |
|---|---|---|
| Authentication & Session | `US-AUTH-01`…`08` | `20-feature-auth.md`, `20-feature-user-login.md` |
| Organizations | `US-ORG-01`…`05` | `20-feature-organizations-and-users.md` |
| Users & Membership | `US-USER-01`…`03` | `20-feature-organizations-and-users.md` |
| Boards & Statuses | `US-BOARD-01`…`05` | `20-feature-boards-and-statuses.md` |
| Ideas | `US-IDEA-01`…`06` | `20-feature-ideas-and-engagement.md` |
| Engagement | `US-ENG-01`…`04` | `20-feature-ideas-and-engagement.md` |
| Custom Fields & Idea Types | `US-FIELD-01`…`07` | `20-feature-user-defined-fields.md`, `20-feature-idea-type-fields.md` |
| Administration & View As | `US-VA-01`…`06` | `20-feature-view-as.md` |
| AI Idea Assist | `US-AI-01`…`08` | `20-feature-ai-idea-assist.md` |
| Issues & Delivery | `US-DEL-01`…`10` | `20-feature-issues-and-delivery.md` |
| Notifications & Audit | `US-NOTIF-01`…`04` | `20-feature-notifications.md` |
| Deferred | — | `20-feature-oauth.md`, `20-feature-saml.md`, `20-feature-reporting.md` |

**Cross-cutting sources:** `10-requirements.md` (permission matrix, global rules) · `30-Contracts.md` (routes, payloads, error envelope, session cookie) · `40-test-strategy.md` (coverage, smoke path, manual acceptance) · `90-definition-of-done.md` (exit criteria) · `decisions.md` (dated constraints) · `implementation-agent-tracker.md` (delivery state) · `20-feature-client-ui.md` and `20-feature-client-ui-revisions.md` (Idea Detail surface, shell rules) · `e2e/README.md` (the 18 flows the retired suite covered) · `SPEC/mockups/comp-p-*.html` and `comp-q-*.html` (46 screens, four roles, four states).

**Precedence when sources disagree:** canonical `SPEC/*.md` → this document and `Specs Overview.md` (derived) → code. For *delivery state* only, `implementation-agent-tracker.md` outranks this file. Two **canonical** specs disagreeing is the one case to escalate rather than resolve; §8 lists what was found, and none of it is that case.
