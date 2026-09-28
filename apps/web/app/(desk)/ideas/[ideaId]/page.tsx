import type { Route } from 'next'
import { redirect } from 'next/navigation'

/**
 * `/ideas/{ideaId}` is the idea's address — notification links carry it — and resolves to the Ideas
 * list with that idea's drawer open (`SPEC/20-feature-client-ui.md`, "List and detail pattern").
 * The list page reads the id, so an idea the reader cannot open is reported there.
 */
export default async function IdeaPage({ params }: { params: Promise<{ ideaId: string }> }) {
  const { ideaId } = await params
  redirect(`/ideas?idea=${encodeURIComponent(ideaId)}` as Route)
}
