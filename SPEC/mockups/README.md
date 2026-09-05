# UI Mockups

These mockups are static SVG artifacts based on the current Collega specs and shaped around Fluent UI component patterns and usability best practices.

## Screens
- `01-login-and-org-selection.svg`: legacy sign-in and organization-selection concept; retain as historical artifact and replace in implementation with globally unique email flow
- `02-admin-organizations.svg`: Site Admin organization list and creation surface
- `03-admin-users.svg`: organization-scoped user management
- `04-board-overview.svg`: selected board view with compact swimlane cards (title, priority, assigned-to, upvote)
- `05-idea-detail-panel.svg`: detail overlay edit view opened from board card title with full idea fields
- `06-status-management.svg`: organization status management with soft-delete context
- `07-auth-lockout-and-temp-reset.svg`: lockout messaging plus admin-issued temporary password reset one-time reveal workflow
- `08-first-login-password-change.svg`: seeded Site Admin forced password change flow with inline complexity checklist
- `09-board-configuration-swimlanes.svg`: final board configuration comp using Alternative B with visual swimlane mapping and immediate-save reorder cues
- `10-board-empty-state-guided-setup.svg`: final board empty-state comp using Alternative B with card-first onboarding and visible default swimlane columns
- `11-idea-detail-editorial-variant.svg`: alternate editorial visual direction for idea collaboration and activity rail
- `12-idea-card-and-overlay.svg`: dedicated compact card plus detail overlay interaction mockup

## Design System Pass + Hybrids (2026-08-31)

**All 36 comp HTML files were restyled in place** to a business-professional direction (client feedback: "think Trello, Jira, Monday"). Nothing was restructured — only palette, corner radius, and typography changed.

| Change | Detail |
|---|---|
| Palette | 224 distinct colors → 29, built from the 7 client-chosen seeds |
| Corners | All `border-radius` (805 declarations + 47 CSS variables) → `2px`; only avatars keep `50%` |
| Typography | Geist / Geist Mono via Google Fonts, with a system fallback chain |

### Palette rules

Seeds: `#5B7FA3` `#5F9E93` `#6FAF7A` `#C9A65C` `#C97A7A` `#F7F9FB` `#243447`.

Only `#243447` clears WCAG AA as body text (12.67:1). The five chromatic seeds sit at 2.3–4.2:1, so each is used **as a fill, chip, or lane marker only**, paired with a derived `-ink` for text and lighter tints for surfaces. Each `-ink` is derived to clear 4.5:1 against its OWN `-soft` tint (the worst case it appears on), not merely against white — deriving against white leaves chips at ~4.1:1:

| Role | Fill (seed) | Ink (text, ≥4.5:1) | Line | Soft |
|---|---|---|---|---|
| Blue | `#5B7FA3` | `#527292` | `#D1DBE5` | `#F0F4F7` |
| Teal | `#5F9E93` | `#4A7972` | `#D2E4E1` | `#F1F6F5` |
| Green | `#6FAF7A` | `#457C4F` | `#D1E6D5` | `#F0F7F1` |
| Amber | `#C9A65C` | `#8A6D2E` | `#EDE2C9` | `#F9F6EE` |
| Red | `#C97A7A` | `#B64B4B` | `#EACCCC` | `#F8EFEF` |

Neutrals ramp from `#243447` with saturation decaying as lightness rises, so mid-greys read neutral rather than blue: `--ink #243447`, `--ink-2 #3E4E60`, `--ink-3 #5D6C7E`, `--ink-4 #818E9C`, `--line-2 #C5CBD3`, `--line #DDE1E6`, `--surface-2 #F1F3F6`, `--bg #F7F9FB`.

**Never encode meaning in colour alone** — status, idea type, and priority are always spelled out as text.

### Hybrid comps

Three new comps mix the strongest parts of the client's preferred set (D "Focus Desk", H "Loop", I "Memory"). All use the token block above; copy it verbatim rather than re-deriving it.

