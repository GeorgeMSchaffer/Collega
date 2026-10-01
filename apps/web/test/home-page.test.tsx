import { render, screen, within } from '@testing-library/react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '@/lib/roles'
import type { HomeKpi, OrganizationHome, PlatformHome } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * What Home draws for each role (slice 132, `app/(desk)/home/page.tsx`, comp Q `s-home`): the
 * greeting's counts, the four tiles with the untracked ones saying so, the attention queue and its
 * empty state, the no-boards state and who may act on it, and the Site Admin's roll-up.
 *
 * The readers are the boundary and are replaced by what `home-reads.test.ts` proves they return.
 */
const readers = vi.hoisted(() => ({
  getOrganizationHome: vi.fn(),
  getPlatformHome: vi.fn(),
}))
vi.mock('@/lib/data', () => ({
  ATTENTION_HREF: '/ideas?priority=Critical&priority=High',
  ...readers,
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))

const untracked = (label: string): HomeKpi => ({
  label,
  value: null,
  detail: 'Not tracked yet',
  definition: `${label} definition`,
  href: null,
})

function orgHome(over: Partial<OrganizationHome> = {}): OrganizationHome {
  return {
    counts: { ideas: 41, boards: 2, issues: 1 },
    statuses: [
      { id: 's1', name: 'New', color: '#111' },
      { id: 's2', name: 'In Review', color: '#222' },
      { id: 's3', name: 'Complete', color: '#333' },
    ],
    kpis: [
      untracked('Open ideas'),
      untracked('Awaiting review'),
      {
        label: 'Assigned to me',
        value: 7,
        detail: '2 critical',
        definition: 'Assigned definition',
        href: null,
      },
      untracked('Completed · 30d'),
    ],
    attention: [
      {
        id: 'i-1',
        title: 'Slow conveyor',
        boardName: 'Assembly',
        ideaType: 'Problem',
        status: { id: 's1', name: 'New', color: '#111' },
        priority: 'Critical',
        createdAtUtc: '2026-09-01T10:00:00Z',
      },
    ],
    ...over,
  }
}

const platformHome: PlatformHome = {
  counts: { organizations: 2, ideas: 14, issues: 3 },
  kpis: [
    {
      label: 'Organizations',
      value: 2,
      detail: '1 archived',
      definition: 'orgs',
      href: '/settings/organizations',
    },
    { label: 'Boards', value: 3, detail: 'across 2 organizations', definition: 'b', href: null },
    {
      label: 'Open ideas',
      value: null,
      detail: 'Not tracked yet · 14 in total',
      definition: 'o',
      href: null,
    },
    { label: 'Users', value: 15, detail: '3 inactive', definition: 'u', href: '/settings/users' },
  ],
  boards: [{ id: 'b1', name: 'Assembly', organizationName: 'Acme', laneCount: 5 }],
}

/** Calls the async server components in a returned tree and renders what they answer. */
async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveAsync))
  if (!isValidElement(node)) return node
  const element = node as ReactElement<{ children?: ReactNode }>
  // Only async components are called here: the others are rendered by React, hooks and all.
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') {
    return resolveAsync(
      await (element.type as (props: unknown) => Promise<ReactNode>)(element.props),
    )
  }
  if (element.props.children === undefined) return element
  const children = await resolveAsync(element.props.children)
  return { ...element, props: { ...element.props, children } } as ReactElement
}

async function renderHome(role: Role) {
  actAs(role)
  const { default: HomePage } = await import('@/app/(desk)/home/page')
  const tree = await resolveAsync(await HomePage())
  render(<div>{tree}</div>)
}

beforeEach(() => {
  readers.getOrganizationHome.mockReset().mockResolvedValue(orgHome())
  readers.getPlatformHome.mockReset().mockResolvedValue(platformHome)
  localStorage.clear()
})

