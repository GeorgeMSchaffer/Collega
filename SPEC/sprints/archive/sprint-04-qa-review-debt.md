# Sprint 4: QA / Code-Review Debt Pass + Profile Portrait Upload

**Status:** Complete (2026-08-12) — hardening batch, portrait upload, and judgment calls all done; the broad review pass ran with **partial coverage, closed by explicit user decision**. See "Review pass — what it actually covered" at the end of this file before treating the P0 box as a full review.
**Sequence:** 4 of 8 — see `SPEC/95-next-sprints.md` for the full sequence and how these sprints relate. Starts after Sprint 3 (`sprint-03-list-filter-parity.md`) is merged; followed by Sprint 5 (`sprint-05-postgres-migration.md`), Sprint 6 (`sprint-06-view-as.md`), Sprint 7 (`sprint-07-ai-idea-assist.md`), then Sprint 8 (`sprint-08-azure-deployment.md`).
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Pay down the deferred QA/Code-Review debt across the large volume of fast-tracked merges (per explicit user decision to pull this in now rather than defer further), and land the one remaining standalone feature item from Bug Triage — profile portrait upload.

> **Removed 2026-08-11 (same day it was added):** the Site Admin idea-create path (org picker → board picker) was briefly assigned here as a P1 UI/UX slice, then **superseded by decision** — Site Admin will not get direct org-scoped create paths at all; org content is created/edited via View As act-as impersonation (Sprint 6). See `SPEC/20-feature-client-ui.md` → "Site Admin org-content mutation model" and `SPEC/sprints/sprint-06-view-as.md`.

A recall-oriented `/code-review` of `dev` was already run on 2026-08-11 and produced a concrete six-item hardening batch (below) — treat it as a head start on this sprint's P0 review pass, not a replacement for it.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Code Reviewer | 1 (broad pass) | First real review across Auth, Tenant Admin, Workflow Config, Collaboration, Events, UDFs, Idea-Type Fields, and all client slices — none of these had a Code Reviewer pass at merge time |
| QA Developer | 1 | Full regression + gap-fill on anything the review surfaces |
| Backend + Client Developer | 1 (portrait upload) | Independent feature work, can run in its own worktree parallel to the review pass |
| **Total** | **3** | |

## Sprint Backlog
| Priority | Item | Notes | Dependencies |
|---|---|---|---|
| P0 | Code-Review pass across all previously-unreviewed merged slices | See `SPEC/archive/implementation-agent-tracker-archive.md`'s per-slice "Judgment calls" sections for a running list of things flagged but never human-reviewed (e.g. lockout fixed-window approximation, JWT ephemeral signing key needing prod config, status name max length 100 vs. the comp's 25-char hint, response-DTO layering compromises) | Sprints 1-3 merged first, so review covers the final shape of things, not a moving target |
| ✅ P0 | Confirm or change the still-open judgment calls | **RESOLVED 2026-08-11 (user interview)** — all four decided, see "Judgment Calls (resolved)" below; none needs a code change now | Done |
| ✅ P1 | Profile portrait upload: GIF/JPEG/PNG only, validated against malicious content, **resized server-side** to a 25×25px thumbnail, replaces the initials avatar when set (nav rail + everywhere initials render) | **DONE 2026-08-12** (`a993102`, merged `0d3c0d5`) — `portrait_png` on `users`, `IImageProcessor` in Application + `SkiaSharpImageProcessor` in Infrastructure, Skia decode as the content check (extension/MIME untrusted), re-encoded to a fresh PNG. Detail: `SPEC/archive/bug-triage-completed.md` | Done |
| ✅ P2 | Lock the default `Status.Color`/`SortOrder` values | **RESOLVED 2026-08-11** — confirmed final (see below) | Done |

