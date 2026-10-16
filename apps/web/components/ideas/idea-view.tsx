import { Avatar } from '@collega/design-system'
import type { ReactNode } from 'react'
import type { IdeaDetail } from '@/lib/types'
import { CommentBox, FollowButton, UpvoteButton } from './engagement'
import { People, PriorityMarker, StatusMarker, TagList } from './idea-chips'

/** The board line of the drawer's facts: where the idea sits, or that it sits nowhere yet. */
export type BoardLine = {
  /** Null for an idea in the pool. */
  name: string | null
  archived: boolean
  /** Remove from board, when the reader is offered it. */
  action: ReactNode
}

export function BoardChip({ name }: { name: string | null }) {
  return name === null ? (
    <span className="inline-flex items-center rounded-full border border-dashed px-2 py-px text-xs font-semibold italic">
      No board
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border bg-secondary px-2 py-px text-xs font-semibold">
      {name}
    </span>
  )
}

function Fact({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2 min-w-0' : 'min-w-0'}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-0.5 flex flex-wrap items-center gap-1 text-sm font-medium">
        {children}
      </dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * The drawer's view mode (comp R): the facts, the three structured sections, the optional summary,
 * the Idea Type's custom fields, and the discussion the inspector carried — upvote, follow, thread
 * and composer, which comp R omits and the spec keeps.
 */
export function IdeaView({
  idea,
  statusColor,
  engagementDenial,
  followDenial,
  facts = true,
  boardLine,
}: {
  idea: IdeaDetail
  statusColor: string | undefined
  engagementDenial: string | null
  /** `followDenial(role)`: not the engagement denial, though today both refuse only a Site Admin. */
  followDenial: string | null
  /** False in the Issue drawer, which shows its delivery facts in their place. */
  facts?: boolean
  boardLine?: BoardLine | null | undefined
}) {
  return (
    <>
      {facts ? (
        <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3">
          {boardLine ? (
            <Fact label="Board" wide>
              <BoardChip name={boardLine.name} />
              {boardLine.archived ? (
                <span className="text-xs font-semibold text-warning">Board archived</span>
              ) : null}
              {boardLine.name === null ? (
                <span className="text-xs font-normal text-muted-foreground">
                  Waiting on the Ideas list. An Org Admin can pull it onto a board from the board
                  form.
                </span>
              ) : (
                boardLine.action
              )}
            </Fact>
          ) : null}
          <Fact label="Status">
            <StatusMarker name={idea.statusName} color={statusColor} />
          </Fact>
          {idea.priority ? (
            <Fact label="Priority">
              <PriorityMarker priority={idea.priority} />
            </Fact>
          ) : null}
          <Fact label="Business impact">{idea.businessImpact}</Fact>
          <Fact label="Idea type">{idea.ideaType}</Fact>
          <Fact label="Assignees">
            <People people={idea.assignees} />
            {idea.assignees.length > 0 ? (
              <span aria-hidden="true">{idea.assignees.map((p) => p.name).join(', ')}</span>
            ) : null}
          </Fact>
          <Fact label="Tags">
            {idea.tags.length > 0 ? <TagList tags={idea.tags} max={10} /> : '—'}
          </Fact>
          {idea.dueDate ? <Fact label="Due">{idea.dueDate}</Fact> : null}
        </dl>
      ) : null}

      {idea.problem ? (
        <Section title="Problem">
          <p className="m-0 whitespace-pre-line text-sm">{idea.problem}</p>
        </Section>
      ) : null}
      {idea.proposedSolutions.length > 0 ? (
        <Section title="Proposed solutions">
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm">
            {idea.proposedSolutions.map((solution, index) => (
              // Solutions are ordered prose and may repeat, so position is their identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <li key={index}>{solution}</li>
            ))}
          </ol>
        </Section>
      ) : null}
      {idea.impactRationale ? (
        <Section title="Impact rationale">
          <p className="m-0 whitespace-pre-line text-sm">{idea.impactRationale}</p>
        </Section>
      ) : null}
      {idea.description ? (
        <Section title="Summary">
          <p className="m-0 whitespace-pre-line text-sm">{idea.description}</p>
        </Section>
      ) : null}

      {idea.fieldValues.length > 0 ? (
        <Section title={`${idea.ideaType} fields`}>
          <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3">
            {idea.fieldValues.map((field) => (
              <Fact key={field.fieldDefinitionId} label={field.name}>
                {field.value}
              </Fact>
            ))}
          </dl>
        </Section>
      ) : null}

      <Section title={`Discussion${idea.comments.length > 0 ? ` (${idea.comments.length})` : ''}`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <UpvoteButton
              ideaId={idea.id}
              boardId={idea.boardId}
              count={idea.upvotes}
              hasUpvoted={idea.hasUpvoted}
              denial={engagementDenial}
            />
            <FollowButton
              ideaId={idea.id}
              boardId={idea.boardId}
              isFollowing={idea.isFollowing}
              followerCount={idea.followerCount}
              denial={followDenial}
            />
            <span className="text-xs text-muted-foreground">
              Raised {idea.createdOn}
              {idea.author ? ` by ${idea.author.name}` : null}
            </span>
          </div>
          {idea.comments.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            idea.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                {/* An author the API could not resolve is left unattributed rather than named. */}
                <Avatar
                  initials={comment.author?.initials ?? '—'}
                  className="mt-0.5 size-6 text-xs"
                />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    <b className="font-medium text-foreground">
                      {comment.author?.name ?? 'Unknown author'}
                    </b>{' '}
                    · {comment.postedOn}
                  </div>
                  <p className="m-0 whitespace-pre-line text-sm">{comment.body}</p>
                </div>
              </div>
            ))
          )}
          <CommentBox ideaId={idea.id} boardId={idea.boardId} denial={engagementDenial} />
        </div>
      </Section>
    </>
  )
}
