import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'
import { AuthPitch } from '@/components/auth-pitch'

/**
 * The sign-in band (`SPEC/decisions.md` 2026-10-04): the pitch sits on the sidebar's ground rather
 * than the primary colour, and only the Sign in screen shows the schematic board.
 */
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/components/auth/login-form', () => ({
  LoginForm: () => <form aria-label="Sign in form" />,
}))
vi.mock('@/components/auth/session-ended-signal', () => ({ SessionEndedSignal: () => null }))

const lanes = (root: HTMLElement) => root.querySelectorAll('[aria-hidden="true"].grid > div')

describe('AuthPitch', () => {
  it('sits on the sidebar ground, not the primary colour', () => {
    const { container } = render(<AuthPitch heading="Hello">Body</AuthPitch>)
    const band = container.firstElementChild as HTMLElement
    expect(band.className).toContain('bg-sidebar')
    expect(band.className).toContain('text-sidebar-foreground')
    expect(band.className).not.toContain('bg-primary')
  })

  it('shows no board preview unless asked', () => {
    const { container } = render(<AuthPitch heading="Hello">Body</AuthPitch>)
    expect(lanes(container)).toHaveLength(0)
  })

  it('shows a decorative five-lane board preview when asked', () => {
    const { container } = render(
      <AuthPitch heading="Hello" preview>
        Body
      </AuthPitch>,
    )
    const board = container.querySelector('[aria-hidden="true"].grid') as HTMLElement
    expect(board).not.toBeNull()
    expect(lanes(container)).toHaveLength(5)
  })

  it('renders without points, as the password-change screen does', () => {
    const { container } = render(<AuthPitch heading="Hello">Body</AuthPitch>)
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
    expect(container.querySelector('ul')).toBeNull()
  })

  it('lists each point in order', () => {
    render(
      <AuthPitch heading="Hello" points={['First', 'Second']}>
        Body
      </AuthPitch>,
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['First', 'Second'])
  })
})

describe('the sign-in page', () => {
  it('shows the board preview beside the form', async () => {
    const { container } = render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(lanes(container)).toHaveLength(5)
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy()
    expect(screen.getByRole('form', { name: 'Sign in form' })).toBeTruthy()
  })
})
