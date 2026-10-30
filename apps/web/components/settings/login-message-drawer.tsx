'use client'

import { Alert, Button, cn, Field, Input, Textarea } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useActionState, useState } from 'react'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import {
  BannerView,
  type DismissalMode,
  type Display,
  MessageText,
  MODES,
  ModalCard,
} from '@/components/login-messages/message-views'
import type { LoginMessage, LoginMessageAcknowledgements } from '@/lib/data/login-messages'
import { type LoginMessageFormState, saveLoginMessage } from '@/lib/server/login-message-actions'

const FORM_ID = 'login-message-form'

const TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** An instant in the reader's local time, as the list writes it: `27 Oct, 09:00`. */
export function formatMessageTime(iso: string): string {
  return TIME.format(new Date(iso))
}

/** An instant as a `datetime-local` value, in the reader's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A `datetime-local` value, read as the reader's local time, as UTC; empty stays empty. */
function toUtc(local: string): string {
  if (!local) return ''
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/**
 * The message drawer (LMS-7c, d): title, body, display, mode, window, *Show again to everyone* on
 * edit, a live preview of the modal or banner, and for an `AcknowledgeRequired` message that has
 * started, its acknowledgement report.
 */
export function LoginMessageDrawer({
  open,
  system,
  organizationName,
  report,
  returnFocusTo,
  onClose,
  onSaved,
  onDelete,
}: {
  /** `message` null is a new message. */
  open: { message: LoginMessage | null } | null
  system: boolean
  organizationName: string | null
  report: LoginMessageAcknowledgements | null
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onSaved: (messageId: string) => void
  onDelete: (message: LoginMessage) => void
}) {
  const message = open?.message ?? null
  const formKey = open === null ? null : (message?.id ?? 'new')

  const [outcome, submit, saving] = useActionState(
    async (_previous: Outcome, data: FormData): Promise<Outcome> => {
      const result = await saveLoginMessage(message?.id ?? null, data)
      if (result.savedId) onSaved(result.savedId)
      return { ...result, formKey }
    },
    { ...IDLE, formKey: null },
  )

  const kind = system ? 'System message' : 'Organization message'

  return (
    <Drawer
      open={open !== null}
      onClose={onClose}
      eyebrow={message ? `${kind} · Revision ${message.revision}` : kind}
      title={message ? 'Edit message' : 'New message'}
      returnFocusTo={returnFocusTo}
      focusKey={formKey ?? 'closed'}
      footer={
        open === null ? null : (
          <>
            {message ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(message)}
              >
                <Icon name="trash" />
                Delete
              </Button>
            ) : null}
            <span className="flex-1" />
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={saving}>
              {saving ? 'Saving…' : message ? 'Save changes' : 'Create message'}
            </Button>
          </>
        )
      }
    >
      {open === null ? null : (
        <>
          <MessageForm
            // A fresh form per message, so one message's typing never seeds another's.
            key={formKey}
            message={message}
            system={system}
            organizationName={organizationName}
            action={submit}
            outcome={outcome.formKey === formKey ? outcome : IDLE}
          />
          {message && report ? <Acknowledgements report={report} system={system} /> : null}
        </>
      )}
    </Drawer>
  )
}

const IDLE: LoginMessageFormState = { error: null, errors: {}, savedId: null }

/** The last save's answer, and which form it belongs to, so it never shows on another message's. */
type Outcome = LoginMessageFormState & { formKey: string | null }

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  label: string
  hint: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md border bg-card px-3 py-2.5 text-sm hover:bg-muted',
        checked && 'border-ring bg-accent text-accent-foreground hover:bg-accent',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 flex-none accent-[var(--color-primary)]"
      />
      <span>
        <b className="block font-semibold">{label}</b>
        <small className="block text-xs text-muted-foreground">{hint}</small>
      </span>
    </label>
  )
}

