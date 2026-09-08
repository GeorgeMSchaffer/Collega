// Asserts that the layer rules in SPEC/50-typescript-migration.md section 3 are actually
// enforced by biome.json, in both directions: illegal imports are reported and legal ones
// are not.
//
// This exists because the first version of the config used noRestrictedImports `paths`,
// which matches exact specifiers only. It blocked `@collega/application` and silently
// allowed `@collega/application/ideas` - and section 4.2 mandates subpath exports, so
// every real import would have evaded it. The config looked right and enforced nothing.
//
// Run: node --test "tools/boundaries/*.test.ts"

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Anchored to the repo root rather than cwd: turbo runs this task from tools/boundaries,
// and every layer path below is repo-relative.
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..')

const RULE = 'lint/style/noRestrictedImports'

/** Layer -> a directory inside it that biome.json's overrides match. */
const LAYER_DIR = {
  domain: 'packages/domain/src',
  application: 'packages/application/src',
  infrastructure: 'packages/infrastructure/src',
  'design-system': 'packages/design-system/src',
  api: 'apps/api/src',
  // apps/web is a Next app - app/, components/, lib/ - with no src/. lib/ is plain modules,
  // so a probe dir there is not mistaken for a route.
  web: 'apps/web/lib',
} as const

type Layer = keyof typeof LAYER_DIR

/** Who each layer may import. Everything absent is forbidden. */
const ALLOWED: Record<Layer, readonly Layer[]> = {
  domain: [],
  application: ['domain'],
  infrastructure: ['domain', 'application'],
  'design-system': [],
  api: ['domain', 'application', 'infrastructure'],
  web: ['design-system'],
}

const LAYERS = Object.keys(LAYER_DIR) as Layer[]

// An interrupted run leaves probe dirs behind inside a layer, where they then show up as
// lint errors and untracked files. Clear any before starting rather than only after.
//
// The probes must live inside the layer for biome.json's override globs to match, so they
// are transiently visible to anything else reading that directory. turbo has no ordering
// edge between this suite and @collega/domain:build, so every package tsconfig excludes
// **/.boundary-*/** - otherwise a tsc file enumeration landing in that window would pick up
// a probe and fail on an import it cannot resolve.
for (const dir of Object.values(LAYER_DIR)) {
  const full = join(REPO_ROOT, dir)
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('.boundary-')) {
      rmSync(join(full, entry.name), { recursive: true, force: true })
    }
  }
}

/** Lints a throwaway file in `dir` importing `specifier`; true when the boundary rule fired. */
function isBlocked(dir: string, specifier: string): boolean {
  const tmp = mkdtempSync(join(REPO_ROOT, dir, '.boundary-'))
  const file = join(tmp, 'probe.ts')
  writeFileSync(file, `import { layer } from '${specifier}'\nexport const probe = layer\n`)
  try {
    // --vcs-enabled=false is load-bearing: biome.json sets useIgnoreFile, and .gitignore
    // lists .boundary-*/ so leaked probe dirs never get committed. Without this flag biome
    // skips the probe file, reports nothing, and every "may not import" case reads that
    // silence as "not blocked" - the suite goes green while enforcing nothing.
    const out = execFileSync('npx', ['biome', 'check', '--vcs-enabled=false', file], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })
    return out.includes(RULE)
  } catch (error) {
    // biome exits non-zero when it reports anything, which is the interesting case.
    const e = error as { stdout?: string; stderr?: string }
    return `${e.stdout ?? ''}${e.stderr ?? ''}`.includes(RULE)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

for (const from of LAYERS) {
  for (const to of LAYERS) {
    if (from === to) continue

    const legal = ALLOWED[from].includes(to)
    // Subpath form specifically: the bare specifier was never the one that leaked.
    const specifier = `@collega/${to}/probe`

    test(`${from} ${legal ? 'may' : 'may not'} import ${specifier}`, () => {
      const blocked = isBlocked(LAYER_DIR[from], specifier)
      assert.equal(
        blocked,
        !legal,
        legal
          ? `${from} is allowed to import ${to}, but biome.json reports it. False positive.`
          : `${from} must not import ${to}, but biome.json allows ${specifier}. ` +
              `Check that the override for ${LAYER_DIR[from]} uses "patterns" with a "/*" ` +
              `glob rather than "paths".`,
      )
    })
  }
}
