// The `tags.color` backfill in `20260928000000_add_tag_color` (SPEC/decisions.md 2026-09-28, the
// fourth S0.2 amendment; SPEC/20-feature-ideas-and-engagement.md Tags rule 10): every existing tag
// gets the palette colour at the first MD5 byte of its normalized name modulo 10, which is what the
// demo seed computes in `node:crypto` - so the two must agree on every name, non-ASCII included,
// and two databases holding the same names must end up with the same colours.
//
// The migration touches `tags.normalized_name` and adds `tags.color`, so each throwaway database
// holds only that much of `tags`. The file is sent through `prisma db execute`, as in
// `structured-fields-migration.integration.test.ts`. Skipped unless `DATABASE_URL` is set.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { TAG_COLOR_PALETTE } from '@collega/domain/tags'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedTagColor } from '../src/demo-seed/modules/ideas-and-upvotes.js'
import { PrismaClient } from '../src/generated/prisma/index.js'

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATION = fileURLToPath(
  new URL('../prisma/migrations/20260928000000_add_tag_color/migration.sql', import.meta.url),
)
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

/** Enough names that every palette index is reached, plus the awkward ones. */
const NAMES = [
  'backend',
  'ux',
  'café',
  'naïve ünïcode',
  '日本語タグ',
  'emoji 🚀',
  'a',
  'tag with  two spaces',
  ...Array.from({ length: 60 }, (_, i) => `generated tag ${i}`),
]

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  parsed.searchParams.delete('schema')
  return parsed.toString()
}

describe.skipIf(!DATABASE_URL)('Tag colour migration backfill', () => {
  const admin = new PrismaClient()
  const databases = [1, 2].map(
    () => `collega_tagcolor_probe_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
  )
  const colours: Map<string, string | null>[] = []

  /** Builds a pre-migration `tags`, in a different insertion order each time, and migrates it. */
  async function migrate(database: string, names: readonly string[]) {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE "${database}" ENCODING 'UTF8' TEMPLATE template0`,
    )
    const url = withDatabase(DATABASE_URL as string, database)
    const probe = new PrismaClient({ datasourceUrl: url })
    try {
      await probe.$executeRawUnsafe(
        'CREATE TABLE tags (id UUID PRIMARY KEY, normalized_name VARCHAR(100) NOT NULL)',
      )
      for (const name of names) {
        await probe.$executeRaw`INSERT INTO tags (id, normalized_name) VALUES (${randomUUID()}::uuid, ${name})`
      }
      execFileSync(
        process.execPath,
        [PRISMA_CLI, 'db', 'execute', '--url', url, '--file', MIGRATION],
        {
          stdio: 'pipe',
        },
      )
      const rows = await probe.$queryRaw<{ normalized_name: string; color: string | null }[]>`
        SELECT t.normalized_name, t.color FROM tags t`
      return new Map(rows.map((row) => [row.normalized_name, row.color]))
    } finally {
      await probe.$disconnect()
    }
  }

  beforeAll(async () => {
    colours.push(await migrate(databases[0] as string, NAMES))
    colours.push(await migrate(databases[1] as string, [...NAMES].reverse()))
  }, 120_000)

  afterAll(async () => {
    for (const database of databases) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    }
    await admin.$disconnect()
  })

  it('gives every tag a colour', () => {
    const [first] = colours
    expect(first?.size).toBe(NAMES.length)
    expect([...(first?.values() ?? [])].every((c) => c !== null)).toBe(true)
  })

  it('agrees with the seed on every name, non-ASCII included', () => {
    const [first] = colours
    const mismatches = NAMES.filter((name) => first?.get(name) !== seedTagColor(name))
    expect(mismatches).toEqual([])
  })

  it('draws only palette colours and reaches every one of them', () => {
    const used = new Set(colours[0]?.values())
    expect([...used].sort()).toEqual([...TAG_COLOR_PALETTE].sort())
  })

  it('is repeatable across databases', () => {
    expect(Object.fromEntries(colours[1] ?? [])).toEqual(Object.fromEntries(colours[0] ?? []))
  })

  it('leaves the column VARCHAR(7) NOT NULL', async () => {
    const probe = new PrismaClient({
      datasourceUrl: withDatabase(DATABASE_URL as string, databases[0] as string),
    })
    try {
      const columns = await probe.$queryRaw<
        { is_nullable: string; character_maximum_length: number }[]
      >`
        SELECT c.is_nullable, c.character_maximum_length
        FROM information_schema.columns c
        WHERE c.table_name = 'tags' AND c.column_name = 'color'`
      expect(columns).toEqual([{ is_nullable: 'NO', character_maximum_length: 7 }])
    } finally {
      await probe.$disconnect()
    }
  })
})
