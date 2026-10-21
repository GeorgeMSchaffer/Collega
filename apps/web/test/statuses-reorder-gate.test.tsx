import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StatusesPage from '@/app/(desk)/settings/statuses/page'
import type { Role } from '@/lib/session'
import type { Status } from '@/lib/types'
import { actAs } from './support/acting-role'

/**
 * Who gets the drag-to-reorder grid on Settings → Statuses (slice 145): an Org Admin only. Every
 * other role, and the Site Admin's cross-organization view, gets a plain table. The readers, the
 * actions and the router are the boundary.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/settings/statuses',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: vi.fn(async () => ({})) }))
vi.mock('@/lib/server/catalog-actions', () => ({ reorderStatuses: vi.fn(), createStatus: vi.fn() }))
const data = vi.hoisted(() => ({ getStatuses: vi.fn(), getStatusesByOrganization: vi.fn() }))
vi.mock('@/lib/data', () => data)

const STATUSES: Status[] = [
  { id: 's-new', name: 'New', color: '#999999' },
  { id: 's-review', name: 'Review', color: '#3366cc' },
]

beforeEach(() => {
  data.getStatuses.mockResolvedValue(STATUSES)
  data.getStatusesByOrganization.mockResolvedValue([
    { organization: 'Acme', statuses: STATUSES },
    { organization: 'Globex', statuses: [{ id: 's-x', name: 'Triage', color: '#111111' }] },
  ])
})

async function renderPage(role: Role) {
  actAs(role)
  render(await StatusesPage())
}

describe('Settings → Statuses reordering by role', () => {
  it('gives an Org Admin a grip and move buttons on every row', async () => {
    await renderPage('OrgAdmin')
    expect(screen.getByTitle('Drag to reorder New')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move New down' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move Review up' })).toBeTruthy()
  })

  it.each(['User', 'ReadOnly'] as const)('gives a %s no reordering controls', async (role) => {
    await renderPage(role)
    expect(screen.queryByTitle(/Drag to reorder/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull()
  })

  it('gives a Site Admin’s cross-organization view no reordering controls', async () => {
    await renderPage('SiteAdmin')
    expect(screen.getByText('Triage')).toBeTruthy()
    expect(screen.queryByTitle(/Drag to reorder/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull()
  })
})
