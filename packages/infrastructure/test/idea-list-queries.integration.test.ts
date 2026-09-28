// Live-database test for the idea list SQL (SPEC/30-Contracts.md Idea Contracts, 2026-09-27): the
// repeatable filters (any-of within one parameter, AND across them), every `sortBy` with the
// mandated `createdAt, title, id` tie-break, the widened `search`, and paging. The SQL is raw and
// assembled from fragments, so only a real Postgres can say whether it means what it reads as.
//
// Skipped unless `DATABASE_URL` is set, like `board-card-aggregates.integration.test.ts`. It builds
// its own organization (users, statuses, boards, tags, a Text field, ideas, upvotes) so the
// organization list sees nothing else, and removes all of it afterwards. Run with:
//   DATABASE_URL=postgresql://collega:<password>@127.0.0.1:5432/<scratch db> pnpm --filter @collega/infrastructure test -- idea-list-queries

import { randomUUID } from 'node:crypto'
import type { IdeaListFilter, OrganizationIdeaListFilter } from '@collega/application/ideas'
import { Priority } from '@collega/domain/enums'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaUnitOfWork } from '../src/persistence/unit-of-work.js'
import { PrismaIdeaRepository } from '../src/repositories/idea.repository.js'

const DATABASE_URL = process.env.DATABASE_URL
const DAY = '2026-09-20'
const at = (hour: number) => new Date(`${DAY}T${String(hour).padStart(2, '0')}:00:00.000Z`)
const PRIORITY_RANK: Record<Priority, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 }

type Key = string | number | null

/** One fixture idea, with the value each sort reads, so the expected order can be derived. */
type Probe = {
  readonly key: string
  id: string
  readonly board: 'aspen' | 'birch'
  readonly title: string
  readonly created: Date
  readonly updated: Date
  readonly priority: Priority
  readonly status: 'queued' | 'building'
  readonly due: string | null
  readonly author: 'ann' | 'ben' | 'cara'
  readonly assignee: 'ann' | 'ben' | 'cara' | null
  readonly tags: readonly ('red' | 'blue' | 'green')[]
  readonly upvoters: readonly ('ann' | 'ben' | 'cara')[]
  readonly problem: string
  readonly deleted?: boolean
  readonly textValue?: string
}

const NAMES = { ann: 'Ann Young', ben: 'Ben Xu', cara: 'Cara Walsh' } as const
const STATUS_NAMES = { queued: 'Queued', building: 'Building' } as const
/** Lane order on both boards: Queued first, so lane order and name order disagree. */
const LANE_ORDER = { queued: 0, building: 1 } as const
const BOARD_NAMES = { aspen: 'Aspen', birch: 'Birch' } as const
const TAG_NAMES = { red: 'Red', blue: 'Blue', green: 'Green' } as const

