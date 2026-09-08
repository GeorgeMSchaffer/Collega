import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminAction } from '@/components/delivery/admin-action'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { CommentBox, UpvoteButton } from '@/components/inspector/engagement'
import { deliveryAdminDenial, engagementDenial, type Role, writeDenial } from '@/lib/mock'
import { actAs } from './support/acting-role'

/**
 * The `Denied` contract, asserted at every call site rather than on the primitive alone.
 *
 * A denied control is shown, not hidden, and stays reachable: `aria-disabled` marks it, the HTML
 * `disabled` attribute is absent, it keeps its place in the tab order, and `aria-describedby`
 * points at an element that actually exists and holds the reason.
 *
 * That last chain is what broke once already. `disabled` looked equivalent to `aria-disabled` and
 * the wiring read correctly, but a disabled control leaves the tab order and the accessibility
 * tree, so the description explaining the refusal could never be reached — the control was denied
 * *and* silent. Every assertion below exists because of that.
 */
function expectDeniedControl(control: HTMLElement, reason: string): void {
  expect(control.getAttribute('aria-disabled')).toBe('true')

  // Not `toBeDisabled()`: the point is the attribute's absence, stated plainly.
  expect(control.hasAttribute('disabled')).toBe(false)
  expect((control as HTMLButtonElement).disabled).toBe(false)

  // Still in the tab order. jsdom refuses focus to a disabled control, so this fails for real if
  // `disabled` is ever added back.
  expect(control.tabIndex).toBe(0)
  control.focus()
  expect(document.activeElement).toBe(control)

  const describedBy = control.getAttribute('aria-describedby')
  expect(describedBy, 'a denied control must name its reason').toBeTruthy()

  const description = document.getElementById(describedBy ?? '')
  expect(description, `aria-describedby="${describedBy}" resolves to nothing`).not.toBeNull()
  expect(description?.textContent).toBe(reason)
  expect(description?.getAttribute('aria-hidden')).toBeNull()
}

function expectAllowedControl(control: HTMLElement): void {
  expect(control.getAttribute('aria-disabled')).toBeNull()
  expect(control.hasAttribute('disabled')).toBe(false)
  expect(control.getAttribute('aria-describedby')).toBeNull()
}

const DENIED_WRITE: Role[] = ['SiteAdmin', 'ReadOnly']
const ALLOWED_WRITE: Role[] = ['OrgAdmin', 'User']

describe('New idea', () => {
  for (const role of DENIED_WRITE) {
    it(`is denied to ${role} with its reason reachable`, () => {
      actAs(role)
      render(<NewIdeaButton id="why-new-ideas" />)

      const reason = writeDenial(role)
      expect(reason).not.toBeNull()
      expectDeniedControl(screen.getByRole('button', { name: 'New idea' }), reason ?? '')
    })
  }

  for (const role of ALLOWED_WRITE) {
    it(`is a live control for ${role}`, () => {
      actAs(role)
      render(<NewIdeaButton id="why-new-ideas" />)
      expectAllowedControl(screen.getByRole('button', { name: 'New idea' }))
    })
  }
})

describe('an administrator-only delivery action', () => {
  for (const role of ['SiteAdmin', 'User', 'ReadOnly'] as const) {
    it(`is denied to ${role} with its reason reachable`, () => {
      actAs(role)
      render(<AdminAction id="why-plan" label="Plan next sprint" />)

      const reason = deliveryAdminDenial(role)
      expect(reason).not.toBeNull()
      expectDeniedControl(screen.getByRole('button', { name: 'Plan next sprint' }), reason ?? '')
    })
  }

  it('is a live control for OrgAdmin', () => {
    actAs('OrgAdmin')
    render(<AdminAction id="why-plan" label="Plan next sprint" />)
    expectAllowedControl(screen.getByRole('button', { name: 'Plan next sprint' }))
  })

  it('gives each denied call site its own description element', () => {
    // Two denied actions share a page on /delivery/sprint. A single hard-coded id would make one
    // button describe the other's reason, and `getElementById` would still resolve.
    actAs('User')
    render(
      <>
        <AdminAction id="why-plan" label="Plan next sprint" />
        <AdminAction id="why-complete" label="Complete sprint" />
      </>,
    )

    const plan = screen.getByRole('button', { name: 'Plan next sprint' })
    const complete = screen.getByRole('button', { name: 'Complete sprint' })
    expect(plan.getAttribute('aria-describedby')).toBe('why-plan')
    expect(complete.getAttribute('aria-describedby')).toBe('why-complete')
    expect(document.querySelectorAll('#why-plan')).toHaveLength(1)
    expect(document.querySelectorAll('#why-complete')).toHaveLength(1)
  })
})

describe('upvoting', () => {
  it('is denied to SiteAdmin with its reason reachable', () => {
    actAs('SiteAdmin')
    render(<UpvoteButton count={2} />)

    const reason = engagementDenial('SiteAdmin')
    expect(reason).not.toBeNull()
    expectDeniedControl(
      screen.getByRole('button', { name: 'Upvote this idea, currently 2 votes' }),
      reason ?? '',
    )
  })

  for (const role of ['OrgAdmin', 'User', 'ReadOnly'] as const) {
    it(`stays a live control for ${role}`, () => {
      // Read Only is the load-bearing case: it is denied authorship and keeps its vote.
      actAs(role)
      render(<UpvoteButton count={2} />)
      expectAllowedControl(
        screen.getByRole('button', { name: 'Upvote this idea, currently 2 votes' }),
      )
    })
  }
})

describe('commenting', () => {
  it('offers a Read Only account the comment form', () => {
    actAs('ReadOnly')
    render(<CommentBox />)

    expect(screen.getByLabelText('Add a comment')).toBeTruthy()
    expectAllowedControl(screen.getByRole('button', { name: 'Comment' }))
  })

  it('replaces the form with a reason for a Site Admin', () => {
    actAs('SiteAdmin')
    render(<CommentBox />)

    expect(screen.queryByLabelText('Add a comment')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Comment' })).toBeNull()
    expect(document.body.textContent).toContain(engagementDenial('SiteAdmin') ?? '')
  })
})
