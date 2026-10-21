import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReorderableBody } from '@/components/settings/reorderable-body'

/**
 * The drag-to-reorder body Settings → Statuses uses (slice 145): the grip drag and the move
 * up / move down buttons are two inputs to one save of the complete order; the order shows at once
 * and falls back on a refusal; the buttons are `aria-disabled` at the ends and while saving; focus
 * stays on the button just pressed; and the new position is announced.
 */
const ROWS = ['New', 'Review', 'Done'].map((name) => ({
  id: name.toLowerCase(),
  label: name,
  cells: <td>{name}</td>,
}))

type Result = { error: string | null }

function renderBody(onReorder: (ids: string[]) => Promise<Result>) {
  return render(
    <table>
      <ReorderableBody rows={ROWS} columns={1} onReorder={onReorder} />
    </table>,
  )
}

/** A save the test settles by hand, so the in-flight state can be looked at. */
function deferred() {
  let settle: (result: Result) => void = () => {}
  const onReorder = vi.fn(
    () =>
      new Promise<Result>((resolve) => {
        settle = resolve
      }),
  )
  const answer = (result: Result) =>
    act(async () => {
      settle(result)
    })
  return { onReorder, answer }
}

const order = () =>
  screen
    .getAllByRole('row')
    .map((row) => within(row).queryAllByRole('cell')[1]?.textContent)
    .filter((text): text is string => Boolean(text))

const button = (label: string, dir: 'up' | 'down') =>
  screen.getByRole('button', { name: `Move ${label} ${dir}` })

async function press(target: HTMLElement) {
  target.focus()
  await act(async () => {
    fireEvent.click(target)
  })
}

const grip = (label: string) => screen.getByTitle(`Drag to reorder ${label}`)
const rowOf = (label: string) =>
  screen.getByText(label, { selector: 'td' }).closest('tr') as HTMLElement
const transfer = () => ({ setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' })

async function dragRow(from: string, onto: string) {
  const dataTransfer = transfer()
  await act(async () => {
    fireEvent.dragStart(grip(from), { dataTransfer })
  })
  await act(async () => {
    fireEvent.dragOver(rowOf(onto), { dataTransfer })
  })
  await act(async () => {
    fireEvent.drop(rowOf(onto), { dataTransfer })
  })
}

describe('move buttons', () => {
  it('post the complete new order once, with the pressed row moved up', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await press(button('Review', 'up'))
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(['review', 'new', 'done'])
  })

  it('move a row down by one place', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await press(button('New', 'down'))
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(['review', 'new', 'done'])
  })

  it('do nothing at the first row going up or the last row going down', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await press(button('New', 'up'))
    await press(button('Done', 'down'))
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('are aria-disabled at the ends and enabled elsewhere', () => {
    renderBody(vi.fn())
    expect(button('New', 'up').getAttribute('aria-disabled')).toBe('true')
    expect(button('Done', 'down').getAttribute('aria-disabled')).toBe('true')
    expect(button('Review', 'up').getAttribute('aria-disabled')).toBeNull()
    expect(button('Review', 'down').getAttribute('aria-disabled')).toBeNull()
  })

  it('show the new order at once, before the save answers', async () => {
    const { onReorder, answer } = deferred()
    renderBody(onReorder)
    await press(button('Done', 'up'))
    expect(order()).toEqual(['New', 'Done', 'Review'])
    await answer({ error: null })
  })

  it('go aria-disabled while the save is in flight and refuse a second move', async () => {
    const { onReorder, answer } = deferred()
    renderBody(onReorder)
    await press(button('Done', 'up'))
    expect(button('Review', 'down').getAttribute('aria-disabled')).toBe('true')
    await press(button('New', 'down'))
    expect(onReorder).toHaveBeenCalledTimes(1)
    await answer({ error: null })
  })

  it('keep focus on the button just pressed after the row moves', async () => {
    const { onReorder, answer } = deferred()
    renderBody(onReorder)
    await press(button('Done', 'up'))
    expect(document.activeElement).toBe(button('Done', 'up'))
    await answer({ error: null })
  })

  it('announce the new position politely once the save succeeds', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await press(button('Done', 'up'))
    const live = screen.getByRole('status')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe('Done moved to position 2 of 3')
  })
})

describe('a refused save', () => {
  it('puts the rows back and shows the message', async () => {
    const { onReorder, answer } = deferred()
    renderBody(onReorder)
    await press(button('Done', 'up'))
    await answer({ error: 'Name every active status exactly once.' })
    expect(order()).toEqual(['New', 'Review', 'Done'])
    expect(screen.getByRole('alert').textContent).toContain(
      'Name every active status exactly once.',
    )
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('is cleared by the next successful save', async () => {
    const onReorder = vi
      .fn()
      .mockResolvedValueOnce({ error: 'Refused' })
      .mockResolvedValue({ error: null })
    renderBody(onReorder)
    await press(button('Done', 'up'))
    expect(screen.queryByRole('alert')).not.toBeNull()
    await press(button('Done', 'up'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('dragging a row by its grip', () => {
  it('drops a row onto another and posts the complete order once', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await dragRow('New', 'Done')
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(['review', 'done', 'new'])
  })

  it('drops upward too', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await dragRow('Done', 'New')
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(['done', 'new', 'review'])
  })

  it('does not save a drop of a row onto itself', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await dragRow('Review', 'Review')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('ignores a drop that is not from a row drag', async () => {
    const onReorder = vi.fn().mockResolvedValue({ error: null })
    renderBody(onReorder)
    await act(async () => {
      fireEvent.drop(rowOf('Done'), { dataTransfer: transfer() })
    })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('puts the rows back and shows the message when the drop is refused', async () => {
    const { onReorder, answer } = deferred()
    renderBody(onReorder)
    await dragRow('New', 'Done')
    expect(order()).toEqual(['Review', 'Done', 'New'])
    await answer({ error: 'No.' })
    expect(order()).toEqual(['New', 'Review', 'Done'])
    expect(screen.getByRole('alert').textContent).toContain('No.')
  })

  it('cannot start a drag while a save is in flight', async () => {
    const { onReorder, answer } = deferred()
    renderBody(onReorder)
    await press(button('Done', 'up'))
    expect(grip('New').getAttribute('draggable')).toBe('false')
    await answer({ error: null })
  })
})
