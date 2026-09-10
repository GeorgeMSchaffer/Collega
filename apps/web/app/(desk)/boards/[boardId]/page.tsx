import { buttonVariants, EmptyState, Kbd } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GatedAction } from '@/components/common/gated-action'
import { Lane } from '@/components/ideas/lane'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { getBoard, getIdeasForBoard } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, writeDenial } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = await getBoard(boardId)
  return { title: `${board?.name ?? 'Board'} · Collega` }
}

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  // Identity first, and in this segment: Next renders a layout and its page independently,
  // so the desk layout resolving it is not enough for what renders here. One `/auth/me` per
  // request all the same — the resolver is request-cached.
  await requireCurrentUser()

  const { boardId } = await params

  // Sequential, not `Promise.all`: an idea query for a board the caller cannot read answers 404
  // too, and in a `Promise.all` that rejection wins the race and lands a stranger on an error
  // boundary instead of "not found". Establishing the board exists first is also the only order
  // that does not query rows behind a board this account may not open.
  const board = await getBoard(boardId)
  if (!board) notFound()

  const boardIdeas = await getIdeasForBoard(boardId)

  // Two independent gates, and both have to open. The role decides whether this account writes at
  // all; `allowUserStatusUpdate` is the board's own setting for whether a plain User may move a
  // card between lanes, which is a board configuration rather than a role (comp Q's "User status
  // moves" column in board settings). An Org Admin moves cards on a board that has it switched off.
  const roleDenial = writeDenial(currentUser().role)
  const denial =
    roleDenial ??
    (board.allowUserStatusUpdate || currentUser().role === 'OrgAdmin'
      ? null
      : 'This board only lets administrators move cards')
  const canMove = denial === null

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/boards">Boards</Link> /{' '}
            <b className="font-medium text-foreground">{board.name}</b>
          </span>
        }
        actions={
          <>
            <Link href="/ideas" className={buttonVariants({ variant: 'outline' })}>
              List view
            </Link>
            <NewIdeaButton id="why-new-board" />
          </>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>{board.name}</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            {canMove ? (
              <>
                Move a card with drag, or focus it and press <Kbd>←</Kbd> <Kbd>→</Kbd>. Both paths
                do the same thing — and both need{' '}
                <code className="font-mono text-xs">POST /ideas/&#123;id&#125;/status</code>, which
                is a later slice: the board reads real data but does not write yet.
              </>
            ) : (
              <>{denial}. Cards open read-only, and nothing here can be moved.</>
            )}
          </p>
        </div>

        <div className="flex items-start gap-3 overflow-x-auto pb-3">
          {/* The board's own lanes, in the board's own order — not the organization's status
              catalog. A board picks a subset, so rendering the catalog would show columns this
              board does not have. */}
          {board.lanes.map((status) => (
            <Lane
              key={status.id}
              status={status}
              ideas={boardIdeas.filter((i) => i.statusId === status.id)}
            />
          ))}
        </div>

        {/* Beneath the lanes, not instead of them: the five empty columns are what teach the
            workflow, so an empty board still shows the shape it will fill.

            The button below is gated on `roleDenial`, not `denial`: it authors an idea, and the API
            refuses authoring for ReadOnly alone (`IdeaService.requireIdeaEditRole`).
            `allowUserStatusUpdate` gates moves and nothing else, so folding it in here refused a
            User with a reason that was not true — and contradicted the identically labelled button
            in the topbar, which gates on the role alone. */}
        {boardIdeas.length === 0 ? (
          <EmptyState
            heading="No ideas on this board yet"
            action={<GatedAction id="why-new-board-empty" label="New idea" denial={roleDenial} />}
          >
            {canMove ? (
              <>
                Use &ldquo;New idea&rdquo; to add the first one. It lands in New / Pending, the
                left-most lane.
              </>
            ) : (
              <>Nothing has been raised here yet.</>
            )}
          </EmptyState>
        ) : null}
      </main>
    </>
  )
}
