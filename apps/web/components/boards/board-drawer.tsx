'use client'

import { Alert, Button, buttonVariants } from '@collega/design-system'
import Link from 'next/link'
import { type ReactNode, useActionState, useState } from 'react'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { BoardFields, pullLabel, useKeptSubmit } from '@/components/settings/board-form'
import type { PullSetup } from '@/components/settings/pull-step'
import { SwimlanePicker } from '@/components/settings/swimlane-picker'
import { PULL_ITEM_CAP } from '@/lib/limits'
import {
  createBoardInPlace,
  type FieldRefusals,
  saveBoardInPlace,
} from '@/lib/server/board-actions'
import type { BoardOverview, LaneFlags, PullCandidate, ReferenceContext, Status } from '@/lib/types'
import { LaneLegend, LaneStrip, statusLabel, TopTags } from './board-parts'

export type DrawerMode = 'view' | 'edit' | 'create'

/** The board form's seed values, read by the page when a form is open. */
export type BoardFormData = {
  /** The board being edited, or null when creating. */
  boardId: string | null
  name: string
  description: string
  userStatusMoves: boolean
  swimlaneIds: string[]
  /** The board's lane flags as loaded, sent back on save so the save does not clear them. */
  laneFlags?: Readonly<Record<string, LaneFlags>> | undefined
  /** Live ideas per lane of the board being edited, for the confirm step a lane removal needs. */
  laneIdeaCounts?: Readonly<Record<string, number>> | undefined
  keyPrefix?: string | null
  ideaFeaturesEnabled?: boolean
  /** The boards a lane may reference, and which boards reference this one. */
  references?: ReferenceContext | undefined
  statuses: Status[]
  /** What the *Add existing items* step needs; absent leaves the step out. */
  pull?: PullSetup
}

/** A board's lanes as the view shows them, read-only: each lane's status and its Board References flags. */
export type BoardView = {
  boardId: string
  lanes: Status[]
  flags: Readonly<Record<string, LaneFlags>>
  /** The organization's other boards, to name what a lane references. */
  references: ReferenceContext
}

const FORM_ID = 'board-drawer-form'

/** The last save's refusal, and which form it belongs to, so it never shows on another board's. */
type Outcome = {
  error: string | null
  pullErrors: string[]
  formKey: string | null
} & FieldRefusals
const IDLE: Outcome = { error: null, pullErrors: [], formKey: null }

/**
 * The Boards screen's drawer: a board's facts in view mode, and the board form for edit and create.
 * From the Boards screen it replaces the Settings pages for these; those pages still work.
 *
 * An archived board opens read-only, with no Edit: its settings are frozen until it is unarchived
 * (`SPEC/20-feature-boards-and-statuses.md` rule 13).
 */
