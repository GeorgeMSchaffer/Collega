import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistChat } from '@/components/ideas/assist-chat'
import type { IdeaFormAssist } from '@/components/ideas/idea-form'
import type { AssistTurnResponse, AssistTurnResult } from '@/lib/assist-turn'
import { takeAssistTurn } from '@/lib/server/assist-actions'
import { SessionProvider } from '@/lib/session-client'
import type { CurrentUser } from '@/lib/types'

/**
 * The idea assistant's chat (slices 309-310) against a replaced turn action and a fake form
 * handle: what each turn sends, the 429 notice, Stop, the off-topic system note, the failure
 * hand-off to the form, and the chips. The form's own behaviour is idea-form-assist.test.tsx.
 */
vi.mock('@/lib/server/assist-actions', () => ({ takeAssistTurn: vi.fn() }))

const turn = vi.mocked(takeAssistTurn)

const USER: CurrentUser = {
  userId: 'u1',
  displayName: 'Dana Smith',
  initials: 'DS',
  role: 'User',
  roleLabel: 'User',
  organizationId: 'org-1',
  organizationName: 'Acme',
  viewingAs: null,
}

function answer(overrides: Partial<AssistTurnResponse> = {}): AssistTurnResult {
  return {
    ok: true,
    turn: {
      inScope: true,
      conversationClosed: false,
      nextQuestion: 'What is the impact?',
      changes: {},
      nextStep: 'impactRationale',
      turnsRemaining: 9,
      ...overrides,
    },
  }
}

function fakeForm(read: ReturnType<IdeaFormAssist['read']> = { draft: {}, lockedFields: [] }) {
  const handle = {
    read: vi.fn(() => read),
    apply: vi.fn((_changes: unknown, _options?: unknown): { filled: string[]; kept: string[] } => ({
      filled: ['Problem'],
      kept: [],
    })),
    review: vi.fn(() => true),
    place: vi.fn(),
  }
  const ref = createRef<IdeaFormAssist>() as { current: IdeaFormAssist | null }
  ref.current = handle as unknown as IdeaFormAssist
  return { handle, ref: ref as RefObject<IdeaFormAssist | null> }
}

function mount(
  options: {
    form?: ReturnType<typeof fakeForm>
    boardId?: string | null
    solutions?: string[]
    onFailed?: () => void
    onReview?: () => void
  } = {},
) {
  const form = options.form ?? fakeForm()
  const onFailed = options.onFailed ?? vi.fn()
  const onReview = options.onReview ?? vi.fn()
  render(
    <SessionProvider user={USER}>
      <AssistChat
        boardId={options.boardId === undefined ? 'board-1' : options.boardId}
        form={form.ref}
        solutions={options.solutions ?? []}
        active
        onManual={() => {}}
        onReview={onReview}
        onFailed={onFailed}
      />
    </SessionProvider>,
  )
  return { form, onFailed, onReview }
}

const composer = () => screen.getByLabelText('Message the assistant') as HTMLTextAreaElement

async function say(text: string) {
  fireEvent.change(composer(), { target: { value: text } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  })
}

beforeEach(() => {
  turn.mockReset()
  // jsdom has no scrollTo; the transcript scrolls itself to the newest message.
  Element.prototype.scrollTo = () => {}
})

