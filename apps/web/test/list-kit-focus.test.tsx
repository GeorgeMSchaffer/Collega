import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/list/confirm-dialog'
import { Drawer } from '@/components/list/drawer'
import { MultiSelectFilter } from '@/components/list/multi-select-filter'

/**
 * The list kit's keyboard and focus behaviour (comp R): the drawer's Escape and heading focus, the
 * filter popover closing when focus leaves it, and where focus lands when the confirm dialog closes.
 */

// jsdom has `<dialog>` but not its modal methods; these do what the kit relies on — toggle `open`.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (typeof proto.close !== 'function') {
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  }
})

const pressEscape = () => fireEvent.keyDown(document, { key: 'Escape' })

describe('Drawer', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} title="Idea">
        body
      </Drawer>,
    )
    pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape while a modal dialog is open over it', () => {
    const onClose = vi.fn()
    render(
      <>
        <Drawer open onClose={onClose} title="Idea">
          body
        </Drawer>
        <dialog open>confirm</dialog>
      </>,
    )
    pressEscape()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores Escape while an aria-modal dialog is open over it', () => {
    const onClose = vi.fn()
    render(
      <>
        <Drawer open onClose={onClose} title="Idea">
          body
        </Drawer>
        <div role="dialog" aria-modal="true">
          palette
        </div>
      </>,
    )
    pressEscape()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores an Escape something inside already claimed', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} title="Idea">
        <input aria-label="inner" onKeyDown={(event) => event.preventDefault()} />
      </Drawer>,
    )
    fireEvent.keyDown(screen.getByLabelText('inner'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('focuses its heading when it opens', () => {
    render(
      <Drawer open onClose={() => {}} title="Assembly cell">
        body
      </Drawer>,
    )
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Assembly cell' }))
  })

  it('refocuses its heading when focusKey changes while open', () => {
    const view = (focusKey: string) => (
      <Drawer open onClose={() => {}} title="Assembly cell" focusKey={focusKey}>
        <button type="button">Edit</button>
      </Drawer>
    )
    const { rerender } = render(view('view'))
    const edit = screen.getByRole('button', { name: 'Edit' })
    edit.focus()
    expect(document.activeElement).toBe(edit)

    rerender(view('edit'))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Assembly cell' }))
  })

  it('leaves focus alone when re-rendered with the same focusKey', () => {
    const view = (
      <Drawer open onClose={() => {}} title="Assembly cell" focusKey="view">
        <button type="button">Edit</button>
      </Drawer>
    )
    const { rerender } = render(view)
    const edit = screen.getByRole('button', { name: 'Edit' })
    edit.focus()
    rerender(view)
    expect(document.activeElement).toBe(edit)
  })

  it('returns focus to what opened it when it closes', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Drawer open={open} onClose={() => setOpen(false)} title="Idea">
            body
          </Drawer>
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)
    pressEscape()
    expect(document.activeElement).toBe(opener)
  })
})

describe('MultiSelectFilter', () => {
  function renderFilter() {
    render(
      <>
        <MultiSelectFilter
          label="Status"
          options={['Active', 'Archived']}
          selected={[]}
          onChange={() => {}}
        />
        <button type="button">Next control</button>
      </>,
    )
    const pill = screen.getByRole('button', { name: /^Status/ })
    fireEvent.click(pill)
    return pill
  }

  it('closes when focus tabs out of the popover', () => {
    renderFilter()
    const find = screen.getByRole('searchbox', { name: 'Find status' })
    const next = screen.getByRole('button', { name: 'Next control' })

    fireEvent.focusOut(find, { relatedTarget: next })

    expect(screen.queryByRole('dialog', { name: 'Status filter' })).toBeNull()
  })

  it('stays open while focus moves within it', () => {
    renderFilter()
    const find = screen.getByRole('searchbox', { name: 'Find status' })
    const box = screen.getByRole('checkbox', { name: 'Active' })

    fireEvent.focusOut(find, { relatedTarget: box })

    expect(screen.getByRole('dialog', { name: 'Status filter' })).toBeTruthy()
  })

  it('stays open when focus goes nowhere (a click on its own padding)', () => {
    renderFilter()
    fireEvent.focusOut(screen.getByRole('searchbox', { name: 'Find status' }), {
      relatedTarget: null,
    })
    expect(screen.getByRole('dialog', { name: 'Status filter' })).toBeTruthy()
  })

  it('closes on Escape, returns focus to its button, and claims the key', () => {
    const pill = renderFilter()
    const find = screen.getByRole('searchbox', { name: 'Find status' })
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      find.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(screen.queryByRole('dialog', { name: 'Status filter' })).toBeNull()
    expect(document.activeElement).toBe(pill)
  })
})

describe('ConfirmDialog', () => {
  /**
   * A list with a row whose action opens the dialog, as Boards and Ideas use it: confirming removes
   * the row in the same update that closes the dialog, the way a revalidated list does.
   */
  function Harness({ removeOnConfirm }: { removeOnConfirm: boolean }) {
    const [rows, setRows] = useState(['Assembly cell', 'Paint shop'])
    const [asking, setAsking] = useState<string | null>(null)
    return (
      <main>
        <h1>Boards</h1>
        <ul>
          {rows.map((row) => (
            <li key={row}>
              <button type="button" onClick={() => setAsking(row)}>
                Archive {row}
              </button>
            </li>
          ))}
        </ul>
        <ConfirmDialog
          open={asking !== null}
          title="Archive this board?"
          description="It leaves the Boards list."
          confirmLabel="Archive board"
          onConfirm={() => {
            if (removeOnConfirm) setRows((current) => current.filter((row) => row !== asking))
            setAsking(null)
          }}
          onCancel={() => setAsking(null)}
        />
      </main>
    )
  }

  function openFrom(name: string) {
    const opener = screen.getByRole('button', { name })
    opener.focus()
    fireEvent.click(opener)
    return opener
  }

  it('starts on Cancel', () => {
    render(<Harness removeOnConfirm />)
    openFrom('Archive Assembly cell')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('returns focus to its opener when the opener is still there', () => {
    render(<Harness removeOnConfirm={false} />)
    const opener = openFrom('Archive Assembly cell')
    fireEvent.click(screen.getByRole('button', { name: 'Archive board' }))
    expect(document.activeElement).toBe(opener)
  })

  it('returns focus to its opener on Cancel', () => {
    render(<Harness removeOnConfirm />)
    const opener = openFrom('Archive Assembly cell')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.activeElement).toBe(opener)
  })

  it('moves focus to the page heading, not the body, when its opener left the list', () => {
    render(<Harness removeOnConfirm />)
    const opener = openFrom('Archive Assembly cell')
    fireEvent.click(screen.getByRole('button', { name: 'Archive board' }))

    expect(opener.isConnected).toBe(false)
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Boards' }))
  })
})
