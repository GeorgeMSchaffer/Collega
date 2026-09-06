// Live-database regression test for the bug the C1 review caught: `PrismaTagRepository.getOrCreate`
// used to only ENQUEUE new tags through the unit-of-work buffer, so two calls for the same new
// normalized name within one request (e.g. `importBoardIdeas` looping over CSV rows, one
// `saveChanges()` after the loop) could not see each other's uncommitted create - both staged a
// `tags.create` for the same `(organization_id, normalized_name)`, and the batch `$transaction`
// rejected the whole import on `ux_tags_organization_id_normalized_name`.
//
// `getOrCreate` now owns its own commit and retries on a lost race (see tag.repository.ts's
// header). This test proves both halves of that fix against a REAL Postgres, not a mock: repeated
// calls for the same new name converge on one row, and genuinely concurrent calls do too.
//
// Skipped unless `DATABASE_URL` is set (this suite has no other live-database test - see
// `constraint-errors.test.ts` for why that is the norm here) - CI and most local runs have no
// Postgres reachable, and `pnpm test` must stay green without one. Run explicitly with:
//   DATABASE_URL=postgresql://collega:<password>@127.0.0.1:5432/Collega pnpm --filter @collega/infrastructure test -- tag-get-or-create

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaTagRepository } from '../src/repositories/tag.repository.js'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('PrismaTagRepository.getOrCreate against a live database', () => {
  const prisma = new PrismaClient()
  const tags = new PrismaTagRepository(prisma)
  let organizationId: string
  const createdTagIds = new Set<string>()

  beforeAll(async () => {
    const organization = await prisma.organizations.findFirst({ select: { id: true } })
    if (!organization) {
      throw new Error('Fixture requires at least one organizations row in the target database.')
    }
    organizationId = organization.id
  })

  afterAll(async () => {
    if (createdTagIds.size > 0) {
      await prisma.tags.deleteMany({ where: { id: { in: [...createdTagIds] } } })
    }
    await prisma.$disconnect()
  })

  it('converges repeated calls for the same new name onto one row (the importBoardIdeas loop shape)', async () => {
    const name = `probe-repeat-${randomUUID()}`

    // Mirrors the loop in `importBoardIdeas`: N calls, no commit of any kind between them - only
    // this port's own internal commit, per call.
    const first = await tags.getOrCreate({
      organizationId,
      requestedNames: [name],
      nowUtc: new Date(),
      actorUserId: null,
    })
    const second = await tags.getOrCreate({
      organizationId,
      requestedNames: [name],
      nowUtc: new Date(),
      actorUserId: null,
    })
    const third = await tags.getOrCreate({
      organizationId,
      requestedNames: [name],
      nowUtc: new Date(),
      actorUserId: null,
    })

    for (const tag of [...first, ...second, ...third]) {
      createdTagIds.add(tag.id)
    }

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(third).toHaveLength(1)
    expect(second[0]?.id).toBe(first[0]?.id)
    expect(third[0]?.id).toBe(first[0]?.id)

    const rows = await prisma.tags.findMany({
      where: { organization_id: organizationId, normalized_name: name.toLowerCase() },
    })
    expect(rows).toHaveLength(1)
  })

  it('converges genuinely concurrent calls for the same new name onto one row', async () => {
    const name = `probe-concurrent-${randomUUID()}`
    const input = {
      organizationId,
      requestedNames: [name],
      nowUtc: new Date(),
      actorUserId: null,
    }

    // Fired together, not awaited one at a time - this is the actual unique-index race, not just
    // the read-your-own-write gap the previous test covers.
    const results = await Promise.all([
      tags.getOrCreate(input),
      tags.getOrCreate(input),
      tags.getOrCreate(input),
    ])

    for (const result of results) {
      for (const tag of result) {
        createdTagIds.add(tag.id)
      }
    }

    const ids = new Set(results.map((r) => r[0]?.id))
    expect(ids.size).toBe(1)

    const rows = await prisma.tags.findMany({
      where: { organization_id: organizationId, normalized_name: name.toLowerCase() },
    })
    expect(rows).toHaveLength(1)
  })
})
