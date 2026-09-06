// Pins the ACTUAL shape a real Postgres/Prisma P2002 has for the three hand-written partial
// unique indexes, captured by triggering each one against a live `collega-postgres` container
// (`docker exec collega-postgres psql ...` to confirm the indexes exist, then real
// `prisma.<model>.create()` calls to force the violation and log `error.meta`/`error.message`).
//
// Two of the three were captured directly against the typed `.create()` API:
//   ai_prompt_versions:      { modelName: "ai_prompt_versions",      target: ["is_active"] }
//   impersonation_sessions:  { modelName: "impersonation_sessions",  target: ["real_user_id"] }
// The third (`field_definitions`) could not be captured the same way because this environment's
// database has not yet run the F3 enum-promotion migration (`field_type` is still a plain
// `integer` column, not the `FieldType` enum `schema.prisma` declares - a pre-existing DB/schema
// drift unrelated to this file). It WAS captured via `$executeRawUnsafe`, which surfaces a
// differently-shaped error (P2010, no `target`) but confirmed the underlying Postgres detail text
// is `Key (organization_id, normalized_name)=(...) already exists.` - the same "column list, never
// the constraint name" pattern the other two confirm directly, so the fixture below applies that
// pattern rather than a second live capture.
//
// This exists because `test/partial-indexes.test.ts` only proves the indexes are IN the migration
// SQL - it says nothing about whether this file's runtime detection recognizes a violation of them.
// The original version of this file matched on the constraint NAME, which never appears in a real
// Prisma error for these indexes; this test is what would have caught that before it shipped.

import { ConflictError } from '@collega/application/common'
import { describe, expect, it } from 'vitest'
import { Prisma } from '../src/generated/prisma/index.js'
import { translateWriteError } from '../src/persistence/constraint-errors.js'

function p2002(modelName: string, target: readonly string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { modelName, target: [...target] },
  })
}

describe('translateWriteError', () => {
  it('translates ai_prompt_versions.is_active (captured live: modelName + target as above)', () => {
    const result = translateWriteError(p2002('ai_prompt_versions', ['is_active']))
    expect(result).toBeInstanceOf(ConflictError)
    expect((result as ConflictError).message).toBe('Another prompt version is already active.')
  })

  it('translates impersonation_sessions.real_user_id (captured live: modelName + target as above)', () => {
    const result = translateWriteError(p2002('impersonation_sessions', ['real_user_id']))
    expect(result).toBeInstanceOf(ConflictError)
    expect((result as ConflictError).message).toBe('This user already has an open View As session.')
  })

  it('translates field_definitions.(organization_id, normalized_name), order-independent', () => {
    const result = translateWriteError(
      p2002('field_definitions', ['normalized_name', 'organization_id']),
    )
    expect(result).toBeInstanceOf(ConflictError)
    expect((result as ConflictError).message).toBe(
      'A field with this name already exists in this organization.',
    )
  })

  it('preserves the original Prisma error as .cause', () => {
    const original = p2002('ai_prompt_versions', ['is_active'])
    const result = translateWriteError(original) as ConflictError
    expect(result.cause).toBe(original)
  })

  it('does NOT translate a same-model P2002 on a different, unrelated column set', () => {
    // e.g. a hypothetical ordinary unique constraint on ai_prompt_versions.version - a real
    // column, but not one of the three known partial indexes.
    const error = p2002('ai_prompt_versions', ['version'])
    expect(translateWriteError(error)).toBe(error)
  })

  it('does NOT translate an ordinary (non-partial) unique violation, e.g. a duplicate tag name', () => {
    // ux_tags_organization_id_normalized_name is a real, ordinary unique index - deliberately not
    // one of the three this file translates (see the slice report).
    const error = p2002('tags', ['organization_id', 'normalized_name'])
    expect(translateWriteError(error)).toBe(error)
  })

  it('does NOT translate a P2002 with no meta at all', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
    })
    expect(translateWriteError(error)).toBe(error)
  })

  it('leaves a non-P2002 PrismaClientKnownRequestError untouched', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.19.3',
    })
    expect(translateWriteError(error)).toBe(error)
  })

  it('leaves a plain error untouched', () => {
    const error = new Error('boom')
    expect(translateWriteError(error)).toBe(error)
  })
})
