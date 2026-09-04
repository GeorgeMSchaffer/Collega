"use client";

/**
 * The list half of every settings screen.
 *
 * Statuses, idea types, fields, users, boards and organizations are the same page over
 * different columns — comp P generates all six from one `table_editor` — so they share this
 * one component, at four screen states. What differs between them is a column list and a
 * row renderer, which is what the caller supplies.
 *
 * The footer is not decoration: on a mutable screen it says how the list is reordered, and
 * on a read-only one it carries the sentence the disabled row controls point at with
 * `aria-describedby`. That is why `footId` exists.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Screen,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  When,
  cn,
  type ScreenState,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import type { ApiError } from "@/mocks";

export interface Column {
  readonly label: string;
  /** Width and responsive-hiding classes, applied to the header and nothing else. */
  readonly className?: string;
  /** A column of controls, whose header is empty by design. */
  readonly actions?: boolean;
}

export function AdminTable({
  state,
  columns,
  children,
  emptyTitle,
  emptyDescription,
  emptyAction,
  errorDetail,
  onRetry,
  foot,
  footId,
  what,
  error,
  testId,
}: {
  state: ScreenState;
  columns: readonly Column[];
  /** The rows, already built — one `<TableRow>` each. */
  children: React.ReactNode;
  emptyTitle: string;
  emptyDescription: React.ReactNode;
  emptyAction?: React.ReactNode;
  errorDetail?: React.ReactNode;
  onRetry?: () => void;
  foot?: React.ReactNode;
  footId?: string;
  /** The plural noun, for the error heading — "statuses", "users". */
  what: string;
  error?: ApiError | null;
  testId?: string;
}) {
  const header = (
    <TableHeader>
      <TableRow>
        {columns.map((column) => (
          <TableHead key={column.label} className={column.className}>
            {column.actions ? <span className="sr-only">{column.label}</span> : column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );

  return (
    <Screen state={state} data-testid={testId}>
      <Card className="gap-0 overflow-hidden py-0">
        <When state={["normal", "loading"]}>
          {/* `relative` so the table's own scroll container clips the absolutely
              positioned sr-only text inside it, rather than the page growing sideways. */}
          <div className="relative overflow-x-auto">
            <Table>
              {header}
              <TableBody>
                <When state="normal">{children}</When>
                <When state="loading">
                  {Array.from({ length: 5 }, (_, row) => (
                    <TableRow key={row}>
                      {columns.map((column, index) => (
                        <TableCell key={column.label}>
                          {column.actions ? null : (
                            <Skeleton
                              className="h-3"
                              style={{ width: ["78%", "54%", "40%", "62%", "46%"][index % 5] }}
                            />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </When>
              </TableBody>
            </Table>
          </div>
        </When>

        <When state="normal">
          {foot ? (
            <div
              id={footId}
              className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground"
            >
              {foot}
            </div>
          ) : null}
        </When>

        <When state="empty">
          <Empty className="m-6">
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
            {emptyAction ? <div className="mt-4 flex flex-wrap gap-2">{emptyAction}</div> : null}
          </Empty>
        </When>

        <When state="error">
          <div className="p-6">
            {error?.isRefusal ? (
              <Alert variant="warning">
                <AlertTitle>{error.problem?.title ?? "You do not have access to this"}</AlertTitle>
                <AlertDescription>
                  {error.problem?.detail ?? "The API refused this request for your role."}
                </AlertDescription>
              </Alert>
            ) : error?.isMockGap ? (
              <CorpusNote>{error.message}</CorpusNote>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertTitle>Couldn’t load {what}.</AlertTitle>
                  <AlertDescription>
                    {errorDetail ??
                      "The request failed before anything was returned, so nothing here is out of date — it is simply absent. Retrying is safe."}
                  </AlertDescription>
                </Alert>
                {onRetry ? (
                  <Button variant="outline" className="mt-4" onClick={onRetry}>
                    Retry
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </When>
      </Card>
    </Screen>
  );
}

/** The right-aligned cell every row's controls sit in. */
export function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableCell className={cn("text-right", className)}>
      <span className="inline-flex flex-wrap items-center justify-end gap-1">{children}</span>
    </TableCell>
  );
}
