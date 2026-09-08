import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { getBoards, getIdeasForBoard, getStatuses } from '@/lib/data'
import { currentUser } from '@/lib/session'

export const metadata = { title: 'Boards · Collega' }

/**
 * Not `writeDenial`: that answers whether a role may author an idea, and creating a board is an
 * administrator's write. A Site Admin is refused here for the usual reason — they belong to no
 * organization — while a member is refused for a different one, and the two must not be conflated.
 */
function createBoardDenial() {
  if (currentUser.role === 'OrgAdmin') return null
  if (currentUser.role === 'SiteAdmin') return 'Act as a member'
  return 'Administrators only'
}

export default async function BoardsPage() {
  const [boards, statuses] = await Promise.all([getBoards(), getStatuses()])
  const cards = await Promise.all(
    boards.map(async (board) => ({
      board,
      ideaCount: (await getIdeasForBoard(board.id)).length,
    })),
  )

  return (
    <>
      <Topbar title="Boards" actions={<NewIdeaButton id="why-new-boards" />} />
      <main className="flex max-w-[1320px] flex-col gap-6 p-6">
        <p className="m-0 max-w-2xl text-muted-foreground">
          Every board organizes the same organization&rsquo;s ideas by status. Open one to see its
          lanes.
        </p>
        {boards.length === 0 ? (
          <EmptyState
            heading="No boards yet"
            action={
              <GatedAction
                id="why-create-board"
                label="Create a board"
                denial={createBoardDenial()}
              />
            }
          >
            An organization admin can create boards under Settings. A new organization starts with
            one default board and five statuses.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map(({ board, ideaCount }) => (
              <Card key={board.id}>
                <CardHeader>
                  <CardTitle>
                    <Link href={`/boards/${board.id}`}>{board.name}</Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="m-0 text-sm text-muted-foreground">{board.focus}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">{ideaCount} ideas</span>
                    <span className="tabular-nums">{statuses.length} lanes</span>
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
