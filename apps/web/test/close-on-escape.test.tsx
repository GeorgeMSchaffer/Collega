import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CloseOnEscape } from '@/components/inspector/close-on-escape'
import { CommandPalette } from '@/components/nav/command-palette'

/**
 * The Escape collision.
 *
 * The inspector listens for Escape on the window, so it hears every Escape on the page — including
 * the one that dismisses the command palette. Dismissing the palette on an idea page used to
 * navigate away as well, discarding a comment the reader was part-way through writing.
 *
 * Two guards fix it, and both are needed because the two handlers are registered on the same target
 * and their order is not something either one controls. If the palette registers first it marks the
 * event handled; if the inspector registers first it sees an unhandled event and has to notice the
 * open dialog instead. The last test here is the collision itself, with both components mounted.
 */
const push = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/ideas/ideas-1',
}))

afterEach(() => {
  push.mockClear()
})

function pressEscape(): void {
  fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape', bubbles: true })
}

describe('CloseOnEscape', () => {
  it('navigates to the close href on Escape', () => {
    render(<CloseOnEscape href="/ideas" />)
    pressEscape()
    expect(push).toHaveBeenCalledWith('/ideas')
  })

  it('ignores every other key', () => {
    render(<CloseOnEscape href="/ideas" />)
    fireEvent.keyDown(document.body, { key: 'Enter', bubbles: true })
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, bubbles: true })
    expect(push).not.toHaveBeenCalled()
  })

  it('stays out of the way while a modal dialog is open', () => {
    render(
      <>
        <div role="dialog" aria-modal="true" aria-label="Something modal" />
        <CloseOnEscape href="/ideas" />
      </>,
    )
    pressEscape()
    expect(push).not.toHaveBeenCalled()
  })

  it('still closes when a non-modal dialog is present', () => {
    // The guard is for things that own Escape. A non-modal dialog does not.
    render(
      <>
        <div role="dialog" aria-label="Not modal" />
        <CloseOnEscape href="/ideas" />
      </>,
    )
    pressEscape()
    expect(push).toHaveBeenCalledWith('/ideas')
  })

  it('stays out of the way when the Escape was already handled', () => {
    render(<CloseOnEscape href="/ideas" />)

    const claim = (event: Event) => event.preventDefault()
    document.addEventListener('keydown', claim)
    try {
      fireEvent.keyDown(document.body, { key: 'Escape', bubbles: true, cancelable: true })
    } finally {
      document.removeEventListener('keydown', claim)
    }

    expect(push).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const view = render(<CloseOnEscape href="/ideas" />)
    view.unmount()
    pressEscape()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('the palette and the inspector on one page', () => {
  function renderBoth() {
    return render(
      <>
        <CommandPalette />
        <CloseOnEscape href="/ideas" />
      </>,
    )
  }

  it('dismisses the palette without navigating away from the idea', () => {
    renderBoth()
    fireEvent.click(screen.getByRole('button', { name: /Search or jump/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    pressEscape()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(push).not.toHaveBeenCalled()
  })

  it('closes the inspector on the next Escape, once the palette is gone', () => {
    renderBoth()
    fireEvent.click(screen.getByRole('button', { name: /Search or jump/i }))
    pressEscape()
    expect(push).not.toHaveBeenCalled()

    pressEscape()
    expect(push).toHaveBeenCalledWith('/ideas')
  })

  it('closes the inspector on Escape when the palette was never opened', () => {
    renderBoth()
    pressEscape()
    expect(push).toHaveBeenCalledWith('/ideas')
  })
})
