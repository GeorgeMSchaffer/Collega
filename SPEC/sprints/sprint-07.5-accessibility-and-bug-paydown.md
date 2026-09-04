# Sprint 7.5: Accessibility and Bug Paydown

**Status:** In Progress (started 2026-09-04) — baseline `dotnet test Collega.sln` green at 821 tests on `768e30c`
**Sequence:** 7.5 of 8 — runs after Sprint 7 (`archive/sprint-07-ai-idea-assist.md`, complete) and **before Sprint 8** (`sprint-08-azure-deployment.md`). Scheduled 2026-08-25 at user request, same pattern as Sprint 6.5: a paydown wave that clears the pre-feature triage queue before the release that puts the product in front of real users.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Clear the ten open items in `SPEC/Bug Triage.md` — now promoted here and deleted from that queue per its own "Promote and delete" rule. Every item came from a live UI/UX pass against `dev` at `875b223` on 2026-08-16, signed in as an Org Admin, and each was reproduced in the running app rather than read off the source.

**Why this sprint exists rather than deferring:** Sprint 8 is the first deployment to real users. Three of these items are systemic keyboard and screen-reader defects that reach every form and every drawer in the product, and one of them lands on a new user's very first two interactions. Shipping them is a worse outcome than deploying a week later.

## Capacity
| Role | Slices | Notes |
|---|---|---|
| UI/UX Developer | 2 | (1) The three systemic Fluent/shadow-DOM defects — P0 below; (2) the labelling, contrast, sizing and wording items — P1/P2 below |
| QA Developer | 1 | Reproduce each fix in a running browser, not by test alone — these are defects the test suite could not see |
| Code Reviewer | 1 | Reviews both slices before merge |
| Backend Developer | 0 | Sits out — no Domain/Application/Infrastructure/API work in scope |

## Sprint Backlog

