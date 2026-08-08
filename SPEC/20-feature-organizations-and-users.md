# Feature: Organizations and Users

## Outcome
Administrators can manage organizations and users with clear role boundaries within a dedicated Admin section of the application. Organization creation and user registration are kept deliberately simple: an organization needs only a title, description, and optional logo address, and users can join an organization by self-registering with that organization's invite code, by being added directly by an authorized admin, or via admin CSV import.

## Organization Rules
1. Organizations are the top-level ownership boundary for all business data.
2. Only Site Admin can create organizations.
3. Creating an organization requires only a Title and Description; a Logo Address (URL) is optional.
4. When an organization is created, the system automatically generates a unique Invite Code for that organization.
5. The Invite Code is displayed in both the organization list view and the organization detail page.
6. Site Admin and Org Admin can regenerate the Invite Code for organizations they administer; regeneration immediately invalidates the previous code.
7. Site Admin and Org Admin can edit organization details for organizations they administer.
8. Organizations can be archived but cannot be hard-deleted.
9. Archived organizations' invite codes are invalid; self-registration against an archived organization is rejected.
10. A newly created organization starts with the default statuses and one default board.
11. Organization administration screens must provide guided empty states with a primary action and short explanatory text when no relevant records exist.
12. Organization edit screens include logo upload with in-form preview for board branding.
13. Each organization can have only one active logo at a time.
14. Uploading a new logo replaces the previous logo.
15. The rendered organization logo height is capped at `150px` while preserving aspect ratio.
16. Authenticated admin surfaces use a primary-blue header with a `150px` left brand zone and logo in the top-left.
17. The header exposes a logout icon, and admin-authorized users also see a gear icon that navigates to the Admin homepage.
18. Breadcrumb navigation is shown directly below the header.
19. In Development, startup seed creates 3 demo organizations with realistic profile data for walkthrough and validation.

## Organization Fields
- Title (required, max 200 characters)
- Description (required, max 1000 characters)
- Logo Address (optional URL, max 500 characters)
- Invite Code (system-generated, unique across organizations)
- Logo URL (system-managed)
- Logo Thumbnail URL (system-managed)
- Logo Height Px (system-managed, max rendered value `150`)

Optional profile fields (editable after creation, not required to create an organization):
- Address (max 200 characters)
- City (max 100 characters)
- State (max 50 characters)
- Zip (max 20 characters)
- Phone (max 25 characters)
- Primary Contact First Name (max 100 characters)
- Primary Contact Last Name (max 100 characters)

All organization text fields are trimmed before validation and persistence.

## Organization AI Credentials
AI-assisted idea creation (see `SPEC/20-feature-ideas-and-engagement.md`) authenticates every model call with an API key. The deployment supplies a default key, and an organization may optionally supply its own to move that consumption onto its own vendor account.

1. The deployment supplies a default AI API key through configuration (`Ai__ApiKey`), read at startup from environment-provided configuration in the same manner as the seed Site Admin credentials.
2. Each organization may optionally store its own AI API key. When present, it is used for every AI call made in that organization's scope.
3. Key precedence for any AI call is: the organization's own key when configured, otherwise the deployment default key.
4. When neither an organization key nor a deployment default key is configured, AI-assisted idea creation is unavailable for that organization. The feature must degrade to the manual idea form with an explanatory message rather than presenting a failing action.
5. Site Admin can set, rotate, and clear the AI API key for any organization. Org Admin can do so only for their own organization. `User` and `Read Only` can neither view nor manage it.
6. The key is encrypted at rest and is write-only across the entire API surface. No endpoint, log entry, audit payload, error message, or client view ever returns the stored key value.
7. Administration screens display only whether a key is configured, its last four characters, and when and by whom it was last updated.
8. A submitted key is validated with a single low-cost model call before it is persisted. A key that fails validation is rejected and the previously stored key, if any, is left untouched.
9. When an organization's own key fails at request time — invalid, revoked, rate-limited, or erroring — the call is retried once against the deployment default key so the user's flow completes normally. The organization's stored key is left in place and is not automatically cleared or disabled in MVP.
10. Every fallback to the deployment default key generates an audit event recording the organization, the triggering action, and the failure category. This is the only signal that an organization's key is broken, since the feature keeps working from the user's perspective.
11. Setting, rotating, and clearing an organization's AI API key each generate an audit event recording the acting user, never the key value.
12. Clearing an organization's key returns that organization to the deployment default key.
13. An archived organization's stored key is retained but unused, and is restored to service if the organization is unarchived.

### Organization AI Credential Fields
- AI API Key (optional, write-only, encrypted at rest, never returned)
- AI API Key Last Four (system-managed, display only)
- AI API Key Updated At (system-managed, UTC)
- AI API Key Updated By (system-managed, user reference)

## User Registration and Creation
Users can be added to an organization through three paths:

### 1. Self-registration with an invite code
1. Individual users can self-register for an account by supplying a valid organization Invite Code along with their profile details and password.
2. The invite code entered determines which organization the new account is associated with.
3. If the invite code is missing or invalid, registration is rejected and the user is prompted to provide a correct invite code.
4. Self-registered users are created with the `User` role and `Active` status.
5. Self-registration is rejected if the email is already in use.

### 2. Direct creation by an admin
1. Site Admin can add users to any organization.
2. Org Admin can add users only to their own organization.
3. Admin-created users do not require an invite code; the admin selects role and issues an initial password.

