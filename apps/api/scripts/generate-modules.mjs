#!/usr/bin/env node
// Regenerates apps/api/src/app.modules.generated.ts by scanning apps/api/src/*/*.module.ts.
//
// SPEC/50-typescript-migration.md section 4.2: without this, every one of Wave D's seven
// feature partitions would register its module in app.module.ts by hand, making it the single
// most contended file in the slice - seven agents editing the same import list and the same
// array literal at once. Instead, each feature creates ONLY its own
// apps/api/src/<feature>/<feature>.module.ts and runs this script (wired into `build` and
// `typecheck` via the package.json `pre*` hooks, so it also runs automatically); nobody edits
// this file or app.module.ts by hand.
//
// FOUNDATION_DIRS is the denylist, not an allowlist: `auth/auth.module.ts` and anything under
// `common/` are host wiring app.module.ts imports directly and unconditionally, not a feature
// D1-D7 turn on by adding a file - sweeping them into the generated barrel too would just be a
// second, redundant way to import the same two things.

import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(SCRIPT_DIR, '../src')
const OUTPUT_FILE = resolve(SRC_DIR, 'app.modules.generated.ts')
const FOUNDATION_DIRS = new Set(['auth', 'common'])

function findFeatureModules() {
  const entries = readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !FOUNDATION_DIRS.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  const modules = []
  for (const entry of entries) {
    const dir = join(SRC_DIR, entry.name)
    const moduleFile = readdirSync(dir).find(
      (file) => file.endsWith('.module.ts') && statSync(join(dir, file)).isFile(),
    )
    if (!moduleFile) continue

    const className = toPascalCase(moduleFile.replace(/\.module\.ts$/, '')) + 'Module'
    const specifier = `./${entry.name}/${moduleFile.replace(/\.ts$/, '.js')}`
    modules.push({ className, specifier })
  }
  return modules
}

function toPascalCase(kebab) {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function render(modules) {
  const imports = modules
    .map((m) => `import { ${m.className} } from '${m.specifier}'`)
    .join('\n')
  const list = modules.map((m) => `  ${m.className},`).join('\n')

  return `// GENERATED FILE - do not hand-edit. Run \`pnpm generate:modules\` (apps/api) to refresh;
// \`pnpm build\` and \`pnpm typecheck\` do this automatically via the package.json pre* hooks.
// Source: apps/api/scripts/generate-modules.mjs, scanning apps/api/src/*/*.module.ts.
${modules.length > 0 ? imports + '\n' : ''}
/** Every Wave D feature module discovered under apps/api/src/, in directory-name order. */
export const FEATURE_MODULES = [
${list}
] as const
`
}

const modules = findFeatureModules()
writeFileSync(OUTPUT_FILE, render(modules))
console.log(`generate-modules: wrote ${modules.length} feature module(s) to ${OUTPUT_FILE}`)
