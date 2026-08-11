# Sprint 4: QA / Code-Review Debt Pass + Profile Portrait Upload

**Status:** Not started
**Sequence:** 4 of 7 — see `SPEC/95-next-sprints.md` for the full sequence and how these sprints relate. Starts after Sprint 3 (`sprint-03-list-filter-parity.md`) is merged; followed by Sprint 5 (`sprint-05-postgres-migration.md`), Sprint 6 (`sprint-06-view-as.md`), then Sprint 7 (`sprint-07-azure-deployment.md`).
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Pay down the deferred QA/Code-Review debt across the large volume of fast-tracked merges (per explicit user decision to pull this in now rather than defer further), and land the one remaining standalone feature item from Bug Triage — profile portrait upload.

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
| P0 | Code-Review pass across all previously-unreviewed merged slices | See `SPEC/implementation-agent-tracker-archive.md`'s per-slice "Judgment calls" sections for a running list of things flagged but never human-reviewed (e.g. lockout fixed-window approximation, JWT ephemeral signing key needing prod config, status name max length 100 vs. the comp's 25-char hint, response-DTO layering compromises) | Sprints 1-3 merged first, so review covers the final shape of things, not a moving target |
| P0 | Confirm or change the still-open judgment calls the review surfaces | Each becomes its own small decision — interview multiple-choice per standing preference | Depends on review findings |
| P1 | Profile portrait upload: GIF/JPEG/PNG only, validated against malicious content, **resized server-side** to a 25×25px thumbnail, replaces the initials avatar when set (nav rail + everywhere initials render) | Independent of the review pass — can run in parallel. Decisions locked 2026-08-10: **store the thumbnail on the user record** (nullable bytes/base64 column) rather than a separate blob table/endpoint; resize + re-encode happens **server-side** for security. **Image library APPROVED 2026-08-11: SkiaSharp** (permissive MIT-style license, cleaner for MVP than ImageSharp's split license) — decode/validate/resize/re-encode through SkiaSharp, do not trust extension or declared MIME | None |
| P2 | Lock the still-unconfirmed default `Status.Color`/`SortOrder` values (currently implemented with placeholder values from the locked comp — see `SPEC/60-spec-q-and-a-backlog.md`) | Cheap to close out alongside the review pass | None |

## Code-Review Hardening Batch (from the 2026-08-11 `/code-review` of `dev`)
Concrete defects already surfaced (auth/token stack, password hashing, and all Application services reviewed clean for org-scoping/role checks — no cross-tenant leak or authz bypass). These are the seed set for the P0 review pass above; full per-item detail (file, line, failure, suggested fix) lives in the matching `SPEC/Bug Triage.md` `TODO` entry. Most-severe first:
| Priority | Sev | Item | Location | Fix |
|---|---|---|---|---|
| P0 | HIGH | CSV export formula injection (CWE-1236) | `src/Collega.API/Parsing/Csv.cs` `Escape` | Prefix a formula-guard on cells starting `= + - @ \t \r` before export |
| P0 | MED | Forced password change enforced only client-side | `src/Collega.Application/Auth/TokenAuthenticationService.cs` | Block non-allowlisted endpoints server-side while `MustChangePassword` is true |
| P1 | MED | Unescaped `LIKE` wildcards in search (`%`/`_`) | `EfIdeaRepository.cs` + sibling `Ef*Repository` search paths | Escape `% _ [` with an `ESCAPE` clause. *Re-verify in Sprint 5 under Postgres semantics.* |
| P1 | MED | Board CSV export builds full dataset in memory (sync DoS) | `IdeaService.ExportBoardIdeasAsync` / `IdeasController.ExportCsv` | Stream / cap rows, or move off the sync request path |
| P2 | MED/LOW | CSV import reads whole upload into memory, no endpoint cap | `IdeasController.ImportCsv` | Add explicit request-size + max-row-count limits |
| P2 | LOW | Client auth state ignores stored token expiry | `CollegaAuthStateProvider.GetAuthenticationStateAsync` | Treat an elapsed `expiresAtUtc` as anonymous on load |

*Excluded false positive:* a `Convert.ToDecimal` 500 in the Number-range filter — `FieldValueValidator` never persists empty/non-decimal values and `FieldType` is immutable, so it cannot fire.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Review pass surfaces a real defect requiring rework across an already-shipped slice | Could reopen "done" work | Budget for this explicitly — don't treat this sprint as pure verification, treat it as verification-plus-likely-fixes |
| Portrait upload security validation (rejecting disguised malicious content, not just trusting the file extension) is easy to under-scope | Security gap if rushed | Explicitly validate file *content* (magic bytes / re-encode through an image library), not just the extension or declared MIME type |

## Definition of Done
- [ ] Code Reviewer has reviewed every previously-unreviewed slice at least once, findings triaged
- [ ] All P0 findings fixed or explicitly accepted with a documented reason
- [ ] **Code-review hardening batch:** all six items resolved (or explicitly deferred with reason) — CSV export formula-guard (HIGH); server-side `MustChangePassword` gate; `LIKE` wildcard escaping; export/import memory bounds; client token-expiry check
- [ ] Profile portrait upload built, validated, server-side resized to 25×25px, stored on the user record, and tested (including a rejection test for disguised non-image content)
- [ ] Image-library NuGet package approved before it's added
- [ ] Default status Color/SortOrder values confirmed and the spec open item closed