### 3. CSV import by an admin
1. Site Admin and Org Admin can bulk-create users by uploading a CSV file, scoped to a single target organization (Org Admin only for their own organization).
2. The CSV contains the fields required to create a user (First Name, Last Name, Email, and optionally Role); an invite code column is not required.
3. Every user created via CSV import is associated with the organization the admin is importing into.
4. Rows with a missing Role default to the `User` role.
5. Each imported user receives a system-generated temporary password and must change it on first login.
6. The import result reports per-row outcomes; rows with invalid data or duplicate emails are rejected individually without failing the whole import.

## User Rules
1. Site Admin can manage users across all organizations.
2. Org Admin can manage users only within their own organization.
3. Each non-Site Admin user belongs to exactly one organization.
4. Each user must have one role.
5. Email is used as the user's mention identity in collaboration features.
6. User email must be globally unique across the system.
7. Site Admin is a global account and does not belong to an organization.
8. An Org Admin cannot remove their own Org Admin role or deactivate themselves if they are the last Org Admin in that organization, only the Site Admin can deactivate the organization.
9. Administrators handle password reset by issuing temporary passwords in P1.
10. User accounts support `Active` and `Inactive` states only in MVP.
11. Organization changes, user changes, role changes, account status changes, invite code regeneration, self-registrations, and CSV imports must be audited.
12. Development startup seed creates one Org Admin, one User, and one Read Only user in each seeded demo organization.
13. Every authenticated user can update their own First Name and Last Name; self-service profile editing cannot change Email, Role, Organization, or Status.

## User Fields
- First Name (max 100 characters)
- Last Name (max 100 characters)
- Email
- Password
- Role
- Organization
- Status (`Active` or `Inactive`)

User profile text fields are trimmed before validation and persistence.

## Credential Rules
- Passwords must satisfy the authentication complexity policy.

## Roles
- **Site Admin**: global administrator
- **Org Admin**: organization administrator
- **User**: standard contributor
- **Read Only**: limited participant

## Acceptance Criteria
- [ ] Site Admin can create organizations with only a Title, Description, and optional Logo Address
- [ ] Org Admin cannot create organizations
- [ ] A unique Invite Code is generated automatically when an organization is created
- [ ] The Invite Code is visible in the organization list view and the organization detail page
- [ ] Site Admin and Org Admin can regenerate an organization's Invite Code, invalidating the previous code
- [ ] A user can self-register with a valid invite code and is associated with the matching organization
- [ ] Self-registration with a missing or invalid invite code is rejected with a prompt to provide a correct code
- [ ] Self-registered users receive the `User` role and `Active` status
- [ ] Site Admin can add users to any organization; Org Admin only to their own
- [ ] Site Admin and Org Admin can CSV-import users into an organization they administer without invite codes
- [ ] CSV-imported users are associated with the organization targeted by the import
- [ ] CSV import reports per-row outcomes and rejects invalid or duplicate rows without failing the whole import
- [ ] Organizations can be archived without being hard-deleted
- [ ] Archived organizations are hidden from admin lists by default unless explicitly filtered for archived items
- [ ] New organizations are provisioned with default statuses and one default board
- [ ] Admin screens provide guided empty states with a primary action and short explanatory text
- [ ] Organization edit form supports logo upload and displays a thumbnail preview after upload
- [ ] Uploading a new organization logo replaces any previously stored organization logo
- [ ] Board header displays the current organization logo with rendered height no greater than `150px`
- [ ] Site Admin can manage users across organizations
- [ ] Org Admin can manage users only in their organization
- [ ] Development startup seed creates 3 demo organizations
- [ ] Each demo organization includes exactly one seeded Org Admin, one seeded User, and one seeded Read Only user
- [ ] Site Admin is not required to belong to an organization
- [ ] User email is available for collaboration features that resolve mentions
- [ ] User email is globally unique across the system
- [ ] Organization and user text fields are trimmed and validated against their maximum lengths
- [ ] Authenticated users can update their own first and last name without changing administrator-controlled account fields
- [ ] The last Org Admin in an organization cannot remove their own admin access or deactivate themselves
- [ ] Inactive users cannot authenticate
- [ ] Organization and user administration actions generate audit events
- [ ] Site Admin can set, rotate, and clear the AI API key for any organization
- [ ] Org Admin can set, rotate, and clear the AI API key only for their own organization
- [ ] `User` and `Read Only` can neither view nor manage an organization's AI API key
- [ ] A stored AI API key is never returned by any endpoint, log, audit payload, or client view
- [ ] Administration screens show only whether a key is configured, its last four characters, and when and by whom it was last updated
- [ ] A submitted AI API key is validated with a low-cost model call before persistence, and a failing key is rejected without disturbing the previously stored key
- [ ] An organization with its own AI API key uses that key for AI calls; an organization without one uses the deployment default key
- [ ] An organization key that fails at request time falls back to the deployment default key and the user's action completes normally
- [ ] Every fallback to the deployment default key generates an audit event identifying the organization and failure category
- [ ] Setting, rotating, and clearing an AI API key each generate an audit event that records the acting user and never the key value
- [ ] Clearing an organization's AI API key returns that organization to the deployment default key
- [ ] AI-assisted idea creation is unavailable, with an explanatory message and a path to the manual form, when neither an organization key nor a deployment default key is configured
- [ ] Users are assigned exactly one organization and one role