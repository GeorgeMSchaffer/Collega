// Structure and invariants of the demo scenario data (slices 168 and 169): the three vertical
// organizations, their accounts and ideas, and the custom fields / fieldsets / values 169 added.
// Pure data, no database: the fields module throws at seed time on most of these breaks, so a
// scenario that violates one would otherwise only fail on somebody's `db:seed`.

import { DEFAULT_IDEA_TYPES } from '@collega/application/organizations'
import { describe, expect, it } from 'vitest'
import { fieldsSeed } from '../src/demo-seed/modules/fields.js'
import {
  DEMO_ACCOUNTS,
  DEMO_ORGANIZATIONS,
  type DemoOrganizationScenario,
  IDEA_SCENARIOS,
  seedId,
} from '../src/demo-seed/modules/scenario.js'

const bySlug = (slug: string): DemoOrganizationScenario => {
  const found = DEMO_ORGANIZATIONS.find((o) => o.slug === slug)
  if (!found) throw new Error(`No demo organization '${slug}'.`)
  return found
}

const VERTICALS = ['pinecone-labs', 'brightline-creative', 'meridian-holdings'].map(bySlug)
const ORIGINALS = ['acme-robotics', 'blue-harbor'].map(bySlug)

describe('demo scenario organizations', () => {
  it('lists Acme and Blue Harbor first and the three verticals after, with distinct derived ids', () => {
    expect(DEMO_ORGANIZATIONS.map((o) => o.slug)).toEqual([
      'acme-robotics',
      'blue-harbor',
      'pinecone-labs',
      'brightline-creative',
      'meridian-holdings',
    ])
    expect(DEMO_ORGANIZATIONS.map((o) => o.title)).toEqual([
      'Acme Robotics',
      'Blue Harbor Logistics',
      'Pinecone Labs',
      'Brightline Creative',
      'Meridian Holdings',
    ])
    expect(new Set(DEMO_ORGANIZATIONS.map((o) => seedId('organization', o.slug))).size).toBe(5)
  })

  it('leaves Acme and Blue Harbor on the generic data: no vertical content, no fields, default accounts', () => {
    for (const org of ORIGINALS) {
      expect(org.fieldConfig).toBeUndefined()
      expect(org.accounts).toBeUndefined()
      expect(org.extraIdeaTypes).toBeUndefined()
      expect(org.sprintGoal).toBeUndefined()
      expect(org.boards).toHaveLength(2)
      for (const board of org.boards) {
        expect(board.ideas).toBeUndefined()
        expect(board.commentBodies).toBeUndefined()
        expect(board.checklists).toBeUndefined()
      }
    }
  })

  it('keeps the original organizations at 11 generic ideas per board, 44 in all', () => {
    expect(IDEA_SCENARIOS).toHaveLength(11)
    expect(ORIGINALS.reduce((n, o) => n + o.boards.length * IDEA_SCENARIOS.length, 0)).toBe(44)
  })
})

describe.each(VERTICALS.map((o) => [o.title, o] as const))('vertical organization %s', (_, org) => {
  it('has two boards of 11 hand-written ideas each, 22 in all, with distinct titles per board', () => {
    expect(org.boards).toHaveLength(2)
    let total = 0
    for (const board of org.boards) {
      const ideas = board.ideas ?? []
      expect(ideas).toHaveLength(IDEA_SCENARIOS.length)
      total += ideas.length
      for (const idea of ideas) {
        expect(idea.title.trim()).not.toBe('')
        expect(idea.problem.trim()).not.toBe('')
        expect(idea.impactRationale.trim()).not.toBe('')
        expect(idea.proposedSolutions.length).toBeGreaterThan(0)
      }
      // Idea ids derive from (slug, board, title): a repeated title would upsert onto one row.
      expect(new Set(ideas.map((i) => i.title)).size).toBe(ideas.length)
    }
    expect(total).toBe(22)
  })

  it('has one account per role plus a second User, with unique local parts matching the default set', () => {
    const accounts = org.accounts ?? []
    expect(accounts.map((a) => a.role).sort()).toEqual(['OrgAdmin', 'ReadOnly', 'User', 'User'])
    expect(new Set(accounts.map((a) => a.localPart)).size).toBe(accounts.length)
    // Authors, assignees and upvotes rotate over these local parts.
    expect(accounts.map((a) => a.localPart).sort()).toEqual(
      DEMO_ACCOUNTS.map((a) => a.localPart).sort(),
    )
  })

  it('has a sprint goal, three thread comments per board and two checklists on the first board', () => {
    expect(org.sprintGoal?.trim()).toBeTruthy()
    expect(new Set(org.boards.map((b) => b.name)).size).toBe(2)
    for (const board of org.boards) {
      expect(board.commentBodies).toHaveLength(3)
      expect(board.tagNames.length).toBeGreaterThan(0)
    }
    const checklists = org.boards[0]?.checklists
    expect(checklists).toHaveLength(2)
    for (const items of checklists ?? []) expect(items.length).toBeGreaterThan(0)
  })

  it('declares extra idea types that do not collide with a default one', () => {
    const names = [...DEFAULT_IDEA_TYPES.map((t) => t.name), ...(org.extraIdeaTypes ?? [])]
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length)
  })
})

