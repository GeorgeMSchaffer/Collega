# WorkSprint rename: draft inventory and effort estimate

**Planning only.** Prepared 2026-11-05 against `dev` at `15d458c7`.
This document authorizes no implementation, release, service change or historical rewrite.

## 1. Intent and recommendation

The owner requested a rename from **Collega** to **WorkSprint**, selected a standalone
plan in `SPEC` without Superwiki setup, and requested a full inventory with separate
public-brand and technical estimates. The owner subsequently confirmed the sequence:
public-facing work first; consider technical naming only if phase 1 works well and its
benefit justifies the risk.

**Confirmed intent:** phase 1 changes the public-facing brand. **Not approved:** phase 2,
its technical identifiers, a new domain, or implementation of either phase.
`worksprint`, `@worksprint` and `WORKSPRINT_` would be candidate technical spellings,
not approved replacements.

Recommendation: ship the public brand without changing package names, authentication
cookies, database identities or stable API identifiers. After an agreed observation
period, hold a phase-2 go/no-go review. Keeping internal Collega identifiers indefinitely
is a valid outcome, not a failed rename.

| Planning budget | Human-hours | What it covers |
|---|---:|---|
| Phase 1: public brand, retaining current hosts and technical identities | **40–80** | Preparation, copy, existing mark adaptation, current reference comps, public docs/demo output, assistant/display-text review, QA, release and phase-2 decision evidence |
| Optional public web-domain transition | **+10–22** | One owner-approved web domain, redirects, search configuration and origin/session checks; not approved |
| Phase 2: conditional technical work, additional to phase 1 | **+60–120** | Package graph, environment/tooling names, browser compatibility, stable interfaces, local data identities, developer docs/config and extra QA/release work |
| Both base phases, only if phase 2 receives approval | **100–200** | Sum of the two base budgets, not the phase-1 commitment |
| Both phases plus the optional public domain | **110–222** | Domain work counted once |

These are planning judgments, not measured implementation times or guarantees.
At six productive hours per person per day, phase 1 is roughly 7–14 person-days;
conditional phase 2 adds 10–20. Calendar time also includes owner decisions, reviewer/QA
availability, release scheduling, DNS propagation if applicable, and the observation period.
Two people won't halve work whose release and compatibility steps depend on each other.

## 2. Evidence, scope and counting rules

Fresh checks read the tracker's Current Status section and the latest ten commits.
`15d458c7` merges PR 77; recent commits include the usage-screen merge `80b5f8d9`
and usage-read fixes `bb398c9b`. The working tree was clean before this draft.
The tracker's introductory status still says 2026-10-20 and describes cutover as open,
while its table records a 2026-10-21 release and later merges. Treat that header as stale;
this plan does not repair it or claim a live-production audit.

Inventory scope is **the 2,055 tracked paths at this baseline**, including dotfiles.
Scanning decoded **2,048 UTF-8 text files**, including the safe committed `.env.example`;
seven binary/non-UTF-8 files fall outside text counting. No tracked credential-bearing
environment files required exclusion at this baseline. No real `.env`, `.env.local`,
untracked `.vercel` configuration, credentials or remote dashboards were inspected.

The case-insensitive literal substring `collega` matches `Collega`, `collega`, `COLLEGA`,
`@collega`, domains and longer identifiers. It does not require word boundaries.

- **Occurrences:** every non-overlapping substring match, including multiple matches on one line.
- **Matching lines:** each text line containing one or more matches counts once.
- **Matching files:** each decoded tracked file with one or more matches counts once.
- **Path matches:** tracked repository-relative path strings containing the substring;
  separate from file contents and from the absolute checkout directory.

Results: **3,375 occurrences on 3,241 matching lines in 1,056 files**.
There are **two matching tracked paths**. A file's location determines one category;
the totals below do not overlap. They are not counts of edits or public UI strings.

### Quantified inventory

| Disjoint category | Matching files | Matching lines | Occurrences | Proposed treatment |
|---|---:|---:|---:|---|
| Dotfiles, agent and design-sync configuration | 42 | 84 | 88 | Public descriptions where appropriate in phase 1; technical references only if phase 2 proceeds |
| Root documentation/configuration | 9 | 204 | 210 | Split brand prose from working commands and configuration |
| Active `SPEC` and supporting documentation | 39 | 242 | 283 | Current brand prose first; preserve unresolved decisions and technical contracts |
| Derived `SPEC\SPECKIT` copies | 1 | 1 | 1 | Follow canonical changes, never lead them |
| Historical `SPEC` records | 24 | 133 | 171 | Preserve; inventory only, not a rewrite authorization |
| Mockups and builders, mixed current/historical | 114 | 550 | 561 | Select current reference/presentation outputs; retain historical examples |
| Generated lockfiles | 3 | 13 | 13 | Package-manager regeneration only if approved technical changes require it |
| `apps\api` | 109 | 363 | 368 | Mostly imports; separate exposed wording from cookie/error/config identities |
| `apps\web` | 189 | 326 | 332 | Brand copy/metadata in phase 1; imports/state namespaces later |
| `e2e` | 19 | 84 | 89 | Change brand expectations with phase 1; harness identities later |
| `packages` | 261 | 629 | 641 | Mostly package imports; prompts and seed-display text need separate review |
| Tools, runners and their docs | 33 | 94 | 100 | Demo output first; runner interfaces only conditionally |
| Frozen golden data | 211 | 513 | 513 | Preserve fixtures, recorded scenarios and inventory |
| Prompt-eval data | 2 | 5 | 5 | Preserve committed baseline provenance |
| **Total** | **1,056** | **3,241** | **3,375** | |

