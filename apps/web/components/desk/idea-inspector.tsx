"use client";

import {
  Badge,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorDescription,
  InspectorHeader,
  InspectorTitle,
} from "@collega/design-system";

import { Marker } from "@/components/desk/marker";
import { PRIORITY_COLORS, assigneeName, daysAgo, shortDate } from "@/lib/format";
import type { IdeaListItem, Status } from "@/lib/types";

/**
 * The docked column, opened from a row or a card.
 *
 * It shows what the list payload already carries and asks the API for nothing further —
 * deliberately. `GET /ideas/{ideaId}` is recorded against exactly one id, so fetching the
 * selected idea would answer about idea A with the recording of idea B for all but one row.
 * The list row is a real recording of *this* idea, so that is what is shown.
 *
 * The read view, the Edit action, description, comments and the full field set belong to the
 * idea-detail slice, which replaces this body and keeps the column.
 */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-0.5 min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function IdeaInspector({
  idea,
  boardName,
  status,
  onClose,
}: {
  idea: IdeaListItem;
  boardName: string;
  status: Status | undefined;
  onClose: () => void;
}) {
  return (
    <Inspector aria-label={`Idea: ${idea.title}`}>
      <InspectorHeader>
        <div className="min-w-0">
          <InspectorTitle>{idea.title}</InspectorTitle>
          <InspectorDescription>
            {boardName} · {idea.statusName} · raised {daysAgo(idea.createdAtUtc)}
          </InspectorDescription>
        </div>
        <InspectorClose onClick={onClose} />
      </InspectorHeader>
      <InspectorBody>
        <dl className="m-0 grid grid-cols-2 gap-4">
          <Fact label="Status">
            <Marker color={status?.color}>{idea.statusName}</Marker>
          </Fact>
          <Fact label="Priority">
            <Marker color={PRIORITY_COLORS[idea.priority]}>{idea.priority}</Marker>
          </Fact>
          <Fact label="Idea type">
            <Marker color={idea.ideaTypeColorHex}>{idea.ideaTypeName}</Marker>
          </Fact>
          <Fact label="Business impact">
            {idea.businessImpactName ? (
              <Marker color={idea.businessImpactColor}>{idea.businessImpactName}</Marker>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </Fact>
          <Fact label="Due date">
            {idea.dueDate ? shortDate(idea.dueDate) : <span className="text-muted-foreground">None</span>}
          </Fact>
          <Fact label="Raised">{shortDate(idea.createdAtUtc)}</Fact>
          <Fact label="Upvotes">{idea.upvoteCount}</Fact>
          <Fact label="Comments">{idea.commentCount}</Fact>
        </dl>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Assignees</p>
          {idea.assignees.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {idea.assignees.map((assignee) => (
                <li key={assignee.userId}>
                  <Badge variant="secondary">{assigneeName(assignee)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">Unassigned</p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tags</p>
          {idea.tagNames.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {[...idea.tagNames].sort().map((tag) => (
                <li key={tag}>
                  <Badge variant="outline">{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">None</p>
          )}
        </div>

        <p className="m-0 rounded-lg border border-dashed bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          Description, discussion, editing and the admin actions land in this column with the
          idea-detail slice. Everything above is the recorded list row for this idea.
        </p>
      </InspectorBody>
    </Inspector>
  );
}
