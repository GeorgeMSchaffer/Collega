import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IdeasTable } from '@/components/ideas/ideas-table'
import { IdeaInspector } from '@/components/inspector/idea-inspector'
import { Topbar } from '@/components/nav/topbar'
import { getBoards, getIdea, getOrganizationIdeas } from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'

/**
 * An idea open in the inspector.
 *
 * The third column lives here rather than in `(desk)/layout.tsx` — E2 owns that file and E3–E6
 * render into it. So this page splits its own content area, which keeps the ownership boundary
 * intact and means the inspector exists only on the route that has something to show.
 */
export async function generateMetadata({ params }: { params: Promise<{ ideaId: string }> }) {
  const { ideaId } = await params
  const idea = await getIdea(ideaId)
  // The title, not a reference: there is no reference (`lib/types.ts` says why), and the title is
  // what identifies the tab anyway.
  return { title: idea ? `${idea.title} · Collega` : 'Collega' }
}

export default async function IdeaPage({ params }: { params: Promise<{ ideaId: string }> }) {
  // Identity first, and in this segment — `lib/server/current-user.ts` says why every one.
  await requireCurrentUser()

  const { ideaId } = await params

  // The idea first and alone. An idea in another organization answers 404, and in a `Promise.all`
  // that would still cost a full list fetch for a page that is about to be `notFound()`.
  const idea = await getIdea(ideaId)
  if (!idea) notFound()

  // The first page of the same list `/ideas` shows, and the boards that name its rows. No status
  // catalog: a row carries its own status name, and the catalog is still fixture-backed, so joining
  // real ids against it would match nothing — `IdeasTable` renders a neutral swatch instead, which
  // is what it already does on `/ideas`.
  const [ideas, boards] = await Promise.all([getOrganizationIdeas(1), getBoards()])

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            <Link href="/ideas">Ideas</Link> /{' '}
            <b className="font-medium text-foreground">{idea.title}</b>
          </span>
        }
      />
      <div className="grid min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-w-0 p-6">
          <IdeasTable rows={ideas.ideas} boards={boards} selectedId={idea.id} />
        </main>
        <IdeaInspector idea={idea} closeHref="/ideas" />
      </div>
    </>
  )
}