Category details:

* Historical records include `SPEC\archive`, archived decisions and sprints,
  `SPEC\tracker-history` and `SPEC\tracker-history.md`. Inventory scanning is not a
  deep review of their content. Other supporting/conversion documents may also contain
  historical passages; location classification doesn't declare every paragraph current.
* Frozen golden data means `tools\golden\fixtures`, `tools\golden\scenarios` and
  `tools\golden\inventory.json`. Other golden files sit in tooling or lockfile categories,
  but the protection hook guards **all** of `tools\golden`; even a runner change needs
  the applicable human approval.
* The two matching prompt-eval data files are
  `tools\prompt-eval\baselines\v1-default.json` and `v2-default.json`.
  Corpus/fixture paths were also scanned; they have no literal matches.
* Lockfiles are `pnpm-lock.yaml`, `tools\golden\package-lock.json` and
  `SPEC\mockups\_build\tw\package-lock.json`. Regeneration is not permission to
  upgrade dependencies or to modify the frozen capture.

The `@collega/` subset contributes **1,375 occurrences on 1,352 lines in 591 files**,
including docs, rules and tests as well as imports. **Fifteen package manifests** contain
the old name, including the root, e2e and mockup builder. These figures are subsets of
the inventory, not additional references.

Matching tracked paths:

| Path | Why it matters |
|---|---|
| `.claude\agents\collega-reviewer.md` | Filename and registered agent name; renaming either can break callers |
| `SPEC\mockups\comp-s-collega-ux-review.html` | Review artifact and possible links; not necessarily a current public asset |

`C:\code\Collega` itself, the worktree-root naming and the legacy checkout visible in
`git worktree list` are outside repository-relative path counts. Local app registrations,
shortcuts and other checkouts need a separately authorized review.

### Non-text and implicit branding

The seven excluded files are four `.design-sync\fonts\*.woff2` font files,
two `.claude\skills\ui-ux-pro-max\scripts\__pycache__\*.pyc` files and `inbox1.png`.
Visual inspection of `inbox1.png` shows Collega text and a **CG** monogram in an older
inbox comp. That raster evidence does not contribute to the substring totals.
Retain it as a historical screenshot unless the owner identifies it as a current deliverable.

Current React branding also uses **CG**, not a standalone logo file:
`apps\web\components\nav\sidebar-nav.tsx:44–46` and
`apps\web\components\auth-pitch.tsx:78–81`. A text replacement won't fix those marks.
Mockups contain text, inline marks and SVG titles. No tracked path named logo,
favicon or app icon identifies a dedicated platform-brand asset in this checkout;
check the rendered browser favicon and any external asset library before signing off.
Organization-uploaded logos are tenant content, not platform branding.

## 3. Where the work actually lands

The references below are representative exact baseline locations. Section 9 supplies
a reproducible full path-and-line listing; it also catches matches outside these examples.

### Public-facing surfaces: phase 1 candidates

