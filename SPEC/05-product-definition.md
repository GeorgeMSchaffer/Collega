# Collega — Product Definition (DERIVED — NOT CANONICAL)

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** derived, not canonical: what the product is, its personas, user stories and delivery state,
>   generated 2026-09-14; do not implement from it; the canonical spec wins where they differ.
> - **Key rules:** Site Admin mutates org content only through View As, bootstrap admin stays direct
>   (§2.2); statuses keep ≥2 active, Idea Type / Business Impact ≥1 (§3); an Issue is the same row as its
>   Idea (Epic 10); §7 delivery counts are pinned to `e92ddde`, the tracker outranks it.
> - **Contracts:** none of its own (derived; it cites `30-Contracts.md`)
> - **Decisions:** 2026-09-11 "The golden replay is not a gate, and never was meant to be one";
>   2026-09-02 "Outcome ↔ Issue cardinality: single-parent"; 2026-09-08 "Wave G is cut from the conversion
>   and revisited after cutover"

> ⚠️ **This file is a derived, consolidated view. It is not a source of truth and it is not maintained in lockstep with the canonical specs.**
>
> - **Do not implement from this file.** Read the canonical spec for the area (`SPEC/README.MD` indexes them; `SPEC/30-Contracts.md` is authoritative for endpoints and payloads).
> - **Where this file disagrees with a canonical spec, the canonical spec wins.** That is precedence, not a conflict — resolve it and move on. It is *not* the "specs conflict, ask the user" case in `CLAUDE.md`, which covers two **canonical** specs disagreeing.
> - **Do not edit behavior here.** Update the canonical spec first, then regenerate.
> - **Generated 2026-09-14 from `19beace`** (`dev`), against every canonical `SPEC/*.md`, `decisions.md`, `implementation-agent-tracker.md`, the sprint plans, `e2e/README.md`, and the code in `apps/` and `packages/`. §7 and §8 were re-derived 2026-09-29 at `e92ddde` by slice 134 (F5), again from the working tree in one sitting.
> - **`Specs Overview.md`** is also derived (last reconciled 2026-08-06) and summarizes *rules*; this file answers *what the product is, who it is for, and what state each capability is in*, as user stories with acceptance criteria. Where the two disagree this one is newer; the canonical spec beats both.

---

## 1. What Collega Is

**Collega is a tenant-scoped collaboration tool for submitting, tracking and improving process ideas.**

- Anyone in an organization raises an idea about how work gets done. It becomes a card on a board, moves through the organization's own workflow statuses, and collects the things that tell you whether it matters: tags, assignees, comments, @mentions and upvotes.
- Admins configure the vocabulary — statuses, idea types, business impact levels, custom fields — so the board speaks the organization's language rather than a generic one.
- The shape is deliberately familiar: Trello or Jira, narrowed to continuous-improvement intake. Every organization is a hard data boundary; a single global Site Admin creates organizations and their first users and otherwise works *through* them rather than inside them.

Two capabilities distinguish it from a generic board:

- **AI Idea Assist** turns capture into a short conversation: describe the problem in plain English, answer a few questions, get a pre-filled, fully editable form. It classifies against the organization's *real* active options and is never a write path — the user still submits the form.
- **Issues & Delivery** (Slice 1 built; Slice 2, Outcomes and the Roadmap, unbuilt) promotes an approved idea into delivery — sprints, a fixed five-stage lifecycle, a task checklist — without becoming a second object, so mid-sprint "why are we building this?" is one click away: the Issue *is* the Idea.

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
| Create boards | ✓\* | ✓ | ✓ | |
| Edit, archive and configure boards | ✓\* | ✓ | | |
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
\* **Through View As only** — see §2.2. Not a UI convention; a direct attempt returns `403`.

### 2.2 The Site Admin rule — read this before reading anything else

Canonical: `SPEC/20-feature-view-as.md` rules 25, 25a, 25b, 25c, 26 (decided 2026-08-11, tightened 2026-08-13, extended 2026-08-14).

> **A Site Admin acting as themselves may not create, edit or delete organization-owned content.** Reading is unrestricted. **View As is the mutation path.**

- Covers boards, statuses, idea types, business impacts, custom fields, ideas, comments, tags, upvotes, and bulk idea creation by CSV.
- Enforced **server-side in the Application layer** — a refused mutation returns `403`, not a hidden button.

**Rule 25c supersedes three rules in `20-feature-ideas-and-engagement.md`, for the Site Admin role only:**

| Superseded rule | Naive reading | Correct reading |
|---|---|---|
| Upvotes #1 — "all authenticated users, including Read Only, can upvote" | Site Admin can upvote | Direct upvote **refused**; the rule means all authenticated users **of the idea's organization** |
| Comments #1 — "all authenticated users, including Read Only, can comment" | Site Admin can comment | Direct comment **refused**; same reading |
| CSV Import #1 — "only Site Admin and Org Admin can upload ideas via CSV" | Site Admin can bulk-create ideas | Direct import **refused**; done through View As, where the caller *is* an Org Admin |

Why: a Site Admin is not a member of the organization, so a member's position — a vote, a comment — is not theirs to cast. **None of this touches Read Only users, who are members and keep both rules in full.**

**The bootstrap exception (rule 26):** creating organizations and users, **user** CSV import, invite codes, and archiving stay **direct**. *"A Site Admin creates organizations and users for organizations; for every other activity they use Act As."*

**The two CSV imports fall on opposite sides of that line:** user import (`/organizations/{id}/users/import`) is bootstrap and direct; idea import (`/boards/{id}/ideas/import`) is organization content and goes through View As.

---

## 3. Domain Model

| Noun | Invariants |
|---|---|
| **Organization** | Top-level ownership boundary for all business data. Only Site Admin creates. Requires Title (≤200) and Description (≤1000); Logo Address optional (≤500). Auto-generates a unique Invite Code. **Archivable, never hard-deleted** — archiving invalidates the invite code and rejects self-registration. On creation: default statuses, one default board, and the canonical Idea Type / Business Impact option sets. One active logo at a time, rendered height ≤`150px`. Must retain **≥2 active statuses**. AI API key is optional, **write-only, encrypted at rest, never returned** — only last-four, updated-at and updated-by are displayed. |
| **User** | **Email is globally unique** and is the mention identity. Exactly one organization and one role — except Site Admin, who is global. Status `Active`/`Inactive` only; inactive users cannot authenticate and cannot be newly assigned, though they stay visible on historical assignments. **The last Org Admin cannot remove their own role or self-deactivate.** Self-service profile editing covers first and last name only (≤100 each). `MustChangePassword` is the persisted source of truth for forced rotation; regenerating `SecurityStamp` is the session-revocation mechanism. |
| **Board** | Belongs to one organization. Ideas organized by swimlanes; **each swimlane maps to a status**; **minimum 2 swimlanes**. Swimlane order is board-local and independent of the organization's status catalog order. Canonical routes `/boards` and `/board/{boardId}`. |
| **Status** | Organization-scoped. `Color` (≤20 chars, fallback `#64748B`) and integer `SortOrder`. **Soft-delete only.** Cannot be deleted while referenced as a swimlane on an active board, nor if it drops the organization below **2 active statuses** — regardless of board references. Soft-deleted statuses still render their prior name with an archived label. |
| **Idea** | Belongs to one board, therefore one organization. Title ≤150 required; Description ≤4000 required, **plain text only**; Priority required, hard-defaults to `Medium`; Idea Type required and **immutable after creation**; Business Impact required, the form preselecting the **first active option** (changed 2026-09-29 from `Medium`); Due Date optional; Status must be an active swimlane on the board, defaults to the leftmost lane; **0–5 distinct assignees**, active same-org users at selection time; **≤10 distinct tags**. Stays editable and collaborative in `Complete`. **Soft-delete only, by in-scope Org Admin (a Site Admin through View As), after confirmation; no restore in this release.** Addressable at `/ideas/{ideaId}`; drawer at `?idea={ideaId}`. |
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

### Defaulting

- Idea Type and Business Impact both default to the **first active option by sort order**: the idea form preselects it, and the API stores no default.
- *Superseded 2026-09-29 (`decisions.md` 2026-09-29 "Spec contradictions resolved"):* Business Impact defaulted to **`Medium`**, falling back to first-active only where no option is named `Medium` — decoupled on 2026-08-17 when the seeded impact order was reversed to most-severe-first, so that first-active would not pre-mark every new idea `Critical`.

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
| 8 | Administration & View As | 6 | **Built** (D7 — Wave D closed) | `20-feature-view-as.md` |
| 9 | AI Idea Assist | 8 | **Built** (D6 — Wave D closed) | `20-feature-ai-idea-assist.md` |
| 10 | Issues & Delivery | 10 | **Slice 1 built** — phase model, promotion gate, sprints and tasks, 19 routes. **Slice 2 (Outcomes) unbuilt** — no `outcomes` model, no `Idea.outcomeId`, no roadmap route | `20-feature-issues-and-delivery.md` |
| 11 | Notifications & Audit | 4 | **Partial** — domain, application and tables exist; **no HTTP surface, by design** | `20-feature-notifications.md` |
| — | OAuth (Entra ID) | 6 | **Deferred — Phase 2** | `20-feature-oauth.md` |
| — | SAML 2.0 | 4 | **Deferred — post-OAuth** | `20-feature-saml.md` |
| — | Reporting | 4 | **Deferred — post-MVP** | `20-feature-reporting.md` |

