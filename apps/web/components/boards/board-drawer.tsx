'use client'

import { Alert, Button, buttonVariants } from '@collega/design-system'
import Link from 'next/link'
import { type ReactNode, useActionState } from 'react'
import { Drawer } from '@/components/list'
import { Icon } from '@/components/list/icons'
import { BoardFields } from '@/components/settings/board-form'
import { createBoardInPlace, saveBoardInPlace } from '@/lib/server/board-actions'
import type { BoardOverview, Status } from '@/lib/types'
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
  statuses: Status[]
}

const FORM_ID = 'board-drawer-form'

/** The last save's refusal, and which form it belongs to, so it never shows on another board's. */
type Outcome = { error: string | null; formKey: string | null }
const IDLE: Outcome = { error: null, formKey: null }

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
  isAdmin,
  returnFocusTo,
  onClose,
  onView,
  onEdit,
  onArchive,
}: {
  open: { mode: DrawerMode; board: BoardOverview | null } | null
  form: BoardFormData | null
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
      const result = await save({ error: null, saved: false }, data)
      if (result.saved) {
        if (boardId) onView(boardId)
        else onClose()
      }
      return { error: result.error, formKey }
    },
    IDLE,
  )

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
    body = <BoardFacts board={board} />
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
        action={submit}
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
          statuses={form.statuses}
          sectionHeading="h3"
        />
      </form>
    )
    // Outside the form, so they submit it by `form=`; Enter in a field still submits.
    footer = (
      <>
        <Button type="submit" form={FORM_ID} disabled={saving}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create board' : 'Save changes'}
        </Button>
        <Button
          variant="outline"
          onClick={() => (mode === 'edit' && board ? onView(board.id) : onClose())}
        >
          Cancel
        </Button>
      </>
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

function BoardFacts({ board }: { board: BoardOverview }) {
  const facts: [string, ReactNode][] = [
    ['Ideas', board.ideaCount],
    ['Lanes', board.laneCount],
    ['Created', board.createdOn],
    ['By', board.createdBy ?? '—'],
    ['User status moves', board.userStatusMoves ? 'Allowed' : 'Admins only'],
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
      <TopTags board={board} limit={3} />
    </>
  )
}
