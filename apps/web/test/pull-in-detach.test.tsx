import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RemoveFromBoardButton } from '@/components/ideas/remove-from-board'
import { detachOffer } from '@/lib/roles'

/**
 * Remove from board (`20-feature-board-pull-in.md` rules 5 and 6): who is offered the control, when
 * it is shown disabled with a reason, and that a refused click does nothing.
 */
const ME = 'u-me'
const idea = (over: { boardId?: string | null; authorUserId?: string | null } = {}) => ({
  boardId: 'b-1' as string | null,
  authorUserId: ME as string | null,
  ...over,
})
const live = { isIssue: false, boardArchived: false }

describe('detachOffer', () => {
  it('offers the author, a User, a working control on a live board', () => {
    expect(detachOffer('User', ME, idea(), live)).toEqual({ reason: null })
  })

  it('offers an Org Admin a working control on an idea someone else wrote', () => {
    expect(detachOffer('OrgAdmin', 'u-admin', idea(), live)).toEqual({ reason: null })
  })

  it('offers a User nothing on an idea someone else wrote', () => {
    expect(detachOffer('User', 'u-other', idea(), live)).toBeNull()
  })

  it.each(['ReadOnly', 'SiteAdmin'] as const)('offers %s nothing, even as the author', (role) => {
    expect(detachOffer(role, ME, idea(), live)).toBeNull()
  })

  it('offers nothing on an idea already in the pool', () => {
    expect(detachOffer('OrgAdmin', 'u-admin', idea({ boardId: null }), live)).toBeNull()
  })

  it('offers nothing to a User on an idea with no recorded author', () => {
    expect(detachOffer('User', ME, idea({ authorUserId: null }), live)).toBeNull()
  })

  it('shows the control disabled, with the reason, on an Issue - for an admin too', () => {
    const reason = 'Issues return to Discovery first.'
    const issue = { isIssue: true, boardArchived: false }
    expect(detachOffer('User', ME, idea(), issue)).toEqual({ reason })
    expect(detachOffer('OrgAdmin', 'u-admin', idea(), issue)).toEqual({ reason })
  })

  it('shows a User the control disabled on an archived board, but lets an Org Admin use it', () => {
    const archived = { isIssue: false, boardArchived: true }
    expect(detachOffer('User', ME, idea(), archived)).toEqual({
      reason: 'Only an Org Admin can remove ideas from an archived board.',
    })
    expect(detachOffer('OrgAdmin', 'u-admin', idea(), archived)).toEqual({ reason: null })
  })
})

describe('RemoveFromBoardButton', () => {
  it('calls back with the button when it works', () => {
    const onRemove = vi.fn()
    render(
      <RemoveFromBoardButton title="Slow conveyor" offer={{ reason: null }} onRemove={onRemove} />,
    )
    const button = screen.getByRole('button', { name: 'Remove from board: Slow conveyor' })
    expect(button.getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(button)
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(button)
  })

  it('stays focusable, says why, and ignores the click when refused', () => {
    const onRemove = vi.fn()
    render(
      <RemoveFromBoardButton
        title="Slow conveyor"
        offer={{ reason: 'Issues return to Discovery first.' }}
        onRemove={onRemove}
      />,
    )
    const button = screen.getByRole('button', { name: 'Remove from board: Slow conveyor' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.getAttribute('aria-describedby')).toBe(
      screen.getByText('Issues return to Discovery first.').id,
    )
    fireEvent.click(button)
    expect(onRemove).not.toHaveBeenCalled()
  })
})
