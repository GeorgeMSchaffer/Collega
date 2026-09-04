"use client";

/**
 * Board administration, at `/settings/boards` and
 * `/settings/organizations/{orgId}/boards`.
 *
 * A board's swimlanes are an *ordered* subset of the organization's statuses, which is what
 * makes two boards in the same organization different from each other.
 *
 * Read-only for a Site Admin on the organization-scoped route, unlike Users · org — a board
 * is organization-owned **content**, so `SPEC/20-feature-view-as.md` rule 25 refuses every
 * change to it; user administration is the bootstrap exception and boards are not. The
 * Blazor original withheld both **New board** and the per-row **Edit** on both of its routes;
 * here they are shown, disabled and explained instead, per the 2026-09-02 decision.
 */

import { Badge, Button, TableCell, TableRow } from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { useApi } from "@/lib/api";
import type { BoardSummary, Role } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import {
  Cols,
  Guarded,
  ReadOnlyAside,
  SubstitutionNote,
} from "@/app/(desk)/settings/_components/chrome";
import {
  NarrowedNote,
  SearchField,
  useListFrame,
} from "@/app/(desk)/settings/_components/list-frame";
import { mayMutate } from "@/app/(desk)/settings/_lib/rules";

function matches(board: BoardSummary, needle: string): boolean {
  return board.name.toLowerCase().includes(needle);
}

export function BoardsScreen({
  role,
  organizationId,
  organizationName,
  override,
  /** Where Edit and New link — the own-organization routes, or the org-scoped ones. */
  basePath,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  override: "empty" | "loading" | "error" | null;
  basePath: string;
}) {
  const mutable = mayMutate(role, "org-content");
  const boards = useApi<BoardSummary[]>(
    organizationId ? `/organizations/${organizationId}/boards` : null,
  );

  const items = React.useMemo(() => boards.data ?? [], [boards.data]);
  const frame = useListFrame({
    items,
    loading: boards.state === "loading",
    error: boards.state === "error",
    matches,
    override,
  });

  return (
    <>
      <SubstitutionNote mock={boards.mock} what="boards" className="mb-4" />

      <SearchField
        id="settings-boards-search"
        placeholder="Search boards…"
        value={frame.search}
        onChange={frame.setSearch}
      />

      {frame.narrowed ? (
        <NarrowedNote shown={frame.visible.length} total={items.length} noun="boards" className="mb-4" />
      ) : null}

      <Cols aside={mutable ? undefined : <ReadOnlyAside subject="boards" />}>
        <AdminTable
          testId="settings-boards"
          state={frame.state}
          what="boards"
          error={boards.error}
          onRetry={boards.reload}
          columns={[
            { label: "Board" },
            { label: "Swimlanes", className: "hidden w-28 text-right sm:table-cell" },
            { label: "User status moves", className: "hidden w-44 md:table-cell" },
            { label: "Actions", className: "w-24 text-right", actions: true },
          ]}
          foot={
            mutable
              ? "A board’s swimlanes are a subset of the organization’s statuses, in an order chosen per board."
              : `Read-only. A board is organization-owned content, so a Site Admin is refused every change to it — unlike users, which are the bootstrap exception. Use View As to act as a member of ${organizationName}.`
          }
          emptyTitle={
            frame.narrowed
              ? "No boards match that search"
              : mutable
                ? "No boards yet"
                : "This organization has no boards"
          }
          emptyDescription={
            frame.narrowed ? (
              "Try a shorter search, or clear it."
            ) : mutable ? (
              <>
                A board is where ideas get worked. Without one there is nowhere for an idea to
                go, so this is the first thing to set up.
              </>
            ) : (
              <>
                Its members have nowhere to file an idea. An administrator of this organization
                can create one.
              </>
            )
          }
          emptyAction={
            mutable ? (
              <Button asChild>
                <Link href={`${basePath}/new`}>Create the first board</Link>
              </Button>
            ) : null
          }
        >
          {frame.visible.map((board) => (
            <TableRow key={board.boardId}>
              <TableCell className="font-medium text-foreground">
                <Link
                  href={`/board/${board.boardId}`}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {board.name}
                </Link>
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {board.swimlaneCount}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {/* The word carries it; the badge variant is decoration. */}
                <Badge variant={board.allowUserStatusUpdate ? "secondary" : "outline"}>
                  {board.allowUserStatusUpdate ? "Allowed" : "Admins only"}
                </Badge>
              </TableCell>
              <RowActions>
                <Guarded role={role} scope="org-content" quiet>
                  {(denied) =>
                    denied ? (
                      <Button variant="ghost" size="sm" {...denied}>
                        Edit<span className="sr-only"> {board.name}</span>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`${basePath}/${board.boardId}`}>
                          Edit<span className="sr-only"> {board.name}</span>
                        </Link>
                      </Button>
                    )
                  }
                </Guarded>
              </RowActions>
            </TableRow>
          ))}
        </AdminTable>
      </Cols>
    </>
  );
}