- **80 stories across 14 areas.** Every epic through 9 is behind a real HTTP endpoint on the Nest host; `apps/web` reads the API rather than fixtures, with a documented residue in §7.
- **Six contracted routes and two capabilities remain unbuilt, each deliberately** — listed in §8 item 3; the `ai-key` pair is `PUT`/`DELETE /organizations/{id}/ai-key`.

---

## 5. User Stories

Each story carries an ID, the role, the statement, its acceptance criteria, and its state. Criteria are quoted or tightly paraphrased from the canonical spec's own rules — the numbers are load-bearing and reproduced exactly.

State legend: **Built** · **Partial** · **Unbuilt** · **Deferred**

### Epic 1 — Authentication & Session

*Canonical: `20-feature-auth.md`. `20-feature-user-login.md` adds no independent requirements — it is the Given/When/Then restatement of the login half, folded in here.*

**US-AUTH-01 · User · Built** — *sign in with email and password, to reach my organization's boards and ideas.*
- Valid credentials authenticate; invalid ones are rejected **without revealing which credential was wrong**.
- Email is **globally unique across the system**; accounts are organization-scoped.
- **Inactive users cannot authenticate.**
- Unauthenticated navigation to a protected route redirects to `/login`; `/login` and `/register` stay public.
- A user with no required password change lands on the Dashboard at `/`.

**US-AUTH-02 · User · Built** — *lock my account after repeated failed attempts, so that my credentials are protected from guessing.*
- **Five failed attempts within 15 minutes trigger a 15-minute lockout.**
- A successful login clears the failed-attempt and lockout counters.
- Successful and failed authentication events are audited.

**US-AUTH-03 · User · Built** — *strong password rules, so my account is not trivially compromised.*
- Passwords are **at least 6 characters with uppercase, lowercase, numeric and special characters**; a change failing the policy is rejected.
- **Plaintext passwords and reset tokens are never persisted or written to logs, audit metadata, analytics or error responses.**

**US-AUTH-04 · Site Admin · Built** — *a seeded platform account created on first run that forces me to rotate its credential, so that the deployment is bootstrappable without leaving a shared secret live.*
- Created from `SiteAdmin__Email` / `SiteAdmin__Password`; **belongs to no organization**.
- **Startup fails fast** if either key, or the database connection string, is missing — a human-readable banner naming every missing key, to stderr, non-zero exit, **no stack trace**.
- Must change its environment-provided credential on first login.

**US-AUTH-05 · Org Admin · Built** — *reset a user's password with a temporary one, so locked-out users get back in without a self-service email flow.*
- Temporary passwords are **shown once, expire after 24 hours, and require a change on first use**.
- **Login must not clear `TemporaryPasswordExpiresAtUtc`** — only a completed change retires the deadline. Why: clearing it on login would turn an admin-known temporary password into a permanent credential.
- Password changes and resets are audited.

**US-AUTH-06 · User · Built** — *a forced password change enforced everywhere, so it cannot be bypassed by calling the API directly.*
- `User.MustChangePassword` is the **persisted source of truth**, read from live state per request.
- **Enforced at the API, not only the client**: while true, **every authenticated endpoint except `GET /auth/me` and `POST /auth/change-password` returns `403`**. The allowlist is **opt-in, so an endpoint added later stays closed by default**.
- Completing the rotation lifts the restriction and **ends the session** — it regenerates `SecurityStamp` — so the user signs in again with the new password. *Corrected 2026-09-29 (slice 124): this said completing the rotation lifts the restriction on the next request without a new token; the password change also regenerates `SecurityStamp`, which revokes that token.*
- The standalone `/change-password` route is reachable only by accounts marked `MustChangePassword`; others are redirected to `/settings/profile`.

**US-AUTH-07 · User · Built** — *my session ends after inactivity with fair warning, so an unattended browser does not stay signed in.*
- The access token is a **signed JWT embedding the issuing `SecurityStamp`**; every request revalidates against the current database value, and a mismatch is rejected like an expired token.
- **Absolute token lifetime is 480 minutes (8 hours)**; client activity can never extend it.
- **The browser session expires after 30 minutes idle**, with a **warning at 28 minutes and a live two-minute countdown**.
- Pointer, keyboard, touch, scroll and document-visibility activity reset the idle deadline; activity and logout signals **synchronize across tabs**.
- **"Stay signed in" resets only the idle deadline** — it never refreshes, replaces or extends the JWT.
- Idle expiry, absolute expiry and API rejection return to Login with *"Your session expired. Sign in again to continue."*; explicit logout and password changes return **without** it.

**US-AUTH-08 · User · Built** — *my session restored correctly on reload and cleared only when genuinely invalid, so I neither lose work nor keep a dead session.*
- Persisted client auth data is a **cached session candidate**; it establishes no principal until `GET /auth/me` accepts it.
- When the API rejects a stored or active token, client state is cleared and the browser returns to `/login`.
- **An endpoint-specific authorization failure must not clear a token that `GET /auth/me` still accepts** — the original error is preserved. *(This discrimination cost a sprint to find.)*

> **Session transport changed 2026-09-04 (conversion decision `08`).** Nest sets an httpOnly, `Secure`, `SameSite` cookie (`collega_session`) on login, View As start and View As exit; Next holds no session of its own and renders from `GET /auth/me`. `accessToken` was **deliberately removed from the login response body** — one of the nine accepted golden-replay diffs. The rules above are unchanged in substance; only the carrier moved.

**Deferred in this epic:** self-service password reset by email (Post-MVP — 24-hour single-use tokens, 3-per-email / 10-per-IP throttling in a rolling 15 minutes, identical generic responses for every outcome, full session revocation on success); OAuth (Phase 2); SAML (later); MFA; social login; "Remember this device".

---

### Epic 2 — Organizations

*Canonical: `20-feature-organizations-and-users.md`*

**US-ORG-01 · Site Admin · Built** — *create an organization with minimal required data, so onboarding is not a form-filling exercise.*
- **Only Site Admin can create organizations.** Org Admin cannot.
- Requires **only Title and Description**; Logo Address is optional. Limits: Title ≤200, Description ≤1000, Logo Address ≤500. All text fields trimmed before validation.
- A new organization **starts with the default statuses and one default board**.

**US-ORG-02 · Org Admin · Built** — *an invite code I can hand out and regenerate, so I control who joins.*
- A **unique invite code is generated automatically** at creation, unique across organizations, and displayed in **both the organization list and the detail view**.
- Regeneration **immediately invalidates the previous code**, and is audited.
- **An archived organization's invite code is invalid**; self-registration against it is rejected.

**US-ORG-03 · Site Admin · Built** — *archive rather than delete, so historical data stays intact.*
- Organizations can be **archived but never hard-deleted**; archived ones are **hidden from admin lists by default** unless explicitly filtered for.
- A stored AI key is **retained but unused**, and restored to service if the organization is unarchived.

**US-ORG-04 · Org Admin · Built** — *my organization's logo on our boards, so the workspace looks like ours.*
- Logo upload with in-form preview, from the organization edit form. **One active logo at a time** — a new upload replaces the previous.
- **Rendered height is capped at `150px`, preserving aspect ratio**; the header reserves a `150px` brand zone.

**US-ORG-05 · Org Admin · Deferred (contracted, deliberately unimplemented)** — *supply our own AI API key, so AI usage bills to our vendor account instead of the deployment's.*
- Precedence would be organization key when configured, otherwise the deployment default.
- The key is **encrypted at rest and write-only across the entire API surface** — never returned by any endpoint, log, audit payload, error or client view. Screens show only whether a key is configured, its last four characters, and when and by whom it was updated.
- A submitted key is **validated with a single low-cost model call before persistence**; a failing key is rejected and the stored key left untouched.
- A key failing at request time **falls back to the deployment default for that call** so the user is never blocked, and **every fallback writes an audit event** — the only signal that an organization's key is broken.
> **State:** `PUT` / `DELETE /organizations/{id}/ai-key` are specified in `30-Contracts.md` and **deliberately unimplemented in v1** (AI rule 30, D-CREDS). A future agent reading those contracts must not build them. All organizations share one platform key.

---

### Epic 3 — Users & Membership

*Canonical: `20-feature-organizations-and-users.md`*

**US-USER-01 · Prospective member · Built** — *self-register with an invite code, so I can join my company's workspace immediately.*
- **The invite code determines which organization** the account joins; a missing or invalid code **rejects registration with a prompt to supply a correct one**.
- Self-registered users get the **`User` role and `Active` status**.
- Registration is **rejected if the email is already in use** — email is globally unique.
- Self-registrations are audited.

