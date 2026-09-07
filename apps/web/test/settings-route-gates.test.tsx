import { Button } from '@collega/design-system'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from '@/components/settings/settings-page'
import type { Role } from '@/lib/mock'
import { actAs } from './support/acting-role'

/**
 * The route half of the role matrix.
 *
 * Settings gating is **page-level**, not control-level: a route closed to a role shows the refusal
 * panel instead of the screen, rather than a quietly reduced version of it. Comp Q makes that an
 * explicit promise — "nothing here is hidden from you selectively" — so a page that renders a
 * member a partial admin screen breaks it even if every individual control is correct.
 *
 * Two gates, not one. An Org Admin passes the administrator gate and is still refused the
 * deployment-level routes, and the refusal has to say something different: "Administrators only"
 * would be false to an Org Admin's face.
 */
const ADMIN_CONTENT = 'The statuses table'
const ACTION_LABEL = 'Add status'

function renderSettingsPage(role: Role, options: { siteAdminOnly?: boolean } = {}) {
  actAs(role)
  return render(
    <SettingsPage
      title="Statuses"
      gate="statuses"
      lead="The columns your boards group ideas by."
      actions={<Button>{ACTION_LABEL}</Button>}
      siteAdminOnly={options.siteAdminOnly ?? false}
    >
      <p>{ADMIN_CONTENT}</p>
    </SettingsPage>,
  )
}

function shownContent(): string[] {
  return screen.queryAllByText(ADMIN_CONTENT).map((node) => node.textContent ?? '')
}

describe('an administrator settings route', () => {
  for (const role of ['SiteAdmin', 'OrgAdmin'] as const) {
    it(`renders for ${role}`, () => {
      renderSettingsPage(role)
      expect(shownContent()).toHaveLength(1)
      expect(screen.queryByText('Not available')).toBeNull()
    })

    it(`offers ${role} the page action`, () => {
      renderSettingsPage(role)
      expect(screen.getByRole('button', { name: ACTION_LABEL })).toBeTruthy()
    })
  }

  for (const role of ['User', 'ReadOnly'] as const) {
    it(`refuses ${role} the whole page rather than reducing it`, () => {
      renderSettingsPage(role)
      expect(shownContent()).toEqual([])
      expect(screen.getByText('Not available')).toBeTruthy()
      expect(screen.getByText('Administrators only')).toBeTruthy()
    })

    it(`withholds the page action from ${role}`, () => {
      // The action sits in the topbar, outside the gate. Forgetting it once printed "Add status"
      // above a panel telling the reader the route was closed to them.
      renderSettingsPage(role)
      expect(screen.queryByRole('button', { name: ACTION_LABEL })).toBeNull()
    })

    it(`leaves ${role} a way back`, () => {
      renderSettingsPage(role)
      const back = screen.getByRole('link', { name: 'Back to Settings' })
      expect(back.getAttribute('href')).toBe('/settings')
    })
  }
})

describe('a deployment-level settings route', () => {
  it('renders for SiteAdmin', () => {
    renderSettingsPage('SiteAdmin', { siteAdminOnly: true })
    expect(shownContent()).toHaveLength(1)
    expect(screen.getByRole('button', { name: ACTION_LABEL })).toBeTruthy()
  })

  for (const role of ['OrgAdmin', 'User', 'ReadOnly'] as const) {
    it(`refuses ${role}`, () => {
      renderSettingsPage(role, { siteAdminOnly: true })
      expect(shownContent()).toEqual([])
      expect(screen.getByText('Site Admins only')).toBeTruthy()
    })

    it(`withholds the page action from ${role}`, () => {
      renderSettingsPage(role, { siteAdminOnly: true })
      expect(screen.queryByRole('button', { name: ACTION_LABEL })).toBeNull()
    })
  }

  it('does not tell an Org Admin this is an administrator-only route', () => {
    // An Org Admin is an administrator. The member wording would be a false statement to them, and
    // it is the reason the two gates carry two panels rather than one.
    renderSettingsPage('OrgAdmin', { siteAdminOnly: true })
    expect(screen.queryByText('Administrators only')).toBeNull()
  })
})
