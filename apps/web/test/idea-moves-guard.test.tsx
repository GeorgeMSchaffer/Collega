import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/list/confirm-dialog'
import { BoardFields } from '@/components/settings/board-form'
import type { Status } from '@/lib/types'
import { stubDialogMethods } from './support/dialog'

stubDialogMethods()

/**
 * The board form's confirm step for a save that removes lanes still holding ideas
 * (`SPEC/20-feature-boards-and-statuses.md` rule 14): it asks only when a removed lane holds ideas,
 * one lane picker per such lane defaulting to the first remaining lane, and posts the choice as
 * `moveFrom`/`moveTo` pairs. The server actions are the boundary; what the form would post is read
 * off the submit event that gets through.
 */
vi.mock('@/lib/server/board-actions', () => ({ createBoard: vi.fn(), saveBoard: vi.fn() }))

const NEW: Status = { id: 'status-new', name: 'New / Pending', color: '#111111' }
const REVIEW: Status = { id: 'status-review', name: 'In Review', color: '#222222' }
const DONE: Status = { id: 'status-done', name: 'Done', color: '#333333' }
const PARKED: Status = { id: 'status-parked', name: 'Parked', color: '#444444' }
const STATUSES = [NEW, REVIEW, DONE, PARKED]

type Posted = { moveFrom: string[]; moveTo: string[]; swimlaneIds: string[] }

function renderBoard(lanes: Status[], laneIdeaCounts: Record<string, number>) {
  const view = render(
    <form>
      <BoardFields
        boardId="board-1"
        defaultName="Acme Board"
        userStatusMoves={false}
        swimlaneIds={lanes.map((lane) => lane.id)}
        laneIdeaCounts={laneIdeaCounts}
        statuses={STATUSES}
      />
      <button type="submit">Save board</button>
    </form>,
  )
  const form = view.container.querySelector('form') as HTMLFormElement
  // Added after the guard's own listener, so it sees whether the guard let the submit through.
  const posted: Posted[] = []
  form.addEventListener('submit', (event) => {
    if (!event.defaultPrevented) {
      const data = new FormData(form)
      posted.push({
        moveFrom: data.getAll('moveFrom').map(String),
        moveTo: data.getAll('moveTo').map(String),
        swimlaneIds: data.getAll('swimlaneIds').map(String),
      })
    }
    event.preventDefault()
  })
  return { form, posted }
}

const remove = (lane: Status) =>
  fireEvent.click(screen.getByRole('button', { name: `Remove ${lane.name} from this board` }))
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save board' }))
const dialog = () => document.querySelector('dialog') as HTMLDialogElement
const isAsking = () => dialog().hasAttribute('open')
const moveAndSave = () =>
  within(dialog()).getByRole('button', { name: 'Move ideas and save', hidden: true })

