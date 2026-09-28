import { loadIssueDrawer } from '@/components/delivery/load-issue-drawer'
import { SprintBoard } from '@/components/delivery/sprint-board'
import { Topbar } from '@/components/nav/topbar'
import { getBacklogIssues, getBoardSprint, getIssuesInSprint, getMemberOptions } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, deliveryAdminDenial } from '@/lib/session'

export const metadata = { title: 'Sprint board · Collega' }

export default async function SprintBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const user = currentUser()
  const adminDenial = deliveryAdminDenial(user.role)
  const [sprint, query] = await Promise.all([getBoardSprint(), searchParams])

  const [issues, waiting, members] = await Promise.all([
    sprint ? getIssuesInSprint(sprint.id) : [],
    // The empty state names how many issues are waiting, from the same query the backlog runs.
    sprint ? [] : getBacklogIssues(),
    adminDenial === null ? getMemberOptions() : [],
  ])
  const { drawer, editing, missing } = await loadIssueDrawer(query, issues)

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Delivery / <b className="font-medium text-foreground">Sprint board</b>
          </span>
        }
      />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <SprintBoard
          sprint={sprint}
          issues={issues}
          backlogCount={waiting.length}
          organizationId={user.organizationId}
          organizationName={user.organizationName}
          adminDenial={adminDenial}
          members={members}
          drawer={drawer}
          editing={editing}
          missing={missing}
        />
      </main>
    </>
  )
}