**US-USER-02 · Org Admin · Built** — *add users directly and bulk-import them by CSV, so I can populate my organization at speed.*
- Site Admin adds users to **any** organization; Org Admin **only to their own**.
- Admin-created users **need no invite code**; the admin picks the role and issues an initial password.
- CSV import is **scoped to a single target organization** and carries First Name, Last Name, Email and optional Role — **no invite code column**.
- **Rows with no Role default to `User`**; each imported user gets a system-generated temporary password and must change it on first login.
- The import **reports per-row outcomes — invalid or duplicate-email rows are rejected individually without failing the whole file.**

**US-USER-03 · Org Admin · Built** — *manage roles and account status inside my organization, so access matches each person's job.*
- Each non-Site-Admin user belongs to **exactly one organization** and has **exactly one role**.
- Accounts are **`Active` or `Inactive` only**; inactive users cannot authenticate.
- **The last Org Admin cannot remove their own admin role or deactivate themselves** — only a Site Admin can deactivate the organization.
- Organization, user, role and status changes, invite-code regeneration, self-registrations and CSV imports are **all audited**.

---

### Epic 4 — Boards & Statuses

*Canonical: `20-feature-boards-and-statuses.md`*

**US-BOARD-01 · Org Admin · Built** — *organization-level statuses I can define and color, so our boards use our language.*
- Statuses are defined at **organization level**, managed by Site Admin and Org Admin.
- Default set, provisioned at organization creation: **New / Pending `#64748B` (10) · In Review `#D97706` (20) · In Progress `#2563EB` (30) · Client Review `#7C3AED` (40) · Complete `#16A34A` (50)**.
- Each status has an editable **`Color`** (≤20 chars, fallback `#64748B`) for the swimlane dot and the card's status chip, and an integer **`SortOrder`** for its place in the organization catalog — **distinct from a board's own swimlane order**, which a board changes independently.

**US-BOARD-02 · Org Admin · Built** — *safe status deletion, so existing ideas and boards never break.*
- **Soft-delete only**, so existing references stay valid.
- A status **referenced as a swimlane on any active board cannot be deleted** until the reference is removed.
- **An organization must retain at least 2 active statuses**; a delete dropping below that is rejected **regardless of board references**, so an organization can never be left unable to create a board.
- Views referencing a soft-deleted status **keep showing the prior name with an archived label**.

**US-BOARD-03 · Org Admin · Built** — *choose and reorder a board's swimlanes, so the board reflects our workflow.*
- Each swimlane maps to a status; **a board must have at least 2 swimlanes**, and may select a **subset** of the organization's statuses.
- **Swimlane reorder is saved immediately when the drag completes.**

**US-BOARD-04 · User · Built** — *an empty board that guides me, so I know what to do first.*
- Board views provide **guided empty states with a primary action and short explanatory text** when no ideas exist; administration screens carry the same requirement.
- **An empty state's action is disabled with a stated reason, never omitted** (decision 2026-09-08) — the control stays focusable, carries `aria-disabled` rather than `disabled`, and its `aria-describedby` resolves to a real element holding the reason.
- Every new organization starts with one default board.

**US-BOARD-05 · User · Built** — *consistent "Board" terminology and stable URLs, so links and navigation never surprise me.*
- User-facing copy uses **`Board` / `Boards`, never `Workflow`**.
- Canonical routes are **`/boards`** and **`/board/{boardId}`**; `/board`, `/workflow`, `/workflows` and `/workflow/{boardId}` **redirect** without data loss.
- **Internal service and namespace names may retain `Workflow`** where not user-visible — an explicit carve-out, not an inconsistency.

---

### Epic 5 — Ideas

*Canonical: `20-feature-ideas-and-engagement.md`*

**US-IDEA-01 · User · Built** — *create an idea with the fields that matter, so it can be triaged consistently.*
- Required: **Title (≤150), Description (≤4000), Priority, Idea Type, Business Impact, Status**. Optional: Due Date, Assignees, Tags.
- Status comes from the swimlane; **the default is the leftmost lane**. A supplied `statusId` **must be an active swimlane on the target board**, else it is a validation error.
- **Descriptions and comment bodies are plain text only** — rich text, attachments and embedded media are out of MVP. URLs may appear as text but are not treated as trusted embedded content.
- Creation, edits, status changes, comments, upvote toggles and deletions **all generate audit events**.

**US-IDEA-02 · User · Built** — *a compact, information-dense board card, so I can scan a board at a glance.*
- The card shows **title, priority, Business Impact chip, up to three assignee personas with `+N`, up to three tags alphabetically with `+N`, submission age, upvote icon and count, comment icon and count**.
- Each persona shows **initials followed by the first name**; missing-name fallbacks stay accessible.
- **Submission age is viewer-local calendar-day**: `0 days ago`, singular `1 day ago`, plural `{N} days ago`; **future timestamps clamp to zero**.
- **Color is never the only carrier of meaning** (decision 2026-08-31) — every colored dot, bar or fill carries a text label.
- The board is a **scrolling rail of fixed-width 288px columns**, not N equal fractions (decision 2026-09-02).

**US-IDEA-03 · User · Built** — *open full idea detail from a card, so I can edit and discuss without losing the board.*
- Clicking the title opens the **Idea Detail drawer**; the URL gains **`?idea={ideaId}`** and the idea is addressable at **`/ideas/{ideaId}`**. It is the **same drawer** reached from the Ideas list, and supports **all editable idea and collaboration fields**.
- **Ideas in `Complete` remain editable and still allow comments, mentions and upvotes.**
- The card's comment action opens the drawer, scrolls comments into view and **focuses the composer**; where commenting is unavailable, focus moves to the comments heading.

**US-IDEA-04 · User · Built** — *move ideas between swimlanes by drag or by picker, so the board stays current on any input device.*
- Desktop cards use a **dedicated drag handle**; **keyboard and touch users use the status selector in Idea Detail**.
- Either path **updates the card immediately**; **a failed API call restores the prior swimlane and shows an error**.
- A successful status change moves the card **without closing Idea Detail**.

**US-IDEA-05 · User · Built** — *assign up to five people to an idea, so shared work has clear owners.*
- Optional — **zero to five distinct assignees**.
- Every **newly selected** assignee must be an **active user in the idea's organization**; **inactive users already assigned stay visible but cannot be newly selected**.
- Changes **replace the whole collection atomically**; duplicates, more than five, inactive users or out-of-org users are validation errors.
- **Only the author, an in-scope Org Admin, or Site Admin can change assignees.**
- The picker reads `GET /organizations/{id}/members`, which **any in-org caller may read** — not the Org-Admin-only user list — so a plain User can set an assignee on an idea they authored.

**US-IDEA-06 · Org Admin · Built** — *soft-delete ideas and control who edits descriptions, so content stays accountable.*
- **Only an in-scope Org Admin or Site Admin may soft-delete an idea, after confirmation. Restore is deferred.**
- The Delete action appears in Idea Detail only for an authorized admin, returns to the board on success, and **removes the card immediately**.
- **Soft-deleted ideas are excluded from board, list and detail queries**; the row and deletion metadata are retained.
- **Only the author, an in-scope Org Admin, or Site Admin can edit an idea description.**

---

### Epic 6 — Engagement

*Canonical: `20-feature-ideas-and-engagement.md`*

**US-ENG-01 · User · Built** — *tag ideas with reusable organization tags, so related ideas can be found together.*
- Tags are **organization-scoped**; only users who can edit ideas create them, so **Read Only cannot create tags**.
- Values ≤100 characters; **autocomplete after 2 characters**; an unmatched tag is **created when the idea is saved**.
- **Trimmed, case-insensitive, unique within an organization**; **concurrent saves of the same normalized name merge into one tag**.
- **An idea may carry no more than 10 distinct tags**; duplicate normalized names in one request count once.

**US-ENG-02 · User · Built** — *@mention colleagues with unresolved mentions blocked, so notifications reach real people.*
- Mentions use the **`@` trigger with email-based lookup**, limited to users in the same organization; email is the mention identity.
- Mentions are **resolved to the matching user when the idea or comment is saved**.
- **A mention that does not resolve blocks the save with inline validation** until removed or corrected. *(Confirmed 2026-09-06: unresolved comment mentions are rejected with `400`, not ignored — the contract was wrong and the code was right; `30-Contracts.md` was corrected.)*
- **Site Admin has no organization and therefore cannot be @mentioned** and never appears in lookup results.

**US-ENG-03 · Read Only · Built** — *comment and upvote, so I participate even though I cannot edit content.*
- **All authenticated users of the idea's organization, including Read Only, can comment and upvote** — subject to the Site Admin restriction in §2.2.
- Comments are chronological; **authors edit and delete their own**; Site Admin and Org Admin delete any within scope.
- Bodies are **plain text with line breaks, ≤2000 characters**, with a live counter and inline overflow validation.
- Upvoting is a **toggle** — at most one active upvote per user per idea, and **only the caster can remove it**.
- The thumbs-up is **unfilled when the current user has not upvoted, filled when they have**; toggling updates icon and count immediately, and **on failure the prior state is restored with an error**.