export function BoardDrawer({
  open,
  form,
  view,
  isAdmin,
  returnFocusTo,
  onClose,
  onView,
  onEdit,
  onArchive,
}: {
  open: { mode: DrawerMode; board: BoardOverview | null } | null
  form: BoardFormData | null
  /** The viewed board's lanes with their flags; null until the page has them. */
  view?: BoardView | null
  isAdmin: boolean
  returnFocusTo: HTMLElement | null
  onClose: () => void
  onView: (boardId: string) => void
  onEdit: (boardId: string) => void
  onArchive: (board: BoardOverview) => void
}) {
  const board = open?.board ?? null
  const mode = open?.mode ?? 'view'
  const formKey = form ? (form.boardId ?? 'new') : null

  const [outcome, submit, saving] = useActionState(
    async (_previous: Outcome, data: FormData): Promise<Outcome> => {
      const boardId = form?.boardId ?? null
      const save = boardId === null ? createBoardInPlace : saveBoardInPlace
      const result = await save({ error: null, savedId: null }, data)
      if (result.savedId) onView(result.savedId)
      const { savedId: _saved, pullErrors, ...rest } = result
      return { ...rest, pullErrors: pullErrors ?? [], formKey }
    },
    IDLE,
  )
  const onSubmit = useKeptSubmit(submit)
  // The items to pull belong to the form that chose them, like the refusal above.
  const [chosen, setChosen] = useState<{ formKey: string | null; items: PullCandidate[] }>({
    formKey: null,
    items: [],
  })
  const pulled = chosen.formKey === formKey ? chosen.items : []
  const over = pulled.length > PULL_ITEM_CAP
  const refused = outcome.formKey === formKey ? outcome.pullErrors : []

  const eyebrow =
    mode === 'create'
      ? 'New board'
      : mode === 'edit'
        ? 'Edit board'
        : board
          ? `Board · ${statusLabel(board)}`
          : null

  let body: ReactNode = null
  let footer: ReactNode = null
  if (open !== null && mode === 'view' && board) {
    body = (
      <BoardFacts board={board} view={view?.boardId === board.id ? view : null} isAdmin={isAdmin} />
    )
    footer = (
      <>
        <Link href={`/boards/${board.id}`} className={buttonVariants()}>
          Open board
        </Link>
        {isAdmin && !board.isArchived ? (
          <Button variant="outline" onClick={() => onEdit(board.id)}>
            <Icon name="edit" />
            Edit
          </Button>
        ) : null}
        <span className="flex-1" />
        {isAdmin ? (
          <Button variant="ghost" onClick={() => onArchive(board)}>
            <Icon name={board.isArchived ? 'unarchive' : 'archive'} />
            {board.isArchived ? 'Unarchive' : 'Archive'}
          </Button>
        ) : null}
      </>
    )
  } else if (open !== null && form) {
    body = (
      <form
        id={FORM_ID}
        // A fresh form per board, so one board's typing never seeds another's.
        key={formKey}
        onSubmit={onSubmit}
      >
        {outcome.error && outcome.formKey === formKey ? (
          <Alert variant="destructive" className="mb-4">
            <span>{outcome.error}</span>
          </Alert>
        ) : null}
        <BoardFields
          boardId={form.boardId}
          defaultName={form.name}
          defaultDescription={form.description}
          userStatusMoves={form.userStatusMoves}
          swimlaneIds={form.swimlaneIds}
          laneFlags={form.laneFlags}
          laneIdeaCounts={form.laneIdeaCounts}
          ideaFeaturesEnabled={form.ideaFeaturesEnabled}
          references={form.references}
          refusals={outcome.formKey === formKey ? outcome : undefined}
          statuses={form.statuses}
          sectionHeading="h3"
          pull={
            form.pull
              ? {
                  setup: form.pull,
                  selected: pulled,
                  onChange: (items) => setChosen({ formKey, items }),
                  refused,
                  boardName: form.name,
                }
              : undefined
          }
        />
      </form>
    )
    // Outside the form, so they submit it by `form=`; Enter in a field still submits.
    footer = (
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            form={FORM_ID}
            disabled={saving}
            aria-disabled={over ? 'true' : undefined}
            aria-describedby={over ? 'pull-over-cap' : undefined}
            onClick={(event) => {
              if (over) event.preventDefault()
            }}
          >
            {saving
              ? 'Saving…'
              : pullLabel(mode === 'create' ? 'Create board' : 'Save changes', pulled.length)}
          </Button>
          <Button
            variant="outline"
            onClick={() => (mode === 'edit' && board ? onView(board.id) : onClose())}
          >
            Cancel
          </Button>
        </div>
        {over ? (
          <p id="pull-over-cap" className="m-0 text-xs text-muted-foreground">
            Can&rsquo;t save: {pulled.length} items selected, the limit is {PULL_ITEM_CAP}.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <Drawer
      open={open !== null}
      onClose={onClose}
      eyebrow={eyebrow}
      title={mode === 'create' ? 'Add New Board' : (board?.name ?? '')}
      footer={footer}
      returnFocusTo={returnFocusTo}
      focusKey={mode}
    >
      {body}
    </Drawer>
  )
}

function BoardFacts({
  board,
  view,
  isAdmin,
}: {
  board: BoardOverview
  view: BoardView | null
  isAdmin: boolean
}) {
  const facts: [string, ReactNode][] = [
    ['Ideas', board.ideaCount],
    ['Lanes', board.laneCount],
    ['Created', board.createdOn],
    ['By', board.createdBy ?? '—'],
    ['User status moves', board.userStatusMoves ? 'Allowed' : 'Admins only'],
    ['Key prefix', board.keyPrefix ?? '—'],
    ['Idea features', board.ideaFeaturesEnabled ? 'On' : 'Off'],
    ['Status', board.archivedOn ? `Archived ${board.archivedOn}` : statusLabel(board)],
  ]

  return (
    <>
      {board.isArchived ? (
        <Alert variant="note" role="status" className="flex items-start gap-2">
          <Icon name="archive" />
          <span>
            This board is archived. Its lanes and ideas are read-only, and its settings can&rsquo;t
            change until it is unarchived.
          </span>
        </Alert>
      ) : null}
      <p className="m-0 text-sm">
        {board.description ?? (
          <span className="text-muted-foreground italic">No description yet.</span>
        )}
      </p>
      <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="m-0 mt-0.5 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <LaneStrip board={board} />
        <LaneLegend board={board} />
      </div>
      {view ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Lanes
          </h3>
          {isAdmin ? null : (
            <Alert variant="note" role="status">
              <span>
                You can see this board&rsquo;s settings but only an Org Admin can change them.
              </span>
            </Alert>
          )}
          <SwimlanePicker
            readOnly
            ids={view.lanes.map((lane) => lane.id)}
            onChange={() => {}}
            statuses={view.lanes}
            flags={view.flags}
            references={view.references}
          />
        </div>
      ) : null}
      <TopTags board={board} limit={3} />
    </>
  )
}
