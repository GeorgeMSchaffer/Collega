// The `board-references` demo seed module (slice 304) and the scenario validator it runs first.
// DB-free: the module is driven against a recording stand-in for the Prisma client under a fixed
// system clock, so what it would write is compared as data. The live-database re-run is the
// concern of seed-rerun.integration.test.ts; here the properties that make a re-run safe are
// asserted on the writes themselves: ids derived from names, no random ids, inserts that skip
// duplicates, upserts that update nothing, guarded backfills.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boardReferencesSeed } from '../src/demo-seed/modules/board-references.js'
import {
  type DemoReferenceScenario,
  REFERENCE_SCENARIOS,
  SPRINT_STATES,
  validateReferenceScenario,
} from '../src/demo-seed/modules/references-scenario.js'
import { DEMO_ORGANIZATIONS, seedId } from '../src/demo-seed/modules/scenario.js'
import type { PrismaClient } from '../src/generated/prisma/index.js'

type Call = { model: string; method: string; args: Record<string, any> }

/** Records every `prisma.<model>.<method>(args)`; `tags.findMany` answers the org's own tags. */
function recordingPrisma() {
  const calls: Call[] = []
  const tagsOf = (organizationId: string) => {
    const org = DEMO_ORGANIZATIONS.find((o) => seedId('organization', o.slug) === organizationId)
    return (org?.boards ?? [])
      .flatMap((board) => board.tagNames)
      .map((name) => ({ id: `tag:${name}`, normalized_name: name.toLowerCase() }))
  }
  const prisma = new Proxy(
    {},
    {
      get: (_, model: string) =>
        new Proxy(
          {},
          {
            get:
              (__, method: string) =>
              async (args: Record<string, any> = {}) => {
                calls.push({ model, method, args })
                if (model === 'tags' && method === 'findMany') {
                  return tagsOf(args.where.organization_id)
                }
                return undefined
              },
          },
        ),
    },
  ) as unknown as PrismaClient
  return { prisma, calls }
}

async function runSeed(at: string): Promise<Call[]> {
  vi.setSystemTime(new Date(at))
  const { prisma, calls } = recordingPrisma()
  await boardReferencesSeed.seed(prisma)
  return calls
}

const where = (calls: Call[], model: string, method: string) =>
  calls.filter((c) => c.model === model && c.method === method)

const TODAY = '2026-10-21T10:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('board-references seed: determinism and idempotence', () => {
  it('writes exactly the same rows when run twice on the same day', async () => {
    const first = await runSeed(TODAY)
    const second = await runSeed(TODAY)

    expect(first.length).toBeGreaterThan(0)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('keeps every row id when only the clock moves, so a re-run on another day finds the same rows', async () => {
    const ids = (calls: Call[]) =>
      [
        ...where(calls, 'ideas', 'createMany').flatMap((c) => c.args.data.map((r: any) => r.id)),
        ...where(calls, 'sprints', 'upsert').map((c) => c.args.where.id),
        ...where(calls, 'outcomes', 'upsert').map((c) => c.args.where.id),
        ...where(calls, 'boards', 'upsert').map((c) => c.args.where.id),
        ...where(calls, 'metric_types', 'upsert').map((c) => c.args.where.metric_type_id),
        ...where(calls, 'idea_dependencies', 'createMany').flatMap((c) =>
          c.args.data.map((r: any) => `${r.blocked_idea_id}>${r.blocker_idea_id}`),
        ),
      ].sort()

    const march = await runSeed('2026-03-02T00:00:00.000Z')
    const october = await runSeed('2026-10-21T00:00:00.000Z')

    expect(ids(october).length).toBeGreaterThan(100)
    expect(ids(october)).toEqual(ids(march))
  })

  it('has every insert skip rows that exist and every upsert leave an existing row as it is', async () => {
    const calls = await runSeed(TODAY)

    const inserts = calls.filter((c) => c.method === 'createMany')
    expect(inserts.length).toBeGreaterThan(0)
    for (const call of inserts) expect(call.args.skipDuplicates, call.model).toBe(true)
    for (const call of calls.filter((c) => c.method === 'upsert')) {
      expect(call.args.update, call.model).toEqual({})
    }
    expect(calls.filter((c) => c.method === 'create' || c.method === 'delete')).toEqual([])
  })

  it('backfills Effort and Outcome membership only where none is set, so a re-run keeps edits', async () => {
    const calls = await runSeed(TODAY)

    const efforts = where(calls, 'ideas', 'updateMany').filter((c) => 'effort' in c.args.data)
    expect(efforts.length).toBeGreaterThan(0)
    for (const call of efforts) expect(call.args.where.effort).toBeNull()
    const grouping = where(calls, 'ideas', 'updateMany').filter((c) => 'outcome_id' in c.args.data)
    expect(grouping.length).toBeGreaterThan(0)
    for (const call of grouping) expect(call.args.where.outcome_id).toBeNull()
  })
})