| Surface | Baseline references | Work and caveats |
|---|---|---|
| Navigation and authentication mark | `apps\web\components\nav\sidebar-nav.tsx:44–46`; `apps\web\components\auth-pitch.tsx:78–81` | WorkSprint wordmark and approved replacement for CG; check longer name at mobile widths |
| Root and route metadata | `apps\web\app\layout.tsx:10`; `apps\web\app\(auth)\login\page.tsx:8–9`; `apps\web\app\(auth)\register\page.tsx:6–7`; `apps\web\app\not-found.tsx:4` | Search titles/descriptions, tab titles and error routes; scan all route metadata, not only sign-in |
| Sign-in/register copy and links | `apps\web\app\(auth)\login\page.tsx:48,70`; `apps\web\app\(auth)\register\page.tsx:53`; `apps\web\app\(auth)\change-password\page.tsx:28` | Preserve account, invite-code and password behavior |
| Privacy and usage controls | `apps\web\app\privacy\page.tsx:4–5,17,21,42,52`; `apps\web\components\settings\usage-tracking-switch.tsx:48` | Rename product references without changing tracking purpose, retention, access or legal basis |
| Other visible messages | `apps\web\app\global-error.tsx:24`; `apps\web\components\access\access-section.tsx:110`; `apps\web\components\settings\groups-screen.tsx:165–166`; `apps\web\components\login-messages\message-views.tsx:150`; `apps\web\components\home\home-parts.tsx:115` | Include system-message attribution, empty states and refusal explanations |
| Public URL generation, even without a literal match | `apps\web\lib\site-url.ts:5–7`; `apps\web\app\sitemap.ts:7–9`; `apps\web\app\robots.ts` | Sitemap/robots derive the production host from `VERCEL_PROJECT_PRODUCTION_URL`; a new domain needs more than renaming copy |
| Assistant defaults | `packages\application\src\ai\prompt-defaults.ts:14,41` | Default v1/v2 templates name Collega. Brand-only wording can still affect model output; evaluate before release |
| Seeded welcome display | `packages\infrastructure\src\demo-seed\modules\login-messages.ts:22` | Change future display text if approved; don't seed/reset a live database to rename an existing message |
| Public demo/deck output | `tools\demo-shots\deck.ts:50,379,410`; `tools\demo-shots\capture.ts:24,28` | Rename generated presentation copy and capture new current screenshots; leave capture env/email identities alone in phase 1 |
| Reference comps and their source | `SPEC\mockups\_build\build_q.py`; `SPEC\mockups\comp-r-portico-prototype.html`; `SPEC\mockups\01-login-and-org-selection.svg:2,7` | Separate current approved references from older historical comps; changing builder inputs avoids regeneration restoring the old brand |
| Current public documentation | `README.md:1`; `SPEC\README.MD:1`; relevant current feature/spec prose | WorkSprint heading/prose can coexist with valid old technical commands, explicitly labelled |
| Download/export check | `apps\api\src\ideas\ideas.controller.ts:563–564` | Current download name is `ideas.csv`, with no brand to change. Review CSV content, demo data, headers and any presentation export; don't replace member-authored data |

Privacy wording still needs the owner's production sign-off:
`apps\web\app\privacy\page.tsx:9–11` and
`SPEC\implementation-agent-tracker.md`, Usage analytics row.
A rename is not approval to switch tracking on, add a consent flow or change the legal
entity named in a notice. Likewise, existing custom AI prompts and saved sign-in messages
are stored content; source changes don't automatically update them.

### Technical identities: conditional phase 2

| Dependency | Baseline references | Risk / compatibility requirement |
|---|---|---|
| Workspace package graph | `package.json:2,20–24`; package manifests under `apps`, `packages`, `tools`, `e2e`; `apps\web\next.config.ts:6`; `apps\web\app\globals.css:10` | Rename manifests, dependency keys, source/test imports, CSS imports and transpilation settings together; preserve feature-subpath exports |
| Enforced architecture rules | `biome.json:62–71,106–115,232–241`; `tools\boundaries`; `tools\arch` | A partial rename can silently stop blocking forbidden imports. Prove new rules reject them and old imports don't bypass enforcement |
| Build/deploy selectors and cache inputs | `turbo.json:15,37,48,70,77`; `apps\web\vercel.json:5–6`; `apps\api\vercel.json`; `.github\workflows\ci.yml:50` | Keep pnpm filters, Turbo task keys/env patterns and affected-package deploy checks consistent; regenerate lockfiles without dependency upgrades |
| API/session cookie | `apps\api\src\auth\session-cookie.ts:14`; `apps\web\lib\api\config.ts:40`; `SPEC\contracts\auth.md:15,73`; `tools\golden\src\runner.ts:26` | Current cookie is `collega_session`, explicitly contractual. Coordinate both hosts, web proxy/current-user paths, QA and harness; preserve or explicitly retire existing sessions |
| Saved browser preference | `apps\web\lib\theme.ts:21–24`; `apps\web\lib\server\theme.ts` | `collega-theme` persists a year. A bare rename discards saved preferences; same-origin dual-read/migrate needs a retirement policy |
| Cross-tab synchronization | `apps\web\lib\session-signal.ts:22,42–43`; `apps\web\test\session-signal.test.tsx:78–79,107–108` | `collega:session` names BroadcastChannel and the localStorage fallback. Mixed old/new tabs can stop coordinating idle sign-out unless bridged or retired deliberately |
| First-login display marker | `apps\web\lib\server\current-user.ts:86`; `apps\web\lib\server\auth-actions.ts` | `collega_sign_in_messages` controls first-desk-page behavior; check clear/set logic with logout and forced password changes |
| Wire identifiers and backend metadata | `apps\api\src\common\errors\problem-details.filter.ts:223–231`; `apps\web\lib\server\auth-actions.ts:282`; `apps\api\src\auth\roles.decorator.ts:4`; `apps\api\src\auth\allow-while-password-change-required.decorator.ts:3` | `https://collega.dev/problems/*` types are machine-compared, not just copy. Decorator keys must change atomically with readers; changing an error URI needs contract approval |
| Drag/drop and diagnostic names | `apps\web\components\ideas\idea-card.tsx:10`; `apps\web\test\board-card-move.test.tsx:230`; `apps\web\components\common\route-error.tsx:33` | `application/x-collega-idea` is a drag MIME identity; mixed-version tabs and diagnostic search/alerts need review |
| Docker and local DB | `docker-compose.yml:4,6,8`; `.claude\hooks\session-start.sh:26,28–29`; `README.md:62,80` | Container `collega-postgres`, role `collega`, database `Collega`, cloud-helper PGDATA path. Changing defaults won't rename an existing volume/role/database |
| Destructive test isolation guard | `e2e\database-url.ts:61,77–81`; `e2e\playwright.config.ts:31–32,56` | `collega_e2e` is a **schema**, not simply a database name. Preserve local-host/schema refusal checks before any destructive setup |
| Deterministic seed namespace | `packages\infrastructure\src\demo-seed\modules\seed-id.ts:7,15–16` | `collega.demo.seed.v1` contributes to every derived UUID. Renaming it changes identifiers, potentially breaking links, idempotency, fixtures and references |
| Demo account identities | `packages\infrastructure\src\demo-seed\modules\scenario.ts:206,231`; `tools\local\start.ts:240,322–324`; `tools\demo-shots\capture.ts:28`; `tools\golden\src\config.ts:22–25` | `demo.collega.test` and `admin@collega.local` bind seed login identities to QA/capture. Preserve in phase 1; assess fixture and existing-user effects before changing |
| Agent/design tooling interfaces | `.claude\agents\collega-reviewer.md:2–3,24,31`; `.design-sync\config.json:2–6` | Agent callers, `CollegaDS` global and `dist/collega.css` output may depend on names; update consumers, not just producer descriptions |
| Checkout and workspace configuration | Root `AGENTS.md`; area guidance; `.claude\hooks\session-start.sh:26`; `git worktree list` | Audit registrations, editor profiles, shortcuts and path-based scripts before any authorized directory/repository rename. Don't move shared checkouts in place |

