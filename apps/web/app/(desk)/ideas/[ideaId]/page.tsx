import { notFound } from 'next/navigation'
import { IdeasTable } from '@/components/ideas/ideas-table'
import { IdeaInspector } from '@/components/inspector/idea-inspector'
import { Topbar } from '@/components/nav/topbar'
import { ideaById, ideas } from '@/lib/mock'

/**
 * An idea open in the inspector.
 *
 * The third column lives here rather than in `(desk)/layout.tsx` — E2 owns that file and E3–E6
 * render into it. So this page splits its own content area, which keeps the ownership boundary
 * intact and means the inspector exists only on the route that has something to show.
 */
export async function generateMetadata({ params }: { params: Promise<{ ideaId: string }> }) {
  const { ideaId } = await params
  const idea = ideaById(ideaId)
  return { title: idea ? `${idea.reference} ${idea.title} · Collega` : 'Collega' }
}

export default async function IdeaPage({ params }: { params: Promise<{ ideaId: string }> }) {
  const { ideaId } = await params
  const idea = ideaById(ideaId)
  if (!idea) notFound()

  return (
    <>
      <Topbar
        title={
          <span className="text-sm font-normal text-muted-foreground">
            Ideas / <b className="font-medium text-foreground">{idea.reference}</b>
          </span>
        }
      />
      <div className="grid min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-w-0 p-6">
          <IdeasTable rows={ideas} selectedId={idea.id} />
        </main>
        <IdeaInspector idea={idea} closeHref="/ideas" />
      </div>
    </>
  )
}
