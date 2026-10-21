'use client'

import { cn, Dot, Field, Input, Select, Tag } from '@collega/design-system'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Icon } from '@/components/list/icons'
import { PULL_ITEM_CAP } from '@/lib/limits'
import type {
  MemberOption,
  PullCandidate,
  PullCandidatePage,
  PullSource,
  Status,
  TagRef,
} from '@/lib/types'

/** What the page knows about the reader and the organization that the step cannot ask for itself. */
export type PullSetup = {
  /** An Org Admin pulls anything eligible; a User only the ideas they created. */
  isAdmin: boolean
  tags: TagRef[]
  /** The author filter's options; an Org Admin's only. */
  members: MemberOption[]
  /** Boards whose ideas are read-only, so a row can say its board is archived. */
  archivedBoardIds: string[]
  /** An archived board takes no pull: the step shows, disabled, with its reason. */
  archived: boolean
}

const ARCHIVED_REASON =
  'Archived boards take no pull. Unarchive this board first, from the Boards list.'

const TABS: { source: PullSource; label: string }[] = [
  { source: 'unassigned', label: 'Unassigned ideas' },
  { source: 'boards', label: 'Ideas on other boards' },
  { source: 'backlog', label: 'Backlog Issues' },
]

const PAGE_SIZE = 20

type Panel = {
  items: PullCandidate[]
  total: number | null
  page: number
  loading: boolean
  error: string | null
}

const FRESH: Panel = { items: [], total: null, page: 0, loading: false, error: null }

/** The label for a refusal that names this item, by its title or id, as the API writes them. */
function refusalFor(item: PullCandidate, refused: readonly string[]): string | undefined {
  return refused.find((message) => message.includes(`'${item.title}'`) || message.includes(item.id))
}

/**
 * Where an item lands (`20-feature-board-pull-in.md` rule 13), from the lanes the form currently
 * chooses: it keeps its status when one of them is that status, else it takes the leftmost lane.
 * The API decides on save; this only tells the reader what to expect.
 */
function landing(item: PullCandidate, lanes: Status[]) {
  const keeps = lanes.some((lane) => lane.id === item.statusId)
  const first = lanes[0]
  if (keeps || !first) {
    return (
      <>
        Lands in: <b className="font-semibold text-foreground">{item.statusName}</b> &middot; keeps
        its status
      </>
    )
  }
  return (
    <span className="text-warning">
      Lands in: <b className="font-semibold">{first.name}</b> &middot; first lane (no{' '}
      {item.statusName} lane here), status becomes {first.name}
    </span>
  )
}

async function fetchCandidates(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PullCandidatePage> {
  const response = await fetch(`/boards/pull-candidates?${params}`, { cache: 'no-store', signal })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'The list could not be loaded.')
  }
  return (await response.json()) as PullCandidatePage
}

/**
 * The board form's optional *Add existing items* step (`SPEC/mockups/comp-r-board-pull-in.html`):
 * collapsed until opened, then one tab per source with its own search and filters, and a summary of
 * what is selected. It posts the selection as `pullItemIds` hidden inputs, so the form that renders
 * it sends the pull with the same submit as the rest, in one save.
 *
 * The lists are read from the pull-candidates route as the reader types (`app/(desk)/boards/
 * pull-candidates`), a page at a time. Nothing is read until the step is first opened.
 *
 * The selection is the caller's state, because the drawer's footer names the pull ("Create board
 * and add 3 items") and refuses the save over the cap.
 */
