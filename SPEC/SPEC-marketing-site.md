# Spec: marketing-site

Status: draft for owner review. No implementation authorized.
Authority: `worksprint-phase-1-capability-map.md`, owner decisions 2026-11-05.

## Objective

Create a single-page public site at https://worksprint.io for cross-functional
teams managing ideas through delivery. Lead with turning ideas into coordinated
delivery, supported by shared context, boards and sprint planning.
Primary conversion: beta signup. Secondary action: Login at
https://app.worksprint.io/login. Do not imply signup grants immediate access.

## Page and design requirements

Sections: hero/beta CTA, concise ideas-to-delivery explanation, three capability
highlights, real product preview, short beta FAQ, form and footer with Login
and Privacy links. No pricing, invented testimonials/customer logos or
unsupported performance claims.

Prepare three throwaway HTML concepts under `SPEC\mockups`: light editorial,
dark product-focused and warm collaborative. Compare the same content and
02C / Team Convergence logo. Owner selects design and reviews copy before
production UI. The app's palette/layout do not change.
Use a real approved app capture for the product preview; never fabricate data
or expose private tenant content.

### Owner-directed product-tour review page (2026-11-09)

- Add a separate, public-only, self-paced tour at `/tour/` in the existing
  static `apps/public` site. It is a review page, not signed-in onboarding.
- Use approved screenshots from `apps/public/worksprint-assets/` for the
  five-stop narrative, with short, accurate descriptions and visual highlights.
- Add an optional screen index using the 29 owner-requested captures in
  `apps/public/prototype/shots/`. Identify them as illustrative prototype
  captures, retain the context that they show the earlier Collega branding and
  seeded sample data, and do not imply that prototype-only screens are available
  in the current app.
- Do not imply that any screenshot is a live, interactive app session.
- The owner subsequently approved consistent navigation across the homepage,
  tour and five product pages: Product tour, Beta FAQ, Login,
  with Request beta access as the primary header button. Product tour groups
  Guided overview, Ideas, Boards, Backlog, Sprints and Roadmap in a click/tap
  submenu. The footer uses the same grouping plus Privacy. This supersedes
  the initial unlinked-review placement.
- The owner subsequently removed The approach from the shared navigation;
  its homepage content remains.
- Keep the tour out of the sitemap and marked `noindex` until indexing is
  explicitly approved.
- This temporary placement for the review page does not settle the longer-term
  marketing-app architecture described below.

## Form behavior

Use Web3Forms Free provisionally, with 250 submissions/month acceptable for
launch. Native page controls match the selected marketing design, not an
iframe. No CAPTCHA; use provider spam filtering and an invisible honeypot.

| Field | Required | Limit / values |
|---|---|---|
| Name | Yes | 100 characters; trimmed nonempty |
| Email | Yes | 254 characters; trimmed, basic format; personal/work accepted |
| Organization | No | 200 characters |
| Phone number | No | Telephone input; accepts international formatting |
| Team size | No | Blank, 1, 2-10, 11-50, 51-200, 201+ |
| Industry | No | Blank, Technology, Financial services, Healthcare, Education, Manufacturing, Retail & e-commerce, Professional services, Government & nonprofit, Other |
| Use case | No | 1,000 characters; no minimum length |
| Product news | No | Unchecked checkbox; "Sign Up for Product News", with "Product specific news and updates." |

Phone follows Organization. Industry sits below Team size. Optional dropdowns
start blank, without the previous "Select if you'd like" prompt.
Show a live use-case character count, initially "0 of 1,000 characters used".

Do not disable browser validation without equivalent accessible feedback.
Prevent duplicate submission while pending. Show success only after the
provider confirms acceptance, as an inline receipt message: requests are
reviewed manually and applicants contacted about access. No guaranteed
admission/date, account provisioning or automatic confirmation email.
On provider/network/limit failure, show an explicit error and preserve the
draft for correction/retry. Do not automatically retry submissions.

