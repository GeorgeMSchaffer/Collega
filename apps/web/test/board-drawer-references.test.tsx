import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardFormData, BoardView } from '@/components/boards/board-drawer'
import { BoardsScreen } from '@/components/boards/boards-screen'
import { KeyPrefixField } from '@/components/settings/key-prefix-field'
import { boardAdminDenial, boardCreateDenial, type Role } from '@/lib/roles'
import { createBoardInPlace, saveBoardInPlace } from '@/lib/server/board-actions'
import { KEY_PREFIX_RULE } from '@/lib/server/rule-messages'
import { SessionProvider } from '@/lib/session-client'
import type { BoardOverview, CurrentUser, LaneFlags, ReferenceContext } from '@/lib/types'

/**
 * The key prefix field (comp U screen 1, frames A, D, E) and what each role gets from the Boards
 * drawer's lane editor (slice 288). The server actions and the router are the boundary.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards',
  useSearchParams: () => search.params,
}))
vi.mock('@/lib/server/board-actions', () => ({
  setBoardArchived: vi.fn(),
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))

const save = vi.mocked(saveBoardInPlace)
const create = vi.mocked(createBoardInPlace)

beforeEach(() => {
  search.params = new URLSearchParams()
  save.mockReset().mockResolvedValue({ error: null, savedId: 'b-1' })
  create.mockReset().mockResolvedValue({ error: null, savedId: 'b-new' })
})

describe('KeyPrefixField', () => {
  const input = () => screen.getByRole('textbox', { name: /Key prefix/ }) as HTMLInputElement

  it('upper-cases what is typed', () => {
    render(<KeyPrefixField saved={null} />)
    fireEvent.change(input(), { target: { value: 'impl' } })
    expect(input().value).toBe('IMPL')
  })

  it('posts as keyPrefix and caps the length at ten', () => {
    render(<KeyPrefixField saved="IMPL" />)
    expect(input().name).toBe('keyPrefix')
    expect(input().value).toBe('IMPL')
    expect(input().maxLength).toBe(10)
  })

  it('is labelled optional on a board with no prefix, and plain once it has one', () => {
    const { unmount } = render(<KeyPrefixField saved={null} />)
    expect(screen.getByText('Key prefix (optional)')).toBeTruthy()
    unmount()
    render(<KeyPrefixField saved="IMPL" />)
    expect(screen.getByText('Key prefix')).toBeTruthy()
  })

  it.each(['A', '!!', 'AB CD', 'A-B'])('shows the rule message on blur for %j', (value) => {
    render(<KeyPrefixField saved={null} />)
    fireEvent.change(input(), { target: { value } })
    expect(screen.queryByText(KEY_PREFIX_RULE)).toBeNull()
    fireEvent.blur(input())
    expect(screen.getByText(KEY_PREFIX_RULE)).toBeTruthy()
    expect(input().getAttribute('aria-invalid')).toBe('true')
  })

  it.each(['AB', 'A1', 'IMPL', 'ABCDEFGHIJ', '12'])('accepts %j without a message', (value) => {
    render(<KeyPrefixField saved={null} />)
    fireEvent.change(input(), { target: { value } })
    fireEvent.blur(input())
    expect(screen.queryByText(KEY_PREFIX_RULE)).toBeNull()
  })

  it('treats an empty field as no prefix, not an error', () => {
    render(<KeyPrefixField saved="IMPL" />)
    fireEvent.change(input(), { target: { value: '' } })
    fireEvent.blur(input())
    expect(screen.queryByText(KEY_PREFIX_RULE)).toBeNull()
  })

  it('clears the rule message once the value is valid again', () => {
    render(<KeyPrefixField saved={null} />)
    fireEvent.change(input(), { target: { value: 'A' } })
    fireEvent.blur(input())
    fireEvent.change(input(), { target: { value: 'AB' } })
    expect(screen.queryByText(KEY_PREFIX_RULE)).toBeNull()
  })

  it('shows a 409 refusal’s message on the field, and drops it when the person types', () => {
    render(
      <KeyPrefixField
        saved={null}
        refusal={{ message: 'IMPL is already used by another board.', locked: false }}
      />,
    )
    expect(screen.getByText('IMPL is already used by another board.')).toBeTruthy()
    expect(input().readOnly).toBe(false)
    fireEvent.change(input(), { target: { value: 'IMP2' } })
    expect(screen.queryByText('IMPL is already used by another board.')).toBeNull()
  })

  it('shows a fresh refusal after an earlier one was answered by typing', () => {
    const first = { message: 'IMPL is already used by another board.', locked: false }
    const { rerender } = render(<KeyPrefixField saved={null} refusal={first} />)
    fireEvent.change(input(), { target: { value: 'IMP2' } })
    rerender(
      <KeyPrefixField
        saved={null}
        refusal={{ message: 'IMP2 is already used by another board.', locked: false }}
      />,
    )
    expect(screen.getByText('IMP2 is already used by another board.')).toBeTruthy()
  })

  describe('locked by a 422 keyPrefixLocked', () => {
    const locked = {
      message: 'Keys have been issued on this board, so the prefix can’t change.',
      locked: true,
    }

    it('turns read-only, with the reason and what the keys look like', () => {
      render(<KeyPrefixField saved="IMPL" refusal={locked} />)
      expect(input().readOnly).toBe(true)
      expect(
        screen.getByText(
          /Locked\. Keys have been issued on this board, so the prefix can’t change\. Items on this board are keyed IMPL-1, IMPL-2 … and never renumbered\./,
        ),
      ).toBeTruthy()
    })

    it('shows the prefix as saved, not what was typed before the refusal', () => {
      const { rerender } = render(<KeyPrefixField saved="IMPL" />)
      fireEvent.change(input(), { target: { value: 'NEW' } })
      rerender(<KeyPrefixField saved="IMPL" refusal={locked} />)
      expect(input().value).toBe('IMPL')
    })

    it('shows no rule error even if what was typed is not a valid prefix', () => {
      const { rerender } = render(<KeyPrefixField saved="IMPL" />)
      fireEvent.change(input(), { target: { value: '!' } })
      fireEvent.blur(input())
      rerender(<KeyPrefixField saved="IMPL" refusal={locked} />)
      expect(screen.queryByText(KEY_PREFIX_RULE)).toBeNull()
      expect(input().getAttribute('aria-invalid')).not.toBe('true')
    })

    it('still posts the saved value, so a re-save sends the prefix unchanged', () => {
      const { container } = render(
        <form>
          <KeyPrefixField saved="IMPL" refusal={locked} />
        </form>,
      )
      const data = new FormData(container.querySelector('form') as HTMLFormElement)
      expect(data.get('keyPrefix')).toBe('IMPL')
    })

    it('has no key example when the saved prefix is empty', () => {
      render(<KeyPrefixField saved={null} refusal={locked} />)
      expect(screen.queryByText(/never renumbered/)).toBeNull()
      expect(input().value).toBe('')
    })
  })
})

const NONE: LaneFlags = { isFinal: false, referencesBoardId: null, autoCreateTask: false }
const STATUSES = [
  { id: 's-new', name: 'New', color: '#111111' },
  { id: 's-done', name: 'Done', color: '#222222' },
]
const CONTEXT: ReferenceContext = {
  choices: [
    {
      id: 'b-impl',
      name: 'Implementation',
      keyPrefix: 'IMPL',
      firstLaneName: 'Todo',
      hasReferenceLane: false,
    },
  ],
  referencedBy: [],
}

function overview(over: Partial<BoardOverview> = {}): BoardOverview {
  return {
    id: 'b-1',
    name: 'Discovery',
    description: null,
    ideaCount: 0,
    laneCount: 2,
    createdAtUtc: '2026-09-01T00:00:00.000Z',
    createdOn: '1 Sep 2026',
    createdBy: null,
    lanes: [],
    topTags: [],
    tagCount: 0,
    userStatusMoves: false,
    isArchived: false,
    archivedOn: null,
    keyPrefix: 'DISC',
    sprintsEnabled: false,
    ideaFeaturesEnabled: true,
    ...over,
  }
}

const VIEW: BoardView = {
  boardId: 'b-1',
  lanes: STATUSES,
  flags: { 's-new': { ...NONE, referencesBoardId: 'b-impl', autoCreateTask: true } },
  references: CONTEXT,
}

const FORM: BoardFormData = {
  boardId: 'b-1',
  name: 'Discovery',
  description: '',
  userStatusMoves: false,
  swimlaneIds: ['s-new', 's-done'],
  laneFlags: { 's-new': { ...NONE, referencesBoardId: 'b-impl' } },
  laneIdeaCounts: {},
  keyPrefix: 'DISC',
  ideaFeaturesEnabled: true,
  references: CONTEXT,
  statuses: STATUSES,
}

function user(role: Role): CurrentUser {
  return {
    userId: `user-${role}`,
    displayName: role,
    initials: 'XX',
    role,
    roleLabel: role,
    organizationId: role === 'SiteAdmin' ? null : 'org-1',
    organizationName: role === 'SiteAdmin' ? null : 'Acme',
    viewingAs: null,
  }
}

function screenAs(
  role: Role,
  props: { board?: BoardOverview; form?: BoardFormData | null; view?: BoardView | null } = {},
) {
  const children: ReactNode = (
    <BoardsScreen
      boards={[props.board ?? overview()]}
      adminDenial={boardAdminDenial(role)}
      createDenial={boardCreateDenial(role)}
      form={props.form ?? null}
      view={props.view === undefined ? VIEW : props.view}
    />
  )
  return render(<SessionProvider user={user(role)}>{children}</SessionProvider>)
}

const dialog = () => screen.getByRole('complementary')

describe('the Boards drawer in view mode, by role', () => {
  const BANNER = 'You can see this board’s settings but only an Org Admin can change them.'

  beforeEach(() => {
    search.params = new URLSearchParams('board=b-1')
  })

  it('gives an Org Admin the lanes as values with an Edit button and no banner', () => {
    screenAs('OrgAdmin')
    expect(within(dialog()).getByRole('button', { name: /Edit/ })).toBeTruthy()
    expect(within(dialog()).queryByText(BANNER)).toBeNull()
    expect(
      within(dialog()).getByText('References Implementation. Auto-creates one task on entry.'),
    ).toBeTruthy()
  })

  it.each(['User', 'ReadOnly'] as const)(
    'gives a %s the values and the banner, and no controls',
    (role) => {
      screenAs(role)
      const d = within(dialog())
      expect(d.getByText(BANNER)).toBeTruthy()
      expect(d.getByText('References Implementation. Auto-creates one task on entry.')).toBeTruthy()
      expect(d.getByText('IMPL')).toBeTruthy()
      expect(d.queryByRole('button', { name: /Edit/ })).toBeNull()
      expect(d.queryByRole('combobox')).toBeNull()
      expect(d.queryByRole('radio')).toBeNull()
      expect(d.queryByRole('switch')).toBeNull()
      expect(d.queryByRole('button', { name: /^Remove / })).toBeNull()
      expect(d.queryByRole('button', { name: /^Move / })).toBeNull()
      expect(d.queryByRole('button', { name: /Archive/ })).toBeNull()
    },
  )

  it('shows an Org Admin no Edit on an archived board', () => {
    screenAs('OrgAdmin', { board: overview({ isArchived: true, archivedOn: '2 Sep 2026' }) })
    expect(within(dialog()).queryByRole('button', { name: /Edit/ })).toBeNull()
  })

  it('leaves the lane section out until the page has the board’s lanes', () => {
    screenAs('OrgAdmin', { view: null })
    expect(within(dialog()).queryByRole('heading', { name: 'Lanes' })).toBeNull()
  })

  it('shows another board’s lanes to nobody: a view for a different board is ignored', () => {
    screenAs('OrgAdmin', { view: { ...VIEW, boardId: 'b-other' } })
    expect(within(dialog()).queryByRole('heading', { name: 'Lanes' })).toBeNull()
  })
})

describe('the Boards drawer in edit mode', () => {
  it('gives an Org Admin the Kind, References and auto-create controls', () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    expect(d.getByRole('group', { name: 'Kind of New' })).toBeTruthy()
    expect(d.getByRole('combobox', { name: 'References board for New' })).toBeTruthy()
    expect(d.getByRole('switch', { name: 'Auto-create one task on entry' })).toBeTruthy()
    expect(d.getByRole('switch', { name: 'Idea features' })).toBeTruthy()
  })

  it('gives a User asking for edit mode only the values: the page loads no form for them', () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    screenAs('User', { form: null })
    const d = within(dialog())
    expect(d.queryByRole('combobox')).toBeNull()
    expect(d.queryByRole('switch')).toBeNull()
  })

  it('saves what was set: flags, key prefix and idea features reach the action', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.click(d.getByRole('switch', { name: 'Auto-create one task on entry' }))
    fireEvent.click(
      within(d.getByRole('group', { name: 'Kind of Done' })).getByRole('radio', { name: 'Final' }),
    )
    fireEvent.click(d.getByRole('switch', { name: 'Idea features' }))
    fireEvent.change(d.getByRole('textbox', { name: /Key prefix/ }), { target: { value: 'disc2' } })
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const data = save.mock.calls[0]?.[1] as FormData
    expect(data.get('keyPrefix')).toBe('DISC2')
    expect(data.get('ideaFeaturesEnabled')).toBe('false')
    expect(data.get('boardId')).toBe('b-1')
    expect(JSON.parse(String(data.get('laneFlags')))).toMatchObject({
      's-new': { referencesBoardId: 'b-impl', autoCreateTask: true },
      's-done': { isFinal: true },
    })
  })

  it('turns a keyPrefixLocked refusal into the locked field with no banner', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    save.mockResolvedValue({
      error: null,
      savedId: null,
      keyPrefix: {
        message: 'Keys have been issued on this board, so the prefix can’t change.',
        locked: true,
      },
    })
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.change(d.getByRole('textbox', { name: /Key prefix/ }), { target: { value: 'NEW' } })
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    const field = (await waitFor(() => {
      const el = d.getByRole('textbox', { name: /Key prefix/ }) as HTMLInputElement
      expect(el.readOnly).toBe(true)
      return el
    })) as HTMLInputElement
    expect(field.value).toBe('DISC')
    expect(d.queryByRole('alert')).toBeNull()
  })

  it('shows a lane refusal on its lane and nothing in the banner', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    save.mockResolvedValue({
      error: null,
      savedId: null,
      laneErrors: { 's-new': 'A Final lane can’t reference a board.' },
    })
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    const alert = await d.findByRole('alert')
    expect(alert.textContent).toBe('A Final lane can’t reference a board.')
    expect(alert.closest('li')?.textContent).toContain('New')
    expect(d.getAllByRole('alert')).toHaveLength(1)
  })

  it('shows a banner refusal as its sentence, never the bare key', async () => {
    search.params = new URLSearchParams('board=b-1&mode=edit')
    save.mockResolvedValue({
      error:
        'A lane with ideas in it can’t have its reference changed or removed, and can’t be removed.',
      savedId: null,
    })
    screenAs('OrgAdmin', { form: FORM })
    const d = within(dialog())
    fireEvent.click(d.getByRole('button', { name: 'Save changes' }))
    const alert = await d.findByRole('alert')
    expect(alert.textContent).toMatch(/^A lane with ideas in it/)
    expect(alert.textContent).not.toMatch(/laneInUse/)
  })

  it('creates a board with the same fields from the New board drawer', async () => {
    search.params = new URLSearchParams('board=new')
    screenAs('OrgAdmin', {
      form: { ...FORM, boardId: null, name: '', keyPrefix: null, laneFlags: {} },
    })
    const d = within(dialog())
    expect(d.queryByRole('option', { name: /this board/ })).toBeNull()
    fireEvent.change(d.getByRole('textbox', { name: 'Name' }), { target: { value: 'Fresh' } })
    fireEvent.click(d.getByRole('button', { name: 'Create board' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    const data = create.mock.calls[0]?.[1] as FormData
    expect(data.get('keyPrefix')).toBe('')
    expect(data.has('boardId')).toBe(false)
  })
})
