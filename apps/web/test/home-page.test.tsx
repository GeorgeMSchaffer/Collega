import { render, screen, within } from '@testing-library/react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '@/lib/roles'
import type {
  BoardOverview,
  HomeIdea,
  OrganizationHome,
  PlatformHome,
  PlatformOrganization,
} from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * What Home draws for each role (slices 132 and 155, `app/(desk)/home/page.tsx`, comp R
 * `comp-r-home-dashboard.html`): the greeting's counts, the tiles with the untracked figures saying
 * so, the attention queue, Assigned to me, the boards, the current sprint and Most upvoted, their
 * empty states, the no-boards state and who may act on it, and the Site Admin's roll-up.
 *
 * The readers are the boundary and are replaced by what `home-reads.test.ts` proves they return.
 */
const readers = vi.hoisted(() => ({
  getOrganizationHome: vi.fn(),
  getPlatformHome: vi.fn(),
}))
vi.mock('@/lib/data', () => ({
  ATTENTION_HREF: '/ideas?phase=Ideas&priority=Critical&priority=High',
  ASSIGNED_HREF: '/ideas?scope=assigned&sort=priority&dir=desc',
  ...readers,
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))

const NEW = { id: 's1', name: 'New', color: '#111' }

function idea(over: Partial<HomeIdea> = {}): HomeIdea {
  return {
    id: 'i-1',
    title: 'Slow conveyor',
    boardName: 'Assembly',
    ideaType: 'Problem',
    status: NEW,
    priority: 'Critical',
    createdAtUtc: '2026-09-01T10:00:00Z',
    upvotes: 4,
    hasUpvoted: false,
    ...over,
  }
}

function board(over: Partial<BoardOverview> = {}): BoardOverview {
  return {
    id: 'b1',
    name: 'Assembly',
    description: 'The assembly cells.',
    ideaCount: 3,
    laneCount: 2,
    createdAtUtc: '2026-08-01T00:00:00Z',
    createdOn: 'Aug 1, 2026',
    createdBy: null,
    lanes: [
      { id: 's1', name: 'New', color: '#111', ideaCount: 2 },
      { id: 's3', name: 'Complete', color: '#333', ideaCount: 1 },
    ],
    topTags: [{ name: 'safety', ideaCount: 2, color: '#B91C1C' }],
    tagCount: 4,
    userStatusMoves: true,
    isArchived: false,
    archivedOn: null,
    ...over,
  }
}

function orgHome(over: Partial<OrganizationHome> = {}): OrganizationHome {
  return {
    counts: { ideas: 41, boards: 2, issues: 1 },
    ideasHref: '/ideas?phase=Ideas',
    statuses: [
      { id: 's1', name: 'New', color: '#111' },
      { id: 's2', name: 'In Review', color: '#222' },
      { id: 's3', name: 'Complete', color: '#333' },
    ],
    kpis: [
      {
        label: 'Assigned to me',
        value: 7,
        detail: '2 critical',
        detailAlert: true,
        definition: 'Assigned definition',
        href: '/ideas?scope=assigned&sort=priority&dir=desc',
      },
      {
        label: 'Critical & high',
        value: 12,
        detail: 'still on a board',
        definition: 'c',
        href: '/ideas?phase=Ideas&priority=Critical&priority=High',
      },
      {
        label: 'You created',
        value: 5,
        detail: 'ideas and issues',
        definition: 'y',
        href: '/ideas?scope=created',
      },
    ],
    attention: { total: 12, rows: [idea()] },
    assigned: { total: 7, rows: [idea({ id: 'i-2', title: 'Guard rails', priority: 'High' })] },
    topVoted: [idea({ id: 'i-3', title: 'Torque audit', upvotes: 9, hasUpvoted: true })],
    boards: [board()],
    sprint: {
      sprint: {
        id: 'sp-1',
        name: 'Sprint 14',
        goal: 'Pilot remote diagnostics.',
        startsOn: '22 Sept',
        endsOn: '5 Oct 2026',
        startDate: '2026-09-22',
        endDate: '2026-10-05',
        window: '22 SEP – 5 OCT',
        state: 'Active',
        issueCount: 9,
        doneCount: 4,
      },
      mix: [
        { status: { id: 'Pending', name: 'Pending', color: 'var(--ink-faint)' }, count: 5 },
        { status: { id: 'Complete', name: 'Complete', color: 'var(--green)' }, count: 4 },
      ],
      backlog: 6,
    },
    ...over,
  }
}

function organization(over: Partial<PlatformOrganization> = {}): PlatformOrganization {
  return {
    id: 'o-acme',
    name: 'Acme',
    ideas: 10,
    issues: 1,
    users: 6,
    inactive: 1,
    boards: [board()],
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
    { label: 'Ideas', value: 14, detail: 'plus 3 delivery issues', definition: 'o', href: null },
    { label: 'Users', value: 15, detail: '3 inactive', definition: 'u', href: '/settings/users' },
  ],
  organizations: [
    organization(),
    organization({ id: 'o-bolt', name: 'Bolt', ideas: 4, boards: [], inactive: 0 }),
  ],
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

const panel = (name: string) => screen.getByRole('region', { name })

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
      expect(text).toContain('41 ideas across 2 boards and 1 delivery issue —')
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

  it('shows the three tiles and a fourth naming what is not tracked yet, with a dash for each', async () => {
    await renderHome('OrgAdmin')
    const tiles = screen.getByRole('list', { name: 'Your numbers' }).children
    expect(tiles).toHaveLength(4)
    const untracked = tiles[3] as HTMLElement
    expect(untracked.textContent).toContain('Not tracked yet')
    for (const label of ['Open ideas', 'Awaiting review', 'Completed · 30d']) {
      expect(untracked.textContent).toContain(label)
    }
    expect((tiles[0] as HTMLElement).textContent).toContain('2 critical')
  })

  it('links every tile to the query it counts', async () => {
    await renderHome('OrgAdmin')
    const tiles = screen.getByRole('list', { name: 'Your numbers' })
    expect(within(tiles).getByRole('link', { name: '12' }).getAttribute('href')).toBe(
      '/ideas?phase=Ideas&priority=Critical&priority=High',
    )
    expect(within(tiles).getByRole('link', { name: '7' }).getAttribute('href')).toBe(
      '/ideas?scope=assigned&sort=priority&dir=desc',
    )
  })

  it('lists the attention queue with its board, type, status, priority and a link to the idea', async () => {
    await renderHome('OrgAdmin')
    const queue = panel('Needs your attention')
    const link = within(queue).getByRole('link', { name: 'Slow conveyor' })
    expect(link.getAttribute('href')).toBe('/ideas?idea=i-1')
    const row = link.closest('li') as HTMLElement
    expect(row.textContent).toContain('Assembly · Problem')
    expect(row.textContent).toContain('New')
    expect(row.textContent).toContain('Critical')
    expect(within(queue).getByRole('link', { name: 'View all 12' }).getAttribute('href')).toBe(
      '/ideas?phase=Ideas&priority=Critical&priority=High',
    )
  })

  it('says nothing is waiting when the queue is empty', async () => {
    readers.getOrganizationHome.mockResolvedValue(orgHome({ attention: { total: 0, rows: [] } }))
    await renderHome('OrgAdmin')
    expect(panel('Needs your attention').textContent).toContain(
      'Nothing critical or high priority is waiting on a board.',
    )
  })

  it('lists what is assigned to the reader, with its count', async () => {
    await renderHome('User')
    const assigned = panel('Assigned to me 7')
    expect(within(assigned).getByRole('link', { name: 'Guard rails' }).getAttribute('href')).toBe(
      '/ideas?idea=i-2',
    )
  })

  it.each([
    ['User', 'When someone adds you'],
    ['ReadOnly', 'Ideas you’re named on will appear here.'],
  ] as const)('tells %s when nothing is assigned', async (role, copy) => {
    readers.getOrganizationHome.mockResolvedValue(orgHome({ assigned: { total: 0, rows: [] } }))
    await renderHome(role)
    const assigned = panel('Assigned to me 0')
    expect(assigned.textContent).toContain('Nothing is assigned to you.')
    expect(assigned.textContent).toContain(copy)
  })

  it('shows each board with its lane counts, top tags and figures', async () => {
    await renderHome('User')
    const boards = panel('Your boards')
    expect(within(boards).getByRole('link', { name: 'Assembly' }).getAttribute('href')).toBe(
      '/boards/b1',
    )
    expect(boards.textContent).toContain('2 New')
    expect(boards.textContent).toContain('safety')
    expect(boards.textContent).toContain('3 ideas')
    expect(boards.textContent).toContain('4 tags')
  })

  it.each([
    ['OrgAdmin', 'Manage boards', '/settings/boards'],
    ['User', 'All boards', '/boards'],
  ] as const)('gives %s the %s link', async (role, name, href) => {
    await renderHome(role)
    expect(within(panel('Your boards')).getByRole('link', { name }).getAttribute('href')).toBe(href)
  })

  it('shows the current sprint with its progress, backlog and delivery mix', async () => {
    await renderHome('User')
    const sprint = panel('Current sprint')
    expect(sprint.textContent).toContain('Sprint 14')
    expect(sprint.textContent).toContain('4 of 9 issues done')
    expect(sprint.textContent).toContain('6 in the backlog')
    expect(sprint.textContent).toContain('5 Pending')
    expect(
      within(sprint).getByRole('link', { name: 'Open sprint board' }).getAttribute('href'),
    ).toBe('/delivery/sprint')
  })

  it('hides the current sprint when none is running', async () => {
    readers.getOrganizationHome.mockResolvedValue(orgHome({ sprint: null }))
    await renderHome('User')
    expect(screen.queryByRole('region', { name: 'Current sprint' })).toBeNull()
  })

  it('lists the most upvoted ideas with their votes', async () => {
    await renderHome('User')
    const voted = panel('Most upvoted')
    expect(within(voted).getByRole('link', { name: 'Torque audit' })).toBeTruthy()
    expect(voted.textContent).toContain('9')
    expect(voted.textContent).toContain('including yours')
  })

  it('names the organization’s own statuses in the first-run strip, in order', async () => {
    await renderHome('User')
    const strip = await screen.findByRole('region', { name: 'Getting started' })
    expect(strip.textContent).toContain('New → In Review → Complete')
  })

  it('keeps the recent-activity panel, saying it is not available yet', async () => {
    await renderHome('OrgAdmin')
    expect(panel('Recent activity').textContent).toContain('Not available yet.')
  })
})

