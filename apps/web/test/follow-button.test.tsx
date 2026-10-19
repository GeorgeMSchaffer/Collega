import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FollowButton } from '@/components/ideas/engagement'
import { setFollowing } from '@/lib/server/idea-actions'

/**
 * The Follow / Following toggle (slice 153, `20-feature-idea-following.md` rules 45–46): it shows
 * the new state and count at once, falls back and shows the API's message on a refusal, and is a
 * disabled-with-reason control for a role that may not follow. The server action is the boundary.
 */
vi.mock('@/lib/server/idea-actions', () => ({
  toggleUpvote: vi.fn(),
  addComment: vi.fn(),
  setFollowing: vi.fn(),
}))

const save = vi.mocked(setFollowing)

function renderButton(props: Partial<Parameters<typeof FollowButton>[0]> = {}) {
  return render(
    <FollowButton
      ideaId="idea-1"
      boardId="board-1"
      isFollowing={false}
      followerCount={2}
      denial={null}
      {...props}
    />,
  )
}

const toggle = () => screen.getByRole('button', { name: /Follow/ })

function deferred() {
  let settle: (result: { error: string | null }) => void = () => {}
  save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve
      }),
  )
  return (result: { error: string | null }) =>
    act(async () => {
      settle(result)
    })
}

beforeEach(() => {
  save.mockReset()
  save.mockResolvedValue({ error: null })
})

describe('FollowButton', () => {
  it('reads Follow · N, unpressed, for an idea the reader does not follow', () => {
    renderButton()
    expect(toggle().textContent).toBe('Follow · 2')
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
  })

  it('reads Following · N, pressed, for one they do', () => {
    renderButton({ isFollowing: true })
    expect(toggle().textContent).toBe('Following · 2')
    expect(toggle().getAttribute('aria-pressed')).toBe('true')
  })

  it('follows with the idea and board ids, and counts the reader in at once', async () => {
    const answer = deferred()
    renderButton()
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(save).toHaveBeenCalledExactlyOnceWith('idea-1', 'board-1', true)
    expect(toggle().textContent).toBe('Following · 3')
    expect(toggle().getAttribute('aria-pressed')).toBe('true')
    await answer({ error: null })
  })

  it('unfollows and counts the reader out at once', async () => {
    const answer = deferred()
    renderButton({ isFollowing: true })
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(save).toHaveBeenCalledExactlyOnceWith('idea-1', 'board-1', false)
    expect(toggle().textContent).toBe('Follow · 1')
    await answer({ error: null })
  })

  it('sends an empty board id for an idea on no board', async () => {
    renderButton({ boardId: null })
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(save).toHaveBeenCalledWith('idea-1', '', true)
  })

  it('falls back to the detail’s state and shows the API message when refused', async () => {
    const answer = deferred()
    renderButton()
    await act(async () => {
      fireEvent.click(toggle())
    })
    await answer({ error: 'That idea no longer exists.' })
    expect(toggle().textContent).toBe('Follow · 2')
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('status').textContent).toBe('That idea no longer exists.')
  })

  it('clears an earlier refusal on the next press', async () => {
    save.mockResolvedValueOnce({ error: 'Refused' })
    renderButton()
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(screen.queryByRole('status')).not.toBeNull()
    await act(async () => {
      fireEvent.click(toggle())
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says how many people follow, for a screen reader, in the singular too', () => {
    const { unmount } = renderButton({ followerCount: 1 })
    expect(screen.getByText('1 person follows this idea')).toBeTruthy()
    unmount()
    renderButton({ followerCount: 4 })
    expect(screen.getByText('4 people follow this idea')).toBeTruthy()
  })

  it('is aria-disabled with the reason shown, and never saves, when follow is denied', async () => {
    renderButton({ denial: 'Follow through View As.' })
    const button = toggle()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Follow through View As.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(save).not.toHaveBeenCalled()
  })
})