**Observed environment names**, not values:
`COLLEGA_API_URL`, `COLLEGA_ALLOW_DEMO_SEED`, `COLLEGA_ALLOW_REMOTE_DATABASE`,
`COLLEGA_ANALYTICS`, `COLLEGA_USAGE_TRACKING`, `COLLEGA_USAGE_RETENTION_DAYS`,
`COLLEGA_DEMO_URL`, `COLLEGA_DEV_IDLE_TIMEOUT_SECONDS`,
`COLLEGA_DEV_IDLE_WARNING_SECONDS`, `COLLEGA_E2E_DATABASE_URL`,
`COLLEGA_E2E_WEB_PORT`, `COLLEGA_E2E_API_PORT` and `COLLEGA_E2E_VIDEO`.
`COLLEGA_E2E_*` also appears as a wildcard/prefix in tooling, not a standalone setting.
Inventory key readers, example configuration, tests, cache pass-through and operator
configuration together. A candidate alias strategy needs explicit approval and precedence
rules when both names exist; don't change defaults while changing spelling.

`DATABASE_URL`, `ACCESS_TOKEN_SIGNING_KEY`, `SITE_ADMIN_*`, `CRON_SECRET`,
`VERCEL_*` and provider credentials don't contain the old brand. They need checks if
deployments/origins move, not automatic renaming or key rotation.

## 4. External references: owner verification checklist

This is a repository-derived checklist, **not a completed external inventory**.
No GitHub, Vercel, Prisma, DNS, Auth0, analytics or MCP account was queried.
There is no approved replacement hostname.

| Recorded or specified reference | Evidence / status | Future owner check |
|---|---|---|
| Vercel web project `collega`, API project `collega-api` | `SPEC\50-vercel-deployment.md:34–46`; `SPEC\50-cutover-runbook.md:22–26`; tracker records API alias `collega-api.vercel.app` | Current project names, custom domains/aliases, project IDs, protection, git links, build selectors and Production/Preview settings |
| Web API URL and production host input | `apps\web\lib\api\config.ts:27`; `apps\web\lib\site-url.ts:5–7`; cutover environment tables | Correct environment target, sitemap/robots production host and server-only API access after redeploy |
| Suggested marketing/application host `app.collega-ai.com` | `SPEC\mockups\site\comp-s1-terrazzo-editorial.html`, `comp-s2-graphite-product.html`, `comp-s3-audience-journey.html` | Mockup links are not proof of an active domain. Check current public landing/app domains, redirects and certificates |
| MCP host `mcp.collega-ai.com` | `SPEC\20-feature-mcp-server.md:42–43,94,147–148`; `SPEC\contracts\mcp.md` | Specified, not implemented in this baseline. Check DNS/tenant provisioning with owner before treating it as live |
| MCP identity contracts | `SPEC\20-feature-mcp-server.md:91–95`: `https://collega.app/uid`, `/stamp`, scope `collega:read`, audience `https://mcp.collega-ai.com/mcp` | These are future security interfaces. If any external setup already exists, changing an audience/claim/scope can invalidate tokens or client grants |
| Auth0 tenant and per-environment database connections | `SPEC\20-feature-mcp-server.md:76–93` | Tenant/application display names, actions, audiences, claims, connection names, callback/logout/allowed-origin lists and consent text; don't introduce deferred web SSO |
| Prisma store label `collega-dev` | `README.md:269` is an operator command example | Confirm actual stores, database resource labels and environment attachments; labels don't establish physical database names |
| GitHub repository identity and integrations | No live repository-settings audit performed | Repo URL/display description, redirects, Pages if any, branch protection, required check contexts, webhooks, Actions, installed apps and saved remotes |
| Search and analytics properties | `SPEC\decisions.md`, 2026-10-27 usage entry; `apps\web\lib\site-url.ts` | Search Console ownership/sitemaps, Vercel Analytics association, property display names and any old-domain reporting |
| Other public records/assets | Outside tracked scope | Favicons/social cards held elsewhere, mail sender/support addresses if used, help/support links, status pages and legal/public listings |

