import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type PullSetup, PullStep } from '@/components/settings/pull-step'
import { PULL_ITEM_CAP } from '@/lib/limits'
import type { PullCandidate, Status } from '@/lib/types'

/**
 * The board form's *Add existing items* step (`20-feature-board-pull-in.md` rules 9-13 and 17):
 * the tabs each role sees, the archived-board lock, selection and the 100-item cap, where an item
 * lands, and the per-item refusals shown beside `pullItemIds`. The pull-candidates route is the
 * boundary and is answered by a stubbed `fetch`; nothing else is mocked.
 */
const NEW: Status = { id: 's-new', name: 'New', color: '#111' }
const REVIEW: Status = { id: 's-rev', name: 'In Review', color: '#222' }
const DONE: Status = { id: 's-done', name: 'Complete', color: '#333' }

function candidate(over: Partial<PullCandidate> = {}): PullCandidate {
  return {
    id: 'i-1',
    title: 'Slow conveyor',
    authorUserId: 'u-1',
    authorName: 'Ada',
    boardId: null,
    boardName: null,
    statusId: NEW.id,
    statusName: 'New',
    phase: 'Discovery',
    tags: [],
    isMine: true,
    ...over,
  }
}

const SETUP: PullSetup = {
  isAdmin: true,
  tags: [{ id: 't-1', name: 'safety', color: '#b91c1c' }],
  members: [{ id: 'u-1', name: 'Ada' }],
  archivedBoardIds: ['b-old'],
  archived: false,
}

let answers: Record<string, PullCandidate[]> = {}
let requests: URL[] = []

beforeEach(() => {
  answers = {}
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://web.test')
      requests.push(url)
      const items = answers[url.searchParams.get('source') ?? ''] ?? []
      return Response.json({ items, page: 1, pageSize: 20, totalCount: items.length })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

function Harness({
  setup = SETUP,
  initial = [],
  refused = [],
  lanes = [NEW, DONE],
  boardId = null,
}: {
  setup?: PullSetup
  initial?: PullCandidate[]
  refused?: string[]
  lanes?: Status[]
  boardId?: string | null
}) {
  const [selected, setSelected] = useState(initial)
  return (
    <form>
      <PullStep
        setup={setup}
        boardId={boardId}
        boardName="Assembly"
        lanes={lanes}
        statuses={[NEW, REVIEW, DONE]}
        laneRemoval={false}
        selected={selected}
        onChange={setSelected}
        refused={refused}
      />
    </form>
  )
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /Add existing items/ }))
const hiddenIds = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLInputElement>('input[name="pullItemIds"]')].map(
    (input) => input.value,
  )

describe('PullStep tabs by role', () => {
  it('gives an Org Admin all three tabs, with the author filter', async () => {
    render(<Harness />)
    open()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+$/, ''))
    expect(tabs).toEqual(['Unassigned ideas', 'Ideas on other boards', 'Backlog Issues'])
    expect(screen.getAllByLabelText('Author').length).toBeGreaterThan(0)
  })

  it('gives a User two tabs, no Backlog Issues, no author filter and a note about their own ideas', () => {
    render(<Harness setup={{ ...SETUP, isAdmin: false, members: [] }} />)
    open()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+$/, ''))).toEqual([
      'Unassigned ideas',
      'Ideas on other boards',
    ])
    expect(screen.queryByRole('tab', { name: /Backlog/ })).toBeNull()
    expect(screen.queryByLabelText('Author')).toBeNull()
    expect(screen.getByText('You can pull ideas you created.')).toBeTruthy()
  })

  it('moves between tabs with the arrow keys and wraps', () => {
    render(<Harness />)
    open()
    const first = screen.getByRole('tab', { name: /Unassigned/ })
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: /Backlog Issues/ }).getAttribute('aria-selected')).toBe(
      'true',
    )
    fireEvent.keyDown(screen.getByRole('tab', { name: /Backlog Issues/ }), { key: 'ArrowRight' })
    expect(first.getAttribute('aria-selected')).toBe('true')
  })
})

