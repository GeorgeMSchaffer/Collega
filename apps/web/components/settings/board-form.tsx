'use client'

import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Switch,
  Textarea,
} from '@collega/design-system'
import Link from 'next/link'
import { type FormEvent, useActionState, useState, useTransition } from 'react'
import { IdeaMovesGuard } from '@/components/settings/idea-moves-guard'
import { type PullSetup, PullStep } from '@/components/settings/pull-step'
import { NO_FLAGS, SwimlanePicker } from '@/components/settings/swimlane-picker'
import { PULL_ITEM_CAP } from '@/lib/limits'
import type { BoardFormState, FieldRefusals } from '@/lib/server/board-actions'
import { createBoard, saveBoard } from '@/lib/server/board-actions'
import type { LaneFlags, PullCandidate, ReferenceContext, Status } from '@/lib/types'

const IDLE: BoardFormState = { error: null }

/**
 * Create and edit are the same form with different seed values, so they are the same component.
 * The one thing edit does *not* add is a delete: a board's ideas outlive the board, which is
 * archived instead, from the Boards screen.
 *
 * `boardId` is what tells the two apart, and it decides the action rather than being a flag beside
 * one — a board with an id is saved, a board without one is created, and there is no third state
 * for the two to disagree about.
 *
 * The statuses arrive as a prop because `SwimlanePicker` cannot await, and the picker posts its own
 * hidden fields, so the order the person arranged is the order this form submits. Nothing about the
 * lanes is read back out of the picker by this component.
 *
 * **Not `@/lib/data` for the `Status` type.** That barrel re-exports the API-backed readers, which
 * reach `lib/api/client.ts` and its `server-only` import, so pulling a type through it drags the
 * whole module into the client graph and fails the build — the same trap `SwimlanePicker` documents.
 */