`collega.dev`, `collega.app`, `.test`, `.local` and mockup `.example` strings have
different roles. Don't treat a problem-type namespace or test host as a deployed website.
Likewise, repo prose about service settings sometimes predates release evidence; owner
verification must establish what exists now.

## 5. Proposed work sequence and deliverables

### Phase 1: public-facing brand

Start only after implementation authorization and the required brand decisions.
Current host/technical-name retention is the **base estimate assumption**, not an accepted
domain decision.

| Step | Actions and dependencies | Deliverable |
|---|---|---|
| P1.0 Prepare | Refresh inventory/status at the implementation SHA; agree public surface, mark, domain posture and old-name exceptions; check current production notices/prompts without copying sensitive data into docs | Approved replacement matrix and release checklist |
| P1.1 Rename visible application | After P1.0, update sidebar/auth marks, copy, titles/descriptions, privacy product wording and error/empty/system-message surfaces | Reviewable brand-only diff with technical identities unchanged |
| P1.2 Update current collateral | After the mark/copy decisions, update current comp sources, public documentation and deck generator; distinguish older comps and tenant/user content | Current WorkSprint references; historical exceptions list |
| P1.3 Review assistant/display content | After P1.0, change approved template/display strings; check active custom prompts and stored welcome messages separately; preserve deterministic IDs and baseline provenance | Prompt/display review evidence; explicit stored-content action or exclusion |
| P1.4 QA and review | After P1.1–P1.3, run the gate and focused browser/auth/export tests; inspect desktop/mobile rendering and browser-visible metadata | QA evidence and reviewer approval |
| P1.5 Release and observe | After P1.4 and owner release approval, promote through the normal feature → dev → main flow; verify actual rebuilt deployment and public surfaces | Release/rollback record and agreed observation evidence |
| P1.6 Phase-2 decision | After observation, compare the remaining inventory against measured maintenance burden and compatibility risks | Owner's go/no-go, selective scope or keep-internals decision |

P1.1–P1.3 can overlap once P1.0 resolves their inputs. QA follows the merged brand
change. A public-domain transition, if separately approved, needs its own origin/redirect
checks before P1.5; it does not depend on a package rename.

### Phase 2: conditional technical cleanup

Do not start because phase 1 passed. The owner must explicitly authorize its scope.

| Step | Actions and dependencies | Deliverable |
|---|---|---|
| P2.0 Decide value and compatibility | Use P1.6 evidence; choose which identifiers stay, approved replacements and retirement policy; check external setup | Scoped technical proposal and approvals, or a documented no-go |
| P2.1 Package/build graph | After P2.0, change manifests/imports/rules/Turbo/Vercel selectors together; regenerate allowed generated output through existing tooling | Installable graph with tested layer enforcement |
| P2.2 Config/tool interfaces | After naming approval, add or change agreed env/tool aliases; coordinate deployment configuration and cache inputs | Configuration matrix, precedence and deprecation instructions |
| P2.3 Browser/stable interfaces | After compatibility approval, implement any agreed cookie/preference/channel/MIME/error transition; amend canonical contracts before dependent code | Mixed-version/session test evidence and stable-interface policy |
| P2.4 Local data and identities | Only for approved identifiers, coordinate Docker role/database/volume effects, guarded e2e schema names, seed identities and QA fixtures | Data-preserving procedure, seed-ID stability proof and safe test setup |
| P2.5 Developer references | Follow final names; update current docs, agent/design consumers, permitted filenames and authorized local registrations/remotes | Working instructions and caller/path checks |
| P2.6 Gate/release | After dependent changes, run extra compatibility QA and review; deploy affected apps with owner-controlled configuration steps | Verified release, residual-name exceptions and rollback evidence |

A package rename alone does not require cookie, seed, database or API URI changes.
Split those into independent opt-in slices rather than making them prerequisites.
Retaining high-risk identities reduces the base phase-2 scope; re-estimate the selected
subset instead of assuming all 60–120 hours are necessary.

