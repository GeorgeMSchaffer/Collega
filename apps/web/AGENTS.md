# Web client

Next.js App Router client. It reaches the API over HTTP and may import only
`@collega/design-system` from the workspace. The browser tier must not import application, domain
or infrastructure packages.

- Use the `@/…` alias only for `@/lib`, `@/components` and `@/app`.
- Screens call readers in `lib/data/`; readers call the API and their signatures are the screen
  contract. Read the reader header before adding one.
- Never invent screen data. If the API has no route, render the empty or unavailable state;
  fixtures stay under `test/` and are not imported by the app.
- Business rules belong in `packages/application`; client validation is for feedback, not
  authority. Use design-system primitives and semantic tokens rather than per-screen shadcn
  restyling or raw colors.
- Add `'use client'` only where interaction needs it. Keep server-only modules out of client
  import graphs; `next build` catches crossings that typechecking can miss.

Before changing the layout or interaction of a page, read the relevant UI guidance in
`packages/design-system/AGENTS.md` and canonical `SPEC/` files. For canceled deployments, ignore
steps, or environment-only changes, read `SPEC/50-vercel-deployment.md` §2: a clean ignore result
can cancel an unchanged redeploy, and web/API builds watch different package paths.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
