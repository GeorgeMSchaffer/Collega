# Feature: Analytics and Search Metadata

**Status:** draft. Scope agreed 2026-10-21 (tracking plus SEO metadata). Consent, plan and public
pages are decided (`SPEC/decisions.md`, 2026-10-21).

## Purpose

Two things, kept separate because they answer different questions:

1. **Interaction tracking** — which surfaces people use and what they do in them, using Vercel
   Analytics: page views and a small set of custom events.
2. **Search metadata** — how public pages describe themselves to search engines: titles,
   descriptions, a sitemap and robots rules. This affects discovery, not measurement. Analytics
   does not improve search ranking, and this spec does not claim it does.

Most of the app sits behind sign-in, so the public surface is the sign-in and registration pages.
Search metadata is scoped to those and to anything made public later.

## Requirements

1. Vercel Analytics is mounted once in the root layout of `apps/web` and records page views on
   every route.
2. Custom events are recorded only for the interactions listed under "Events". Nothing else is
   instrumented in this slice.
3. No event or page view carries a token, password, email address, or idea/organization content.
   Routes with identifiers in the path record the route template (for example
   `/organizations/[id]/boards`), not the resolved path. This extends the existing rule that
   analytics never receives credentials (`SPEC/20-feature-auth.md` item 30).
4. The root metadata already sets a title and description. Public pages set their own title and
   description. Protected pages set `robots: noindex`.
5. `app/sitemap.ts` lists the sign-in and register pages only. `app/robots.ts` allows those two
   and disallows everything else. A public landing page is a separate slice; when it exists, it
   joins the sitemap and robots allow-list in that slice.
6. Analytics is inert in local development and in preview deployments unless enabled explicitly.
   The page code does not depend on it for any behaviour. "Enabled" means `VERCEL_ENV` is
   `production`, or `COLLEGA_ANALYTICS=on` is set on the web project.

## Events

| Event | Fired when | Properties |
|---|---|---|
| `idea.created` | An idea is saved as new | none |
| `idea.assist.used` | The idea assistant turn is sent | none |
| `board.viewed` | A board page loads | none |
| `view-as.started` | Act as another user is started | none |

No properties carry identifiers. Counts and page paths answer the questions this is for.

## Decisions

- **Consent.** No banner. Vercel Analytics sets no cookies, and the events carry no personal
  data. Recorded in `SPEC/decisions.md`.
- **Plan.** The team is on Vercel Pro or higher, so custom events are included.
- **Public pages.** Sign-in and register are the public pages for now. A landing page is a
  separate slice with its own design comp.

## Out of scope

- Search-console verification, backlinks, and keyword work.
- Session replay and per-user profiling.
- Any analytics provider other than Vercel's.

## Done when

- The root layout mounts Vercel Analytics, and page views appear for a production deployment.
- Each event in the table is recorded once in a browser test, and none carries a listed
  forbidden value.
- The sitemap and robots responses match requirement 5, checked in the browser.
- The consent decision is recorded in `SPEC/decisions.md`.