## 6. Effort breakdown, assumptions and confidence

All rows represent **human labor** across implementation, design, QA, review and release.
Counts are evidence of breadth, not an hours-per-occurrence formula. Tests belong with QA;
no new tooling or dependencies are assumed.

### Phase 1 budget

| Workstream | Hours | Included work |
|---|---:|---|
| P1.0 preparation and decisions | 4–8 | Refresh inventory, public/technical split, exceptions and replacement matrix |
| Visible application copy and SEO metadata | 8–14 | Routes, nav, labels, privacy product references, errors and public URL-output checks |
| Existing mark adaptation and current comps | 6–12 | One approved mark direction, existing layout/palette retained; source builders and selected current comps |
| Public docs, demo/deck and exports review | 6–12 | Brand prose, generated deck/screenshots, export inspection and current-reference selection |
| Assistant and stored/display-text assessment | 4–10 | Two defaults, seeded display string, active-custom-content assessment and evaluation review |
| Focused QA and code/design review | 8–16 | `pnpm check`, selected tests, browser widths/themes, auth continuity and residual scan |
| Release, smoke, observation review and P1.6 | 4–8 | Owner-assisted deploy checks, rollback readiness and phase-2 risk/value evidence |
| **Phase 1 total** | **40–80** | No public-domain move included |

The optional web-domain budget is **10–22 hours**: configuration/redirect/search work
6–14 plus origin/session/rollback verification 4–8. Add it once, in whichever release
actually performs the move. This assumes one existing web project, not a new marketing
site, tenant migration or application rebuild.

### Conditional incremental phase 2 budget

| Workstream | Additional hours | Included work |
|---|---:|---|
| P2.0 scope/compatibility planning | 2–4 | Risk/value go/no-go detail and naming matrix |
| Package graph, imports, boundaries and generated locks | 10–18 | Fifteen manifests, dependent selectors/imports, safe regeneration and rule checks |
| Environment and tooling namespaces | 6–12 | Readers, examples, tests, cache patterns and a limited approved alias transition |
| Browser/session/preference compatibility | 10–20 | Coordinated cookie/marker handling, saved theme and mixed-tab signaling, retirement checks |
| Stable API/MIME/decorator identifiers | 6–12 | Approved contract review, readers/writers and compatibility expectations |
| Local database/seed/test identities | 8–18 | Guarded local setup, volume/role/schema impacts, deterministic UUID/fixture effects |
| Developer docs, agents/design config and path/reference cleanup | 6–12 | Current instructions and registered callers; limited owner-assisted repo/project label checks |
| Incremental QA, review and release | 12–24 | Mixed versions, fresh install/build, auth/data checks, both-app redeploy and rollback verification |
| **Phase 2 additional total** | **60–120** | Conditional; no automatic rewrite of frozen/history data |

Implementation rows include local developer checks; QA rows pay for independent
verification and reviewer work. Phase 2 doesn't recharge phase-1 wordmark, copy or
collateral. P1.6 records the initial decision evidence; P2.0 prices the detailed technical
matrix only if the owner proceeds. Domain work is separate from project display labels.

**Assumptions:** one TypeScript monorepo, existing package manager/test/build tools,
one approved small mark adaptation with at most one revision, existing design direction,
two current app deployments, no functional changes, preserved stored user data and no
forced reseeding. Current reference comps are a selected set, not all 114 matching
mockup/builder files. Reviewer and QA access are available.

Confidence is high in the exact tracked-text counts, moderate in the code dependency
inventory and phase-1 range, and lower in technical compatibility and external-service
effort until the owner verifies deployed settings and stored content. Browser/SEO
completion needs runtime checks; text scanning cannot establish it.

**Not included:** a new visual identity/design system, domain purchase or trademark/legal
advice, new landing site, marketing campaign, all historical screenshots/comps, git-history
rewriting, frozen corpus replacement/re-recording, live credential access, new Auth0/MCP
implementation, cloud account/resource transfer, physical production database migration,
data deletion or unrelated backlog fixes. If an approved choice requires any of these,
estimate it separately before work starts. Provider fees and AI evaluation charges are
not human-hours; any live evaluation needs separate authorization and the dedicated key.

## 7. Decisions needed before implementation

The public name and the two-phase intent are settled. The questions below are not.
Review them one at a time with the owner; recommendations are proposals.

