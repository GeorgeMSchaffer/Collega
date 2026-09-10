import { Button, EmptyState } from '@collega/design-system'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GatedAction } from '@/components/common/gated-action'
import { IdeasTable } from '@/components/ideas/ideas-table'
import { NewIdeaForm } from '@/components/ideas/new-idea-form'
import { Topbar } from '@/components/nav/topbar'
import { getBoards, getIdeaOptions, getOrganizationIdeas } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, writeDenial } from '@/lib/session'

export const metadata = { title: 'Ideas · Collega' }

/** Anything that is not a page number past the first is the first page, including nothing at all. */
function requestedPage(raw: string | undefined): number {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { page: rawPage } = await searchParams

  // Whether this account may author at all. Read before the fetch because it decides whether two of
  // the three requests below are worth making — the catalogs exist only to fill the create form.
  const roleDenial = writeDenial(currentUser().role)

  // The board names, which no idea carries: a list item has a `boardId` and nothing else. One
  // request for the organization's boards, not one per row — and the same list the create form
  // picks a board from, since this screen spans every board and so has none in context.
  const [ideas, boards, options] = await Promise.all([
    getOrganizationIdeas(requestedPage(rawPage)),
    getBoards(),
    roleDenial ? { ideaTypes: [], businessImpacts: [] } : getIdeaOptions(),
  ])

  // A page past the end of the list is not a page of it. Reachable only by typing one, and 404 is
  // a better answer than an empty table under a footer claiming rows 41–60 of 22.
  if (ideas.page > 1 && ideas.ideas.length === 0) notFound()

  const { page, pageSize, totalCount } = ideas
  const pageCount = Math.ceil(totalCount / pageSize)
  const firstRow = (page - 1) * pageSize + 1

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
            {roleDenial ? (
              <GatedAction id="why-new-ideas" label="New idea" denial={roleDenial} />
            ) : (
              <NewIdeaForm boardId={null} boards={boards} options={options} />
            )}
          </>
        }
      />
      <main className="flex max-w-[1320px] min-w-0 flex-1 flex-col gap-4 p-6">
        <div>
          <h1>Ideas</h1>
          {totalCount > 0 ? (
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? 'idea' : 'ideas'} across every board in this
              organization, newest first. Open one to inspect it.
            </p>
          ) : null}
        </div>
        {/* Empty means empty, and says so. There is no filter control on this screen, so "nothing
            matched" would be a lie — and this is the answer a Site Admin gets every time, having no
            organization to list ideas from. */}
        {totalCount === 0 ? (
          <EmptyState
            heading="No ideas yet"
            // Only where the role may NOT author, for the reason the board's empty state gives: a
            // second live "New idea" would be a second copy of the same dialog, with the same
            // heading and the same field ids as the working one in the top bar. Where the role may
            // author, the copy points at that one instead.
            action={
              roleDenial ? (
                <GatedAction id="why-new-idea-empty" label="New idea" denial={roleDenial} />
              ) : undefined
            }
          >
            {roleDenial ? (
              <>An idea is raised on a board, against one of its idea types.</>
            ) : (
              <>
                An idea is raised on a board, against one of its idea types. Use &ldquo;New
                idea&rdquo; in the top bar to add the first one.
              </>
            )}
          </EmptyState>
        ) : (
          <>
            <IdeasTable rows={ideas.ideas} boards={boards} />
            {pageCount > 1 ? (
              <nav aria-label="Ideas pages" className="flex items-center justify-between gap-4">
                <p className="m-0 text-sm text-muted-foreground tabular-nums">
                  Showing {firstRow}&ndash;{firstRow + ideas.ideas.length - 1} of {totalCount}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link href={`/ideas?page=${page - 1}`}>
                      <Button variant="outline">Previous</Button>
                    </Link>
                  ) : null}
                  {page < pageCount ? (
                    <Link href={`/ideas?page=${page + 1}`}>
                      <Button variant="outline">Next</Button>
                    </Link>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </>
        )}
      </main>
    </>
  )
}
