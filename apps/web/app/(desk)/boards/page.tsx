import { Card, CardContent, CardHeader, CardTitle } from '@collega/design-system'
import Link from 'next/link'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { getBoards, getIdeasForBoard, getStatuses } from '@/lib/data'

export const metadata = { title: 'Boards · Collega' }

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
      </main>
    </>
  )
}
