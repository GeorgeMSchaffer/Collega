import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ViewAsBanner } from '@/components/nav/view-as-banner'
import { setCurrentUser } from '@/lib/session'
import type { CurrentUser } from '@/lib/types'

/**
 * The View As strip (slice 143, `SPEC/decisions.md` 2026-10-01): visible only while viewing as
 * somebody, reads *Viewing as: {Name}* and nothing more in its visible text, keeps the acting admin
 * and organization in the accessible text and the tooltip, and ends the session through its form.
 */
vi.mock('@/lib/server/view-as-actions', () => ({ endViewAs: vi.fn() }))

function principal(viewingAs: CurrentUser['viewingAs'], organizationName: string | null = 'Acme') {
  setCurrentUser({
    userId: 'target-1',
    displayName: 'Tara Target',
    initials: 'TT',
    role: 'User',
    roleLabel: 'User',
    organizationId: organizationName ? 'org-1' : null,
    organizationName,
    viewingAs,
  })
}

const VIEWING = {
  realUserId: 'admin-1',
  realUserName: 'Sam Deployment',
  expiresAtUtc: '2026-10-01T12:00:00Z',
}

describe('ViewAsBanner', () => {
  it('renders nothing when the account is acting as itself', () => {
    principal(null)
    const { container } = render(<ViewAsBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('names only the target in its visible text', () => {
    principal(VIEWING)
    render(<ViewAsBanner />)
    expect(screen.getByText('Viewing as: Tara Target')).toBeTruthy()
  })

  it('keeps the acting admin and organization in the tooltip and a screen-reader span', () => {
    principal(VIEWING)
    render(<ViewAsBanner />)
    const detail =
      'You are signed in as Sam Deployment · Acme. Anything you do is recorded against both of you.'
    expect(screen.getByText('Viewing as: Tara Target').getAttribute('title')).toBe(detail)
    const hidden = screen.getByText(`. ${detail}`)
    expect(hidden.className).toContain('sr-only')
  })

  it('leaves the organization out of the detail when the target has none', () => {
    principal(VIEWING, null)
    render(<ViewAsBanner />)
    expect(screen.getByText('Viewing as: Tara Target').getAttribute('title')).toBe(
      'You are signed in as Sam Deployment. Anything you do is recorded against both of you.',
    )
  })

  it('is an alert, so a screen reader interrupts with it', () => {
    principal(VIEWING)
    render(<ViewAsBanner />)
    expect(screen.getByRole('alert').textContent).toContain('Viewing as: Tara Target')
  })

  it('offers a Stop viewing as submit button, with no way to dismiss it otherwise', () => {
    principal(VIEWING)
    render(<ViewAsBanner />)
    const stop = screen.getByRole('button', { name: 'Stop viewing as' }) as HTMLButtonElement
    expect(stop.type).toBe('submit')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(stop.closest('form')).not.toBeNull()
  })

  it('uses theme tokens only, no raw palette classes', () => {
    principal(VIEWING)
    render(<ViewAsBanner />)
    const className = screen.getByRole('alert').className
    expect(className).toContain('bg-accent')
    expect(className).toContain('text-accent-foreground')
    expect(className).not.toMatch(/\b(?:bg|text|border)-(?:red|amber|yellow|orange|slate|gray)-/)
  })
})
