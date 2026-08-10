# Collega.Client

Blazor WebAssembly UI (Fluent UI Blazor components).

```bash
dotnet run --project src/Collega.Client/Collega.Client.csproj   # http://localhost:5098
```

Before starting or resuming client feature work, check `SPEC/Bug Triage.md` and resolve its `TODO` items unless the user explicitly approves an exception. Then check `SPEC/implementation-agent-tracker.md` for current status and confirm with the user before spawning a UI/UX Developer implementation pass.

Keep components focused on rendering and user interaction. Business rules belong in Application/Domain, reached through the API.

## Design direction

**Comp C "Fluent Editorial"** — `SPEC/mockups/comp-c-fluent-editorial.html`, specified in `SPEC/20-feature-client-ui.md`: slim 64px icon rail, serif display headings, warm neutral palette with an indigo accent, page-header tabs, list-style status sections (grouped rows, not Kanban columns) for boards, and — **since 2026-08-10** — an idea detail that opens as a **right slide-in drawer** (detail + inline edit) with a centered **create modal**, replacing the earlier full-page idea detail. See `SPEC/20-feature-client-ui.md` → Idea Detail Surface and `SPEC/mockups/comp-c-review-09-detail-surfaces.html`. Built (T-UI-3) in `Components/IdeaDrawer.razor` + `Components/IdeaCreateModal.razor`, used from the Ideas list and board rows/cards.

Comps A ("Command Center") and B ("Board First") are rejected alternatives kept for history, as are the `comp-a-review-*.html` files. Not implementation targets.

### Locked (2026-08-07)

`SPEC/mockups/comp-c-review-06-lockin-v5-final.html` is the chosen direction for **Sign in, Home, Settings (Orgs/Users lists), Board List, Swim Lanes, and Idea Detail**. It supersedes `comp-c-review-06-lockin-v4-combined.html`, and supersedes `comp-c-review-01`/`-02` for general chrome, color, and spacing.

Decisions carried by v5:

- The 64px icon rail stays, showing **Home, Boards, Ideas, Settings** identically on every screen, plus a bottom avatar.
- The richer Home dashboard from Decision D4 in `SPEC/20-feature-client-ui-revisions.md`.
- Minimal border radius throughout.
- Board List rows and headers colored to match each status, tying List and Swim Lanes into one visual system.

Resolved in the same session:

- Swimlane cards are **Flat** — pale lane background, priority-colored chip and left border per card, small status dot in the lane header. Banded and Tinted were dropped.
- The `rgb(33,37,41)` header bar is **dropped entirely**; the rail's bottom avatar owns Sign Out/Profile via a click-open popover.
- The rail gained a dedicated **Ideas** icon.
- **"Admin" is renamed "Settings" everywhere** — rail label, breadcrumbs, page titles.
- Swimlane priority chips use the same priority-color encoding as List view, not the lane's status color.

`-01`, `-02`, `-04`, and `-05` remain the reference for detailed CRUD states v5 doesn't repeat: new/edit/detail/CSV-import forms, the status color picker, and all sign-in edge cases. `-04` and `-05` were patched in place with the same round of fixes rather than duplicated.

Full before/after detail, including a UI/UX critique's gap and anti-pattern findings and their fix status: `SPEC/mockups/comp-c-review-06-critique-tracker.md`.

### Still undesigned

- **Mobile / narrow viewport** — a broader pass for the icon rail and other pages remains open. (The drawer + create modal already ship their first locked narrow-viewport treatment: full-width drawer sheet + full-screen modal at ≤768px.)

(`/ideas` — the global idea search page — is **built and shipped**: `Pages/Ideas.razor`, comp `comp-c-review-07-ideas-list.html`, with the drawer/create-modal wired in per T-UI-3. No longer undesigned.)

## Before writing production Blazor

If a page or flow hasn't had its layout settled, produce a throwaway HTML comp in `SPEC/mockups/` for review first. Writing components against an undecided design is the rework this comp process exists to prevent.