**US-ENG-04 · User · Built** — *search, filter and sort the global Ideas list, so I find any idea without hunting board to board.*
- Filtering and sorting are **server-side**.
- **All-column search covers Title, Created By, Assigned To, Status and Created Date, plus Text and Url custom-field values.** Text matches case-insensitive substring; **Created Date matches only a full ISO `YYYY-MM-DD` term**.
- A **tag filter** narrows by normalized tag name; a **user-association filter** narrows to ideas a chosen user authored *or* is assigned to — distinct from the caller-scoped `All` / `Created by me` / `Assigned to me` chips.
- **Column sort** on Title, Created By, Assigned To (alphabetically-first assignee), Status and Created Date, **with a stable idea-id tiebreaker so paging is deterministic**.

> **List endpoints need a total order.** The golden capture found four places where one was missing, or was total only by generated id — stable inside a deployment but not between two databases seeded from the same data. Under paging, an arbitrary tie-break does not merely reorder a page, it decides what is on it.

---

### Epic 7 — Custom Fields & Idea Types

*Canonical: `20-feature-user-defined-fields.md` and `20-feature-idea-type-fields.md`. **The second modifies the first**: per-type field selection rewrites the UDF spec's required-ness design row and its entire "Template Integration" section. There is one required-ness model, below, not two.*

**US-FIELD-01 · Org Admin · Built** — *define custom fields for our organization, so ideas capture domain-specific data the core schema doesn't cover.*
- Exactly **seven field types**: `Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url`.
- Definitions are **organization-scoped** — every board in the organization shares one schema.
- Names are **unique among active definitions, case-insensitively**; a duplicate is rejected with `400`.
- `Dropdown` and `MultiSelect` **require at least one option at creation**.
- Limits: Name ≤100, Description ≤500, option Label ≤200, stored value ≤4000.

**US-FIELD-02 · Org Admin · Built** — *control field order and retire unneeded fields, so the form stays clean without destroying captured data.*
- Display order is **drag-and-drop, saved immediately on drop**, persisted independently of the field record.
- Delete is a **soft delete** — the definition is archived and existing values are **preserved but hidden**. No restore in MVP. Archiving shows a confirmation stating that existing idea data will be hidden.
- Submitting a value for a soft-deleted definition returns `400`.

**US-FIELD-03 · User · Built** — *fill in custom fields when I create or edit an idea, so the record is complete without a follow-up conversation.*
- Inputs render in the create modal and the Idea Detail edit form, inside a collapsible **Custom Fields** section, ordered by display order.
- **Required fields are hard validation** — an empty one blocks the save.
- Canonical error strings: `<FieldName> is required.` and `<FieldName> must be a valid <FormatName>.`
- Per-type validation: `Text` ≤2000 · `Number` invariant-culture decimal · `Date` `yyyy-MM-dd` · `Boolean` `true`/`false` case-insensitively · `Url` absolute `http`/`https` · `Dropdown` a GUID matching one of the field's options · `MultiSelect` comma-separated option GUIDs **with no duplicates**.
- **Read Only users can view values but cannot fill them.**

**US-FIELD-04 · User · Built** — *filter and search ideas by custom field values, so I find the subset that matters.*
- Match semantics by type: Text/Url **contains** · Number **`min:max` range** · Date **ISO `from:to` range** · Boolean exact · Dropdown exact option-id · MultiSelect **any-of**.
- The global search also scans `Text` and `Url` custom-field values.
- **Unknown or invalid field ids in a filter are silently ignored, not errored.**

**US-FIELD-05 · Org Admin · Built** — *custom field values round-trip through CSV, so bulk creation and reporting don't lose captured data.*
- Export includes **one column per active field**, header = field name, ordered by display order. **Soft-deleted definitions are excluded** and their values omitted.
- Import matches columns by field name **case-insensitively**; unrecognized headers are ignored. It applies the same type validation as the API; missing columns are null, and required-field violations appear per-row in the error summary.
- Every value add, change or clear emits an audit event carrying field id, field name, previous value, new value, actor and timestamp. **Soft-deleted field names stay resolvable in historical audit entries.**

