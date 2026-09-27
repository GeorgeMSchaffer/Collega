import {
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { Topbar } from '@/components/nav/topbar'
import { getBoards } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { boardAdminDenial, currentUser } from '@/lib/session'

export const metadata = { title: 'Boards · Collega' }

export default async function BoardsPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  // One reader, and it already carries both counts. The page used to fetch every idea on every
  // board to call `.length` on them, which was free against a fixture and would have been a full
  // table scan per card against a database.
  const boards = await getBoards()
  const adminDenial = boardAdminDenial(currentUser().role)

  return (
    <>
      {/* No "New idea" here, by design: this screen chooses a board rather than acting on one, and
          an idea is always raised against a board. The list of boards *is* the chooser. The board
          actions are an Org Admin's, and every other role sees them disabled with the reason
          ("Denied is shown, not hidden", `SPEC/20-feature-client-ui.md`). */}
      <Topbar
        title="Boards"
        actions={
          <>
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
            <GatedAction id="why-new-board" label="New board" denial={adminDenial}>
              <Link href="/settings/boards/new" className={buttonVariants()}>
                New board
              </Link>
            </GatedAction>
          </>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
        <p className="m-0 max-w-2xl text-muted-foreground">
          Every board organizes the same organization&rsquo;s ideas by status. Open one to see its
          lanes.
        </p>
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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {boards.map((board) => (
              <Card key={board.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <CardTitle>
                    <Link href={`/boards/${board.id}`}>{board.name}</Link>
                  </CardTitle>
                  <GatedAction
                    id={`why-edit-${board.id}`}
                    label="Edit"
                    denial={adminDenial}
                    variant="ghost"
                    size="sm"
                  >
                    <Link
                      href={`/settings/boards/${board.id}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      aria-label={`Edit ${board.name}`}
                    >
                      Edit
                    </Link>
                  </GatedAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {/* A board has no "focus" column — that line was demo-seed copy. Rendered only
                      where one exists, rather than leaving an empty paragraph behind. */}
                  {board.focus ? (
                    <p className="m-0 text-sm text-muted-foreground">{board.focus}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">{board.ideaCount} ideas</span>
                    {/* Per board, not the size of the status catalog: a board chooses its lanes. */}
                    <span className="tabular-nums">{board.laneCount} lanes</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
