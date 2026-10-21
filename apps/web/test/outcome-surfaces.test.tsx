import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SetOutcomePage from '@/app/(desk)/delivery/issues/[ideaId]/outcome/page'
import { OutcomeCards } from '@/components/delivery/outcome-cards'
import { apiGet } from '@/lib/api/client'
import type { WireRoadmap } from '@/lib/api/wire'
import { getOutcomeOf } from '@/lib/data/outcomes'
import { actAs } from './support/acting-role'
import { outcome, outcomeIdea } from './support/outcomes'

/**
 * The remaining Outcome surfaces: the Roadmap's cards, the Set outcome page's choices, and the
 * read behind the Issue drawer's Outcome control. The API client and the data seam are the boundary.
 */
const mocks = vi.hoisted(() => ({
  roadmap: { outcomes: [] as unknown[], ungrouped: [] as unknown[] },
}))

vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiGet: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@/lib/server/current-user', () => ({ requireCurrentUser: async () => ({}) }))
vi.mock('@/components/nav/topbar', () => ({ Topbar: () => null }))
vi.mock('@/components/inspector/close-on-escape', () => ({ CloseOnEscape: () => null }))
vi.mock('@/lib/data', () => ({
  getIssue: async () => ({ id: 'i-1', title: 'Fix login', effort: 'M' }),
  getOutcomeRoadmap: async () => mocks.roadmap,
}))

const statuses = new Map([['s-open', { name: 'Open', color: '#111111' }]])
const members = new Map([['u-ann', { id: 'u-ann', name: 'Ann Lee' }]]) as never

beforeEach(() => {
  mocks.roadmap = { outcomes: [], ungrouped: [] }
  actAs('OrgAdmin')
})

describe('Roadmap Outcome cards', () => {
  const cardOf = (name: string) => screen.getByRole('link', { name }).closest('li') as HTMLElement

  it('shows done over total, and a progress bar at the rounded share', () => {
    const { container } = render(
      <OutcomeCards
        outcomes={[outcome({ ideaCount: 3, doneIdeaCount: 1 })]}
        statuses={statuses}
        members={members}
      />,
    )
    const card = cardOf('Faster onboarding')
    expect(card.textContent).toContain('1 / 3')
    expect(container.querySelector('[style*="width: 33%"]')).not.toBeNull()
  })

  it('draws an empty bar, not NaN, for an Outcome with no items, and says so', () => {
    const { container } = render(
      <OutcomeCards outcomes={[outcome()]} statuses={statuses} members={members} />,
    )
    expect(container.querySelector('[style*="width: 0%"]')).not.toBeNull()
    expect(screen.getByText('No issues grouped here yet.')).toBeTruthy()
  })

  it('writes the window as months and links to the Outcome page', () => {
    render(
      <OutcomeCards outcomes={[outcome({ id: 'o-9' })]} statuses={statuses} members={members} />,
    )
    const card = cardOf('Faster onboarding')
    expect(within(card).getByText('OCT – DEC 2026')).toBeTruthy()
    expect(within(card).getByRole('link', { name: 'Faster onboarding' }).getAttribute('href')).toBe(
      '/delivery/outcomes/o-9',
    )
  })

  it('lists a grouped item with its status, and Unassigned without an assignee', () => {
    render(
      <OutcomeCards
        outcomes={[
          outcome({
            ideaCount: 2,
            ideas: [
              outcomeIdea('a', { title: 'Alpha', itemKey: 'OPS-1', assigneeUserIds: ['u-ann'] }),
              outcomeIdea('b', { title: 'Beta', statusId: 's-gone' }),
            ],
          }),
        ]}
        statuses={statuses}
        members={members}
      />,
    )
    const card = cardOf('Faster onboarding')
    expect(within(card).getByText('OPS-1')).toBeTruthy()
    expect(within(card).getByText('Open')).toBeTruthy()
    expect(within(card).getByText('Ann Lee')).toBeTruthy()
    expect(within(card).getByText('Unknown status')).toBeTruthy()
    expect(within(card).getByText('Unassigned')).toBeTruthy()
  })
})

describe('Set outcome page', () => {
  const render_ = async () =>
    render(await SetOutcomePage({ params: Promise.resolve({ ideaId: 'i-1' }) }))
  const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(name) })

  beforeEach(() => {
    mocks.roadmap = {
      outcomes: [
        outcome({ id: 'o-a', name: 'Alpha goal', ideaCount: 1, ideas: [outcomeIdea('x')] }),
        outcome({
          id: 'o-b',
          name: 'Beta goal',
          ideaCount: 2,
          ideas: [outcomeIdea('i-1'), outcomeIdea('y')],
        }),
      ],
      ungrouped: [],
    }
  })

  it('lists the real Outcomes with item counts and months, plus a No outcome choice', async () => {
    await render_()
    expect(radio('Alpha goal').closest('div')?.textContent).toContain('1 item · OCT – DEC 2026')
    expect(radio('Beta goal').closest('div')?.textContent).toContain('2 items')
    expect(radio('No outcome')).toBeTruthy()
  })

  it('checks the Outcome the issue is grouped under', async () => {
    await render_()
    expect((radio('Beta goal') as HTMLInputElement).checked).toBe(true)
    expect((radio('Alpha goal') as HTMLInputElement).checked).toBe(false)
    expect((radio('No outcome') as HTMLInputElement).checked).toBe(false)
  })

  it('checks No outcome when the issue is in none', async () => {
    mocks.roadmap = { outcomes: [outcome({ id: 'o-a', name: 'Alpha goal' })], ungrouped: [] }
    await render_()
    expect((radio('No outcome') as HTMLInputElement).checked).toBe(true)
  })

  it('leaves the choices open to an Org Admin', async () => {
    await render_()
    expect((radio('Alpha goal') as HTMLInputElement).disabled).toBe(false)
  })

  it('disables the choices for a User', async () => {
    actAs('User')
    await render_()
    expect((radio('Alpha goal') as HTMLInputElement).disabled).toBe(true)
    expect((radio('No outcome') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('The Issue drawer’s Outcome read', () => {
  const wireIdea = (ideaId: string) => ({
    ideaId,
    itemKey: null,
    title: ideaId,
    statusId: 's',
    effort: null,
    assigneeUserIds: [],
    sprintId: null,
    sprintStart: null,
    sprintEnd: null,
    metrics: [],
  })
  const wireOutcome = (outcomeId: string, ideas: string[]) => ({
    outcomeId,
    organizationId: 'org',
    name: outcomeId,
    description: null,
    targetStartDate: '2026-10-01',
    targetEndDate: '2026-12-31',
    ownerUserId: null,
    sortOrder: 1,
    color: '#336699',
    ideaCount: ideas.length,
    doneIdeaCount: 0,
    taskCount: 0,
    doneTaskCount: 0,
    sprintStart: null,
    sprintEnd: null,
    metricTotals: [],
    ideas: ideas.map(wireIdea),
  })
  const answer = (wire: WireRoadmap) => vi.mocked(apiGet).mockResolvedValue(wire)

  it('finds the Outcome whose items include the Issue', async () => {
    answer({
      outcomes: [wireOutcome('o-a', ['x']), wireOutcome('o-b', ['y', 'i-1'])],
      ungrouped: [],
    })
    expect((await getOutcomeOf('i-1'))?.id).toBe('o-b')
  })

  it('is null for an Issue in no Outcome, even one the roadmap lists as ungrouped', async () => {
    answer({ outcomes: [wireOutcome('o-a', ['x'])], ungrouped: [wireIdea('i-1')] })
    expect(await getOutcomeOf('i-1')).toBeNull()
  })
})
