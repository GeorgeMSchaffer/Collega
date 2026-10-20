'use client'

import { Button, cn, Textarea } from '@collega/design-system'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/list/icons'
import {
  ASSIST_TEXT_MAX_LENGTH,
  ASSIST_USER_TURNS,
  type AssistEntry,
  type AssistTurnResponse,
} from '@/lib/assist-turn'
import { takeAssistTurn } from '@/lib/server/assist-actions'
import { useCurrentUser } from '@/lib/session-client'
import type { IdeaFormAssist } from './idea-form'

type Message = {
  id: number
  role: 'user' | 'assistant'
  text: string
  /** Part of what the next request sends. The greeting and a scope redirect are not. */
  sent: boolean
  /** An out-of-scope turn, struck through before it leaves (v1 rule 8). */
  dropped?: boolean
  /** A chip that hands the person to the form. */
  toForm?: boolean
  /** The labels of the fields this reply filled, for its *Filled in: ...* line. */
  filled?: string[]
  /** What the reply offers: applied only when the person chooses one. */
  chips?: Chip[]
}

/** A chip's meaning: `say` sends its text; the rest write into the form when chosen. */
type Chip = { kind: 'say' | 'solution' | 'problem' | 'rationale' | 'review'; text: string }

const SHARPEN = 'Sharpen the problem first'
const MEASURABLE = 'Make the rationale measurable'
const MAX_SOLUTIONS = 5

/** Starter prompts when the organization has no recent idea titles to draw on. */
const STARTERS = [
  'Techs lose hours every week chasing parts because the stock list is out of date',
  'Weekly reporting is copied by hand into a spreadsheet every Friday',
  'Near-misses on the shop floor are not being logged',
]

const DROP_MS = 1400

/**
 * The idea assistant's chat (comp R, left of the create form): a greeting with starter prompts, the
 * transcript, a composer, and a cancellable pending turn. It owns the conversation; the form is
 * reached only through `form` (read what to send, apply what comes back), and `active` going false
 * (the person chose the form) only cancels a turn in flight, so the conversation is intact when it
 * comes back.
 *
 * A turn that throws is a failed turn (`onFailed`): the drawer hands off to the form. A turn judged
 * out of scope is struck through and dropped from the transcript, so it never counts toward the cap.
 */
