import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/lib/api/client'
import { getOrganizationHome, getPlatformHome } from '@/lib/data/home'
import { actAs } from './support/acting-role'

/**
 * Home's two readers (slice 132, `lib/data/home.ts`): which requests each makes, how the answers
 * become counts and tiles, the three tiles that deliberately say "not tracked yet", and the Site
 * Admin roll-up's per-organization fan-out. The API client is the boundary; every path it is asked
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
      ...over,
    }
  }

  function seed({ attention = [wireIdea()] as unknown[] } = {}) {
    answer(/\/ideas/, (url: URL) => {
      const p = url.searchParams
      if (p.get('pageSize') === '5') return page(attention.length, attention)
      if (p.get('scope') === 'assigned' && p.get('priority') === 'Critical') return page(2)
      if (p.get('scope') === 'assigned') return page(7)
      return page(41)
    })
    answer(/\/boards/, [
      { boardId: 'b-live', name: 'Assembly', isArchived: false },
      { boardId: 'b-old', name: 'Old plant', isArchived: true },
      { boardId: 'b-two', name: 'Packing', isArchived: false },
    ])
    answer(/\/statuses/, [
      { statusId: 's-new', name: 'New', color: '#111111' },
      { statusId: 's-done', name: 'Complete', color: '#222222' },
    ])
    answer(/\/delivery/, [{ ideaId: 'd1' }, { ideaId: 'd2' }, { ideaId: 'd3' }])
  }

  it('answers empty, and asks the API nothing, for a Site Admin who has no organization', async () => {
    actAs('SiteAdmin')
    expect(await getOrganizationHome()).toEqual({
      counts: { ideas: 0, boards: 0, issues: 0 },
      statuses: [],
      kpis: [],
      attention: [],
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

  it('counts Discovery ideas (not delivery issues) in the greeting, issues from the delivery list', async () => {
    seed()
    actAs('OrgAdmin')
    const home = await getOrganizationHome()
    expect(home.counts.ideas).toBe(41)
    expect(home.counts.issues).toBe(3)
    const discovery = requested().find(
      (path) => path.includes('phase=Ideas') && path.includes('pageSize=1'),
    )
    expect(discovery).toBeDefined()
  })

  it('counts live boards only, but reads archived ones to name an attention row', async () => {
    seed({ attention: [wireIdea({ boardId: 'b-old' })] })
    actAs('OrgAdmin')
    const home = await getOrganizationHome()
    expect(home.counts.boards).toBe(2)
    expect(home.attention[0]?.boardName).toBe('Old plant')
    expect(requested().some((path) => path.includes('includeArchived=true'))).toBe(true)
  })

  it('asks for the five oldest critical or high ideas still in Discovery', async () => {
    seed()
    actAs('OrgAdmin')
    await getOrganizationHome()
    const url = new URL(
      requested().find((path) => path.includes('pageSize=5')) ?? '',
      'http://api.test',
    )
    expect(url.searchParams.get('phase')).toBe('Ideas')
    expect(url.searchParams.getAll('priority')).toEqual(['Critical', 'High'])
    expect(url.searchParams.get('sortBy')).toBe('createdAt')
    expect(url.searchParams.get('sortDirection')).toBe('asc')
  })

  it('gives four tiles in order, three of them with no value and "Not tracked yet"', async () => {
    seed()
    actAs('OrgAdmin')
    const { kpis } = await getOrganizationHome()
    expect(kpis.map((kpi) => kpi.label)).toEqual([
      'Open ideas',
      'Awaiting review',
      'Assigned to me',
      'Completed · 30d',
    ])
    const untracked = kpis.filter((kpi) => kpi.value === null)
    expect(untracked.map((kpi) => kpi.label)).toEqual([
      'Open ideas',
      'Awaiting review',
      'Completed · 30d',
    ])
    for (const kpi of untracked) expect(kpi.detail).toBe('Not tracked yet')
  })

  it('fills Assigned to me from the assigned count and its critical share', async () => {
    seed()
    actAs('OrgAdmin')
    const { kpis } = await getOrganizationHome()
    const assigned = kpis.find((kpi) => kpi.label === 'Assigned to me')
    expect(assigned?.value).toBe(7)
    expect(assigned?.detail).toBe('2 critical')
  })

  it('maps an attention row, taking the status colour from the catalog', async () => {
    seed()
    actAs('OrgAdmin')
    const [row] = (await getOrganizationHome()).attention
    expect(row).toEqual({
      id: 'i-1',
      title: 'Slow conveyor',
      boardName: 'Assembly',
      ideaType: 'Problem',
      status: { id: 's-new', name: 'New', color: '#111111' },
      priority: 'Critical',
      createdAtUtc: '2026-09-01T10:00:00Z',
    })
  })

  it('draws a deleted status in the neutral colour under its own name', async () => {
    seed({ attention: [wireIdea({ statusId: 's-gone', statusName: 'Retired' })] })
    actAs('OrgAdmin')
    const [row] = (await getOrganizationHome()).attention
    expect(row?.status).toEqual({ id: 's-gone', name: 'Retired', color: 'var(--ink-faint)' })
  })

  it('leaves the board unnamed when it is not one of the organization’s boards', async () => {
    seed({ attention: [wireIdea({ boardId: 'b-unknown' })] })
    actAs('OrgAdmin')
    expect((await getOrganizationHome()).attention[0]?.boardName).toBeNull()
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
    expect((await getOrganizationHome()).attention[0]?.priority).toBe(expected)
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
        return acme
          ? [{ boardId: 'b1', name: 'Assembly', swimlaneCount: 5 }]
          : [
              { boardId: 'b2', name: 'Packing', swimlaneCount: 3 },
              { boardId: 'b3', name: 'Dock', swimlaneCount: 4 },
            ]
      }
      if (kind === 'ideas') return page(acme ? 10 : 4)
      if (kind === 'delivery') return acme ? [{ ideaId: 'd' }] : [{ ideaId: 'e' }, { ideaId: 'f' }]
      return url.searchParams.get('status') === 'Inactive' ? page(acme ? 1 : 2) : page(acme ? 6 : 9)
    })
  }

  beforeEach(() => actAs('SiteAdmin'))

  it('asks for the list of organizations once and fans out five reads per organization', async () => {
    seed()
    await getPlatformHome()
    const paths = requested()
    expect(paths.filter((p) => p.startsWith('/organizations?'))).toHaveLength(2)
    for (const id of ['o-acme', 'o-bolt']) {
      const mine = paths.filter((p) => p.startsWith(`/organizations/${id}/`))
      expect(mine).toHaveLength(5)
      expect(mine.filter((p) => p.includes('/boards'))).toHaveLength(1)
      expect(mine.filter((p) => p.includes('/delivery'))).toHaveLength(1)
      expect(mine.filter((p) => p.includes('/ideas') && p.includes('phase=Ideas'))).toHaveLength(1)
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

  it('lists every board with the organization that owns it, in organization order', async () => {
    seed()
    expect((await getPlatformHome()).boards).toEqual([
      { id: 'b1', name: 'Assembly', organizationName: 'Acme', laneCount: 5 },
      { id: 'b2', name: 'Packing', organizationName: 'Bolt', laneCount: 3 },
      { id: 'b3', name: 'Dock', organizationName: 'Bolt', laneCount: 4 },
    ])
  })

  it('shows Organizations, Boards, Open ideas and Users tiles', async () => {
    seed()
    const { kpis } = await getPlatformHome()
    expect(kpis.map((kpi) => [kpi.label, kpi.value, kpi.href])).toEqual([
      ['Organizations', 2, '/settings/organizations'],
      ['Boards', 3, null],
      ['Open ideas', null, null],
      ['Users', 15, '/settings/users'],
    ])
  })

  it('details Organizations by how many are archived, and Users by how many are inactive', async () => {
    seed()
    const { kpis } = await getPlatformHome()
    expect(kpis[0]?.detail).toBe('1 archived')
    expect(kpis[1]?.detail).toBe('across 2 organizations')
    expect(kpis[3]?.detail).toBe('3 inactive')
  })

  it('says "not tracked yet" for Open ideas but still reports the total', async () => {
    seed()
    const open = (await getPlatformHome()).kpis[2]
    expect(open?.detail).toBe('Not tracked yet · 14 in total')
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
    expect(home.boards).toEqual([])
    expect(requested().filter((p) => p.startsWith('/organizations/'))).toEqual([])
  })

  it('fails the page when a single organization’s read fails', async () => {
    seed({ failFor: 'o-bolt' })
    await expect(getPlatformHome()).rejects.toThrow('o-bolt failed')
  })
})