describe('PullStep reading', () => {
  it('reads nothing until the step is first opened', () => {
    render(<Harness />)
    expect(requests).toEqual([])
  })

  it('asks for the tab it shows, and excludes the board being edited', async () => {
    render(<Harness boardId="b-edit" />)
    open()
    await waitFor(() => expect(requests.length).toBeGreaterThan(0))
    const params = requests.map((url) => url.searchParams)
    expect(params.every((p) => p.get('excludeBoardId') === 'b-edit')).toBe(true)
    expect(new Set(params.map((p) => p.get('source')))).toEqual(
      new Set(['unassigned', 'boards', 'backlog']),
    )
  })

  it('sends no excludeBoardId when creating', async () => {
    render(<Harness />)
    open()
    await waitFor(() => expect(requests.length).toBeGreaterThan(0))
    expect(requests.every((url) => !url.searchParams.has('excludeBoardId'))).toBe(true)
  })

  it('says so when a tab has nothing to pull', async () => {
    render(<Harness />)
    open()
    expect(await screen.findAllByText('No ideas to pull here.')).not.toHaveLength(0)
  })

  it('labels a pool idea No board and an archived board archived, and flags an Issue', async () => {
    answers.unassigned = [candidate({ id: 'i-pool' })]
    answers.boards = [
      candidate({ id: 'i-old', title: 'Old idea', boardId: 'b-old', boardName: 'Old plant' }),
    ]
    answers.backlog = [candidate({ id: 'i-issue', title: 'Late issue', phase: 'Delivery' })]
    render(<Harness />)
    open()
    expect(await screen.findAllByText('No board', { selector: 'span' })).not.toHaveLength(0)
    expect(await screen.findByText('archived')).toBeTruthy()
    expect(await screen.findByText(/Issue · returns to Discovery, tasks kept/)).toBeTruthy()
  })
})

describe('PullStep landing line', () => {
  it('says an item keeps its status when a lane has it', async () => {
    answers.unassigned = [candidate()]
    render(<Harness lanes={[NEW, DONE]} />)
    open()
    const row = (await screen.findByText('Slow conveyor', { selector: 'span' })).closest('label')
    expect(row?.textContent).toContain('keeps its status')
  })

  it('says an item lands in the first lane, with its new status, when no lane has its status', async () => {
    answers.unassigned = [candidate({ statusId: REVIEW.id, statusName: 'In Review' })]
    render(<Harness lanes={[NEW, DONE]} />)
    open()
    const row = (await screen.findByText('Slow conveyor', { selector: 'span' })).closest('label')
    expect(row?.textContent).toContain('first lane (no In Review lane here), status becomes New')
  })
})

describe('PullStep selection', () => {
  it('selects and deselects an item, posting its id as pullItemIds', async () => {
    answers.unassigned = [candidate({ id: 'i-1' }), candidate({ id: 'i-2', title: 'Noisy press' })]
    const { container } = render(<Harness />)
    open()
    const first = await screen.findByRole('checkbox', { name: /Slow conveyor/ })
    fireEvent.click(first)
    fireEvent.click(await screen.findByRole('checkbox', { name: /Noisy press/ }))
    expect(hiddenIds(container)).toEqual(['i-1', 'i-2'])
    expect(screen.getByText('2 of 100')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Add existing items/ }).textContent).toContain(
      '2 selected',
    )
    fireEvent.click(first)
    expect(hiddenIds(container)).toEqual(['i-2'])
  })

  it('removes an item from the summary with its remove control', () => {
    const { container } = render(
      <Harness initial={[candidate({ id: 'i-9', title: 'Burnt fuse' })]} />,
    )
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Burnt fuse' }))
    expect(hiddenIds(container)).toEqual([])
    expect(screen.getByText('Nothing selected yet.')).toBeTruthy()
  })
})

