import { buttonVariants, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { BoardCard } from '@/components/boards/board-card'
import { BoardTable } from '@/components/boards/board-table'
import { type BoardsView, ViewToggle } from '@/components/boards/view-toggle'
import { GatedAction } from '@/components/common/gated-action'
import { PageHeader } from '@/components/common/page-header'
import { Topbar } from '@/components/nav/topbar'
import { getBoardOverviews } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser } from '@/lib/session'

export const metadata = { title: 'Boards · Collega' }

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  // One request: the lane counts, top tags and creator all arrive on the board list item.
  const boards = await getBoardOverviews()
  const adminDenial = boardAdminDenial(currentUser().role)
  // Anything but `list` is the default, so a stale or mistyped link still lands somewhere useful.
  const view: BoardsView = (await searchParams).view === 'list' ? 'list' : 'cards'

  return (
    <>
      {/* No "New idea" here, by design: this screen chooses a board rather than acting on one, and
          an idea is always raised against a board. The list of boards *is* the chooser. The board
          actions are an Org Admin's, and every other role sees them disabled with the reason
          ("Denied is shown, not hidden", `SPEC/20-feature-client-ui.md`). */}
      <Topbar
        title={<b>Boards</b>}
        actions={
          <GatedAction
            id="why-manage-boards"
            label="Manage boards"
            denial={adminDenial}
            variant="outline"
          >
            <Link href="/settings/boards" className={buttonVariants({ variant: 'outline' })}>
              Manage boards
            </Link>
          </GatedAction>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
        <PageHeader
          title="Boards"
          description={
            <>
              Every board organizes the same organization&rsquo;s ideas by status. Open one to see
              its lanes.
            </>
          }
          action={
            <GatedAction id="why-new-board" label="Add New Board" denial={adminDenial}>
              <Link href="/settings/boards/new" className={buttonVariants()}>
                Add New Board
              </Link>
            </GatedAction>
          }
        />
        {boards.length === 0 ? null : (
          <div className="flex justify-end">
            <ViewToggle view={view} />
          </div>
        )}
        {boards.length === 0 ? (
          <EmptyState
            heading="No boards yet"
            action={
              <GatedAction id="why-create-board" label="Create a board" denial={adminDenial}>
                <Link href="/settings/boards/new" className={buttonVariants()}>
                  Create a board
                </Link>
              </GatedAction>
            }
          >
            An organization admin can create boards under Settings. A new organization starts with
            one default board and five statuses.
          </EmptyState>
        ) : view === 'list' ? (
          <BoardTable boards={boards} editDenial={adminDenial} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} editDenial={adminDenial} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
