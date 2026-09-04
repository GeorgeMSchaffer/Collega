"use client";

/**
 * Idea types, at `/settings/idea-types` and `/settings/organizations/{orgId}/idea-types`.
 *
 * Every idea is exactly one type, chosen at creation, and a type carries its own selection
 * of the organization's fields — which is why this screen and Fields are separate: one owns
 * what exists, the other owns what each type uses.
 *
 * **What the corpus can show.** Every recorded type has `fieldMode: "AllActiveFields"` and an
 * empty `fields` array, so the *"n fields (m required)"* column comp P draws has nothing
 * behind it here. Rather than print "0 fields" — which would read as a misconfiguration
 * instead of a mode — the column renders the mode, and the note says the selected-fields case
 * was never captured.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  TableCell,
  TableRow,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { Marker } from "@/components/desk/marker";
import { useApi } from "@/lib/api";
import type { Role } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import { Cols, Guarded, ReadOnlyAside, SubmitOutcome, SubstitutionNote } from "@/app/(desk)/settings/_components/chrome";
import { NarrowedNote, SearchField, useListFrame } from "@/app/(desk)/settings/_components/list-frame";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { mayMutate } from "@/app/(desk)/settings/_lib/rules";
import type { IdeaTypeAdmin } from "@/app/(desk)/settings/_lib/types";

function matches(type: IdeaTypeAdmin, needle: string): boolean {
  return type.name.toLowerCase().includes(needle);
}

/** What a type's field selection amounts to, in the two modes the API has. */
function fieldSummary(type: IdeaTypeAdmin): string {
  if (type.fieldMode === "AllActiveFields") return "Every active field in the organization";
  const required = type.fields.filter((field) => field.isRequired).length;
  return `${type.fields.length} chosen (${required} required)`;
}

export function IdeaTypesScreen({
  role,
  organizationId,
  organizationName,
  override,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  override: "empty" | "loading" | "error" | null;
}) {
  const mutable = mayMutate(role, "org-content");
  const types = useApi<IdeaTypeAdmin[]>(
    organizationId ? `/organizations/${organizationId}/idea-types` : null,
  );
  const create = useSubmit<IdeaTypeAdmin>();
  const [name, setName] = React.useState("");

  const items = React.useMemo(
    () => [...(types.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [types.data],
  );
  const frame = useListFrame({
    items,
    loading: types.state === "loading",
    error: types.state === "error",
    matches,
    override,
  });

  const everyTypeTakesAllFields =
    items.length > 0 && items.every((type) => type.fieldMode === "AllActiveFields");

  return (
    <>
      <SubstitutionNote mock={types.mock} what="idea types" className="mb-4" />

      <SearchField
        id="settings-idea-types-search"
        placeholder="Search idea types…"
        value={frame.search}
        onChange={frame.setSearch}
      />

      {frame.narrowed ? (
        <NarrowedNote
          shown={frame.visible.length}
          total={items.length}
          noun="idea types"
          className="mb-4"
        />
      ) : null}

      <Cols
        aside={
          mutable ? (
            <Card>
              <CardContent>
                <h2 className="m-0 mb-4 text-lg font-semibold tracking-tight">New idea type</h2>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!organizationId) return;
                    void create.send("POST", `/organizations/${organizationId}/idea-types`, { name });
                  }}
                >
                  <div>
                    <Label htmlFor="settings-idea-type-name">
                      Name <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="settings-idea-type-name"
                      required
                      value={name}
                      aria-describedby="settings-idea-type-name-hint"
                      onChange={(event) => setName(event.target.value)}
                    />
                    <p
                      id="settings-idea-type-name-hint"
                      className="mt-1 mb-0 text-xs text-muted-foreground"
                    >
                      Shown as a badge on cards, the ideas list, and idea detail.
                    </p>
                  </div>
                  <Button type="submit" disabled={create.state === "sending"}>
                    Create idea type
                  </Button>
                </form>
                <SubmitOutcome outcome={create} what="create" className="mt-4" />
                <CorpusNote className="mt-4">
                  comp P puts the per-type field chooser in this card. Every recorded type uses{" "}
                  <strong>all active fields</strong>, so there is no captured example of a type
                  choosing a subset, and the chooser is left out rather than built against
                  nothing.
                </CorpusNote>
              </CardContent>
            </Card>
          ) : (
            <ReadOnlyAside
              subject="idea types"
              probe={
                organizationId
                  ? {
                      method: "POST",
                      path: `/organizations/${organizationId}/idea-types`,
                      body: { name: "Probe" },
                    }
                  : undefined
              }
            />
          )
        }
      >
        <AdminTable
          testId="settings-idea-types"
          state={frame.state}
          what="idea types"
          error={types.error}
          onRetry={types.reload}
          columns={[
            { label: "Idea type" },
            { label: "Fields on this type", className: "hidden md:table-cell" },
            { label: "Order", className: "hidden w-20 text-right sm:table-cell" },
            { label: "Actions", className: "w-24 text-right", actions: true },
          ]}
          foot={
            mutable
              ? "Order here is the order of the type picker when an idea is created."
              : `Read-only. A Site Admin can read every organization’s idea types and change none of them. Use View As to act as a member of ${organizationName}.`
          }
          emptyTitle={
            frame.narrowed
              ? "No idea types match that search"
              : mutable
                ? "No idea types yet"
                : "This organization has no idea types"
          }
          emptyDescription={
            frame.narrowed
              ? "Try a shorter search, or clear it."
              : "Every idea is exactly one type, chosen at creation, so ideas cannot be created until at least one type exists."
          }
        >
          {frame.visible.map((type) => (
            <TableRow key={type.ideaTypeId}>
              <TableCell className="font-medium text-foreground">
                <Marker color={type.colorHex}>
                  {type.icon ? <span aria-hidden="true">{type.icon} </span> : null}
                  {type.name}
                </Marker>
                {type.isDeleted ? (
                  <Badge variant="outline" className="ml-2">
                    Archived
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {fieldSummary(type)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {type.sortOrder}
              </TableCell>
              <RowActions>
                <Guarded role={role} scope="org-content" quiet>
                  {(denied) => (
                    <Button variant="ghost" size="sm" {...(denied ?? {})}>
                      Edit<span className="sr-only"> {type.name}</span>
                    </Button>
                  )}
                </Guarded>
              </RowActions>
            </TableRow>
          ))}
        </AdminTable>

        {everyTypeTakesAllFields ? (
          <CorpusNote className="mt-4">
            every recorded type is set to <strong>all active fields</strong>, so the per-type
            field selection this column would otherwise count has no captured example. The
            column names the mode rather than printing a zero that would read as a mistake.
          </CorpusNote>
        ) : null}
      </Cols>
    </>
  );
}