## Judgment Calls (resolved 2026-08-11, user interview)
The P0 "confirm the open judgment calls" item is closed. All four were decided; **none needs a code change now** (the JWT-key item is routed to Sprint 8):
| Call | Decision | Follow-up |
|---|---|---|
| Account lockout window | **Keep the fixed-window approximation** for MVP (not reworked to a true sliding window) | None — no code change |
| JWT signing key (ephemeral per-process) | **Stays ephemeral for now; enforcing a stable `Auth:TokenSigningKey` is deferred to Sprint 8 (Azure)** | Already on Sprint 8's App Service config (P0) + risks + post-deploy checklist — verify token survives a restart there |
| `Status` name length (`nvarchar(100)` vs 25-char comp hint) | **Keep `nvarchar(100)`** — the 25 hint is dropped | None — no migration |
| Default `Status.Color`/`SortOrder` | **Confirmed final** — the 5 canonical `OrganizationDefaults` statuses (New/Pending #64748B, In Review #D97706, In Progress #2563EB, Client Review #7C3AED, Complete #16A34A; sort 10–50) | None — no code change |

## Code-Review Hardening Batch (from the 2026-08-11 `/code-review` of `dev`)
Concrete defects already surfaced (auth/token stack, password hashing, and all Application services reviewed clean for org-scoping/role checks — no cross-tenant leak or authz bypass). These are the seed set for the P0 review pass above; full per-item detail (file, line, failure, suggested fix) lives in the matching `SPEC/Bug Triage.md` `TODO` entry.

**Security-review corroboration (2026-08-11):** a separate adversarially-filtered `/security-review` of `dev` found **no vulnerabilities beyond this batch** — JWT issuance/validation, PBKDF2 password hashing, CSPRNG invite-code/temp-password generation, tenant isolation (no IDOR), role-escalation ceilings, SQL parameterization, client XSS surfaces, CORS, and the deploy workflow were all verified clean. It confirmed batch item 2 (`MustChangePassword` client-only gate) and added one aggravating detail, now recorded in the Bug Triage entry: `User.RegisterSuccessfulLogin` clears `TemporaryPasswordExpiresAtUtc` on first login, so an unrotated temp password becomes permanent (and remains known to the issuing admin).

**Ordering (user direction, 2026-08-11):** the two security-relevant items below (CSV formula injection; server-side `MustChangePassword` gate) are fixed **first, at sprint start**, before the broader review pass and the portrait-upload feature work — the point is to have them resolved well ahead of the Postgres (Sprint 5) and Azure (Sprint 8) sprints.

Most-severe first:
| Priority | Sev | Item | Location | Fix |
|---|---|---|---|---|
| ✅ P0 | HIGH | CSV export formula injection (CWE-1236) | `src/Collega.API/Parsing/Csv.cs` `Escape` | **DONE 2026-08-11** — guard apostrophe on cells starting `= + - @ \t \r`, stripped symmetrically by `Csv.Parse` so the round trip stays lossless. 15 new tests |
| ✅ P0 | MED | Forced password change enforced only client-side | `src/Collega.API/Authentication/PasswordChangeRequiredFilter.cs` | **DONE 2026-08-11** — global filter refuses all but an opt-in allowlist (`GET /auth/me`, `POST /auth/change-password`) with `403` while `MustChangePassword` is true; flag read from live state per request. Also fixed the aggravator: an unrotated temp password no longer loses its expiry on login. Specs + contracts updated; 4 new tests |
| ✅ P1 | MED | Unescaped `LIKE` wildcards in search (`%`/`_`) | `Persistence/LikePattern.cs` + the three `Ef*Repository` search paths | **DONE 2026-08-11** — shared `LikePattern` helper escapes `\ % _ [` and every call site uses the 3-arg `EF.Functions.Like` with an explicit `ESCAPE`. 4 new tests. *Still to re-verify in Sprint 5 under Postgres semantics.* |
| ✅ P1 | MED | Board CSV export builds full dataset in memory (sync DoS) | `IdeaService.ExportBoardIdeasAsync` | **DONE 2026-08-11** — capped at `MaxExportRows` = 10,000, refusing with `400` rather than truncating. Judgment call flagged to the user; streaming is the alternative if bigger exports are needed |
| ✅ P2 | MED/LOW | CSV import reads whole upload into memory, no endpoint cap | `IdeasController.ImportCsv` | **DONE 2026-08-11** — `[RequestSizeLimit]` 5 MB + 5,000-row cap checked before any per-row work; rejected in full, no partial import. 1 new test |
| ✅ P2 | LOW | Client auth state ignores stored token expiry | `CollegaAuthStateProvider.GetAuthenticationStateAsync` | **DONE 2026-08-11** — consults `GetExpiresAtUtcAsync`, clears the session and returns anonymous when the absolute expiry has elapsed |

*Excluded false positive:* a `Convert.ToDecimal` 500 in the Number-range filter — `FieldValueValidator` never persists empty/non-decimal values and `FieldType` is immutable, so it cannot fire.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Review pass surfaces a real defect requiring rework across an already-shipped slice | Could reopen "done" work | Budget for this explicitly — don't treat this sprint as pure verification, treat it as verification-plus-likely-fixes |
| Portrait upload security validation (rejecting disguised malicious content, not just trusting the file extension) is easy to under-scope | Security gap if rushed | Explicitly validate file *content* (magic bytes / re-encode through an image library), not just the extension or declared MIME type |

## Definition of Done
- [x] Code Reviewer has reviewed every previously-unreviewed slice at least once, findings triaged — **closed 2026-08-12 by explicit user decision, with partial coverage. Read the "Review pass — what it actually covered" section below before relying on this box.**
- [x] All P0 findings fixed or explicitly accepted with a documented reason — 2 of 3 findings fixed (`5a148f6`); the third is filed as an open `TODO`, see below
- [x] Open judgment calls (lockout / JWT key / status-name length / status defaults) all decided 2026-08-11 — see "Judgment Calls (resolved)"
- [x] **Code-review hardening batch:** all six items resolved (or explicitly deferred with reason) — CSV export formula-guard (HIGH); server-side `MustChangePassword` gate; `LIKE` wildcard escaping; export/import memory bounds; client token-expiry check — all six done 2026-08-11, merged `161e4c9` + `7502a88`. *Carry-forward:* the `LIKE` fix is re-verified under Postgres on Sprint 5's DoD.
- [x] Profile portrait upload built, validated, server-side resized to 25×25px, stored on the user record, and tested (including a rejection test for disguised non-image content) — done 2026-08-12, merged `0d3c0d5`
- [x] Image-library NuGet package approved before it's added — SkiaSharp 2.88.8, user-approved 2026-08-11
- [x] Default status Color/SortOrder values confirmed as final (2026-08-11 user interview) — the 5 `OrganizationDefaults` statuses, no change

## Review pass — what it actually covered (2026-08-12)

The P0 review-pass box above is ticked by **user decision to accept partial coverage and start Sprint 5**, not because the slice-by-slice review it describes was completed. Recording the real boundary so a future agent does not read "Complete" as "everything here has been reviewed."

**Reviewed:** `Csv` escape/strip (verified an exact inverse at apostrophe depth 0/1/2), `PasswordChangeRequiredFilter` + its two-endpoint allowlist, `FieldValueValidator` and `FieldDefinition` type immutability, `EfIdeaRepository` search/filter/sort paths, `LikePattern`, `AppExceptionHandler`, `AuthController` attribute map, `AuthService` login head, `IdeaService` export cap + org scoping + portrait data-URL construction, `CollegaAuthStateProvider`, plus codebase-wide scans for `async void`, `.Result`/`.Wait()`, and missing `await`.

**Not reviewed — still carries the original debt:** Collaboration/Comments, Events/notifications, Tenant Admin services, Workflow Config, most of the ~55 `src/Collega.Client` files, and Domain entities.

**Findings:** 3 raised, 2 fixed in `5a148f6` (the `LIKE` `ESCAPE` gap in `ListByOrganizationAsync`; `Csv.Parse` rewriting CRLF inside quoted fields). The third — `AppExceptionHandler` upcasting `ValidationProblemDetails`, which drops the field-level `errors` dictionary from every 400 — is **not fixed** and remains an open item in `SPEC/Bug Triage.md`.

**Standing gap worth carrying:** the whole suite runs on EF Core InMemory, which evaluates `EF.Functions.Like` client-side and cannot distinguish the 2-arg from the 3-arg overload. The `LIKE`-`ESCAPE` defect class is invisible to every in-memory test in this repo. Sprint 5's DoD now requires checking the generated SQL rather than reading the call sites.
