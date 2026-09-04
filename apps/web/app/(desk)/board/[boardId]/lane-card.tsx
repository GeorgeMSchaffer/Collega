"use client";

import { Badge, cn } from "@collega/design-system";
import Link from "next/link";

import { Assignees } from "@/components/desk/assignees";
import { Marker } from "@/components/desk/marker";
import { PRIORITY_COLORS, daysAgo } from "@/lib/format";
import { useActivateOnSpace } from "@/lib/keys";
import type { IdeaListItem } from "@/lib/types";

/**
 * One card in a lane.
 *
 * Two rules from the Blazor board are load-bearing here. **Idea type is written as text**,
 * never encoded in a dot alone — that defect was found twice — and so are priority and
 * status, all three through the same `Marker`. And the **title is the control**: it is a link
 * because the surface it opens is addressable, it answers Space as well as Enter, and the
 * upvote count sits outside it rather than inside, because a button nested in a link is
 * neither reachable nor valid.
 *
 * Upvoting is a mutation and belongs to the engagement slice; the count is shown as a fact.
 */
export function LaneCard({
  idea,
  href,
  selected,
}: {
  idea: IdeaListItem;
  href: string;
  selected: boolean;
}) {
  const activateOnSpace = useActivateOnSpace();

  return (
    <article
      data-testid="lane-card"
      className={cn(
        "rounded-md border bg-card p-2.5 shadow-xs",
        selected && "bg-accent shadow-[inset_3px_0_0_0_var(--primary)]",
      )}
    >
      <Link
        href={href}
        onKeyDown={activateOnSpace}
        className="block text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {idea.title}
      </Link>

      <div className="mt-2 flex items-center gap-2">
        <Marker color={PRIORITY_COLORS[idea.priority]} className="text-xs">
          {idea.priority}
        </Marker>
        <span className="ml-auto">
          <Assignees assignees={idea.assignees} />
        </span>
      </div>

      {/* Idea type as text, never a colour-only dot: the defect this card exists to not
          repeat. Its configured colour is null throughout the corpus, so there is no dot to
          draw either way. */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{idea.ideaTypeName}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <path d="M5 1 9.3 8.5H.7Z" />
          </svg>
          {idea.upvoteCount}
          <span className="sr-only">upvotes</span>
        </span>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <ul className="m-0 flex min-w-0 list-none flex-wrap gap-1 p-0">
          {[...idea.tagNames].sort().slice(0, 3).map((tag) => (
            <li key={tag}>
              <Badge variant="outline">{tag}</Badge>
            </li>
          ))}
          {idea.tagNames.length > 3 ? (
            <li className="text-xs text-muted-foreground">+{idea.tagNames.length - 3}</li>
          ) : null}
        </ul>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{daysAgo(idea.createdAtUtc)}</span>
      </div>
    </article>
  );
}
