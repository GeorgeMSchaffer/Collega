import { Button, Kbd } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lane } from '@/components/ideas/lane'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { boardById, currentUser, ideasForBoard, statuses, writeDenial } from '@/lib/mock'

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = boardById(boardId)
  if (!board) notFound()

  const boardIdeas = ideasForBoard(board.id)
  const canMove = writeDenial(currentUser.role) === null

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
            <Link href="/ideas">
              <Button variant="outline">List view</Button>
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
                <code className="font-mono text-xs">PATCH /ideas/&#123;id&#125;</code>, so neither
                is wired up until Wave D.
              </>
            ) : (
              <>Cards open read-only for your role, and nothing here can be moved.</>
            )}
          </p>
        </div>

        <div className="flex items-start gap-3 overflow-x-auto pb-3">
          {statuses.map((status) => (
            <Lane
              key={status.id}
              status={status}
              ideas={boardIdeas.filter((i) => i.statusId === status.id)}
            />
          ))}
        </div>
      </main>
    </>
  )
}
