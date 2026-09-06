// Translates the three hand-written partial unique index violations (frozen schema, not visible
// to `prisma db pull`/`migrate diff` - see test/partial-indexes.test.ts) into the kernel's
// `ConflictError`, so a race that loses at the database surfaces as a 409 rather than an unhandled
// `PrismaClientKnownRequestError` bubbling up as a 500.
//
// Detection is by CONSTRAINT NAME, not by table/columns: Postgres reports a `unique_violation`
// (P2002) with the constraint name it rejected against, and Prisma cannot resolve that name to
// model fields for an index it never introspected (these three aren't in the Prisma schema at
// all - they exist only in the hand-maintained baseline migration SQL). That is precisely the
// case where Prisma's own docs say `error.meta.target` falls back to the raw constraint name
// instead of a field-name array, which is what this switches on.
//
// Centralized here, in the one place every mutating write ultimately flows through
// (`PrismaUnitOfWork.saveChanges`), rather than duplicated in each repository's `add`/`update`.

import { ConflictError } from '@collega/application/common'
import { Prisma } from '../generated/prisma/index.js'

/** Constraint name -> the message a caller sees when it fires. */
const CONSTRAINT_CONFLICTS: Readonly<Record<string, string>> = {
  ux_field_definitions_organization_id_normalized_name:
    'A field with this name already exists in this organization.',
  ux_impersonation_sessions_real_user_id_open: 'This user already has an open View As session.',
  ux_ai_prompt_versions_active: 'Another prompt version is already active.',
}

function targetContains(target: unknown, constraintName: string): boolean {
  if (typeof target === 'string') {
    return target.includes(constraintName)
  }
  if (Array.isArray(target)) {
    return target.some((entry) => typeof entry === 'string' && entry.includes(constraintName))
  }
  return false
}

/**
 * Returns the error to throw in place of `error`: a `ConflictError` when `error` is a P2002
 * violation of one of the three known partial unique indexes, otherwise `error` itself, unchanged
 * - every other persistence failure (including an ordinary, non-partial unique violation, such as
 * a duplicate tag name) is left for the caller to see as-is, not silently reclassified.
 */
export function translateWriteError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return error
  }

  const target = error.meta?.target
  for (const [constraintName, message] of Object.entries(CONSTRAINT_CONFLICTS)) {
    if (targetContains(target, constraintName)) {
      return new ConflictError(message)
    }
  }

  return error
}