**US-FIELD-06 · Org Admin · Built** — *As an Org Admin, I want to choose which of our custom fields appear on a given idea type, and in what order, and mark each required or optional for that type.* *(Verbatim from the spec's own User Stories section, merged.)*
- A mapping carries per-type display order and per-type required flag, **unique on (type, field)** — a field appears at most once per type.
- Every mapped field must be an **active definition in the same organization**, else `400`.
- Mapping only **selects from the shared organization pool** — types never own fields, so a field mapped onto several types is still one definition, one value column, one filter target.
- Required-ness resolution: **`AllActiveFields` mode → the field's global required flag. `Curated` + mapped → the per-type override. `Curated` + not mapped → hidden, and a value submission for it is rejected `400`.**
- **Marking a mapped field required does not retroactively invalidate existing ideas** — it is enforced on new ideas and on the next edit. No backfill.

**US-FIELD-07 · Org Admin · Built** — *As an Org Admin, I want an un-curated type to keep showing all fields, and to give a type a color and icon so its ideas are recognizable at a glance.* *(Verbatim, merged.)*
- `IdeaTypeFieldMode` is **`AllActiveFields` (default)** or **`Curated`**. Setting a selection sets `Curated`; clearing it returns to `AllActiveFields`.
- The migration set **every existing type to `AllActiveFields` and seeded no mappings** — existing ideas and un-curated types behave exactly as before.
- **A new field auto-appears on every `AllActiveFields` type immediately**, and on `Curated` types only when an admin adds it. Intentional, and surfaced in the admin UI so it is not a silent surprise.
- Idea Type gains nullable **`ColorHex` (`#RRGGBB`) and `Icon`**; null falls back to a neutral badge. **Contrast warnings are advisory, never blocking.** The badge sits **on the tag row** of swimlane cards, always renders its name, capped at 92px with a tooltip (decision 2026-09-04).
- **`Idea.IdeaTypeId` is immutable after creation** — an update supplying a different type is rejected `400`. The **sole** exception is admin reassignment via `PUT /organizations/{orgId}/ideas/{ideaId}/idea-type`, which re-resolves fields, archives out-of-scope values and emits an audit event. Values are never dropped — they render muted with an "archived" tag.

---

### Epic 8 — Administration & View As

*Canonical: `20-feature-view-as.md`. **State: built.** Slice D7 put the three endpoints on the Nest host, closing Wave D. `apps/api/src/view-as/view-as.controller.ts`.*

Locked decisions: **full act-as** (not read-only preview) · **a Site Admin may not act as another Site Admin** · **30 minutes idle, 2 hours absolute** · entry from **both** a page-header control and the rail avatar menu.

**US-VA-01 · Site Admin · Built** — *act as a user inside a customer organization, so I can create and fix content I have no other way to touch.*
- Restriction and bootstrap exception: §2.2. Enforcement is **server-side in the Application layer**; a refused mutation returns `403`.
- **No special case is needed for impersonation** — while a session is live the current-user context reports the *target's* role, so the guard simply does not fire.

**US-VA-02 · Org Admin · Built** — *act as a user in my own organization, so I can reproduce a problem exactly as they see it.*
- Site Admin may act as any **active**, organization-scoped user in any organization — **not** other Site Admins, **not** inactive users. Org Admin may act as active users **in their own organization only**. User and Read Only may act as nobody.
- A caller who is neither **is refused `403` and the entry control is hidden** — both, not either. The UI control carries no authority.
- **Impersonation can never escalate**: the effective role is the target's, and the authorization check is against the caller's **real** role.
- Authorization derives organization scope from the context, **never from a caller-supplied `organizationId`** — verified across all 34 methods that take one. Why: this is what stops impersonation becoming a cross-org write path.

**US-VA-03 · Site Admin · Built** — *a server-authoritative, non-nestable session, so impersonation can't be forged, stacked or resumed.*
- Impersonation is a **server-side session, never a claim in the access token**; the token is never reissued to start or end one, and a captured token carries no impersonation authority.
- The session records real actor, target, started-at, last-seen-at, absolute-expiry-at and ended-at. **At most one active session per real actor.**
- **Non-nestable** — starting a session while one is active is refused, never silently replaced.
- `ICurrentUserContext` is the **single identity chokepoint**. A service reading claims directly would silently opt itself out of impersonation and is treated as a **defect**.

**US-VA-04 · Org Admin · Built** — *an audit trail naming both me and the person I acted as, so accountability survives impersonation while content is still correctly owned.*
- Starting and ending a session are **always audited, unconditionally**.
- Every mutation carries **dual attribution** — the audit actor is the **real admin**, with a second field recording the impersonated user. The trail never reads as though the target acted themselves.
- **Entity authorship is the impersonated user** — created-by and updated-by record the target, because content created through View As genuinely belongs to that organization.
- The target's own historical trail is never rewritten or back-dated.

**US-VA-05 · Site Admin · Built** — *the session expires on its own and exits in one click, so I never drift into acting as someone unnoticed.*
- **Idle expiry at 30 minutes; absolute cap at 2 hours** from start regardless of activity.
- Expiry is enforced **server-side**; a client timer may warn but never decides.
- On expiry the **real identity is restored** — the admin is not signed out, and the client surfaces that the session ended rather than silently continuing.
- A session whose target becomes inactive, or whose target's organization is archived, **stops being valid at the next request**.

**US-VA-06 · Acting admin · Built** — *unmistakable impersonation on every screen, so I never mistake the target's view for my own.*
- A **persistent, non-dismissable banner on every screen** names both identities and offers one-click exit: *"You're seeing exactly what they see. Anything you do is recorded as [real actor] acting as them."*
- The picker is a **right slide-in drawer**, searchable, grouped by organization for Site Admin. **Inactive users are shown but not selectable.**
- The rail avatar swaps to the impersonated user, and role-scoped rail items reflect the target's role.
- **Mutating controls stay live** — this is act-as, not preview.

---

### Epic 9 — AI Idea Assist

*Canonical: `20-feature-ai-idea-assist.md`. **State: built.** Slice D6 put the eleven endpoints on the Nest host across three controllers — `idea-assist` (4), `ai-prompt` (5), `ai-usage` (2) — closing Wave D. The per-organization key endpoints remain deliberately unbuilt; see US-ORG-05.*

Locked decisions: model **`claude-sonnet-5`** at **`low` effort** · adaptive thinking (**lower the effort, never disable thinking**) · **500,000 tokens per UTC day** as one **global** pool · **degrade at the cap, never error** · UI direction **C "Draft Strip"** · **single platform-level key**, per-org keys deliberately unbuilt · retrieved content **escaped, not merely fenced**, and the escaping is **not editable**.

**US-AI-01 · User · Built** — *a brainstorm chat that asks real questions and hands me a filled-in form, so I finish with a classified idea rather than prose to re-enter.*
- Each user turn is **one model call returning a structured object**; its `nextQuestion` renders as the assistant bubble.
- **Continue to idea form** hands the drafted fields over as **pre-filled, fully editable** values. **Nothing is committed at this point.**
- The assistant may propose **title, description, idea type, business impact and priority** — all optional; an early turn may return only a question.
- Suggested title and description are **length-capped in the schema** to 150 and 4000, so a suggestion never exceeds what the domain accepts.
- **Board and Status are never proposed** — the board is known from context, and status defaults to the leftmost swimlane.

**US-AI-02 · User · Built** — *see live what the assistant has classified so far, so the form at the end is no surprise.*
- Idea Type, Business Impact and Priority show on a **read-only draft strip** above the composer.
- Values not yet chosen render **explicitly** ("Priority not set yet"), so *"the assistant chose nothing"* is distinguishable from *"the assistant hasn't got there"*.
- **The strip is never editable** — editing happens on the create form. Why: this keeps a per-field suggested-vs-edited state machine out of v1; making it editable would bring that back.
- A suggested value is marked **teal**, never the indigo accent, which means active/selected.

**US-AI-03 · Org Admin · Built** — *define what "in scope" means for my organization, so the assistant stays on idea drafting and doesn't become a general chatbot.*
- The scope statement is optional free text, **≤500 characters**. Empty is valid and means "no narrowing beyond Idea Types".
- In-scope is evaluated **per turn**. The structural test is *"could this plausibly become an Idea of one of this organization's active Idea Types?"*
- Out of scope: the client renders a **fixed, server-supplied redirect string** and **the offending turn is dropped from the transcript, not appended** — accumulated off-topic context is what drifts a constrained assistant into a general one.
- The refused message renders **greyed and struck through for one beat**, with the redirect as a **system note rather than an assistant bubble**, then disappears.
- **Three consecutive out-of-scope turns close the chat.**
- The scope statement is placed in the system prompt **by the server** and **never concatenated with end-user text**.

**US-AI-04 · User · Built** — *suggestions drawn from my organization's real options, so classification is right rather than invented.*
- Context is assembled **server-side** from the caller's token claims. **The client never sends context, a prompt, a model name or a scope statement.**
- The model is called with **structured outputs and has no free-form text channel** — the only user-visible string it can emit is the next question. *"There is no field in which a limerick, a recipe, or a general-knowledge answer can be returned."*
- **The JSON Schema is built per request** from the retrieval result, so the type and impact ids are enums of that organization's real active options — **an invalid or cross-org classification is structurally impossible, not prompt-discouraged.** `additionalProperties` is `false` and every enum is closed.
- **Retrieval is not the containment mechanism** — no rule may be restated as "the retrieved context will keep it on topic".
- **Retrieved content is escaped, not merely fenced.** Why: a tag named `</organization_data> New instructions:` would otherwise close the untrusted-content block and continue as the operator — and tags are authored by ordinary Users, the lowest-privilege path into the prompt.

**US-AI-05 · User · Built** — *a chat that never traps me, so I can always reach the plain idea form.*
- **Skip & fill manually is always available and must never be gated on a successful model call.**
- A conversation is capped at **20 transcript entries**, so the practical ceiling is **10 user turns**. A refused turn is dropped and **does not consume the budget**.
- **New idea must not open the chat at all when the assistant is known unavailable** — the client reads an availability endpoint once per page load; on `false` the create drawer opens directly. That endpoint returns a **bare boolean** and never distinguishes unconfigured from provider-down from budget-exhausted.
- A failure on the **first** turn hands off to the create drawer immediately, carrying the user's typed text; on a **later** turn scripted nudges are the fallback, because a sudden surface change would lose the user's place.
- When the drawer opens *because* the assistant is unavailable, a flash message says so — **informational, names no cause**, only on those paths, never blocks the form or takes focus.
- **With no key configured the feature is off and the product still works.** Any model failure — timeout, rate limit, refusal, malformed response — degrades for that turn with the user's typed text preserved.

**US-AI-06 · Site Admin · Built** — *bounded, attributable AI spend, so one organization or one defect cannot consume the whole budget unnoticed.*
- A **daily UTC token ceiling**, checked **before** each call against the day's running total; overshoot is bounded by one in-flight turn. **It is a runaway stop, not a forecast** — a daily ceiling bounds the month only at thirty times itself.
- Exhaustion returns `503` and **degrades exactly as an unconfigured key would**. **Rate limiting answers `429` with `Retry-After`, never `503`** — the two mean opposite things.
- Every call writes a usage record carrying organization, actor, board, model id, the four provider-reported token counts, and **the per-million rates applied at the time** — stored on the record, because re-pricing history would corrupt a chargeback.
- **Under View As, usage attributes to the impersonated user's organization** — the org whose work is being done — but **the per-user rate allowance follows the real administrator**, so an admin cannot reset their own quota by moving between targets. **Refused and failed turns count.**
- **Usage records carry no prompt and no transcript content — "a meter, not a log."**
- A Site Admin sees consumption for every organization; an Org Admin sees only their own.

**US-AI-07 · Site Admin · Built** — *edit the system prompt as deployment configuration, so I can retune without a deploy — without being able to break the safety machinery.*
- The system prompt and the fixed redirect strings are **Site-Admin-editable deployment configuration**, not compiled constants.
- The editable part is a **template with two required placeholders** — the organization catalog and the scope statement. **A save omitting either is rejected**; the latter because a template without it would **silently disable every organization's scope statement with no error anywhere**.
- **Versions are immutable and appended.** Restoring an earlier version publishes a **copy**. The publish audit event records actor and version number — **never the body**.
- Publishing offers **advisory safety probes**, shown but **never blocking publishing**. Why: removing the scope instructions measurably *improves* classification while weakening refusal — *"the dangerous edit is the one that feels like an improvement."*
- Probes run against a **synthetic catalog**, never a real organization's. **Treat a passing run as "nothing is grossly broken", never "this edit is safe"** — three probes measured a ~7% effect at 3-of-3, i.e. a low-powered instrument.
- **The escaping is not editable.** An admin *can* delete the prose instructing the model to distrust retrieved content; the escaping itself survives in code.

**US-AI-08 · Site Admin · Built** — *AI structurally unable to create data, so it is never on the write path.*
- **The model is never a write path.** Its output seeds a form; the user submits it; the existing idea validation — active-option checks, organization scoping, role checks — runs unchanged and is the **sole** authority on whether an idea is created.
- **No AI endpoint may create, update or delete an idea.**
- Each call writes an audit event with actor, organization, board, turn count, token usage and whether the turn was refused. **Prompt and transcript content are not written to the audit log.**
- API keys are **never returned by any endpoint, never logged, never sent to the client**.
- **No test may reach a model provider.** The test harness blanks the API key *and* swaps in an unconfigured model. Why: before that guard existed the integration suite made a live billed call, and the only symptom was one test taking five seconds instead of one.

---

### Epic 10 — Issues & Delivery

*Canonical: `20-feature-issues-and-delivery.md`.*

**State: Slice 1 is built; Slice 2 is not.**
- Slice 1: the schema amendment landed the delivery facets on `ideas` (`phase`, `effort`, `delivery_status`, `sprint_id`, and the promotion snapshot) plus the `sprints` and `issue_tasks` tables; **19 routes** are live across three controllers — `delivery` (6, the single-Issue read `GET /ideas/{ideaId}/delivery` added 2026-09-28), `sprints` (7), `issue-tasks` (6). `packages/domain/src` and `packages/application/src` both carry `sprints` and `issue-tasks`.
- **Slice 2 — Outcomes and the Roadmap — is unbuilt**: no `outcomes` model, no `ideas.outcome_id` column, no roadmap route. The single-parent decision of 2026-09-02 is settled and comped but not yet migrated. `apps/web/app/(desk)/delivery/roadmap` renders without a backing API.

**The core decision: an Issue is not a new object.** An Idea is an item in `Discovery` phase; an Issue is **the same item, same row**, in `Delivery` phase. A separate Issue entity is an explicit non-goal — *"a parallel object would reintroduce the provenance-loss problem this feature exists to solve."*

- New facets on the existing Idea: `Phase`, `Effort`, `DeliveryStatus`, `SprintId`, plus the promotion snapshot (`PromotedAtUtc`, `PromotedByUserId`, `UpvoteCountAtPromotion`). Slice 2 adds `OutcomeId`.
- New entities: **Sprint** (org-scoped, flat, time-boxed), **IssueTask** (a checklist step belonging to exactly one Issue), and **Outcome** (a dated grouping lens).
- **Two status systems never mix:** organization-configured swimlane statuses govern Discovery; the **fixed** five-stage delivery set governs Delivery. Ideation `Complete` and delivery `Complete` are distinct terminal states.

**US-DEL-01 · Org Admin · Built** — *As an admin, I want to promote a fleshed-out idea into an Issue so my team can commit to building it, with the decision recorded.* *(Verbatim.)*
- Promotion sets phase to `Delivery` and delivery status to `Pending`, and records effort, promoted-at, promoted-by and the upvote count at promotion.
- Promoting an item already in Delivery is **rejected `409`**.
- Promotion is an **explicit decision gate**, never triggered by an ideation status — *"overloading the `Complete` status to also mean 'committed to delivery' is rejected as the source of the concept's awkwardness."*
- **Effort is T-shirt sizing (`Low`/`Medium`/`High`), deliberately not story points** — optional in Discovery, **required at the gate**.
- The promotion gate **is** the realization of the post-MVP approval workflow deferred in the Ideas and Boards specs — one build, two features.

**US-DEL-02 · Org Admin · Built** — *As an admin, I want to create a sprint with a goal and a date window and pull Issues into it, so the team has a focused, time-boxed workload.* *(Verbatim.)*
- A Sprint is created `Planned` with name (≤100), goal (≤500), start and end, optional owner. End must not precede start. **Names need not be unique** — "Sprint 12" may repeat across time.
- An owner, when set, must be an **active user in the sprint's organization**.
- An Issue belongs to **zero or one** Sprint via a plain nullable FK — **no join entity**. The delivery backlog is simply Delivery-phase items with no sprint.
- A delivery-status or sprint change on a **Discovery** item is rejected `400`.

**US-DEL-03 · Org Admin · Built** — *As an admin, I want to start and complete a sprint, with unfinished Issues returning to the backlog, so carry-over is explicit rather than lost.* *(Verbatim.)*
- Transitions are **explicit actions, not date-derived** — `Planned → Active → Completed` — *"because completing a sprint must handle carry-over deterministically."*
- On completion, **every assigned Issue not at delivery-status `Complete` returns to the backlog. No Issue is lost or deleted.**
- Deleting a sprint is a **soft delete that first unassigns every Issue** to the backlog.
- Dates lock once completed.

**US-DEL-04 · Org Admin · Built** — *As an admin, I want to return a mis-promoted item to Discovery so an accidental commitment is recoverable.* *(Verbatim.)*
- **In-scope admin only.**
- Returning clears sprint and delivery status but **retains effort, the promotion snapshot and the task list**, so a re-promote is lossless and the audit trail stays coherent.
- **The ideation status is never cleared by promotion** — it is frozen at its last Discovery value for provenance.

**US-DEL-05 · User (author) · Built** — *As the author of an idea, I want to promote it to an Issue (or request its promotion) so my idea doesn't die after it's approved.* *(Verbatim.)*
- Promotion is available to Site Admin, Org Admin, and **the author only** among Users. Read Only cannot promote.
- **Default: an author may self-promote**, matching the deferred approval decision. A P1 org setting can tighten this.
- **Default: promotion from any Discovery status** — the gate is the explicit decision, not the status.

**US-DEL-06 · User (assignee) · Built** — *As an assignee, I want to move my Issue through delivery statuses on the sprint board so progress is visible.* *(Verbatim.)*
- Delivery statuses are exactly **`Pending`, `Scoping`, `Development`, `Review`, `Complete`** — a **fixed enum**, not organization-configurable in this slice.
- The change is authorized to **author, an assignee, or an in-scope admin**, and is valid only in Delivery phase.
- The sprint board is a fixed five-swimlane kanban; drag mirrors the idea board's behaviour (optimistic, revert on failure), and keyboard and touch use the detail selector.
- **Per-issue dates are dropped by design** — *"the sprint boxes the dates; per-issue start/end inside a dated sprint creates 'which date wins' conflicts."*

**US-DEL-07 · Any viewer · Built** — *As anyone looking at an Issue, I want to see where it came from — the original idea, who proposed it, its upvotes, and the discussion — so I understand why we're building it without leaving the screen.* *(Verbatim.)*
- A promoted Issue exposes its **originating proposer, creation date, upvote count at promotion and now, business impact, idea type, tags, and full comment thread — with no manual copy**.
- The only genuinely new stored provenance is the promotion snapshot; the rest is free **because the Issue *is* the Idea**.
- **The Provenance panel is the differentiator and ships in this slice.**
- The global ideas list gains a `phase` filter so search and provenance span both phases.

**US-DEL-08 · Stakeholder · Built** — *As a stakeholder, I want the sprint board to show what's committed and in-flight so I can see delivery at a glance.* *(Verbatim.)*
- Ideation boards filter to Discovery; promoted items **leave the ideation board with no data loss**.
- All existing ideas backfill to Discovery and delivery views start empty — **"with no sprints and nothing promoted, the product behaves exactly as today."**
- **Read access is broad**: sprint board, backlog and provenance are viewable by **all four roles including Read Only**.

**US-DEL-09 · User · Built** — *As a delivery team member, I want a task checklist on an Issue, so that the work is divided without inventing a second work item.*
- A task added to a **Discovery** item is rejected `400` — *"a task list is a delivery artifact."*
- Moving a task to `Done` stamps completed-at and completed-by; moving it off clears both. **These stamps are the only completion record.**
- **Tasks warn but never block** — completing an Issue with outstanding tasks succeeds. *"Enforcing 'all tasks done' would make the checklist a gate, which is a ceremony this feature explicitly refuses."*
- **A task may be assigned to any active user in the organization**, whether or not they are an Issue assignee — *"constraining it to the Issue's assignees would force spurious Issue assignments just to name a helper."* The new assignee is notified; **no other task event notifies anyone** — *"ticking a box must not page the room."*
- **Task mutations are deliberately not audited** — *"a checklist ticked a dozen times a day would drown the audit log that exists to answer 'who committed us to this work'."* A conscious asymmetry with every other mutation here.
- Three states rather than a checkbox, *"because 'started but not finished' is the state a standup actually asks about."*
- Non-goal boundary: no sprint of its own, no dates, no estimate, no comments, no upvotes, no tags, no nesting. **Task counts must not be surfaced as a velocity or capacity proxy.**

**US-DEL-10 · Org Admin · Unbuilt (Slice 2, P1)** — *dated Outcomes that group Issues, so a quarter has a legible shape.*
- Each roadmap row shows **derived issue count, done count and sprint span — none of which is stored**.
- **An Issue sits under at most one Outcome** (decided 2026-09-02). Grouping is a **move, not an add**: assigning a new Outcome clears the old one.
- Soft-deleting an Outcome leaves every Issue **surviving, merely ungrouped**.
- **Outcome and Sprint are orthogonal** — changing one never affects the other.
- The Outcome's date window is its *intent*; the derived sprint span may disagree, and **that disagreement is the signal the view exists to surface, not an error to reconcile**.
- *"An Outcome groups; it never contains."* It has no status, no percent-complete, never appears on a board, and cannot be promoted, assigned or commented on.

> **Why single-parent, recorded so it is not re-argued:** counts partition the delivery set, totals sum, and "done" is unambiguous without a distinct-count anywhere. The accepted cost: work genuinely serving two quarterly goals must pick one. The failure mode to watch for is **teams raising duplicate Issues so two Outcomes can each claim the work** — which would reintroduce exactly the provenance loss the phase model exists to prevent. If it appears, single → multi is a cheap forward migration; **the reverse is lossy.**

> **Site Admin, reconciled 2026-09-03:** every ✓ on a **mutating** row of this feature's permission table is exercised **through View As, never directly**. **Direct Site Admin access to Issues & Delivery is read-only.**

---

### Epic 11 — Notifications & Audit

*Canonical: `20-feature-notifications.md`. **State: partial** — domain and application modules and the database table exist; there is **no HTTP surface, by design**.*

**US-NOTIF-01 · User · Partial** — *be notified when someone @mentions me, so I do not miss a direct request.*
- An event is written when a user is @mentioned **in an idea body** or **in a comment**; the recipient for both is **the mentioned user only**.

**US-NOTIF-02 · Author or assignee · Partial** — *be notified when my idea gets a comment or changes status, so I keep up with its progress.*
- Events fire when **a comment is added** and when **an idea's status changes**.
- Recipients are **the author and the assignees, each if different from the actor**; **self-notifications are suppressed** — no event when actor and recipient are the same user.

**US-NOTIF-03 · User · Partial** — *a notification that links straight to the idea, so I can act in one click.*
- Each event persists the canonical link **`/ideas/{ideaId}`**, alongside the idea title; following it opens the Ideas list **with that idea's detail drawer open**.
- **Superseded routes:** `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` are both replaced.

**US-NOTIF-04 · Platform owner · Partial** — *database-writes-only notifications in MVP, so no accidental email infrastructure ships early.*
- **One row per recipient per event; no batching.**
- **No SMTP, email client or outbound HTTP** in the notification path, guarded by a test asserting that no SMTP or HTTP-client descriptor is present in the service collection at all.
- **Notification events need no read or query API in MVP.**

> **Deferred:** queued email delivery (one email per event, **no consolidation**, must include the idea title and canonical link), per-user notification preferences and opt-outs, and a notification inbox UI.

---

### Deferred Epics

- **OAuth — Microsoft Entra ID (Phase 2, specified, unbuilt).**
  - Organization-scoped SSO entry points; **local email/password login retained as break-glass**.
  - Identity linking is strictly ordered — **provider + subject first, verified-email fallback second**; email fallback is case-insensitive and **requires a verified email claim**.
  - Auto-provisioning happens **only** when there is no subject mapping, no local email match, and all required claims are present; the user is created **in the initiating organization with role `User`**.
  - Every ambiguous condition is a **hard deny and is audited**: missing required claims; a subject mapping whose callback email maps to a different local account; a verified email belonging to a user in a **different** organization; multiple candidate local users for one normalized email.
  - Out of Phase 2: SAML, MFA, social providers, SCIM, external logout propagation.
- **SAML 2.0 (post-OAuth, specified, unbuilt).** Organization-scoped configuration, **SP-initiated flow only** at first, **reusing OAuth's identity-linking and auto-provisioning model unchanged** — the acceptance criterion is literally "matches OAuth behavior". Local login stays available throughout the rollout, so a misconfigured IdP cannot lock an organization out. Out of the initial phase: IdP-initiated login, MFA policy orchestration, SCIM, social providers.
- **Reporting (post-MVP, specified, unbuilt).**
  - Four baseline reports — **Idea Throughput**, **Idea Aging**, **Engagement Activity**, **Administration Activity**.
  - Date range and organization scope are **required filters** on every report; board, status, priority, assignee and actor are optional. All boundary timestamps are **UTC**.
  - **CSV export is required for each report**; JSON is optional; PDF and spreadsheet-native formats are out of scope.
  - A **Site Admin runs reports for any organization by explicit selection** — never implicitly or aggregated by default — and **exports are subject to the same authorization checks as on-screen queries**; the export path is not a weaker door.
- **Wave G — cut 2026-09-08, revisited after cutover, not cancelled.** Loop, decision records, the commitment strip, and Triage Mode.
- **Not scheduled and not gating anything:** `SPEC/ideas-inbox.md` holds unrefined ideas — Roadmaps→Sprints→Issues exploration, organization bootstrap templates, Signal, Loop, Memory. Nothing there is approved; items are picked up only when the user asks.

---

## 6. Completion Criteria

### 6.1 Definition of Done — the engineering gate

Canonical: `SPEC/90-definition-of-done.md`.

- **Engineering**
  - `SPEC/Bug Triage.md` was checked before feature work began, and no unresolved `TODO` was bypassed without explicit user approval.
  - Behavior matches the relevant `SPEC/20-feature-*.md`.
  - **Business logic lives in Application/Domain, never in controllers or UI.**
  - No hardcoded credentials or secrets.
  - API boundary validation and application business-rule validation follow `SPEC/30-Contracts.md`.
- **Contracts**
  - `30-Contracts.md` is updated when contracts change, and contract tests with it.
  - Implementation and tests stay aligned with the canonical specs.
- **Testing**
  - **Acceptance criteria are covered by tests**, and regression risk by targeted tests.
  - Development-only demo seed behavior is validated, **including idempotency and the required seeded graph**.
  - Non-Development runtime is validated to ensure the demo seed does not run.
- **Delivery**
  - A resolved triage item is removed from `TODO` and recorded once under `COMPLETED` with its date and verification note.
  - **Each PR links the feature spec it implements.**
  - Out-of-scope behavior is not added without approval.
  - **MVP release sign-off does not require OAuth or SAML endpoint delivery.**

### 6.2 Release readiness — the smoke path

Canonical: `SPEC/40-test-strategy.md`.

The critical-path check is **sign in → create a board → create an idea**. It passes when:
- a seeded account authenticates and reaches the main workspace;
- a board is created with the expected default status structure and saves;
- an idea is created on that board and appears in the board view with no validation errors.

Alongside it, five navigation and session scenarios:
- **Authentication navigation** — protected anonymous routes redirect to `/login`; ordinary login lands on `/`; required change is gated by `MustChangePassword`; `/logout` clears the session first.
- **Authentication restoration** — a valid session cookie is confirmed through `/auth/me`; an expired or unknown cookie is dropped and the reader returns to `/login`.
- **Active-session authentication** — a protected-request `401` signs the user out **only when `/auth/me` also rejects the session cookie**; an incorrect-current-password `401` preserves a session that `/auth/me` accepts.

*Corrected 2026-09-29 (`decisions.md` "Spec contradictions resolved"): these two said a stored token.*
- **Password-change authentication** — a successful required change **ends the session**: the client clears the cookie and returns to `/login?passwordChanged=1`, and the rotated `SecurityStamp` rejects the old token. *Corrected 2026-09-29 (slice 124): this said a successful required change stays authenticated across a browser reload.*
- **Board navigation** — `/boards` lists, `/board/{boardId}` opens detail, legacy routes redirect, and **no user-facing "Workflow" terminology remains**.

### 6.3 Manual client acceptance

Five items requiring a human at a browser:
- the 28-minute idle warning and its countdown to the 30-minute deadline, with "Stay signed in" resetting **only** the idle deadline;
- cross-tab synchronization of activity and logout signals;
- the session-expired message appearing on idle and absolute expiry but **not** on explicit logout or password change;
- Settings → Profile (`/settings/profile`, "My Profile") saving a new first or last name and the rest of the app showing it immediately, while email and role stay read-only;
- control geometry and icon accessibility across desktop and narrow layouts: buttons, fields and labels take their size from the design system's density tokens (comp R: 32px buttons, 34px fields, 12px labels; `--control-h*`, `--field-h` in `packages/design-system/src/globals.css`) in every theme; every icon-only control has an accessible name (`aria-label`) and a visible focus ring; and the desk, drawers and toolbars stay usable at a narrow width.

> Items 4 and 5 were rewritten on 2026-10-01 (slice 136) against `apps/web` — Next.js, Tailwind v4 and shadcn/ui, comp P with comp R's density and themes — replacing the Blazor-era wording ("Dashboard", "Fluent icon actions", FluentUI's 36px geometry). The intent is unchanged and is also kept in `e2e/README.md`.

