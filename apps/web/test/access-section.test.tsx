import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccessSection } from '@/components/access/access-section'
import { BoardDrawer, type BoardFormData } from '@/components/boards/board-drawer'
import type { AccessSetup } from '@/lib/types'
import { stubDialogMethods } from './support/dialog'

stubDialogMethods()

/**
 * The board form's Access section (BAG-6b): Everyone or Restricted, the combined picker, the list
 * kept when switched back (BAG-2e), the empty-list callout, and the head count, which exists only
 * when roles are known (an Org Admin read) and never from `/members` data.
 */
vi.mock('@/lib/server/board-actions', () => ({
  createBoardInPlace: vi.fn(),
  saveBoardInPlace: vi.fn(),
}))

const ADMIN = { id: 'u-admin', name: 'Ann Admin', role: 'OrgAdmin' as const, active: true }
const CREATOR = { id: 'u-me', name: 'Cora Creator', role: 'User' as const, active: true }
const ADA = { id: 'u-ada', name: 'Ada Lovelace', role: 'User' as const, active: true }
const BOB = { id: 'u-bob', name: 'Bob Stone', role: 'User' as const, active: true }
const GONE = { id: 'u-gone', name: 'Gil Gone', role: 'User' as const, active: false }

function setup(over: Partial<AccessSetup> = {}): AccessSetup {
  return {
    restricted: false,
    userIds: [],
    groupIds: [],
    organizationName: 'Acme Robotics',
    creator: { id: CREATOR.id, name: CREATOR.name },
    readerId: ADMIN.id,
    people: [ADMIN, CREATOR, ADA, BOB, GONE],
    groups: [{ id: 'g-1', name: 'Core team', memberIds: [BOB.id], memberCount: 2 }],
    ...over,
  }
}

function show(over: Partial<AccessSetup> = {}) {
  return render(
    <form>
      <AccessSection setup={setup(over)} />
    </form>,
  )
}

const hidden = (name: string) =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)).map(
    (input) => input.value,
  )
const choose = (label: RegExp) => fireEvent.click(screen.getByRole('radio', { name: label }))
const RESTRICTED = /Only people and groups I choose/
const EVERYONE = /Everyone in Acme Robotics/

