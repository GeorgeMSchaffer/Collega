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
