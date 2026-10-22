import { Alert, buttonVariants, EmptyState } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BoardViewed } from '@/components/analytics/board-viewed'
import { BacklogList } from '@/components/boards/backlog-list'
import { type BoardTab, BoardTabs } from '@/components/boards/board-tabs'
import { NewTaskDrawer } from '@/components/boards/new-task-drawer'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { AddIdeaButton } from '@/components/ideas/add-idea-button'
import { ArchivedBanner } from '@/components/ideas/archived-banner'
import { BOARD_LIST, toIdeaListQuery } from '@/components/ideas/idea-list-config'
import { IdeaWorkspace } from '@/components/ideas/idea-workspace'
import { loadIdeaDrawer } from '@/components/ideas/load-idea-drawer'
import { readListState } from '@/components/list/list-state'
import { Topbar } from '@/components/nav/topbar'
import {
  getBacklog,
  getBoard,
  getBoardIdeaList,
  getBoardRefs,
  getBoardSprints,
  getMemberOptions,
  getReferenceContext,
  getTagRefs,
  getTaskParentChoices,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser, writeDenial } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = await getBoard(boardId)
  return { title: `${board?.name ?? 'Board'} · Collega` }
}

const ARCHIVED = 'This board is archived'

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

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

  // Whoever may write may move a card; the board's stored `allowUserStatusUpdate` is no longer
  // consulted (SPEC/decisions.md 2026-10-22). An archived board moves none.
  const moveDenial = authorDenial

  // Tabs (comp W): a work board is one some other board's lane references, and opens on its
  // Backlog. Sprints exist only while the board has them switched on. A deep link to a card (or the
  // idea form) names the Board tab whatever the default is.
  const { referencedBy } = await getReferenceContext(board.id)
  const isWork = referencedBy.length > 0
  const tabs: BoardTab[] = [
    'board',
    ...(isWork ? (['backlog'] as const) : []),
    ...(board.sprintsEnabled ? (['sprints'] as const) : []),
  ]
  const requested = one(query.tab)
  const deepLink = one(query.idea) !== undefined || one(query.new) !== undefined
  const tab: BoardTab = tabs.includes(requested as BoardTab)
    ? (requested as BoardTab)
    : deepLink || !isWork
      ? 'board'
      : 'backlog'
  const showTabs = tabs.length > 1
  const canAddTask = isWork && authorDenial === null
  const canPlan = user.role === 'OrgAdmin' && board.sprintsEnabled && !board.isArchived
  // The Backlog side panel (TB-7) sits beside the lanes of a work board with sprints on, for any
  // role that may write; the lanes refuse a drop from anyone who may not plan.
  const hasPanel = tab === 'board' && isWork && board.sprintsEnabled && authorDenial === null

  const state = readListState(query, BOARD_LIST)
  const listQuery = toIdeaListQuery(state)

  // A reference lane's pill names the board it hands work to by that board's key prefix.
  const referencedIds = [
    ...new Set(board.lanes.map((lane) => lane.referencesBoardId).filter((id) => id !== null)),
  ]

  const onBoard = tab === 'board'
  const [first, tags, boards, drawer, referenced] = await Promise.all([
    onBoard ? getBoardIdeaList(board.id, listQuery) : null,
    getTagRefs(),
    onBoard ? getBoardRefs() : [],
    onBoard
      ? loadIdeaDrawer(query, authorDenial === null)
      : { mode: null, idea: null, formOptions: null, missing: false },
    onBoard ? Promise.all(referencedIds.map((id) => getBoard(id))) : [],
  ])
  const referenceBoards = Object.fromEntries(
    referencedIds.flatMap((id, index) => {
      const target = referenced[index]
      return target ? [[id, { name: target.name, label: target.keyPrefix ?? target.name }]] : []
    }),
  )

  const lastPage = Math.max(1, Math.ceil((first?.totalCount ?? 0) / listQuery.pageSize))
  const ideas =
    first && first.ideas.length === 0 && listQuery.page > lastPage
      ? await getBoardIdeaList(board.id, { ...listQuery, page: lastPage })
      : first

  // The Backlog tab reads the whole backlog; the other tabs only need its count for the badge.
  const [backlog, parentChoices, members, sprints] = await Promise.all([
    isWork ? getBacklog(board.id, tab === 'backlog' || hasPanel ? undefined : 1) : null,
    tab === 'backlog' && canAddTask ? getTaskParentChoices(board.id) : [],
    tab === 'backlog' && (canAddTask || canPlan) ? getMemberOptions() : [],
    board.sprintsEnabled ? getBoardSprints(board.id) : [],
  ])
  const newTaskHref = canAddTask
    ? `/boards/${encodeURIComponent(board.id)}?tab=backlog&task=new`
    : null

  return (
    <>
      <BoardViewed />
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
              href={`/boards?board=${encodeURIComponent(board.id)}&mode=edit`}
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
              {tab === 'backlog'
                ? 'Tasks waiting for a sprint: no sprint yet, and not finished.'
                : tab === 'sprints'
                  ? 'Sprints on this board.'
                  : board.isArchived
                    ? null
                    : moveDenial === null
                      ? 'Move a card with drag, or focus its title and press ← →.'
                      : `${moveDenial}, so cards here stay where they are.`}
            </>
          }
          action={
            tab === 'board' ? (
              authorDenial ? (
                <GatedAction id="why-new-board" label="Add New Idea" denial={authorDenial} />
              ) : (
                <AddIdeaButton />
              )
            ) : tab === 'backlog' && newTaskHref ? (
              <Link href={newTaskHref as Route} className={buttonVariants()}>
                + New task
              </Link>
            ) : undefined
          }
        />
        {showTabs ? (
          <BoardTabs
            boardId={board.id}
            tabs={tabs}
            active={tab}
            counts={{
              ...(backlog ? { backlog: backlog.totalCount } : {}),
              ...(board.sprintsEnabled
                ? { sprints: sprints.filter((sprint) => sprint.state !== 'Completed').length }
                : {}),
            }}
          />
        ) : null}
        {board.isArchived ? (
          <ArchivedBanner boardId={board.id} canUnarchive={user.role === 'OrgAdmin'} />
        ) : null}
        {tab === 'board' && drawer.missing ? (
          <Alert role="status">
            <span>
              That idea could not be opened. It may have been deleted, or it is not yours to see.
            </span>
          </Alert>
        ) : null}
        {tab === 'board' && ideas ? (
          <IdeaWorkspace
            rows={ideas.ideas}
            total={ideas.totalCount}
            boards={boards}
            statuses={board.lanes}
            tags={tags}
            board={{
              id: board.id,
              name: board.name,
              lanes: board.lanes,
              referenceBoards,
              isArchived: board.isArchived,
              canMove: moveDenial === null,
              canReorder: user.role === 'OrgAdmin',
            }}
            drawer={drawer}
            backlog={
              hasPanel && backlog
                ? { rows: backlog.ideas, total: backlog.totalCount, sprints }
                : null
            }
          />
        ) : null}
        {tab === 'backlog' && backlog ? (
          <>
            <BacklogList
              boardId={board.id}
              boardName={board.name}
              rows={backlog.ideas}
              total={backlog.totalCount}
              lanes={board.lanes}
              canSelect={canPlan}
              newTaskHref={newTaskHref}
              sprints={sprints}
              members={members}
            />
            {canAddTask ? (
              <NewTaskDrawer
                boardId={board.id}
                boardName={board.name}
                parents={parentChoices}
                members={members}
                tags={tags}
              />
            ) : null}
          </>
        ) : null}
        {tab === 'sprints' ? (
          <EmptyState heading="Sprint planning comes next">
            {sprints.length === 0
              ? 'This board has no sprints yet.'
              : `${sprints.length} sprint${sprints.length === 1 ? '' : 's'} on this board.`}{' '}
            The sprint list and planning page arrive in a later slice.
          </EmptyState>
        ) : null}
      </main>
    </>
  )
}
