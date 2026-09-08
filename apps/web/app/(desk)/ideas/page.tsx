import { Button } from '@collega/design-system'
import Link from 'next/link'
import { IdeasTable } from '@/components/ideas/ideas-table'
import { NewIdeaButton } from '@/components/ideas/new-idea-button'
import { Topbar } from '@/components/nav/topbar'
import { getBoards, getIdeas, getStatuses } from '@/lib/data'

export const metadata = { title: 'Ideas · Collega' }

export default async function IdeasPage() {
  const [ideas, boards, statuses] = await Promise.all([getIdeas(), getBoards(), getStatuses()])

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
        <IdeasTable rows={ideas} boards={boards} statuses={statuses} />
      </main>
    </>
  )
}
