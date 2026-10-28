# Feature: Analytics and Search Metadata

**Status:** Parts 1 and 2 built (slice 316, merged 2026-10-22). Part 3, usage analytics, specified
2026-10-27 and not built (`SPEC/decisions.md` 2026-10-27, "Usage analytics records what members
view, tied to their account"). Contract: `SPEC/contracts/usage.md`. Comp:
`SPEC/mockups/comp-r-usage-analytics.html`, approved 2026-10-27.

## Purpose

Three things, kept separate because they answer different questions:

1. **Traffic** — page views and a small set of anonymous custom events, using Vercel Analytics.
   Counts only; nothing identifies a person.
2. **Search metadata** — how public pages describe themselves to search engines: titles,
   descriptions, a sitemap and robots rules. This affects discovery, not measurement. Analytics
   does not improve search ranking, and this spec does not claim it does. Search queries and
   rankings come from Google Search Console, which needs no script on the page.
3. **Usage analytics** — how members use the app over time: activation, retention, the paths they
   take. Recorded in our own PostgreSQL, tied to the member's account, and read by Site Admins.

Most of the app sits behind sign-in, so the public surface is the sign-in and registration pages,
plus the privacy page Part 3 adds. Search metadata is scoped to those and to anything made public
later.

## Part 1 — Traffic (Vercel Analytics)

1. Vercel Analytics is mounted once in the root layout of `apps/web` and records page views on
   every route.
2. Custom events are recorded only for the interactions listed under "Events". Nothing else is
   instrumented in Vercel Analytics.
3. No event or page view carries a token, password, email address, or idea/organization content.
   Routes with identifiers in the path record the route template (for example
   `/organizations/[id]/boards`), not the resolved path. This extends the existing rule that
   analytics never receives credentials (`SPEC/20-feature-auth.md` item 30).

### Events

| Event | Fired when | Properties |
|---|---|---|
| `idea.created` | An idea is saved as new | none |
| `idea.assist.used` | The idea assistant turn is sent | none |
| `board.viewed` | A board page loads | none |
| `view-as.started` | Act as another user is started | none |

No properties carry identifiers. Vercel Analytics stays anonymous: Part 3 does not send it a user
identifier, and the 2026-10-21 consent decision continues to hold for it.

## Part 2 — Search metadata

4. The root metadata sets a title and description. Public pages set their own title and
   description. Protected pages set `robots: noindex`.
5. `app/sitemap.ts` lists the public pages: sign-in, register and (Part 3) privacy. `app/robots.ts`
   allows those and disallows everything else. A public landing page is a separate slice; when it
   exists, it joins the sitemap and robots allow-list in that slice.

### Enabling Vercel Analytics

6. Vercel Analytics (Part 1) is inert in local development and in preview deployments unless
   enabled explicitly. The page code does not depend on it for any behaviour. "Enabled" means
   `VERCEL_ENV` is `production`, or `COLLEGA_ANALYTICS=on` is set on the web project. Usage
   analytics (Part 3) has its own switch, requirement 12.

## Part 3 — Usage analytics

### Sources

Two tables answer journey questions together:

- **Changes** come from `audit_events`, unchanged. Every change already records the organization,
  the actor, who they acted as, the event type and the time. `tools/analytics/journeys.sql` holds
  the reference queries (activation, first board, weekly retention, signup cohorts) run against it.
- **Views** come from a new `usage_events` table, written by a new intake route. These are what the
  audit log cannot show: what members look at, and anything a Read Only member does.

Changes are never copied into `usage_events`, and views are never written to `audit_events`, so
the idea activity history (`GET /api/v1/ideas/{ideaId}/activity`) is unaffected.

### What is recorded

7. Only these events, and only from `apps/web`:

   | Event | Fired when | Carries |
   |---|---|---|
   | `board.viewed` | A board page loads | `boardId` |
   | `idea.opened` | The idea drawer opens | `ideaId`; `source`: `board`, `list`, `inbox` or `link` |
   | `list.viewed` | A list page loads | `list`: which list (`ideas`, `backlog`, `roadmap`, `sprints`, …) |
   | `search.run` | A search is submitted | `scope`; `resultCount`. **Never the search text** |
   | `filter.applied` | A list or board filter changes | `list`; `filterKeys`, the filters in use. **Keys only, never values** |
   | `admin.viewed` | An admin screen loads | `screen`: the route template |
   | `settings.viewed` | A settings or profile screen loads | `screen`: the route template |

   Every event also carries the route template (requirement 3's rule) and the time it happened in
   the browser. The server adds the user, the organization and, under View As, the acting-as user,
   from the session. The browser never sends an identity.
8. No event carries a token, password, email address, or idea, comment or organization content.
   Identifiers of items (`boardId`, `ideaId`) are allowed; text is not.
9. **Repeats collapse.** The same user firing the same event for the same item within 30 seconds is
   recorded once. The browser collapses first; the server does not re-check.
10. **Who is recorded.** Every role, Read Only included. A Site Admin acting directly is not
    recorded (their screens are platform screens, not usage). Under View As, events are recorded
    with the acting-as user set and are **excluded from every statistic and path**; they appear
    only in the member trail, marked, as a support record.
11. **Opting out.** Each user has a "Record how I use Collega" switch in their profile, on by
    default. Off stops new view events for that user at once; their changes still reach the audit
    log as they always have. Turning it off does not delete events already recorded; they age out
    with requirement 16. The switch is the user's own: no admin can change it.
12. **Off switch.** `COLLEGA_USAGE_TRACKING=off` on the API project stops all recording without a
    deploy. The intake route keeps answering `202` and stores nothing. The default is on, except
    that production stays off until the privacy page wording is signed off (requirement 21).

### It never affects the user

13. **The browser never waits.** Events queue in memory (never in cookies or browser storage) and
    are sent in one batch every 10 seconds, when the queue reaches 25 events, or when the page is
    hidden (`sendBeacon`, falling back to `fetch` with `keepalive`). Nothing awaits the send and
    nothing is shown if it fails. A failed batch is dropped, not retried. Above 200 queued events
    the oldest are dropped.
14. **The server answers before it can fail.** The intake route returns `202` for any signed-in
    caller, whatever happens to the write. The insert is one statement per batch with a 2-second
    statement timeout. Any failure — timeout, connection, validation of the stored row — is caught
    and written to the console as one JSON line tagged `usage_events_write_failed`, carrying the
    batch (which holds no content, requirement 8), the user and organization ids and the error
    message. Vercel keeps runtime logs, and a log drain can keep them longer; nothing is written
    to local files, which do not survive a serverless request.
15. **Audit stays strict.** None of this applies to `audit_events`: an audit write still succeeds
    or fails with the change it records. Only usage events fail open.

### Keeping it small

16. **Retention.** Raw `usage_events` rows are kept for 90 days (`COLLEGA_USAGE_RETENTION_DAYS`,
    default 90, so lengthening it later is configuration, not a migration). Older rows are rolled
    up into `usage_daily` — one row per day, organization and event type, with the event count and
    the distinct-user count — and then deleted.
17. **The nightly job.** A Vercel cron on the API project calls
    `GET /api/v1/internal/usage/rollup` once a night (04:00 UTC). Each day past retention is rolled
    up and its raw rows deleted in one transaction, one day at a time, so it never holds a long
    lock. It is idempotent: re-running a day replaces that day's rollup. A failed run logs and is
    retried the next night; it never touches a user request. Vercel signs the call with
    `CRON_SECRET`, and the check lives in the auth folder, the identity chokepoint.
18. **Expected volume.** About 4,000 rows a day at 50 daily members, about 360,000 at the 90-day
    cap. Batching keeps it to one insert per batch, which matters because Prisma Postgres bills
    largely by operation and production runs with `connection_limit=1` per function.

### Who sees it

19. **Site Admins**, through the usage screen (comp: `SPEC/mockups/comp-r-usage-analytics.html`),
    one organization at a time, chosen explicitly. Three tabs:
    - **Overview:** four totals (active members of all members, views, changes, visits per active
      member per week); *Getting started* milestones (organization created, first board made by a
      person, first idea, first comment, third active member, first idea moved to a final lane, each
      with its date and days since creation, or "not yet"); *Members coming back* (share of members
      active each week since the organization's first active week, with a table view); *Feature
      use* (count, distinct people and a split by role, for each view event and the main change
      events).
    - **Paths:** for a chosen starting event, the top 10 next steps in the same visit, with share and
      median wait. A visit ends after 30 minutes without an event.
    - **Member trail:** one member's views and changes, newest first, for support. View As rows are
      marked. A member who opted out shows a note and their changes only.

    Filters: period (last 7, 30 or 90 days, or older than 90 days, which shows daily counts only and
    hides Paths and Member trail), and role. Every statistic excludes Site Admins, View As activity
    and opted-out members' views.
20. **Org Admins, later**, for their own organization only: Overview and Paths, totals only. They
    never see an individual member's views. Per member, they see only what each person changed,
    which is already visible on the items themselves. The comp draws this view; it ships in its own
    slice after the Site Admin screen.

### Privacy

21. A public **privacy page** at `/privacy`, linked from the sign-in and register pages and listed
    in the sitemap and robots allow-list (requirement 5). It says, in plain words: which views are
    recorded; that they are tied to the member's account; that they are kept 90 days, then only as
    daily counts that name no one; who can see them (Site Admins now, Org Admins as totals later);
    that no cookie or browser storage is used; and how to turn recording off. The wording is signed
    off by the owner (or counsel) before `COLLEGA_USAGE_TRACKING` is turned on in production.
22. **No consent banner.** Usage events are first-party, stored in our database, and nothing is
    stored on the device, so the 2026-10-21 position holds; the lawful basis is legitimate interest
    in improving the product, with the notice and the opt-out above. Revisit if a customer's data
    processing agreement asks for more, or if tracking ever stores something in the browser.

### Out of scope

- Session replay, heatmaps and mouse tracking.
- Recording search text, filter values or any item content.
- Sending usage events to any third party, Vercel included.
- An Org Admin switch that turns recording off for a whole organization.
- The four baseline reports and CSV export (the Reporting epic). It is no longer deferred
  (`SPEC/decisions.md` 2026-10-27) but is specified separately and built after this.

## Proposed slices

| Slice | What |
|---|---|
| 363 | This spec, the contract, the decision and the comp |
| 364 | Backend: schema amendment, intake route, opt-out route, rollup route and cron, auth-folder guard |
| 365 | Web: the event queue and its seven events, the profile switch, the privacy page, sitemap and robots |
| 366 | Backend: the Site Admin read routes (overview, paths, member trail) |
| 367 | Web: the Site Admin usage screen from the comp |
| 368 | QA for 364-367, per `SPEC/40-test-strategy.md` |
| later | The Org Admin view (requirement 20), then the Reporting epic |

## Done when

- Parts 1 and 2: as shipped in slice 316; owed: page views and events confirmed in a production
  deployment. The sitemap and robots responses include `/privacy`.
- Part 3:
  - Each event in the table is recorded once in a browser test with the listed fields and none of
    the forbidden values.
  - With the database unreachable, every page still loads and works and no error reaches the
    browser; the intake route answers `202` and the console shows `usage_events_write_failed`.
  - An opted-out user, a direct Site Admin and `COLLEGA_USAGE_TRACKING=off` each record nothing.
  - View As events are stored with the acting-as user and absent from every statistic.
  - The rollup produces the same daily totals as the raw rows it replaces, and a second run of the
    same day changes nothing.
  - The usage screen matches the approved comp, and the privacy page is live with signed-off
    wording before production recording is turned on.