describe('IdeaMovesGuard', () => {
  it('saves straight away when no lane is removed', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    save()

    expect(isAsking()).toBe(false)
    expect(posted).toEqual([
      { moveFrom: [], moveTo: [], swimlaneIds: [NEW.id, REVIEW.id, DONE.id] },
    ])
  })

  it('saves straight away when the removed lane holds no ideas', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    remove(DONE)
    save()

    expect(isAsking()).toBe(false)
    expect(posted).toEqual([{ moveFrom: [], moveTo: [], swimlaneIds: [NEW.id, REVIEW.id] }])
  })

  it('asks before saving when a removed lane holds ideas, and sends nothing yet', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    remove(REVIEW)
    save()

    expect(isAsking()).toBe(true)
    expect(posted).toEqual([])
    expect(within(dialog()).getByText('Move the ideas in In Review?')).toBeTruthy()
  })

  it('offers one picker for the lane, with its count, defaulting to the first remaining lane', () => {
    renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    remove(REVIEW)
    save()

    const pickers = within(dialog()).getAllByRole('combobox', { hidden: true })
    expect(pickers).toHaveLength(1)
    const picker = within(dialog()).getByLabelText(
      '3 ideas are in In Review. Move them to:',
    ) as HTMLSelectElement
    expect(picker.value).toBe(NEW.id)
    expect([...picker.options].map((option) => option.text)).toEqual(['New / Pending', 'Done'])
  })

  it('offers one picker per removed lane that holds ideas, in the singular for one idea', () => {
    renderBoard([NEW, REVIEW, DONE, PARKED], { [REVIEW.id]: 1, [DONE.id]: 2 })

    remove(REVIEW)
    remove(DONE)
    save()

    expect(within(dialog()).getByText('Move the ideas in the removed lanes?')).toBeTruthy()
    const labels = within(dialog())
      .getAllByRole('combobox', { hidden: true })
      .map((picker) => picker.getAttribute('id'))
      .map((id) => document.querySelector(`label[for="${id}"]`)?.textContent)
    expect(labels).toEqual([
      '1 idea is in In Review. Move it to:',
      '2 ideas are in Done. Move them to:',
    ])
  })

  it('defaults to the next lane when the first lane is the one removed', () => {
    renderBoard([NEW, REVIEW, DONE], { [NEW.id]: 2 })

    remove(NEW)
    save()

    const picker = within(dialog()).getByRole('combobox', { hidden: true }) as HTMLSelectElement
    expect(picker.value).toBe(REVIEW.id)
  })

  it('posts each removed lane with the lane chosen for it once confirmed', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE, PARKED], {
      [REVIEW.id]: 1,
      [DONE.id]: 2,
    })

    remove(REVIEW)
    remove(DONE)
    save()
    fireEvent.change(within(dialog()).getByLabelText('2 ideas are in Done. Move them to:'), {
      target: { value: PARKED.id },
    })
    fireEvent.click(moveAndSave())

    expect(isAsking()).toBe(false)
    expect(posted).toEqual([
      {
        moveFrom: [REVIEW.id, DONE.id],
        moveTo: [NEW.id, PARKED.id],
        swimlaneIds: [NEW.id, PARKED.id],
      },
    ])
  })

  it('saves nothing on Cancel, and asks again on the next save', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    remove(REVIEW)
    save()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel', hidden: true }))

    expect(isAsking()).toBe(false)
    expect(posted).toEqual([])

    save()
    expect(isAsking()).toBe(true)
    expect(posted).toEqual([])
  })

  it('submits once when the confirm button is clicked twice', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    remove(REVIEW)
    save()
    const confirm = moveAndSave()
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(posted).toHaveLength(1)
  })

  it('asks again on a later save after a confirmed one', () => {
    const { posted } = renderBoard([NEW, REVIEW, DONE], { [REVIEW.id]: 3 })

    remove(REVIEW)
    save()
    fireEvent.click(moveAndSave())
    save()

    expect(posted).toHaveLength(1)
    expect(isAsking()).toBe(true)
  })
})

describe('ConfirmDialog keyboard cycle', () => {
  const tab = (shiftKey = false) =>
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey })
    })

  it('cycles through its children as well as its buttons', () => {
    render(
      <ConfirmDialog
        open
        title="Move the ideas in In Review?"
        description="Removing this lane keeps its 3 ideas."
        confirmLabel="Move ideas and save"
        destructive={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        <select aria-label="Target lane">
          <option>New / Pending</option>
        </select>
      </ConfirmDialog>,
    )
    const picker = screen.getByRole('combobox', { name: 'Target lane', hidden: true })
    const cancel = screen.getByRole('button', { name: 'Cancel', hidden: true })
    const confirm = screen.getByRole('button', { name: 'Move ideas and save', hidden: true })

    expect(document.activeElement).toBe(cancel)

    confirm.focus()
    tab()
    expect(document.activeElement).toBe(picker)

    tab(true)
    expect(document.activeElement).toBe(confirm)
  })

  it('still cycles between Cancel and the action alone without children', () => {
    render(
      <ConfirmDialog
        open
        title="Archive this board?"
        description="It leaves the Boards list."
        confirmLabel="Archive board"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    const cancel = screen.getByRole('button', { name: 'Cancel', hidden: true })
    const confirm = screen.getByRole('button', { name: 'Archive board', hidden: true })

    expect(document.activeElement).toBe(cancel)
    tab(true)
    expect(document.activeElement).toBe(confirm)
    tab()
    expect(document.activeElement).toBe(cancel)
  })
})