export function AssistChat({
  boardId,
  form,
  active,
  onManual,
  onReview,
  onFailed,
  className,
}: {
  boardId: string | null
  /** The create form's handle: its values go with every turn and the answer's changes land in it. */
  form: RefObject<IdeaFormAssist | null>
  /** False while the form alone is showing: the chat is hidden but still mounted. */
  active: boolean
  onManual: () => void
  /** *Review and create*: validates the form and moves focus to Create idea. */
  onReview: () => void
  onFailed: () => void
  className?: string
}) {
  const user = useCurrentUser()
  const firstName = user.displayName.split(' ')[0]
  const nextId = useRef(1)
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 0,
      role: 'assistant',
      sent: false,
      text: `Hi ${firstName}. Tell me about the problem you'd like to solve, or the idea you have. I'll fill in the form as we go and ask about anything missing.`,
    },
  ])
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [remaining, setRemaining] = useState(ASSIST_USER_TURNS)
  const [closed, setClosed] = useState(false)
  // Solution chips are a multi-select; the rest apply once. Keyed by message id and chip index.
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set())
  const step = useRef<string | undefined>(undefined)
  // The turn in flight: cancelling bumps it, so a late answer finds it stale and is ignored.
  const turn = useRef(0)
  const inFlight = useRef<{ userId: number; text: string } | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const pane = useRef<HTMLElement>(null)
  const cancelRef = useRef<() => void>(() => {})

  const add = useCallback((message: Omit<Message, 'id'>) => {
    const id = nextId.current++
    setMessages((current) => [...current, { ...message, id }])
    return id
  }, [])

  // The cancelled message goes back to the composer, so it can be edited or sent again; leaving it
  // in the transcript would put two user entries in a row, which the contract refuses.
  const cancel = useCallback(() => {
    const flying = inFlight.current
    if (!flying) return
    turn.current++
    inFlight.current = null
    setPending(false)
    setMessages((current) => current.filter((message) => message.id !== flying.userId))
    setText((current) => current || flying.text)
    setRemaining((left) => left + 1)
  }, [])
  cancelRef.current = cancel

  useEffect(() => {
    if (!active) cancelRef.current()
  }, [active])

  // Coming back to the chat puts the cursor in the composer; the first mount leaves focus on the
  // drawer's heading.
  const mounted = useRef(false)
  useEffect(() => {
    if (active && mounted.current) pane.current?.querySelector('textarea')?.focus()
    mounted.current = true
  }, [active])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the transcript or pending state changes
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [messages, pending])

  async function send(raw: string) {
    const body = raw.trim()
    if (!body || pending || closed) return

    const userId = add({ role: 'user', text: body, sent: true })
    const transcript: AssistEntry[] = [
      ...messages.filter((m) => m.sent && !m.dropped).map(({ role, text }) => ({ role, text })),
      { role: 'user', text: body },
    ]
    const mine = ++turn.current
    inFlight.current = { userId, text: body }
    setText('')
    setPending(true)
    setRemaining((left) => left - 1)

    // Read at send time: what the person has typed or accepted since the last turn is theirs.
    const current = form.current?.read()
    let answer: AssistTurnResponse
    try {
      answer = await takeAssistTurn(boardId, {
        transcript,
        draft: current?.draft ?? {},
        lockedFields: current?.lockedFields ?? [],
        ...(step.current ? { step: step.current } : {}),
      })
    } catch {
      if (turn.current !== mine) return
      inFlight.current = null
      setPending(false)
      onFailed()
      return
    }
    if (turn.current !== mine) return
    inFlight.current = null
    setPending(false)
    step.current = answer.nextStep
    setRemaining(answer.turnsRemaining)

    if (!answer.inScope) {
      setMessages((current) => current.map((m) => (m.id === userId ? { ...m, dropped: true } : m)))
      setTimeout(() => setMessages((current) => current.filter((m) => m.id !== userId)), DROP_MS)
    }
    if (answer.inScope) {
      const { filled, kept } = form.current?.apply(answer.changes) ?? { filled: [], kept: [] }
      // The assistant says so itself when it declines a locked field; this covers a field the
      // person began editing while the turn was in flight.
      const text = kept.length
        ? `${answer.nextQuestion} I kept your edit to ${kept.join(', ')}.`
        : answer.nextQuestion
      add({
        role: 'assistant',
        text,
        sent: true,
        filled,
        chips: chipsFor(answer, form.current?.read().lockedFields ?? []),
      })
    } else {
      add({ role: 'assistant', text: answer.nextQuestion, sent: false })
    }

    if (answer.conversationClosed || answer.turnsRemaining <= 0) {
      setClosed(true)
      add({
        role: 'assistant',
        sent: false,
        toForm: true,
        text: answer.conversationClosed
          ? 'The form is still here for you.'
          : "That's the most I can help with in one conversation. The rest is quicker in the form.",
      })
    }
  }

  const started = messages.some((m) => m.role === 'user')
  // Only the latest offer is live: an older one was made for a form that has since moved on.
  const liveChips = messages.findLast((m) => m.chips && m.chips.length > 0)?.id

  function choose(messageId: number, index: number, chip: Chip) {
    const handle = form.current
    if (chip.kind === 'say') {
      void send(chip.text)
      return
    }
    if (chip.kind === 'review') {
      onReview()
      return
    }
    if (!handle) return

    // Choosing a suggestion is the person's say-so, so it hands the field back to the assistant's
    // marking (`release`) even if they had typed in it.
    if (chip.kind === 'solution') {
      const key = `${messageId}:${index}`
      const on = !pressed.has(key)
      const list = handle.read().draft.proposedSolutions ?? []
      if (on && list.length >= MAX_SOLUTIONS) {
        add({
          role: 'assistant',
          sent: false,
          text: `An idea holds up to ${MAX_SOLUTIONS} solutions. Remove one in the form to add another.`,
        })
        return
      }
      setPressed((now) => {
        const next = new Set(now)
        if (on) next.add(key)
        else next.delete(key)
        return next
      })
      handle.apply(
        {
          proposedSolutions: on ? [...list, chip.text] : list.filter((item) => item !== chip.text),
        },
        { release: true },
      )
      return
    }

    const { filled } = handle.apply(
      chip.kind === 'problem' ? { problem: chip.text } : { impactRationale: chip.text },
      { release: true },
    )
    if (filled.length > 0) {
      add({
        role: 'assistant',
        sent: false,
        text: chip.kind === 'problem' ? 'Updated the problem.' : 'Updated the rationale.',
        filled,
      })
    }
  }

  return (
    <section
      ref={pane}
      aria-label="Idea assistant"
      hidden={!active}
      inert={!active}
      className={cn('flex min-h-0 flex-col bg-muted/40', className)}
    >
      <div className="flex items-center gap-2 border-b px-3.5 py-2.5 font-semibold">
        <span
          aria-hidden="true"
          className="inline-grid size-6 place-items-center rounded-full border border-suggest-line bg-suggest-tint text-[13px] text-suggest"
        >
          ✦
        </span>
        Idea assistant
        <span className="flex-1" />
        <Button variant="link" size="sm" type="button" onClick={onManual}>
          Fill out manually
        </Button>
      </div>

      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3.5"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-snug [overflow-wrap:anywhere]',
              message.role === 'assistant'
                ? 'self-start rounded-tl-sm border bg-card'
                : 'self-end rounded-tr-sm bg-primary text-primary-foreground',
              message.dropped && 'line-through opacity-45 transition-opacity duration-500',
            )}
          >
            {message.text}
            {message.filled && message.filled.length > 0 ? (
              <span className="mt-1.5 block text-xs font-semibold text-suggest">
                Filled in: {message.filled.join(', ')}
              </span>
            ) : null}
            {message.chips && message.chips.length > 0 ? (
              <ul className="m-0 mt-2 flex list-none flex-col items-start gap-1.5 p-0">
                {message.chips.map((chip, index) => (
                  <li key={`${chip.kind}-${chip.text}`}>
                    <ChipButton
                      aria-pressed={
                        chip.kind === 'solution' ? pressed.has(`${message.id}:${index}`) : undefined
                      }
                      disabled={pending || closed || liveChips !== message.id}
                      onClick={() => choose(message.id, index, chip)}
                    >
                      {chip.text}
                    </ChipButton>
                  </li>
                ))}
              </ul>
            ) : null}
            {message.id === 0 && !started ? (
              <ul className="m-0 mt-2 flex list-none flex-col items-start gap-1.5 p-0">
                {STARTERS.map((starter) => (
                  <li key={starter}>
                    <ChipButton onClick={() => send(starter)} disabled={pending}>
                      {starter}
                    </ChipButton>
                  </li>
                ))}
              </ul>
            ) : null}
            {message.toForm ? (
              <div className="mt-2">
                <ChipButton onClick={onManual}>Fill out the form</ChipButton>
              </div>
            ) : null}
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-1.5 self-start rounded-2xl rounded-tl-sm border bg-card px-3 py-2 text-sm">
            <span role="status" aria-label="Thinking" className="flex gap-1">
              {[0, 1, 2].map((dot) => (
                <i
                  key={dot}
                  className="size-1.5 animate-pulse rounded-full bg-suggest motion-reduce:animate-none"
                  style={{ animationDelay: `${dot * 160}ms` }}
                />
              ))}
            </span>
            <Button variant="link" size="sm" type="button" onClick={cancel}>
              Stop
            </Button>
          </div>
        ) : null}
      </div>

      <div className="border-t p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void send(text)
          }}
        >
          <label htmlFor="assist-message" className="sr-only">
            Message the assistant
          </label>
          <Textarea
            id="assist-message"
            rows={2}
            maxLength={ASSIST_TEXT_MAX_LENGTH}
            value={text}
            disabled={closed}
            placeholder="Describe the problem or idea. Rough notes are fine."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send(text)
              }
            }}
            className="min-h-0 flex-1 resize-none"
          />
          <Button
            type="submit"
            aria-label="Send"
            disabled={closed || pending || !text.trim()}
            className="bg-suggest text-suggest-tint hover:bg-suggest/90"
          >
            <Icon name="send" />
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span aria-live="polite" className="whitespace-nowrap">
            {closed
              ? 'No replies left'
              : `${remaining} ${remaining === 1 ? 'reply' : 'replies'} left`}
          </span>
          <Button
            variant="link"
            size="sm"
            type="button"
            onClick={onManual}
            className="ml-auto h-auto whitespace-normal p-0 text-left"
          >
            Skip the assistant and fill out the form
          </Button>
        </div>
      </div>
    </section>
  )
}