describe('AssistChat turns', () => {
  it('sends the transcript, the form’s draft and lockedFields, and no step on the first turn', async () => {
    turn.mockResolvedValue(answer())
    mount({
      form: fakeForm({ draft: { title: 'Mine' }, lockedFields: ['title'] }),
      boardId: null,
    })

    await say('Techs lose hours')

    expect(turn).toHaveBeenCalledWith(null, {
      transcript: [{ role: 'user', text: 'Techs lose hours' }],
      draft: { title: 'Mine' },
      lockedFields: ['title'],
    })
  })

  it('re-reads lockedFields on every turn and sends the previous nextStep', async () => {
    turn.mockResolvedValue(answer({ nextStep: 'proposedSolutions' }))
    const form = fakeForm()
    mount({ form })

    await say('First')
    form.handle.read.mockReturnValue({ draft: { problem: 'Edited' }, lockedFields: ['problem'] })
    await say('Second')

    const second = turn.mock.calls[1]?.[1]
    expect(second?.lockedFields).toEqual(['problem'])
    expect(second?.draft).toEqual({ problem: 'Edited' })
    expect(second?.step).toBe('proposedSolutions')
    expect(second?.transcript.map((entry) => entry.role)).toEqual(['user', 'assistant', 'user'])
  })

  it('applies the answer’s changes to the form and shows what was filled in', async () => {
    turn.mockResolvedValue(answer({ changes: { problem: 'Parts are hard to find' } }))
    const { form } = mount()

    await say('Techs lose hours')

    expect(form.handle.apply).toHaveBeenCalledWith({ problem: 'Parts are hard to find' })
    expect(await screen.findByText('What is the impact?')).toBeTruthy()
    expect(screen.getByText('Filled in: Problem')).toBeTruthy()
  })

  it('says it kept an edit the person made while the turn was in flight', async () => {
    turn.mockResolvedValue(answer())
    const form = fakeForm()
    form.handle.apply.mockReturnValue({ filled: [], kept: ['Title'] })
    mount({ form })

    await say('Hello')

    expect(await screen.findByText('What is the impact? I kept your edit to Title.')).toBeTruthy()
  })
})

describe('AssistChat rate limit (429)', () => {
  it('keeps the chat, returns the message to the composer and shows the wait as a system note', async () => {
    turn.mockResolvedValue({ ok: false, rateLimited: true, retryAfter: 12 })
    const { onFailed, form } = mount()

    await say('Techs lose hours')

    expect(await screen.findByText('Too many requests; try again in 12 seconds.')).toBeTruthy()
    expect(composer().value).toBe('Techs lose hours')
    expect(screen.queryByText('Techs lose hours', { selector: 'div' })).toBeNull()
    expect(screen.getByText('10 replies left')).toBeTruthy()
    expect(onFailed).not.toHaveBeenCalled()
    expect(form.handle.place).not.toHaveBeenCalled()
  })

  it('uses the singular for one second and a generic wait when none is given', async () => {
    turn.mockResolvedValueOnce({ ok: false, rateLimited: true, retryAfter: 1 })
    mount()
    await say('One')
    expect(await screen.findByText('Too many requests; try again in 1 second.')).toBeTruthy()

    turn.mockResolvedValueOnce({ ok: false, rateLimited: true, retryAfter: undefined })
    await say('Two')
    expect(await screen.findByText('Too many requests; try again in a moment.')).toBeTruthy()
  })

  it('replaces a repeated notice rather than stacking it, and clears it on the next good turn', async () => {
    turn.mockResolvedValueOnce({ ok: false, rateLimited: true, retryAfter: 5 })
    turn.mockResolvedValueOnce({ ok: false, rateLimited: true, retryAfter: 3 })
    turn.mockResolvedValueOnce(answer())
    mount()

    await say('Again')
    await say('Again')
    expect(screen.getAllByText(/Too many requests/)).toHaveLength(1)
    expect(screen.getByText('Too many requests; try again in 3 seconds.')).toBeTruthy()

    await say('Again')
    expect(screen.queryByText(/Too many requests/)).toBeNull()
  })
})

describe('AssistChat failure hand-off', () => {
  it.each([['a refused turn', { ok: false, rateLimited: false } as AssistTurnResult]])(
    'places the text in the form and hands off after %s',
    async (_label, result) => {
      turn.mockResolvedValueOnce(answer({ nextStep: 'impactRationale' }))
      turn.mockResolvedValueOnce(result)
      const { form, onFailed } = mount()

      await say('First')
      await say('Second, which fails')

      expect(form.handle.place).toHaveBeenCalledWith('Second, which fails', 'impactRationale')
      expect(onFailed).toHaveBeenCalledTimes(1)
    },
  )

  it('treats a thrown action like any other failure', async () => {
    turn.mockRejectedValue(new Error('network'))
    const { form, onFailed } = mount()

    await say('Lost text')

    expect(form.handle.place).toHaveBeenCalledWith('Lost text', undefined)
    expect(onFailed).toHaveBeenCalledTimes(1)
  })
})

