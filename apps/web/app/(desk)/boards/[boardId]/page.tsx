import { buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { Lane } from '@/components/ideas/lane'
import { NewIdeaForm } from '@/components/ideas/new-idea-form'
import { Topbar } from '@/components/nav/topbar'
import { getBoard, getIdeaOptions, getIdeasForBoard } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser, engagementDenial, writeDenial } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = await getBoard(boardId)
  return { title: `${board?.name ?? 'Board'} · Collega` }
}

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { boardId } = await params

  // Sequential, not `Promise.all`: an idea query for a board the caller cannot read answers 404
  // too, and in a `Promise.all` that rejection wins the race and lands a stranger on an error
  // boundary instead of "not found". Establishing the board exists first is also the only order
  // that does not query rows behind a board this account may not open.
  const board = await getBoard(boardId)
  if (!board) notFound()

  // Two independent gates, and both have to open. The role decides whether this account writes at
  // all; `allowUserStatusUpdate` is the board's own setting for whether a plain User may move a
  // card between lanes, which is a board configuration rather than a role (comp Q's "User status
  // moves" column in board settings). An Org Admin moves cards on a board that has it switched off.
  const roleDenial = writeDenial(currentUser().role)
  const moveDenial =
    roleDenial ??
    (board.allowUserStatusUpdate || currentUser().role === 'OrgAdmin'
      ? null
      : 'This board only lets administrators move cards')
  const canMove = moveDenial === null

  // Upvoting is engagement, not authorship, and the two part company for exactly one role: a Read
  // Only account may vote and may not write (`UpvoteService.toggle` — "All authenticated users,
  // including Read Only, can upvote"). Gating the chip on `roleDenial` would take that away.
  const upvoteDenial = engagementDenial(currentUser().role)

  // The catalogs only the create form reads, and only when there is a form to fill — two requests
  // that would otherwise be paid on every board view by everyone who cannot author.
  const [boardIdeas, options] = await Promise.all([
    getIdeasForBoard(boardId),
    roleDenial ? { ideaTypes: [], businessImpacts: [] } : getIdeaOptions(),
  ])

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
            <GatedAction
              id="why-edit-board"
              label="Edit board"
              denial={boardAdminDenial(currentUser().role)}
              variant="outline"
            >
              <Link
                href={`/settings/boards/${board.id}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                Edit board
              </Link>
            </GatedAction>
          </>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title={board.name}
          description={
            canMove ? (
              <>
                Move a card between lanes with the arrows on it. A move saves immediately and the
                board re-reads itself, so what you see after it is what the server holds.
              </>
            ) : (
              <>{moveDenial}. Cards open read-only, and nothing here can be moved.</>
            )
          }
          action={
            // The board is context here, so the form asks for everything except that. A role that
            // may not author gets the same control, disabled with its reason, and none of the
            // form's client bundle.
            roleDenial ? (
              <GatedAction id="why-new-board" label="Add New Idea" denial={roleDenial} />
            ) : (
              <NewIdeaForm boardId={board.id} options={options} />
            )
          }
        />

        <div className="flex items-start gap-3 overflow-x-auto pb-3">
          {/* The board's own lanes, in the board's own order — not the organization's status
              catalog. A board picks a subset, so rendering the catalog would show columns this
              board does not have. */}
          {board.lanes.map((status, index) => (
            <Lane
              key={status.id}
              status={status}
              boardId={board.id}
              ideas={boardIdeas.filter((i) => i.statusId === status.id)}
              previousStatusId={board.lanes[index - 1]?.id ?? null}
              nextStatusId={board.lanes[index + 1]?.id ?? null}
              canMove={canMove}
              upvoteDenial={upvoteDenial}
            />
          ))}
        </div>

        {/* Beneath the lanes, not instead of them: the five empty columns are what teach the
            workflow, so an empty board still shows the shape it will fill.

            The action below appears only for a role that may NOT author, which is the opposite of
            the usual shape and is what "shown, not hidden" actually asks for here: the refusal is
            the thing worth showing, and a second live "Add New Idea" would mean a second dialog in the
            document with the same heading and the same ids as the working one in the page header. The
            copy points at that one instead.

            It is gated on `roleDenial`, not `moveDenial`: authoring is refused for ReadOnly alone
            (`IdeaService.requireIdeaEditRole`), while `allowUserStatusUpdate` gates moves and
            nothing else, so folding it in here refused a User with a reason that was not true. */}
        {boardIdeas.length === 0 ? (
          <EmptyState
            heading="No ideas on this board yet"
            action={
              roleDenial ? (
                <GatedAction id="why-new-board-empty" label="Add New Idea" denial={roleDenial} />
              ) : undefined
            }
          >
            {roleDenial ? (
              <>Nothing has been raised here yet.</>
            ) : (
              <>
                Use &ldquo;Add New Idea&rdquo; above to add the first one. It lands in{' '}
                {board.lanes[0]?.name ?? 'the left-most lane'}.
              </>
            )}
          </EmptyState>
        ) : null}
      </main>
    </>
  )
}