/** Title, body, display and mode are held here for the live preview; the save is the drawer's. */
function MessageForm({
  message,
  system,
  organizationName,
  action,
  outcome,
}: {
  message: LoginMessage | null
  system: boolean
  organizationName: string | null
  action: (data: FormData) => void
  outcome: LoginMessageFormState
}) {
  const [title, setTitle] = useState(message?.title ?? '')
  const [body, setBody] = useState(message?.body ?? '')
  const [display, setDisplay] = useState<Display>(message?.display ?? 'Modal')
  const [mode, setMode] = useState<DismissalMode>(message?.dismissalMode ?? 'EveryLogin')
  const [starts, setStarts] = useState(() =>
    toLocalInput(message?.startsAtUtc ?? new Date().toISOString()),
  )
  const [ends, setEnds] = useState(() => toLocalInput(message?.endsAtUtc ?? null))
  const errors = outcome.errors

  return (
    <form id={FORM_ID} action={action} className="flex flex-col gap-4">
      {outcome.error ? (
        <Alert variant="destructive">
          <span>{outcome.error}</span>
        </Alert>
      ) : null}
      <Field
        htmlFor="lm-title"
        label="Title"
        required
        hint="1–120 characters."
        error={errors.title}
        className="mb-0"
      >
        <Input
          id="lm-title"
          name="title"
          required
          maxLength={120}
          autoComplete="off"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          invalid={errors.title !== undefined}
        />
      </Field>
      <Field
        htmlFor="lm-body"
        label="Message"
        required
        hint="Plain text. Web addresses become links. Up to 4,000 characters."
        error={errors.body}
        className="mb-0"
      >
        <Textarea
          id="lm-body"
          name="body"
          required
          rows={4}
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          invalid={errors.body !== undefined}
        />
      </Field>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-sm font-medium">Display</legend>
        <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
          {(['Modal', 'Banner'] as const).map((option) => (
            <RadioOption
              key={option}
              name="display"
              value={option}
              checked={display === option}
              onChange={() => setDisplay(option)}
              label={option}
              hint={
                option === 'Modal' ? 'A dialog over the page.' : 'A strip above the page content.'
              }
            />
          ))}
        </div>
        {errors.display ? (
          <span className="mt-1 block text-xs font-semibold text-destructive">
            {errors.display}
          </span>
        ) : null}
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-sm font-medium">Mode</legend>
        <div className="flex flex-col gap-2">
          {(Object.keys(MODES) as DismissalMode[]).map((option) => (
            <RadioOption
              key={option}
              name="dismissalMode"
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              label={MODES[option].name}
              hint={MODES[option].hint}
            />
          ))}
        </div>
        {errors.dismissalMode ? (
          <span className="mt-1 block text-xs font-semibold text-destructive">
            {errors.dismissalMode}
          </span>
        ) : null}
      </fieldset>
      <div>
        <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
          <Field
            htmlFor="lm-starts"
            label="Starts"
            required
            error={errors.startsAtUtc}
            className="mb-0"
          >
            <Input
              id="lm-starts"
              type="datetime-local"
              required
              value={starts}
              onChange={(event) => setStarts(event.target.value)}
              invalid={errors.startsAtUtc !== undefined}
              suppressHydrationWarning
            />
          </Field>
          <Field
            htmlFor="lm-ends"
            label="Ends (optional)"
            error={errors.endsAtUtc}
            className="mb-0"
          >
            <Input
              id="lm-ends"
              type="datetime-local"
              value={ends}
              onChange={(event) => setEnds(event.target.value)}
              invalid={errors.endsAtUtc !== undefined}
              suppressHydrationWarning
            />
          </Field>
        </div>
        <small className="mt-1.5 block text-xs text-muted-foreground">
          Your local time. Stored as UTC. A message with no end stays live until you end it.
        </small>
        {/* The browser knows the reader's time zone; the server does not. */}
        <input type="hidden" name="startsAtUtc" value={toUtc(starts)} />
        <input type="hidden" name="endsAtUtc" value={toUtc(ends)} />
      </div>
      {message ? (
        <label className="flex items-start gap-2.5 text-sm" htmlFor="lm-show-again">
          <input id="lm-show-again" name="showAgain" type="checkbox" className="mt-0.5 size-4" />
          <span>
            <b className="block font-medium">Show again to everyone</b>
            <small className="block text-xs text-muted-foreground">
              Raises the revision: everyone sees it again, and the acknowledgement count restarts
              from zero.
            </small>
          </span>
        </label>
      ) : null}
      <Preview
        system={system}
        organizationName={organizationName}
        title={title}
        body={body}
        display={display}
        mode={mode}
      />
    </form>
  )
}