describe('AssistChat Stop', () => {
  it('cancels the turn, returns the message to the composer and ignores the late answer', async () => {
    let resolve: (value: AssistTurnResult) => void = () => {}
    turn.mockReturnValue(new Promise<AssistTurnResult>((r) => (resolve = r)))
    const { form } = mount()

    await say('Slow question')
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }))

    expect(composer().value).toBe('Slow question')
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.getByText('10 replies left')).toBeTruthy()

    await act(async () => {
      resolve(answer({ changes: { problem: 'Late' } }))
    })
    expect(form.handle.apply).not.toHaveBeenCalled()
    expect(screen.queryByText('What is the impact?')).toBeNull()
  })
})

describe('AssistChat off-topic turn', () => {
  it('shows the redirect as a system note, strikes the message and drops it from the next transcript', async () => {
    turn.mockResolvedValueOnce(
      answer({
        inScope: false,
        nextQuestion: 'Let us stay on ideas.',
        turnsRemaining: 10,
        nextStep: 'problem',
      }),
    )
    turn.mockResolvedValueOnce(answer())
    const { form } = mount()

    await say('What is the weather?')

    const note = await screen.findByText('Let us stay on ideas.')
    expect(note.tagName).toBe('P')
    expect(note.closest('[class*="rounded-2xl"]')).toBeNull()
    expect(form.handle.apply).not.toHaveBeenCalled()
    expect(screen.getByText('What is the weather?').className).toContain('line-through')

    await say('A real idea')
    expect(turn.mock.calls[1]?.[1].transcript).toEqual([{ role: 'user', text: 'A real idea' }])
  })

  it('removes the struck-through message after its delay', async () => {
    vi.useFakeTimers()
    try {
      turn.mockResolvedValue(answer({ inScope: false, nextQuestion: 'Stay on topic.' }))
      mount()

      fireEvent.change(composer(), { target: { value: 'Off topic' } })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Send' }))
      })
      expect(screen.getByText('Off topic')).toBeTruthy()

      await act(async () => {
        vi.advanceTimersByTime(1500)
      })
      expect(screen.queryByText('Off topic')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('AssistChat conversation end', () => {
  it('closes the composer and offers the form when the conversation is closed', async () => {
    turn.mockResolvedValue(
      answer({
        inScope: false,
        conversationClosed: true,
        nextQuestion: 'This conversation is closed.',
      }),
    )
    mount()

    await say('Nope')

    expect(await screen.findByText('The form is still here for you.')).toBeTruthy()
    expect(composer().disabled).toBe(true)
    expect(screen.getByText('No replies left')).toBeTruthy()
  })

  it('closes when no turns remain', async () => {
    turn.mockResolvedValue(answer({ turnsRemaining: 0 }))
    mount()

    await say('Last one')

    expect(await screen.findByText(/most I can help with/)).toBeTruthy()
    expect(composer().disabled).toBe(true)
  })
})

describe('AssistChat chips', () => {
  const OFFER = answer({
    changes: {},
    nextStep: 'proposedSolutions',
    suggestions: { solutions: ['Wizard', 'Checklist'], rationales: ['Saves hours'] },
  })

  it('applies a chosen solution and a rationale with release, and marks the solution pressed', async () => {
    turn.mockResolvedValue(OFFER)
    const form = fakeForm()
    const { rerender } = renderWithRerender(form, [])
    await say('Idea')

    form.handle.apply.mockClear()
    fireEvent.click(await screen.findByRole('button', { name: 'Wizard' }))
    expect(form.handle.apply).toHaveBeenCalledWith(
      { proposedSolutions: ['Wizard'] },
      { release: true },
    )

    rerender(['Wizard'])
    expect(screen.getByRole('button', { name: 'Wizard' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Checklist' }).getAttribute('aria-pressed')).toBe(
      'false',
    )

    form.handle.apply.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Wizard' }))
    expect(form.handle.apply).toHaveBeenCalledWith({ proposedSolutions: [] }, { release: true })

    fireEvent.click(screen.getByRole('button', { name: 'Saves hours' }))
    expect(form.handle.apply).toHaveBeenLastCalledWith(
      { impactRationale: 'Saves hours' },
      { release: true },
    )
  })

  it('refuses a sixth solution with a note and does not write to the form', async () => {
    turn.mockResolvedValue(OFFER)
    const form = fakeForm()
    const { rerender } = renderWithRerender(form, [])
    await say('Idea')
    await screen.findByRole('button', { name: 'Wizard' })
    rerender(['a', 'b', 'c', 'd', 'e'])
    form.handle.apply.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Wizard' }))

    expect(form.handle.apply).not.toHaveBeenCalled()
    expect(screen.getByText(/holds up to 5 solutions/)).toBeTruthy()
  })

  it('offers “Sharpen the problem first” beside solutions, and sending it is a normal turn', async () => {
    turn.mockResolvedValueOnce(
      answer({ nextStep: 'proposedSolutions', suggestions: { solutions: ['Wizard'] } }),
    )
    turn.mockResolvedValueOnce(answer())
    mount()
    await say('Idea')

    fireEvent.click(await screen.findByRole('button', { name: 'Sharpen the problem first' }))

    await waitFor(() => expect(turn).toHaveBeenCalledTimes(2))
    expect(turn.mock.calls[1]?.[1].transcript.at(-1)).toEqual({
      role: 'user',
      text: 'Sharpen the problem first',
    })
  })

  it('omits “Sharpen the problem first” when the person owns the problem', async () => {
    turn.mockResolvedValue(answer({ nextStep: 'proposedSolutions' }))
    mount({ form: fakeForm({ draft: {}, lockedFields: ['problem'] }) })

    await say('Idea')

    await screen.findByText('What is the impact?')
    expect(screen.queryByRole('button', { name: 'Sharpen the problem first' })).toBeNull()
  })

  it('offers Review and create when done, which asks the form to review', async () => {
    turn.mockResolvedValue(answer({ nextStep: 'done' }))
    const { onReview } = mount()
    await say('Idea')

    fireEvent.click(await screen.findByRole('button', { name: 'Review and create' }))

    expect(onReview).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Make the rationale measurable' })).toBeTruthy()
  })

  it('leaves only the latest offer live', async () => {
    turn.mockResolvedValueOnce(
      answer({ nextStep: 'proposedSolutions', suggestions: { solutions: ['Wizard'] } }),
    )
    turn.mockResolvedValueOnce(
      answer({ nextStep: 'proposedSolutions', suggestions: { solutions: ['Checklist'] } }),
    )
    mount()
    await say('One')
    await screen.findByRole('button', { name: 'Wizard' })
    await say('Two')
    await screen.findByRole('button', { name: 'Checklist' })

    expect((screen.getByRole('button', { name: 'Wizard' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect((screen.getByRole('button', { name: 'Checklist' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })
})

/** Mounts with a `solutions` prop the test can change, as the form's list does. */
function renderWithRerender(form: ReturnType<typeof fakeForm>, initial: string[]) {
  const element = (solutions: string[]) => (
    <SessionProvider user={USER}>
      <AssistChat
        boardId="board-1"
        form={form.ref}
        solutions={solutions}
        active
        onManual={() => {}}
        onReview={() => {}}
        onFailed={() => {}}
      />
    </SessionProvider>
  )
  const view = render(element(initial))
  return { rerender: (solutions: string[]) => view.rerender(element(solutions)) }
}