- `comp-j-desk-slideout.html` — **Hybrid A: Desk + Slideout.** Comp D's shell, rail and lane board, with every create/edit surface converted to comp I's right-hand 620px slideout (`.drawer` + `.scrim`) instead of a route change or centred modal. Screens: board, new idea, idea detail, add status, invite user.
- `comp-k-desk-loop.html` — **Hybrid B: Desk + Loop rail.** Comp D's shell with comp H's activity surface docked as a permanent 340px rail beside the idea (discussion / mentions / history tabs), so the debate never has to be reopened elsewhere. Screens: idea + rail, inbox, thread, preferences.
- `comp-l-delivery-desk.html` — **Hybrid C: Delivery Desk.** Hybrid A plus the delivery surfaces. Screens: promote gate, sprint board, issue + tasks, backlog & planning, roadmap.
- `comp-m-roadmap-single.html` / `comp-n-roadmap-multi.html` — **decision comps**, not directions. Same shell and token block. **Resolved 2026-09-02 in favour of comp M (single-parent);** comp N is kept as the record of the rejected alternative. See the cardinality section below.

### Delivery scope, reconciled

`comp-l-delivery-desk.html` renders **Tasks** and **Roadmap**, both of which were explicit Non-Goals in `SPEC/20-feature-issues-and-delivery.md` when the comp was built. Reviewing the comp is what settled it: the product owner brought both into scope on 2026-08-31, and **the canonical spec was reconciled the same day**. It now specifies Tasks as Slice 1 (P0) and Outcomes/Roadmap as Slice 2 (P1), with the Non-Goals rewritten from "not now" to a much narrower "not ever, and here is the line".

Where Comp L follows the spec, it follows it exactly: Idea and Issue are the same row in two phases (`Discovery` -> `Delivery`), promotion is an explicit audited gate, delivery statuses are the fixed set (`Pending / Scoping / Development / Review / Complete`), and `Effort` is T-shirt sizing rather than story points.

**Task model (decided 2026-08-31, now canonical):** Tasks are checklist items belonging to an **Issue**; the Issue is the unit assigned to a sprint. A task therefore can never be stranded in a sprint its parent has left. First-class independently-assignable tasks were considered and rejected as too heavy for "Jira light".

### Roadmap cardinality: comp M vs comp N — **resolved, comp M** (2026-08-31, decided 2026-09-02)

One question gated Slice 2: **may an Issue sit under more than one Outcome?** **The answer is no — single-parent, comp M.** These two comps exist to have settled it, and are **generated from a single template** so they differ *only* where that decision bites — diff them screen for screen and what you see is exactly what the choice cost.

- `comp-m-roadmap-single.html` — **Single-parent.** An issue has one home. `Idea.OutcomeId`, one nullable FK.
- `comp-n-roadmap-multi.html` — **Multi-parent.** An issue serves every outcome it advances. A join table.

Both carry the same five screens (Roadmap / Outcome detail / Issue / Grouping drawer / What it costs) over the **same 16 delivery issues**, so the arithmetic is directly comparable:

| | comp M (single) | comp N (multi) |
|---|---|---|
| Memberships | 14 | 18 over 14 distinct |
| Row totals | Partition the delivery set — they sum to it | A cover — `18 != 16`, every total needs a distinct-count beside it |
| Derived spans | Clean staircase | Smeared: a shared issue drags an outcome's bar into a quarter its own work does not start in |
| Issue field | One value, same grammar as the Sprint picker | A chip list with an add affordance and a defined empty case |
| Grouping action | A **move** — leaves the previous outcome | An **add/remove** — nothing is displaced |
| Reversibility | single -> multi later is a cheap forward migration | multi -> single later is **lossy**; a human picks which grouping survives |

Each comp's final screen argues its own side *and* states its own cost, including the failure mode to watch for. **Decided 2026-09-02: single-parent (comp M).** Roadmap arithmetic is honest by construction — counts partition, totals sum, "done" is unambiguous, and no rollup needs a distinct-count. The accepted cost is that work genuinely serving two quarterly goals must pick one; the failure mode to watch is teams raising duplicate Issues so two Outcomes can each claim the work. The Open Question in `SPEC/20-feature-issues-and-delivery.md` is closed, and Slice 2 is no longer gated. `SPEC/decisions.md` carries the full entry.

### Comp O: the DESIGN.md / Notion direction probe (2026-08-31)

`DESIGN.md` (repo root) is an analysis of **Notion's** design language. These three comps
apply it to Collega's own screens so the direction can be judged on real surfaces rather
than in the abstract. They are an **exploration**: nothing in `SPEC/` was changed for them,
the 41 comps A–N were not restyled, and the design system uploaded to Claude Design is
untouched. Each file carries a banner saying so.