const PROBES: Probe[] = [
  {
    key: 'delta',
    id: '',
    board: 'aspen',
    title: 'Delta',
    created: at(1),
    updated: at(16),
    priority: Priority.High,
    status: 'queued',
    due: '2026-11-02',
    author: 'ann',
    assignee: 'cara',
    tags: ['red'],
    upvoters: ['ben'],
    problem: 'Printer jams on floor two.',
  },
  {
    key: 'alpha',
    id: '',
    board: 'aspen',
    title: 'Alpha',
    created: at(2),
    updated: at(15),
    priority: Priority.Low,
    status: 'building',
    due: '2026-11-01',
    author: 'ben',
    assignee: 'ann',
    tags: ['red', 'blue'],
    upvoters: ['ann', 'ben', 'cara'],
    problem: 'Something is slow.',
  },
  {
    key: 'charlie',
    id: '',
    board: 'aspen',
    title: 'Charlie',
    created: at(3),
    updated: at(14),
    priority: Priority.Critical,
    status: 'queued',
    due: null,
    author: 'cara',
    assignee: null,
    tags: [],
    upvoters: [],
    problem: 'Something is slow.',
    textValue: 'Runs on the legacy mainframe',
  },
  {
    key: 'bravo',
    id: '',
    board: 'aspen',
    title: 'Bravo',
    created: at(4),
    updated: at(13),
    priority: Priority.Medium,
    status: 'building',
    due: '2026-11-03',
    author: 'ann',
    assignee: 'ben',
    tags: ['green'],
    upvoters: ['ann', 'cara'],
    problem: 'Something is slow.',
  },
  {
    key: 'ghost',
    id: '',
    board: 'aspen',
    title: 'Ghost',
    created: at(5),
    updated: at(5),
    priority: Priority.High,
    status: 'queued',
    due: null,
    author: 'ann',
    assignee: null,
    tags: ['red'],
    upvoters: [],
    problem: 'Printer jams on floor two.',
    deleted: true,
  },
  {
    key: 'echo',
    id: '',
    board: 'birch',
    title: 'Echo',
    created: at(5),
    updated: at(12),
    priority: Priority.High,
    status: 'building',
    due: null,
    author: 'ben',
    assignee: null,
    tags: ['red'],
    upvoters: [],
    problem: 'Something is slow.',
  },
  // Same instant and same title: only the id can order these two, and it must, the same way in
  // both directions.
  {
    key: 'twin-1',
    id: '',
    board: 'birch',
    title: 'Foxtrot',
    created: at(0),
    updated: at(0),
    priority: Priority.Low,
    status: 'queued',
    due: null,
    author: 'cara',
    assignee: null,
    tags: [],
    upvoters: [],
    problem: 'Something is slow.',
  },
  {
    key: 'twin-2',
    id: '',
    board: 'birch',
    title: 'Foxtrot',
    created: at(0),
    updated: at(0),
    priority: Priority.Low,
    status: 'queued',
    due: null,
    author: 'cara',
    assignee: null,
    tags: [],
    upvoters: [],
    problem: 'Something is slow.',
  },
]

const live = (probe: Probe) => !probe.deleted

/** Postgres's default: NULL sorts as larger than every value, so last ascending, first descending. */
function compareKeys(a: Key, b: Key): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

/** The order the contract promises: the key in the requested direction, then the tie-break, always ascending. */
function expectedOrder(
  probes: readonly Probe[],
  keyOf: (probe: Probe) => Key,
  direction: 'asc' | 'desc',
): string[] {
  return [...probes]
    .sort((a, b) => {
      const primary = compareKeys(keyOf(a), keyOf(b))
      if (primary !== 0) return direction === 'asc' ? primary : -primary
      return (
        compareKeys(a.created.getTime(), b.created.getTime()) ||
        compareKeys(a.title, b.title) ||
        compareKeys(a.id, b.id)
      )
    })
    .map((probe) => probe.key)
}

const firstTag = (probe: Probe): Key =>
  probe.tags.length === 0
    ? null
    : ([...probe.tags].map((tag) => tag.toLowerCase()).sort()[0] ?? null)

/** What each sort reads, shared by both lists. */
const COMMON_SORTS = {
  createdAt: (probe) => probe.created.getTime(),
  title: (probe) => probe.title,
  priority: (probe) => PRIORITY_RANK[probe.priority],
  upvoteCount: (probe) => probe.upvoters.length,
  assignedTo: (probe) => (probe.assignee ? NAMES[probe.assignee] : null),
  tags: firstTag,
} satisfies Record<string, (probe: Probe) => Key>

const BOARD_SORTS = {
  ...COMMON_SORTS,
  updatedAt: (probe) => probe.updated.getTime(),
  dueDate: (probe) => probe.due,
  status: (probe) => LANE_ORDER[probe.status],
} satisfies Record<string, (probe: Probe) => Key>

const ORGANIZATION_SORTS = {
  ...COMMON_SORTS,
  createdBy: (probe) => NAMES[probe.author],
  status: (probe) => STATUS_NAMES[probe.status],
  board: (probe) => BOARD_NAMES[probe.board],
} satisfies Record<string, (probe: Probe) => Key>