async function add(name: string) {
  const picker = screen.getByRole('combobox')
  fireEvent.focus(picker)
  fireEvent.change(picker, { target: { value: name } })
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

describe('choosing who can see the board', () => {
  it('posts Organization by default and Restricted once chosen', () => {
    show()
    expect(hidden('visibility')).toEqual(['Organization'])
    expect(screen.queryByRole('combobox')).toBeNull()

    choose(RESTRICTED)
    expect(hidden('visibility')).toEqual(['Restricted'])
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('names the organization on the Everyone choice', () => {
    show()
    expect(screen.getByRole('radio', { name: EVERYONE })).toBeTruthy()
  })

  it('posts the chosen people and groups', async () => {
    show({ restricted: true })
    await add('Core team')
    await add('Ada')
    expect(hidden('accessGroupIds')).toEqual(['g-1'])
    expect(hidden('accessUserIds')).toEqual([ADA.id])
  })

  it('does not offer Org Admins or the creator, who always see the board', () => {
    show({ restricted: true })
    const picker = screen.getByRole('combobox')
    fireEvent.focus(picker)
    const names = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)
    expect(names.join('|')).not.toContain('Ann Admin')
    expect(names.join('|')).not.toContain('Cora Creator')
    expect(names.join('|')).toContain('Ada Lovelace')
    expect(names.join('|')).toContain('Core team')
  })

  it('removes a chosen person from the posted list', () => {
    show({ restricted: true, userIds: [ADA.id, BOB.id] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada Lovelace' }))
    expect(hidden('accessUserIds')).toEqual([BOB.id])
  })
})

describe('switching back to Everyone', () => {
  it('keeps the list posted and says it is kept', () => {
    show({ restricted: true, userIds: [ADA.id], groupIds: ['g-1'] })
    expect(screen.queryByText(/Your list is kept/)).toBeNull()

    choose(EVERYONE)

    expect(hidden('visibility')).toEqual(['Organization'])
    expect(hidden('accessUserIds')).toEqual([ADA.id])
    expect(hidden('accessGroupIds')).toEqual(['g-1'])
    expect(screen.getByText(/Your list is kept and applies again/)).toBeTruthy()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
  })

  it('freezes the list: the picker is disabled and chips cannot be removed', () => {
    show({ restricted: true, userIds: [ADA.id] })
    choose(EVERYONE)
    expect((screen.getByRole('combobox') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Remove Ada Lovelace' })).toBeNull()
  })

  it('applies the kept list again when Restricted is chosen once more', () => {
    show({ restricted: true, userIds: [ADA.id] })
    choose(EVERYONE)
    choose(RESTRICTED)
    expect(screen.queryByText(/Your list is kept/)).toBeNull()
    expect(hidden('visibility')).toEqual(['Restricted'])
    expect(hidden('accessUserIds')).toEqual([ADA.id])
  })

  it('shows no note when Everyone has nothing listed', () => {
    show()
    expect(screen.queryByText(/Your list is kept/)).toBeNull()
  })
})

describe('the empty Restricted callout', () => {
  it('warns that only Org Admins and the creator can see it', () => {
    show({ restricted: true })
    expect(screen.getByRole('note').textContent).toContain(
      'only Org Admins and Cora Creator can see this board',
    )
  })

  it('says "you" when the reader is the creator', () => {
    show({ restricted: true, readerId: CREATOR.id })
    expect(screen.getByRole('note').textContent).toContain('only Org Admins and you can see')
  })

  it('is not shown for Everyone, or once someone is chosen', () => {
    const everyone = show()
    expect(screen.queryByRole('note')).toBeNull()
    everyone.unmount()
    show({ restricted: true, userIds: [ADA.id] })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('appears after the last chosen person is removed', () => {
    show({ restricted: true, userIds: [ADA.id] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada Lovelace' }))
    expect(screen.getByRole('note')).toBeTruthy()
  })
})

describe('the head count', () => {
  it('counts Org Admins, the creator, direct picks and group members among active people', () => {
    // Active: Ann (admin), Cora (creator), Ada (direct), Bob (via Core team); Gil is inactive.
    show({ restricted: true, userIds: [ADA.id, GONE.id], groupIds: ['g-1'] })
    expect(document.body.textContent).toContain('4 of 4 people can see this board')
  })

  it('counts fewer when only Org Admins and the creator are in', () => {
    show({ restricted: true })
    expect(document.body.textContent).toContain('2 of 4 people can see this board')
  })

  it('counts everyone active under Everyone, with no Who? link', () => {
    show()
    expect(document.body.textContent).toContain('4 people can see this board')
    expect(screen.queryByRole('button', { name: 'Who?' })).toBeNull()
  })

  it('lists who and why when Who? is opened, and closes again', () => {
    show({ restricted: true, userIds: [ADA.id], groupIds: ['g-1'] })
    const who = screen.getByRole('button', { name: 'Who?' })
    expect(who.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Through Core team')).toBeNull()

    fireEvent.click(who)

    expect(who.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Org Admin')).toBeTruthy()
    expect(screen.getByText('Created the board')).toBeTruthy()
    expect(screen.getByText('Chosen directly')).toBeTruthy()
    expect(screen.getByText('Through Core team')).toBeTruthy()

    fireEvent.click(who)
    expect(screen.queryByText('Through Core team')).toBeNull()
  })

  it('is absent, with no Who? link, when the people carry no roles (a /members read)', () => {
    show({
      restricted: true,
      people: [ADA, BOB].map((person) => ({ ...person, role: null })),
    })
    expect(document.body.textContent).not.toMatch(/people can see this board/)
    expect(screen.queryByRole('button', { name: 'Who?' })).toBeNull()
    // The rest of the section still works.
    expect(screen.getByRole('combobox')).toBeTruthy()
  })
})

describe('where the Access section is offered', () => {
  const STATUSES = [
    { id: 's-new', name: 'New', color: '#111' },
    { id: 's-done', name: 'Complete', color: '#222' },
  ]
  function drawer(boardId: string | null, access?: AccessSetup) {
    const form: BoardFormData = {
      boardId,
      name: 'Assembly',
      description: '',
      swimlaneIds: ['s-new', 's-done'],
      statuses: STATUSES,
      ...(access ? { access } : {}),
    }
    return render(
      <BoardDrawer
        open={{ mode: boardId === null ? 'create' : 'edit', board: null }}
        form={form}
        isAdmin
        returnFocusTo={null}
        onClose={() => {}}
        onView={() => {}}
        onEdit={() => {}}
        onArchive={() => {}}
      />,
    )
  }

  it('is shown on create when the page supplies the setup', () => {
    drawer(null, setup())
    expect(screen.getByRole('radiogroup', { name: 'Who can see this board' })).toBeTruthy()
  })

  it('is shown on edit for a caller who may manage access', () => {
    drawer('b-1', setup({ restricted: true, userIds: [ADA.id] }))
    expect(screen.getByRole('radiogroup', { name: 'Who can see this board' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: RESTRICTED }) as HTMLInputElement).checked).toBe(true)
  })

  it('is left out of an edit when the caller may not manage access', () => {
    drawer('b-1')
    expect(screen.queryByRole('radiogroup', { name: 'Who can see this board' })).toBeNull()
    expect(document.querySelector('input[name="accessShown"]')).toBeNull()
  })
})
