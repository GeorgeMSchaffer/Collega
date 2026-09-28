import { TAG_PALETTE } from '@collega/design-system'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TagsPage from '@/app/(desk)/settings/tags/page'
import { TagsScreen } from '@/components/settings/tags-screen'
import { deleteTag, saveTag } from '@/lib/server/tag-actions'
import type { Role } from '@/lib/session'
import { randomTagColor } from '@/lib/tag-color'
import type { TagOverview } from '@/lib/types'
import { actAs } from './support/acting-role'
import { stubDialogMethods } from './support/dialog'

stubDialogMethods()

/**
 * Settings → Tags (`20-feature-ideas-and-engagement.md` rules 11–15): who manages, who reads, who is
 * refused; the Usage filter and the sort; the delete confirmation's wording; and the field-keyed
 * 400s beside their controls. The router, the server actions and the data readers are the boundary.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: search.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/settings/tags',
  useSearchParams: () => search.params,
  redirect: vi.fn(),
}))
vi.mock('@/lib/server/tag-actions', () => ({ saveTag: vi.fn(), deleteTag: vi.fn() }))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: vi.fn(async () => ({})) }))
const data = vi.hoisted(() => ({
  getTagCatalog: vi.fn(),
  getTagCatalogsByOrganization: vi.fn(),
  getTagUsage: vi.fn(),
}))
vi.mock('@/lib/data', () => data)

function tag(id: string, name: string, ideaCount: number, extra: Partial<TagOverview> = {}) {
  return {
    id,
    name,
    color: '#E5484D',
    ideaCount,
    boards: ideaCount > 0 ? [{ id: 'b1', name: 'Assembly' }] : [],
    createdAtUtc: `2026-09-0${id.length}T00:00:00Z`,
    createdOn: '1 Sep 2026',
    createdBy: 'Olivia Admin',
    organization: null,
    ...extra,
  } satisfies TagOverview
}

const CATALOG: TagOverview[] = [
  tag('t-b', 'bravo', 3),
  tag('t-a', 'alpha', 0),
  tag('t-c', 'charlie', 1),
]

beforeEach(() => {
  search.params = new URLSearchParams()
  search.push.mockReset()
  data.getTagCatalog.mockResolvedValue(CATALOG)
  data.getTagCatalogsByOrganization.mockResolvedValue(
    CATALOG.map((t) => ({ ...t, organization: { id: 'org-1', name: 'Acme Robotics' } })),
  )
  data.getTagUsage.mockResolvedValue(null)
})

async function renderPage(role: Role) {
  actAs(role)
  render(await TagsPage({ searchParams: Promise.resolve({}) }))
}

const tagNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)

describe('Settings → Tags by role', () => {
  it('lets an Org Admin add, edit and delete', async () => {
    await renderPage('OrgAdmin')
    const add = screen.getByRole('button', { name: 'Add New Tag' })
    expect(add.getAttribute('aria-disabled')).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit alpha' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete alpha' })).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: /Organization/ })).toBeNull()
    expect(data.getTagCatalogsByOrganization).not.toHaveBeenCalled()
  })

  it('shows a Site Admin every organization read-only, with Add New Tag disabled and its reason', async () => {
    await renderPage('SiteAdmin')
    const add = screen.getByRole('button', { name: 'Add New Tag' })
    expect(add.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Act as an organization administrator')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Organization/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View alpha' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit alpha' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete alpha' })).toBeNull()
  })

  for (const role of ['User', 'ReadOnly'] as const) {
    it(`refuses ${role} with the panel and reads nothing`, async () => {
      await renderPage(role)
      expect(screen.getByText('Not available')).toBeTruthy()
      expect(screen.queryByRole('table')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Add New Tag' })).toBeNull()
      expect(data.getTagCatalog).not.toHaveBeenCalled()
      expect(data.getTagCatalogsByOrganization).not.toHaveBeenCalled()
    })
  }

  it('opens a Site Admin’s ?mode=edit link as the view, never the form', () => {
    search.params = new URLSearchParams('tag=t-b&mode=edit')
    render(<TagsScreen tags={CATALOG} denial="Act as…" usage={null} newColor="#E5484D" />)
    expect(screen.queryByLabelText(/^Tag/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'bravo' })).toBeTruthy()
  })

  it('does not open the create form for a Site Admin on ?tag=new', () => {
    search.params = new URLSearchParams('tag=new')
    render(<TagsScreen tags={CATALOG} denial="Act as…" usage={null} newColor="#E5484D" />)
    expect(screen.queryByRole('heading', { name: 'Add New Tag' })).toBeNull()
  })
})

describe('Settings → Tags list', () => {
  const screenFor = () =>
    render(<TagsScreen tags={CATALOG} denial={null} usage={null} newColor="#E5484D" />)

  it('sorts by name ascending when unsorted', () => {
    screenFor()
    expect(tagNames()).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('sorts by Ideas descending from the URL', () => {
    search.params = new URLSearchParams('sort=ideas&dir=desc')
    screenFor()
    expect(tagNames()).toEqual(['bravo', 'charlie', 'alpha'])
  })

  it('keeps only unused tags under Usage: Unused', () => {
    search.params = new URLSearchParams('usage=Unused')
    screenFor()
    expect(tagNames()).toEqual(['alpha'])
  })

  it('keeps only used tags under Usage: Used', () => {
    search.params = new URLSearchParams('usage=Used')
    screenFor()
    expect(tagNames()).toEqual(['bravo', 'charlie'])
  })

  it('filters on the name text', () => {
    search.params = new URLSearchParams('q=RAV')
    screenFor()
    expect(tagNames()).toEqual(['bravo'])
  })
})

describe('Delete tag confirmation', () => {
  const confirmText = (name: string) => {
    render(<TagsScreen tags={CATALOG} denial={null} usage={null} newColor="#E5484D" />)
    fireEvent.click(screen.getByRole('button', { name: `Delete ${name}` }))
    return screen.getByRole('alertdialog').textContent ?? ''
  }

  it('counts ideas in the plural', () => {
    expect(confirmText('bravo')).toContain(
      '“bravo” is removed from 3 ideas. Anyone who types it again creates a new tag.',
    )
  })

  it('says “1 idea”, not “1 ideas”', () => {
    expect(confirmText('charlie')).toContain('is removed from 1 idea.')
  })

  it('says “0 ideas” for an unused tag', () => {
    expect(confirmText('alpha')).toContain('is removed from 0 ideas.')
  })

  it('deletes the tag it asked about', async () => {
    vi.mocked(deleteTag).mockResolvedValue({ error: null })
    confirmText('bravo')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete tag' }))
    })
    expect(deleteTag).toHaveBeenCalledWith('t-b')
  })

  it('shows the API’s refusal', async () => {
    vi.mocked(deleteTag).mockResolvedValue({ error: 'Tag not found.' })
    confirmText('bravo')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete tag' }))
    })
    expect(screen.getByRole('alert').textContent).toContain('Tag not found.')
  })
})

describe('Tag form errors', () => {
  it('puts a name 400 beside Tag and a color 400 beside Colour', async () => {
    vi.mocked(saveTag).mockResolvedValue({
      error: null,
      errors: { name: 'A tag with this name already exists.', color: 'Colour must be #RRGGBB.' },
      savedId: null,
    })
    search.params = new URLSearchParams('tag=t-b&mode=edit')
    render(<TagsScreen tags={CATALOG} denial={null} usage={null} newColor="#E5484D" />)

    await act(async () => {
      fireEvent.submit(document.getElementById('tag-drawer-form') as HTMLFormElement)
    })

    const name = screen.getByRole('textbox', { name: /^Tag/ })
    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
    expect(name.getAttribute('aria-describedby') ?? '').not.toBe('')
    const describedBy = (name.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
    expect(describedBy).toContain('A tag with this name already exists.')
    expect(screen.getByText('Colour must be #RRGGBB.')).toBeTruthy()
    expect(saveTag).toHaveBeenCalledWith('t-b', expect.any(FormData))
    // No save, so the drawer stays on the form.
    expect(search.push).not.toHaveBeenCalled()
  })

  it('sends the name and colour it shows', async () => {
    vi.mocked(saveTag).mockResolvedValue({ error: null, errors: {}, savedId: null })
    search.params = new URLSearchParams('tag=new')
    render(<TagsScreen tags={CATALOG} denial={null} usage={null} newColor="#6B9BF2" />)
    fireEvent.change(screen.getByRole('textbox', { name: /^Tag/ }), {
      target: { value: 'delta' },
    })
    await act(async () => {
      fireEvent.submit(document.getElementById('tag-drawer-form') as HTMLFormElement)
    })
    const sent = vi.mocked(saveTag).mock.calls[0]?.[1] as FormData
    expect(vi.mocked(saveTag).mock.calls[0]?.[0]).toBeNull()
    expect(sent.get('name')).toBe('delta')
    expect(sent.get('color')).toBe('#6B9BF2')
  })
})

describe('randomTagColor', () => {
  it('takes the first palette colour at 0', () => {
    expect(randomTagColor(() => 0)).toBe(TAG_PALETTE[0])
  })

  it('takes the last palette colour just below 1', () => {
    expect(randomTagColor(() => 0.999_999)).toBe(TAG_PALETTE[TAG_PALETTE.length - 1])
  })

  it('maps each tenth to its palette index', () => {
    expect(TAG_PALETTE).toHaveLength(10)
    TAG_PALETTE.forEach((color, index) => {
      expect(randomTagColor(() => (index + 0.5) / 10)).toBe(color)
    })
  })

  it('never leaves the palette, even for a source that returns 1', () => {
    expect(TAG_PALETTE).toContain(randomTagColor(() => 1))
  })
})
