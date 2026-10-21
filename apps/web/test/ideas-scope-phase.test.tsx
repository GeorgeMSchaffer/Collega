import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDEAS_LIST, toIdeaListQuery } from '@/components/ideas/idea-list-config'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { readListState } from '@/components/list/list-state'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser } from '@/lib/types'

/**
 * The two single-valued filters Home links into (slice 156): `/ideas?scope=assigned|created` and
 * `?phase=Ideas|Issues` become the API query, an unknown value is ignored rather than sent, and the
 * toolbar shows each as a chip whose removal keeps the rest of the URL's state.
 */
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/ideas',
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/server/idea-actions', () => ({
  deleteIdea: vi.fn(),
  saveIdea: vi.fn(),
  addComment: vi.fn(),
  toggleUpvote: vi.fn(),
  moveIdea: vi.fn(),
}))

const query = (search: string) =>
  toIdeaListQuery(readListState(new URLSearchParams(search), IDEAS_LIST))

describe('toIdeaListQuery scope and phase', () => {
  it.each(['assigned', 'created'] as const)('passes scope=%s through', (scope) => {
    expect(query(`scope=${scope}`).scope).toBe(scope)
  })

  it.each(['Ideas', 'Issues'] as const)('passes phase=%s through', (phase) => {
    expect(query(`phase=${phase}`).phase).toBe(phase)
  })

  it('carries both with the board filter Home adds, in one query', () => {
    const result = query('scope=assigned&phase=Ideas&board=b1&board=b2')
    expect(result).toMatchObject({ scope: 'assigned', phase: 'Ideas', boardIds: ['b1', 'b2'] })
  })

  it('leaves both undefined when the URL names neither', () => {
    expect(query('')).toMatchObject({ scope: undefined, phase: undefined })
  })

  it('drops a value the API does not know instead of sending it', () => {
    const result = query('scope=everyone&phase=Epics')
    expect(result.scope).toBeUndefined()
    expect(result.phase).toBeUndefined()
  })

  it('does not read them off the prototype', () => {
    expect(query('scope=toString').scope).toBeUndefined()
  })
})

const ORG_ADMIN: CurrentUser = {
  userId: 'u1',
  displayName: 'Olivia',
  initials: 'OA',
  role: 'OrgAdmin',
  roleLabel: 'Org Admin',
  organizationId: 'org-1',
  organizationName: 'Acme',
  viewingAs: null,
}

function renderIdeas(search: string, board: Parameters<typeof IdeaWorkspace>[0]['board'] = null) {
  nav.params = new URLSearchParams(search)
  return render(
    <SessionProvider user={ORG_ADMIN}>
      <IdeaWorkspace
        rows={[]}
        total={0}
        boards={[]}
        statuses={[]}
        tags={[]}
        board={board}
        drawer={{ mode: null, idea: null, formOptions: null }}
      />
    </SessionProvider>,
  )
}

beforeEach(() => {
  nav.push.mockReset()
  nav.replace.mockReset()
})

const pushed = () => String(nav.push.mock.calls.concat(nav.replace.mock.calls)[0]?.[0])

describe('the toolbar chips on /ideas', () => {
  it('show the scope and the phase as removable chips', () => {
    renderIdeas('scope=assigned&phase=Issues')
    expect(screen.getByRole('button', { name: 'Remove filter: Assigned to me' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove filter: Issues only' })).toBeTruthy()
  })

  it.each([
    ['scope=created', 'Remove filter: Created by me'],
    ['phase=Ideas', 'Remove filter: Ideas only'],
  ])('name the other values too (%s)', (search, name) => {
    renderIdeas(search)
    expect(screen.getByRole('button', { name })).toBeTruthy()
  })

  it('show no chip when the URL names neither, or names an unknown value', () => {
    renderIdeas('scope=everyone')
    expect(screen.queryByRole('button', { name: /^Remove filter: / })).toBeNull()
  })

  it('removing the scope keeps the phase and other filters in the URL', () => {
    renderIdeas('scope=assigned&phase=Ideas&priority=High')
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Assigned to me' }))
    const url = new URL(pushed(), 'http://x')
    expect(url.searchParams.get('phase')).toBe('Ideas')
    expect(url.searchParams.get('priority')).toBe('High')
    expect(url.searchParams.get('scope')).not.toBe('assigned')
  })

  it('are not offered on a board’s own list', () => {
    renderIdeas('scope=assigned', {
      id: 'b1',
      name: 'Assembly',
      lanes: [],
      isArchived: false,
      canMove: true,
      canReorder: false,
    })
    expect(screen.queryByRole('button', { name: 'Remove filter: Assigned to me' })).toBeNull()
  })
})