- `comp-o-notion-01-board.html` — Board: swimlanes, list, first-run empty state
- `comp-o-notion-02-idea-detail.html` — Idea detail, new-idea slideout, modal/toast + the three elevation levels
- `comp-o-notion-03-delivery.html` — Sprint board, backlog table, roadmap

All three are generated from one shared token layer, so they are provably the same system.
Values are taken from the `DESIGN.md` front matter verbatim and were verified in-browser:
Inter loaded, `heading-1` at 40px/−1px tracking, canvas `#f6f5f4`, primary `#0075de`,
pill `9999px` CTAs, 12px cards, 8px utility buttons, 4px inputs.

**It contradicts three locked decisions**, so adopting it is a real reversal, not a tweak:

| | Locked | DESIGN.md |
|---|---|---|
| Corners | `2px` — "minimize rounded corners", 2026-08-07 | 12px cards, **pill `9999px`** CTAs |
| Font | Geist, self-hosted, `SPEC/20-feature-client-ui.md` (2026-08-12) | NotionInter → Inter |
| Accent | `#527292` (canonical 2026-08-31) | `#0075de` |

What the probe settled:

- **The two colour rulebooks reconcile.** DESIGN.md forbids colour that *structures* a
  layout but explicitly permits the sticker palette as *category dots*; Collega forbids
  colour that carries meaning *alone*. An 8px dot with the label always written beside it
  satisfies both. Status lanes lose their tinted bands and read as plain type on the canvas.
- **Idea detail is the best fit.** A single idea is a document, which is what this system
  was drawn for. The heavy, tightly-tracked `heading-1` is an improvement here, not a translation.
- **The backlog table needs no translation.** `ex-data-table-cell` maps straight onto Collega.
- **The sprint board is where it strains.** 12px radii and generous padding fit fewer cards
  above the fold than comp L.
- **The roadmap pays the most.** With structural fills banned, outcome bars become neutral
  chips and stop separating at a glance across a wide grid.
- **Two things to fix before any adoption.** The pastel stickers (`#d6b6f6` purple in
  particular) are close to invisible at 8px dot size and would need a deeper cut; and
  elevation levels 0 and 1 are near-indistinguishable, which is fine on a marketing page
  but leaves a dense app with no way to signal what is draggable.

DESIGN.md also analyses a **marketing site**, so several of its component specs — `hero-band`,
`pricing-plan-card`, `footer` — have no home in Collega. The single dark `#213183` band is
used exactly once, on the first-run empty state, which is the only screen in the app with
nothing to structure.

### Comp P: Focus Desk, extended to the whole shipped client (2026-08-31 → 2026-09-03)

`comp-p-focus-roadmap.html` answered feedback item #1 in `SPEC/UI Feedback.md`: comp **D**'s
Focus Desk layout carrying a roadmap, styled per `DESIGN.md`. It was locked as the UI
direction on 2026-08-31 with ten screens, and then extended over the following three days
into a four-file set covering every route the client ships — **46 screens, each rendered at
four roles and four states** by the comp chrome's role and state controls:

| File | Screens |
|---|---|
| `comp-p-focus-roadmap.html` | Home, Boards, Board, Ideas list, Inspector, New idea, Brainstorm, Command palette |
| `comp-p-auth.html` | Login, Locked, Returned, Register, First sign-in, Session expiring, View as, Viewing as |
| `comp-p-admin.html` | The 23 `/settings/*` routes, including the eight organization-scoped Site Admin mirrors |
| `comp-p-delivery.html` | Sprint board, Backlog, Issue, Promote gate, Roadmap, Outcome, Set outcome — specified, unbuilt |

All four are generated from `SPEC/mockups/_build/`; never hand-edit the HTML. **Home is the
landing screen**, and it carries written copy rather than placeholder text.

**Two voices, kept apart.** Everything inside the app frame is product copy, written to be
lifted into the real UI: a first-run strip explaining how an idea moves through the
statuses, a definition under each KPI saying what it counts, and a standfirst on each panel
saying how the list is ordered and why. Everything addressed to a reviewer of the comp —
the screen list, the keyboard shortcuts, which screens carry open questions — sits in the
chrome band above the app frame, outside the mock, so nobody has to guess which sentences
would ship.

What it keeps from each parent:

- **From comp D** — the premise that Home answers *"what needs me now"*, not *"what exists"*
  (KPI row, "Needs your attention" queue, activity feed, `Ctrl K` palette), the **docked
  inspector** as a third grid column rather than a modal, **inline create** beside the list
  it adds to, and comp D's accessibility fixes carried over verbatim: native
  `<button type="submit">`, `autocomplete="username"` paired with the password field, a real
  `<label for>` on every filter and form control, and idea type written as text on every
  board card rather than encoded in a coloured dot alone.
- **From comp N** — multi-parent grouping: `18 memberships over 14 distinct issues`, a
  distinct-count beside every total, outcomes as a removable chip list on the issue, and a
  Grouping control whose checkboxes make add/remove (not move) the operation.

**One thing had to be invented.** Comp N tints each outcome's bar; `DESIGN.md` forbids a
structural fill from the sticker palette, and comp O-3 showed neutral bars alone lose the
outcome at a glance. Comp P encodes **"shared" as a dashed border rather than a hue** —
not colour, so it survives greyscale, colour blindness and print, none of which a tint
does. This is the one place the two rulebooks needed a genuinely new answer rather than a
reconciliation, and it is worth keeping even if the Notion direction is dropped.

**The measured cost of the direction.** `DESIGN.md`'s body-sm is 15px against comp D's
12.5px, so the same table is taller: an Ideas row measures **67px** here against comp D's
**57–59px**, and ten rows run **669px** against **584px** — about 15% more vertical space
for the same page. Worth knowing before this direction is chosen, not after.

**Comp P's roadmap surfaces follow the cardinality decision.** Comp P was first built on
comp N's multi-parent mechanics while the question was open. It was decided **single-parent**
on 2026-09-02, and `comp-p-delivery.html` was regenerated from comp M's mechanics the next
day: the Issue carries one Outcome value with a *Change* action, Set outcome is a radio group
whose warning is about the move, the roadmap's bars form a staircase and its ledger reads
`= the delivery set`, and the command palette no longer reports a shared count. The same
pass added the screens the spec's Client UI section names — Sprint board, Backlog and
planning, the Promote gate, and Outcome detail — at four roles and four states. Every screen
in that file still carries the *not built* strip, because the product behind it is specified
and unimplemented. `comp-n-roadmap-multi.html` is retained only as the record of the rejected
alternative. Do not hand-edit — `SPEC/mockups/_build/build_p.py` owns these files.

### Comp Q: comp P on Tailwind CSS + shadcn/ui (2026-09-03)

