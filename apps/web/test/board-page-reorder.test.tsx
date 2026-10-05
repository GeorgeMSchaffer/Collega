import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import type { Role } from '@/lib/roles'
import { actAs } from './support/acting-role'

/**
 * Who the board page offers lane reordering to. `currentUser().role` is the *acting* role, so a
 * Site Admin inside View As is whoever they are viewing as: an Org Admin there reorders, and a
 * Site Admin outside View As (who has no organization to reorder in) does not.
 */
vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/' }))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/ideas/load-idea-drawer', () => ({
  loadIdeaDrawer: async () => ({ mode: null, idea: null, formOptions: null, missing: false }),
}))
vi.mock('@/lib/data', () => ({
  getBoard: async () => ({
    id: 'b-1',
    name: 'Assembly',
    description: null,
    isArchived: false,
    allowUserStatusUpdate: true,
    lanes: [{ id: 'new', name: 'New', color: '#999' }],
  }),
  getBoardIdeaList: async () => ({ ideas: [], totalCount: 0 }),
  getTagRefs: async () => [],
}))

function find(node: ReactNode): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child)
      if (hit) return hit
    }
    return null
  }
  if (!isValidElement(node)) return null
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === IdeaWorkspace) return element as ReactElement<Record<string, unknown>>
  return find(element.props.children)
}

async function canReorder(role: Role): Promise<unknown> {
  actAs(role)
  const { default: BoardPage } = await import('@/app/(desk)/boards/[boardId]/page')
  const tree = await BoardPage({
    params: Promise.resolve({ boardId: 'b-1' }),
    searchParams: Promise.resolve({}),
  })
  const workspace = find(tree)
  if (!workspace) throw new Error('the board page rendered no workspace')
  return (workspace.props.board as { canReorder: unknown }).canReorder
}

describe('board page lane reordering', () => {
  it('is on for an Org Admin', async () => {
    expect(await canReorder('OrgAdmin')).toBe(true)
  })

  it.each([['User'], ['ReadOnly'], ['SiteAdmin']] as const)('is off for %s', async (role) => {
    expect(await canReorder(role)).toBe(false)
  })
})
