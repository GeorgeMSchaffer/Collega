"use client";

/**
 * The statuses administration screen, rendered at two routes.
 *
 * `/settings/statuses` for an Org Admin's own organization, and
 * `/settings/organizations/{orgId}/statuses` for a Site Admin reading one they do not belong
 * to. Comp P generates both from one definition for the reason it states: two hand-written
 * copies drift on the first edit, and then the columns disagree about what a status is.
 *
 * `mutable` is `mayMutate(role, "org-content")`, which is `SPEC/20-feature-view-as.md` rule
 * 25 — the Blazor original computed the same thing as `CanMutate => !_isSiteAdmin`. Read-only
 * here means the controls are **present, disabled and explained**, not absent: a Site Admin
 * who came looking for Edit should meet Edit and the reason, not an empty column.
 *
 * The colour column always carries the status name as well as the swatch. Colour alone
 * carrying meaning is forbidden (`SPEC/decisions.md` 2026-08-31), and the Blazor board broke
 * that rule twice — which is why every category on these screens goes through `Marker`.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableCell,
  TableRow,
} from "@collega/design-system";
import * as React from "react";

import { Marker } from "@/components/desk/marker";
import { useApi } from "@/lib/api";
import type { Status } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import { Cols, Guarded, ReadOnlyAside, SubmitOutcome, SubstitutionNote } from "@/app/(desk)/settings/_components/chrome";
import { NarrowedNote, SearchField, useListFrame } from "@/app/(desk)/settings/_components/list-frame";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { mayMutate } from "@/app/(desk)/settings/_lib/rules";
import type { Role } from "@/lib/types";

function matches(status: Status, needle: string): boolean {
  return status.name.toLowerCase().includes(needle);
}

export function StatusesScreen({
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
  const statuses = useApi<Status[]>(organizationId ? `/organizations/${organizationId}/statuses` : null);
  const create = useSubmit<Status>();

  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#62aef0");
  const [position, setPosition] = React.useState("last");

  const items = React.useMemo(
    () => [...(statuses.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [statuses.data],
  );
  const frame = useListFrame({
    items,
    loading: statuses.state === "loading",
    error: statuses.state === "error",
    matches,
    override,
  });

  return (
    <>
      <SubstitutionNote mock={statuses.mock} what="statuses" className="mb-4" />

      <SearchField
        id="settings-statuses-search"
        placeholder="Search statuses…"
        value={frame.search}
        onChange={frame.setSearch}
      />

      {frame.narrowed ? (
        <NarrowedNote shown={frame.visible.length} total={items.length} noun="statuses" className="mb-4" />
      ) : null}

      <Cols
        aside={
          mutable ? (
            <Card>
              <CardContent>
                <h2 className="m-0 mb-4 text-lg font-semibold tracking-tight">Add status</h2>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!organizationId) return;
                    // `sortOrder` is what the API takes, and it is optional — omitted, the
                    // status is appended after the current maximum, which is what "Last"
                    // means. Sending a "first"/"last" word would be silently ignored and
                    // the choice would vanish without saying so.
                    void create.send("POST", `/organizations/${organizationId}/statuses`, {
                      name,
                      color,
                      ...(position === "first" ? { sortOrder: 0 } : {}),
                    });
                  }}
                >
                  <div>
                    <Label htmlFor="settings-status-name">
                      Name <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="settings-status-name"
                      required
                      value={name}
                      aria-describedby="settings-status-name-hint"
                      onChange={(event) => setName(event.target.value)}
                    />
                    <p id="settings-status-name-hint" className="mt-1 mb-0 text-xs text-muted-foreground">
                      Shown as a lane header on every board.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="settings-status-color">Colour</Label>
                    <div className="flex gap-2">
                      <Input
                        id="settings-status-color"
                        value={color}
                        aria-describedby="settings-status-color-hint"
                        onChange={(event) => setColor(event.target.value)}
                      />
                      <input
                        type="color"
                        value={color}
                        aria-label="Pick colour visually"
                        className="h-9 w-11 shrink-0 rounded-md border bg-background p-0.5"
                        onChange={(event) => setColor(event.target.value)}
                      />
                    </div>
                    <p id="settings-status-color-hint" className="mt-1 mb-0 text-xs text-muted-foreground">
                      Colour is decoration — the status name always shows beside it.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="settings-status-position">Position</Label>
                    <Select value={position} onValueChange={setPosition}>
                      <SelectTrigger id="settings-status-position">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last">Last</SelectItem>
                        <SelectItem value="first">First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={create.state === "sending"}>
                    Add status
                  </Button>
                </form>
                <SubmitOutcome outcome={create} what="create" className="mt-4" />
              </CardContent>
            </Card>
          ) : (
            <ReadOnlyAside
              subject="statuses"
              probe={
                organizationId
                  ? {
                      method: "POST",
                      path: `/organizations/${organizationId}/statuses`,
                      body: { name: "Probe", color: "#62aef0" },
                    }
                  : undefined
              }
            />
          )
        }
      >
        <AdminTable
          testId="settings-statuses"
          state={frame.state}
          what="statuses"
          error={statuses.error}
          onRetry={statuses.reload}
          columns={[
            { label: "Name" },
            { label: "Colour", className: "w-44" },
            { label: "Order", className: "hidden w-20 text-right sm:table-cell" },
            { label: "Actions", className: "w-24 text-right", actions: true },
          ]}
          foot={
            mutable
              ? "Order here is the order of the lanes on every board that uses these statuses."
              : `Read-only. A Site Admin can read every organization’s statuses and change none of them. Use View As to act as a member of ${organizationName}, and the same controls become live.`
          }
          emptyTitle={
            frame.narrowed
              ? "No statuses match that filter"
              : mutable
                ? "No statuses yet"
                : "This organization has no statuses"
          }
          emptyDescription={
            frame.narrowed ? (
              "Try a shorter search, or clear it."
            ) : mutable ? (
              <>
                Statuses are the columns your boards group ideas by. Add the first one and
                every board in this organization gets that lane.
              </>
            ) : (
              <>
                Its boards have no lanes to group ideas by, so every board here is unusable
                until an administrator of this organization adds them.
              </>
            )
          }
        >
          {frame.visible.map((status) => (
            <TableRow key={status.statusId}>
              <TableCell className="font-medium text-foreground">
                {status.name}
                {status.isDeleted ? (
                  <Badge variant="outline" className="ml-2">
                    Archived
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                {/* The name beside the swatch, always. `color: null` renders no dot rather
                    than a default one — an absent colour is not a colour. */}
                <Marker color={status.color}>{status.color ?? "No colour"}</Marker>
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {status.sortOrder}
              </TableCell>
              <RowActions>
                <Guarded role={role} scope="org-content" quiet>
                  {(denied) => (
                    <Button variant="ghost" size="sm" {...(denied ?? {})}>
                      Edit<span className="sr-only"> {status.name}</span>
                    </Button>
                  )}
                </Guarded>
              </RowActions>
            </TableRow>
          ))}
        </AdminTable>
      </Cols>
    </>
  );
}