### 6.4 What the golden corpus cannot prove

`tools/golden` holds **447 cases across all 81 endpoints** of the deleted application, at four roles and anonymous. **It stopped gating on 2026-09-11** — `pnpm check` is the gate — and it can no longer be re-recorded, so it is a fixed regression detector rather than a specification; a diff is a question, not automatically a defect. Three blind spots remain completion criteria in their own right:

- **It only sends the requests it recorded.** Boundary validation — over-length names, malformed ids, non-array bodies — was never exercised, and a review found three classes of reachable `500` on inputs no fixture sends. **Every slice transcribes its DTO's validation attributes rather than trusting a green replay.**
- **A fixture matching is not proof the ordering rule is right.** The organization list's default sort was inverted and the fixture matched anyway, because the seed's two organizations happen to be created in alphabetical order.
- **It redacts credentials in both directions**, so a *change* in a redacted value is invisible. "Regenerating an invite code returns a different code" must be a unit test; a replay diff can never see it.

Reading a replay run: the per-scenario `failed` column counts steps that **did not run**, not diffs. **`0 failed` is not `0 diffs`** — read the diff list printed at the end of the run.

---

## 7. Delivery State

**Verified 2026-09-29 against `e92ddde`** (`dev`), counted from the working tree in one sitting by slice 134 (F5), not carried forward. The 2026-09-14 count at `a2bbbc3` it replaces is in git history. Every figure is pinned to that commit; re-derive before any planning claim. `SPEC/implementation-agent-tracker.md` remains the authoritative live record.

