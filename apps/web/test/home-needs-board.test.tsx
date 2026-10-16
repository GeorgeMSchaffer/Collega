import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KpiRow } from '@/components/home/home-parts'
import { apiGet } from '@/lib/api/client'
import { getOrganizationHome } from '@/lib/data/home'
import { actAs } from './support/acting-role'

/**
 * Home's *Needs a board* tile (`20-feature-board-pull-in.md` rule 7): shown to an Org Admin only,
 * with the count of live Discovery ideas that belong to no board and a link to the Ideas list
 * filtered to *No board*. Hidden at zero. Counted by the existing ideas read with `boardId=none`;
 * no ideas figure elsewhere on Home may include the pool. The API client is the boundary.
 */
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))

const POOL = (pool: number) => (url: URL) => {
  const p = url.searchParams
  const total = p.get('boardId') === 'none' ? pool : 3
  return { items: [], totalCount: total, page: 1, pageSize: 1 }
}

const requested = () =>
  vi.mocked(apiGet).mock.calls.map(([, path]) => new URL(String(path), 'http://api.test'))

function wire(pool: number) {
  vi.mocked(apiGet).mockReset()
  vi.mocked(apiGet).mockImplementation(async (_reader, path) => {
    const url = new URL(String(path), 'http://api.test')
    if (url.pathname.endsWith('/ideas')) return POOL(pool)(url)
    if (url.pathname.endsWith('/boards')) {
      return [
        {
          boardId: 'b-live',
          name: 'Assembly',
          isArchived: false,
          description: null,
          ideaCount: 30,
          swimlaneCount: 0,
          createdAtUtc: '2026-08-01T00:00:00Z',
          createdBy: null,
          laneCounts: [],
          topTags: [],
          tagCount: 0,
          allowUserStatusUpdate: true,
          archivedAtUtc: null,
        },
      ]
    }
    return []
  })
}

const tile = async () =>
  (await getOrganizationHome()).kpis.find((kpi) => kpi.label === 'Needs a board')
const poolReads = () => requested().filter((url) => url.searchParams.get('boardId') === 'none')

beforeEach(() => wire(4))

describe('the Needs a board tile reader', () => {
  it('gives an Org Admin the tile with the pool count and the No board link', async () => {
    actAs('OrgAdmin')
    expect(await tile()).toMatchObject({
      label: 'Needs a board',
      value: 4,
      href: '/ideas?board=none&phase=Ideas',
      action: { href: '/ideas?board=none&phase=Ideas' },
    })
  })

  it('counts Discovery ideas only', async () => {
    actAs('OrgAdmin')
    await tile()
    expect(poolReads().map((url) => url.searchParams.get('phase'))).toEqual(['Ideas'])
  })

  it.each(['User', 'ReadOnly'] as const)(
    'gives %s no tile, and never asks for the pool',
    async (role) => {
      actAs(role)
      expect(await tile()).toBeUndefined()
      expect(poolReads()).toEqual([])
    },
  )

  it('hides the tile at zero', async () => {
    wire(0)
    actAs('OrgAdmin')
    expect(await tile()).toBeUndefined()
  })

  it('shows the tile first, ahead of the personal figures', async () => {
    actAs('OrgAdmin')
    expect((await getOrganizationHome()).kpis[0]?.label).toBe('Needs a board')
  })

  it('keeps the pool out of every board-scoped figure and the greeting', async () => {
    actAs('OrgAdmin')
    const home = await getOrganizationHome()
    expect(home.counts.ideas).toBe(30)
    for (const url of requested().filter((u) => u.pathname.endsWith('/ideas'))) {
      // The Issues count is the delivery figure, not an idea figure.
      if (url.searchParams.get('boardId') === 'none' || url.searchParams.get('phase') === 'Issues')
        continue
      expect(url.searchParams.getAll('boardId')).toEqual(['b-live'])
    }
  })
})

describe('the Needs a board tile on the page', () => {
  it('draws the count as a link and a call to action to the No board list', async () => {
    actAs('OrgAdmin')
    const kpis = (await getOrganizationHome()).kpis
    render(<KpiRow label="Your numbers" kpis={kpis} />)
    const row = screen.getByRole('list', { name: 'Your numbers' })
    expect(within(row).getByRole('link', { name: '4' }).getAttribute('href')).toBe(
      '/ideas?board=none&phase=Ideas',
    )
    expect(
      within(row).getByRole('link', { name: 'View ideas with no board' }).getAttribute('href'),
    ).toBe('/ideas?board=none&phase=Ideas')
    expect(row.textContent).toContain('ideas with no board')
  })

  it('draws no such tile for a User', async () => {
    actAs('User')
    const kpis = (await getOrganizationHome()).kpis
    render(<KpiRow label="Your numbers" kpis={kpis} />)
    expect(screen.queryByText('Needs a board')).toBeNull()
  })
})
