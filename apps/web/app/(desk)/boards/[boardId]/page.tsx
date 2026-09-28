import { Alert, buttonVariants } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { AddIdeaButton } from '@/components/ideas/add-idea-button'
import { ArchivedBanner } from '@/components/ideas/archived-banner'
import { BOARD_LIST, toIdeaListQuery } from '@/components/ideas/idea-list-config'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { loadIdeaDrawer } from '@/components/ideas/load-idea-drawer'
import { readListState } from '@/components/list/list-state'
import { Topbar } from '@/components/nav/topbar'
import { getBoard, getBoardIdeaList } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser, writeDenial } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = await getBoard(boardId)
  return { title: `${board?.name ?? 'Board'} · Collega` }
}

const ARCHIVED = 'This board is archived'

/**
 * A board's own page (comp R): Lanes by default, List beside it, both filtered and sorted in the
 * API from the URL, with the idea drawer over them. An archived board opens read-only under its
 * banner — no adding, moving or editing; comments, votes and reading still work.
 */
export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [{ boardId }, query] = await Promise.all([params, searchParams])

  // Sequential, not `Promise.all`: an idea query for a board the caller cannot read answers 404
  // too, and in a `Promise.all` that rejection wins the race and lands a stranger on an error
  // boundary instead of "not found".
  const board = await getBoard(boardId)
  if (!board) notFound()

  const user = currentUser()
  const roleDenial = writeDenial(user.role)
  const authorDenial = roleDenial ?? (board.isArchived ? ARCHIVED : null)

  // Two gates: the role decides whether this account writes at all, and `allowUserStatusUpdate` is
  // the board's own setting for whether a plain User may move a card. An archived board moves none.
  const moveDenial =
    authorDenial ??
    (board.allowUserStatusUpdate || user.role === 'OrgAdmin'
      ? null
      : 'This board only lets administrators move cards')

  const state = readListState(query, BOARD_LIST)
  const listQuery = toIdeaListQuery(state)

  const [first, drawer] = await Promise.all([
    getBoardIdeaList(board.id, listQuery),
    loadIdeaDrawer(query, authorDenial === null),
  ])

  const lastPage = Math.max(1, Math.ceil(first.totalCount / listQuery.pageSize))
  const ideas =
    first.ideas.length === 0 && listQuery.page > lastPage
      ? await getBoardIdeaList(board.id, { ...listQuery, page: lastPage })
      : first

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
          <GatedAction
            id="why-edit-board"
            label="Edit board"
            denial={boardAdminDenial(user.role) ?? (board.isArchived ? ARCHIVED : null)}
            variant="outline"
          >
            <Link
              href={`/settings/boards/${board.id}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              Edit board
            </Link>
          </GatedAction>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title={board.name}
          description={
            <>
              {board.description ? `${board.description} ` : null}
              {board.isArchived
                ? null
                : moveDenial === null
                  ? 'Move a card between lanes with the arrows on it.'
                  : `${moveDenial}, so cards here stay where they are.`}
            </>
          }
          action={
            authorDenial ? (
              <GatedAction id="why-new-board" label="Add New Idea" denial={authorDenial} />
            ) : (
              <AddIdeaButton />
            )
          }
        />
        {board.isArchived ? (
          <ArchivedBanner boardId={board.id} canUnarchive={user.role === 'OrgAdmin'} />
        ) : null}
        {drawer.missing ? (
          <Alert role="status">
            <span>
              That idea could not be opened. It may have been deleted, or it is not yours to see.
            </span>
          </Alert>
        ) : null}
        <IdeaWorkspace
          rows={ideas.ideas}
          total={ideas.totalCount}
          boards={[{ id: board.id, name: board.name, isArchived: board.isArchived, topTags: [] }]}
          statuses={board.lanes}
          organizationId={user.organizationId}
          board={{
            id: board.id,
            name: board.name,
            lanes: board.lanes,
            isArchived: board.isArchived,
            canMove: moveDenial === null,
          }}
          drawer={drawer}
        />
      </main>
    </>
  )
}
