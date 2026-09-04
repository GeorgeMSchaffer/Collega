"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DeniedAction,
  ForRoles,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorDescription,
  InspectorFooter,
  InspectorHeader,
  InspectorTitle,
  Separator,
  Skeleton,
} from "@collega/design-system";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
import { CorpusNote } from "@/components/desk/notices";
import { Discussion } from "@/components/inspector/discussion";
import { Fact, NotRecorded } from "@/components/inspector/fields";
import { IdeaForm, type IdeaFormValues } from "@/components/inspector/idea-form";
import { REFUSALS } from "@/components/inspector/refusals";
import { useReturnFocus, useWrite } from "@/components/inspector/use-write";
import { pathWasSubstituted, useApi } from "@/lib/api";
import { PRIORITY_COLORS, assigneeName, daysAgo, shortDate } from "@/lib/format";
import type { Assignee, IdeaDetail, IdeaListItem, Member, Priority, Status } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/**
 * The idea detail, docked beside the list or the board.
 *
 * **Two payloads describe an idea and neither one is enough.** The list row carries
 * `authorUserId` and `createdAtUtc` and no description; `GET /ideas/{ideaId}` carries the
 * description and neither of those. Worse, that endpoint was recorded against a single idea —
 * "Golden capture idea", which is in no list in the corpus — so asking it about any other idea
 * comes back `x-collega-mock-match: substituted`: a real recording, of the wrong idea. Unit 4
 * dodged this by never calling it. This calls it and then reads the header: an exact match is
 * this idea and is used in full, a substitution is discarded and the list row stands alone,
 * with the description slot saying what is missing rather than showing a plausible sentence.
 *
 * The upshot is a screen that is right about two different ideas for two different reasons —
 * the golden idea has a description and no author, every listed idea has an author and no
 * description — and says which it is looking at either way. That is the point: the shape of
 * the hole is what the next slice has to plan around.
 *
 * It is a column, not a modal. Nothing behind it is inert, focus is never trapped, and closing
 * it — by Escape, the X or Cancel — puts focus back on the row or button that opened it.
 */

/** Why the column has nothing to show, handed back to the screen that opened it. */
export interface UnresolvedIdea {
  /**
   * Three different facts, which must not be shown as one:
   *  - `refused` — the API said no. Product behaviour, and retrying will not help.
   *  - `failed` — the request broke. Retrying is safe.
   *  - `not-recorded` — nothing in the capture answers for this id. Scaffolding, not product.
   */
  readonly kind: "refused" | "failed" | "not-recorded";
  readonly title: string;
  readonly detail: string;
}

interface IdeaView {
  readonly ideaId: string;
  readonly boardId: string;
  readonly title: string;
  readonly priority: Priority;
  readonly ideaTypeId: string;
  readonly ideaTypeName: string;
  readonly ideaTypeColorHex: string | null;
  readonly businessImpactId: string | null;
  readonly businessImpactName: string | null;
  readonly businessImpactColor: string | null;
  readonly dueDate: string | null;
  readonly assignees: readonly Assignee[];
  readonly tagNames: readonly string[];
  readonly statusId: string;
  readonly statusName: string;
  readonly upvoteCount: number;
  readonly hasUpvoted: boolean;
  readonly commentCount: number;
  /** List row only. */
  readonly authorUserId: string | null;
  readonly createdAtUtc: string | null;
  /** Detail payload only, and only when the recording was of this idea. */
  readonly description: string | null;
}

/**
 * One view of an idea from whichever of the two payloads are in hand.
 *
 * Merged rather than chosen between. The detail payload is the fresher and fuller answer, so it
 * wins every field it carries — but it carries neither `authorUserId` nor `createdAtUtc`, and
 * those come from the row. Picking one payload outright would mean that once the real API is
 * behind this, where the detail call is exact for *every* idea, "Created by" and "Raised" would
 * read "Not in this payload" on every screen even though the row beside it holds both.
 */
function viewOf(row: IdeaListItem | null, detail: IdeaDetail | null): IdeaView | null {
  if (detail) {
    return {
      ...detail,
      authorUserId: row?.authorUserId ?? null,
      createdAtUtc: row?.createdAtUtc ?? null,
    };
  }
  return row ? { ...row, description: null } : null;
}

function toFormValues(view: IdeaView): IdeaFormValues {
  return {
    title: view.title,
    description: view.description ?? "",
    priority: view.priority,
    ideaTypeId: view.ideaTypeId,
    businessImpactId: view.businessImpactId ?? "",
    statusId: view.statusId,
    dueDate: view.dueDate ? view.dueDate.slice(0, 10) : "",
    tagNames: [...view.tagNames],
    assignees: [...view.assignees],
  };
}

