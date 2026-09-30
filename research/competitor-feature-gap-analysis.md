# Competitor Feature-Gap Analysis — Product Feedback / Idea Management

**Status:** Research artifact. Not a spec, not canonical, not gating any implementation work.
**Scope:** Compares Collega's *current, built* feature set (per `SPEC/05-product-definition.md`,
re-derived 2026-09-29 at commit `e92ddde`, cross-checked against `SPEC/implementation-agent-tracker.md`
at commit `6969336`) against five primary competitors in the product-feedback / idea-management
category. Written 2026-09-30.

---

## 1. Methodology and scope

**Collega side of the comparison** is drawn entirely from the repository's own ground-truth spec —
`SPEC/05-product-definition.md` Section 4 (Capability Map) and Section 5 (User Stories), which the
project's own tracker treats as authoritative and re-derives from the code on each audit. No
competitor claim is compared against Collega docs older than that re-derivation. Where Collega is
**Deferred** or **Partial**, that is stated explicitly rather than treated as a gap of equal weight
to something never planned.

**Competitor side** uses **primary sources only**: vendor marketing/feature pages, vendor pricing
pages, and vendor help-center/documentation articles or API reference docs, fetched directly from
the vendor's own domain in this session (2026-09-30). No review sites, comparison blogs,
G2/Capterra listings, or SEO roundups were used. Every capability claim below carries an inline
source URL. Several vendor marketing pages are JavaScript-rendered single-page apps that returned
only a short FAQ excerpt to a static fetch; where that happened it is noted, and the claim is
instead backed by a help-center article (which is typically server-rendered and more complete) or
the claim is marked **not verified** rather than asserted from memory.

**Competitor selection.** Five vendors with clear, primary-source-documented overlap in the same
buying category (public feedback boards, idea intake/voting, roadmap/status workflow, admin
controls) were chosen:

| Vendor | Why selected |
|---|---|
| **Canny** | Direct product-feedback-board competitor; strong primary docs (marketing + API reference) on custom fields, statuses, roles. |
| **Productboard** | Larger PM suite whose "Portals" + "Features" hierarchy is the closest analog to Collega's boards/ideas/custom-fields model; excellent Zendesk-hosted help center with granular permission/role docs. |
| **Aha! Ideas** (part of the Aha! Roadmaps suite) | Idea-portal product with an explicit idea-management methodology and scorecards; also owns the legacy UserVoice-style category. |
| **UserVoice** | Long-standing feedback-board competitor, still live and independently marketed as of this session (SOC 2 Type II, GCP-hosted, active integrations) — included with a recency caveat since its market history (acquisition by Aha! in 2021) means feature-parity claims should be re-verified before quoting externally. |
| **Savio** | Smaller, lower-cost feedback-centralization tool with an explicit, simple role model (Owner/Admin/Manager/Contributor/Viewer/Submitter) that maps cleanly onto Collega's four-role model for comparison. |

Considered and **not** selected: Pendo Feedback (bundled inside a much broader analytics/experience
suite, making an apples-to-apples primary-source feature diff harder to scope cleanly in this pass);
Frill, Upvoty, Nolt (smaller widget-style tools without the admin/org-membership depth Collega has).
These can be added in a follow-up pass if wanted.

**Caveats on evidence quality (read before trusting any single row):**
- Several vendor marketing pages (canny.io, productboard.com root, aha.io root, uservoice.com root)
  are SPAs; static fetch returned only a rotating FAQ blurb rather than full page content. Deeper
  claims for those vendors lean on help-center/support articles instead, which render fully.
- Aha!'s support center (`support.aha.io`) is itself a JS app in this fetch environment; Aha! claims
  here are backed by its public marketing/guide pages instead (`www.aha.io/roadmapping/guide/...`,
  `www.aha.io/ideas/...`), which do render as content and are still first-party.
- No vendor's private/paid-tier admin screens were inspected (no trial accounts were created); all
  claims come from what each vendor documents publicly about those screens.
- Pricing figures are a point-in-time snapshot (2026-09-30) and change frequently; treat any dollar
  figure below as illustrative, not current.

---