describe.each(VERTICALS.map((o) => [o.title, o] as const))('fields seed data for %s', (_, org) => {
  const config = org.fieldConfig
  if (!config) throw new Error(`${org.title} has no fieldConfig.`)
  const fieldNames = config.fields.map((f) => f.name)
  const typeNames = [...DEFAULT_IDEA_TYPES.map((t) => t.name), ...(org.extraIdeaTypes ?? [])]
  const membersOf = (setName: string) =>
    config.fieldsets.find((s) => s.name === setName)?.fields ?? []

  it('defines 5 or 6 distinctly named fields and two distinctly named fieldsets', () => {
    expect(config.fields.length).toBeGreaterThanOrEqual(5)
    expect(config.fields.length).toBeLessThanOrEqual(6)
    // The database enforces uniqueness on the trimmed, lower-cased name.
    const normalized = fieldNames.map((n) => n.trim().toLowerCase())
    expect(new Set(normalized).size).toBe(normalized.length)
    expect(config.fieldsets).toHaveLength(2)
    expect(new Set(config.fieldsets.map((s) => s.name.trim().toLowerCase())).size).toBe(2)
  })

  it('gives option fields distinct options and no other field any', () => {
    for (const field of config.fields) {
      if (field.type === 'Dropdown' || field.type === 'MultiSelect') {
        expect(field.options?.length, field.name).toBeGreaterThan(0)
        expect(new Set(field.options).size, field.name).toBe(field.options?.length)
      } else {
        expect(field.options ?? [], field.name).toEqual([])
      }
    }
  })

  it('builds each fieldset only from defined fields, none twice, none empty', () => {
    for (const set of config.fieldsets) {
      expect(set.fields.length, set.name).toBeGreaterThan(0)
      expect(new Set(set.fields).size, set.name).toBe(set.fields.length)
      for (const member of set.fields) expect(fieldNames, set.name).toContain(member)
    }
  })

  it('attaches fieldsets and fields only to idea types the organization has, and uses every fieldset', () => {
    const setNames = config.fieldsets.map((s) => s.name)
    expect(config.typeFields.length).toBeGreaterThan(0)
    for (const entry of config.typeFields) {
      expect(typeNames).toContain(entry.ideaType)
      for (const name of entry.fieldsets) expect(setNames).toContain(name)
      for (const field of entry.fields) expect(fieldNames).toContain(field.name)
      expect(new Set(entry.fieldsets).size).toBe(entry.fieldsets.length)
    }
    expect(new Set(config.typeFields.map((t) => t.ideaType)).size).toBe(config.typeFields.length)
    const used = new Set(config.typeFields.flatMap((t) => t.fieldsets))
    for (const name of setNames) expect(used.has(name), name).toBe(true)
  })

  it('never lists a field directly on a type that already gets it through a fieldset', () => {
    for (const entry of config.typeFields) {
      const viaSets = new Set(entry.fieldsets.flatMap(membersOf))
      for (const direct of entry.fields) {
        expect(viaSets.has(direct.name), `${entry.ideaType}/${direct.name}`).toBe(false)
      }
    }
  })

  it('puts values only on ideas whose type offers the field, with a value the field type accepts', () => {
    const effective = new Map<string, Set<string>>()
    for (const entry of config.typeFields) {
      effective.set(
        entry.ideaType,
        new Set([...entry.fields.map((f) => f.name), ...entry.fieldsets.flatMap(membersOf)]),
      )
    }
    expect(config.fieldValues.length).toBeGreaterThan(0)
    const indexes = config.fieldValues.map((v) => v.ideaIndex)
    expect(new Set(indexes).size).toBe(indexes.length)

    for (const entry of config.fieldValues) {
      expect(org.boards[0]?.ideas?.[entry.ideaIndex], `idea ${entry.ideaIndex}`).toBeDefined()
      // The ideas module assigns types round-robin over the default types.
      const typeName = (
        DEFAULT_IDEA_TYPES[entry.ideaIndex % DEFAULT_IDEA_TYPES.length] as { name: string }
      ).name
      const offered = effective.get(typeName) ?? new Set(fieldNames)
      for (const [name, raw] of Object.entries(entry.values)) {
        const field = config.fields.find((f) => f.name === name)
        expect(field, name).toBeDefined()
        expect(offered.has(name), `${typeName} offers ${name}`).toBe(true)
        if (field?.options) {
          for (const label of typeof raw === 'string' ? [raw] : raw) {
            expect(field.options, name).toContain(label)
          }
        }
        if (field?.type !== 'MultiSelect') expect(typeof raw, name).toBe('string')
        if (field?.type === 'Number') expect(Number.isFinite(Number(raw)), name).toBe(true)
        if (field?.type === 'Boolean') expect(['true', 'false'], name).toContain(raw)
        if (field?.type === 'Date') expect(raw, name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        if (field?.type === 'Url') expect(raw, name).toMatch(/^https?:\/\//)
      }
    }
  })
})

describe('fields seed module', () => {
  it('runs after the organizations and ideas it writes onto', () => {
    expect(fieldsSeed.name).toBe('fields')
    expect(fieldsSeed.dependsOn).toEqual(
      expect.arrayContaining(['organizations', 'ideas-and-upvotes']),
    )
  })
})
