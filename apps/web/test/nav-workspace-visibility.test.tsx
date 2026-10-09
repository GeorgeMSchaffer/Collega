import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from '@/components/nav/command-palette'
import { allNavItems, navGroupsWith, navItemVisible } from '@/components/nav/nav-items'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import type { Role } from '@/lib/roles'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * `SPEC/decisions.md` 2026-10-04: a Site Admin acting as themselves has no organization workspace
 * and no inbox, so the sidebar and the palette offer Home and Settings only. Both read the same
 * `navItemVisible`, and a heading with nothing under it goes too.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/server/auth-actions', () => ({ signOut: vi.fn() }))
// The real link asks `/inbox/unread-count` on mount; the network is not part of this contract.
vi.mock('@/components/nav/inbox-link', () => ({ InboxLink: () => <a href="/inbox">Inbox</a> }))

const WORKSPACE = ['Boards', 'Ideas', 'Sprint board', 'Backlog', 'Roadmap']
const MEMBER_ROLES: Role[] = ['OrgAdmin', 'User', 'ReadOnly']

function user(role: Role): CurrentUser {
  actAs(role)
  return {
    userId: 'u',
    displayName: 'Test User',
    initials: 'TU',
    role,
    roleLabel: role,
    organizationId: role === 'SiteAdmin' ? null : 'org-1',
    organizationName: role === 'SiteAdmin' ? null : 'Acme',
    viewingAs: null,
  }
}

const counts = { boards: 2, ideas: 5, backlog: 1 }

function renderSidebar(role: Role) {
  return render(
    <SessionProvider user={user(role)}>
      <SidebarNav groups={navGroupsWith(counts)} />
    </SessionProvider>,
  )
}

function renderPalette(role: Role) {
  render(
    <SessionProvider user={user(role)}>
      <CommandPalette />
    </SessionProvider>,
  )
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  const dialog = screen.getByRole('dialog', { name: 'Command palette' })
  return within(dialog)
    .queryAllByRole('button')
    .map((button) => (button.textContent ?? '').replace(/E\d$/, ''))
}

describe('navItemVisible', () => {
  const item = (label: string) => {
    const found = allNavItems.find((candidate) => candidate.label === label)
    if (!found) throw new Error(`no nav item ${label}`)
    return found
  }

  it.each(WORKSPACE)('hides %s from a Site Admin', (label) => {
    expect(navItemVisible(item(label), 'SiteAdmin')).toBe(false)
  })

  it('hides the Inbox from a Site Admin', () => {
    expect(navItemVisible(item('Inbox'), 'SiteAdmin')).toBe(false)
  })

  it.each(['Home', 'Settings'])('keeps %s for a Site Admin', (label) => {
    expect(navItemVisible(item(label), 'SiteAdmin')).toBe(true)
  })

  it.each(MEMBER_ROLES)('offers every item to %s', (role) => {
    expect(allNavItems.every((candidate) => navItemVisible(candidate, role))).toBe(true)
  })
})

describe('the sidebar', () => {
  it('offers a Site Admin Home and Settings only, and drops the emptied Delivery heading', () => {
    renderSidebar('SiteAdmin')
    const links = screen.getAllByRole('link').map((link) => link.textContent)
    expect(links).toEqual(['Home', 'Settings'])
    expect(screen.queryByText('Delivery')).toBeNull()
    expect(screen.getByText('Workspace')).toBeTruthy()
    expect(screen.getByText('Configure')).toBeTruthy()
  })

  it.each(MEMBER_ROLES)('offers %s the whole workspace and the Delivery heading', (role) => {
    renderSidebar(role)
    for (const label of ['Home', 'Inbox', ...WORKSPACE, 'Settings']) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}`) })).toBeTruthy()
    }
    expect(screen.getByText('Delivery')).toBeTruthy()
  })
})

describe('the command palette', () => {
  it('lists Home and Settings only for a Site Admin', () => {
    expect(renderPalette('SiteAdmin')).toEqual(['Home', 'Settings'])
  })

  it('finds nothing when a Site Admin searches for a workspace page', () => {
    renderPalette('SiteAdmin')
    fireEvent.change(screen.getByLabelText('Search or jump to'), { target: { value: 'board' } })
    expect(screen.getByText('No matches.')).toBeTruthy()
  })

  it.each(MEMBER_ROLES)('lists every destination for %s', (role) => {
    expect(renderPalette(role)).toEqual(allNavItems.map((item) => item.label))
  })
})