`comp-q-{focus-roadmap,auth,admin,delivery}.html` is **comp P rendered by the framework the
client is built on** — Tailwind CSS v4 + shadcn/ui (`SPEC/decisions.md` 2026-09-03, "not
reinvent a wheel"). Built by `_build/build_q.py` from the *same fragments* as comp P, so the
46 screens, four roles, four states, structure and copy are identical; every semantic class
is expanded into what the matching shadcn component renders and Tailwind is compiled over
the result. Where the framework's defaults differ from comp P's hand-drawn values, comp Q
takes the framework's — 14px UI text, 36px controls, `--radius: 0.3rem`, Badge / Card /
Dialog / Sidebar / Command shapes, Geist — which is the point of it. The theme carries the
2026-08-31 palette as shadcn variables; the palette stays open and lives in one block of
`_build/q.css`. Comp Q is the visual reference for the conversion's Wave E; comp P remains
the source of structure and copy. The component map is in `_build/README.md`.

## Full-App Comps (2026-07-30)

Three interactive HTML comps covering every page (Login, First Login, Home, Admin Hub, Organizations, Users, Statuses, Board, Idea Detail, Change Password). Open in a browser and use the top tab bar to switch screens. Each explores a distinct direction inspired by Jira/Trello best practices while staying implementable with Fluent UI Blazor components.

**Superseded.** Comp A was selected on 2026-07-30 and Comp C on 2026-08-06; since 2026-08-31 the direction is comp P, made canonical on 2026-09-03 (`SPEC/decisions.md`). Kept for history: **Comp A "Command Center" was the chosen UI/UX layout for implementation**, restyled to use the typography and color palette from the SVG mockups (01–12): `"Segoe UI", Arial, sans-serif`, slate neutrals (`#0f172a`/`#334155`/`#64748b`), `#f8fafc` background, and `#1d4ed8`/`#1e3a8a` blue accent. See `SPEC/20-feature-client-ui.md` for the full design-direction spec. Comps B and C are retained as explored alternatives.

- `comp-a-command-center.html` — **Command Center** (Jira-inspired): persistent left nav rail with grouped sections, breadcrumbs, dense data tables with command bars, KPI dashboard, swimlane board with priority edge accents, and a two-pane idea overlay (content + metadata sidebar). Best for power users and admin-heavy workflows.
- `comp-b-board-first.html` — **Board First** (Trello-inspired): top app bar only (no sidebar), board tiles on Home, full-bleed colored board canvas, card-based org management, and a Trello-style idea overlay with side action buttons. Best for approachability and collaboration-first orgs.
- `comp-c-fluent-editorial.html` — **Fluent Editorial**: slim icon rail, large page headers with pivot tabs, list-style lanes (grouped rows instead of columns), and a full-page article-style idea detail with a facts rail. Best for readability, accessibility, and discussion-heavy usage.

All three comps demonstrate spec behaviors: globally unique email sign-in (no org picker), lockout after 5 failed attempts, one-time temporary passwords, first-login forced password change with inline complexity checklist, soft-delete status retirement with minimum-lane guardrail, immediate-save reorder cues, compact cards (title, priority, assignee, upvote) with title-click detail, mention highlighting, and comment character-count feedback.

## Design Intent
- Fluent UI component language: top app bar, nav, cards, command bars, tables, panels, buttons, badges, and dialogs
- Accessibility and usability focus: strong hierarchy, visible labels, predictable actions, readable density, and clear empty-state/help text
- Role-aware surfaces: admin tools are distinct from day-to-day collaboration views
- Error prevention cues should include inline mention validation, comment character-count feedback, and guided empty states with primary actions

## Visual Directions in This Set
- Command Center: denser, operational views for admin and board-configuration workflows
- Guided Setup: onboarding-heavy screens with strong helper content and primary actions
- Editorial: readability-focused collaboration layout with clearer narrative hierarchy

## Board Direction Selection (2026-07-24)
- Alternative B was selected for board configuration and board empty-state flows.
- The selected direction emphasizes card-first scanning with visible lane mapping and guided setup actions.
- Cards are intentionally compact in-lane and move full editing into an in-context overlay.

## Spec Coverage Mapping
- Authentication and Access (`SPEC/20-feature-auth.md`)
	- `07-auth-lockout-and-temp-reset.svg` covers lockout feedback (5 failed attempts in 15 minutes), temporary-password issuance cues, and one-time display guidance.
	- `08-first-login-password-change.svg` covers seeded Site Admin first-login password change requirement and complexity rule feedback.
- Organizations and Users (`SPEC/20-feature-organizations-and-users.md`)
	- `10-board-empty-state-guided-setup.svg` demonstrates guided empty-state behavior pattern with a clear primary action.
- Boards and Statuses (`SPEC/20-feature-boards-and-statuses.md`)
	- `09-board-configuration-swimlanes.svg` covers swimlane subset configuration, minimum-lane guardrail, and immediate save after reorder.
	- `10-board-empty-state-guided-setup.svg` covers board empty-state guidance and default-lane orientation.
- Ideas and Engagement (`SPEC/20-feature-ideas-and-engagement.md`)
	- `04-board-overview.svg` and `12-idea-card-and-overlay.svg` cover compact card fields and title-click overlay interaction.
	- `05-idea-detail-panel.svg` and `12-idea-card-and-overlay.svg` cover full in-overlay editing for idea fields, tags, mentions, assignment, optional due date, comments, and upvote behavior.
	- `11-idea-detail-editorial-variant.svg` reinforces tag/mention/comment/upvote affordances and role-aware collaboration cues.
- Notifications and Audit (`SPEC/20-feature-notifications.md`)
	- `07-auth-lockout-and-temp-reset.svg` and `11-idea-detail-editorial-variant.svg` include event-oriented cues that align with deferred delivery and audit-focused MVP behavior.

## Fluent UI Blazor Implementation Notes
- These artifacts are intended for implementation with Fluent UI Blazor components and services.
- Keep required provider components in root layout when implementing service-based UI: `FluentToastProvider`, `FluentDialogProvider`, `FluentMessageBarProvider`, `FluentTooltipProvider`, and `FluentKeyCodeProvider`.
- Use service patterns for dialogs and toasts during implementation rather than toggling dialog visibility directly.
- Do not add manual script or stylesheet tags for the Fluent library; rely on package-provided assets and initializers.
