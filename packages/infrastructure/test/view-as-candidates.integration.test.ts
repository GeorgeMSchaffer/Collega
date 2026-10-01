// Live-database test for the View As candidate list's order (SPEC/contracts/view-as.md: grouped by
// organization; slice 137, user-confirmed order 2026-10-01). The order is chosen in the query, not
// afterwards, so that the 50-row cap cuts whole trailing groups - which only a real Postgres can
// show. Asserted concretely, as tracker rule "list endpoints need a total order" requires:
// organization title, then organization id, then last name, first name, email.
//
// Skipped unless `DATABASE_URL` is set. It builds its own organizations and users, finds them again
// through the search term every one of their emails carries, and removes them afterwards.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaUserRepository } from '../src/repositories/user.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const CREATED = new Date('2026-09-20T09:00:00.000Z')

describe.skipIf(!DATABASE_URL)('View As candidate order against a live database', () => {
  const prisma = new PrismaClient()
  const marker = randomUUID().replaceAll('-', '')
  const stamps = { created_at_utc: CREATED, updated_at_utc: CREATED }
  const repository = new PrismaUserRepository(prisma, new PrismaUnitOfWork(prisma))

  // Two organizations share a title, so only the id can order them; the ids are sorted so the
  // expectation does not depend on which uuid a run happened to draw.
  const [sameLow, sameHigh] = [randomUUID(), randomUUID()].sort() as [string, string]
  const orgs = {
    zulu: { id: randomUUID(), title: 'Zulu Works' },
    alpha: { id: randomUUID(), title: 'Alpha Works' },
    twinLow: { id: sameLow, title: 'Mike Works' },
    twinHigh: { id: sameHigh, title: 'Mike Works' },
    big: { id: randomUUID(), title: 'Yankee Works' },
  }
  // Every email carries the marker; only the small organizations' end in `@example.test`, so this
  // finds them without Yankee's fifty-five, which `all` adds.
  const small = `.${marker}@example.test`
  const all = `.${marker}@`
  const search = small

  type Seed = { org: keyof typeof orgs | null; first: string; last: string; tag: string }
  const seeds: Seed[] = [
    // Inserted out of order on purpose.
    { org: 'zulu', first: 'Ann', last: 'Adams', tag: 'z1' },
    { org: 'alpha', first: 'Zoe', last: 'Young', tag: 'a1' },
    { org: 'alpha', first: 'Bea', last: 'Young', tag: 'a2' },
    { org: 'alpha', first: 'Cal', last: 'Baker', tag: 'a3' },
    // Same last and first name: only the email can order these two.
    { org: 'alpha', first: 'Cal', last: 'Baker', tag: 'a0' },
    { org: 'twinHigh', first: 'Ann', last: 'Adams', tag: 'h1' },
    { org: 'twinLow', first: 'Ann', last: 'Adams', tag: 'l1' },
    { org: null, first: 'Sam', last: 'Siteadmin', tag: 'sa' },
  ]

  const emailFor = (tag: string, domain = 'example.test') => `${tag}.${marker}@${domain}`

  async function insert(seed: Seed, index: number, domain?: string) {
    const email = emailFor(seed.tag, domain)
    await prisma.users.create({
      data: {
        id: randomUUID(),
        organization_id: seed.org === null ? null : orgs[seed.org].id,
        first_name: seed.first,
        last_name: seed.last,
        email,
        normalized_email: email.toUpperCase(),
        password_hash: 'not-a-real-hash',
        role: seed.org === null ? 'SiteAdmin' : 'User',
        status: 'Active',
        must_change_password: false,
        failed_login_count: 0,
        security_stamp: marker,
        ...stamps,
        created_at_utc: new Date(CREATED.getTime() + index),
      },
    })
  }

  beforeAll(async () => {
    for (const [key, org] of Object.entries(orgs)) {
      await prisma.organizations.create({
        data: {
          id: org.id,
          title: org.title,
          description: `View As order probe ${key}.`,
          invite_code: `probe-${key}-${marker}`.slice(0, 50),
          is_archived: false,
          ...stamps,
        },
      })
    }
    for (const [index, seed] of seeds.entries()) await insert(seed, index)
    // Fifty-five more in one organization, to push the cap across a group boundary.
    for (let i = 0; i < 55; i++) {
      await insert(
        {
          org: 'big',
          first: 'Pat',
          last: `Lane${String(i).padStart(2, '0')}`,
          tag: `big${String(i).padStart(2, '0')}`,
        },
        100 + i,
        'big.example.test',
      )
    }
  })

  afterAll(async () => {
    const ids = Object.values(orgs).map((org) => org.id)
    await prisma.users.deleteMany({ where: { security_stamp: marker } })
    await prisma.organizations.deleteMany({ where: { id: { in: ids } } })
    await prisma.$disconnect()
  })

  const tagOf = (email: string) => email.split('.')[0]

  it('orders organizations by title, ties by id, then last name, first name and email', async () => {
    const found = await repository.searchForImpersonation(null, small)
    expect(found.map((user) => tagOf(user.email))).toEqual([
      // Alpha Works: Baker before Young; the two Cal Bakers by email; Young by first name.
      'a0',
      'a3',
      'a2',
      'a1',
      // Mike Works x2: the lower id first.
      'l1',
      'h1',
      // Zulu Works.
      'z1',
      // No organization: after every organization.
      'sa',
    ])
  })

  it('groups the candidates by organization, with no organization last', async () => {
    const found = await repository.searchForImpersonation(null, small)
    const order = [...new Set(found.map((user) => user.organizationId))]
    expect(order).toEqual([orgs.alpha.id, orgs.twinLow.id, orgs.twinHigh.id, orgs.zulu.id, null])
  })

  it('cuts the fifty-row cap in that order, dropping the trailing groups whole', async () => {
    const found = await repository.searchForImpersonation(null, all)
    expect(found).toHaveLength(50)
    // 4 Alpha + 2 Mike = 6 first, then 44 of Yankee's 55 in last-name order; Zulu and the account
    // with no organization fall off the end.
    const big = found.filter((user) => user.organizationId === orgs.big.id)
    expect(big.map((user) => user.lastName)).toEqual(
      Array.from({ length: 44 }, (_, i) => `Lane${String(i).padStart(2, '0')}`),
    )
    expect(found.some((user) => user.organizationId === orgs.zulu.id)).toBe(false)
    expect(found.some((user) => user.organizationId === null)).toBe(false)
  })

  it('scopes an organization-limited search to that organization, in last-name order', async () => {
    const found = await repository.searchForImpersonation(orgs.alpha.id, search)
    expect(found.map((user) => tagOf(user.email))).toEqual(['a0', 'a3', 'a2', 'a1'])
    expect(new Set(found.map((user) => user.organizationId))).toEqual(new Set([orgs.alpha.id]))
  })

  it('matches the search term in first name, last name or email, ignoring case', async () => {
    expect(
      (await repository.searchForImpersonation(null, `ZOE`)).filter((user) =>
        user.email.includes(marker),
      ),
    ).toHaveLength(1)
    expect(
      (await repository.searchForImpersonation(orgs.alpha.id, 'young')).map((u) => tagOf(u.email)),
    ).toEqual(['a2', 'a1'])
  })

  it('returns the same order on a second read', async () => {
    const first = await repository.searchForImpersonation(null, all)
    const second = await repository.searchForImpersonation(null, all)
    expect(second.map((user) => user.id)).toEqual(first.map((user) => user.id))
  })
})
