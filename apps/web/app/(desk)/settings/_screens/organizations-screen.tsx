"use client";

/**
 * `/settings/organizations` and `/settings/organizations/{orgId}`.
 *
 * Not two pages. The detail route renders the identical list with one organization open
 * beside it — which is what `Settings.razor` does, and why the list stays live and filterable
 * underneath. The panel is docked rather than overlaid, per the locked direction, so nothing
 * is covered and there is no focus trap.
 *
 * Organizations belong to the platform rather than to a tenant, so this page and user
 * administration are `SPEC/20-feature-view-as.md`'s rule 26 — the bootstrap exception. A Site
 * Admin creates, edits and archives here directly, and the corpus records exactly that:
 * `POST /organizations`, `PUT /organizations/{id}` and `POST /organizations/{id}/archive` are
 * all successes at that identity, while every content mutation is a 403.
 *
 * Comp P moved the per-row scoped jumps into the panel and says why: beside a docked panel
 * the table is 700px narrower, and four controls per row either clip or stack four deep. The
 * panel also names the organization the jump applies to, and carries all five rather than the
 * three that fit in a row.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Inspector,
  InspectorBody,
  InspectorClose,
  InspectorDescription,
  InspectorHeader,
  InspectorLayout,
  InspectorTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableCell,
  TableRow,
  Textarea,
} from "@collega/design-system";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { useApi } from "@/lib/api";
import { useActivateOnSpace, useCloseOnEscape } from "@/lib/keys";
import type { Paged, Role } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import { Cols, Guarded, SubmitOutcome } from "@/app/(desk)/settings/_components/chrome";
import {
  NarrowedNote,
  SearchField,
  useListFrame,
} from "@/app/(desk)/settings/_components/list-frame";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { useInspectorFocus } from "@/app/(desk)/settings/_lib/inspector-focus";
import type { OrganizationDetail, OrganizationRow } from "@/app/(desk)/settings/_lib/types";

type StatusFilter = "active" | "all" | "archived";

function matches(organization: OrganizationRow, needle: string): boolean {
  return `${organization.title} ${organization.description ?? ""} ${organization.city ?? ""}`
    .toLowerCase()
    .includes(needle);
}

function location(organization: OrganizationRow): string {
  return [organization.city, organization.state].filter(Boolean).join(", ") || "—";
}

export function OrganizationsScreen({
  role,
  override,
  /** Set by `/settings/organizations/{orgId}`; otherwise the panel follows `?org=`. */
  openOrganizationId,
}: {
  role: Role | undefined;
  override: "empty" | "loading" | "error" | null;
  openOrganizationId?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const activateOnSpace = useActivateOnSpace();

  const organizations = useApi<Paged<OrganizationRow>>("/organizations");
  const create = useSubmit<OrganizationRow>();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateName, setStateName] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const items = React.useMemo(() => organizations.data?.items ?? [], [organizations.data]);
  const byStatus = React.useCallback(
    (one: OrganizationRow) =>
      status === "all" ? true : status === "archived" ? one.isArchived : !one.isArchived,
    [status],
  );

  const frame = useListFrame({
    items,
    filter: byStatus,
    loading: organizations.state === "loading",
    error: organizations.state === "error",
    matches,
    override,
  });

  const selectedId = openOrganizationId ?? params.get("org");
  const selected = items.find((one) => one.organizationId === selectedId) ?? null;
  const close = React.useCallback(() => router.push("/settings/organizations"), [router]);
  useCloseOnEscape(selected !== null, close);
  const panel = useInspectorFocus(selected !== null);

  return (
    <InspectorLayout
      open={selected !== null}
      inspector={
        selected ? <OrganizationPanel ref={panel} row={selected} role={role} onClose={close} /> : null
      }
    >
      <div className="min-w-0">
        <SearchField
          id="settings-orgs-search"
          placeholder="Search organizations…"
          value={frame.search}
          onChange={frame.setSearch}
        >
          <div className="min-w-48">
            <Label htmlFor="settings-orgs-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger id="settings-orgs-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Active and archived</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="archived">Archived only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SearchField>

        {frame.narrowed ? (
          <NarrowedNote
            shown={frame.visible.length}
            total={items.length}
            noun="organizations"
            className="mb-4"
          />
        ) : null}

        <Cols
          aside={
            // One side column, never two. Comp P generates the detail route by swapping the
            // create form out for the open organization's panel — and with the docked panel
            // already taking a column, a create form beside it leaves the table too narrow
            // to read, which is the measured reason the scoped jumps moved into the panel.
            selected !== null ? undefined : (
            <Card>
              <CardContent>
                <h2 className="m-0 mb-4 text-lg font-semibold tracking-tight">New organization</h2>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void create.send("POST", "/organizations", {
                      title,
                      description,
                      city,
                      state: stateName,
                    });
                  }}
                >
                  <div>
                    <Label htmlFor="settings-org-title">
                      Title <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="settings-org-title"
                      required
                      placeholder="Organization name"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="settings-org-description">
                      Description <span aria-hidden="true">*</span>
                    </Label>
                    <Textarea
                      id="settings-org-description"
                      required
                      rows={3}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="settings-org-city">City</Label>
                      <Input
                        id="settings-org-city"
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="settings-org-state">State</Label>
                      <Input
                        id="settings-org-state"
                        value={stateName}
                        onChange={(event) => setStateName(event.target.value)}
                      />
                    </div>
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    Address, phone and primary contact are filled in afterwards, from the
                    organization’s own panel.
                  </p>
                  <Guarded role={role} scope="bootstrap">
                    {(denied) => (
                      <Button type="submit" disabled={create.state === "sending"} {...(denied ?? {})}>
                        Create organization
                      </Button>
                    )}
                  </Guarded>
                </form>
                <SubmitOutcome outcome={create} what="create" className="mt-4" />
              </CardContent>
            </Card>
            )
          }
        >
          <AdminTable
            testId="settings-organizations"
            state={frame.state}
            what="organizations"
            error={organizations.error}
            onRetry={organizations.reload}
            columns={[
              { label: "Organization" },
              { label: "Location", className: "hidden w-40 md:table-cell" },
              { label: "Invite code", className: "hidden w-44 lg:table-cell" },
              { label: "Status", className: "w-28" },
              { label: "Actions", className: "w-24 text-right", actions: true },
            ]}
            foot={`${items.length} of ${organizations.data?.totalCount ?? items.length} organizations.`}
            emptyTitle={frame.narrowed ? "No organizations match that filter" : "No organizations yet"}
            emptyDescription={
              frame.narrowed
                ? "Try a different status, or clear the search."
                : "Collega has no tenants. Creating the first one is the only thing that can happen on this deployment until it exists."
            }
          >
            {frame.visible.map((organization) => (
              <TableRow
                key={organization.organizationId}
                data-selected={organization.organizationId === selectedId || undefined}
              >
                <TableCell className="font-medium text-foreground">
                  <Link
                    href={`/settings/organizations/${organization.organizationId}`}
                    onKeyDown={activateOnSpace}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {organization.title}
                  </Link>
                  {organization.description ? (
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {organization.description}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="hidden md:table-cell">{location(organization)}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant="mono">{organization.inviteCode ?? "None"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={organization.isArchived ? "outline" : "secondary"}>
                    {organization.isArchived ? "Archived" : "Active"}
                  </Badge>
                </TableCell>
                <RowActions>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/settings/organizations/${organization.organizationId}`}>
                      Details<span className="sr-only"> for {organization.title}</span>
                    </Link>
                  </Button>
                </RowActions>
              </TableRow>
            ))}
          </AdminTable>
        </Cols>
      </div>
    </InspectorLayout>
  );
}

function OrganizationPanel({
  ref,
  row,
  role,
  onClose,
}: {
  ref: React.Ref<HTMLElement>;
  row: OrganizationRow;
  role: Role | undefined;
  onClose: () => void;
}) {
  const detail = useApi<OrganizationDetail>(`/organizations/${row.organizationId}`);
  const archive = useSubmit<null>();
  const regenerate = useSubmit<{ inviteCode: string }>();
  const [confirming, setConfirming] = React.useState(false);

  // The panel is opened from a row, so the list's own values are what it shows until the
  // detail request lands. That avoids a panel that is empty for a round trip, and it means a
  // substituted detail response cannot silently rename the organization the row named.
  const exact = detail.data?.organizationId === row.organizationId;
  const facts: readonly [string, string][] =
    exact && detail.data
      ? [
          ["Address", detail.data.address ?? "—"],
          ["Location", location(detail.data)],
          ["Zip", detail.data.zip ?? "—"],
          ["Phone", detail.data.phone ?? "—"],
          [
            "Contact",
            [detail.data.primaryContactFirstName, detail.data.primaryContactLastName]
              .filter(Boolean)
              .join(" ") || "—",
          ],
        ]
      : [];

  const scoped: readonly [string, string][] = [
    ["Users", "users"],
    ["Statuses", "statuses"],
    ["Idea types", "idea-types"],
    ["Fields", "fields"],
    ["Boards", "boards"],
  ];

  return (
    <Inspector
      ref={ref}
      // Focused on open so a keyboard user lands in what they just opened. No ring:
      // the panel appearing beside the row *is* the signal, and a box drawn round a
      // whole landmark reads as an error state rather than a focus position.
      tabIndex={-1}
      className="outline-none"
      aria-label={row.title}
    >
      <InspectorHeader>
        <div className="min-w-0">
          <InspectorTitle>{row.title}</InspectorTitle>
          <InspectorDescription>
            {row.isArchived ? "Archived" : "Active"}
            {location(row) === "—" ? "" : ` · ${location(row)}`}
          </InspectorDescription>
        </div>
        <InspectorClose onClick={onClose} />
      </InspectorHeader>

      <InspectorBody>
        {row.description ? (
          <p className="m-0 text-sm leading-relaxed">{row.description}</p>
        ) : null}

        {facts.length > 0 ? (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {facts.map(([key, value]) => (
              <React.Fragment key={key}>
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="m-0">{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}

        <Guarded role={role} scope="bootstrap">
          {(denied) => (
            <Button variant="outline" size="sm" className="w-fit" {...(denied ?? {})}>
              Edit details
            </Button>
          )}
        </Guarded>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">Administer {row.title}</h3>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">
            Each of these opens this organization’s own settings page. Everything but Users is
            read-only from here.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scoped.map(([label, segment]) => (
              <Button key={segment} variant="outline" size="sm" asChild>
                <Link href={`/settings/organizations/${row.organizationId}/${segment}`}>
                  {label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">Invite code</h3>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">
            New members join this organization by registering with this code. Regenerating
            invalidates the old one immediately.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="mono">{row.inviteCode ?? "None"}</Badge>
            <Guarded role={role} scope="bootstrap">
              {(denied) => (
                <Button
                  variant="outline"
                  size="sm"
                  {...(denied ?? {})}
                  onClick={() =>
                    void regenerate.send(
                      "POST",
                      `/organizations/${row.organizationId}/invite-code/regenerate`,
                    )
                  }
                >
                  Regenerate
                </Button>
              )}
            </Guarded>
          </div>
          <SubmitOutcome outcome={regenerate} what="regenerate the invite code" />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3">
          <h3 className="m-0 text-sm font-semibold">Archive organization</h3>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">
            Archiving hides {row.title} and stops its members signing in. Nothing is deleted,
            and a Site Admin can restore it.
          </p>
          {/* Confirm in place rather than in a dialog: the destructive step is a second
              deliberate click, with no modal to trap focus in and nothing covered. */}
          {confirming ? (
            <div className="flex flex-wrap gap-2">
              <Guarded role={role} scope="bootstrap">
                {(denied) => (
                  <Button
                    variant="warn"
                    size="sm"
                    {...(denied ?? {})}
                    onClick={() => {
                      void archive.send("POST", `/organizations/${row.organizationId}/archive`);
                      setConfirming(false);
                    }}
                  >
                    Confirm archive
                  </Button>
                )}
              </Guarded>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Guarded role={role} scope="bootstrap">
              {(denied) => (
                <Button
                  variant="warn"
                  size="sm"
                  className="w-fit"
                  {...(denied ?? {})}
                  onClick={() => setConfirming(true)}
                >
                  Archive…
                </Button>
              )}
            </Guarded>
          )}
          <SubmitOutcome outcome={archive} what="archive this organization" />
        </div>

        {detail.state === "ready" && !exact ? (
          <CorpusNote>
            the corpus recorded organization detail for one organization only, so the address
            and contact block above would be another organization’s. It is left out; the name,
            description, location and invite code come from the list row, which is a real
            recording of this organization.
          </CorpusNote>
        ) : null}
      </InspectorBody>
    </Inspector>
  );
}
