import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaCard } from '@/components/ideas/idea-card'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser, Idea, TagRef } from '@/lib/types'

/**
 * Ideas since Sprint 11: the Tags filter reads the catalog and keeps a selected name the catalog no
 * longer has, so it can be cleared (`20-feature-ideas-and-engagement.md` rule 15); and the effort
 * bar shows on idea rows and cards only when the idea has an effort
 * (`20-feature-issues-and-delivery.md` "Effort bar (comp R)").
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

beforeEach(() => {
  nav.params = new URLSearchParams()
  nav.push.mockReset()
  nav.replace.mockReset()
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

function idea(id: string, effort: Idea['effort']): Idea {
  return {
    id,
    boardId: 'b1',
    statusId: 's1',
    statusName: 'New',
    title: `Idea ${id}`,
    priority: 'Medium',
    ideaType: 'Continuous Improvement',
    businessImpact: 'Medium',
    tag: null,
    tags: [],
    assigneeInitials: null,
    assignees: [],
    upvotes: 0,
    hasUpvoted: false,
    effort,
  }
}

const CATALOG: TagRef[] = [{ id: 't1', name: 'safety', color: '#E5484D' }]

function workspace(rows: Idea[]) {
  render(
    <SessionProvider user={ORG_ADMIN}>
      <IdeaWorkspace
        rows={rows}
        total={rows.length}
        boards={[{ id: 'b1', name: 'Assembly', isArchived: false }]}
        statuses={[{ id: 's1', name: 'New', color: '#999' }]}
        tags={CATALOG}
        board={null}
        drawer={{ mode: null, idea: null, formOptions: null }}
      />
    </SessionProvider>,
  )
}

const lastUrl = () => String((nav.replace.mock.calls.at(-1) ?? nav.push.mock.calls.at(-1))?.[0])

const openTagsFilter = () => {
  const trigger = screen
    .getAllByRole('button', { name: /^Tags/ })
    .find((button) => button.getAttribute('aria-haspopup') === 'dialog')
  fireEvent.click(trigger as HTMLElement)
}

describe('Ideas Tags filter', () => {
  it('offers the catalog’s tags', () => {
    workspace([])
    openTagsFilter()
    const popover = screen.getByRole('dialog', { name: 'Tags filter' })
    expect(within(popover).getAllByRole('checkbox')).toHaveLength(1)
    expect(within(popover).getByRole('checkbox', { name: 'safety' })).toBeTruthy()
  })

  it('keeps a selected name the catalog no longer has, checked, so it can be cleared', () => {
    nav.params = new URLSearchParams('tag=gone&tag=safety')
    workspace([])
    openTagsFilter()
    const popover = screen.getByRole('dialog', { name: 'Tags filter' })
    const gone = within(popover).getByRole('checkbox', { name: 'gone' }) as HTMLInputElement
    expect(gone.checked).toBe(true)

    fireEvent.click(gone)
    expect(lastUrl()).toContain('tag=safety')
    expect(lastUrl()).not.toContain('tag=gone')
  })

  it('does not add a stale option for a name the catalog still has', () => {
    nav.params = new URLSearchParams('tag=safety')
    workspace([])
    openTagsFilter()
    const popover = screen.getByRole('dialog', { name: 'Tags filter' })
    expect(within(popover).getAllByRole('checkbox')).toHaveLength(1)
  })
})

describe('The effort bar on ideas', () => {
  for (const view of ['list', 'cards'] as const) {
    it(`shows in ${view} only for an idea with an effort`, () => {
      if (view === 'cards') nav.params = new URLSearchParams('view=cards')
      workspace([idea('with', 'High'), idea('without', null)])
      expect(screen.getAllByText('High effort')).toHaveLength(1)
      expect(screen.queryByText(/Low effort|Medium effort/)).toBeNull()
    })
  }

  it('shows on a lane card with an effort, and nothing without one', () => {
    const card = (effort: Idea['effort']) => (
      <SessionProvider user={ORG_ADMIN}>
        <IdeaCard
          idea={idea('x', effort)}
          boardId="b1"
          previousStatusId={null}
          nextStatusId={null}
          canMove={false}
          upvoteDenial={null}
          selected={false}
          onOpen={() => {}}
        />
      </SessionProvider>
    )
    const { rerender } = render(card('Low'))
    expect(screen.getByText('Low effort')).toBeTruthy()
    rerender(card(null))
    expect(screen.queryByText(/effort/)).toBeNull()
  })
})