| Question | Options and consequences | Recommendation, not approval |
|---|---|---|
| What replaces CG? | Approved compact WorkSprint mark/initials, or wordmark-only; a bespoke logo expands design effort | Adapt the existing mark treatment without changing the palette/layout; ask for the actual replacement |
| Does phase 1 change the public domain? | Retain current host with WorkSprint copy, or choose a new domain with redirects/session implications | Retain current hosts for the first brand release unless the owner requires a clean public URL; no domain inferred from the name |
| Which current comps/collateral must ship? | Current canonical/reference set and current demos, or all old comps/screenshots too | Update current references, preserve labelled history |
| How should existing custom prompts/messages and demo-visible account labels change? | Leave stored content, review/edit platform-owned content, or a separately designed data update | Review platform-owned display content; preserve user/tenant text, email identities and UUIDs |
| What legal/public wording is required? | Product-name replacement only, or changes to legal controller/support/terms wording | Keep behavior/legal entity unchanged and obtain privacy sign-off; don't treat rename approval as analytics enablement |
| What proves phase 1 works well, and how long should it run? | Owner-approved acceptance checklist/observation period; stop on regression or proceed to risk/value review | Require browser/auth evidence and no rename-caused incidents; owner sets duration and acceptable issues |
| Is technical cleanup worth doing? | Keep internals, selected low-risk cleanup, or full compatibility-aware rename | Keep stable cookie/error/seed identities unless they cause a concrete problem; choose low-risk cleanup only where it pays |
| If phase 2 proceeds, which target identifiers and transition policy? | Owner-selected package/env/interface names; preserve old names, dual compatibility, or explicitly accepted sign-out/reconfiguration | Separate package/env cleanup from stable interfaces; preserve UUID namespace and data identities absent a proven need |

At the phase-2 review, weigh benefits such as clearer developer onboarding and fewer
misconfigured commands against extra aliases, broken integrations, changed seed IDs,
lost preferences, mixed-tab session failures and release coordination.
Record actual phase-1 labor and the residual references. No-go should leave a short
maintained exception list, not require a later cleanup sprint by default.

## 8. Validation, rollout, rollback and completion

### Required future validation

`pnpm check` on the exact release commit remains the gate: lint/format and architectural
boundaries, typechecks, tests and builds. A typecheck alone doesn't verify Next's
server/client import constraints. This draft is documentation-only, so it does not
claim a green implementation gate.

QA should select existing suites for metadata, privacy/tracking controls, navigation,
auth actions/refusals, session cookies/deadlines/signals and theme behavior. Run selected
Playwright coverage against the harness's guarded local schema, not production.
For a technical rename, add fresh-install/package-graph checks and assert that
forbidden cross-layer imports still fail.

Browser acceptance covers desktop and 375px, all five themes, long WorkSprint text,
CG replacement, browser titles and any favicon/social assets. Inspect signed-out,
signed-in and error pages; verify robots/sitemap remain public and desk pages remain
noindex. Check Site Admin, Org Admin, User and Read Only visibility without changing
their permissions.

Auth acceptance includes an existing signed-in session, sign-out, forced password
rotation, first-page sign-in messages, View As, idle expiry and mixed old/new tabs.
Check a saved non-default theme. If a hostname moves, same-origin cookies/localStorage
can't simply transfer to the new origin; agree whether to accept fresh sign-in and
preference reset or design a secure transition. Never copy JWTs through a redirect URL.

Inspect CSV downloads and regenerated current demos. For assistant wording, run offline
render/dry-run and existing tests first, then separately authorized evaluation where
needed against **unchanged** committed baseline data; record differences rather than
rewriting baseline provenance. Golden replay remains a regression signal, not the gate,
and the frozen corpus cannot be re-recorded.

Production smoke must prove the actual artifact serves WorkSprint, not merely that a
dashboard setting changed. Check web/login/privacy/metadata, API health and signed-in
reads with owner-provided access. Preserve analytics/privacy enablement settings.
The Vercel ignore step can cancel a redeploy of the same SHA: use the existing affected
package procedure and confirm both builds when technical/env changes require both.
An env-only or `SPEC`-only change is not proof that runtime configuration reached a build.

### Release and recovery

For phase 1, preserve the previous deployment, approved marks/copy and configuration
snapshot before the owner-authorized release. Don't recreate a database or run a demo
reset. Rollback normally restores the prior web artifact; assistant/default display
changes may require the prior API artifact too.

For phase 2, release configuration/compatibility changes before retiring old interfaces,
according to the approved matrix. Keep old env configuration/aliases available for
the rollback window, and verify a previous app version still works. A newly named cookie
that old code can't read can make an artifact rollback fail to restore sessions; test
this explicitly. Any selected database/resource move needs a separate data-preserving
rollback procedure. The old conversion runbook's fresh-database premise does not
authorize wiping a currently used production database.

If the optional domain changes, retain the old hostname, certificate and reversible
routing until the owner closes the rollback window. Test redirects, sign-in, canonical
public URL outputs and search submission; API-host renaming is a separate decision.
Neither a cookie migration nor an Auth0 audience change should happen incidentally.

### Completion criteria

