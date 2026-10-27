'use client'

import { Alert, Button, cn, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import {
  ActionButton,
  type Column,
  ConfirmDialog,
  DataTable,
  filterRows,
  type ListConfig,
  ListToolbar,
  MultiSelectFilter,
  Pager,
  pageRows,
  RowActions,
  type Sort,
  sortRows,
  useListState,
} from '@/components/list'
import { Icon } from '@/components/list/icons'
import { MODES } from '@/components/login-messages/message-views'
import type { LoginMessage, LoginMessageAcknowledgements } from '@/lib/data/login-messages'
import { deleteLoginMessage, endLoginMessageNow } from '@/lib/server/login-message-actions'
import { formatMessageTime, LoginMessageDrawer } from './login-message-drawer'

const CONFIG: ListConfig = {
  filters: ['state'],
  views: ['list'],
  sortKeys: ['title', 'display', 'mode', 'window', 'state'],
}

const DEFAULT_SORT: Sort = { key: 'window', dir: 'desc' }

const STATES = ['Live', 'Scheduled', 'Ended']

function sortValue(message: LoginMessage, key: string): string | number {
  if (key === 'display') return message.display
  if (key === 'mode') return MODES[message.dismissalMode].name
  if (key === 'state') return STATES.indexOf(message.state)
  if (key === 'window') return message.startsAtUtc
  return message.title
}

/** The drawer lives in the URL beside the list: `?message={id}` or `?message=new`. */
function useMessageDrawerUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (message: string | null) => {
    const next = new URLSearchParams(params)
    next.delete('message')
    next.delete('ack')
    if (message) next.set('message', message)
    const query = next.toString()
    router.push(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
  }
}

export function NewLoginMessageButton() {
  const navigate = useMessageDrawerUrl()
  return (
    <Button onClick={() => navigate('new')}>
      <Icon name="plus" />
      New message
    </Button>
  )
}

const STATE_STYLE: Record<LoginMessage['state'], string> = {
  Live: 'bg-success/12 text-success',
  Scheduled: 'bg-primary/10 text-primary',
  Ended: 'bg-muted text-muted-foreground',
}

function StateChip({ state }: { state: LoginMessage['state'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        STATE_STYLE[state],
      )}
    >
      {state === 'Live' ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      ) : null}
      {state}
    </span>
  )
}

const count = (n: number) => n.toLocaleString('en-US')

function AcknowledgedCell({ message }: { message: LoginMessage }) {
  if (message.dismissalMode !== 'AcknowledgeRequired') {
    return <span className="text-muted-foreground">—</span>
  }
  if (message.state === 'Scheduled') {
    return <span className="text-muted-foreground">Not shown yet</span>
  }
  const done = message.acknowledgedCount ?? 0
  const total = message.audienceCount ?? 0
  return (
    <span className="whitespace-nowrap tabular-nums">
      {count(done)} of {count(total)} acknowledged
      <span aria-hidden="true" className="mt-1 block h-1 w-20 overflow-hidden rounded-sm bg-muted">
        <span
          className="block h-full bg-success"
          style={{ width: `${total === 0 ? 0 : Math.round((100 * done) / total)}%` }}
        />
      </span>
    </span>
  )
}

/**
 * Settings → Sign-in messages on comp R's list and detail pattern (LMS-7): the text filter over the
 * title and the State filter, sorting and paging in the client, row actions (Edit, End now for a
 * live message, Delete), and the message drawer. Delete asks first.
 */
