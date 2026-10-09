import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditOrganizationPage from '@/app/(desk)/settings/organizations/[organizationId]/page'
import NewUserPage from '@/app/(desk)/settings/users/new/page'
import { CreateOrganizationForm } from '@/components/settings/create-organization-form'
import { CreateUserForm } from '@/components/settings/create-user-form'
import { ApiError, apiPost, apiPostReturning } from '@/lib/api/client'
import { createOrganization } from '@/lib/server/admin-actions'
import { actAs } from './support/acting-role'

/**
 * `SPEC/decisions.md` 2026-10-04: every organization has an Org Admin. The form requires one, the
 * action checks before anything is created, and an organization that ends up without an active one
 * says so and links the fix. The HTTP client is the boundary.
 */
vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
  apiPostReturning: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
const data = vi.hoisted(() => ({
  getOrganizations: vi.fn(),
  getOrganizationDetail: vi.fn(),
  getOrgAdminsForOrganization: vi.fn(),
}))
vi.mock('@/lib/data', () => data)
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: vi.fn() }))
vi.mock('@/components/settings/settings-page', () => ({
  SettingsPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/settings/organization-edit-form', () => ({
  OrganizationEditForm: () => null,
}))
// The page hands the form its defaults; the form's own rendering is checked on its own below.
vi.mock('@/components/settings/create-user-form', () => ({ CreateUserForm: vi.fn(() => null) }))

const post = vi.mocked(apiPost)
const postReturning = vi.mocked(apiPostReturning)

const ADMIN = {
  title: 'Northwind',
  description: 'Logistics',
  adminFirstName: 'Ada',
  adminLastName: 'Admin',
  adminEmail: 'ada@northwind.test',
  adminPassword: 'Abc123!x',
}

function formOf(values: Record<string, string>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.set(key, value)
  return form
}

const submit = (values: Record<string, string>) =>
  createOrganization({ error: null }, formOf(values))

beforeEach(() => {
  post.mockReset()
  postReturning.mockReset()
  postReturning.mockResolvedValue({ organizationId: 'org-new' })
  post.mockResolvedValue(undefined)
})

describe('createOrganization', () => {
  it.each(['adminFirstName', 'adminLastName', 'adminEmail', 'adminPassword'])(
    'refuses a missing %s and creates nothing',
    async (field) => {
      const result = await submit({ ...ADMIN, [field]: '' })

      expect(result.error).toContain('first Org Admin')
      expect(postReturning).not.toHaveBeenCalled()
      expect(post).not.toHaveBeenCalled()
    },
  )

  it('treats a whitespace-only administrator field as missing', async () => {
    const result = await submit({ ...ADMIN, adminLastName: '   ' })

    expect(result.error).toContain('first Org Admin')
    expect(postReturning).not.toHaveBeenCalled()
  })

  it('creates the organization, then its Org Admin, then goes to the list', async () => {
    await expect(submit(ADMIN)).rejects.toThrow('NEXT_REDIRECT /settings/organizations')

    expect(postReturning).toHaveBeenCalledExactlyOnceWith('/organizations', {
      title: 'Northwind',
      description: 'Logistics',
    })
    expect(post).toHaveBeenCalledExactlyOnceWith('/organizations/org-new/users', {
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada@northwind.test',
      role: 'OrgAdmin',
      initialPassword: 'Abc123!x',
    })
  })

  it('says the organization exists when only its administrator was refused', async () => {
    post.mockRejectedValue(new ApiError(409, 'Conflict', 'That email is already in use.', {}))

    const result = await submit(ADMIN)

    expect(result.error).toContain('The organization was created, but its administrator was not')
    expect(result.error).toContain('That email is already in use.')
    expect(result.error).toContain('Add Org Admin')
  })

  it('stops before creating the administrator when the organization is refused', async () => {
    postReturning.mockRejectedValue(new ApiError(409, 'Conflict', 'That name is taken.', {}))

    const result = await submit(ADMIN)

    expect(result.error).toBe('That name is taken.')
    expect(post).not.toHaveBeenCalled()
  })
})

describe('the New organization form', () => {
  it.each(['First name', 'Last name', 'Email', 'Initial password'])(
    'requires the first Org Admin’s %s',
    (label) => {
      render(<CreateOrganizationForm />)
      expect((screen.getByLabelText(new RegExp(label)) as HTMLInputElement).required).toBe(true)
    },
  )
})

describe('the organization page', () => {
  const member = (id: string, status: 'Active' | 'Inactive') => ({
    id,
    displayName: `Admin ${id}`,
    email: `${id}@x.test`,
    status,
  })

  async function renderPage(admins: unknown[]) {
    data.getOrganizationDetail.mockResolvedValue({ name: 'Northwind' })
    data.getOrgAdminsForOrganization.mockResolvedValue(admins)
    render(await EditOrganizationPage({ params: Promise.resolve({ organizationId: 'org 1' }) }))
  }

  it('links Add Org Admin to the user form preset to this organization and role', async () => {
    await renderPage([member('a', 'Active')])

    expect(screen.getByRole('link', { name: 'Add Org Admin' }).getAttribute('href')).toBe(
      '/settings/users/new?organization=org%201&role=OrgAdmin',
    )
  })

  it('warns when the organization has no Org Admin at all', async () => {
    await renderPage([])

    expect(screen.getByText(/no active Org Admin/)).toBeTruthy()
  })

  it('warns when every Org Admin is inactive, and still lists them', async () => {
    await renderPage([member('a', 'Inactive')])

    expect(screen.getByText(/no active Org Admin/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Admin a' })).toBeTruthy()
    expect(screen.getByText('Inactive')).toBeTruthy()
  })

  it('does not warn when one Org Admin is active', async () => {
    await renderPage([member('a', 'Inactive'), member('b', 'Active')])

    expect(screen.queryByText(/no active Org Admin/)).toBeNull()
  })
})

describe('the New user page preselect', () => {
  async function defaults(search: { organization?: string; role?: string }) {
    vi.mocked(CreateUserForm).mockClear()
    data.getOrganizations.mockResolvedValue([{ id: 'org-1', name: 'Acme' }])
    render(await NewUserPage({ searchParams: Promise.resolve(search) }))
    return vi.mocked(CreateUserForm).mock.calls[0]?.[0]
  }

  it('preselects a known organization and the Org Admin role for an App Admin', async () => {
    actAs('SiteAdmin')
    expect(await defaults({ organization: 'org-1', role: 'OrgAdmin' })).toMatchObject({
      defaultOrganizationId: 'org-1',
      defaultRole: 'OrgAdmin',
    })
  })

  it('ignores an organization that does not exist and a role it does not recognise', async () => {
    actAs('SiteAdmin')
    expect(await defaults({ organization: 'nope', role: 'SiteAdmin' })).toMatchObject({
      defaultOrganizationId: '',
      defaultRole: 'User',
    })
  })
})
