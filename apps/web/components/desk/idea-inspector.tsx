"use client";

import {
  IdeaDetailInspector,
  type UnresolvedIdea,
} from "@/components/inspector/idea-detail";
import type { IdeaListItem, Status } from "@/lib/types";

export type { UnresolvedIdea };

/**
 * The docked column, opened from a row or a card.
 *
 * The body lives in `components/inspector`; this is the name the list and the board mount, and
 * it stays put so the two screens do not have to know which slice owns the inside.
 *
 * `ideaId` is what the column is *about*. It is separate from `idea` because the two do not
 * always come together: a deep link can name an idea the open list has no row for, and the
 * detail endpoint may still have a recording of it. Callers that only ever open a row they are
 * already holding can pass `idea` alone.
 */
export function IdeaInspector({
  idea = null,
  ideaId,
  boardName,
  status,
  onClose,
  rowsSettled,
  onUnresolved,
}: {
  idea?: IdeaListItem | null;
  ideaId?: string;
  boardName?: string;
  status?: Status;
  onClose: () => void;
  /** False while the list behind the column is still fetching the row this id might be in. */
  rowsSettled?: boolean;
  /** Stable callback: the column has nothing to show and the screen should close it. */
  onUnresolved?: (reason: UnresolvedIdea) => void;
}) {
  const id = ideaId ?? idea?.ideaId;
  if (id === undefined) return null;

  return (
    // Keyed by the idea, because the column is not a modal and the list behind it stays
    // clickable: without this, clicking row B while row A is open reuses A's component state.
    // A half-typed edit, a "delete?" confirmation and the "saved" notice would all survive the
    // change of subject, and the next Save or Delete would fire A's intent at B's endpoint.
    <IdeaDetailInspector
      key={id}
      ideaId={id}
      row={idea}
      boardName={boardName}
      status={status}
      onClose={onClose}
      rowsSettled={rowsSettled}
      onUnresolved={onUnresolved}
    />
  );
}
