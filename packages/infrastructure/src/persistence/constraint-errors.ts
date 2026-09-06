// Translates the three hand-written partial unique index violations (frozen schema, not visible
// to `prisma db pull`/`migrate diff` - see test/partial-indexes.test.ts) into the kernel's
// `ConflictError`, so a race that loses at the database surfaces as a 409 rather than an unhandled
// `PrismaClientKnownRequestError` bubbling up as a 500.
//
// DETECTION IS BY MODEL + COLUMN SET, NOT BY CONSTRAINT NAME. The original version of this file
// matched on the constraint name (`ux_ai_prompt_versions_active`, etc.) on the theory that Prisma
// falls back to the raw constraint name in `error.meta.target` for an index it never introspected
// (these three aren't declared in `schema.prisma` at all). That theory was never verified against
// a real database and was wrong: fired for real against a live Postgres (`docker exec
// collega-postgres ...`), Prisma resolves `meta.target` to the CONSTRAINT'S COLUMN LIST even for
// an index absent from the Prisma schema - e.g. `{ modelName: "ai_prompt_versions", target:
// ["is_active"] }` and `{ modelName: "impersonation_sessions", target: ["real_user_id"] }`. The
// constraint name appears NOWHERE in `meta` or in `error.message` (which reads "Unique constraint
// failed on the fields: (`is_active`)"). The original name-matching code therefore silently never
// matched anything - every one of these races would have reached the caller as a raw, untranslated
// error instead of a 409, and `partial-indexes.test.ts` (a static parse of the migration SQL) could
// never have caught that, because it asserts the indexes are in the migration, not that this file
// recognizes them at runtime. See `test/constraint-errors.test.ts`, which pins the exact shape
// above so a future Prisma upgrade that changes it fails loudly here instead of silently.
//
// Centralized here, in the one place every mutating write ultimately flows through
// (`PrismaUnitOfWork.saveChanges`), rather than duplicated in each repository's `add`/`update`.
//
// KNOWN DOWNSTREAM CONSEQUENCE, NOT A BUG: `ViewAsService.start` (packages/application/src/
// impersonation/view-as-service.ts) has its OWN redundant translation for
// `ux_impersonation_sessions_real_user_id_open`, written before this slice existed and matching
// on `error.message`/`.cause` containing the constraint name string. Since Prisma's real error
// text never contains that string either (see above), that check was never going to fire against
// a real Prisma error regardless of what this file does. It is harmless: this file's `ConflictError`
// reaches `ViewAsService` first, its own check simply falls through (message doesn't match), and
// its `catch` block's `throw error` re-throws the already-correct `ConflictError` unchanged - a
// 409 still reaches the caller, just via the fallback branch rather than the intended one, and
// with this file's message text rather than `ALREADY_VIEWING_AS`. No golden fixture pins the exact
// text for this race (it is not deterministically capturable), so this is not a regression against
// anything tested. Flagged here rather than fixed there - `packages/application/**` is out of this
// slice's globs.

import { ConflictError } from '@collega/application/common'
import { Prisma } from '../generated/prisma/index.js'

/** One hand-written partial unique index this file knows how to translate. */
type KnownConstraint = {
  readonly modelName: string
  /** The exact column set Postgres reports for this index, order-independent. */
  readonly columns: readonly string[]
  readonly message: string
}

const KNOWN_CONSTRAINTS: readonly KnownConstraint[] = [
  {
    modelName: 'field_definitions',
    columns: ['organization_id', 'normalized_name'],
    message: 'A field with this name already exists in this organization.',
  },
  {
    modelName: 'impersonation_sessions',
    columns: ['real_user_id'],
    message: 'This user already has an open View As session.',
  },
  {
    modelName: 'ai_prompt_versions',
    columns: ['is_active'],
    message: 'Another prompt version is already active.',
  },
]

function targetColumns(target: unknown): readonly string[] {
  if (Array.isArray(target)) {
    return target.filter((entry): entry is string => typeof entry === 'string')
  }
  if (typeof target === 'string') {
    return [target]
  }
  return []
}

function sameColumnSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const set = new Set(a)
  return b.every((column) => set.has(column))
}

/**
 * Returns the error to throw in place of `error`: a `ConflictError` when `error` is a P2002
 * violation of one of the three known partial unique indexes, otherwise `error` itself, unchanged
 * - every other persistence failure (including an ordinary, non-partial unique violation, such as
 * a duplicate tag name) is left for the caller to see as-is, not silently reclassified. The
 * original Prisma error is kept as `.cause` so a caller that wants the underlying detail still can.
 */
export function translateWriteError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return error
  }

  const modelName = error.meta?.modelName
  const columns = targetColumns(error.meta?.target)

  for (const constraint of KNOWN_CONSTRAINTS) {
    if (modelName === constraint.modelName && sameColumnSet(columns, constraint.columns)) {
      const conflictError = new ConflictError(constraint.message)
      conflictError.cause = error
      return conflictError
    }
  }

  return error
}
