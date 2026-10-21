// DB-free pin of the View As candidate query (slice 141, order confirmed 2026-10-01): the live-DB
// test of the same order skips without DATABASE_URL, so this is what `pnpm check` actually runs.
// The repository is handed a fake Prisma client that records the query it is given.

import { describe, expect, it, vi } from 'vitest'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

type Query = { where: Record<string, unknown>; orderBy: unknown; take: number }

async function recordedQuery(organizationId: string | null = null, search: string | null = null) {
  const findMany = vi.fn().mockResolvedValue([])
  const repository = new PrismaUserRepository({ users: { findMany } } as never, {} as never)
  await repository.searchForImpersonation(organizationId, search)
  expect(findMany).toHaveBeenCalledTimes(1)
  return findMany.mock.calls[0]?.[0] as Query
}

describe('PrismaUserRepository.searchForImpersonation query', () => {
  it('orders by organization title, organization id, last name, first name, then email', async () => {
    const query = await recordedQuery()
    expect(query.orderBy).toEqual([
      { organizations: { title: 'asc' } },
      { organization_id: 'asc' },
      { last_name: 'asc' },
      { first_name: 'asc' },
      { email: 'asc' },
    ])
  })

  it('caps the list at 50 rows in the query, so the cap cuts whole trailing groups', async () => {
    expect((await recordedQuery()).take).toBe(50)
  })

  it('scopes to one organization when given, and to none when null', async () => {
    expect((await recordedQuery('org-1')).where).toMatchObject({ organization_id: 'org-1' })
    expect((await recordedQuery(null)).where).not.toHaveProperty('organization_id')
  })

  it('matches the search term case-insensitively on first name, last name and email', async () => {
    const { where } = await recordedQuery(null, 'ann')
    expect(where.OR).toEqual([
      { first_name: { contains: 'ann', mode: 'insensitive' } },
      { last_name: { contains: 'ann', mode: 'insensitive' } },
      { email: { contains: 'ann', mode: 'insensitive' } },
    ])
  })
})