| Milestone | Evidence required |
|---|---|
| Phase 1 complete | Owner-approved visible surfaces say WorkSprint; approved mark replaces CG; current selected comps/demo output match; gate, QA and real deployment checks pass |
| Phase 1 technical continuity | Existing sessions/preferences/IDs work under the approved host posture; no package, cookie, namespace, DB or error-URI change sneaks into the brand diff |
| Public URL posture complete | Owner explicitly accepts current old-name hosts or approves and verifies the separately estimated transition |
| Phase-2 decision complete | Owner records keep-internals, selective go or full go after the agreed observation; no silence/default approval |
| Phase 2 complete, only if approved | Selected naming/compatibility matrix passes graph, boundary, auth, state, data and redeployment checks; retirement/rollback policy and owner-controlled external checks have evidence |
| Residual inventory explained | Every old-name category has an approved retain/change treatment; no unexplained match remains in selected current public surfaces |

Proposed allowed-old-name exceptions are frozen golden data, unchanged prompt-eval
baselines, historical decisions/tracker records, older reference screenshots/comps,
member/tenant-authored content, technical commands referring to intentionally retained
identities, compatibility aliases during an approved transition, and explicitly retained
stable identifiers/hosts. **The owner still needs to approve this exception policy.**
This plan and its baseline inventory necessarily quote the old name.
A blanket zero-match requirement would conflict with preserving evidence and compatibility.

## 9. Reproducing the inventory

Run the following read-only PowerShell command from `C:\code\Collega` at the baseline
commit. It writes no files, includes tracked dotfiles, skips secret-bearing environment
files, does not scan dependencies/build output/untracked files, and emits a full
`path:line` listing without echoing line contents or credentials.

Git uses slash-separated logical path strings; the script converts them to Windows
paths before reading files. It scans working-tree content of tracked paths, so verify
the SHA and clean status first. Once this plan becomes tracked, reruns will also count
its quotations; exclude it only when deliberately comparing with this pre-plan baseline.

```powershell
git --no-pager log --oneline -10
git status --short
@'
import collections
import pathlib
import re
import subprocess

paths = subprocess.check_output(
    ["git", "-c", "core.fsmonitor=false", "ls-files", "-z"]
).decode("utf-8").split("\0")[:-1]

def category(p):
    if pathlib.Path(p).name in ("pnpm-lock.yaml", "package-lock.json"):
        return "Generated lockfiles"
    if p.startswith(("SPEC\\archive\\", "SPEC\\decisions\\archive-",
                     "SPEC\\sprints\\archive\\", "SPEC\\tracker-history\\")) \
            or p == "SPEC\\tracker-history.md":
        return "Historical SPEC records"
    if p.startswith("SPEC\\mockups\\"):
        return "Mockups and builders"
    if p.startswith("SPEC\\SPECKIT\\"):
        return "Derived SPECKIT"
    if p.startswith("SPEC\\"):
        return "Active SPEC and supporting docs"
    if p.startswith(("tools\\golden\\fixtures\\", "tools\\golden\\scenarios\\")) \
            or p == "tools\\golden\\inventory.json":
        return "Frozen golden data"
    if p.startswith(("tools\\prompt-eval\\fixtures\\",
                     "tools\\prompt-eval\\baselines\\",
                     "tools\\prompt-eval\\corpus\\")):
        return "Prompt-eval data"
    for prefix, name in (
        ("apps\\web\\", "Web"), ("apps\\api\\", "API"),
        ("packages\\", "Packages"), ("e2e\\", "E2E"),
        ("tools\\", "Tools runners and docs"),
    ):
        if p.startswith(prefix):
            return name
    return "Dotfiles and agent/design config" if p.startswith(".") else "Root docs/config"

pattern = re.compile("collega", re.IGNORECASE)
totals = collections.defaultdict(lambda: [0, 0, 0])
text_count = 0
excluded = []
for raw in paths:
    p = raw.replace("/", "\\")
    file = pathlib.Path(p)
    if file.name.startswith(".env") and file.name != ".env.example":
        excluded.append((p, "secret-file exclusion"))
        continue
    data = file.read_bytes()
    if b"\0" in data:
        excluded.append((p, "binary"))
        continue
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        excluded.append((p, "not UTF-8"))
        continue
    text_count += 1
    occurrences = len(pattern.findall(text))
    matching = [(n, len(pattern.findall(line)))
                for n, line in enumerate(text.splitlines(), 1) if pattern.search(line)]
    if occurrences:
        row = totals[category(p)]
        row[0] += 1
        row[1] += len(matching)
        row[2] += occurrences
        for n, count in matching:
            print(f"{p}:{n}: {count} occurrence(s)")

print("Tracked paths:", len(paths), "Decoded text files:", text_count)
print("Excluded:", excluded)
print("Category: matching files, matching lines, occurrences")
for name, row in sorted(totals.items()):
    print(name, *row)
print("TOTAL", *[sum(row[i] for row in totals.values()) for i in range(3)])
print("Matching tracked paths:",
      [p.replace("/", "\\") for p in paths if pattern.search(p)])
'@ | python -
```

This listing is the exhaustive tracked-text inventory for the defined scan, not an
external audit or an OCR inventory. Inspect inline/raster marks separately; refresh
counts and evidence before authorizing work on a later commit.