describe('Home for a member of an organization', () => {
  it.each([['OrgAdmin'], ['User']] as const)(
    'greets %s with what needs them and the organization counts',
    async (role) => {
      await renderHome(role)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Good to see you, /)
      const text = document.body.textContent ?? ''
      expect(text).toContain('Here’s what needs you today.')
      expect(text).toContain('41 ideas across 2 boards and 1 delivery issue in flight')
      expect(readers.getPlatformHome).not.toHaveBeenCalled()
    },
  )

  it('says what is moving, not what needs them, to a Read Only reader', async () => {
    await renderHome('ReadOnly')
    expect(document.body.textContent).toContain('Here’s what’s moving today.')
  })

  it('uses the singular for one idea and one board', async () => {
    readers.getOrganizationHome.mockResolvedValue(
      orgHome({ counts: { ideas: 1, boards: 1, issues: 0 } }),
    )
    await renderHome('User')
    expect(document.body.textContent).toContain('1 idea across 1 board and 0 delivery issues')
  })

  it('shows the four tiles, a dash and "Not tracked yet" for the three with no source', async () => {
    await renderHome('OrgAdmin')
    const tiles = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(tiles).toHaveLength(4)
    const byLabel = (label: string) =>
      tiles.find((tile) => tile.textContent?.includes(label)) as HTMLElement
    for (const label of ['Open ideas', 'Awaiting review', 'Completed · 30d']) {
      const tile = byLabel(label)
      expect(tile.textContent).toContain('Not tracked yet')
      expect(tile.querySelector('.tabular-nums')?.textContent).toBe('—')
    }
    expect(byLabel('Assigned to me').textContent).toContain('7')
    expect(byLabel('Assigned to me').textContent).toContain('2 critical')
  })

  it('lists the attention queue with its board, type, status, priority and a link to the idea', async () => {
    await renderHome('OrgAdmin')
    const link = screen.getByRole('link', { name: 'Slow conveyor' })
    expect(link.getAttribute('href')).toBe('/ideas?idea=i-1')
    const row = link.closest('tr') as HTMLElement
    expect(row.textContent).toContain('Assembly · Problem')
    expect(row.textContent).toContain('New')
    expect(row.textContent).toContain('Critical')
  })

  it('links View all to the critical and high ideas', async () => {
    await renderHome('OrgAdmin')
    expect(screen.getByRole('link', { name: 'View all' }).getAttribute('href')).toBe(
      '/ideas?priority=Critical&priority=High',
    )
  })

  it('says nothing is waiting when the queue is empty', async () => {
    readers.getOrganizationHome.mockResolvedValue(orgHome({ attention: [] }))
    await renderHome('OrgAdmin')
    expect(document.body.textContent).toContain(
      'Nothing critical or high priority is waiting on a board.',
    )
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('names the organization’s own statuses in the first-run strip, in order', async () => {
    await renderHome('User')
    const strip = await screen.findByRole('region', { name: 'Getting started' })
    expect(strip.textContent).toContain('New → In Review → Complete')
  })

  it('keeps the recent-activity panel, saying it is not available yet', async () => {
    await renderHome('OrgAdmin')
    expect(document.body.textContent).toContain('Recent activity')
    expect(document.body.textContent).toContain('Not available yet.')
  })
})

describe('Home for an organization with no boards', () => {
  beforeEach(() => {
    readers.getOrganizationHome.mockResolvedValue(
      orgHome({ counts: { ideas: 0, boards: 0, issues: 0 }, kpis: [], attention: [] }),
    )
  })

  it('offers an Org Admin the Create a board link', async () => {
    await renderHome('OrgAdmin')
    expect(screen.getByRole('link', { name: 'Create a board' }).getAttribute('href')).toBe(
      '/settings/boards/new',
    )
  })

  it.each([['User'], ['ReadOnly']] as const)(
    'shows %s the refused action with its reason, not a link',
    async (role) => {
      await renderHome(role)
      expect(screen.queryByRole('link', { name: 'Create a board' })).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Create a board' }).getAttribute('aria-disabled'),
      ).toBe('true')
      expect(document.body.textContent).toContain('Administrators only')
    },
  )

  it('shows no tiles and no attention queue', async () => {
    await renderHome('OrgAdmin')
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('Needs your attention')).toBeNull()
  })
})

describe('Home for a Site Admin', () => {
  it('shows the platform roll-up and never reads an organization’s home', async () => {
    await renderHome('SiteAdmin')
    expect(readers.getOrganizationHome).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(
      '2 organizations, 14 ideas, 3 delivery issues. You are not a member of any of them',
    )
  })

  it('shows the four platform tiles with Open ideas untracked and the linked ones linked', async () => {
    await renderHome('SiteAdmin')
    const tiles = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(tiles.map((tile) => tile.textContent?.split(/\d|—/)[0])).toEqual([
      'Organizations',
      'Boards',
      'Open ideas',
      'Users',
    ])
    expect(screen.getByRole('link', { name: '2' }).getAttribute('href')).toBe(
      '/settings/organizations',
    )
    expect(screen.getByRole('link', { name: '15' }).getAttribute('href')).toBe('/settings/users')
    expect(tiles[2]?.textContent).toContain('Not tracked yet · 14 in total')
  })

  it('lists every board with its organization and lane count', async () => {
    await renderHome('SiteAdmin')
    const row = screen.getByRole('link', { name: 'Assembly' }).closest('tr') as HTMLElement
    expect(row.textContent).toContain('Acme')
    expect(row.textContent).toContain('5')
    expect(screen.getByRole('link', { name: 'Assembly' }).getAttribute('href')).toBe('/boards/b1')
  })

  it('says no organization has a board when the list is empty', async () => {
    readers.getPlatformHome.mockResolvedValue({ ...platformHome, boards: [] })
    await renderHome('SiteAdmin')
    expect(document.body.textContent).toContain('No organization has a board yet.')
  })

  it('offers to create the first organization when there are none', async () => {
    readers.getPlatformHome.mockResolvedValue({
      counts: { organizations: 0, ideas: 0, issues: 0 },
      kpis: [],
      boards: [],
    })
    await renderHome('SiteAdmin')
    expect(screen.getByRole('link', { name: 'Create an organization' }).getAttribute('href')).toBe(
      '/settings/organizations/new',
    )
    expect(screen.queryByRole('list')).toBeNull()
  })
})
