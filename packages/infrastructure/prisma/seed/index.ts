// Root demo seeder. Owned by Foundation (S0.2); feature slices contribute modules under
// ./modules and edit nothing here.
//
// The target is the standard demo seed the .NET stack produces, and Sprint 9's definition
// of done requires it to exist in the new stack: 2 organizations, 10 users, 4 boards,
// 44 ideas. Ten users is 2 orgs x 4 accounts - one Org Admin, two User, one Read Only -
// plus the configured Site Admin and the Development-only convenience Site Admin.
//
// Non-development environments must never run this. SPEC/40-test-strategy.md gates it.

import { PrismaClient } from '../../src/generated/prisma/client.js'
import { order } from './compose.ts'
import { boardsAndStatusesSeed } from './modules/boards-and-statuses.ts'
import { commentsSeed } from './modules/comments.ts'
import { deliverySeed } from './modules/delivery.ts'
import { ideasAndUpvotesSeed } from './modules/ideas-and-upvotes.ts'
import { organizationsSeed } from './modules/organizations.ts'
import { usersSeed } from './modules/users.ts'
import type { SeedModule } from './types.ts'

/**
 * Every module in the seed. Wave B-E slices add their own here, alongside the module file.
 * This list is the one line a feature slice edits, and it is a list of names rather than a
 * body of logic so two slices adding modules conflict trivially instead of badly.
 */
const MODULES: readonly SeedModule[] = [
  organizationsSeed, // B1
  usersSeed, // B1
  boardsAndStatusesSeed, // B2
  ideasAndUpvotesSeed, // B3
  commentsSeed, // B4
  deliverySeed, // Issues and Delivery
]

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must never run against production.')
  }

  const prisma = new PrismaClient()
  try {
    const modules = order(MODULES)
    if (modules.length === 0) {
      console.log('No seed modules registered yet - nothing to seed.')
      return
    }
    for (const module of modules) {
      const started = Date.now()
      await module.seed(prisma)
      console.log(`seeded ${module.name} (${Date.now() - started}ms)`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