| | |
|---|---|
| **MVP epics** | T001–T067 merged. Foundation → Hardening, User-Defined Fields, Idea-Type Fields. Done. |
| **Sprints** | 1–7 complete · 7.5 closed · **8 cancelled** (nothing ever deployed to Azure) · **9, the conversion, is down to two slices** · 10, 11 and 12 (comp R phase 1, the comp R iteration, the prompt-eval runner) complete. |
| **The conversion** | Waves A, 0, B, C, D and E are **merged**. Wave F: **F6** (the .NET solution deleted, 2026-09-13), **F2** (the Playwright suite on the TypeScript stack, 38/38) and **F5** (this reconciliation) are closed; **F3** has nothing to transform, since the target is seeded fresh (`SPEC/decisions.md` 2026-09-09 "The drifted database is rebuilt, not migrated"). **F1** (triaging the golden replay's differences) closed 2026-10-01; **F4** (the cutover runbook) remains. **Wave G is cut** (2026-09-08), revisited after cutover. |
| **API surface** | **108 route decorators across 20 controllers** — 105 product routes, the health check, and the two demo-seed routes (refused unless `COLLEGA_ALLOW_DEMO_SEED` is set). Every route has a contract in `SPEC/contracts/` (the demo-seed pair in `contracts/demo-seed.md`, §8 item 7); every contracted route is served except six that are marked deferred or withdrawn (§8 item 3). |
| **Client** | **39 pages** across the `(auth)` and `(desk)` groups — desk, delivery and settings — reading the API. **No fixture residue** since slice 132 (2026-09-29): `apps/web/lib/mock.ts` is deleted, and Home and the three AI administration screens (Settings → AI assist, AI prompt, API usage) read the API. The three Outcome readers answer empty because Outcomes have no backend (§4, Epic 10). Home's *Open ideas*, *Awaiting review* and *Completed · 30d* tiles and its *Recent activity* feed have no route behind them and render as not tracked yet (tracker, slice 132). |
| **E2E** | **38/38** from one `pnpm test:e2e` run on a fresh worktree against a scratch database, production rate limits in place. |
| **Golden corpus** | Stopped gating 2026-09-11; see §6.4. A regression detector, not the specification (`SPEC/decisions.md`): a diff is a question — fix it, accept and record it, or deliberately do better. A fixed record alongside `tools/golden/inventory.json`. Its last full replay (slice 141, 2026-10-01): 360 of 447 match, 87 accepted, **0 unexplained**, and 8 stale entries in `tools/golden/src/accepted.ts` — F1 is closed. |
| **Database** | Rebuilt rather than migrated: drop → `db:migrate` → `db:seed`. **Seven migrations** — the baseline, then delivery and sprints, delivery notification events, board description, structured idea fields, board archive and tag colour. The demo seed's modules are in `packages/infrastructure/src/demo-seed/modules/`: organizations, users, boards and statuses, ideas and upvotes, idea details, comments, delivery, and scenario. Idempotent — ids derive from stable names, so two seeded databases agree about every id. |
| **Deleted** | `src/Collega.*`, `tests/`, `Collega.sln` and `global.json` went in slice **F6** (2026-09-13). A reference to a `dotnet` command, a `.csproj`, or a path under `src/Collega.*` anywhere in this repository is stale — report it rather than following it. F6 kept `SPEC/`, the golden corpus, and the AI-assist evaluation corpus in `tools/prompt-eval`. |
| **Hosting** | Vercel is the canonical target; the Azure workflows were deleted. |

### Test suite — counted 2026-09-29 at `e92ddde`

**1,660 passing, 91 skipped, 0 failing**, from one `pnpm test --force` run: 16 of 16 tasks successful, nothing cached.

| Package | Tests |
|---|---:|
| `packages/application` | 590 |
| `apps/web` | 303 |
| `packages/design-system` | 186 |
| `apps/api` | 158 |
| `tools/prompt-eval` | 151 |
| `packages/domain` | 117 |
| `tools/golden` | 80 |
| `packages/infrastructure` | 32 passing, 91 skipped |
| boundaries (Biome layer rules) | 30 |
| `tools/local` | 10 |
| arch | 3 |

The 91 skips are `packages/infrastructure`'s live-database suite, guarded by `skipIf(!DATABASE_URL)`: this run had no `DATABASE_URL`, as CI must not (present but pointing at no database, the suite runs and fails). The 2026-09-14 count had a seeded database and so showed no skips.

### The quality gap that used to be here — now closed

- An earlier draft recorded coverage as *"inverted against risk"*: `packages/application` was the largest package, carried authorization, and had **35 tests** while `apps/web` had 94 — the layer where a mistake means one organization reads another's data, and the only layer of consequence with no independent QA pass.
- **That slice has landed: `packages/application` had 423 tests by 2026-09-14** (590 at `e92ddde`), the largest suite in the workspace by a wide margin, written by an agent that had not touched the source, per the repository rule that an author does not test their own code. Triage items it raised were fixed separately (`fix/triage-application-guards`), including an unreachable Site Admin branch and a missing organization-existence check.
- The pattern is proven three times: Wave E's QA slice produced 102 tests and **verified every rule by breaking it — 21 mutations, 21 caught**; D1's took `apps/api` from 26 to 87 and found two divergences neither implementer nor reviewer had spotted; this one took `packages/application` from 35 to 423.

---

## 8. Appendix — Discrepancies Found

Defects in the canonical specs, surfaced by reconciliation and **reported rather than fixed** unless they were pure staleness: canonical files are edited deliberately, first, and with the user's agreement. Re-walked 2026-09-29 by slice 134 (F5).

**1. Resolved.** `30-Contracts.md` carried `## Idea Field Option Contracts` twice, and the copies disagreed on the reorder method (`POST` vs `PUT`) and on the Business Impact default. The copies were merged into `contracts/idea-field-options.md` on 2026-09-28, following the code (`POST`); the default was decided on 2026-09-29 — the first active option for both collections, preselected by the form (`decisions.md` 2026-09-29 "Spec contradictions resolved"). See §3.

**2. Resolved 2026-09-29.** The six `field-definitions` routes were built and undocumented in the contract set; slice 124 wrote them from the code into `contracts/field-definitions.md` (`decisions.md` 2026-09-29 "Contracts and wording written from the code"). With that, the Definition of Done's Contracts clause is no longer violated on this count.

**3. Six contracted routes, and two capabilities, are unbuilt — each deliberately, and each marked so where it is contracted.** The two `password-reset` routes (Post-MVP); the two `ai-key` routes (deferred per AI rule 30 — *a future agent reading those contracts must not build them*); `ai-draft` / `ai-polish` (withdrawn 2026-09-27, never built); a notification read API (MVP is database writes only; no route is contracted); and Outcomes.

**4. Resolved 2026-09-29.** The Idea Type decision table's "Option appearance" row, which said label and sort order only, is marked superseded by rule #9 (a color **and** icon).

**5. Source typos.** The two in `20-feature-ideas-and-engagement.md` — `4,` for `4.` in the Upvotes rules and a stray trailing backtick — are gone. `20-feature-auth.md`'s requirement numbering still **skips #3** (1, 2, 4, 5…); it stays, because other specs cite those requirements by number.

**6. Resolved 2026-09-29 (slice 134).** Three served routes had no contract: `POST /ai-assist/prompt/reset`, `DELETE /organizations/{organizationId}/logo` and `GET /health`, all recorded by the golden corpus. They were written from the code, and `PUT /organizations/{organizationId}/logo`, which described a `multipart/form-data` upload neither stack accepted, now describes the JSON body and response the corpus records.

**7. Resolved 2026-09-30.** `POST /demo-seed` and `POST /demo-seed/reset` (Settings → Demo data, 2026-09-14) stay, opt-in only: they answer only where `COLLEGA_ALLOW_DEMO_SEED` is set, which Production never sets (`decisions.md` 2026-09-30 "What the MVP release includes", item 2). Slice 136 wrote `contracts/demo-seed.md` from the code and added the exception to `90-definition-of-done.md`.

**8. Resolved 2026-09-30 — built.** The browser idle deadline (`20-feature-auth.md` requirements 38–42: the 30-minute idle expiry, its warning, and the cross-tab sync) is built, slice 129. The web client's column reorder calling `POST /boards/{boardId}/swimlanes/reorder` is built, slice 130 — by dragging the lane header, with left/right buttons as the accessible fallback (`decisions.md` 2026-09-29).

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
