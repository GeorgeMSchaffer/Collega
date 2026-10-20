import { Avatar, Dot, EffortBar, Meta } from '@collega/design-system'
import Link from 'next/link'
import { monthsOf } from '@/lib/outcome-display'
import type { MemberOption, OutcomeIdea, OutcomeWithIdeas, Status } from '@/lib/types'

export type StatusLookup = ReadonlyMap<string, Pick<Status, 'name' | 'color'>>
export type MemberLookup = ReadonlyMap<string, MemberOption>

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

/**
 * One grouped item as a row: key, title, its board status, effort and the first assignee. The key
 * is empty when the board has no prefix. The title opens the idea.
 */
function OutcomeIdeaRow({
  idea,
  statuses,
  members,
}: {
  idea: OutcomeIdea
  statuses: StatusLookup
  members: MemberLookup
}) {
  const status = statuses.get(idea.statusId)
  const assignee = members.get(idea.assigneeUserIds[0] ?? '')
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-sm">
      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
        {idea.itemKey ?? ''}
      </span>
      <Link
        href={`/ideas/${idea.id}`}
        className="min-w-0 flex-1 basis-40 truncate font-medium no-underline hover:underline"
      >
        {idea.title}
      </Link>
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Dot color={status?.color} />
        {status?.name ?? 'Unknown status'}
      </span>
      {idea.effort ? <EffortBar effort={idea.effort} /> : null}
      {assignee ? (
        <span className="inline-flex" title={assignee.name}>
          <Avatar initials={initialsOf(assignee.name)} />
          <span className="sr-only">{assignee.name}</span>
        </span>
      ) : (
        <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
          Unassigned
        </span>
      )}
    </li>
  )
}

/** The cards under the timeline, two to a row; one with more than two items spans the row. */
export function OutcomeCards({
  outcomes,
  statuses,
  members,
}: {
  outcomes: readonly OutcomeWithIdeas[]
  statuses: StatusLookup
  members: MemberLookup
}) {
  return (
    <ul
      aria-label="Outcomes"
      className="m-0 grid list-none grid-cols-1 gap-4 p-0 min-[900px]:grid-cols-2"
    >
      {outcomes.map((outcome) => {
        const pct =
          outcome.ideaCount === 0
            ? 0
            : Math.round((outcome.doneIdeaCount / outcome.ideaCount) * 100)
        return (
          <li
            key={outcome.id}
            className={`min-w-0 rounded-lg border bg-card ${outcome.ideas.length > 2 ? 'min-[900px]:col-span-2' : ''}`}
          >
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <Dot color={outcome.color} />
                <Link
                  href={`/delivery/outcomes/${outcome.id}`}
                  className="min-w-0 truncate font-semibold no-underline hover:underline"
                >
                  {outcome.name}
                </Link>
                <Meta caps className="ml-auto shrink-0">
                  {monthsOf(outcome.targetStartDate, outcome.targetEndDate)}
                </Meta>
              </div>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: outcome.color }}
                  />
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {outcome.doneIdeaCount} / {outcome.ideaCount}
                </span>
              </div>
            </div>
            {outcome.ideas.length === 0 ? (
              <p className="m-0 border-t px-4 py-3 text-sm text-muted-foreground">
                No issues grouped here yet.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {outcome.ideas.map((idea) => (
                  <OutcomeIdeaRow key={idea.id} idea={idea} statuses={statuses} members={members} />
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
