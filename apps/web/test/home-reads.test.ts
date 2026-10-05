import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getOrganizationHome, getPlatformHome } from '@/lib/data/home'
import { actAs } from './support/acting-role'

/**
 * Home's two readers (slices 132 and 155, `lib/data/home.ts`, comp R `comp-r-home-dashboard.html`):
 * which requests each makes, how the answers become counts, tiles and lists, the running sprint,
 * and the Site Admin roll-up's per-organization fan-out. The API client is the boundary; every path it is asked
 * for is recorded and answered from a table.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

type Answer = unknown | ((url: URL) => unknown)
let answers: [RegExp, Answer][] = []
const requested = () => vi.mocked(apiGet).mock.calls.map(([, path]) => String(path))

function page(totalCount: number, items: unknown[] = []) {
  return { items, totalCount, page: 1, pageSize: 1 }
}

beforeEach(() => {
  answers = []
  vi.mocked(apiGet).mockReset()
  vi.mocked(apiGet).mockImplementation(async (_reader, path) => {
    const url = new URL(String(path), 'http://api.test')
    const hit = answers.find(([pattern]) => pattern.test(`${url.pathname}${url.search}`))
    if (!hit) throw new Error(`unanswered request ${path}`)
    const [, answer] = hit
    return typeof answer === 'function' ? answer(url) : answer
  })
})

const answer = (pattern: RegExp, value: Answer) => answers.unshift([pattern, value])

describe('getOrganizationHome', () => {
  function wireIdea(over: Record<string, unknown> = {}) {
    return {
      ideaId: 'i-1',
      boardId: 'b-live',
      title: 'Slow conveyor',
      priority: 'Critical',
      ideaTypeName: 'Problem',
      statusId: 's-new',
      statusName: 'New',
      createdAtUtc: '2026-09-01T10:00:00Z',
      upvoteCount: 3,
      hasUpvoted: false,
      ...over,
    }
  }

  function wireBoard(boardId: string, name: string, isArchived: boolean, ideaCount = 0) {
    return {
      boardId,
      name,
      isArchived,
      description: null,
      ideaCount,
      swimlaneCount: 0,
      createdAtUtc: '2026-08-01T00:00:00Z',
      createdBy: null,
      laneCounts: [],
      topTags: [],
      tagCount: 0,
      allowUserStatusUpdate: true,
      archivedAtUtc: null,
    }
  }

  function wireSprint(over: Record<string, unknown> = {}) {
    return {
      sprintId: 'sp-1',
      name: 'Sprint 14',
      goal: null,
      startDate: '2026-09-22',
      endDate: '2026-10-05',
      state: 'Active',
      issueCount: 3,
      doneCount: 1,
      ...over,
    }
  }

  function seed({
    attention = [wireIdea()] as unknown[],
    assigned = [wireIdea({ ideaId: 'i-2' })] as unknown[],
    voted = [wireIdea({ ideaId: 'i-3', upvoteCount: 9, hasUpvoted: true })] as unknown[],
    sprints = [] as unknown[],
  } = {}) {
    answer(/\/ideas/, (url: URL) => {
      const p = url.searchParams
      if (p.get('pageSize') === '5') {
        if (p.get('sortBy') === 'upvoteCount') return page(voted.length, voted)
        if (p.get('scope') === 'assigned') return page(7, assigned)
        return page(12, attention)
      }
      if (p.get('scope') === 'assigned' && p.get('priority') === 'Critical') return page(2)
      if (p.get('scope') === 'created') return page(5)
      if (p.get('phase') === 'Issues') return page(9)
      return page(41)
    })
    answer(/\/boards/, [
      wireBoard('b-live', 'Assembly', false, 30),
      wireBoard('b-old', 'Old plant', true, 17),
      wireBoard('b-two', 'Packing', false, 11),
    ])
    answer(/\/sprints/, sprints)
    answer(/\/statuses/, [
      { statusId: 's-new', name: 'New', color: '#111111' },
      { statusId: 's-done', name: 'Complete', color: '#222222' },
    ])
    answer(/\/delivery/, [{ ideaId: 'd1' }, { ideaId: 'd2' }, { ideaId: 'd3' }, { ideaId: 'd4' }])
  }

  it('answers empty, and asks the API nothing, for an App Admin who has no organization', async () => {
    actAs('SiteAdmin')
    expect(await getOrganizationHome()).toEqual({
      counts: { ideas: 0, boards: 0, issues: 0 },
      ideasHref: null,
      statuses: [],
      kpis: [],
      attention: { total: 0, rows: [], href: '/ideas' },
      assigned: { total: 0, rows: [], href: '/ideas' },
      topVoted: [],
      boards: [],
      sprint: null,
    })
    expect(requested()).toEqual([])
  })

  it('reads everything from the acting user’s own organization', async () => {
    seed()
    actAs('User')
    await getOrganizationHome()
    const org = (await import('@/lib/session')).currentUser().organizationId
    expect(org).toBeTruthy()
    for (const path of requested()) {
      expect(path.startsWith(`/organizations/${org}/`)).toBe(true)
    }
  })

  it('counts the live boards’ ideas and every Issue, each with the list that shows it', async () => {
    seed()
    actAs('OrgAdmin')
    const home = await getOrganizationHome()
    expect(home.counts.ideas).toBe(30 + 11)
    expect(home.ideasHref).toBe('/ideas?phase=Ideas&board=b-live&board=b-two')
    expect(home.counts.issues).toBe(9)
  })

  it('counts live boards only, but reads archived ones to name an attention row', async () => {
    seed({ attention: [wireIdea({ boardId: 'b-old' })] })
    actAs('OrgAdmin')
    const home = await getOrganizationHome()
    expect(home.counts.boards).toBe(2)
    expect(home.boards.map((board) => board.name)).toEqual(['Assembly', 'Packing'])
    expect(home.attention.rows[0]?.boardName).toBe('Old plant')
    expect(requested().some((path) => path.includes('includeArchived=true'))).toBe(true)
  })

  it('asks for the five oldest critical or high ideas still in Discovery', async () => {
    seed()
    actAs('OrgAdmin')
    await getOrganizationHome()
    const url = new URL(
      requested().find((path) => path.includes('pageSize=5') && path.includes('createdAt')) ?? '',
      'http://api.test',
    )
    expect(url.searchParams.get('phase')).toBe('Ideas')
    expect(url.searchParams.getAll('priority')).toEqual(['Critical', 'High'])
    expect(url.searchParams.get('sortBy')).toBe('createdAt')
    expect(url.searchParams.get('sortDirection')).toBe('asc')
  })

  it('gives Assigned to me, Critical & high and You created, in that order', async () => {
    seed()
    actAs('OrgAdmin')
    const { kpis } = await getOrganizationHome()
    expect(kpis.map((kpi) => [kpi.label, kpi.value, kpi.href])).toEqual([
      // b-old is archived, so every link names the two live boards.
      [
        'Assigned to me',
        7,
        '/ideas?scope=assigned&sort=priority&dir=desc&board=b-live&board=b-two',
      ],
      [
        'Critical & high',
        12,
        '/ideas?phase=Ideas&priority=Critical&priority=High&board=b-live&board=b-two',
      ],
      ['You created', 5, '/ideas?scope=created&board=b-live&board=b-two'],
    ])
  })

  it('details Assigned to me by its critical share, flagged only when there is one', async () => {
    seed()
    actAs('OrgAdmin')
    const assigned = (await getOrganizationHome()).kpis[0]
    expect(assigned?.detail).toBe('2 critical')
    expect(assigned?.detailAlert).toBe(true)
  })

  it('lists what is assigned highest priority first, in either phase', async () => {
    seed()
    actAs('User')
    const home = await getOrganizationHome()
    expect(home.assigned.total).toBe(7)
    expect(home.assigned.rows.map((row) => row.id)).toEqual(['i-2'])
    const url = new URL(
      requested().find((path) => path.includes('scope=assigned') && path.includes('pageSize=5')) ??
        '',
      'http://api.test',
    )
    expect(url.searchParams.get('sortBy')).toBe('priority')
    expect(url.searchParams.get('sortDirection')).toBe('desc')
    expect(url.searchParams.has('phase')).toBe(false)
  })

  it('lists the most upvoted Discovery ideas with the reader’s own vote', async () => {
    seed()
    actAs('User')
    const [row] = (await getOrganizationHome()).topVoted
    expect(row).toMatchObject({ id: 'i-3', upvotes: 9, hasUpvoted: true })
    const url = new URL(
      requested().find((path) => path.includes('sortBy=upvoteCount')) ?? '',
      'http://api.test',
    )
    expect(url.searchParams.get('phase')).toBe('Ideas')
    expect(url.searchParams.get('sortDirection')).toBe('desc')
  })

  it('has no current sprint, and reads no sprint issues, when none is Active', async () => {
    seed({ sprints: [wireSprint({ state: 'Planned' })] })
    actAs('User')
    expect((await getOrganizationHome()).sprint).toBeNull()
    expect(requested().some((path) => path.includes('sprintId='))).toBe(false)
  })

  it('shows the Active sprint ending first, with its issues by delivery status', async () => {
    seed({
      sprints: [
        wireSprint({ sprintId: 'late', name: 'Late', endDate: '2026-10-20' }),
        wireSprint({ sprintId: 'soon', name: 'Soon', endDate: '2026-10-05' }),
      ],
    })
    answer(/sprintId=soon/, [
      { ideaId: 'x', deliveryStatus: 'Development' },
      { ideaId: 'y', deliveryStatus: 'Development' },
      { ideaId: 'z', deliveryStatus: 'Complete' },
    ])
    actAs('User')
    const { sprint } = await getOrganizationHome()
    expect(sprint?.sprint.name).toBe('Soon')
    expect(sprint?.backlog).toBe(4)
    expect(sprint?.mix.map(({ status, count }) => [status.id, count])).toEqual([
      ['Pending', 0],
      ['Scoping', 0],
      ['Development', 2],
      ['Review', 0],
      ['Complete', 1],
    ])
  })

  it('maps an attention row, taking the status colour from the catalog', async () => {
    seed()
    actAs('OrgAdmin')
    const [row] = (await getOrganizationHome()).attention.rows
    expect(row).toEqual({
      id: 'i-1',
      title: 'Slow conveyor',
      boardName: 'Assembly',
      ideaType: 'Problem',
      status: { id: 's-new', name: 'New', color: '#111111' },
      priority: 'Critical',
      createdAtUtc: '2026-09-01T10:00:00Z',
      upvotes: 3,
      hasUpvoted: false,
    })
  })

  it('draws a deleted status in the neutral colour under its own name', async () => {
    seed({ attention: [wireIdea({ statusId: 's-gone', statusName: 'Retired' })] })
    actAs('OrgAdmin')
    const [row] = (await getOrganizationHome()).attention.rows
    expect(row?.status).toEqual({ id: 's-gone', name: 'Retired', color: 'var(--ink-faint)' })
  })

  it('leaves the board unnamed when it is not one of the organization’s boards', async () => {
    seed({ attention: [wireIdea({ boardId: 'b-unknown' })] })
    actAs('OrgAdmin')
    expect((await getOrganizationHome()).attention.rows[0]?.boardName).toBeNull()
  })

  it.each([
    ['Critical', 'Critical'],
    ['High', 'High'],
    ['Medium', 'Medium'],
    ['Low', 'Low'],
    ['Whatever', 'Low'],
  ])('reads a wire priority of %s as %s', async (wire, expected) => {
    seed({ attention: [wireIdea({ priority: wire })] })
    actAs('OrgAdmin')
    expect((await getOrganizationHome()).attention.rows[0]?.priority).toBe(expected)
  })

  it('returns the organization’s statuses in the catalog’s order for the first-run strip', async () => {
    seed()
    actAs('OrgAdmin')
    expect((await getOrganizationHome()).statuses.map((status) => status.name)).toEqual([
      'New',
      'Complete',
    ])
  })

  it('fails the whole page when any one request fails', async () => {
    seed()
    answer(/\/delivery/, () => {
      throw new Error('delivery is down')
    })
    actAs('OrgAdmin')
    await expect(getOrganizationHome()).rejects.toThrow('delivery is down')
  })
})

describe('getPlatformHome', () => {
  type Org = { organizationId: string; title: string }
  const ORGS: Org[] = [
    { organizationId: 'o-acme', title: 'Acme' },
    { organizationId: 'o-bolt', title: 'Bolt' },
  ]

  function seed({
    organizations = ORGS,
    withArchived = ORGS.length + 1,
    failFor = null as string | null,
  } = {}) {
    answer(/^\/organizations\?pageSize=/, page(organizations.length, organizations))
    answer(/^\/organizations\?isArchived=true/, page(withArchived))
    answer(/^\/organizations\/(.+?)\/(boards|ideas|delivery|users)/, (url: URL) => {
      const [, , id, kind] = url.pathname.split('/')
      if (id === failFor) throw new Error(`${id} failed`)
      const acme = id === 'o-acme'
      if (kind === 'boards') {
        const board = (boardId: string, name: string) => ({
          boardId,
          name,
          isArchived: false,
          ideaCount: name === 'Assembly' ? 10 : name === 'Packing' ? 3 : 1,
          swimlaneCount: 0,
          createdAtUtc: '2026-08-01T00:00:00Z',
          laneCounts: [],
          topTags: [],
        })
        return acme ? [board('b1', 'Assembly')] : [board('b2', 'Packing'), board('b3', 'Dock')]
      }
      if (kind === 'ideas') return page(acme ? 1 : 2)
      return url.searchParams.get('status') === 'Inactive' ? page(acme ? 1 : 2) : page(acme ? 6 : 9)
    })
  }

  beforeEach(() => actAs('SiteAdmin'))

  it('asks for the list of organizations once and fans out four reads per organization', async () => {
    seed()
    await getPlatformHome()
    const paths = requested()
    expect(paths.filter((p) => p.startsWith('/organizations?'))).toHaveLength(2)
    for (const id of ['o-acme', 'o-bolt']) {
      const mine = paths.filter((p) => p.startsWith(`/organizations/${id}/`))
      expect(mine).toHaveLength(4)
      expect(mine.filter((p) => p.includes('/boards'))).toHaveLength(1)
      expect(mine.filter((p) => p.includes('/ideas') && p.includes('phase=Issues'))).toHaveLength(1)
      expect(mine.filter((p) => p.includes('/users?pageSize=1'))).toHaveLength(1)
      expect(mine.filter((p) => p.includes('status=Inactive'))).toHaveLength(1)
    }
  })

  it('sums ideas and issues across organizations', async () => {
    seed()
    expect((await getPlatformHome()).counts).toEqual({
      organizations: 2,
      ideas: 14,
      issues: 3,
    })
  })

  it('lists each organization with its boards and figures, largest first by ideas', async () => {
    seed()
    const { organizations } = await getPlatformHome()
    expect(
      organizations.map((o) => [
        o.name,
        o.boards.map((b) => b.name),
        o.ideas,
        o.issues,
        o.users,
        o.inactive,
      ]),
    ).toEqual([
      ['Acme', ['Assembly'], 10, 1, 6, 1],
      ['Bolt', ['Packing', 'Dock'], 4, 2, 9, 2],
    ])
  })

  it('shows Organizations, Boards, Ideas and Users tiles', async () => {
    seed()
    const { kpis } = await getPlatformHome()
    expect(kpis.map((kpi) => [kpi.label, kpi.value, kpi.href])).toEqual([
      ['Organizations', 2, '/settings/organizations'],
      ['Boards', 3, null],
      ['Ideas', 14, null],
      ['Users', 15, '/settings/users'],
    ])
  })

  it('details each tile: archived, organizations, delivery issues, inactive', async () => {
    seed()
    const { kpis } = await getPlatformHome()
    expect(kpis.map((kpi) => kpi.detail)).toEqual([
      '1 archived',
      'across 2 organizations',
      'plus 3 delivery issues',
      '3 inactive',
    ])
  })

  it('uses the singular for a single organization', async () => {
    seed({ organizations: [ORGS[0] as Org], withArchived: 1 })
    const { kpis } = await getPlatformHome()
    expect(kpis[1]?.detail).toBe('across 1 organization')
    expect(kpis[0]?.detail).toBe('0 archived')
  })

  it('never reports a negative archived count', async () => {
    seed({ withArchived: 0 })
    expect((await getPlatformHome()).kpis[0]?.detail).toBe('0 archived')
  })

  it('has nothing to fan out to with no organizations', async () => {
    seed({ organizations: [], withArchived: 0 })
    const home = await getPlatformHome()
    expect(home.counts).toEqual({ organizations: 0, ideas: 0, issues: 0 })
    expect(home.organizations).toEqual([])
    expect(requested().filter((p) => p.startsWith('/organizations/'))).toEqual([])
  })

  it('fails the page when a single organization’s read fails', async () => {
    seed({ failFor: 'o-bolt' })
    await expect(getPlatformHome()).rejects.toThrow('o-bolt failed')
  })
})
