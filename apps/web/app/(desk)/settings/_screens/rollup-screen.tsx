"use client";

/**
 * The Site Admin's cross-organization roll-up: *All statuses*, *All idea types*, *All
 * fields*, *All users*.
 *
 * There is no platform-wide endpoint for any of these. The API scopes every one of them to
 * an organization, so the screen fans out over `GET /organizations` and asks each in turn —
 * which is what the Blazor client does, and why the error copy says a single organization
 * failing empties the list.
 *
 * **Read-only by construction.** The row action leaves for the organization-scoped screen
 * rather than editing in place, and there is deliberately no create control: a status belongs
 * to an organization, so there is nothing coherent for a create button here to make. That is
 * a different thing from rule 25 refusing a Site Admin, and the screen should not blur them.
 *
 * **What the corpus can and cannot do here, because it decides what this screen is worth.**
 * `GET /organizations` returns two organizations, but every organization-scoped list was
 * captured against one of them. Asking about the other gets the first one's recording back,
 * flagged as a substitution — which on a cross-organization roll-up is the worst possible
 * place to be quietly wrong, since the whole point is telling tenants apart. So a substituted
 * organization is **not** merged into the table: it is listed underneath as an organization
 * the corpus cannot answer for.
 */

import { Alert, AlertDescription, AlertTitle, Button, TableCell, TableRow } from "@collega/design-system";
import Link from "next/link";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { useApi } from "@/lib/api";
import type { Paged } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import {
  NarrowedNote,
  SearchField,
  useListFrame,
} from "@/app/(desk)/settings/_components/list-frame";
import { useApiEach } from "@/app/(desk)/settings/_lib/api";
import type { OrganizationRow } from "@/app/(desk)/settings/_lib/types";

/** One row of the roll-up: a thing, and the organization it belongs to. */
export interface RollupRow {
  readonly key: string;
  readonly name: string;
  readonly detail: React.ReactNode;
  readonly organizationId: string;
  readonly organizationTitle: string;
  /**
   * Where this row's action goes, when it is somewhere more specific than the
   * organization-scoped list — the users roll-up names a person, so it opens that person.
   */
  readonly href?: string;
}

export interface RollupSpec<T> {
  readonly noun: string;
  readonly one: string;
  /** The label of the single detail column between Name and the action. */
  readonly detailLabel: string;
  readonly path: (organizationId: string) => string;
  readonly target: (organizationId: string) => string;
  /** The row action's label — "Manage" everywhere except users, where it is "Details". */
  readonly action?: string;
  readonly rowsOf: (payload: T, organization: OrganizationRow) => readonly RollupRow[];
}

function matches(row: RollupRow, needle: string): boolean {
  return `${row.name} ${row.organizationTitle}`.toLowerCase().includes(needle);
}

