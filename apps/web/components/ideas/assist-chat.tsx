'use client'

import { Button, cn, Textarea } from '@collega/design-system'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/list/icons'
import {
  ASSIST_TEXT_MAX_LENGTH,
  ASSIST_USER_TURNS,
  type AssistEntry,
  type AssistTurnResponse,
} from '@/lib/assist-turn'
import { takeAssistTurn } from '@/lib/server/assist-actions'
import { useCurrentUser } from '@/lib/session-client'

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
}

/** Starter prompts when the organization has no recent idea titles to draw on. */
const STARTERS = [
  'Techs lose hours every week chasing parts because the stock list is out of date',
  'Weekly reporting is copied by hand into a spreadsheet every Friday',
  'Near-misses on the shop floor are not being logged',
]

const DROP_MS = 1400

/**
 * The idea assistant's chat (comp R, left of the create form): a greeting with starter prompts, the
 * transcript, a composer, and a cancellable pending turn. It owns the conversation and nothing
 * else — it never touches the form (slice 309), and `active` going false (the person chose the
 * form) only cancels a turn in flight, so the conversation is intact when it comes back.
 *
 * A turn that throws is a failed turn (`onFailed`): the drawer hands off to the form. A turn judged
 * out of scope is struck through and dropped from the transcript, so it never counts toward the cap.
 */
export function AssistChat({
  boardId,
  active,
  onManual,
  onFailed,
  className,
}: {
  boardId: string | null
  /** False while the form alone is showing: the chat is hidden but still mounted. */
  active: boolean
  onManual: () => void
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

    let answer: AssistTurnResponse
    try {
      answer = await takeAssistTurn(boardId, {
        transcript,
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
    add({ role: 'assistant', text: answer.nextQuestion, sent: answer.inScope })

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

/** The assistant's chip: the suggestion hue, so it never reads as one of the page's own actions. */
function ChipButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-suggest-line bg-suggest-tint px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-suggest/15 disabled:opacity-60"
    >
      {children}
    </button>
  )
}
