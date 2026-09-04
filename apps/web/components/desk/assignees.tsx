import { Avatar, AvatarFallback, AvatarStack } from "@collega/design-system";

import { assigneeName, initialsOf } from "@/lib/format";
import type { Assignee } from "@/lib/types";

/**
 * The first three assignees, ordered by first name then last, with `+N` for the rest.
 *
 * The visible mark is initials only, which is what comp Q renders and what fits a 288px
 * card; the spec's prose adds the first name beside each avatar, and that is a wider
 * treatment than the reference rendering allows here. The full names are not lost — they are
 * in the accessible text, and the inspector lists them in full.
 *
 * Every recorded idea in the corpus has an empty assignee list on the organization-wide
 * list and one or two on the board, so the overflow case is reachable from real data only
 * on the board.
 */
export function Assignees({ assignees }: { assignees: readonly Assignee[] }) {
  if (assignees.length === 0) {
    return <span className="text-sm text-muted-foreground">Unassigned</span>;
  }

  const ordered = [...assignees].sort(
    (a, b) =>
      (a.firstName ?? "").localeCompare(b.firstName ?? "") ||
      (a.lastName ?? "").localeCompare(b.lastName ?? ""),
  );
  const shown = ordered.slice(0, 3);
  const rest = ordered.length - shown.length;

  return (
    <span className="inline-flex items-center gap-1.5">
      <AvatarStack aria-label={`Assigned to ${ordered.map(assigneeName).join(", ")}`}>
        {shown.map((assignee) => (
          <Avatar key={assignee.userId}>
            <AvatarFallback>{initialsOf(assignee.firstName, assignee.lastName)}</AvatarFallback>
          </Avatar>
        ))}
      </AvatarStack>
      {rest > 0 ? <span className="text-xs text-muted-foreground">+{rest}</span> : null}
    </span>
  );
}