function Preview({
  system,
  organizationName,
  title,
  body,
  display,
  mode,
}: {
  system: boolean
  organizationName: string | null
  title: string
  body: string
  display: Display
  mode: DismissalMode
}) {
  const scope = system ? 'System' : 'Organization'
  const sourceName = system ? 'System' : (organizationName ?? 'Your organization')
  const shownTitle = title.trim() || <span className="text-muted-foreground italic">Title</span>
  const shownBody = body.trim() ? (
    <MessageText text={body.trim()} />
  ) : (
    <span className="text-muted-foreground italic">Message text</span>
  )
  const acknowledge = mode === 'AcknowledgeRequired'
  // Inert copies of the controls: the preview is a picture, not something to press.
  const fake = (label: string, primary: boolean, small: boolean) => (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center rounded-md border font-medium',
        small ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        primary ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
      )}
    >
      {label}
    </span>
  )

  return (
    <div className="rounded-md border border-dashed bg-background p-3" aria-live="polite">
      <div className="mb-2 font-mono text-[10.5px] font-medium tracking-wider text-muted-foreground uppercase">
        Preview · {display}
      </div>
      {display === 'Banner' ? (
        <BannerView
          scope={scope}
          sourceName={sourceName}
          title={shownTitle}
          body={shownBody}
          actions={
            acknowledge ? (
              <>
                {fake('Close', false, true)}
                {fake('Acknowledge', true, true)}
              </>
            ) : (
              fake(MODES[mode].close, false, true)
            )
          }
        />
      ) : (
        <div className="rounded-lg border bg-card shadow-[0_10px_24px_rgb(var(--shadow-rgb)/.18)]">
          <ModalCard
            preview
            scope={scope}
            sourceName={sourceName}
            title={shownTitle}
            body={shownBody}
            closeButton={
              <span
                aria-hidden="true"
                className="inline-grid size-7 place-items-center text-muted-foreground"
              >
                <Icon name="x" />
              </span>
            }
            footer={
              <>
                <span className="mr-auto font-mono text-[11px] font-medium text-muted-foreground">
                  1 of 1
                </span>
                {acknowledge ? (
                  <>
                    {fake('Close', false, false)}
                    {fake('Acknowledge', true, false)}
                  </>
                ) : (
                  fake(MODES[mode].close, true, false)
                )}
              </>
            }
          />
        </div>
      )}
    </div>
  )
}

/** LMS-6: *N of M acknowledged*, and who, acknowledged first, a page at a time. */
function Acknowledgements({
  report,
  system,
}: {
  report: LoginMessageAcknowledgements
  system: boolean
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const { acknowledgedCount: done, audienceCount: total } = report
  const percent = total === 0 ? 0 : Math.round((100 * done) / total)
  const pages = Math.max(1, Math.ceil(report.totalCount / report.pageSize))
  const pageHref = (n: number) => {
    const next = new URLSearchParams(params)
    next.set('ack', String(n))
    return `${pathname}?${next.toString()}`
  }
  const count = (n: number) => n.toLocaleString('en-US')

  return (
    <section aria-labelledby="lm-ack-heading" className="mt-6 flex flex-col gap-3 border-t pt-4">
      <h3 id="lm-ack-heading" className="m-0 text-sm font-semibold">
        Acknowledgements
      </h3>
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <b>
            {count(done)} of {count(total)} acknowledged
          </b>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <div
          role="img"
          aria-label={`${count(done)} of ${count(total)} active users have acknowledged this revision`}
          className="my-2 h-2 overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full bg-success" style={{ width: `${percent}%` }} />
        </div>
        <small className="text-xs text-muted-foreground">
          Active users in scope now, current revision.
          {system ? ' Across all organizations.' : ' Members of this organization only.'}
        </small>
      </div>
      {report.items.length > 0 ? (
        <ul aria-label="Acknowledgement report" className="m-0 flex list-none flex-col p-0">
          {report.items.map((person) => (
            <li
              key={person.userId}
              className="flex items-center gap-3 border-b py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <b className="block truncate font-medium">{person.name}</b>
                <small className="block truncate text-xs text-muted-foreground">
                  {person.email}
                  {system && person.organizationName ? ` · ${person.organizationName}` : ''}
                </small>
              </span>
              <span
                className={cn(
                  'flex flex-none items-center gap-1 text-xs whitespace-nowrap',
                  person.acknowledgedAtUtc ? 'text-success' : 'text-muted-foreground',
                )}
                suppressHydrationWarning
              >
                {person.acknowledgedAtUtc ? (
                  <>
                    <Icon name="check" />
                    {formatMessageTime(person.acknowledgedAtUtc)}
                  </>
                ) : (
                  'Not yet'
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {report.page} of {pages} · acknowledged first
        </span>
        <span className="flex gap-3">
          {report.page > 1 ? (
            <Link href={pageHref(report.page - 1) as Route} scroll={false}>
              Previous page
            </Link>
          ) : null}
          {report.page < pages ? (
            <Link href={pageHref(report.page + 1) as Route} scroll={false}>
              Next page
            </Link>
          ) : null}
        </span>
      </div>
    </section>
  )
}