### P0 — systemic, cross-cutting
| Item | Detail |
|---|---|
| **Enter does not submit any form** | Every `EditForm` submits via `<FluentButton Type="ButtonType.Submit">`, which renders a `<fluent-button>` whose real `<button>` lives in shadow DOM. The form's light DOM therefore contains **zero native submit controls**, and browsers only perform implicit submission from a native one. Verified live on `Login.razor` (`form.querySelectorAll('button[type=submit],input[type=submit]').length === 0`). Affects `Login.razor`, `Register.razor`, `ChangePassword.razor`, `Profile.razor` — and `ChangePassword` is the forced first-login flow, so a new user's first two interactions both swallow Enter. Fix: a native submit element inside the form, or `ButtonType.Button` with an explicit click handler. |
| **`DrawerShell` never receives focus when opened** | The component renders `<aside role="dialog" aria-modal="true" tabindex="-1" @onkeydown="OnKeyDown">` but nothing focuses it, so on open `document.activeElement` is still `BODY`. Three consequences, all reproduced: **Escape is dead** (the handler is on the `aside`, so the keydown never reaches it — calling `.focus()` on the aside first makes the same Escape press close it); **no focus containment** (63 tabbable elements stayed reachable behind an open Ideas drawer, with no `inert` and no `aria-hidden`, while `aria-modal="true"` tells screen readers the background *is* hidden — this is also what lets a keyboard user tab to "Add New" behind an open admin drawer and stack a second drawer, the Sprint 6.5 review's finding 4); and **no focus restore** on close. Reproduced on the Ideas drawer and the Statuses create drawer as well as the admin detail drawers, so it is the whole `DrawerShell` family. Fix: `FocusAsync` on the aside when `IsOpen` goes true, `inert` on background content while open, restore focus to the invoking element on close. |
| **Fluent text fields have no accessible name** | `<label for="email">` targets the `<fluent-text-field>` *host*; the real `<input>` is in shadow DOM with `id="control"` and no `aria-label`/`aria-labelledby`, so clicking the label focuses the field but nothing names it. Confirmed on `Login.razor` and on the Statuses create drawer (`create-name`). Repeats across 8 files: `Login`, `Register`, `Profile`, `StatusesAdmin`, `IdeaTypesAdmin`, `FieldDefinitionsAdmin`, `BoardEdit`, `PasswordField`. Fluent's own `Label` parameter renders a properly slotted label; the external `<label for>` pattern does not reach through the shadow boundary. Note `PasswordField` uses a real `<input>` and **is** correctly exposed — the custom component is sounder than the library usage around it. |

### P1
| Item | Detail |
|---|---|
| **No `autocomplete` on any email/username field** | Only `PasswordField` sets it (`PasswordField.razor:33`). Password managers therefore see `current-password`/`new-password` with no paired username field, degrading both autofill and credential-save on Sign in and Register. |
| **Two unlabeled controls on the Ideas list** | The main search input is placeholder-only (`Search title & text fields…`, no `aria-label`) and "Rows per page" has no accessible name. The surrounding filters *are* labeled (`Filter by idea type`, `Filter by status`, `Filter by tag`, `Filter by user`), so these two are gaps in an otherwise deliberate pattern. |
| **Idea type conveyed by colour alone on swimlane cards** | `<span class="typebadge icononly" title="Continuous Improvement"><span class="dot"></span></span>` — an empty span carrying a colour plus a `title`. Not announced by screen readers, unavailable on touch. WCAG 1.4.1. Priority chips get this right (`High` as text), which makes the type badge the outlier. |
| **Mobile type below readable minimums** | At 375px: body 14px, inputs/selects **13px** — under 16px, iOS Safari auto-zooms on focus. Also priority chips 9.5px, tags 10.5px, avatars 9.5px, age 11px. Related to the still-open narrow-viewport pass in `src/Collega.Client/CLAUDE.md` → "Still undesigned". |
| **Sign-out wording and placement drift from locked v5** | The rail says "Log out", the session-expiry dialog says "Sign out", the login page says "Sign in"; v5 specifies **Sign Out**. Placement drifts too — sign-out is a fifth rail item and a plain `GET` link to `/logout`, where v5 puts it in the avatar popover. **Open question for the user:** there are two simultaneous View As entry points (rail popover `NavRail.razor:70` plus the header control) — confirm whether that is intended before changing either. |

### P2
| Item | Detail |
|---|---|
| **Drag-to-move has no advertised keyboard path** | The board header reads "Drag cards between lanes to move them"; cards are `draggable="true"` and the grip is `role="img"`. Status can be changed in the drawer, but nothing tells a keyboard user that. |
| **Two small dead / stray surfaces** | "Forgot your password? **Contact your organization admin**" is an `<a href="#">` that does nothing when clicked; the session-expiry dialog markup renders on the signed-out login page (`display:none`, so cosmetic only). Also: table row title links are 16–17px tall, under the 24px target minimum. |

## Explicitly out of scope
- The full narrow-viewport design pass (`src/Collega.Client/CLAUDE.md` → "Still undesigned"). Only the type-size floor is fixed here; the layout work is post-MVP.
- Rule 32c's AI-unavailable flash — scheduled in Sprint 8 so the first deployment ships it.
- Any new component. Every fix above works within the existing `DrawerShell` / `PasswordField` / Fluent usage.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Fixes verified by test only | These defects were invisible to 778 green tests — they live in shadow DOM and focus behavior, which the unit suites do not observe | QA reproduces each one in a running browser, the same way they were found |
| `inert` on background content breaks an existing drawer flow | A drawer that opens another surface would become unusable | Apply to background content only, and re-check the Ideas drawer and admin detail drawers specifically |
| Fluent `Label` parameter changes visual layout | Design drift from locked Comp C | UI/UX Developer confirms against `SPEC/20-feature-client-ui.md` before merging |

## Definition of Done
- [ ] All three P0 items fixed and reproduced as fixed in a running browser
- [ ] All five P1 items fixed
- [ ] Both P2 items fixed, or explicitly deferred with the user's agreement recorded here
- [ ] The two-View-As-entry-points question answered by the user and the outcome recorded
- [ ] `dotnet test Collega.sln` green
- [ ] Code Reviewer approved before merge
- [ ] `SPEC/implementation-agent-tracker.md` and `SPEC/95-next-sprints.md` updated; this file moved to `SPEC/sprints/archive/`
