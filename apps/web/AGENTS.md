# apps/web

The Next.js client (App Router). **HTTP only** — it may import `@collega/design-system` and nothing
else from the workspace. An import of `@collega/application`, `@collega/domain` or
`@collega/infrastructure` is a lint error, and that is deliberate
(`SPEC/50-typescript-migration.md` §4.3): the browser tier reaches `apps/api` over the wire.

## Layout

| Path | Holds |
|---|---|
| `app/(auth)/`, `app/(desk)/` | The route groups — login/register/change-password, and the signed-in surfaces |
| `app/(desk)/design-system/` | The primitive gallery; check a design-system change here first |
| `app/globals.css` | Tailwind entry point only — the theme lives in `@collega/design-system` |
| `components/` | Screen components, grouped by surface |
| `lib/data/` | **The data seam** — every reader the screens call |
| `lib/api/` | `fetch` client, wire types, Problem Details handling |
| `lib/server/` | Server actions (`*-actions.ts`) |
| `lib/mock.ts` | Fixtures for the surfaces not yet pointed at the API |
| `test/` | Vitest |

Use the `@/…` alias (`@/lib`, `@/components`, `@/app`) rather than relative paths.

## Conventions

- **Screens call `lib/data/`, never `lib/api/` or `lib/mock.ts` directly.** Each reader there is
  either a real `fetch` or still a fixture, and the call site cannot tell — converting a reader
  replaces a body, never a signature. Read that file's header before adding one.
- **Fixtures live only in `lib/mock.ts`**, and mirror the demo seed exactly. No screen invents its
  own.
- **No business rules here.** Validation that decides an outcome belongs in
  `packages/application`; the client validates for feedback, not for authority.
- Build from `@collega/design-system` primitives; don't restyle shadcn per screen or reach for raw
  colours.
- `'use client'` only where interaction needs it. A client file that reaches a server-only module
  through a barrel typechecks and then fails `next build`, which is why the build is part of
  `pnpm check`.

## A deploy can be cancelled by the ignore step, and that is not a failure

`vercel.json`'s `ignoreCommand` asks Turbo whether `@collega/web` was affected since the previous
deployed SHA, and cancels the build when it was not. On a commit that touches only `SPEC/` or
another package, the deployment shows as **CANCELED** rather than skipped, which reads like
something broke.

**It reasons about source changes only, so it cannot see a reason to rebuild that leaves no diff.**
Changing an environment variable is the one that bites: Vercel bakes the value into a deployment, a
new value needs a new build, and the commit that would carry it usually changes nothing under
`apps/web`. This happened on 2026-09-12 — `COLLEGA_API_URL` was corrected, `main` was moved, and the
build that should have picked the value up cancelled itself while production carried on serving the
old one.

If a deploy must happen and the diff does not justify it, redeploy from Vercel — but redeploy **this**
project and its **latest** deployment. Redeploying `collega-api`, or an older commit, rebuilds
something nobody asked about and cancels for the same reason.

The exact behaviour, since `|| exit 1` reads backwards at a glance:

- Turbo **errors** — an empty `VERCEL_GIT_PREVIOUS_SHA`, which happens on a first deployment — exits
  non-zero, so `|| exit 1` fires and the build **runs**.
- Turbo **succeeds and reports nothing affected** exits 0, and the build is **cancelled**.

So it fails open on an error and closed on a clean answer. `apps/api` carries the same line and had
been erroring its way into building on every deployment, which looked like different behaviour and
was not.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
