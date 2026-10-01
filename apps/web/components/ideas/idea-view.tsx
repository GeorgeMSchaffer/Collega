import { Avatar } from '@collega/design-system'
import type { ReactNode } from 'react'
import type { IdeaDetail } from '@/lib/types'
import { CommentBox, FollowButton, UpvoteButton } from './engagement'
import { People, PriorityMarker, StatusMarker, TagList } from './idea-chips'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
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
}: {
  idea: IdeaDetail
  statusColor: string | undefined
  engagementDenial: string | null
  /** `followDenial(role)`: not the engagement denial, though today both refuse only a Site Admin. */
  followDenial: string | null
  /** False in the Issue drawer, which shows its delivery facts in their place. */
  facts?: boolean
}) {
  return (
    <>
      {facts ? (
        <dl className="m-0 grid grid-cols-2 gap-3 rounded-md bg-muted/60 p-3">
          <Fact label="Status">
            <StatusMarker name={idea.statusName} color={statusColor} />
          </Fact>
          <Fact label="Priority">
            <PriorityMarker priority={idea.priority} />
          </Fact>
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

      <Section title="Problem">
        <p className="m-0 whitespace-pre-line text-sm">{idea.problem}</p>
      </Section>
      <Section title="Proposed solutions">
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm">
          {idea.proposedSolutions.map((solution, index) => (
            // Solutions are ordered prose and may repeat, so position is their identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <li key={index}>{solution}</li>
          ))}
        </ol>
      </Section>
      <Section title="Impact rationale">
        <p className="m-0 whitespace-pre-line text-sm">{idea.impactRationale}</p>
      </Section>
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
                  className="mt-0.5 size-6 text-[10px]"
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