## 2. Collega's current feature set (ground truth, for reference)

Condensed from `SPEC/05-product-definition.md` Sections 4-5. "Built" means live behind a real
endpoint on the Nest API host per the 2026-09-29 re-derivation; "Partial" and "Deferred" are the
spec's own terms.

| Area | State | Key facts |
|---|---|---|
| Auth & session | Built | Email/password, session cookie, rate limits, idle/absolute session timers. |
| Organizations (multi-tenant) | Built | Site-Admin-only creation, invite codes (regenerable), archive-not-delete, per-org logo. |
| Users & membership | Built | Four roles (Site Admin, Org Admin, User, Read Only), CSV bulk import with per-row error reporting, self-registration via invite code. |
| Boards & statuses | Built | Org-level status catalog (color + sort order), a board selects a *subset* of statuses as swimlanes, drag-reorder, soft-delete with reference guard, minimum 2 active statuses/board. |
| Ideas | Built | Title/description/priority/type/impact/status/due-date/up-to-5-assignees; board-card density (avatars, tags, upvote/comment counts, age); drag or picker status change with optimistic UI + rollback; soft delete. |
| Engagement | Built | Org-scoped tags (autocomplete, normalize/merge, at most 10/idea), @mentions (email-based, resolved on save, unresolved blocks save), comments (chronological, author edit/delete own, admin delete any, plain text at most 2000 chars), upvotes (toggle, one per user). |
| Custom fields & idea types | Built | 7 field types (Text/Number/Date/Boolean/Dropdown/MultiSelect/Url), org-scoped shared pool, per-idea-type curation (`AllActiveFields` vs `Curated`, per-type required override), CSV round-trip, idea-type color+icon badge. |
| Administration & View As | Built | Full **act-as** impersonation (not read-only preview), non-nestable server-side session, 30-min idle/2-hr absolute timeout, dual-attribution audit trail, persistent non-dismissable banner. |
| AI Idea Assist | Built | Brainstorm chat -> structured, fully-editable pre-filled idea form; live "draft strip" of classified fields; single platform-level model key (org-level BYO key contracted but deliberately unbuilt); global daily token cap with graceful degrade, never hard error. |
| Issues & Delivery | Slice 1 built, Slice 2 (Outcomes/Roadmap) unbuilt | Idea *is* the Issue (same row, `phase` field) — no separate object; promotion gate with T-shirt effort, upvote-at-promotion snapshot; Sprints (Planned->Active->Completed, explicit carry-over); fixed 5-stage delivery-status kanban; task checklist (3-state, unaudited by design, no gating); full Provenance panel linking Issue back to originating idea/upvotes/comments. |
| Notifications | Partial | DB-only event rows for mentions, comments, status changes; explicitly **no** HTTP surface, no email/SMTP, no inbox UI in MVP — deferred by design. |
| Reporting | Deferred, specified | 4 baseline reports (Throughput, Aging, Engagement Activity, Admin Activity) specified but unbuilt; CSV export required by spec. |
| OAuth (Entra ID) / SAML | Deferred, specified | Phase-2/post-OAuth; detailed identity-linking and auto-provisioning rules already written, no code. |

---

## 3. Capability matrix

Legend: check = built/documented; partial = partial or plan-gated; none = not offered / not found
in primary docs; unverified = not verified in this pass (no primary source reached).