function DangerZone({ ideaId, onDeleted }: { ideaId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = React.useState(false);
  const remove = useWrite(`/ideas/${ideaId}`, "DELETE");

  return (
    <section aria-labelledby={`danger-${ideaId}`}>
      <Separator className="mb-4" />
      <h3 id={`danger-${ideaId}`} className="m-0 text-sm font-semibold text-destructive">
        Danger zone
      </h3>

      <ForRoles roles={["OrgAdmin"]}>
        {confirming ? (
          <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="m-0 text-sm">Delete this idea? This cannot be undone.</p>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={remove.state === "running"}
                onClick={() => void remove.run().then((result) => result && onDeleted())}
              >
                {remove.state === "running" ? "Deleting…" : "Yes, delete it"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-2"
            onClick={() => setConfirming(true)}
          >
            Delete idea
          </Button>
        )}
      </ForRoles>

      {/* A member cannot delete even an idea they raised — `ideas.delete.own.user` is a
          recorded 403, which is narrower than the general idea-edit permission. */}
      <ForRoles roles={["User"]}>
        <div className="mt-2">
          <DeniedAction reason={REFUSALS.memberDelete}>
            {(denied) => (
              <Button type="button" variant="destructive" size="sm" {...denied}>
                Delete idea
              </Button>
            )}
          </DeniedAction>
        </div>
      </ForRoles>
      <ForRoles roles={["ReadOnly"]}>
        <div className="mt-2">
          <DeniedAction reason={REFUSALS.readOnlyDelete}>
            {(denied) => (
              <Button type="button" variant="destructive" size="sm" {...denied}>
                Delete idea
              </Button>
            )}
          </DeniedAction>
        </div>
      </ForRoles>
      <ForRoles roles={["SiteAdmin"]}>
        <div className="mt-2">
          <DeniedAction reason={REFUSALS.siteAdminDelete}>
            {(denied) => (
              <Button type="button" variant="destructive" size="sm" {...denied}>
                Delete idea
              </Button>
            )}
          </DeniedAction>
        </div>
      </ForRoles>

      {remove.error ? (
        <Alert variant={remove.error.isRefusal ? "warning" : "destructive"} className="mt-2">
          <AlertTitle>{remove.error.problem?.title ?? "The idea was not deleted"}</AlertTitle>
          <AlertDescription>{remove.error.problem?.detail ?? "Nothing was changed."}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

export function IdeaDetailInspector({
  ideaId,
  row,
  boardName,
  status,
  onClose,
  rowsSettled = true,
  onUnresolved,
}: {
  ideaId: string;
  /** The recorded list row, when the open list holds one for this id. */
  row: IdeaListItem | null;
  boardName?: string;
  status?: Status;
  onClose: () => void;
  /**
   * False while the list behind this column is still fetching its rows. Without it the two
   * requests race: the detail call can settle first, and a column that concluded "no such
   * idea" from `row === null` would be deciding that before the row had a chance to arrive.
   */
  rowsSettled?: boolean;
  /**
   * Called once the column has established that there is no idea here to show. Must be stable
   * across renders — it is an effect dependency.
   */
  onUnresolved?: (reason: UnresolvedIdea) => void;
}) {
  useReturnFocus();
  const { organizationId, statuses, boards } = useWorkspace();
  const [mode, setMode] = React.useState<"read" | "edit">("read");
  const [form, setForm] = React.useState<IdeaFormValues | null>(null);
  const [saved, setSaved] = React.useState<"saved" | "deleted" | null>(null);

  const detail = useApi<IdeaDetail>(`/ideas/${ideaId}`);
  const members = useApi<Member[]>(organizationId ? `/organizations/${organizationId}/members` : null);

  // A recording of a *different* idea is worse than no recording: it reads as an answer.
  const detailIsThisIdea =
    detail.state === "ready" && detail.data !== null && !pathWasSubstituted(detail.mock);
  const view: IdeaView | null = viewOf(row, detailIsThisIdea ? detail.data : null);

  const memberList = members.data ?? [];
  const author = view?.authorUserId
    ? memberList.find((one) => one.userId === view.authorUserId)
    : undefined;
  const resolvedStatus = status ?? statuses.find((one) => one.statusId === view?.statusId);
  const resolvedBoard =
    boardName ?? (boards.data ?? []).find((one) => one.boardId === view?.boardId)?.name ?? "Unknown board";

  // `SPEC/20-feature-client-ui.md`: "an inaccessible id shows a not-found/permission notice
  // without an inspector". Once the fetch has settled with nothing to show, the column must go
  // — the screen it is docked to puts the notice on the page instead. Until then the column
  // holds its place with a skeleton rather than flashing open and shut.
  //
  // The three ways to get here are different facts and are not reported as one. A refusal is
  // the product working; a failed request is worth retrying; and neither should be described as
  // a gap in the corpus, which is what the third case — and only the third case — is.
  // Memoised because it is an effect dependency.
  const unresolvable = view === null && detail.state !== "loading" && rowsSettled;
  const error = detail.error;
  const reason = React.useMemo<UnresolvedIdea>(() => {
    if (error?.isRefusal) {
      return {
        kind: "refused",
        title: error.problem?.title ?? "You cannot open this idea",
        detail: error.problem?.detail ?? "The API refused this request for your role.",
      };
    }
    if (error && !error.isMockGap) {
      return {
        kind: "failed",
        title: "That idea could not be loaded",
        detail: `Nothing has been changed and retrying is safe. The API said: ${error.message}`,
      };
    }
    return {
      kind: "not-recorded",
      title: "That idea is not here",
      // Deliberately about what this session could resolve rather than about the list, which
      // may itself have failed to load — blaming the capture for a broken request would be a
      // confident wrong answer.
      detail:
        `Nothing here could resolve ${ideaId}: no row for it is open on this page, and the detail ` +
        "endpoint answered with a recording of a different idea. There is nothing to open.",
    };
  }, [error, ideaId]);
  React.useEffect(() => {
    if (unresolvable) onUnresolved?.(reason);
  }, [unresolvable, reason, onUnresolved]);

  if (view === null) {
    return (
      <Inspector aria-label="Idea">
        <InspectorHeader>
          <div className="min-w-0">
            <InspectorTitle>Loading idea…</InspectorTitle>
          </div>
          <InspectorClose onClick={onClose} />
        </InspectorHeader>
        <InspectorBody>
          <span className="sr-only">Loading</span>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </InspectorBody>
      </Inspector>
    );
  }

  const startEditing = () => {
    setForm(toFormValues(view));
    setSaved(null);
    setMode("edit");
  };

  return (
    <Inspector aria-label={`Idea: ${view.title}`}>
      <InspectorHeader>
        <div className="min-w-0">
          <InspectorTitle>{view.title}</InspectorTitle>
          <InspectorDescription>
            {/* Comp Q's eyebrow carries a #IDEA-{n} reference between the board and the status.
                No such number exists anywhere in the corpus or the contracts, so it is not
                drawn — a made-up identifier is the one thing worse than a missing one. */}
            {resolvedBoard} · {view.statusName}
            {view.createdAtUtc ? ` · raised ${daysAgo(view.createdAtUtc)}` : ""}
          </InspectorDescription>
        </div>
        <InspectorClose onClick={onClose} />
      </InspectorHeader>

      <InspectorBody>
        {saved === "deleted" ? (
          <CorpusNote>
            the API accepted the delete and answered 204. A recording is not a database, so the idea is
            still in the list behind this column — the authorization is real, the persistence is not.
          </CorpusNote>
        ) : null}
        {saved === "saved" ? (
          <CorpusNote>
            the API accepted the edit. The values below are still the recorded ones: the corpus replays a
            capture and does not keep what was written to it.
          </CorpusNote>
        ) : null}

        {mode === "edit" && form ? (
          <IdeaForm
            values={form}
            onChange={setForm}
            onCancel={() => setMode("read")}
            onSaved={() => {
              setSaved("saved");
              setMode("read");
            }}
            submit={{ path: `/ideas/${ideaId}`, method: "PUT" }}
            submitLabel="Save changes"
            busyLabel="Saving…"
            typeIsFixed
            showStatus={false}
            descriptionNote={
              view.description === null
                ? "The list row carries no description, so this starts empty rather than showing one that was never captured."
                : undefined
            }
          />
        ) : (
          <>
            {/* Keyed off the panel's own width, which the viewer can drag, rather than the
                viewport's — see the note on the form. Dragged narrow, the facts stack. The
                query has to live on a descendant of the container, so the `dl` gets a wrapper
                rather than declaring itself. */}
            <div className="@container">
              {/* 17rem, not the `@xs` (20rem) step: the docked column is 28% of the area beside
                  the sidebar, which at 1440 leaves about 283px of content — under `@xs`, so the
                  named step would drop comp Q's two-column facts grid at the default width and
                  only restore it if somebody widened the panel. */}
              <dl className="m-0 grid grid-cols-1 gap-4 @min-[17rem]:grid-cols-2">
                <Fact label="Status">
                  <Marker wrap color={resolvedStatus?.color}>
                    {view.statusName}
                  </Marker>
                </Fact>
                <Fact label="Priority">
                  <Marker wrap color={PRIORITY_COLORS[view.priority]}>
                    {view.priority}
                  </Marker>
                </Fact>
                <Fact label="Idea type">
                  <Marker wrap color={view.ideaTypeColorHex}>
                    {view.ideaTypeName}
                  </Marker>
                </Fact>
                <Fact label="Business impact">
                  {view.businessImpactName ? (
                    <Marker wrap color={view.businessImpactColor}>
                      {view.businessImpactName}
                    </Marker>
                  ) : (
                    <NotRecorded>Not set</NotRecorded>
                  )}
                </Fact>
                <Fact label="Due date">
                  {view.dueDate ? shortDate(view.dueDate) : <NotRecorded>None</NotRecorded>}
                </Fact>
                <Fact label="Raised">
                  {view.createdAtUtc ? (
                    shortDate(view.createdAtUtc)
                  ) : (
                    <NotRecorded>Not in this payload</NotRecorded>
                  )}
                </Fact>
                <Fact label="Created by">
                  {author ? (
                    `${author.firstName} ${author.lastName}`
                  ) : view.authorUserId ? (
                    <NotRecorded>Not in the member list</NotRecorded>
                  ) : (
                    <NotRecorded>Not in this payload</NotRecorded>
                  )}
                </Fact>
                <Fact label="Assignees">
                  {view.assignees.length > 0 ? (
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {view.assignees.map((assignee) => (
                        <li key={assignee.userId}>
                          <Badge variant="secondary">{assigneeName(assignee)}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <NotRecorded>Unassigned</NotRecorded>
                  )}
                </Fact>
                <Fact label="Tags" wide>
                  {view.tagNames.length > 0 ? (
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {[...view.tagNames].sort().map((tag) => (
                        <li key={tag}>
                          <Badge variant="outline">{tag}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <NotRecorded>None</NotRecorded>
                  )}
                </Fact>
              </dl>
            </div>

            {/* Comp Q puts custom fields here, between the facts and the description. The
                section is kept and its contents are not invented:
                `GET /organizations/{id}/field-definitions` is a recorded empty array and the
                one recorded idea's `fieldValues` is empty too, so there is nothing to draw. */}
            <section aria-labelledby={`fields-${ideaId}`}>
              <Separator className="mb-4" />
              <h3 id={`fields-${ideaId}`} className="m-0 text-sm font-semibold">
                Custom fields
              </h3>
              <CorpusNote className="mt-2">
                this organization has none. Its field definitions were captured as an empty list, so there
                are no values to show and no shape to guess at.
              </CorpusNote>
            </section>

            <section aria-labelledby={`description-${ideaId}`}>
              <Separator className="mb-4" />
              <h3 id={`description-${ideaId}`} className="m-0 text-sm font-semibold">
                Description
              </h3>
              {view.description ? (
                <p className="m-0 mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{view.description}</p>
              ) : (
                <CorpusNote className="mt-2">
                  a description lives only on <code>GET /ideas/{"{ideaId}"}</code>, which the capture
                  recorded against one idea and not this one. The list row this column is built from has no
                  description field at all, so there is none to show — and writing something plausible here
                  is exactly what this screen exists to avoid.
                </CorpusNote>
              )}
            </section>

            {/* The key carries the *source*, not just the id. The column paints from the row
                first and swaps to the detail payload when an exact one lands, and the two can
                disagree on the tally — the vote control seeds from its props once, so it has to
                be remounted when the numbers underneath it change origin. */}
            <Discussion
              key={`${ideaId}:${detailIsThisIdea ? "detail" : "row"}`}
              ideaId={ideaId}
              commentCount={view.commentCount}
              upvoteCount={view.upvoteCount}
              hasUpvoted={view.hasUpvoted}
              members={memberList}
            />

            <DangerZone ideaId={ideaId} onDeleted={() => setSaved("deleted")} />
          </>
        )}
      </InspectorBody>

      {mode === "read" ? (
        <InspectorFooter>
          <ForRoles roles={["OrgAdmin", "User"]}>
            <Button type="button" onClick={startEditing}>
              Edit idea
            </Button>
          </ForRoles>
          <ForRoles roles={["SiteAdmin"]}>
            <DeniedAction reason={REFUSALS.siteAdminEdit}>
              {(denied) => (
                <Button type="button" {...denied}>
                  Edit idea
                </Button>
              )}
            </DeniedAction>
          </ForRoles>
          <ForRoles roles={["ReadOnly"]}>
            <DeniedAction reason={REFUSALS.readOnlyEdit}>
              {(denied) => (
                <Button type="button" {...denied}>
                  Edit idea
                </Button>
              )}
            </DeniedAction>
          </ForRoles>
          <Button type="button" variant="outline" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </InspectorFooter>
      ) : null}
    </Inspector>
  );
}
