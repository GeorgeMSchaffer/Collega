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

**A redeploy does not work. Corrected 2026-09-14, from the build log of two that did not.** This
file used to say "redeploy from Vercel" here, and that advice cannot succeed: the ignore step asks
what changed since `VERCEL_GIT_PREVIOUS_SHA`, and on a redeploy of a commit the previous SHA *is*
that commit — so the honest answer is "nothing affected" and the build stops. Twice, on
`collega-api` production, while a newly added `COLLEGA_ALLOW_DEMO_SEED` went on being invisible to
the running function:

```
Running "turbo query affected --base=$VERCEL_GIT_PREVIOUS_SHA --packages @collega/api --exit-code"
{ "affectedPackages": { "items": [], "length": 0 } }
The deployment was canceled because the Ignored Build Step command returned exit code 0.
```

**Ship a commit that touches the app instead.** For production that means moving `main` — a
promotion whose range includes a change under `apps/api` or `apps/web` gives the ignore step a real
answer. There is no dashboard button that substitutes for it, which is the part worth remembering:
the setting is applied instantly and reaches nothing until something rebuilds.

**The change does not have to be code, only a path.** `turbo query affected` is path-based, not
content-aware, so any file under the app's directory counts — a comment, a README, this file.
Demonstrated by the commit that added the paragraph above: it edited `SPEC/50-vercel-deployment.md`
and `apps/web/AGENTS.md`, nothing else, and `collega` built **READY** while `collega-api` cancelled.

So the lever for each project is a path, and they are not the same one:

| To rebuild | Touch something under |
|---|---|
| `collega` (web) | `apps/web/` — including its markdown |
| `collega-api` | `apps/api/` — its own markdown will do |

Editing a file under `apps/web/` will not rebuild the API, which is exactly the trap that left
`COLLEGA_ALLOW_DEMO_SEED` inert: the variable is read by `apps/api`, and every commit since it was
set had touched only the web app or `SPEC/`.

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
