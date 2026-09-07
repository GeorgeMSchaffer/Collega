import { Dot } from '@collega/design-system'
import type { Idea, Status } from '@/lib/mock'
import { IdeaCard } from './idea-card'

export function Lane({ status, ideas }: { status: Status; ideas: Idea[] }) {
  return (
    <div className="w-72 shrink-0 rounded-lg border bg-muted/50 p-2">
      <div className="flex items-center gap-2 px-2 pt-1 pb-2">
        <Dot color={status.color} />
        <span className="font-medium">{status.name}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{ideas.length}</span>
      </div>
      {ideas.length === 0 ? (
        <div className="mb-1.5 rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
          No ideas
        </div>
      ) : (
        ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)
      )}
    </div>
  )
}