describe('Home for an organization with no boards', () => {
  beforeEach(() => {
    readers.getOrganizationHome.mockResolvedValue(
      orgHome({ counts: { ideas: 0, boards: 0, issues: 0 }, boards: [] }),
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

  it('shows no tiles and no panels', async () => {
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

  it('shows the four platform tiles with the linked ones linked', async () => {
    await renderHome('SiteAdmin')
    const tiles = screen.getByRole('list', { name: 'Platform numbers' })
    expect([...tiles.children].map((tile) => tile.textContent?.split(/\d/)[0])).toEqual([
      'Organizations',
      'Boards',
      'Ideas',
      'Users',
    ])
    expect(within(tiles).getByRole('link', { name: '2' }).getAttribute('href')).toBe(
      '/settings/organizations',
    )
    expect(within(tiles).getByRole('link', { name: '15' }).getAttribute('href')).toBe(
      '/settings/users',
    )
    expect(tiles.textContent).toContain('plus 3 delivery issues')
  })

  it('lists each organization with its boards, users and figures', async () => {
    await renderHome('SiteAdmin')
    const orgs = panel('Organizations')
    const acme = within(orgs).getByRole('link', { name: 'Acme' })
    expect(acme.getAttribute('href')).toBe('/settings/organizations/o-acme')
    const row = acme.closest('li') as HTMLElement
    expect(row.textContent).toContain('1 board · 6 users (1 inactive)')
    expect(row.textContent).toContain('10 ideas')
    expect(row.textContent).toContain('1 issue')
  })

  it('groups every board by organization, saying when one has none', async () => {
    await renderHome('SiteAdmin')
    const boards = panel('All boards')
    expect(within(boards).getByRole('link', { name: 'Assembly' }).getAttribute('href')).toBe(
      '/boards/b1',
    )
    expect(boards.textContent).toContain('Bolt')
    expect(boards.textContent).toContain('No boards yet')
  })

  it('offers to create the first organization when there are none', async () => {
    readers.getPlatformHome.mockResolvedValue({
      counts: { organizations: 0, ideas: 0, issues: 0 },
      kpis: [],
      organizations: [],
    })
    await renderHome('SiteAdmin')
    expect(screen.getByRole('link', { name: 'Create an organization' }).getAttribute('href')).toBe(
      '/settings/organizations/new',
    )
    expect(screen.queryByRole('list')).toBeNull()
  })
})
