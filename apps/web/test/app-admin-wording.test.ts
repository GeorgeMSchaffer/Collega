import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roleLabel } from '@/lib/roles'

/**
 * `SPEC/decisions.md` 2026-10-04: the role reads "App Admin" to people. "Site Admin" survives in
 * comments and in code identifiers (`SiteAdmin`), never in a string or JSX text the UI can show.
 */
const WEB_ROOT = `${process.cwd()}/` // vitest runs from the package directory
const SOURCE_DIRS = ['app', 'components', 'lib']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

/** Drops block comments and `//` line comments, which is where the old name is allowed to live. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n')
}

describe('the role’s name in the UI', () => {
  it('labels the Site Admin role "App Admin"', () => {
    expect(roleLabel('SiteAdmin')).toBe('App Admin')
  })

  it('appears nowhere as "Site Admin" in a string or JSX text under apps/web', () => {
    const offenders = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(WEB_ROOT, dir)))
      .filter((file) => withoutComments(readFileSync(file, 'utf8')).includes('Site Admin'))
      .map((file) => file.slice(WEB_ROOT.length))

    expect(offenders).toEqual([])
  })
})