| Capability | Collega | Canny | Productboard | Aha! Ideas | UserVoice | Savio |
|---|---|---|---|---|---|---|
| Public/customer feedback board with voting | partial: internal-only, ideas are org-member-submitted, no external customer portal | check: customers vote using existing accounts, no extra signup — [canny.io/features/collect-feedback](https://canny.io/features/collect-feedback) | check: "Portals" — external validation, email-verified submissions — [support.productboard.com/.../360056315454](https://support.productboard.com/hc/en-us/articles/360056315454-Getting-started-with-portals) | check: dedicated ideas portal for external submit/vote — [aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management) | check: implied by "close the loop"/NPS framing — [uservoice.com](https://uservoice.com/) | partial: feedback centralization from integrations, not clearly a public vote board per marketing copy — [savio.io/use-cases/centralize-product-feedback](https://www.savio.io/use-cases/centralize-product-feedback/) |
| Kanban board with configurable statuses/swimlanes | check: org-level status catalog, board = subset as swimlanes, drag reorder — `SPEC/05-product-definition.md` US-BOARD-01..03 | check: statuses are a default+custom field; boards sync status to Jira/Linear — [developers.canny.io/api-reference](https://developers.canny.io/api-reference) | check: boards + timeline/roadmap board types, feature status is hierarchy-wide — [support.productboard.com fundamentals article](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard) | check: ideas promote onto Aha! Roadmaps' status-driven roadmap — [aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management) | unverified: marketing SPA returned no board-workflow detail | partial: "roadmaps" mentioned as a paid-role capability, no workflow detail found — [savio.io/pricing](https://www.savio.io/pricing/) |
| Custom fields (typed, org/workspace-scoped) | check: 7 types, org-scoped shared pool, per-idea-type curation — `SPEC/20-feature-user-defined-fields.md`, `SPEC/20-feature-idea-type-fields.md` | check: dropdown/multiselect/boolean/date/text/numeric custom fields, filterable via API — [developers.canny.io/api-reference](https://developers.canny.io/api-reference) | check: "Custom fields" is one of the data-field types governed by custom roles — [support.productboard.com/.../20190036673811](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access) | unverified: support center did not render article content in this fetch pass | unverified | check: "log context ... product, product area, customer journey stage" as filterable attributes — [savio.io/use-cases/centralize-product-feedback](https://www.savio.io/use-cases/centralize-product-feedback/) |
| Idea types/hierarchy with per-type field curation | check: Idea Type with color/icon, `AllActiveFields` vs `Curated` per-type field mapping — `SPEC/05-product-definition.md` US-FIELD-06/07 | partial: has "category"/"type" default fields but no evidence of per-type *field visibility* curation | check: richer — full product hierarchy (Product->Component->Feature->Subfeature) rather than a flat idea-type enum — [support.productboard.com fundamentals article](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard) | partial: ideas promote to "features/initiatives" in Aha! Roadmaps' hierarchy, methodology-documented, field-level detail not verified | unverified | unverified |
| Tags | check: org-scoped, autocomplete, normalize/merge, at most 10/idea — `SPEC/20-feature-ideas-and-engagement.md` | check: "tags" and "themes" are default filterable fields — [developers.canny.io/api-reference](https://developers.canny.io/api-reference) | check: "Tags" listed as a governed data-field type — [support.productboard.com/.../20190036673811](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access) | unverified | unverified | unverified |
| @mentions with resolution/validation | check: email-based, resolved on save, unresolved blocks save — `SPEC/20-feature-ideas-and-engagement.md` Mentions section | unverified in fetched pages | unverified in fetched pages | unverified | unverified | unverified |
| Comments | check: plain text at most 2000 chars, author edit/delete own, admin delete any — `SPEC/20-feature-ideas-and-engagement.md` Comments section | check: implied by "admin portal response" fields in API, no detail on edit/delete rules found — [developers.canny.io/api-reference](https://developers.canny.io/api-reference) | check: comments on features, viewer role can comment but not edit hierarchy — [support.productboard.com/.../360056316294](https://support.productboard.com/hc/en-us/articles/360056316294-Member-role-definitions) | unverified | unverified | unverified |
| Upvotes/vote counts | check: toggle, one per user, restore-on-failure — `SPEC/20-feature-ideas-and-engagement.md` Upvotes section | check: core mechanic — "vote on the ideas that matter most" — [canny.io/features/collect-feedback](https://canny.io/features/collect-feedback) | check: "Customer Importance Score" driven by portal feedback signals — [support.productboard.com/.../360056315454](https://support.productboard.com/hc/en-us/articles/360056315454-Getting-started-with-portals) | check: vote-driven idea intake — [aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management) | partial: explicit design position — moves *beyond* "raw vote totals" toward account/CRM-weighted demand — [uservoice.com](https://uservoice.com/) | unverified |
| CSV import/export of ideas + custom-field values | check: full round-trip incl. per-field values, per-row import error reporting — `SPEC/20-feature-ideas-and-engagement.md` CSV Import section, US-FIELD-05 | unverified | check: "Exporting your feedback into a CSV" documented — [support.productboard.com/.../360056354854](https://support.productboard.com/hc/en-us/articles/360056354854-Exporting-your-feedback-into-a-CSV) (import not verified) | unverified | unverified | unverified |
| Role-based access control | check: 4 fixed roles (Site Admin/Org Admin/User/Read Only), org-scoped — `SPEC/05-product-definition.md` Section 2 | unverified in fetched pages | check: 4 base roles + **custom roles with per-data-field create/edit/delete restriction** on Enterprise — [support.productboard.com/.../20190036673811](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access), [.../31018894151571](https://support.productboard.com/hc/en-us/articles/31018894151571-Access-control-guide) | unverified | unverified | check: 6 fixed roles (Owner/Admin/Manager/Contributor/Viewer/Submitter), 3 free + 3 paid — [savio.io/pricing](https://www.savio.io/pricing/) |
| Impersonation / "View As" act-as with audit trail | check: full act-as, non-nestable, idle+absolute timeout, dual-attribution audit, persistent banner — `SPEC/20-feature-view-as.md` | no evidence found | no evidence found — nearest analog is per-member/teamspace access control, not act-as impersonation | no evidence found | no evidence found | no evidence found |
| Bulk user import (CSV) with role assignment | check: per-org, per-row error reporting, forced password reset — `SPEC/05-product-definition.md` US-USER-02 | unverified | partial: "Add new members" documented, bulk-CSV specifics not confirmed in this pass | unverified | unverified | unverified |
| Invite-code self-registration | check: org-scoped invite code, regenerable, invalidated on archive — `SPEC/05-product-definition.md` US-ORG-02/US-USER-01 | unverified (Canny's model is public boards, not invite-gated org membership) | unverified | unverified | unverified | unverified |
| AI-assisted idea intake/drafting (chat -> structured idea) | check: brainstorm chat, structured per-turn model output, editable pre-filled form, draft strip — `SPEC/20-feature-ai-idea-assist.md` | check: **"Autopilot"** — AI reads sales/support conversations (Gong, Intercom, Zendesk) and auto-extracts feature requests, sorted by product area with attached customer/revenue — [canny.io/features/product-roadmap](https://canny.io/features/product-roadmap), [canny.io/features/collect-feedback](https://canny.io/features/collect-feedback) | check: **"Spark"** — AI agent embedded across the workspace (chat, "skills", onboarding via slash-command) — [support.productboard.com fundamentals article](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard) | check: "AI-powered analysis" to spot cross-submission themes ("ai-exploration") — [aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management) | unverified | unverified |
| AI-driven prioritization/scoring | none: not an AI feature in Collega — priority/impact are user-set fields, no AI scoring | check: "custom score that weighs revenue and demand against effort... any custom field from your CRM" — [canny.io/features/product-roadmap](https://canny.io/features/product-roadmap) | partial: "Customer Importance Score" (formula-based, not confirmed as AI-driven) — [support.productboard.com/.../360056315454](https://support.productboard.com/hc/en-us/articles/360056315454-Getting-started-with-portals) | partial: manual value-vs-effort **scorecard** methodology, not AI-scored — [aha.io/.../how-can-i-estimate-the-value-of-new-product-ideas](https://www.aha.io/roadmapping/guide/idea-management/how-can-i-estimate-the-value-of-new-product-ideas) | partial: explicitly weights "customer segment, account value, urgency, importance, relevance" over raw votes — [uservoice.com](https://uservoice.com/) | unverified |
| Delivery/engineering handoff (promote idea -> tracked work item) | check: **same row, phase flag** (no separate object), promotion gate, T-shirt effort, sprints, task checklist, Provenance panel back to the idea — `SPEC/20-feature-issues-and-delivery.md` | check: two-way sync to **Jira, Linear, Asana, ClickUp, GitHub** — status flows back automatically — [canny.io/features/product-roadmap](https://canny.io/features/product-roadmap) | check: dedicated Jira integration doc, plus native hierarchy-to-delivery flow — [support.productboard.com/.../11535151728275](https://support.productboard.com/hc/en-us/articles/11535151728275-Getting-started-with-Productboard-s-Jira-Integration) | check: ideas promote into Aha! Roadmaps features/initiatives, which itself integrates to Jira/Azure DevOps as part of the broader Aha! suite (not separately re-verified for Aha! Ideas alone) — [aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management) | check: integrates with **Jira, Azure DevOps** among others — [uservoice.com/product-overview](https://uservoice.com/product-overview) | check: "sync status with dev tools" — [savio.io/integrations](https://www.savio.io/integrations/) |
| Changelog / release-notes publishing to customers | none: not in Collega's spec at all (no customer-facing changelog concept) | check: dedicated changelog product w/ widget, hosted page, email notify on Pro plan — [canny.io/features/product-changelog](https://canny.io/features/product-changelog) | partial: not directly verified as a distinct changelog product (portals communicate "what's planned/launched" per fundamentals article) | partial: "keep customers informed" is step 6 of Aha!'s methodology, no dedicated changelog product page found | unverified | unverified |
| Reporting/analytics (throughput, aging, engagement) | partial: 4 reports **specified, unbuilt**, CSV export required by spec — `SPEC/05-product-definition.md` Deferred Epics | unverified as a named reporting module (Autopilot's revenue/demand scoring is closest analog) | unverified (Productboard markets "Insights" broadly; specific report catalog not confirmed in this pass) | unverified | unverified | unverified |
| Email notifications for feedback events | none: Collega is explicitly **DB-only, no SMTP/email in MVP, by design** — `SPEC/20-feature-notifications.md` | check: changelog email notify on Pro plan; general product/support notification model not fully itemized — [canny.io/features/product-changelog](https://canny.io/features/product-changelog) | unverified | unverified | unverified | unverified |
| SSO (OAuth/SAML) | partial: Entra ID OAuth and SAML **specified, unbuilt** (Phase 2/post-OAuth) — `SPEC/20-feature-oauth.md`, `SPEC/20-feature-saml.md` | unverified in fetched pages | check: SSO/SAML referenced, but explicitly **not covered by custom roles** in current docs — [support.productboard.com/.../20190036673811](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access) | unverified | unverified | unverified |
| SOC 2 / compliance posture | unverified: not documented in Collega's spec set (pre-production project) | check: **SOC 2 certified**, AWS-hosted, MongoDB Atlas — [canny.io/security](https://canny.io/security) | unverified in this pass | unverified in this pass | check: **SOC 2 Type II**, PCI-DSS, GCP-hosted, documented crypto/incident-response policy — [uservoice.com/security-compliance](https://uservoice.com/security-compliance) | unverified |
| Public API for ideas/fields/filters | unverified: Collega's own API is internal/contract-driven, not a published third-party developer API | check: documented REST-ish filter API incl. all default+custom field types/conditions — [developers.canny.io/api-reference](https://developers.canny.io/api-reference) | partial: implied by integration docs (Jira, App Store) but a general public API reference page wasn't reached in this pass | unverified | unverified | unverified |

---

## 4. Gap analysis

### 4.1 Parity — Collega already matches documented competitor capability

- **Core idea CRUD with typed custom fields.** Collega's 7-type custom-field system with org-scoped
  shared pool and per-type curation (`AllActiveFields`/`Curated`) is functionally comparable to
  Canny's default+custom filterable fields ([developers.canny.io/api-reference](https://developers.canny.io/api-reference))
  and Productboard's governed custom-field data type ([support.productboard.com/.../20190036673811](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access)).
- **Board/status/swimlane model.** Org-level status catalog feeding a board's configurable swimlane
  subset is the same shape as Canny's status-as-field-with-Jira/Linear-sync
  ([canny.io/features/product-roadmap](https://canny.io/features/product-roadmap)) and
  Productboard's hierarchy-wide feature status ([support.productboard.com fundamentals article](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard)).
- **Tags, upvotes, comments** are present in Collega with rules (normalization, at most 10/idea,
  toggle upvotes, plain-text comments) at least as precisely specified as anything found in
  competitor primary docs, none of which published equivalent low-level rule detail publicly.
- **CSV import/export.** Productboard documents CSV *export* of feedback
  ([support.productboard.com/.../360056354854](https://support.productboard.com/hc/en-us/articles/360056354854-Exporting-your-feedback-into-a-CSV));
  Collega's spec covers full round-trip (import + export) including custom-field values and
  per-row error reporting, which is a more complete documented capability than what was found for
  any single competitor in this pass.
- **Idea -> delivery handoff.** All researched competitors treat this as a bidirectional
  *integration* to an external tool (Jira/Linear/Azure DevOps/GitHub). Collega's model — the idea
  *is* the Issue, same row, phase-flagged, with an internal Sprint/task/Provenance system — is a
  different (arguably deeper for teams that don't want a second tool) but not a "worse" answer to
  the same job; treat as parity-with-different-architecture rather than a gap.
- **Role-based access.** Collega's four fixed org-scoped roles are comparable in granularity to
  Savio's six-role model ([savio.io/pricing](https://www.savio.io/pricing/)) and are simpler (by
  design) than Productboard's four base roles plus paid custom roles.

### 4.2 Differentiation / opportunity

**Collega differentiators found in this research (no primary-source competitor evidence of an equivalent):**
- **Full "View As" act-as impersonation with dual-attribution audit, non-nestable server session,
  and idle/absolute timeouts** (`SPEC/20-feature-view-as.md`). Searched Canny, Productboard, Aha!,
  UserVoice, and Savio's public docs for an impersonation/act-as capability; found none.
  Productboard's nearest analog is per-member/teamspace access control, which is a *visibility*
  permission model, not an *act-as-another-user* support tool. This is a genuine, evidence-backed
  differentiator worth highlighting in positioning — but note the negative finding is bounded by
  "not found in the pages fetched," not an exhaustive audit of each vendor's full documentation.
- **Idea-is-the-Issue delivery model** (no separate object, promotion gate, upvote-at-promotion
  snapshot, Provenance panel). Every competitor found instead *integrates outward* to a separate
  tracker. This is a differentiator for teams that want delivery inside the same product without a
  second license, at the cost of not getting Jira/Linear/GitHub's own ecosystem.

**Opportunities — capability multiple competitors document that Collega has deferred or lacks:**
- **AI-assisted intake that ingests external channels automatically**, not just a first-party chat.
  Canny's "Autopilot" reads sales/support conversations (Gong, Intercom, Zendesk) and auto-extracts
  requests with customer/revenue context ([canny.io/features/product-roadmap](https://canny.io/features/product-roadmap));
  Productboard's "Spark" is an embedded AI agent across the whole workspace, not just idea capture
  ([support.productboard.com fundamentals article](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard));
  Aha! documents AI-powered cross-submission theme analysis
  ([aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management)).
  Collega's AI Idea Assist is explicitly scoped to a single-user brainstorm chat
  (`SPEC/20-feature-ai-idea-assist.md`) — automatic ingestion from support/sales tools is a
  documented pattern across 3 of 5 competitors that Collega does not attempt.
- **External customer-facing feedback portal.** Canny, Productboard, Aha! Ideas, and (implicitly)
  UserVoice all center the product on a customer- or prospect-facing board where non-employees
  submit and vote with email verification, not just internal org members. Collega's ideas/engagement
  model is scoped to authenticated organization members (`SPEC/05-product-definition.md` Section 2);
  there is no external/anonymous submission surface. This is the single largest structural
  difference found and is likely deliberate given Collega's audience (internal-org product feedback
  rather than public customer community), but it is worth naming explicitly as a non-goal-or-gap
  decision point.
- **Changelog/release-notes publishing.** Canny has a dedicated, documented changelog product with a
  hosted page, embeddable widget, and email notify ([canny.io/features/product-changelog](https://canny.io/features/product-changelog)).
  Collega has no equivalent concept anywhere in its spec set.
- **Revenue/CRM-weighted prioritization scoring.** Canny explicitly supports "a custom score that
  weighs revenue and demand against effort... any custom field from your CRM"
  ([canny.io/features/product-roadmap](https://canny.io/features/product-roadmap)); UserVoice
  explicitly positions itself against raw vote counts in favor of "customer segment, account value,
  urgency, importance, and relevance" ([uservoice.com](https://uservoice.com/)). Collega's Priority
  and Business Impact are plain user-set fields with no computed/weighted score.
- **Granular, field-level custom roles.** Productboard's Enterprise-tier custom roles let an admin
  restrict *create/edit/delete per data-field type* (e.g., an engineer role that can only edit
  Effort/Timeframe) ([support.productboard.com/.../20190036673811](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access)).
  Collega's roles are coarser (4 fixed roles, no per-field grants) — a documented gap if Collega
  ever targets larger multi-team customers who want that precision, but plausibly out of scope for
  the current MVP audience.
- **Third-party developer API.** Canny publishes a public REST-style API reference with rich
  filter/condition semantics ([developers.canny.io/api-reference](https://developers.canny.io/api-reference)).
  Collega's API is internal/contract-driven per `SPEC/30-Contracts.md`, not published for external
  developer consumption — reasonable for an internal product at this stage, but a gap versus a
  platform play.


### 4.3 Likely non-goals

- **Public/anonymous customer feedback board.** As above — Collega is built for authenticated
  org-member idea submission, not public customer voting. Given Collega's stated persona model
  (Site Admin/Org Admin/User/Read Only, all inside a customer organization —
  `SPEC/05-product-definition.md` Section 2), this reads as an intentional scope boundary, not a
  gap to close reactively.
- **Outbound email notifications.** `SPEC/20-feature-notifications.md` states, with a guarding
  test, that no SMTP/email-client dependency exists in the MVP notification path by design. Canny's
  email notify (Pro-plan changelog subscribers) is a different use case (broadcast to external
  subscribers) than Collega's internal @mention/status-change notifications, so this is not a strict
  apples-to-apples gap, but is flagged because "email" appears on both feature lists for different
  reasons.
- **Changelog/release-notes as a customer communication product.** Not attempted by Collega and not
  implied by anything in its spec set; treated as a deliberate non-goal given Collega has no
  public-facing customer surface at all (see above).
- **AI-driven/CRM-weighted scoring.** Collega's AI Idea Assist is explicitly scoped away from
  scoring or prioritization — it drafts and classifies a single idea in a brainstorm session
  (`SPEC/20-feature-ai-idea-assist.md`, "Out of Scope (MVP)"). Given the single-platform-key,
  degrade-never-error cost model Collega has chosen (`SPEC/05-product-definition.md` Epic 9 locked
  decisions), building a revenue-weighted auto-scoring engine akin to Canny's is a materially larger
  AI/data-integration investment (CRM connectors, revenue attribution) that the current
  architecture does not anticipate — likely a deliberate near-term non-goal rather than an
  accidental omission.
- **Per-organization BYO AI key.** Collega has *specified* org-level AI key override
  (`SPEC/05-product-definition.md` US-ORG-05) but deliberately left it unbuilt in v1, which is
  closer to competitor parity than a true non-goal — flagged here only because it sits on the
  boundary between "deferred feature" and "non-goal," and the spec itself says a future agent must
  not build it without a fresh decision.

---

## 5. Caveats and confidence summary

| Vendor | Recency/confidence note |
|---|---|
| Canny | High confidence for pages reached (feature pages, security page, API reference — all served real content). No admin/role documentation was reached; that gap is reported as "not verified," not "absent." |
| Productboard | Highest confidence of the five — its Zendesk-hosted help center rendered fully and gave granular, dated article content (the custom roles article references "Enterprise plans" pricing gating explicitly). |
| Aha! Ideas | Medium confidence — marketing/guide pages rendered well and gave methodology detail (idea scorecards, portals, promotion-to-roadmap), but the dedicated support center (`support.aha.io`) did not render article content in this fetch environment, so field-level/admin claims for Aha! specifically are thinner than for Canny/Productboard. |
| UserVoice | Medium confidence — security/compliance and integration pages rendered with real, current-looking content (SOC 2 Type II, GCP, named integrations), so it is being treated as an actively marketed, current product as of 2026-09-30. Its feature-detail pages (`/ai`, `/roadmap`) 404'd, so AI/roadmap claims for UserVoice specifically are marked not verified rather than assumed absent. Given UserVoice's known corporate history (acquired by Aha! in 2021), a follow-up pass should re-confirm current positioning before using UserVoice claims in an external-facing document. |
| Savio | Lowest confidence of the five — only pricing/integrations/one use-case page rendered usable content; most rows for Savio are marked not verified rather than absent. Treat Savio's row as directional only. |

**What this report is not:** a claim that any "not verified" cell means the competitor lacks that
capability. It means the specific pages fetched in this session, from that vendor's own domain, did
not document it. A deeper pass (more URLs per vendor, or a fetch environment that renders each
vendor's JS-heavy marketing SPA and support center fully) would very likely fill in several of the
unverified cells above, especially for Aha!, UserVoice, and Savio.

---

## 6. Source index (all fetched 2026-09-30)

- Canny: [canny.io/features/product-roadmap](https://canny.io/features/product-roadmap), [canny.io/features/collect-feedback](https://canny.io/features/collect-feedback), [canny.io/features/product-changelog](https://canny.io/features/product-changelog), [canny.io/security](https://canny.io/security), [canny.io/pricing](https://canny.io/pricing), [developers.canny.io/api-reference](https://developers.canny.io/api-reference)
- Productboard: [support.productboard.com/hc/en-us](https://support.productboard.com/hc/en-us) (index), [.../27858826222355 Fundamentals of Productboard](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard), [.../31018894151571 Access control guide](https://support.productboard.com/hc/en-us/articles/31018894151571-Access-control-guide), [.../20190036673811 Custom roles](https://support.productboard.com/hc/en-us/articles/20190036673811-Custom-roles-Governing-data-field-access), [.../360056315454 Getting started with portals](https://support.productboard.com/hc/en-us/articles/360056315454-Getting-started-with-portals), [.../360056316294 Member role definitions](https://support.productboard.com/hc/en-us/articles/360056316294-Member-role-definitions), [productboard.com/pricing](https://www.productboard.com/pricing/)
- Aha! Ideas: [aha.io/roadmapping/guide/idea-management](https://www.aha.io/roadmapping/guide/idea-management), [aha.io/roadmapping/guide/idea-management/how-can-i-estimate-the-value-of-new-product-ideas](https://www.aha.io/roadmapping/guide/idea-management/how-can-i-estimate-the-value-of-new-product-ideas), [aha.io/ideas/overview](https://www.aha.io/ideas/overview), [aha.io/ideas/pricing](https://www.aha.io/ideas/pricing), [aha.io/pricing](https://www.aha.io/pricing)
- UserVoice: [uservoice.com](https://uservoice.com/), [uservoice.com/product-overview](https://uservoice.com/product-overview), [uservoice.com/pricing](https://uservoice.com/pricing), [uservoice.com/security-compliance](https://uservoice.com/security-compliance), [uservoice.com/integrations](https://uservoice.com/integrations)
- Savio: [savio.io](https://www.savio.io/), [savio.io/pricing](https://www.savio.io/pricing/), [savio.io/use-cases/centralize-product-feedback](https://www.savio.io/use-cases/centralize-product-feedback/), [savio.io/integrations](https://www.savio.io/integrations/)
- Collega (internal, ground truth): `SPEC/05-product-definition.md` (Sections 2, 4, 5, 8), `SPEC/20-feature-ideas-and-engagement.md`, `SPEC/20-feature-user-defined-fields.md`, `SPEC/20-feature-idea-type-fields.md`, `SPEC/20-feature-view-as.md`, `SPEC/20-feature-ai-idea-assist.md`, `SPEC/20-feature-issues-and-delivery.md`, `SPEC/20-feature-notifications.md`, `SPEC/20-feature-oauth.md`, `SPEC/20-feature-saml.md`, `SPEC/20-feature-reporting.md`, `SPEC/implementation-agent-tracker.md` (Current Status, commit `6969336`).
