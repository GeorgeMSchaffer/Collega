'use client'

import { Button } from '@collega/design-system'
import { type KeyboardEvent, useEffect, useId, useRef, useState, useTransition } from 'react'
import { Icon } from '@/components/list/icons'
import type { VisibleLoginMessage } from '@/lib/data/login-messages'
import { markSignInMessagesShown, respondToLoginMessage } from '@/lib/server/login-message-actions'
import { BannerView, MessageText, MODES, ModalCard } from './message-views'

type Response = 'close' | 'acknowledge'

/**
 * The messages shown after sign-in (LMS-3, LMS-4): banners stacked above the page content, below
 * the View As banner, and modals one at a time in the API's order. A response hides the message
 * here at once; the API records it.
 *
 * They show on the first desk page after signing in only. The set is kept from the first render, so
 * the later, empty ones (the layout re-renders as the reader works) do not take it away; and once
 * `due` has been seen the marker is cleared, so the next page load shows nothing.
 */
export function LoginMessages({
  messages: initial,
  due = false,
  organizationName,
}: {
  messages: VisibleLoginMessage[]
  /** This render is the first desk page since signing in. */
  due?: boolean
  organizationName: string | null
}) {
  const [messages, setMessages] = useState(initial)
  useEffect(() => {
    if (!due) return
    // A new sign-in mounts the desk afresh, but take the newer set if the layout survived one.
    setMessages(initial)
    void markSignInMessagesShown()
  }, [due, initial])
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set())
  const [, startResponse] = useTransition()

  const respond = (message: VisibleLoginMessage, response: Response) => {
    setAnswered((current) => new Set(current).add(message.id))
    startResponse(() => respondToLoginMessage(message.id, response))
  }

  const showing = messages.filter((message) => !answered.has(message.id))
  const banners = showing.filter((message) => message.display === 'Banner')
  const modals = showing.filter((message) => message.display === 'Modal')
  const modalTotal = messages.filter((message) => message.display === 'Modal').length
  const sourceName = (message: VisibleLoginMessage) =>
    message.scope === 'System' ? 'System' : (organizationName ?? 'Your organization')

  return (
    <>
      {banners.length > 0 ? (
        <section aria-label="Sign-in messages" className="flex flex-col gap-2 px-6 pt-4">
          {banners.map((message) => (
            <section
              key={message.id}
              aria-label={`${message.scope === 'System' ? 'System' : 'Organization'} message: ${message.title}`}
            >
              <BannerView
                scope={message.scope}
                sourceName={sourceName(message)}
                title={message.title}
                body={<MessageText text={message.body} />}
                actions={
                  message.dismissalMode === 'AcknowledgeRequired' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => respond(message, 'close')}>
                        Close
                      </Button>
                      <Button size="sm" onClick={() => respond(message, 'acknowledge')}>
                        Acknowledge
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => respond(message, 'close')}>
                      {MODES[message.dismissalMode].close}
                    </Button>
                  )
                }
              />
            </section>
          ))}
        </section>
      ) : null}
      {modals[0] ? (
        <MessageModal
          // A fresh dialog per message, so focus lands on the new one's primary control.
          key={modals[0].id}
          message={modals[0]}
          sourceName={sourceName(modals[0])}
          position={modalTotal - modals.length + 1}
          total={modalTotal}
          onRespond={(response) => respond(modals[0] as VisibleLoginMessage, response)}
        />
      ) : null}
    </>
  )
}

function MessageModal({
  message,
  sourceName,
  position,
  total,
  onRespond,
}: {
  message: VisibleLoginMessage
  sourceName: string
  position: number
  total: number
  onRespond: (response: Response) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const acknowledge = message.dismissalMode === 'AcknowledgeRequired'

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    // These open on page load, not from a control, so there is no opener to hand focus back to.
    element.showModal()
    element.querySelector<HTMLElement>('[data-primary]')?.focus()
    return () => element.close()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      // Escape is Close (LMS-4c); the native close is stopped so the response decides.
      event.preventDefault()
      onRespond('close')
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={onKeyDown}
      onCancel={(event) => event.preventDefault()}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(520px,calc(100vw-2rem))] rounded-lg border bg-card p-0 text-card-foreground shadow-[0_24px_60px_rgb(var(--shadow-rgb)/.35)] backdrop:bg-[rgb(var(--shadow-rgb)/.4)]"
    >
      <ModalCard
        scope={message.scope}
        sourceName={sourceName}
        title={message.title}
        titleId={titleId}
        bodyId={bodyId}
        body={<MessageText text={message.body} />}
        closeButton={
          <button
            type="button"
            aria-label="Close message"
            title="Close"
            onClick={() => onRespond('close')}
            className="inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icon name="x" />
          </button>
        }
        footer={
          <>
            <span className="mr-auto font-mono text-[11px] font-medium text-muted-foreground">
              {position} of {total}
            </span>
            {acknowledge ? (
              <>
                <Button variant="outline" onClick={() => onRespond('close')}>
                  Close
                </Button>
                <Button data-primary onClick={() => onRespond('acknowledge')}>
                  Acknowledge
                </Button>
                <p className="m-0 basis-full text-xs text-muted-foreground">
                  Close brings this message back the next time you sign in.
                </p>
              </>
            ) : (
              <Button data-primary onClick={() => onRespond('close')}>
                {MODES[message.dismissalMode].close}
              </Button>
            )}
          </>
        }
      />
    </dialog>
  )
}
