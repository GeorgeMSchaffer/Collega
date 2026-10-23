import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlockersSection } from '@/components/ideas/idea-blockers'
import { setBlockers } from '@/lib/server/idea-actions'
import type { BlockerCandidate, IdeaBlockers, IdeaDetail } from '@/lib/types'

/**
 * The drawer's Blockers section (slice 300, comp U screen 6): chips with ×, the picker, cycle rows
 * disabled with a described reason, the read-only view, and the page when the board read failed.
 * `setBlockers` is the boundary; it replaces the whole set, so each change must send every id.
 */
vi.mock('@/lib/server/idea-actions', () => ({
  boardAllowedIdeaTypeIds: async () => [],
  setBlockers: vi.fn(),
}))

const save = vi.mocked(setBlockers)

type Item = Pick<IdeaDetail, 'id' | 'boardId' | 'blockedBy'>

const blocker = (ideaId: string, itemKey: string | null, isFinal = false) => ({
  ideaId,
  itemKey,
  isFinal,
})
const candidate = (id: string, itemKey: string, over: Partial<BlockerCandidate> = {}) => ({
  id,
  itemKey,
  title: `Card ${itemKey}`,
  statusName: 'Open',
  parentItemKey: null,
  cycle: false,
  ...over,
})
const board = (candidates: BlockerCandidate[]): IdeaBlockers => ({
  candidates,
  cards: Object.fromEntries(
    candidates.map((card) => [card.id, { title: card.title, statusName: card.statusName }]),
  ),
})
const item = (blockedBy: Item['blockedBy'] = []): Item => ({ id: 'me', boardId: 'b-1', blockedBy })

beforeEach(() => {
  save.mockReset().mockResolvedValue({ error: null })
})

describe('BlockersSection: chips', () => {
  it('shows nothing to a reader who cannot edit when there are no blockers', () => {
    const { container } = render(
      <BlockersSection item={item()} blockers={board([])} canEdit={false} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('shows an editor an empty section with Add blocker', () => {
    render(<BlockersSection item={item()} blockers={board([])} canEdit />)

    expect(screen.getByRole('heading', { name: 'Blockers' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Add blocker/ })).toBeTruthy()
    expect(screen.queryByText(/open blocker/)).toBeNull()
  })

  it('names a chip by key, title and lane, and counts only the open blockers', () => {
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1'), blocker('y', 'IMPL-2', true)])}
        blockers={board([candidate('x', 'IMPL-1'), candidate('y', 'IMPL-2')])}
        canEdit
      />,
    )

    expect(screen.getByText('IMPL-1 · Card IMPL-1 · Open')).toBeTruthy()
    expect(
      screen.getByText('1 open blocker. It can leave its first lane once every blocker is final.'),
    ).toBeTruthy()
  })

  it('says nothing holds the item once every blocker is final', () => {
    render(
      <BlockersSection
        item={item([blocker('y', 'IMPL-2', true)])}
        blockers={board([candidate('y', 'IMPL-2')])}
        canEdit
      />,
    )

    expect(screen.getByText('Every blocker is final, so nothing holds this item.')).toBeTruthy()
  })

  it('keeps the chips, by key, when the board read failed and the cards are unknown', () => {
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1'), blocker('z', null)])}
        blockers={{ candidates: [], cards: {} }}
        canEdit
      />,
    )

    expect(screen.getByText('IMPL-1')).toBeTruthy()
    expect(screen.getByText('Another task')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove blocker IMPL-1' })).toBeTruthy()
  })

  it('is read-only for a reader who cannot edit: chips without × or Add', () => {
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1')])}
        blockers={board([candidate('x', 'IMPL-1')])}
        canEdit={false}
      />,
    )

    expect(screen.getByText(/IMPL-1/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('saves on its own')).toBeNull()
  })
})

describe('BlockersSection: removing', () => {
  it('sends the whole set minus the removed blocker', async () => {
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1'), blocker('y', 'IMPL-2')])}
        blockers={board([candidate('x', 'IMPL-1'), candidate('y', 'IMPL-2')])}
        canEdit
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove blocker IMPL-1' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith('me', 'b-1', ['y']))
  })

  it('clears with an empty set when the last blocker goes', async () => {
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1')])}
        blockers={board([candidate('x', 'IMPL-1')])}
        canEdit
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove blocker IMPL-1' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith('me', 'b-1', []))
  })

  it('shows a refusal and keeps the chip', async () => {
    save.mockResolvedValue({ error: 'That item is on another board.' })
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1')])}
        blockers={board([candidate('x', 'IMPL-1')])}
        canEdit
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove blocker IMPL-1' }))

    expect((await screen.findByRole('alert')).textContent).toBe('That item is on another board.')
    expect(screen.getByRole('button', { name: 'Remove blocker IMPL-1' })).toBeTruthy()
  })
})

describe('BlockersSection: the picker', () => {
  const cards = [
    candidate('x', 'IMPL-1'),
    candidate('y', 'IMPL-2', { title: 'Write the docs' }),
    candidate('loop', 'IMPL-3', { cycle: true }),
  ]
  const open = () => {
    render(
      <BlockersSection item={item([blocker('x', 'IMPL-1')])} blockers={board(cards)} canEdit />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add blocker$/ }))
    return screen.getByRole('region', { name: 'Add blocker' })
  }

  it('adds a card by sending the current set plus the new id', async () => {
    const picker = open()

    fireEvent.click(within(picker).getByRole('button', { name: 'Add blocker IMPL-2' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith('me', 'b-1', ['x', 'y']))
  })

  it('marks a card already added instead of offering it again', () => {
    const picker = open()

    expect(within(picker).queryByRole('button', { name: 'Add blocker IMPL-1' })).toBeNull()
    expect(within(picker).getByText('Added')).toBeTruthy()
  })

  it('disables a cycle row and describes why', () => {
    const picker = open()

    const add = within(picker).getByRole('button', {
      name: 'Add blocker IMPL-3',
    }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    const why = document.getElementById(add.getAttribute('aria-describedby') ?? '')
    expect(why?.textContent).toBe(
      'It is already waiting on this item, so adding it would make a loop.',
    )
    fireEvent.click(add)
    expect(save).not.toHaveBeenCalled()
  })

  it('filters by title or key, and says when nothing matches', () => {
    const picker = open()
    const search = within(picker).getByPlaceholderText('Search cards on this board')

    fireEvent.change(search, { target: { value: 'docs' } })
    expect(within(picker).queryByText('Card IMPL-3')).toBeNull()
    expect(within(picker).getByText('Write the docs')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'impl-3' } })
    expect(within(picker).getByText('Card IMPL-3')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(within(picker).getByText('No cards match.')).toBeTruthy()
  })

  it('has no picker for a read-only reader', () => {
    render(
      <BlockersSection
        item={item([blocker('x', 'IMPL-1')])}
        blockers={board(cards)}
        canEdit={false}
      />,
    )

    expect(screen.queryByRole('region', { name: 'Add blocker' })).toBeNull()
  })
})
