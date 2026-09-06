import { describe, expect, it } from 'vitest'
import { order } from '../prisma/seed/compose.js'
import type { SeedModule } from '../prisma/seed/types.js'

const stub = (name: string, dependsOn?: string[]): SeedModule => ({
  name,
  ...(dependsOn ? { dependsOn } : {}),
  seed: async () => {},
})

const names = (modules: readonly SeedModule[]) => modules.map((m) => m.name)

describe('seed module ordering', () => {
  it('runs a dependency before the module that needs it', () => {
    const result = names(order([stub('ideas', ['boards']), stub('boards')]))
    expect(result.indexOf('boards')).toBeLessThan(result.indexOf('ideas'))
  })

  it('orders a chain transitively', () => {
    const result = names(
      order([stub('upvotes', ['ideas']), stub('ideas', ['boards']), stub('boards')]),
    )
    expect(result).toEqual(['boards', 'ideas', 'upvotes'])
  })

  it('is deterministic where dependencies leave a choice', () => {
    const modules = [stub('zebra'), stub('apple'), stub('mango')]
    expect(names(order(modules))).toEqual(names(order([...modules].reverse())))
  })

  it('names the missing module rather than failing later on a foreign key', () => {
    expect(() => order([stub('ideas', ['boards'])])).toThrow(/'ideas' depends on 'boards'/)
  })

  it('reports a cycle as a path', () => {
    expect(() => order([stub('a', ['b']), stub('b', ['a'])])).toThrow(/cycle: a -> b -> a/)
  })

  it('rejects two modules with the same name', () => {
    expect(() => order([stub('ideas'), stub('ideas')])).toThrow(/both named 'ideas'/)
  })

  it('accepts an empty set', () => {
    expect(order([])).toEqual([])
  })
})
