import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewTaskDrawer } from '@/components/boards/new-task-drawer'
import { addBacklogTask } from '@/lib/server/idea-actions'

/**
 * Comp W screen 2, "Add a task" (TB-2): title required, parent optional and limited to the choices
 * the page computed, the request body, the server's refusal in words, and what Save and add another
 * leaves behind. The router and the server action are the boundary.
 */
const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams('tab=backlog&task=new'),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/boards/b-1',
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/server/idea-actions', () => ({ addBacklogTask: vi.fn() }))

const add = vi.mocked(addBacklogTask)
const PARENTS = [
  { id: 'p-1', itemKey: 'IDEA-1', title: 'Ship the thing' },
  { id: 'p-2', itemKey: null, title: 'Keyless idea' },
]

function drawer() {
  render(
    <NewTaskDrawer
      boardId="b-1"
      boardName="Implementation"
      parents={PARENTS}
      members={[{ id: 'u-ada', name: 'Ada Lovelace' }]}
      tags={[]}
    />,
  )
}
const title = () => screen.getByLabelText(/^Title/) as HTMLInputElement
const type = (value: string) => fireEvent.change(title(), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
const another = () => fireEvent.click(screen.getByRole('button', { name: 'Save and add another' }))

beforeEach(() => {
  nav.replace.mockReset()
  nav.params = new URLSearchParams('tab=backlog&task=new')
  add.mockReset().mockResolvedValue({ error: null })
  Element.prototype.scrollIntoView = vi.fn()
})

describe('NewTaskDrawer', () => {
  it('requires a title and sends nothing without one', () => {
    drawer()
    type('   ')
    save()
    expect(screen.getByText('Title is required.')).toBeTruthy()
    expect(add).not.toHaveBeenCalled()
  })

  it('offers exactly the parent choices it was given, plus none for a standalone task', () => {
    drawer()
    const select = screen.getByLabelText(/Parent idea/) as HTMLSelectElement
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'No parent (standalone task)',
      'IDEA-1 · Ship the thing',
      'Keyless idea',
    ])
    expect(select.value).toBe('')
  })

  it('posts a standalone task with no parent', async () => {
    drawer()
    type('  Oil the hinge  ')
    save()
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1))
    expect(add).toHaveBeenCalledWith('b-1', {
      title: 'Oil the hinge',
      description: '',
      assigneeUserIds: [],
      tagNames: [],
      parentIdeaId: null,
    })
  })

  it('posts the chosen parent, description and assignee', async () => {
    drawer()
    type('Wire the sensor')
    fireEvent.change(screen.getByLabelText(/Parent idea/), { target: { value: 'p-1' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' Needs a cable ' } })
    fireEvent.change(screen.getByLabelText('Add an assignee'), { target: { value: 'u-ada' } })
    save()
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1))
    expect(add).toHaveBeenCalledWith('b-1', {
      title: 'Wire the sensor',
      description: 'Needs a cable',
      assigneeUserIds: ['u-ada'],
      tagNames: [],
      parentIdeaId: 'p-1',
    })
  })

  it('shows the server refusal in the drawer and stays open', async () => {
    add.mockResolvedValue({ error: 'No lane references this board, so it has no tasks to add.' })
    drawer()
    type('Anything')
    save()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('No lane references this board, so it has no tasks to add.')
    expect(nav.replace).not.toHaveBeenCalled()
    expect(title().value).toBe('Anything')
  })

  it('closes on save by dropping ?task and keeping the tab', async () => {
    drawer()
    type('Done and dusted')
    save()
    await waitFor(() => expect(nav.replace).toHaveBeenCalled())
    expect(nav.replace).toHaveBeenCalledWith('/boards/b-1?tab=backlog', { scroll: false })
  })

  it('Save and add another clears the form, keeps the drawer open and puts focus in Title', async () => {
    drawer()
    type('First task')
    fireEvent.change(screen.getByLabelText(/Parent idea/), { target: { value: 'p-1' } })
    another()
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(title().value).toBe(''))
    expect((screen.getByLabelText(/Parent idea/) as HTMLSelectElement).value).toBe('')
    expect(nav.replace).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(title()))
  })

  it('Cancel closes without saving', () => {
    drawer()
    type('Never mind')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(add).not.toHaveBeenCalled()
    expect(nav.replace).toHaveBeenCalledWith('/boards/b-1?tab=backlog', { scroll: false })
  })

  it('is closed when the URL does not ask for it', () => {
    nav.params = new URLSearchParams('tab=backlog')
    drawer()
    expect(document.querySelector('aside')?.hasAttribute('inert')).toBe(true)
  })
})
