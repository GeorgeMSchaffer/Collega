"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ForRoles,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorDescription,
  InspectorHeader,
  InspectorTitle,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { IdeaForm, type IdeaFormValues } from "@/components/inspector/idea-form";
import { useReturnFocus } from "@/components/inspector/use-write";
import { useWorkspace } from "@/lib/workspace";

/**
 * Create, in the same docked column detail uses — comp P: *there is no create drawer*.
 *
 * The form is real: `POST /boards/{boardId}/ideas` is recorded at all four identities, so a
 * member gets a 201, a Read Only account and a Site Admin get the API's own 403 in its own
 * words, and the round trip is worth walking. What it cannot do is add a row — the corpus
 * replays a capture and keeps nothing — so the success notice says that rather than closing
 * the column onto a list that did not change, which would read as the create having failed.
 *
 * The refusal panel is shown, not hidden. `SPEC/20-feature-client-ui.md` (2026-09-02): a
 * Site Admin and a read-only account meet the reason, not an empty column.
 */
function NotAvailable({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <InspectorBody>
        <Alert variant="warning">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{children}</AlertDescription>
        </Alert>
        <div>
          <Button type="button" variant="outline" onClick={onClose}>
            Back to the list
          </Button>
        </div>
      </InspectorBody>
    </>
  );
}

export function CreateIdeaSurface({
  boardId,
  boardName,
  onClose,
}: {
  /** The board the idea lands on. Resolved from `boardName` when a caller has only that. */
  boardId?: string;
  boardName: string;
  onClose: () => void;
}) {
  useReturnFocus();
  const { organization, ideaTypes, boards } = useWorkspace();
  const [created, setCreated] = React.useState(false);

  // No falling back to "the first board". An idea created on the wrong board is silent — the
  // POST succeeds, the header prints a plausible name, and the idea is simply somewhere else.
  // An id is trusted; a name is matched only if exactly one board answers to it; anything else
  // resolves to nothing and the form does not open.
  const boardList = boards.data ?? [];
  const byName = boardList.filter((one) => one.name === boardName);
  const target = boardId
    ? boardList.find((one) => one.boardId === boardId)
    : byName.length === 1
      ? byName[0]
      : undefined;

  const [values, setValues] = React.useState<IdeaFormValues>({
    title: "",
    description: "",
    // Priority hard-defaults to Medium; idea type takes the first active option in sort
    // order; business impact is deliberately *not* defaulted from first-active, because the
    // seeded order puts Critical first and that would pre-mark every new idea Critical
    // (`20-feature-ideas-and-engagement.md`, Defaults, decoupled 2026-08-17).
    priority: "Medium",
    ideaTypeId: "",
    businessImpactId: "",
    statusId: "",
    dueDate: "",
    tagNames: [],
    assignees: [],
  });

  // Derived rather than synced into state: the organization's configuration arrives after the
  // first render, and writing it back through an effect would re-render the form to say what
  // it could already have said. A blank means "not chosen yet", so the default fills in until
  // the viewer picks something and their choice takes over from then on.
  //
  // Status is pointedly *not* defaulted. It is optional on create and the API puts an idea with
  // no status into the board's left-most swimlane; filling it in here would send one every time
  // and quietly replace that rule with this form's guess at it.
  const effective: IdeaFormValues = {
    ...values,
    ideaTypeId: values.ideaTypeId || (ideaTypes.find((type) => !type.isDeleted)?.ideaTypeId ?? ""),
  };

  return (
    <Inspector aria-label="New idea">
      <InspectorHeader>
        <div className="min-w-0">
          <InspectorTitle>New idea</InspectorTitle>
          <InspectorDescription>
            {target?.name ?? boardName}
            {organization?.title ? ` · ${organization.title}` : ""}
          </InspectorDescription>
        </div>
        <InspectorClose onClick={onClose} />
      </InspectorHeader>

      <ForRoles roles={["SiteAdmin"]}>
        <NotAvailable title="A Site Admin does not raise ideas directly" onClose={onClose}>
          Ideas are organization content. Use View As to act as a member of{" "}
          {organization?.title ?? "this organization"} and this form opens as normal.
        </NotAvailable>
      </ForRoles>

      <ForRoles roles={["ReadOnly"]}>
        <NotAvailable title="Read-only accounts cannot create ideas" onClose={onClose}>
          You can read every idea, vote on it and join its discussion, and raise none. Ask an administrator
          to change your role if that is wrong.
        </NotAvailable>
      </ForRoles>

      <ForRoles roles={["OrgAdmin", "User"]}>
        <InspectorBody>
          {created ? (
            <CorpusNote>
              the API accepted the idea and answered 201. A recording is not a database, so no row has
              appeared in the list behind this column — the create is real, the persistence is not.
            </CorpusNote>
          ) : null}

          {target === undefined ? (
            <CorpusNote>
              {boards.state === "loading"
                ? "the board list is still loading, so there is nowhere to put an idea yet."
                : `no single board here answers to “${boardName}”, so there is nowhere for an idea to ` +
                  "land. Creating it on whichever board came back first would put it somewhere nobody asked for."}
            </CorpusNote>
          ) : (
            <>
              <p className="m-0 text-sm leading-relaxed">
                A new idea lands on <strong>{target.name}</strong> in the left-most lane unless another
                status is chosen below.
              </p>
              <IdeaForm
                values={effective}
                onChange={setValues}
                onCancel={onClose}
                onSaved={() => setCreated(true)}
                submit={{ path: `/boards/${target.boardId}/ideas`, method: "POST" }}
                submitLabel="Create idea"
                busyLabel="Creating…"
                typeIsFixed={false}
                showStatus
              />
            </>
          )}
        </InspectorBody>
      </ForRoles>
    </Inspector>
  );
}