describe.skipIf(!DATABASE_URL)('PrismaIdeaRepository list queries against a live database', () => {
  const prisma = new PrismaClient()
  const ideas = new PrismaIdeaRepository(prisma, new PrismaUnitOfWork(prisma))
  const marker = randomUUID()
  const organizationId = randomUUID()
  const boardIds = { aspen: randomUUID(), birch: randomUUID() }
  const statusIds = { queued: randomUUID(), building: randomUUID() }
  const userIds = { ann: randomUUID(), ben: randomUUID(), cara: randomUUID() }
  const tagIds = { red: randomUUID(), blue: randomUUID(), green: randomUUID() }
  const textFieldId = randomUUID()
  const ideaTypeId = randomUUID()
  const impactId = randomUUID()
  const byId = new Map<string, string>()

  const keysOf = (items: readonly { id: string }[]) =>
    items.map((item) => byId.get(item.id) ?? item.id)

  function boardFilter(overrides: Partial<IdeaListFilter> = {}): IdeaListFilter {
    return {
      boardId: boardIds.aspen,
      page: { page: 1, pageSize: 50 },
      search: null,
      searchTextFieldIds: [],
      searchCreatedOnDate: null,
      statusIds: [],
      tags: [],
      priorities: [],
      dueBefore: null,
      phase: 'Discovery',
      sortBy: null,
      sortDirection: 'asc',
      ...overrides,
    } as IdeaListFilter
  }

  function organizationFilter(
    overrides: Partial<OrganizationIdeaListFilter> = {},
  ): OrganizationIdeaListFilter {
    return {
      organizationId,
      createdByUserId: null,
      assignedToUserId: null,
      page: { page: 1, pageSize: 50 },
      search: null,
      sortBy: null,
      sortDirection: 'asc',
      fieldFilters: [],
      searchTextFieldIds: [],
      boardIds: [],
      statusIds: [],
      priorities: [],
      tags: [],
      associatedUserId: null,
      searchCreatedOnDate: null,
      phase: null,
      ...overrides,
    } as OrganizationIdeaListFilter
  }

  const onBoard = (board: Probe['board']) => PROBES.filter((p) => live(p) && p.board === board)
  const inOrganization = () => PROBES.filter(live)

  beforeAll(async () => {
    const stamps = { created_at_utc: at(0), updated_at_utc: at(0) }
    await prisma.organizations.create({
      data: {
        id: organizationId,
        title: `probe-org-${marker}`,
        description: 'Idea list query probe.',
        invite_code: `probe-${marker}`.slice(0, 50),
        is_archived: false,
        ...stamps,
      },
    })
    for (const [who, name] of Object.entries(NAMES)) {
      const [first = '', last = ''] = name.split(' ')
      const email = `probe-${who}-${marker}@example.test`
      await prisma.users.create({
        data: {
          id: userIds[who as keyof typeof userIds],
          organization_id: organizationId,
          first_name: first,
          last_name: last,
          email,
          normalized_email: email.toUpperCase(),
          password_hash: 'not-a-real-hash',
          role: 'User',
          status: 'Active',
          must_change_password: false,
          failed_login_count: 0,
          security_stamp: marker,
          ...stamps,
        },
      })
    }
    for (const [key, name] of Object.entries(STATUS_NAMES)) {
      await prisma.statuses.create({
        data: {
          id: statusIds[key as keyof typeof statusIds],
          organization_id: organizationId,
          name,
          color: '#123456',
          sort_order: LANE_ORDER[key as keyof typeof LANE_ORDER],
          is_deleted: false,
          ...stamps,
        },
      })
    }
    await prisma.idea_types.create({
      data: {
        id: ideaTypeId,
        organization_id: organizationId,
        name: 'Probe type',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.business_impacts.create({
      data: {
        id: impactId,
        organization_id: organizationId,
        name: 'Probe impact',
        color: '#123456',
        sort_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    await prisma.field_definitions.create({
      data: {
        id: textFieldId,
        organization_id: organizationId,
        name: 'Platform',
        normalized_name: 'platform',
        field_type: 'Text',
        is_required: false,
        display_order: 0,
        is_deleted: false,
        ...stamps,
      },
    })
    for (const [key, name] of Object.entries(BOARD_NAMES)) {
      await prisma.boards.create({
        data: {
          id: boardIds[key as keyof typeof boardIds],
          organization_id: organizationId,
          name,
          allow_user_status_update: true,
          ...stamps,
          board_swimlanes: {
            create: (['queued', 'building'] as const).map((status) => ({
              id: randomUUID(),
              status_id: statusIds[status],
              display_order: LANE_ORDER[status],
            })),
          },
        },
      })
    }
    for (const [key, name] of Object.entries(TAG_NAMES)) {
      await prisma.tags.create({
        data: {
          id: tagIds[key as keyof typeof tagIds],
          organization_id: organizationId,
          name,
          normalized_name: name.toLowerCase(),
          ...stamps,
        },
      })
    }
    for (const probe of PROBES) {
      probe.id = randomUUID()
      byId.set(probe.id, probe.key)
      await prisma.ideas.create({
        data: {
          id: probe.id,
          organization_id: organizationId,
          board_id: boardIds[probe.board],
          status_id: statusIds[probe.status],
          title: probe.title,
          description: null,
          problem: probe.problem,
          proposed_solutions: ['Probe solution.'],
          impact_rationale: 'Probe rationale.',
          priority: probe.priority,
          idea_type_id: ideaTypeId,
          business_impact_id: impactId,
          due_date: probe.due ? new Date(`${probe.due}T00:00:00.000Z`) : null,
          author_user_id: userIds[probe.author],
          is_deleted: probe.deleted ?? false,
          created_at_utc: probe.created,
          updated_at_utc: probe.updated,
          idea_tags: {
            create: probe.tags.map((tag) => ({ id: randomUUID(), tag_id: tagIds[tag] })),
          },
          idea_assignees: {
            create: probe.assignee ? [{ id: randomUUID(), user_id: userIds[probe.assignee] }] : [],
          },
          idea_upvotes: {
            create: probe.upvoters.map((who) => ({
              id: randomUUID(),
              user_id: userIds[who],
              created_at_utc: at(0),
            })),
          },
          idea_field_values: {
            create: probe.textValue
              ? [
                  {
                    id: randomUUID(),
                    field_definition_id: textFieldId,
                    value: probe.textValue,
                    ...stamps,
                  },
                ]
              : [],
          },
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.ideas.deleteMany({ where: { organization_id: organizationId } })
    await prisma.boards.deleteMany({ where: { organization_id: organizationId } })
    await prisma.tags.deleteMany({ where: { organization_id: organizationId } })
    await prisma.field_definitions.deleteMany({ where: { organization_id: organizationId } })
    await prisma.idea_types.deleteMany({ where: { organization_id: organizationId } })
    await prisma.business_impacts.deleteMany({ where: { organization_id: organizationId } })
    await prisma.statuses.deleteMany({ where: { organization_id: organizationId } })
    await prisma.users.deleteMany({ where: { organization_id: organizationId } })
    await prisma.organizations.deleteMany({ where: { id: organizationId } })
    await prisma.$disconnect()
  })

  describe('repeatable filters', () => {
    it('treats several values of one filter as any-of', async () => {
      const page = await ideas.listByBoard(
        boardFilter({ statusIds: [statusIds.queued, statusIds.building] }),
      )
      expect(keysOf(page.items)).toEqual(['delta', 'alpha', 'charlie', 'bravo'])

      const priorities = await ideas.listByBoard(
        boardFilter({ priorities: [Priority.High, Priority.Low] }),
      )
      expect(keysOf(priorities.items)).toEqual(['delta', 'alpha'])

      const tags = await ideas.listByBoard(boardFilter({ tags: ['red', 'green'] }))
      expect(keysOf(tags.items)).toEqual(['delta', 'alpha', 'bravo'])
    })

    it('ANDs different filters together', async () => {
      const statusAndPriority = await ideas.listByBoard(
        boardFilter({ statusIds: [statusIds.queued], priorities: [Priority.High] }),
      )
      expect(keysOf(statusAndPriority.items)).toEqual(['delta'])

      const tagAndPriority = await ideas.listByBoard(
        boardFilter({ tags: ['red'], priorities: [Priority.Low] }),
      )
      expect(keysOf(tagAndPriority.items)).toEqual(['alpha'])
    })

    it('never lists a soft-deleted idea, whatever the filter matches', async () => {
      const page = await ideas.listByBoard(boardFilter({ tags: ['red'] }))
      expect(keysOf(page.items)).not.toContain('ghost')
      expect(page.totalCount).toBe(2)
    })

    it('filters the organization list by board, and ANDs that with the rest', async () => {
      const birch = await ideas.listByOrganization(
        organizationFilter({ boardIds: [boardIds.birch] }),
      )
      expect(keysOf(birch.items).sort()).toEqual(['echo', 'twin-1', 'twin-2'])

      const buildingOnBoth = await ideas.listByOrganization(
        organizationFilter({
          boardIds: [boardIds.aspen, boardIds.birch],
          statusIds: [statusIds.building],
        }),
      )
      expect(keysOf(buildingOnBoth.items)).toEqual(['alpha', 'bravo', 'echo'])

      const narrow = await ideas.listByOrganization(
        organizationFilter({
          boardIds: [boardIds.aspen],
          tags: ['red'],
          priorities: [Priority.High],
        }),
      )
      expect(keysOf(narrow.items)).toEqual(['delta'])
    })

    it('matches nothing for an id that belongs to no row', async () => {
      const page = await ideas.listByOrganization(
        organizationFilter({ boardIds: ['00000000-0000-0000-0000-000000000000'] }),
      )
      expect(page.items).toEqual([])
      expect(page.totalCount).toBe(0)
    })
  })

  describe('sort order with the createdAt, title, id tie-break', () => {
    for (const [sortBy, keyOf] of Object.entries(BOARD_SORTS)) {
      for (const direction of ['asc', 'desc'] as const) {
        it(`orders a board's list by ${sortBy} ${direction}`, async () => {
          const page = await ideas.listByBoard(boardFilter({ sortBy, sortDirection: direction }))
          expect(keysOf(page.items)).toEqual(expectedOrder(onBoard('aspen'), keyOf, direction))
        })
      }
    }

    for (const [sortBy, keyOf] of Object.entries(ORGANIZATION_SORTS)) {
      for (const direction of ['asc', 'desc'] as const) {
        it(`orders the organization list by ${sortBy} ${direction}`, async () => {
          const page = await ideas.listByOrganization(
            organizationFilter({ sortBy, sortDirection: direction }),
          )
          expect(keysOf(page.items)).toEqual(expectedOrder(inOrganization(), keyOf, direction))
        })
      }
    }

    it('breaks a full tie on the id, ascending in both directions', async () => {
      const twins = PROBES.filter((p) => p.title === 'Foxtrot')
        .sort((a, b) => compareKeys(a.id, b.id))
        .map((p) => p.key)
      for (const direction of ['asc', 'desc'] as const) {
        const page = await ideas.listByOrganization(
          organizationFilter({
            boardIds: [boardIds.birch],
            sortBy: 'priority',
            sortDirection: direction,
          }),
        )
        const keys = keysOf(page.items).filter((key) => key.startsWith('twin'))
        expect(keys).toEqual(twins)
      }
    })

    it('reads sortBy case-insensitively and trimmed, and falls back to createdAt', async () => {
      const shouted = await ideas.listByBoard(boardFilter({ sortBy: ' PRIORITY ' }))
      expect(keysOf(shouted.items)).toEqual(
        expectedOrder(onBoard('aspen'), BOARD_SORTS.priority, 'asc'),
      )

      const unknown = await ideas.listByBoard(boardFilter({ sortBy: 'nonsense' }))
      expect(keysOf(unknown.items)).toEqual(['delta', 'alpha', 'charlie', 'bravo'])
    })
  })

  describe('search', () => {
    const searchBoard = async (search: string, overrides: Partial<IdeaListFilter> = {}) =>
      keysOf((await ideas.listByBoard(boardFilter({ search, ...overrides }))).items)
    const searchOrganization = async (
      search: string,
      overrides: Partial<OrganizationIdeaListFilter> = {},
    ) =>
      keysOf((await ideas.listByOrganization(organizationFilter({ search, ...overrides }))).items)

    it('matches title and Problem, case-insensitively', async () => {
      expect(await searchBoard('dELt')).toEqual(['delta'])
      expect(await searchBoard('printer JAMS')).toEqual(['delta'])
    })

    it('matches the author and assignee by first, last or full name', async () => {
      // Ben Xu wrote Alpha and is assigned Bravo.
      expect(await searchBoard('ben xu')).toEqual(['alpha', 'bravo'])
      // Cara Walsh wrote Charlie and is assigned Delta.
      expect(await searchBoard('walsh')).toEqual(['delta', 'charlie'])
    })

    it('matches status name, priority and tag name', async () => {
      expect(await searchBoard('buildi')).toEqual(['alpha', 'bravo'])
      expect(await searchBoard('critical')).toEqual(['charlie'])
      expect(await searchBoard('gree')).toEqual(['bravo'])
    })

    it('matches a Text field value only when that field is named as searchable', async () => {
      expect(await searchBoard('mainframe')).toEqual([])
      expect(await searchBoard('mainframe', { searchTextFieldIds: [textFieldId] })).toEqual([
        'charlie',
      ])
    })

    it('matches ideas created on the day an ISO date names', async () => {
      expect(await searchBoard(DAY, { searchCreatedOnDate: DAY })).toEqual([
        'delta',
        'alpha',
        'charlie',
        'bravo',
      ])
      expect(await searchBoard('2026-09-21', { searchCreatedOnDate: '2026-09-21' })).toEqual([])
    })

    it('matches the board name on the organization list only', async () => {
      expect(await searchOrganization('birch')).toEqual(
        expectedOrder(onBoard('birch'), COMMON_SORTS.createdAt, 'asc'),
      )
      expect(await searchBoard('aspen')).toEqual([])
    })

    it.each([["'; DROP TABLE ideas; --"], ["%' OR 1=1 --"], ["' OR '1'='1"], ['") OR TRUE; --']])(
      'treats %s as text: no rows, and nothing harmed',
      async (search) => {
        expect(await searchBoard(search)).toEqual([])
        expect(await searchOrganization(search)).toEqual([])

        const survivors = await prisma.ideas.count({ where: { organization_id: organizationId } })
        expect(survivors).toBe(PROBES.length)
      },
    )
  })

  describe('paging', () => {
    it('pages the ordered list and reports the total before paging', async () => {
      const second = await ideas.listByBoard(boardFilter({ page: { page: 2, pageSize: 2 } }))

      expect(keysOf(second.items)).toEqual(['charlie', 'bravo'])
      expect(second).toMatchObject({ page: 2, pageSize: 2, totalCount: 4 })
    })

    it('returns an empty page past the end with the true total', async () => {
      const beyond = await ideas.listByBoard(boardFilter({ page: { page: 3, pageSize: 2 } }))

      expect(beyond.items).toEqual([])
      expect(beyond.totalCount).toBe(4)
    })

    it('counts filtered totals, not the page length', async () => {
      const page = await ideas.listByOrganization(
        organizationFilter({ statusIds: [statusIds.queued], page: { page: 1, pageSize: 1 } }),
      )
      expect(page.items).toHaveLength(1)
      expect(page.totalCount).toBe(4)
    })
  })
})