export function RollupScreen<T>({
  spec,
  override,
}: {
  spec: RollupSpec<T>;
  override: "empty" | "loading" | "error" | null;
}) {
  const organizations = useApi<Paged<OrganizationRow>>("/organizations");
  const orgList = React.useMemo(() => organizations.data?.items ?? [], [organizations.data]);

  const paths = React.useMemo(
    () => (organizations.state === "ready" ? orgList.map((one) => spec.path(one.organizationId)) : null),
    [organizations.state, orgList, spec],
  );
  const each = useApiEach<T>(paths);

  const byPath = React.useMemo(
    () => new Map(each.results.map((result) => [result.path, result])),
    [each.results],
  );

  /** Organizations whose answer was a recording of a different one, kept out of the table. */
  const unanswerable = React.useMemo(
    () =>
      orgList.filter((one) => byPath.get(spec.path(one.organizationId))?.mock?.match === "substituted"),
    [orgList, byPath, spec],
  );

  const items = React.useMemo(
    () =>
      orgList.flatMap((one) => {
        const result = byPath.get(spec.path(one.organizationId));
        if (!result || result.data === null) return [];
        if (result.mock?.match === "substituted") return [];
        return spec.rowsOf(result.data, one);
      }),
    [orgList, byPath, spec],
  );

  const failures = each.results.filter((result) => result.error !== null && !result.error.isMockGap);

  const frame = useListFrame({
    items,
    loading: organizations.state === "loading" || each.state === "loading",
    error: organizations.state === "error",
    matches,
    override,
  });

  const action = spec.action ?? "Manage";

  return (
    <>
      <SearchField
        id={`settings-rollup-${spec.noun.replace(/\s+/g, "-")}`}
        placeholder={`Search ${spec.noun}…`}
        value={frame.search}
        onChange={frame.setSearch}
      />

      {frame.narrowed ? (
        <NarrowedNote
          shown={frame.visible.length}
          total={items.length}
          noun={spec.noun}
          className="mb-4"
        />
      ) : null}

      {failures.length > 0 ? (
        <Alert variant="warning" role="status" className="mb-4">
          <AlertTitle>
            {failures.length} of {orgList.length} organizations could not be read.
          </AlertTitle>
          <AlertDescription>
            This view queries every organization in turn, so what is below is incomplete rather
            than wrong. {failures[0]?.error?.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <AdminTable
        testId={`settings-rollup-${spec.noun.replace(/\s+/g, "-")}`}
        state={frame.state}
        what={spec.noun}
        error={organizations.error}
        onRetry={organizations.reload}
        columns={[
          { label: "Name" },
          { label: "Organization", className: "w-56" },
          { label: spec.detailLabel, className: "hidden w-44 md:table-cell" },
          { label: "Actions", className: "w-28 text-right", actions: true },
        ]}
        foot={`${items.length} ${spec.noun} across ${orgList.length - unanswerable.length} of ${orgList.length} organizations.`}
        emptyTitle={
          frame.narrowed ? `No ${spec.noun} match that search` : `No ${spec.noun} anywhere yet`
        }
        emptyDescription={
          frame.narrowed ? (
            "Try a shorter search, or clear it."
          ) : (
            <>
              No organization the corpus can answer for has configured {spec.noun}. Open an
              organization to set its {spec.noun} up — they cannot be created from this
              cross-organization view.
            </>
          )
        }
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/settings/organizations">Go to Organizations</Link>
          </Button>
        }
      >
        {frame.visible.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium text-foreground">{row.name}</TableCell>
            <TableCell>{row.organizationTitle}</TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{row.detail}</TableCell>
            <RowActions>
              <Button variant="ghost" size="sm" asChild>
                <Link href={row.href ?? spec.target(row.organizationId)}>
                  {action}
                  <span className="sr-only">
                    {" "}
                    {row.name} in {row.organizationTitle}
                  </span>
                </Link>
              </Button>
            </RowActions>
          </TableRow>
        ))}
      </AdminTable>

      {unanswerable.length > 0 ? (
        <CorpusNote className="mt-4">
          the corpus captured this list for one organization only, so{" "}
          {unanswerable.map((one) => one.title).join(", ")}{" "}
          {unanswerable.length === 1 ? "is" : "are"} missing from the table above rather than
          filled with the other organization’s rows. The organization-scoped screen says the
          same thing when you open{" "}
          {unanswerable.map((one, index) => (
            <React.Fragment key={one.organizationId}>
              {index > 0 ? ", " : ""}
              <Link
                href={spec.target(one.organizationId)}
                className="font-medium underline underline-offset-2"
              >
                {one.title}
              </Link>
            </React.Fragment>
          ))}
          .
        </CorpusNote>
      ) : null}

      <p className="mt-4 mb-0 max-w-prose rounded-lg border-l-4 border-l-secondary bg-muted/40 px-4 py-3 text-sm leading-relaxed">
        <strong>A cross-organization view is read-only on purpose.</strong> A {spec.one} belongs
        to one organization, so there is nothing coherent for a create button here to create.{" "}
        <strong>{action}</strong> carries you into the organization-scoped screen, which is
        where every change is made.
      </p>
    </>
  );
}
