import { Alert, Avatar, Dot, Marker, Separator, Tag } from '@collega/design-system'
import Link from 'next/link'
import { getBoard, type IdeaDetail } from '@/lib/data'
import { currentUser, writeDenial } from '@/lib/session'
import { CloseOnEscape } from './close-on-escape'
import { CommentBox, UpvoteButton } from './engagement'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  )
}

/**
 * The docked inspector (comp Q `s-inspect`).
 *
 * **Docked, not modal** — it is a grid column beside the list, so the list stays live and
 * scrollable, two ideas can be compared by moving down it, and nothing needs `inert`. Do not
 * "improve" this into a dialog; the accessibility argument for the whole surface rests on it.
 *
 * Everything here comes off the idea itself except the board, which is one extra request and pays
 * for itself twice: it names the board in the eyebrow *and* carries the board's own swimlanes, so
 * the status dot takes its real colour from the lane the idea is actually in. The organization's
 * status catalog is not consulted and must not be — it is still fixture-backed, and a real
 * `statusId` matches none of its ids.
 */
export async function IdeaInspector({ idea, closeHref }: { idea: IdeaDetail; closeHref: string }) {
  const board = await getBoard(idea.boardId)
  const lane = board?.lanes.find((status) => status.id === idea.statusId)
  const editDenial = writeDenial(currentUser().role)

  return (
    <aside
      aria-label="Idea inspector"
      className="flex w-full flex-col border-l bg-card lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto"
    >
      <CloseOnEscape href={closeHref} />

      <div className="flex flex-col gap-1 border-b px-6 py-4">
        <div className="flex items-start gap-3">
          {/* Comp Q reads "Ideas board · #IDEA-118 · New / Pending". The middle term is gone: no
              column holds a reference and nothing here may invent one, so the eyebrow is the two
              facts that are real. */}
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
            {board?.name} board · {idea.statusName}
          </span>
          <Link
            href={closeHref}
            className="ml-auto text-sm text-muted-foreground no-underline hover:text-foreground"
            aria-label="Close inspector"
          >
            <span aria-hidden="true">✕</span>
          </Link>
        </div>
        <h2 className="text-lg font-semibold leading-tight">{idea.title}</h2>
        <div className="text-xs text-muted-foreground">
          {idea.author ? `Created by ${idea.author.name} · ` : null}
          {idea.createdOn} · {idea.priority} priority
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <p className="m-0 text-sm">{idea.description}</p>

        <div className="flex flex-wrap items-center gap-2">
          <UpvoteButton
            ideaId={idea.id}
            boardId={idea.boardId}
            count={idea.upvotes}
            hasUpvoted={idea.hasUpvoted}
          />
          {/* Nullable now that the tags are real: most seeded ideas carry none, and an empty chip
              beside the vote count reads as a tag whose name failed to load. */}
          {idea.tag ? <Tag>{idea.tag}</Tag> : null}
          {idea.assigneeInitials ? (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              Assigned <Avatar initials={idea.assigneeInitials} className="size-6 text-[10px]" />
            </span>
          ) : (
            <span className="ml-auto text-xs text-muted-foreground">Unassigned</span>
          )}
        </div>

        <Separator />

        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Classification
          </h3>
          <Row label="Status">
            <Marker>
              <Dot color={lane?.color} />
              {idea.statusName}
            </Marker>
          </Row>
          <Row label="Idea type">{idea.ideaType}</Row>
          <Row label="Business impact">{idea.businessImpact}</Row>
          <Row label="Priority">{idea.priority}</Row>
          <Row label="Board">{board?.name}</Row>
        </div>

        {editDenial ? (
          <p className="m-0 text-xs italic text-muted-foreground">
            {editDenial} — these values are read-only for your role.
          </p>
        ) : (
          <Alert variant="note">
            <span>
              Editing needs <code className="font-mono text-xs">PATCH /ideas/&#123;id&#125;</code>,
              which arrives with Wave D. The fields above are the read view until then.
            </span>
          </Alert>
        )}

        <Separator />

        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Discussion {idea.comments.length > 0 ? `(${idea.comments.length})` : ''}
          </h3>
          {idea.comments.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            idea.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                {/* An author the API could not resolve is left unattributed rather than given a
                    placeholder name — the comment is still real and still worth reading. */}
                <Avatar
                  initials={comment.author?.initials ?? '—'}
                  className="mt-0.5 size-6 text-[10px]"
                />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    <b className="font-medium text-foreground">
                      {comment.author?.name ?? 'Unknown author'}
                    </b>{' '}
                    · {comment.postedOn}
                  </div>
                  <p className="m-0 text-sm">{comment.body}</p>
                </div>
              </div>
            ))
          )}
          <CommentBox />
        </div>
      </div>
    </aside>
  )
}
