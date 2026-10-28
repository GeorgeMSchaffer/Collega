import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UsageViewed } from '@/components/analytics/usage-viewed'
import { SprintPlanning } from '@/components/boards/sprint-planning'
import { PageHeader } from '@/components/common/page-header'
import { Topbar } from '@/components/nav/topbar'
import { getBacklog, getBoard, getBoardSprints, getSprintTasks } from '@/lib/data'
import { schedulerFor } from '@/lib/roles'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const board = await getBoard(boardId)
  return { title: `Sprint planning · ${board?.name ?? 'Board'} · Collega` }
}

/** A board sprint's planning page (comp W screen 4), reached from the Sprints tab. */
export default async function SprintPlanningPage({
  params,
}: {
  params: Promise<{ boardId: string; sprintId: string }>
}) {
  await requireCurrentUser()
  const { boardId, sprintId } = await params

  const board = await getBoard(boardId)
  if (!board?.sprintsEnabled) notFound()
  const sprint = (await getBoardSprints(board.id)).find((candidate) => candidate.id === sprintId)
  if (!sprint) notFound()

  const user = currentUser()
  const scheduler = board.isArchived ? null : schedulerFor(user)
  const [backlog, tasks] = await Promise.all([
    scheduler && sprint.state !== 'Completed' ? getBacklog(board.id) : null,
    getSprintTasks(board.id, sprint.id),
  ])
  const sprintsHref = `/boards/${encodeURIComponent(board.id)}?tab=sprints`

  return (
    <>
      <UsageViewed type="list.viewed" props={{ list: 'sprint-planning' }} />
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/boards">Boards</Link> /{' '}
            <Link href={`/boards/${encodeURIComponent(board.id)}`}>{board.name}</Link> /{' '}
            <Link href={sprintsHref as '/'}>Sprints</Link> /{' '}
            <b className="font-medium text-foreground">{sprint.name}</b>
          </span>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title={sprint.name}
          description={`Plan the sprint on ${board.name}: add tasks from the Backlog, or take them back out.`}
        />
        <SprintPlanning
          boardId={board.id}
          organizationId={user.organizationId}
          sprint={sprint}
          backlog={backlog?.ideas ?? []}
          backlogTotal={backlog?.totalCount ?? 0}
          inSprint={tasks.ideas}
          lanes={board.lanes}
          scheduler={scheduler}
        />
      </main>
    </>
  )
}
