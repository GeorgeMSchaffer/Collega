import type { SeedModule } from './types.js'

/**
 * Orders modules so every module runs after everything it depends on.
 *
 * Throws rather than warning on an unknown dependency or a cycle: a seed that runs in the
 * wrong order fails later, somewhere else, as a foreign key violation that does not name
 * the module that caused it.
 */
export function order(modules: readonly SeedModule[]): SeedModule[] {
  const byName = new Map<string, SeedModule>()
  for (const module of modules) {
    if (byName.has(module.name)) {
      throw new Error(`Two seed modules are both named '${module.name}'.`)
    }
    byName.set(module.name, module)
  }

  const ordered: SeedModule[] = []
  const done = new Set<string>()
  const visiting = new Set<string>()

  function visit(name: string, from: readonly string[]): void {
    if (done.has(name)) return
    if (visiting.has(name)) {
      throw new Error(`Seed modules form a cycle: ${[...from, name].join(' -> ')}.`)
    }
    const module = byName.get(name)
    if (!module) {
      throw new Error(
        `Seed module '${from.at(-1)}' depends on '${name}', which does not exist. ` +
          `Known modules: ${[...byName.keys()].sort().join(', ')}.`,
      )
    }
    visiting.add(name)
    for (const dependency of module.dependsOn ?? []) {
      visit(dependency, [...from, name])
    }
    visiting.delete(name)
    done.add(name)
    ordered.push(module)
  }

  // Sorted so the run order is deterministic where dependencies leave a choice.
  for (const module of [...modules].sort((a, b) => a.name.localeCompare(b.name))) {
    visit(module.name, [])
  }
  return ordered
}