describe.each(REFERENCE_SCENARIOS.map((s) => [s.slug, s] as const))(
  'board-references seed content for %s',
  (slug, scenario) => {
    const organizationId = seedId('organization', slug)
    const forOrg = async () => {
      const calls = await runSeed(TODAY)
      const taskCall = where(calls, 'ideas', 'createMany').find(
        (c) => c.args.data[0]?.organization_id === organizationId,
      )
      const rows: any[] = taskCall?.args.data ?? []
      return { calls, rows }
    }

    it('creates one work board of 18 tasks under parents, plus 4 standalone cards, every row on it', async () => {
      const { calls, rows } = await forOrg()

      const board = where(calls, 'boards', 'upsert').find(
        (c) => c.args.create.organization_id === organizationId,
      )
      expect(board?.args.create.name).toBe(scenario.workBoard.name)
      expect(rows.filter((r) => r.parent_idea_id !== null)).toHaveLength(18)
      expect(rows.filter((r) => r.parent_idea_id === null)).toHaveLength(4)
      expect(new Set(rows.map((r) => r.board_id))).toEqual(new Set([board?.args.where.id]))
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    })

    it('spreads the tasks over all four work lanes', async () => {
      const { rows } = await forOrg()

      expect(new Set(rows.map((r) => r.status_id)).size).toBe(4)
    })

    it('sets Effort on every parent and on the other ideas it names', async () => {
      const { calls } = await forOrg()

      const orgIdeaIds = new Set(
        DEMO_ORGANIZATIONS.find((o) => o.slug === slug)?.boards.flatMap((board) =>
          (board.ideas ?? []).map((idea) => seedId('idea', slug, board.name, idea.title)),
        ),
      )
      const efforts = where(calls, 'ideas', 'updateMany').filter(
        (c) => 'effort' in c.args.data && orgIdeaIds.has(c.args.where.id),
      )
      expect(efforts).toHaveLength(
        scenario.parents.length + Object.keys(scenario.otherEfforts).length,
      )
      expect([...new Set(efforts.map((c) => c.args.data.effort))].sort()).toEqual([
        'High',
        'Low',
        'Medium',
      ])
    })

    it('flags exactly the system-made tasks auto_created, each titled as its parent with no assignee or tag', async () => {
      const { calls, rows } = await forOrg()

      const flagged = rows.filter((r) => r.auto_created)
      expect(flagged).toHaveLength(
        scenario.parents.flatMap((p) => p.tasks).filter((t) => t.auto).length,
      )
      expect(flagged.length).toBeGreaterThan(0)
      const oppsBoard = DEMO_ORGANIZATIONS.find((o) => o.slug === slug)?.boards[1]
      const autoParentTitles = scenario.parents
        .filter((p) => p.tasks.some((t) => t.auto))
        .map((p) => oppsBoard?.ideas?.[p.idea]?.title)
        .sort()
      expect(flagged.map((r) => r.title).sort()).toEqual(autoParentTitles)
      for (const row of flagged) expect(row.parent_idea_id).not.toBeNull()
      const flaggedIds = new Set(flagged.map((r) => r.id))
      const assignees = where(calls, 'idea_assignees', 'createMany').flatMap((c) => c.args.data)
      const tagLinks = where(calls, 'idea_tags', 'createMany').flatMap((c) => c.args.data)
      expect(assignees.some((a: any) => flaggedIds.has(a.idea_id))).toBe(false)
      expect(tagLinks.some((t: any) => flaggedIds.has(t.idea_id))).toBe(false)
      for (const row of rows.filter((r) => !flaggedIds.has(r.id))) {
        expect(row.auto_created).toBe(false)
      }
    })

    it('makes the reference lane auto-create and every lane it hands to final where it should be', async () => {
      const { calls } = await forOrg()

      const workBoardId = seedId('board', slug, scenario.workBoard.name)
      const lane = where(calls, 'board_swimlanes', 'updateMany').find(
        (c) => c.args.data.references_board_id === workBoardId,
      )
      expect(lane?.args.data.auto_create_task).toBe(true)
      const upserted = where(calls, 'board_swimlanes', 'upsert').filter(
        (c) => c.args.create.board_id === seedId('board', slug, scenario.workBoard.name),
      )
      expect(upserted.map((c) => c.args.create.is_final)).toEqual([false, false, false, true])
    })

    it('blocks tasks only by tasks on the same work board', async () => {
      const { calls, rows } = await forOrg()

      const ids = new Set(rows.map((r) => r.id))
      const edges = where(calls, 'idea_dependencies', 'createMany')
        .flatMap((c) => c.args.data)
        .filter((e: any) => ids.has(e.blocked_idea_id) || ids.has(e.blocker_idea_id))
      expect(edges.length).toBeGreaterThan(0)
      for (const edge of edges) {
        expect(ids.has(edge.blocked_idea_id)).toBe(true)
        expect(ids.has(edge.blocker_idea_id)).toBe(true)
        expect(edge.blocked_idea_id).not.toBe(edge.blocker_idea_id)
      }
    })

    it('writes five board sprints: two completed, one active, two planned, dated in order around today', async () => {
      const { calls } = await forOrg()

      const sprints = where(calls, 'sprints', 'upsert')
        .map((c) => c.args.create)
        .filter((s) => s.organization_id === organizationId)
      expect(sprints.map((s) => s.state)).toEqual([...SPRINT_STATES])
      expect(new Set(sprints.map((s) => s.board_id)).size).toBe(1)
      const now = new Date(TODAY).getTime()
      const [active] = sprints.filter((s) => s.state === 'Active')
      expect(active.start_date.getTime()).toBeLessThanOrEqual(now)
      expect(active.end_date.getTime()).toBeGreaterThanOrEqual(now)
      const starts = sprints.map((s) => s.start_date.getTime())
      expect(starts).toEqual([...starts].sort((a, b) => a - b))
    })

    it('writes six Outcomes whose windows include a past, a current and a future one', async () => {
      const { calls } = await forOrg()

      const outcomes = where(calls, 'outcomes', 'upsert')
        .map((c) => c.args.create)
        .filter((o) => o.organization_id === organizationId)
      expect(outcomes).toHaveLength(6)
      const now = new Date(TODAY)
      expect(outcomes.some((o) => o.target_end_date < now)).toBe(true)
      expect(outcomes.some((o) => o.target_start_date <= now && o.target_end_date >= now)).toBe(
        true,
      )
      expect(outcomes.some((o) => o.target_start_date > now)).toBe(true)
      expect(new Set(outcomes.map((o) => o.color)).size).toBe(6)
      expect(outcomes.map((o) => o.sort_order)).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('writes metric types and projected and realized values against them', async () => {
      const { calls } = await forOrg()

      const types = where(calls, 'metric_types', 'upsert').filter(
        (c) => c.args.create.organization_id === organizationId,
      )
      expect(types).toHaveLength(scenario.metricTypes.length)
      expect(types.length).toBeGreaterThan(0)
      const typeIds = new Set(types.map((c) => c.args.where.metric_type_id))
      const values = where(calls, 'idea_metric_values', 'createMany')
        .flatMap((c) => c.args.data)
        .filter((v: any) => typeIds.has(v.metric_type_id))
      expect(values).toHaveLength(scenario.metricValues.length)
      expect(values.some((v: any) => v.projected !== null)).toBe(true)
      expect(values.some((v: any) => v.realized !== null)).toBe(true)
    })
  },
)

describe('board-references seed scope', () => {
  it('touches only the three vertical organizations, never Acme or Blue Harbor', async () => {
    const calls = await runSeed(TODAY)

    expect(REFERENCE_SCENARIOS.map((s) => s.slug)).toEqual([
      'pinecone-labs',
      'brightline-creative',
      'meridian-holdings',
    ])
    const originals = ['acme-robotics', 'blue-harbor'].map((s) => seedId('organization', s))
    expect(JSON.stringify(calls)).not.toContain(originals[0])
    expect(JSON.stringify(calls)).not.toContain(originals[1])
    expect(where(calls, 'ideas', 'createMany')).toHaveLength(3)
  })

  it('runs after delivery, which promotes the ideas it adds around', () => {
    expect(boardReferencesSeed.name).toBe('board-references')
    expect(boardReferencesSeed.dependsOn).toContain('delivery')
  })
})

describe('validateReferenceScenario', () => {
  const clone = (scenario: DemoReferenceScenario): any => structuredClone(scenario)
  const pinecone = () => clone(REFERENCE_SCENARIOS[0] as DemoReferenceScenario)

  it.each(REFERENCE_SCENARIOS.map((s) => [s.slug, s] as const))(
    'accepts the shipped %s scenario',
    (_, scenario) => {
      expect(() => validateReferenceScenario(scenario)).not.toThrow()
    },
  )

  const firstHandWritten = (s: any) => {
    const all = [...s.parents.flatMap((p: any) => p.tasks), ...s.cards]
    return all.find((t: any) => !t.auto)
  }
  const doctorings: [string, (s: any) => void, RegExp][] = [
    ['fewer than five sprints', (s) => s.sprints.pop(), /exactly five sprints/],
    [
      'a repeated task key',
      (s) => {
        s.cards[1].key = s.cards[0].key
      },
      /used twice/,
    ],
    [
      'an auto-created task that carries a title',
      (s) => {
        s.parents[0].tasks[0].title = 'Hand written'
      },
      /auto-created task .* carries a title/,
    ],
    [
      'a hand-written task with no title',
      (s) => {
        delete firstHandWritten(s).title
      },
      /has no title/,
    ],
    [
      'a sprint that does not exist',
      (s) => {
        firstHandWritten(s).sprint = 6
      },
      /sprint 6, which does not exist/,
    ],
    [
      'a tag the organization lacks',
      (s) => {
        firstHandWritten(s).tag = 'no-such-tag'
      },
      /tag 'no-such-tag'/,
    ],
    [
      'a blocker that is not defined earlier',
      (s) => {
        firstHandWritten(s).blockedBy = ['nope']
      },
      /not defined earlier/,
    ],
    [
      'an unfinished task in a completed sprint',
      (s) => {
        const task = firstHandWritten(s)
        task.lane = 'doing'
        task.sprint = 1
        delete task.blockedBy
      },
      /unfinished in a completed sprint/,
    ],
    [
      'a parent past the lane with two open tasks',
      (s) => {
        const parent = s.parents.find((p: any) => !p.inLane)
        parent.tasks = [
          { key: 'x1', title: 'a', lane: 'todo' },
          { key: 'x2', title: 'b', lane: 'doing' },
        ]
      },
      /several open tasks/,
    ],
    [
      'a parent in the auto-create lane without its auto-created task',
      (s) => {
        const parent = s.parents.find((p: any) => p.inLane)
        parent.tasks[0] = { key: parent.tasks[0].key, title: 'by hand', lane: 'todo' }
      },
      /without its auto-created task/,
    ],
    [
      'a parent with an unknown Opportunities idea',
      (s) => {
        s.parents[0].idea = 99
      },
      /is not an Opportunities idea/,
    ],
    [
      'an auto-created card with no parent',
      (s) => {
        s.cards[0].auto = true
        delete s.cards[0].title
        delete s.cards[0].assignees
        delete s.cards[0].tag
      },
      /cannot be auto-created/,
    ],
    [
      'an Outcome that ends before it starts',
      (s) => {
        s.outcomes[0].startQuarter = 1
        s.outcomes[0].endQuarter = 0
      },
      /ends before it starts/,
    ],
    [
      'an Outcome grouping a task',
      (s) => {
        s.outcomes[0].items = [`card:${s.parents[0].tasks[0].key}`]
      },
      /not a top-level item/,
    ],
    [
      'an item under two Outcomes',
      (s) => {
        s.outcomes[0].items = ['ideas:0']
        s.outcomes[1].items = ['ideas:0']
      },
      /sits under two outcomes/,
    ],
    [
      'a metric value on an unknown metric type',
      (s) => {
        s.metricValues[0].metric = 'nope'
      },
      /unknown metric/,
    ],
    [
      'a metric value on a task',
      (s) => {
        s.metricValues[0].item = `card:${'missing'}`
      },
      /not a top-level item/,
    ],
    [
      'the same metric valued twice on one item',
      (s) => {
        s.metricValues.push({ ...s.metricValues[0] })
      },
      /valued twice/,
    ],
    [
      'a slug that is no vertical organization',
      (s) => {
        s.slug = 'acme-robotics'
      },
      /is not a vertical organization/,
    ],
  ]

  it.each(doctorings)('rejects a scenario with %s', (_, doctor, message) => {
    const scenario = pinecone()
    doctor(scenario)

    expect(() => validateReferenceScenario(scenario)).toThrow(message)
  })
})
