# WorkSprint phase 1 capability map

Approved by the owner on 2026-11-05. Specification, plan and task approval
remain separate gates. No implementation or external changes are authorized.

| Module id | Responsibility | Depends on |
|---|---|---|
| public-brand | WorkSprint public copy, replacement mark, metadata and current collateral | None |
| marketing-site | New marketing landing page content, design and implementation at worksprint.io | None |
| public-domain | worksprint.io and app.worksprint.io, redirects, browser-state expectations and cutover/rollback | public-brand, marketing-site |

The owner approved adding marketing-site and this dependency order on 2026-11-05.
Brand and marketing preparation can proceed independently. Domain preparation
can overlap, but final cutover depends on the branded app and landing page.
Implement only after the applicable approval gates; verify all three together
before the final release.

Use the repository's existing `SPEC` storage conventions. Module specifications
will be `SPEC-public-brand.md`, `SPEC-marketing-site.md` and
`SPEC-public-domain.md` alongside this map.
The existing `worksprint-rename-plan.md` is an inventory and estimate, not an
approved implementation specification.

## Confirmed intent

- Rename the public-facing platform from Collega to WorkSprint first.
- Build a new marketing landing page at worksprint.io.
- Place the marketing site in a separate apps/marketing application and
  Vercel project within this repository (owner, 2026-11-05).
  Preserve the existing application's authentication routing rather than
  introducing host-aware routing for two sites inside apps/web.
- The marketing landing page's primary audience is cross-functional teams
  managing ideas through delivery (owner, 2026-11-05).
- The marketing page's primary conversion is a beta signup form, with a
  secondary Login button or link (owner, 2026-11-05).
- Use a hosted form service for beta signup; the specific provider must be
  proposed and explicitly approved before integration (owner, 2026-11-05).
- Plan against Web3Forms Free as the provisional beta-form provider
  (owner, 2026-11-05: "ok let's assume Web3Forms for the form integation
  for now"). Its 250 monthly submissions are acceptable for launch.
  This is a planning selection, not authorization to create an account,
  transmit applicant data, purchase a plan or deploy the integration.
  Provider setup and final privacy wording remain unresolved.
- Beta signup fields: required name and email; optional organization,
  team size and use case (owner, 2026-11-05). Field constraints and team-size
  choices remain to be specified. This settles the field selection only.
- Team size is an optional dropdown: 1, 2-10, 11-50, 51-200 and 201+.
  Leaving it blank is valid (owner, 2026-11-05).
- Form limits: name 100 characters, email 254, organization 200 and
  use case 1,000. Trim required name/email and check basic email format;
  accept both personal and work addresses. Optional use case has no
  minimum length (owner, 2026-11-05).
- Launch uses Web3Forms spam filtering and an invisible honeypot,
  with no CAPTCHA (owner, 2026-11-05). This does not guarantee spam-free
  intake; preserve honest error/limit feedback.
- Successful beta submission shows an inline receipt confirmation.
  Requests are reviewed manually and applicants are contacted about access;
  submission does not create an app account or send an automatic confirmation
  email (owner, 2026-11-05). Do not promise an access date or guaranteed admission.
- Retain beta applicant data until the beta ends, then delete within 30 days
  from Web3Forms and the receiving mailbox (owner, 2026-11-05).
  The beta end date/event and cleanup owner remain unresolved.
- Applicant details are used only for beta-request review and beta-access
  communications. No marketing subscription or marketing-updates checkbox
  is included in Phase 1 (owner, 2026-11-05).
- Explore a distinct marketing visual direction before choosing
  (owner, 2026-11-05). The marketing palette, typography and layout are
  not approved; the application's existing design direction stays unchanged.
- Plan three marketing HTML concepts for owner review: light editorial,
  dark product-focused and warm collaborative. Use the same 02C logo and
  beta-signup content to compare visual directions (owner, 2026-11-05).
  Concept review is required before production marketing UI implementation.
- The marketing message leads with turning ideas into coordinated delivery,
  supported by shared context, boards and sprint planning (owner, 2026-11-05).
  Final copy requires review; this is positioning, not an approved slogan.
- Marketing page sections: hero and beta CTA, concise ideas-to-delivery
  explanation, three capability highlights, real product preview, short
  beta FAQ, signup form and footer with Login and Privacy links
  (owner, 2026-11-05). Exclude pricing, testimonials, customer logos and
  unsupported performance claims. Final copy remains subject to concept review.
- Update current public references and platform-owned source defaults.
  Preserve historical artifacts, frozen data and user-authored/stored custom
  content; no bulk database content replacement is authorized
  (owner, 2026-11-05).
- Host the existing application at app.worksprint.io.
- The owner replaced the earlier worksprint.app / app.worksprint.app targets
  with worksprint.io / app.worksprint.io on 2026-11-05 after purchasing
  worksprint.io. No redirect or other use of worksprint.app is approved.
- Keep API/MCP hosts and technical identifiers unchanged in Phase 1
  (owner, 2026-11-05), including package names, environment keys and cookies.
- Accept one-time sign-in and theme reselection on app.worksprint.io
  (owner, 2026-11-05). Do not build cross-domain session/preference migration.
- The current public application is at https://collega-ai.com/;
  it currently has no separate public landing site (owner, 2026-11-05).
  Live DNS/deployment configuration remains to be verified before cutover.
- No old-domain redirects are required (owner, 2026-11-05: the site is
  not live to users and there are no old shared links to preserve).
  This supersedes the earlier same-path/query redirect choice.
- Remove collega-ai.com from the application's Vercel domain bindings
  after app.worksprint.io is verified (owner, 2026-11-05).
  Do not delete the domain registration or unrelated DNS records.
  This is the planned cutover action, not authorization to execute it now.
- Technical renaming is conditional on a later explicit owner decision.
- Phase 2 is unscheduled and will be reviewed only when the owner requests
  it; no automatic observation-period trigger is required (owner, 2026-11-05).
- Ask clarification questions one at a time.
- Use 02C / Team Convergence from `mockups/worksprint-parallel-tracks.html`
  as the current logo choice for both the marketing site and application
  (owner, 2026-11-05: "Let's go with 2C for now both on the marketing site
  and the app's logo"). This replaces the earlier WS Ligature refinement
  preference. Production asset preparation and small-size verification
  belong in the implementation tasks; this choice does not approve a
  palette change or the comparison board's wordmark typography.

## Unresolved scope and behavior

- Final marketing copy, chosen visual concept and page section scope.
- Form field constraints, team-size choices and spam-control treatment.
- Provider setup, receiving mailbox, privacy wording, beta-end event and
  cleanup owner.
- Exact current collateral list and verification acceptance criteria.

Recommendations in the inventory or conversation do not settle these questions.
Earlier hours/token estimates did not include building a new marketing site.

The owner explicitly deferred the receiving mailbox, Web3Forms account/form
setup, beta-end event, cleanup owner and final privacy wording to pre-launch
gates on 2026-11-05. They remain blockers to live submissions, not approved
defaults. Final marketing design and copy remain owner-review gates.
