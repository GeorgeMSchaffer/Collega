# Bug Triage

The working queue of bugs and minor tweaks to fold into an upcoming sprint. Jot items down here in whatever shape is quickest — a sentence is fine.

**This file is a queue, not a roadmap and not a history.** Two neighbours carry what it deliberately does not:

- `SPEC/ideas-inbox.md` — unrefined feature ideas. Nothing there is scheduled, and nothing there blocks work.
- `SPEC/archive/bug-triage-completed.md` — everything already fixed.

## Workflow

- Read this document before starting or resuming feature implementation.
- Items under `TODO` take priority over new features. Do not start a new feature while `TODO` has unresolved items unless the user explicitly approves an exception.
- When an item is fixed and its focused validation passes, **move it to `SPEC/archive/bug-triage-completed.md`** with the completion date and a concise verification note. Do not leave it here.
- Never let an item exist in two places. If a change is incomplete, unverified, or deferred, it stays in `TODO` with its status noted.

### Promote and delete

**When an item is promoted, it leaves this file.** Promotion means it has been written into a canonical spec (`SPEC/20-feature-*.md`, `SPEC/30-Contracts.md`) or scheduled into a sprint plan (`SPEC/sprints/`). At that point the spec or sprint file is its only home — delete the entry here rather than annotating it as "now scheduled as Sprint N".

This rule exists because the opposite happened: entries were promoted and kept, so this file accumulated ~1,100 words of Sprint 6/7 feature design duplicated from `SPEC/20-feature-ai-idea-assist.md` and `SPEC/sprints/sprint-06-view-as.md`, complete with a superseded decision left in place under strikethrough. A duplicate goes stale independently of its source, and then the two disagree.

Two corollaries:

- **Record reversals by deleting, never by striking through.** A struck-through decision leaves both readings in context.
- **Closed is not a status here.** An item marked "CLOSED" belongs in the completed archive, not in `TODO`.

### Scope

- Bugs and minor tweaks → `TODO` below.
- Feature ideas → `SPEC/ideas-inbox.md`.
- Design decisions that change behavior → the canonical spec first, per `CLAUDE.md`.

Keep entries short. A symptom, where it happens, and — if you know it — the cause. Longer analysis is welcome when the analysis *is* the value (a diagnosed root cause worth not re-deriving), but a scheduled feature's full design belongs in its sprint or spec file.

## TODO

Items below marked *(browser review 2026-08-16)* came from a live UI/UX pass against `dev` at `875b223`, signed in as an OrgAdmin. Each was reproduced in the running app, not read off the source.

* **Enter does not submit any form.** *(browser review 2026-08-16)* On Sign in, filling email + password and pressing Enter does nothing — no request, no error, no feedback. Cause: every `EditForm` submits via `<FluentButton Type="ButtonType.Submit">`, which renders a `<fluent-button>` custom element whose real `<button>` lives in shadow DOM; the form's light DOM therefore contains **zero native submit controls**, and browsers only do implicit submission from a native one once a form has 2+ fields. Verified live on `Login.razor` (`form.querySelectorAll('button[type=submit],input[type=submit]').length === 0`). Systemic — same pattern with no native submit in `Login.razor`, `Register.razor`, `ChangePassword.razor`, `Profile.razor`. `ChangePassword` is the forced first-login flow, so a new user's first two interactions both swallow Enter. Fix: a native submit element in the form, or `ButtonType.Button` with an explicit click handler.

* **Drawers never receive focus when opened — breaks Escape, containment, and focus return.** *(browser review 2026-08-16; absorbs the earlier "two admin drawers can be open at once" item)* `DrawerShell` renders `<aside role="dialog" aria-modal="true" tabindex="-1" @onkeydown="OnKeyDown">` but nothing ever focuses it, so on open `document.activeElement` is still `BODY`. Three consequences, all reproduced:
  - **Escape is dead.** The handler is on the `aside`, so the keydown never reaches it. Pressing Escape does nothing; calling `.focus()` on the aside first makes the *same* Escape press close it immediately. The component's doc comment promises "three ways to dismiss" — only two work.
  - **No focus containment.** With the Ideas drawer open, 63 tabbable elements stayed reachable behind it (8 inside), with no `inert` and no `aria-hidden` on background content — while `aria-modal="true"` tells screen readers the background *is* hidden. The AT model and the real focus model contradict each other. This is also what lets a keyboard user tab to "Add New" behind an open admin detail drawer and stack a second drawer on the first (Sprint 6.5 review finding 4, 2026-08-15; not reachable with a mouse — the backdrop intercepts).
  - **No focus restore** on close.
  Broader than the original item recorded: reproduced on the **Ideas** drawer and the **Statuses create** drawer as well as the admin detail drawers, so it is the whole `DrawerShell` family. Fix: `FocusAsync` on the aside when `IsOpen` goes true, `inert` on background content while open, and restore focus to the invoking element on close.

