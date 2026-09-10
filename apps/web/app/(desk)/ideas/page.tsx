import { Button, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { GatedAction } from '@/components/common/gated-action'
import { IdeasTable } from '@/components/ideas/ideas-table'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { getFixtureBoards, getIdeas, getStatuses } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

export const metadata = { title: 'Ideas · Collega' }

export default async function IdeasPage() {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const [ideas, boards, statuses] = await Promise.all([
    getIdeas(),
    getFixtureBoards(),
    getStatuses(),
  ])

  return (
    <>
      <Topbar
        title="Ideas"
        actions={
          <>
            <Link href="/boards">
              <Button variant="outline">Lane view</Button>
            </Link>
            <Button variant="outline">Export CSV</Button>
            <NewIdeaButton id="why-new-ideas" />
          </>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>Ideas</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {ideas.length} ideas across every board in this organization. Open one to inspect it.
          </p>
        </div>
        {/* Unreachable against the fixture — there is no filter control yet — but this list is a
            filtered view by definition, so the empty answer is "nothing matched", never "nothing
            exists". Wired now so it is already right when filtering lands. */}
        {ideas.length === 0 ? (
          <EmptyState
            heading="No ideas match this filter"
            action={<GatedAction id="why-clear-filters" label="Clear filters" denial={null} />}
          >
            Try a different filter, or clear the search.
          </EmptyState>
        ) : (
          <IdeasTable rows={ideas} boards={boards} statuses={statuses} />
        )}
      </main>
    </>
  )
}