describe('PullStep 100-item cap', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      candidate({ id: `i-${index}`, title: `Idea ${index}` }),
    )

  it('shows no warning at exactly the cap', () => {
    render(<Harness initial={many(PULL_ITEM_CAP)} />)
    open()
    expect(screen.getByText('100 of 100')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('names how many to remove at one over the cap', () => {
    render(<Harness initial={many(PULL_ITEM_CAP + 1)} />)
    open()
    expect(screen.getByText('101 of 100')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain(
      '1 over the limit. Remove 1 item to save (at most 100 per save).',
    )
  })

  it('pluralises the warning for several over the cap', () => {
    render(<Harness initial={many(PULL_ITEM_CAP + 3)} />)
    open()
    expect(screen.getByRole('status').textContent).toContain('Remove 3 items to save')
  })

  it('stops a submit of the surrounding form while over the cap, and lets one through at the cap', () => {
    const over = render(<Harness initial={many(PULL_ITEM_CAP + 1)} />)
    const overEvent = new Event('submit', { cancelable: true, bubbles: true })
    over.container.querySelector('form')?.dispatchEvent(overEvent)
    expect(overEvent.defaultPrevented).toBe(true)
    over.unmount()

    const ok = render(<Harness initial={many(PULL_ITEM_CAP)} />)
    const okEvent = new Event('submit', { cancelable: true, bubbles: true })
    ok.container.querySelector('form')?.dispatchEvent(okEvent)
    expect(okEvent.defaultPrevented).toBe(false)
  })
})

describe('PullStep refusals', () => {
  const REFUSALS = [
    "'Slow conveyor' was moved to another board. Reload the list.",
    'You may pull only ideas you created.',
  ]

  it('shows nothing when nothing was refused', () => {
    render(<Harness />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Needs attention')).toBeNull()
  })

  it('opens the step, focuses the alert, and lists every message, saying the board was not created', () => {
    render(<Harness initial={[candidate()]} refused={REFUSALS} />)
    const alert = screen.getByRole('alert')
    expect(document.activeElement).toBe(alert)
    expect(
      screen.getByRole('button', { name: /Add existing items/ }).getAttribute('aria-expanded'),
    ).toBe('true')
    expect(screen.getByText('Needs attention')).toBeTruthy()
    expect(alert.textContent).toContain('Nothing was saved.')
    expect(alert.textContent).toContain('The board was not created.')
    for (const message of REFUSALS) expect(within(alert).getByText(message)).toBeTruthy()
  })

  it('says the board is unchanged when editing', () => {
    render(<Harness boardId="b-1" initial={[candidate()]} refused={REFUSALS} />)
    expect(screen.getByRole('alert').textContent).toContain('The board is unchanged.')
  })

  it('marks the refused item, matched by its quoted title, and not the others', () => {
    render(
      <Harness
        initial={[candidate(), candidate({ id: 'i-2', title: 'Noisy press' })]}
        refused={[REFUSALS[0] as string]}
      />,
    )
    const chips = screen.getAllByRole('listitem')
    const refusedChips = chips.filter((chip) => chip.textContent?.includes('Refused'))
    expect(refusedChips).toHaveLength(1)
    expect(refusedChips[0]?.textContent).toContain('Slow conveyor')
  })

  it('marks the refused item when the message names its id instead of its title', () => {
    render(
      <Harness
        initial={[candidate({ id: 'a1b2c3d4-0000' })]}
        refused={['Idea a1b2c3d4-0000 was not found in this organization.']}
      />,
    )
    expect(screen.getByText('Refused')).toBeTruthy()
  })
})

describe('PullStep on an archived board', () => {
  it('shows disabled with its reason, opens nothing and reads nothing', () => {
    render(<Harness setup={{ ...SETUP, archived: true }} boardId="b-1" />)
    const toggle = screen.getByRole('button', { name: /Add existing items/ })
    expect(toggle.getAttribute('aria-disabled')).toBe('true')
    expect(toggle.textContent).toContain('unavailable')
    expect(screen.getByText(/Archived boards take no pull/)).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(requests).toEqual([])
  })

  it('does not open on a refusal either', () => {
    render(<Harness setup={{ ...SETUP, archived: true }} boardId="b-1" refused={['x']} />)
    expect(
      screen.getByRole('button', { name: /Add existing items/ }).getAttribute('aria-expanded'),
    ).toBe('false')
  })
})
