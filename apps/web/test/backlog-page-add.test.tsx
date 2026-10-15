import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BacklogPage from '@/app/(desk)/delivery/backlog/page'
import type { Role } from '@/lib/types'

/**
 * The Backlog page's half of "add an Issue directly": the header button follows `issueAddDenial`,
 * the empty state still offers Add issue, and the create drawer's catalogs are read only for a role
 * that may add, and only when `?new` asks. The data seam, identity and the heavy children are the
 * boundary; the header, the gate and the button are real.
 */
const mocks = vi.hoisted(() => ({
  user: { role: 'User', userId: 'u-1' },
  rows: [] as { id: string; authorUserId: string }[],
  getIdeaFormOptions: vi.fn(),
  screen: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/delivery/backlog',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => mocks.user }))
vi.mock('@/lib/data', () => ({
  getBacklogIssues: async () => mocks.rows,
  getSprints: async () => [],
  getOutcomes: async () => [],
  getDeliveryStatuses: async () => [],
  getIdeaFormOptions: mocks.getIdeaFormOptions,
}))
vi.mock('@/components/delivery/load-issue-drawer', () => ({
  loadIssueDrawer: async () => ({ drawer: null, editing: false, missing: false }),
}))
vi.mock('@/components/delivery/issue-drawer', () => ({ IssueDrawer: () => null }))
vi.mock('@/components/delivery/admin-action', () => ({ AdminAction: () => null }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/delivery/backlog-screen', () => ({
  BacklogScreen: (props: { rows: unknown[]; empty: ReactNode }) => {
    mocks.screen(props)
    return props.rows.length === 0 ? props.empty : null
  },
}))

const FORM_OPTIONS = { ideaTypes: [], businessImpacts: [], members: [], tags: [] }

async function renderPage(role: Role, query: Record<string, string> = {}) {
  mocks.user = { role, userId: 'u-1' }
  render(await BacklogPage({ searchParams: Promise.resolve(query) }))
}

const screenProps = () => mocks.screen.mock.calls.at(-1)?.[0]

beforeEach(() => {
  mocks.rows = []
  mocks.getIdeaFormOptions.mockReset()
  mocks.getIdeaFormOptions.mockResolvedValue(FORM_OPTIONS)
  mocks.screen.mockReset()
})

describe('Backlog header action', () => {
  it.each(['User', 'OrgAdmin'] as const)(
    'is a live Add New Issue button for a %s',
    async (role) => {
      await renderPage(role)
      const button = screen.getByRole('button', { name: 'Add New Issue' })
      expect(button.getAttribute('aria-disabled')).toBeNull()
    },
  )

  it('is disabled with the Read Only reason for a Read Only member', async () => {
    await renderPage('ReadOnly')
    const button = screen.getByRole('button', { name: /Add New Issue/ })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-describedby')).toBe('why-add-issue')
    expect(document.getElementById('why-add-issue')?.textContent).toBe(
      'Read Only members cannot add issues.',
    )
  })

  it('is disabled and points a Site Admin at View As', async () => {
    await renderPage('SiteAdmin')
    expect(
      screen.getByRole('button', { name: /Add New Issue/ }).getAttribute('aria-disabled'),
    ).toBe('true')
    expect(document.getElementById('why-add-issue')?.textContent).toBe(
      'Act as a member to add issues. Use View As.',
    )
  })
})

describe('Backlog empty state', () => {
  it('still offers a live Add issue for a User, beside the link to the board', async () => {
    await renderPage('User')
    expect(screen.getByText('Nothing waiting')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Add issue' }).getAttribute('aria-disabled'),
    ).toBeNull()
    expect(screen.getByRole('link', { name: 'Open the ideas board' })).toBeTruthy()
  })

  it('offers Add issue as a denied control with the reason to a Read Only member', async () => {
    await renderPage('ReadOnly')
    expect(screen.getByRole('button', { name: /Add issue/ }).getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(screen.getAllByText('Read Only members cannot add issues.').length).toBeGreaterThan(0)
  })
})

describe('Backlog create drawer data', () => {
  it('reads the form catalogs when ?new is present for a role that may add', async () => {
    await renderPage('User', { new: '1' })
    expect(mocks.getIdeaFormOptions).toHaveBeenCalledOnce()
    expect(screenProps().options).toEqual(FORM_OPTIONS)
  })

  it('does not read the catalogs without ?new', async () => {
    await renderPage('User')
    expect(mocks.getIdeaFormOptions).not.toHaveBeenCalled()
    expect(screenProps().options).toBeNull()
  })

  it.each(['ReadOnly', 'SiteAdmin'] as const)(
    'opens nothing for a %s who types ?new',
    async (role) => {
      await renderPage(role, { new: '1' })
      expect(mocks.getIdeaFormOptions).not.toHaveBeenCalled()
      expect(screenProps().options).toBeNull()
    },
  )

  it.each([
    ['User', true],
    ['OrgAdmin', true],
    ['ReadOnly', false],
    ['SiteAdmin', false],
  ] as const)('tells the screen canAdd for a %s: %s', async (role, canAdd) => {
    await renderPage(role)
    expect(screenProps().canAdd).toBe(canAdd)
  })
})

describe('Backlog row Edit gating', () => {
  beforeEach(() => {
    mocks.rows = [
      { id: 'mine', authorUserId: 'u-1' },
      { id: 'theirs', authorUserId: 'u-2' },
    ]
  })

  it('offers a User Edit only on the Issues they authored', async () => {
    await renderPage('User')
    expect(screenProps().editableIds).toEqual(['mine'])
  })

  it('offers an Org Admin Edit on every Issue', async () => {
    await renderPage('OrgAdmin')
    expect(screenProps().editableIds).toEqual(['mine', 'theirs'])
  })

  // DEFECT (slice 187): the page filters on mayEditIdeaContent alone, so a Read Only author is
  // offered a row Edit that the Issue drawer's footer (writeDenial) and the API both refuse.
  it('offers a Read Only member no Edit even on a row they authored', async () => {
    await renderPage('ReadOnly')
    expect(screenProps().editableIds).toEqual([])
  })
})