export function PullStep({
  setup,
  boardId,
  boardName,
  lanes,
  statuses,
  laneRemoval,
  selected,
  onChange,
  refused,
  sectionHeading: SectionHeading = 'h2',
}: {
  setup: PullSetup
  /** The board being edited, or null when creating. */
  boardId: string | null
  boardName: string
  /** The lanes the board will have once this form is saved, in order. */
  lanes: Status[]
  /** The organization's statuses, for the dot beside an item's status. */
  statuses: Status[]
  /** Whether this save also removes a lane that holds ideas. */
  laneRemoval: boolean
  selected: PullCandidate[]
  onChange: (next: PullCandidate[]) => void
  /** The API's per-item refusals from the last save. */
  refused: readonly string[]
  sectionHeading?: 'h2' | 'h3'
}) {
  const id = useId()
  const disabled = setup.archived
  const [open, setOpen] = useState(false)
  const [visited, setVisited] = useState(false)
  const tabs = setup.isAdmin ? TABS : TABS.filter((tab) => tab.source !== 'backlog')
  const [active, setActive] = useState<PullSource>('unassigned')
  const [totals, setTotals] = useState<Partial<Record<PullSource, number>>>({})
  const anchor = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<Partial<Record<PullSource, HTMLButtonElement | null>>>({})
  const summaryHeading = useRef<HTMLElement>(null)
  const count = selected.length
  const over = count > PULL_ITEM_CAP

  const overRef = useRef(false)
  overRef.current = over
  // The submit button stays focusable and says why; a submit by Enter in another field is stopped
  // here, as `IdeaMovesGuard` stops one that needs its confirm.
  useEffect(() => {
    const form = anchor.current?.form
    if (!form) return
    const onSubmit = (event: SubmitEvent) => {
      if (overRef.current) event.preventDefault()
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [])

  // A refusal opens the step and moves focus to its alert: the save button was disabled while
  // pending, so focus would otherwise fall to <body> with the alert possibly below the fold.
  const alertRef = useRef<HTMLDivElement>(null)
  const [alertFocus, setAlertFocus] = useState(0)
  useEffect(() => {
    if (refused.length > 0 && !disabled) {
      setOpen(true)
      setVisited(true)
      setAlertFocus((count) => count + 1)
    }
  }, [refused, disabled])
  useEffect(() => {
    if (alertFocus > 0) alertRef.current?.focus()
  }, [alertFocus])

  const toggle = (item: PullCandidate) =>
    onChange(
      selected.some((chosen) => chosen.id === item.id)
        ? selected.filter((chosen) => chosen.id !== item.id)
        : [...selected, item],
    )

  const remove = (item: PullCandidate) => {
    const next = selected.filter((chosen) => chosen.id !== item.id)
    onChange(next)
    // The removed chip is gone, so focus moves to a neighbour rather than dropping to <body>.
    requestAnimationFrame(() => {
      const buttons = document.querySelectorAll<HTMLElement>(`[data-pull-remove="${id}"]`)
      ;(buttons[0] ?? summaryHeading.current)?.focus()
    })
  }

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = tabs[(target + tabs.length) % tabs.length]
    if (!next) return
    setActive(next.source)
    tabRefs.current[next.source]?.focus()
  }

  const summary = disabled ? 'unavailable' : count > 0 ? `${count} selected` : 'none selected'

  return (
    <section aria-label="Add existing items" className="@container mt-4 rounded-lg border bg-card">
      <input ref={anchor} type="hidden" />
      {selected.map((item) => (
        <input key={item.id} type="hidden" name="pullItemIds" value={item.id} />
      ))}

      <SectionHeading className="m-0">
        <button
          type="button"
          id={`${id}-toggle`}
          aria-expanded={open && !disabled}
          aria-controls={`${id}-body`}
          aria-disabled={disabled ? 'true' : undefined}
          aria-describedby={disabled ? `${id}-why` : undefined}
          onClick={() => {
            if (disabled) return
            setOpen((current) => !current)
            setVisited(true)
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            disabled && 'cursor-not-allowed text-muted-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex transition-transform motion-reduce:transition-none',
              open && !disabled && 'rotate-90',
            )}
          >
            <Icon name="next" className="size-3.5" />
          </span>
          <span>
            Add existing items{' '}
            <span className="font-normal text-secondary-foreground">- {summary}</span>
          </span>
          {refused.length > 0 ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-destructive">
              <Icon name="alert" />
              Needs attention
            </span>
          ) : null}
        </button>
      </SectionHeading>

      {disabled ? (
        <p
          id={`${id}-why`}
          className="m-0 flex items-start gap-1.5 px-3.5 pb-2.5 text-xs text-muted-foreground"
        >
          <Icon name="lock" className="mt-0.5 size-3.5" />
          {ARCHIVED_REASON}
        </p>
      ) : null}

      <div
        id={`${id}-body`}
        hidden={!open || disabled}
        className="flex flex-col gap-3 border-t px-3.5 pt-3 pb-3.5"
      >
        {refused.length > 0 ? (
          <div
            ref={alertRef}
            tabIndex={-1}
            role="alert"
            className="flex gap-2 rounded-md border border-destructive bg-destructive/5 px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <Icon name="alert" className="mt-0.5 size-4 text-destructive" />
            <div>
              <b className="text-destructive">Nothing was saved.</b> Some items in &ldquo;Add
              existing items&rdquo; could not be pulled.{' '}
              {boardId === null ? 'The board was not created.' : 'The board is unchanged.'}
              <ul className="m-0 mt-1 pl-4.5">
                {refused.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              Remove these items or reload the list, then save again.
            </div>
          </div>
        ) : null}

        <p className="m-0 text-xs text-secondary-foreground">
          {setup.isAdmin
            ? `Move ideas that already exist onto this board${boardId === null ? ' when it is created' : ''}. Nothing changes until you save.${boardId === null ? '' : ` Ideas already on ${boardName} are not listed.`}`
            : 'You can pull ideas you created.'}
        </p>

        {laneRemoval ? (
          <Note>
            Ideas in removed lanes move first, then pulled items are placed on the lanes as they
            stand after this save.
          </Note>
        ) : null}

        <div role="tablist" aria-label="Where to pull from" className="flex gap-0.5 border-b">
          {tabs.map((tab, index) => {
            const on = active === tab.source
            const total = totals[tab.source]
            return (
              <button
                key={tab.source}
                ref={(node) => {
                  tabRefs.current[tab.source] = node
                }}
                type="button"
                role="tab"
                id={`${id}-${tab.source}-tab`}
                aria-selected={on}
                aria-controls={`${id}-${tab.source}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(tab.source)}
                onKeyDown={(event) => onTabKey(event, index)}
                className={cn(
                  '-mb-px flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5 border-b-[3px] border-transparent px-2.5 py-1.5 text-xs text-secondary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  on && 'border-primary font-bold text-foreground',
                )}
              >
                {tab.label}
                {total !== undefined ? (
                  <span
                    className={cn(
                      'rounded-full bg-muted px-1.5 font-mono text-xs font-medium text-secondary-foreground',
                      on && 'bg-accent text-accent-foreground',
                    )}
                  >
                    {total}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {tabs.map((tab) => (
          <PullPanel
            key={tab.source}
            idPrefix={`${id}-${tab.source}`}
            source={tab.source}
            label={tab.label}
            hidden={active !== tab.source}
            enabled={visited && !disabled}
            setup={setup}
            boardId={boardId}
            lanes={lanes}
            statuses={statuses}
            selected={selected}
            refused={refused}
            onToggle={toggle}
            onTotal={(total) => setTotals((current) => ({ ...current, [tab.source]: total }))}
          />
        ))}

        <div className="rounded-md border bg-muted/40 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b
              id={`${id}-selected`}
              ref={summaryHeading}
              tabIndex={-1}
              className="text-xs focus:outline-none"
            >
              Selected items
            </b>
            <span
              className={cn(
                'font-mono text-xs text-secondary-foreground',
                over && 'font-bold text-destructive',
              )}
            >
              {count} of {PULL_ITEM_CAP}
            </span>
          </div>
          {count > 0 ? (
            <ul
              aria-labelledby={`${id}-selected`}
              className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0"
            >
              {selected.map((item) => {
                const bad = refusalFor(item, refused)
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'inline-flex max-w-full items-center gap-0.5 rounded-full border bg-card py-px pr-0.5 pl-2.5 text-xs',
                      bad && 'border-destructive bg-destructive/5',
                    )}
                  >
                    <span className="max-w-[36ch] min-w-0 truncate" title={item.title}>
                      {item.title}
                    </span>
                    {bad ? <span className="ml-1 font-bold text-destructive">Refused</span> : null}
                    <button
                      type="button"
                      data-pull-remove={id}
                      aria-label={`Remove ${item.title}`}
                      onClick={() => remove(item)}
                      className="inline-grid size-6 place-items-center rounded-full text-secondary-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <Icon name="x" className="size-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="m-0 mt-1.5 text-xs text-muted-foreground">Nothing selected yet.</p>
          )}
          {over ? (
            <p
              role="status"
              className="m-0 mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-destructive"
            >
              <Icon name="alert" className="mt-0.5 size-3.5" />
              {count - PULL_ITEM_CAP} over the limit. Remove {count - PULL_ITEM_CAP} item
              {count - PULL_ITEM_CAP > 1 ? 's' : ''} to save (at most {PULL_ITEM_CAP} per save).
            </p>
          ) : null}
          {count > 0 && lanes[0] ? (
            <p className="m-0 mt-2 text-xs text-secondary-foreground">
              Pulled items keep their status where this board has that lane; otherwise they land in
              the first lane ({lanes[0].name}).
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-accent px-2.5 py-2 text-xs text-accent-foreground">
      <Icon name="info" className="mt-0.5 size-3.5" />
      <span>{children}</span>
    </div>
  )
}

/** One tab: its filters, its page of items, and the rows that toggle the selection. */
function PullPanel({
  idPrefix,
  source,
  label,
  hidden,
  enabled,
  setup,
  boardId,
  lanes,
  statuses,
  selected,
  refused,
  onToggle,
  onTotal,
}: {
  idPrefix: string
  source: PullSource
  label: string
  hidden: boolean
  enabled: boolean
  setup: PullSetup
  boardId: string | null
  lanes: Status[]
  statuses: Status[]
  selected: PullCandidate[]
  refused: readonly string[]
  onToggle: (item: PullCandidate) => void
  onTotal: (total: number) => void
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tag, setTag] = useState('')
  const [author, setAuthor] = useState('')
  const [panel, setPanel] = useState<Panel>(FRESH)
  const latest = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const totalRef = useRef(onTotal)
  totalRef.current = onTotal

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(
    async (page: number) => {
      const request = ++latest.current
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      setPanel((current) => ({ ...current, loading: true, error: null }))

      const params = new URLSearchParams({
        source,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (boardId) params.set('excludeBoardId', boardId)
      if (debounced.trim()) params.set('search', debounced.trim())
      if (tag) params.set('tag', tag)
      if (author) params.set('authorUserId', author)

      try {
        const result = await fetchCandidates(params, controller.signal)
        if (request !== latest.current) return
        setPanel((current) => ({
          items: page === 1 ? result.items : [...current.items, ...result.items],
          total: result.totalCount,
          page,
          loading: false,
          error: null,
        }))
        totalRef.current(result.totalCount)
      } catch (error) {
        if (request !== latest.current || controller.signal.aborted) return
        setPanel((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'The list could not be loaded.',
        }))
      }
    },
    [source, boardId, debounced, tag, author],
  )

  useEffect(() => {
    if (enabled) void load(1)
    return () => abort.current?.abort()
  }, [enabled, load])

  const statusColor = (statusId: string) => statuses.find((status) => status.id === statusId)?.color
  const filtering = debounced.trim() !== '' || tag !== '' || author !== ''
  const noun = source === 'backlog' ? 'Issues' : 'ideas'

  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel`}
      aria-labelledby={`${idPrefix}-tab`}
      hidden={hidden}
      className="flex flex-col gap-2.5"
    >
      <div
        className={cn(
          'grid grid-cols-1 gap-2',
          setup.isAdmin
            ? '@lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]'
            : '@lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
        )}
      >
        <Field htmlFor={`${idPrefix}-q`} label={`Search ${noun} by title`} className="mb-0">
          <Input
            id={`${idPrefix}-q`}
            type="search"
            placeholder="Search by title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            // Enter belongs to the filter, not to the board form around it.
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
          />
        </Field>
        <Field htmlFor={`${idPrefix}-tag`} label="Tag" className="mb-0">
          <Select
            id={`${idPrefix}-tag`}
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="">All tags</option>
            {setup.tags.map((option) => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </Select>
        </Field>
        {setup.isAdmin ? (
          <Field htmlFor={`${idPrefix}-author`} label="Author" className="mb-0">
            <Select
              id={`${idPrefix}-author`}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            >
              <option value="">All authors</option>
              {setup.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <div aria-live="polite" aria-busy={panel.loading || undefined}>
        {panel.error ? (
          <p
            role="alert"
            className="m-0 rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            {panel.error}{' '}
            <button type="button" className="font-semibold underline" onClick={() => void load(1)}>
              Try again
            </button>
          </p>
        ) : panel.total === 0 ? (
          <p className="m-0 rounded-md border p-3.5 text-center text-sm text-muted-foreground">
            {filtering ? 'Nothing matches these filters.' : `No ${noun} to pull here.`}
          </p>
        ) : panel.total === null ? (
          <p className="m-0 rounded-md border p-3.5 text-center text-sm text-muted-foreground">
            {enabled ? 'Loading…' : null}
          </p>
        ) : null}
      </div>

      {panel.items.length > 0 ? (
        <ul
          aria-label={label}
          className="m-0 max-h-[340px] list-none overflow-auto rounded-md border p-0"
        >
          {panel.items.map((item) => {
            const checked = selected.some((chosen) => chosen.id === item.id)
            const bad = refusalFor(item, refused)
            const isIssue = item.phase !== 'Discovery'
            return (
              <li key={item.id} className="border-t first:border-t-0">
                <label
                  className={cn(
                    'grid min-h-11 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-2.5 px-3 py-2.5 hover:bg-muted/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring',
                    checked && 'bg-accent hover:bg-accent',
                    bad && 'bg-destructive/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(item)}
                    className="mt-0.5 size-[18px]"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary-foreground">
                      <span>by {item.authorName}</span>
                      {item.boardId === null || item.boardName === null ? (
                        <span className="inline-flex items-center rounded-full border border-dashed px-2 font-semibold italic">
                          No board
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 font-semibold">
                          {item.boardName}
                          {setup.archivedBoardIds.includes(item.boardId) ? (
                            <span className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground">
                              archived
                            </span>
                          ) : null}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-2 font-semibold">
                        <Dot color={statusColor(item.statusId)} />
                        {item.statusName}
                      </span>
                      {item.tags.map((name) => (
                        <Tag key={name}>{name}</Tag>
                      ))}
                    </span>
                    {isIssue ? (
                      <span className="mt-0.5 block text-xs font-medium text-accent-foreground">
                        Issue &middot; returns to Discovery, tasks kept
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-secondary-foreground">
                      {landing(item, lanes)}
                    </span>
                    {bad ? (
                      <span className="mt-0.5 flex items-start gap-1 text-xs font-semibold text-destructive">
                        <Icon name="alert" className="mt-0.5 size-3.5" />
                        {bad}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}

      {panel.total !== null && panel.items.length < panel.total ? (
        <button
          type="button"
          disabled={panel.loading}
          onClick={() => void load(panel.page + 1)}
          className="self-start rounded-md border px-3 py-1 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {panel.loading ? 'Loading…' : `Show more (${panel.total - panel.items.length} left)`}
        </button>
      ) : null}
    </div>
  )
}
