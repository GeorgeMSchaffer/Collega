// Only the authentication chokepoint may read identity directly.
//
// This is Sprint 6 Slice 0's manual audit turned into something that runs. The Biome
// override in biome.json stops the wrong *import*, but lint can be disabled inline and it
// cannot see a property read like `req.user`. This is the belt to that rule's braces.
//
// An EXACT-EQUALITY assertion, deliberately - not `not.toContain`. Adding a legitimate
// reader is then a one-line diff a reviewer sees, which is the behaviour we want.
//
// Runs on node:test with no dependencies, matching tools/golden and tools/boundaries. The
// tools/ packages deliberately carry no test framework: vitest's peer resolution left this
// package with a dangling symlink and `pnpm test` failing before a single assertion ran.
//
// SPEC/typescript-conversion-map/findings/07-nest-ambient-identity.md section 7.4

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..')

// `requestContextStorage\.` rather than `getStore\(\)`: run-as.ts calls .run(), not
// .getStore(), and an exact-equality assertion listing a file the regex cannot match would
// fail on its first run for the wrong reason.
const IDENTITY_READ =
  /\b(req|request)\.(user|claims|principal)\b|requestContextStorage\.|from ['"]next\/headers['"]|from ['"](jsonwebtoken|jose|@nestjs\/jwt)['"]/

/**
 * Every file permitted to read identity directly, including ones later waves create.
 *
 * Entries that do not exist yet are skipped rather than failing, so this list can be
 * written once and does not need editing as Wave C, D and E land - but the moment such a
 * file appears it is held to the list.
 *
 * request-context.ts is deliberately ABSENT: it declares `requestContextStorage` but never
 * reads it, so the regex cannot match it and listing it here would fail this test for the
 * wrong reason. Declaring the store is not reading identity.
 */
const ALLOWLIST = [
  'apps/api/src/auth/auth.guard.ts',
  'apps/api/src/common/request-context/als-current-user-context.ts',
  'apps/api/src/common/request-context/request-context.middleware.ts',
  'apps/api/src/common/request-context/run-as.ts',
  'apps/web/lib/server/current-user.ts',
  'packages/infrastructure/src/security/jwt-access-token.service.ts',
]

/**
 * Tracked and untracked .ts/.tsx under apps/ and packages/, excluding generated output and
 * tests.
 *
 * Test files are excluded deliberately. A unit test for the request-context module calls
 * `requestContextStorage` directly - that is white-box testing of the chokepoint itself, not
 * production code opting out of View As, and a test cannot leak identity to a user. Listing
 * them on the allowlist instead was the alternative, and it would need a new entry every time
 * a QA agent covers these four files.
 */
function sourceFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'apps', 'packages'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\.tsx?$/.test(line))
    .filter((line) => !line.includes('/generated/') && !line.includes('/dist/'))
    .filter((line) => !/(^|\/)test\//.test(line) && !/\.(test|spec)\.tsx?$/.test(line))
    .sort()
}

describe('identity chokepoint', () => {
  const offenders = sourceFiles().filter((file) =>
    IDENTITY_READ.test(readFileSync(resolve(REPO_ROOT, file), 'utf8')),
  )

  it('is read only by the files on the allowlist', () => {
    const expected = ALLOWLIST.filter((file) => existsSync(resolve(REPO_ROOT, file))).sort()
    assert.deepEqual(
      offenders,
      expected,
      'A file outside the authentication chokepoint reads identity directly. That silently ' +
        'opts it out of View As: while a session is live, CurrentUserContext reports the ' +
        'impersonated user, and a raw credential read reports the real administrator. If the ' +
        'file genuinely belongs here, add it to ALLOWLIST in this test - deliberately, in a ' +
        'diff a reviewer sees.',
    )
  })

  it('finds the chokepoint itself, so the regex has not silently stopped matching', () => {
    // Guards against the failure mode where a refactor makes IDENTITY_READ match nothing and
    // the assertion above passes with two empty arrays.
    assert.ok(offenders.length > 0, 'IDENTITY_READ matched nothing at all - the regex is stale.')
  })
})