* **Fluent text fields have no accessible name.** *(browser review 2026-08-16)* `<label for="email">` targets the `<fluent-text-field>` *host*; the real `<input>` is in shadow DOM with `id="control"` and no `aria-label`/`aria-labelledby`, so clicking the label focuses the field but nothing names it. Confirmed on `Login.razor` and again on the Statuses create drawer (`create-name`); repeats wherever `FluentTextField` is used (8 files: `Login`, `Register`, `Profile`, `StatusesAdmin`, `IdeaTypesAdmin`, `FieldDefinitionsAdmin`, `BoardEdit`, `PasswordField`). Fluent's own `Label` parameter renders a properly slotted label — the external `<label for>` pattern does not reach through the shadow boundary. Note `PasswordField` uses a real `<input>` and *is* correctly exposed, so the custom component is sounder than the library usage around it.

* **No `autocomplete` on any email/username field.** *(browser review 2026-08-16)* Only `PasswordField` sets it (`PasswordField.razor:33`). Password managers therefore see `current-password`/`new-password` with no paired username field, degrading both autofill and credential-save on Sign in and Register.

* **Two unlabeled controls on the Ideas list.** *(browser review 2026-08-16)* The main search input is placeholder-only (`Search title & text fields…`, no `aria-label`) and the "Rows per page" select has no accessible name. The surrounding filters *are* labeled (`Filter by idea type`, `Filter by status`, `Filter by tag`, `Filter by user`), so these two are gaps in an otherwise deliberate pattern.

* **Idea type is conveyed by colour alone on swimlane cards.** *(browser review 2026-08-16)* `<span class="typebadge icononly" title="Continuous Improvement"><span class="dot"></span></span>` — an empty span carrying a colour plus a `title`. Not announced by screen readers, unavailable on touch. Priority chips get this right (`High` as text), which makes the type badge the outlier. WCAG 1.4.1.

* **Mobile type is below readable minimums.** *(browser review 2026-08-16)* At 375px: body 14px, inputs/selects **13px** — under 16px, iOS Safari auto-zooms on focus. Also priority chips 9.5px, tags 10.5px, avatars 9.5px, age 11px. Related to the still-open narrow-viewport pass in `src/Collega.Client/CLAUDE.md` → "Still undesigned".

* **Drag-to-move has no advertised keyboard path.** *(browser review 2026-08-16)* The board header reads "Drag cards between lanes to move them"; cards are `draggable="true"` and the grip is `role="img"`. Status can be changed in the drawer, but nothing tells a keyboard user that.

* **Sign-out wording and placement drift from locked v5.** *(browser review 2026-08-16)* The rail says "Log out", the session-expiry dialog says "Sign out", the login page says "Sign in"; v5 specifies **Sign Out**. Placement drifts too — sign-out is a fifth rail item and a plain `GET` link to `/logout`, where v5 puts it in the avatar popover. There are also two simultaneous View As entry points (rail popover `NavRail.razor:70` plus the header control) — confirm that is intended.

* **Two small dead / stray surfaces.** *(browser review 2026-08-16)* "Forgot your password? **Contact your organization admin**" is an `<a href="#">` that does nothing when clicked; and the session-expiry dialog markup renders on the signed-out login page (`display:none`, so cosmetic only). Also: table row title links are 16–17px tall, under the 24px target minimum.

Intake returned here on 2026-08-15 when Sprint 6.5 was archived (`sprints/archive/sprint-06.5-bug-fixes-and-tweaks.md`); this is once again the pre-feature queue described above.
