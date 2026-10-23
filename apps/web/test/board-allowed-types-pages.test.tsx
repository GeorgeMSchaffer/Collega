import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardsPage from '@/app/(desk)/boards/page'
import EditBoardPage from '@/app/(desk)/settings/boards/[boardId]/page'
import { actAs } from './support/acting-role'

/**
 * Who is offered the Allowed idea types control: the pages decide, from the board read's
 * `canSetAllowedIdeaTypes`, whether to hand the form its setup. Create always gets it for a role
 * that may create; an edit gets it only for a caller the API says may set it; Read Only reaches no
 * form at all. The readers and the screens are the boundary; what is asserted is the props.
 */
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => undefined }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/boards/load-pull-setup', () => ({
  loadPullSetup: async () => ({
    isAdmin: true,
    tags: [],
    members: [],
    archivedBoardIds: [],
    archived: false,
  }),
}))
const screenProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@/components/boards/boards-screen', () => ({
  BoardsScreen: (props: Record<string, unknown>) => {
    screenProps.current = props
    return null
  },
}))
const formProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@/components/settings/board-form', () => ({
  BoardForm: (props: Record<string, unknown>) => {
    formProps.current = props
    return null
  },
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))

const data = vi.hoisted(() => ({
  getBoard: vi.fn(),
  getBoardOverviews: vi.fn(),
  getIdeaTypeChoices: vi.fn(),
  getReferenceContext: vi.fn(),
  getStatuses: vi.fn(),
}))
vi.mock('@/lib/data', () => ({ ...data, SWIMLANE_FLOOR: 2 }))

const CHOICES = [
  { id: 't-1', name: 'Idea' },
  { id: 't-2', name: 'Continuous Improvement' },
]
const lane = {
  id: 's-1',
  name: 'New',
  color: '#111',
  isFinal: false,
  referencesBoardId: null,
  autoCreateTask: false,
  ideaCount: 0,
}
const overview = { id: 'b-1', name: 'Assembly', isArchived: false, keyPrefix: null, lanes: [lane] }

function board(over: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    name: 'Assembly',
    description: null,
    isArchived: false,
    ideaFeaturesEnabled: true,
    lanes: [lane],
    allowedIdeaTypeIds: ['t-2'],
    canSetAllowedIdeaTypes: true,
    ...over,
  }
}

beforeEach(() => {
  screenProps.current = null
  formProps.current = null
  data.getBoard.mockReset().mockResolvedValue(board())
  data.getBoardOverviews.mockReset().mockResolvedValue([overview])
  data.getIdeaTypeChoices.mockReset().mockResolvedValue(CHOICES)
  data.getReferenceContext.mockReset().mockResolvedValue({ choices: [], referencedBy: [] })
  data.getStatuses.mockReset().mockResolvedValue([
    { id: 's-1', name: 'New', color: '#111' },
    { id: 's-2', name: 'Done', color: '#222' },
  ])
})

async function boardsPage(search: Record<string, string>) {
  render((await BoardsPage({ searchParams: Promise.resolve(search) })) as ReactElement)
  return screenProps.current?.form as { allowedIdeaTypes?: unknown } | null
}

describe('the Boards screen drawer form', () => {
  it.each(['OrgAdmin', 'User'] as const)(
    'offers %s the control, empty, when creating',
    async (role) => {
      actAs(role)
      const form = await boardsPage({ board: 'new' })
      expect(form?.allowedIdeaTypes).toEqual({ choices: CHOICES, selectedIds: [] })
    },
  )

  it('offers an Org Admin editing a board they may set the stored list ticked', async () => {
    actAs('OrgAdmin')
    const form = await boardsPage({ board: 'b-1', mode: 'edit' })
    expect(form?.allowedIdeaTypes).toEqual({ choices: CHOICES, selectedIds: ['t-2'] })
  })

  it('leaves the control out of an edit the API says the caller may not set, and does not read the types', async () => {
    actAs('OrgAdmin')
    data.getBoard.mockResolvedValue(board({ canSetAllowedIdeaTypes: false }))
    const form = await boardsPage({ board: 'b-1', mode: 'edit' })
    expect(form).not.toBeNull()
    expect(form?.allowedIdeaTypes).toBeUndefined()
    expect(data.getIdeaTypeChoices).not.toHaveBeenCalled()
  })

  it('opens no create form for Read Only, so the control cannot appear', async () => {
    actAs('ReadOnly')
    expect(await boardsPage({ board: 'new' })).toBeNull()
  })

  it('opens no edit form for Read Only', async () => {
    actAs('ReadOnly')
    expect(await boardsPage({ board: 'b-1', mode: 'edit' })).toBeNull()
  })
})

describe('the Settings edit board page', () => {
  async function settingsPage() {
    render((await EditBoardPage({ params: Promise.resolve({ boardId: 'b-1' }) })) as ReactElement)
    return formProps.current
  }

  it('hands the form the setup when the caller may set the list', async () => {
    actAs('OrgAdmin')
    expect((await settingsPage())?.allowedIdeaTypes).toEqual({
      choices: CHOICES,
      selectedIds: ['t-2'],
    })
  })

  it('hands the form no setup when the caller may not', async () => {
    actAs('OrgAdmin')
    data.getBoard.mockResolvedValue(board({ canSetAllowedIdeaTypes: false }))
    const props = await settingsPage()
    expect(props).not.toBeNull()
    expect(props?.allowedIdeaTypes).toBeUndefined()
  })
})