/**
 * What a reply offers (spec "Conversation" rule 4): suggestions as chips on the relevant question,
 * *Sharpen the problem first* beside the solution ideas, and on completion *Review and create*.
 */
function chipsFor(answer: AssistTurnResponse, locked: string[]): Chip[] {
  const { suggestions, nextStep } = answer
  const chips: Chip[] = [
    ...(suggestions?.solutions ?? []).map((text): Chip => ({ kind: 'solution', text })),
    ...(suggestions?.problemRewrite
      ? [{ kind: 'problem', text: suggestions.problemRewrite } satisfies Chip]
      : []),
    ...(suggestions?.rationales ?? []).map((text): Chip => ({ kind: 'rationale', text })),
  ]
  if (
    nextStep === 'proposedSolutions' &&
    !locked.includes('problem') &&
    !suggestions?.problemRewrite
  ) {
    chips.push({ kind: 'say', text: SHARPEN })
  }
  if (nextStep === 'done') {
    chips.push({ kind: 'review', text: 'Review and create' })
    if (!locked.includes('impactRationale') && !suggestions?.rationales) {
      chips.push({ kind: 'say', text: MEASURABLE })
    }
  }
  return chips
}

/** The assistant's chip: the suggestion hue, so it never reads as one of the page's own actions. */
function ChipButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-suggest-line bg-suggest-tint px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-suggest/15 disabled:opacity-60 aria-pressed:border-suggest aria-pressed:bg-suggest/20 aria-pressed:before:mr-1 aria-pressed:before:text-suggest aria-pressed:before:content-['✓']"
    >
      {children}
    </button>
  )
}
