// The demo seed, from the command line. Owned by Foundation (S0.2); feature slices contribute
// modules under src/demo-seed/modules and edit nothing here.
//
// The target is the standard demo seed the .NET stack produces, and Sprint 9's definition of done
// requires it to exist in the new stack: 2 organizations, 10 users, 4 boards, 44 ideas. Ten users
// is 2 orgs x 4 accounts - one Org Admin, two User, one Read Only - plus the configured Site Admin
// and the Development-only convenience Site Admin.
//
// **This file is a wrapper and nothing else.** The seed itself lives in
// `src/demo-seed/` so the API can run it for a Site Admin from the settings screen, which a
// deployed demo needs: production has a bootstrap administrator and nothing else, so until it is
// seeded there is no organization to open and nobody to view as. Command and button run the same
// code by construction rather than by agreement.
//
// Non-development environments must never run THIS. The button is gated separately and
// deliberately - see `apps/api/src/admin/demo-seed.controller.ts`.
//
// It imports the BUILT package rather than `src`, because `node` strips types here and a `.js`
// specifier into `src/demo-seed` resolves to nothing - there is no emitted file beside the source.
// So `dist/` must exist before this runs. Every caller already builds: `pnpm dev` through turbo,
// `e2e/global-setup.ts` before it migrates, and the package's own `typecheck`. Building again here
// was tried and reverted - on Windows it collides with the build that just ran, over the generated
// Prisma client's files.

import { resetDemoSeed, runDemoSeed } from '../../dist/demo-seed/index.js'
// The dist copy, matching what `runDemoSeed` is typed against - `src/generated` and
// `dist/generated` are two builds of the same client and their types are not interchangeable.
import { PrismaClient } from '../../dist/generated/prisma/client.js'
import { loadRepositoryEnv } from './repository-env.ts'

async function main(): Promise<void> {
  loadRepositoryEnv()

  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must never run against production.')
  }

  const reset = process.argv.includes('--reset')
  const prisma = new PrismaClient()
  try {
    if (reset) {
      const deleted = await resetDemoSeed(prisma)
      console.log(`reset: removed ${String(deleted)} rows the seed owned`)
    }
    for (const outcome of await runDemoSeed(prisma)) {
      console.log(`seeded ${outcome.module} (${String(outcome.milliseconds)}ms)`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