export function LoginMessagesScreen({
  messages,
  system,
  organizationName,
  report,
}: {
  messages: LoginMessage[]
  system: boolean
  organizationName: string | null
  /** The open message's acknowledgement report, when it has one. */
  report: LoginMessageAcknowledgements | null
}) {
  const params = useSearchParams()
  const navigate = useMessageDrawerUrl()
  const [state, update] = useListState(CONFIG)
  const [confirming, setConfirming] = useState<LoginMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startAction] = useTransition()
  const trigger = useRef<HTMLElement | null>(null)

  const requested = params.get('message')
  const open: { message: LoginMessage | null } | null =
    requested === 'new'
      ? { message: null }
      : (() => {
          const message = messages.find((candidate) => candidate.id === requested)
          return message ? { message } : null
        })()

  const go = (message: string | null, from?: HTMLElement) => {
    if (from) trigger.current = from
    navigate(message)
  }

  function ask(message: LoginMessage | null) {
    setError(null)
    setConfirming(message)
  }

  function endNow(message: LoginMessage) {
    setError(null)
    startAction(async () => {
      setError((await endLoginMessageNow(message.id)).error)
    })
  }

  function confirmDelete() {
    const message = confirming
    if (!message) return
    startAction(async () => {
      const result = await deleteLoginMessage(message.id)
      setError(result.error)
      if (!result.error && open?.message?.id === message.id) navigate(null)
      setConfirming(null)
    })
  }

  const columns: Column<LoginMessage>[] = [
    {
      key: 'title',
      header: 'Title',
      className: 'max-w-0 min-w-48 w-[32%]',
      cell: (message) => (
        <>
          <button
            type="button"
            onClick={(event) => go(message.id, event.currentTarget)}
            className="block max-w-full truncate text-left font-medium hover:underline"
          >
            {message.title}
          </button>
          <span className="block truncate text-xs text-muted-foreground">
            {message.body.split('\n')[0]}
          </span>
        </>
      ),
    },
    { key: 'display', header: 'Display', cell: (message) => message.display },
    { key: 'mode', header: 'Mode', cell: (message) => MODES[message.dismissalMode].name },
    {
      key: 'window',
      header: 'Window',
      className: 'text-xs text-secondary-foreground',
      cell: (message) => (
        <span suppressHydrationWarning>
          {message.endsAtUtc
            ? `${formatMessageTime(message.startsAtUtc)} – ${formatMessageTime(message.endsAtUtc)}`
            : `From ${formatMessageTime(message.startsAtUtc)}, no end`}
        </span>
      ),
    },
    { key: 'state', header: 'State', cell: (message) => <StateChip state={message.state} /> },
    {
      key: 'acknowledged',
      header: 'Acknowledged',
      sortable: false,
      cell: (message) => <AcknowledgedCell message={message} />,
    },
  ]

  const filtered = filterRows(
    messages,
    state,
    (message) => message.title,
    (message) => message.state,
  )
  const sorted = sortRows(filtered, state.sort ?? DEFAULT_SORT, sortValue)
  const page = pageRows(sorted, state.page, state.size)

  const actions = (message: LoginMessage) => (
    <span className="inline-flex items-center gap-0.5">
      {message.state === 'Live' ? (
        <ActionButton
          icon="stop"
          label="End now"
          item={message.title}
          run={() => endNow(message)}
        />
      ) : null}
      <RowActions
        itemLabel={message.title}
        onEdit={(from) => go(message.id, from)}
        onRemove={() => ask(message)}
      />
    </span>
  )

  return (
    <>
      {error ? (
        <Alert variant="destructive" role="alert">
          <span>{error}</span>
        </Alert>
      ) : null}

      {messages.length === 0 ? (
        <EmptyState heading="No sign-in messages yet">
          {system
            ? 'A system message is shown to every user in every organization after they sign in. Add one with New message.'
            : 'A message here is shown to everyone in your organization after they sign in. Add one with New message.'}
        </EmptyState>
      ) : (
        <>
          <ListToolbar
            query={state.q}
            onQueryChange={(q) => update({ q })}
            placeholder="Search messages"
          >
            <MultiSelectFilter
              label="State"
              options={STATES}
              selected={state.filters.state ?? []}
              onChange={(selected) => update({ filters: { ...state.filters, state: selected } })}
            />
          </ListToolbar>

          <DataTable
            caption={system ? 'System sign-in messages' : 'Organization sign-in messages'}
            columns={columns}
            rows={page.rows}
            rowKey={(message) => message.id}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            actions={actions}
            selectedKey={open?.message?.id ?? null}
          />

          <Pager
            page={page.page}
            size={state.size}
            total={sorted.length}
            onPageChange={(n) => update({ page: n })}
            onSizeChange={(size) => update({ size })}
          />
        </>
      )}

      <LoginMessageDrawer
        open={open}
        system={system}
        organizationName={organizationName}
        report={report}
        returnFocusTo={trigger.current}
        onClose={() => go(null)}
        onSaved={(id) => go(id)}
        onDelete={ask}
      />

      <ConfirmDialog
        open={confirming !== null}
        title="Delete this message?"
        description={`“${confirming?.title ?? ''}” will stop showing and its acknowledgements are deleted with it. To stop it but keep the acknowledgements, use End now instead.`}
        confirmLabel="Delete message"
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => ask(null)}
      />
    </>
  )
}
