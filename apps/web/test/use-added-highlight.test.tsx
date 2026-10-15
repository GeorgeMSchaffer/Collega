import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAddedHighlight } from '@/components/list'

/**
 * `useAddedHighlight`: scroll a just-added row into view and mark it `data-added` for 4 s, waiting
 * for the refreshed list to contain it, and giving up after 4 s when it never does so a later page
 * change cannot fire a stale highlight. Timers are fake; the clock is never read.
 */
const scroll = vi.fn()

function Probe({ ids, selector }: { ids: string[]; selector?: (id: string) => string }) {
  const highlight = useAddedHighlight(ids.join(','), selector)
  return (
    <>
      <button type="button" onClick={() => highlight('new')}>
        mark new
      </button>
      <button type="button" onClick={() => highlight('other')}>
        mark other
      </button>
      <button type="button" onClick={() => highlight(null)}>
        clear
      </button>
      <ul>
        {ids.map((id) => (
          <li key={id} data-row-key={id} data-custom={id} data-testid={id} />
        ))}
      </ul>
    </>
  )
}

const marked = (id: string) => screen.getByTestId(id).hasAttribute('data-added')
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers()
  scroll.mockReset()
  Element.prototype.scrollIntoView = scroll
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useAddedHighlight', () => {
  it('scrolls the row into view and marks it at once when it is already in the list', () => {
    render(<Probe ids={['a', 'new']} />)
    press('mark new')
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' })
    expect(marked('new')).toBe(true)
    expect(marked('a')).toBe(false)
  })

  it('keeps the mark for 4 seconds and not a moment longer', () => {
    render(<Probe ids={['new']} />)
    press('mark new')
    advance(3999)
    expect(marked('new')).toBe(true)
    advance(1)
    expect(marked('new')).toBe(false)
  })

  it('waits for the row to arrive with the refreshed list, then marks it', () => {
    const view = render(<Probe ids={['a']} />)
    press('mark new')
    expect(scroll).not.toHaveBeenCalled()
    advance(1000)
    view.rerender(<Probe ids={['new', 'a']} />)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(marked('new')).toBe(true)
  })

  it('gives up after 4 seconds when the row never appears, so a later arrival is not marked', () => {
    const view = render(<Probe ids={['a']} />)
    press('mark new')
    advance(4000)
    view.rerender(<Probe ids={['new', 'a']} />)
    expect(scroll).not.toHaveBeenCalled()
    expect(marked('new')).toBe(false)
  })

  it('still marks a row that arrives just inside the 4 seconds', () => {
    const view = render(<Probe ids={['a']} />)
    press('mark new')
    advance(3999)
    view.rerender(<Probe ids={['new', 'a']} />)
    expect(marked('new')).toBe(true)
  })

  it('moves the mark when a different row is added', () => {
    render(<Probe ids={['new', 'other']} />)
    press('mark new')
    press('mark other')
    expect(marked('new')).toBe(false)
    expect(marked('other')).toBe(true)
  })

  it('clears the mark on null', () => {
    render(<Probe ids={['new']} />)
    press('mark new')
    press('clear')
    expect(marked('new')).toBe(false)
  })

  it('removes the mark when the component unmounts', () => {
    const view = render(<Probe ids={['new']} />)
    press('mark new')
    const row = screen.getByTestId('new')
    view.unmount()
    expect(row.hasAttribute('data-added')).toBe(false)
  })

  it('finds rows with a custom selector instead of data-row-key', () => {
    render(<Probe ids={['new']} selector={(id) => `[data-custom="${id}"]`} />)
    press('mark new')
    expect(marked('new')).toBe(true)
  })

  it('does nothing before anything has been added', () => {
    render(<Probe ids={['new']} />)
    advance(10000)
    expect(scroll).not.toHaveBeenCalled()
    expect(marked('new')).toBe(false)
  })
})
