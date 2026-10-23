import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardViewed } from '@/components/analytics/board-viewed'
import { ApiError, apiPost, apiPostReturning } from '@/lib/api/client'
import { takeAssistTurn } from '@/lib/server/assist-actions'
import { saveIdea } from '@/lib/server/idea-actions'
import { startViewAs } from '@/lib/server/view-as-actions'

/**
 * Each custom event fires once from its own surface and carries no properties
 * (`SPEC/20-feature-analytics.md` "Events", requirement 3). The Vercel SDK is the boundary.
 */
const sdk = vi.hoisted(() => ({ serverTrack: vi.fn(), browserTrack: vi.fn() }))
vi.mock('@vercel/analytics/server', () => ({ track: sdk.serverTrack }))
vi.mock('@vercel/analytics', () => ({ track: sdk.browserTrack }))
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPostReturning: vi.fn(),
}))
vi.mock('@/lib/server/current-user', () => ({ actingOrganizationId: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

const EMAIL = 'person@example.test'
const FREE_TEXT = 'Our secret roadmap problem'

const idea = {
  boardId: 'b-1',
  title: FREE_TEXT,
  problem: FREE_TEXT,
  proposedSolutions: '',
  impactRationale: '',
  description: FREE_TEXT,
  priority: 'Medium',
  ideaTypeId: 't-1',
  businessImpactId: 'i-1',
  dueDate: '',
  tagNames: [],
  assigneeUserIds: [],
  mentionEmails: [EMAIL],
  fieldValues: [],
} as unknown as Parameters<typeof saveIdea>[0]

beforeEach(() => {
  vi.stubEnv('COLLEGA_ANALYTICS', 'on')
  sdk.serverTrack.mockReset().mockResolvedValue(undefined)
  sdk.browserTrack.mockReset()
  vi.mocked(apiPost)
    .mockReset()
    .mockResolvedValue(undefined as never)
  vi.mocked(apiPostReturning)
    .mockReset()
    .mockResolvedValue({ ideaId: 'new-id', turn: {} } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  cleanup()
})

/** Every argument the SDK was handed, flattened: nothing sensitive may appear in any of it. */
const sent = () => JSON.stringify([...sdk.serverTrack.mock.calls, ...sdk.browserTrack.mock.calls])

describe('idea.created', () => {
  it('fires once, with no properties, when a new idea is saved', async () => {
    await saveIdea(idea)
    expect(sdk.serverTrack).toHaveBeenCalledExactlyOnceWith('idea.created')
    expect(sent()).not.toContain(EMAIL)
    expect(sent()).not.toContain(FREE_TEXT)
    expect(sent()).not.toContain('new-id')
  })

  it('does not fire when an existing idea is edited', async () => {
    await saveIdea({ ...idea, ideaId: 'i-9' })
    expect(sdk.serverTrack).not.toHaveBeenCalled()
  })

  it('does not fire when the API refuses the create', async () => {
    vi.mocked(apiPostReturning).mockRejectedValue(new ApiError(400, '/x', 'refused', {}))
    await saveIdea(idea)
    expect(sdk.serverTrack).not.toHaveBeenCalled()
  })

  it('still saves when analytics fails to send', async () => {
    sdk.serverTrack.mockRejectedValue(new Error('network'))
    await expect(saveIdea(idea)).resolves.toMatchObject({ ok: true, ideaId: 'new-id' })
  })

  it('sends nothing when analytics is off', async () => {
    vi.stubEnv('COLLEGA_ANALYTICS', '')
    vi.stubEnv('VERCEL_ENV', '')
    await saveIdea(idea)
    expect(sdk.serverTrack).not.toHaveBeenCalled()
  })
})

describe('idea.assist.used', () => {
  it('fires once per turn sent, with no properties and no message text', async () => {
    await takeAssistTurn('b-1', { message: FREE_TEXT } as never)
    expect(sdk.serverTrack).toHaveBeenCalledExactlyOnceWith('idea.assist.used')
    expect(sent()).not.toContain(FREE_TEXT)
    expect(sent()).not.toContain('b-1')
  })

  it('fires once even when the turn is refused', async () => {
    vi.mocked(apiPostReturning).mockRejectedValue(new Error('rate'))
    await takeAssistTurn(null, { message: FREE_TEXT } as never)
    expect(sdk.serverTrack).toHaveBeenCalledExactlyOnceWith('idea.assist.used')
  })
})

describe('view-as.started', () => {
  const form = () => {
    const data = new FormData()
    data.set('targetUserId', 'target-user-id')
    return data
  }

  it('fires once, with no properties, when the session starts', async () => {
    await expect(startViewAs({ error: null }, form())).rejects.toThrow('NEXT_REDIRECT /')
    expect(sdk.serverTrack).toHaveBeenCalledExactlyOnceWith('view-as.started')
    expect(sent()).not.toContain('target-user-id')
  })

  it('does not fire when the API refuses', async () => {
    vi.mocked(apiPost).mockRejectedValue(new Error('no'))
    await startViewAs({ error: null }, form())
    expect(sdk.serverTrack).not.toHaveBeenCalled()
  })
})

describe('board.viewed', () => {
  it('fires once on mount from the browser, with no properties', () => {
    const { rerender } = render(<BoardViewed />)
    rerender(<BoardViewed />)
    expect(sdk.browserTrack).toHaveBeenCalledExactlyOnceWith('board.viewed')
  })
})