The owner's subsequent signup-copy decision supersedes the earlier prohibition
on a marketing checkbox: product news requires a separate, optional opt-in.
The requested privacy copy describes signup information as used only for account
creation, not stored permanently, and not used for marketing without that opt-in.
This is forward-looking copy, requested as though signup were already connected;
the static form still sends nothing and creates no account. Before live intake,
resolve how this account-creation purpose fits manual beta review and set a
specific deletion schedule. The earlier beta-end-plus-30-days retention proposal
does not settle those new requirements.
Do not log applicant payloads or send them to analytics.

The static demo's Privacy disclosure uses the owner-requested brief copy:
"Our website analytics collect only aggregate usage information, never
personally identifiable information." Add: "We use your signup information only
to create your account and don't store it permanently. We never use it for
marketing unless you opt in to product news." Omit provider names and setup
details from this disclosure. These copy changes do not resolve the live-intake
privacy and setup gates below.

Remove the homepage screenshot-provenance paragraph and the demo-only paragraph
beside the form; omit demo labels from the form heading and submit button.
Keep submission feedback truthful while the form remains disconnected.

## Tech stack and commands

Plan a separate `apps\marketing` app and Vercel project in this repository.
Reuse existing Next.js/React/TypeScript/Tailwind versions and architecture
patterns; no new third-party dependencies are approved.
The new package's technical name is unresolved and must be reviewed in the
plan; do not rename existing packages to establish it.

Executable existing commands, from repository root:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

The plan supplies new app dev/targeted QA commands once its manifest and
non-conflicting local port are selected. Restore dependencies only after
approved manifest changes or a missing-dependency failure.

## Project structure and code style

- `apps\marketing\app`: public routes, metadata, page and privacy notice.
- `apps\marketing\components`: selected layout and interactive form.
- `apps\marketing\test`: QA-owned Vitest coverage.
- `e2e`: QA-owned browser checks with intercepted provider requests.
- `SPEC\mockups`: the three reviewed design concepts.

Use semantic HTML and minimal client boundaries; validation here provides
feedback, not an authoritative security boundary. Proposed form constraint:

```tsx
<input name="email" type="email" required maxLength={254} />
```

Supply a visible associated label in the actual component. Reuse approved
primitives; don't bypass workspace layer rules or share application auth state.

## Testing strategy

QA owns high-impact tests: field constraints, pending state, provider success,
rejection/network failure, preserved draft and no duplicate automatic retry.
Intercept Web3Forms in automated tests; no real applicant data or live
provider calls. Browser checks cover keyboard use, focus/error announcements,
375px and desktop layouts, visible labels and readable contrast.
Verify Login points to the application and success does not imply admission.
Owner-assisted live smoke uses explicitly approved synthetic data only.

## Boundaries

- Always: show honest submission state; preserve privacy boundaries; review
  the comp before production; include the new app in lint/type/test/build gates.
- Ask first: provider setup/live calls, dependencies, analytics/tracking,
  unsupported product claims, changed retention or additional form fields.
- Never: put a private credential in a client bundle, store applicant data in
  the app database without approval, provision accounts from beta signup,
  enable live intake with unresolved privacy/setup blockers.

## Success criteria

1. An owner-selected concept becomes a responsive public page with the
   approved sections, final copy and 02C logo.
2. The form matches the page styling, enforces the approved constraints
   and clearly distinguishes accepted submissions from errors.
3. Login remains available and routes to app.worksprint.io/login.
4. The public privacy notice accurately describes approved intake purpose,
   processor, retention and contact/deletion process before live intake.
5. Separate deployment and repository gates are verified without weakening
   existing application authentication or architecture checks.

## Open gates

Owner explicitly deferred these to pre-launch: receiving mailbox, Web3Forms
account/form setup, beta-end event, cleanup owner and final privacy wording.
They remain live-intake blockers. Provider Free storage/retention settings
must be checked against the approved policy; escalate any mismatch.

Design/copy selection remains required. New package name, local port,
preview deployment behavior and integration configuration are plan-review
items, not implicit approvals. Spec approval precedes the implementation plan.