export function BoardForm({
  boardId,
  defaultName = '',
  defaultDescription = '',
  swimlaneIds,
  laneFlags,
  laneIdeaCounts,
  ideaFeaturesEnabled = true,
  references,
  statuses,
  submitLabel,
  explainerHeading,
  pullSetup,
}: {
  /** The board being edited, or null on the create route. */
  boardId: string | null
  defaultName?: string
  defaultDescription?: string
  swimlaneIds: string[]
  /** The board's lane flags as loaded, keyed by status id, sent back on save so they survive. */
  laneFlags?: Readonly<Record<string, LaneFlags>> | undefined
  /** Live ideas per lane of the board being edited, keyed by status id. */
  laneIdeaCounts?: Readonly<Record<string, number>> | undefined
  ideaFeaturesEnabled?: boolean | undefined
  /** The boards a lane may reference; absent leaves the References controls out. */
  references?: ReferenceContext | undefined
  /** Drilled to `SwimlanePicker`, which is a client component and cannot read them itself. */
  statuses: Status[]
  submitLabel: string
  explainerHeading: string
  /** What the *Add existing items* step needs; absent leaves the step out. */
  pullSetup?: PullSetup
}) {
  const [state, submit, pending] = useActionState(boardId === null ? createBoard : saveBoard, IDLE)
  const onSubmit = useKeptSubmit(submit)
  const [pulled, setPulled] = useState<PullCandidate[]>([])
  const over = pulled.length > PULL_ITEM_CAP

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
      <Card>
        <CardContent>
          {state.error ? (
            <Alert variant="destructive" className="mb-4">
              <span>{state.error}</span>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit}>
            <BoardFields
              boardId={boardId}
              defaultName={defaultName}
              defaultDescription={defaultDescription}
              swimlaneIds={swimlaneIds}
              laneFlags={laneFlags}
              laneIdeaCounts={laneIdeaCounts}
              ideaFeaturesEnabled={ideaFeaturesEnabled}
              references={references}
              refusals={state}
              statuses={statuses}
              pull={
                pullSetup
                  ? {
                      setup: pullSetup,
                      selected: pulled,
                      onChange: setPulled,
                      refused: state.pullErrors ?? [],
                      boardName: defaultName,
                    }
                  : undefined
              }
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                disabled={pending}
                aria-disabled={over ? 'true' : undefined}
                aria-describedby={over ? 'pull-over-cap' : undefined}
                onClick={(event) => {
                  if (over) event.preventDefault()
                }}
              >
                {pending ? 'Saving…' : pullLabel(submitLabel, pulled.length)}
              </Button>
              {over ? (
                <span id="pull-over-cap" className="text-xs text-muted-foreground">
                  Can&rsquo;t save: {pulled.length} items selected, the limit is {PULL_ITEM_CAP}.
                </span>
              ) : null}
              <Link href="/settings/boards" className={buttonVariants({ variant: 'outline' })}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{explainerHeading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="m-0">
            A board groups ideas into columns. Which columns, and in what order, is what makes two
            boards in the same organization different from each other &mdash; they draw from one
            shared set of statuses.
          </p>
          <p className="m-0">
            Removing a swimlane does not delete the status, and does not delete the ideas sitting in
            it. Before saving, you choose which remaining lane those ideas move to.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Submits the board form from `onSubmit` rather than as the form's `action`.
 *
 * React resets an uncontrolled form once its action settles, refusal included, so a save the API
 * refuses would hand back an empty name and description. A refused pull is now an ordinary way to
 * land there, and retyping a board is the wrong price for dropping one item. The submit listeners
 * on the form itself (`IdeaMovesGuard`'s confirm, `PullStep`'s cap) stop a submit with
 * `preventDefault`, which this honours.
 */
export function useKeptSubmit(submit: (data: FormData) => void) {
  const [, start] = useTransition()
  return (event: FormEvent<HTMLFormElement>) => {
    if (event.defaultPrevented) return
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    start(() => submit(data))
  }
}

/** The save button's label, naming the pull so it is never a surprise ("Create board and add 3 items"). */
export function pullLabel(label: string, count: number): string {
  return count > 0 ? `${label} and add ${count} item${count > 1 ? 's' : ''}` : label
}

/**
 * The board form's fields, without the form around them: the Settings screen wraps them in a card
 * that redirects on save, the Boards screen's drawer in a form that stays put.
 *
 * `sectionHeading` keeps the outline right in both: an `h2` under the Settings page's `h1`, an `h3`
 * under the drawer's `h2`.
 */
export function BoardFields({
  boardId,
  defaultName = '',
  defaultDescription = '',
  swimlaneIds,
  laneFlags,
  laneIdeaCounts = {},
  ideaFeaturesEnabled = true,
  references,
  refusals,
  statuses,
  sectionHeading: SectionHeading = 'h2',
  pull,
}: {
  boardId: string | null
  defaultName?: string
  defaultDescription?: string
  swimlaneIds: string[]
  /** Posted as one hidden field so a save returns each lane's flags; absent on create. */
  laneFlags?: Readonly<Record<string, LaneFlags>> | undefined
  /** Live ideas per lane of the board being edited; absent on create, where nothing is removed. */
  laneIdeaCounts?: Readonly<Record<string, number>> | undefined
  /** The idea-features switch as stored. */
  ideaFeaturesEnabled?: boolean | undefined
  /** The boards a lane may reference; absent leaves the References controls out. */
  references?: ReferenceContext | undefined
  /** The last save's field refusals: the key prefix and, where it is plain, the lane. */
  refusals?: FieldRefusals | undefined
  statuses: Status[]
  sectionHeading?: 'h2' | 'h3'
  /** The *Add existing items* step; absent leaves it out. The caller owns the selection. */
  pull?:
    | {
        setup: PullSetup
        selected: PullCandidate[]
        onChange: (next: PullCandidate[]) => void
        /** The API's per-item refusals from the last save. */
        refused: readonly string[]
        boardName: string
      }
    | undefined
}) {
  const [ids, setIds] = useState(swimlaneIds)
  const [flags, setFlags] = useState<Record<string, LaneFlags>>({ ...laneFlags })
  const [ideaFeatures, setIdeaFeatures] = useState(ideaFeaturesEnabled)
  // The board's lanes this save would drop that still hold ideas: each needs a lane to move them to.
  const removed = swimlaneIds.flatMap((id) => {
    const ideaCount = laneIdeaCounts[id] ?? 0
    if (ids.includes(id) || ideaCount === 0) return []
    const status = statuses.find((candidate) => candidate.id === id)
    return [{ id, name: status?.name ?? 'A removed lane', ideaCount }]
  })
  const remaining = ids.flatMap((id) => statuses.find((status) => status.id === id) ?? [])

  return (
    <>
      {boardId === null ? null : <input type="hidden" name="boardId" value={boardId} />}
      <input type="hidden" name="laneFlags" value={JSON.stringify(flags)} />
      <input type="hidden" name="ideaFeaturesEnabled" value={String(ideaFeatures)} />

      {pull?.setup.archived ? (
        <Alert variant="note" role="status" className="mb-4">
          <span>
            This board is archived and read-only. Unarchive it to change its lanes or details.
          </span>
        </Alert>
      ) : null}

      <Field
        htmlFor="board-name"
        label="Name"
        hint="Required. What this board is called everywhere it appears."
      >
        <Input id="board-name" name="name" defaultValue={defaultName} required />
      </Field>

      <Field
        htmlFor="board-description"
        label="Description"
        hint="Optional, up to 500 characters. The first two lines show on the board's card."
      >
        <Textarea
          id="board-description"
          name="description"
          defaultValue={defaultDescription}
          maxLength={500}
          rows={3}
        />
      </Field>

      <div className="mb-4">
        <Switch
          checked={ideaFeatures}
          onCheckedChange={setIdeaFeatures}
          aria-describedby="idea-features-hint"
        >
          Idea features
        </Switch>
        <p id="idea-features-hint" className="m-0 mt-1 max-w-prose text-xs text-muted-foreground">
          {references && references.referencedBy.length > 0 && !ideaFeatures
            ? 'Off, because this board is the target of a reference. Cards here show title, description, assignees, tags, sprint and blockers. An Org Admin can turn it on.'
            : 'Upvotes, idea types and their fields, and AI assist. On for ordinary boards.'}
        </p>
      </div>

      <div className="mb-3">
        <SectionHeading className="m-0 text-sm font-semibold">Swimlanes</SectionHeading>
        <p className="m-0 mt-1 max-w-prose text-xs text-muted-foreground">
          Pick from this organization&rsquo;s statuses. The order on the left is the left-to-right
          order of the board&rsquo;s columns.
        </p>
      </div>
      <SwimlanePicker
        ids={ids}
        onChange={setIds}
        statuses={statuses}
        flags={flags}
        onFlags={(statusId, patch) =>
          setFlags((current) => ({
            ...current,
            [statusId]: { ...(current[statusId] ?? NO_FLAGS), ...patch },
          }))
        }
        references={references}
        boardId={boardId}
        boardName={defaultName}
        laneIdeaCounts={laneIdeaCounts}
        laneErrors={refusals?.laneErrors}
      />
      <IdeaMovesGuard removed={removed} remaining={remaining} />

      {pull ? (
        <PullStep
          setup={pull.setup}
          boardId={boardId}
          boardName={pull.boardName}
          lanes={remaining}
          statuses={statuses}
          laneRemoval={removed.length > 0}
          selected={pull.selected}
          onChange={pull.onChange}
          refused={pull.refused}
          sectionHeading={SectionHeading}
        />
      ) : null}
    </>
  )
}
