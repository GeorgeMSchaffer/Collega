"use client";

/**
 * User administration, at `/settings/users` and
 * `/settings/organizations/{orgId}/users`.
 *
 * **This is the one organization-scoped screen a Site Admin can change**, and the contrast
 * with Statuses · org is the point rather than an inconsistency. `SPEC/20-feature-view-as.md`
 * rule 26 is the bootstrap exception: organization and user administration stay direct,
 * because somebody has to be able to reset the password of an Org Admin who has locked
 * themselves out, and a brand-new organization has nobody to impersonate yet. The corpus
 * agrees — `POST /organizations/{id}/users` and `PUT /users/{id}` are recorded as **201 and
 * 200 for a Site Admin**, while every content mutation at the same identity is a 403.
 *
 * So there is deliberately no read-only banner here. A reviewer arriving from Statuses · org
 * will expect one; its absence is the product rule, not a missed screen.
 *
 * The row opens a docked inspector rather than leaving for another page — `Details`, not
 * `Edit`, because it reads first and edits on request.
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
} from "@collega/design-system";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { useApi } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/format";
import { useActivateOnSpace, useCloseOnEscape } from "@/lib/keys";
import type { Paged, Role } from "@/lib/types";

import { AdminTable, RowActions } from "@/app/(desk)/settings/_components/admin-table";
import { Cols, Guarded, SubmitOutcome, SubstitutionNote } from "@/app/(desk)/settings/_components/chrome";
import {
  NarrowedNote,
  SearchField,
  useListFrame,
} from "@/app/(desk)/settings/_components/list-frame";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { useInspectorFocus } from "@/app/(desk)/settings/_lib/inspector-focus";
import { mayMutate } from "@/app/(desk)/settings/_lib/rules";
import type { OrganizationDetail, OrgUser, UserDetail } from "@/app/(desk)/settings/_lib/types";

const ROLE_OPTIONS: readonly Role[] = ["User", "OrgAdmin", "ReadOnly"];

/**
 * The account's first password.
 *
 * `POST /organizations/{id}/users` requires `initialPassword` — the API generates nothing —
 * so the caller does, and the caller is what shows it. That is what makes the form's promise
 * ("shown once, here, after you create them") true rather than aspirational: the 201 body
 * carries no password, so if this screen does not keep the one it sent, nobody ever sees it.
 */
function generatePassword(): string {
  // No look-alikes: someone reads this off a screen and types it into a login box.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  const raw = [...bytes].map((n) => alphabet[n % alphabet.length]).join("");
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 16)}`;
}

function matches(user: OrgUser, needle: string): boolean {
  return `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(needle);
}

export function UsersScreen({
  role,
  organizationId,
  organizationName,
  override,
  /** `/settings/users` or `/settings/organizations/{orgId}/users`. */
  basePath,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  override: "empty" | "loading" | "error" | null;
  basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const activateOnSpace = useActivateOnSpace();

  const mutable = mayMutate(role, "bootstrap");
  const users = useApi<Paged<OrgUser>>(
    organizationId ? `/organizations/${organizationId}/users` : null,
  );
  const organization = useApi<OrganizationDetail>(
    organizationId ? `/organizations/${organizationId}` : null,
  );
  const create = useSubmit<OrgUser>();
  const regenerate = useSubmit<{ inviteCode: string }>();

  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [newRole, setNewRole] = React.useState<Role>("User");
  const [issued, setIssued] = React.useState<string | null>(null);
  const [roleFilter, setRoleFilter] = React.useState("all");

  const items = React.useMemo(() => users.data?.items ?? [], [users.data]);
  const byRole = React.useCallback(
    (user: OrgUser) => roleFilter === "all" || user.role === roleFilter,
    [roleFilter],
  );

  const frame = useListFrame({
    items,
    filter: byRole,
    loading: users.state === "loading",
    error: users.state === "error",
    matches,
    override,
  });

  const selectedId = params.get("user");
  const selected = items.find((user) => user.userId === selectedId) ?? null;
  const close = React.useCallback(() => router.push(basePath), [router, basePath]);
  useCloseOnEscape(selected !== null, close);
  const panel = useInspectorFocus(selected !== null);

  return (
    <InspectorLayout
      open={selected !== null}
      inspector={
        selected ? (
          <UserInspector
            ref={panel}
            user={selected}
            organizationName={organizationName}
            mutable={mutable}
            role={role}
            onClose={close}
          />
        ) : null
      }
    >
      <div className="min-w-0">
        <SubstitutionNote mock={users.mock} what="the user list" className="mb-4" />

        {/* The invite code is org-owned but its administration is bootstrap, so a Site Admin
            sees it here too — that is the exception, not an oversight. */}
        {organization.data ? (
          <Card className="mb-4">
            <CardContent className="flex flex-col gap-2">
              <h2 className="m-0 text-base font-semibold">Invite code</h2>
              <p className="m-0 text-sm text-muted-foreground">
                Share this so new members can register themselves into {organizationName}.
                Regenerating it invalidates the old one immediately.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="mono" className="text-sm">
                  {organization.data.inviteCode ?? "None"}
                </Badge>
                <Guarded role={role} scope="bootstrap">
                  {(denied) => (
                    <Button
                      variant="outline"
                      size="sm"
                      {...(denied ?? {})}
                      onClick={() =>
                        organizationId &&
                        void regenerate.send(
                          "POST",
                          `/organizations/${organizationId}/invite-code/regenerate`,
                        )
                      }
                    >
                      Regenerate
                    </Button>
                  )}
                </Guarded>
              </div>
              {organization.data.inviteCode === "<redacted>" ? (
                <CorpusNote>
                  the capture redacts invite codes before writing a fixture, so the value above
                  is the literal string the recording holds. It is a stripped secret, not a
                  missing one.
                </CorpusNote>
              ) : null}
              <SubmitOutcome outcome={regenerate} what="regenerate the invite code" />
            </CardContent>
          </Card>
        ) : null}

        <SearchField
          id="settings-users-search"
          placeholder="Search name or email…"
          value={frame.search}
          onChange={frame.setSearch}
        >
          <div className="min-w-40">
            <Label htmlFor="settings-users-role">Role</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger id="settings-users-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any role</SelectItem>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SearchField>

        {frame.narrowed ? (
          <NarrowedNote shown={frame.visible.length} total={items.length} noun="users" className="mb-4" />
        ) : null}

        <Cols
          aside={
            mutable ? (
              <Card>
                <CardContent>
                  <h2 className="m-0 mb-4 text-lg font-semibold tracking-tight">Add user</h2>
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!organizationId) return;
                      const initialPassword = generatePassword();
                      setIssued(null);
                      void create
                        .send("POST", `/organizations/${organizationId}/users`, {
                          firstName: first,
                          lastName: last,
                          email,
                          role: newRole,
                          initialPassword,
                        })
                        .then(() => setIssued(initialPassword));
                    }}
                  >
                    <div>
                      <Label htmlFor="settings-user-first">
                        First name <span aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="settings-user-first"
                        required
                        value={first}
                        onChange={(event) => setFirst(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="settings-user-last">
                        Last name <span aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="settings-user-last"
                        required
                        value={last}
                        onChange={(event) => setLast(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="settings-user-email">
                        Email <span aria-hidden="true">*</span>
                      </Label>
                      <Input
                        id="settings-user-email"
                        type="email"
                        required
                        value={email}
                        aria-describedby="settings-user-email-hint"
                        onChange={(event) => setEmail(event.target.value)}
                      />
                      <p
                        id="settings-user-email-hint"
                        className="mt-1 mb-0 text-xs text-muted-foreground"
                      >
                        Their sign-in name. A user cannot change it themselves.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="settings-user-role">Role</Label>
                      <Select value={newRole} onValueChange={(value) => setNewRole(value as Role)}>
                        <SelectTrigger id="settings-user-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {ROLE_LABELS[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="m-0 rounded-lg border-l-4 border-l-secondary bg-muted/40 px-3 py-2 text-xs leading-relaxed">
                      They get a generated password and must change it at first sign-in. It is
                      shown once, here, after you create them.
                    </p>
                    <Button type="submit" disabled={create.state === "sending"}>
                      Create user
                    </Button>
                  </form>
                  {create.state === "done" && issued ? (
                    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-warning/60 bg-warning/10 p-3">
                      <h3 className="m-0 text-sm font-semibold">Copy this password now</h3>
                      <p className="m-0 text-xs leading-relaxed">
                        It is shown once and never again. {first || "They"} must change it at
                        first sign-in.
                      </p>
                      <Badge variant="mono" className="w-fit text-sm">
                        {issued}
                      </Badge>
                    </div>
                  ) : null}
                  <SubmitOutcome outcome={create} what="create" className="mt-4" />
                </CardContent>
              </Card>
            ) : undefined
          }
        >
          <AdminTable
            testId="settings-users"
            state={frame.state}
            what="users"
            error={users.error}
            onRetry={users.reload}
            columns={[
              { label: "Name" },
              { label: "Email", className: "hidden md:table-cell" },
              { label: "Role", className: "w-32" },
              { label: "Status", className: "hidden w-28 sm:table-cell" },
              { label: "Actions", className: "w-24 text-right", actions: true },
            ]}
            foot="Selecting a row opens the docked inspector, which reads first and edits on request — including the one-time temporary password."
            emptyTitle={frame.narrowed ? "No users match that filter" : "No users yet"}
            emptyDescription={
              frame.narrowed
                ? "Try a different role, or clear the search."
                : "Nobody can sign in to this organization. Add people directly, or share the invite code above so they can register themselves."
            }
          >
            {frame.visible.map((user) => (
              <TableRow key={user.userId} data-selected={user.userId === selectedId || undefined}>
                <TableCell className="font-medium text-foreground">
                  <Link
                    href={`${basePath}?user=${user.userId}`}
                    onKeyDown={activateOnSpace}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {user.firstName} {user.lastName}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground md:hidden">{user.email}</div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {user.email}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{user.status}</TableCell>
                <RowActions>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`${basePath}?user=${user.userId}`}>
                      Details<span className="sr-only"> for {user.firstName} {user.lastName}</span>
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

/**
 * The docked inspector. It is built from the **list row**, which is an exact recording, and
 * only reaches for `GET /users/{id}` to add the three fields the row does not carry. The
 * corpus recorded that endpoint against one user, so asking about any other returns that
 * one's record flagged as a substitution — and the panel says so rather than putting
 * somebody else's "must change password" under this person's name.
 */
function UserInspector({
  ref,
  user,
  organizationName,
  mutable,
  role,
  onClose,
}: {
  ref: React.Ref<HTMLElement>;
  user: OrgUser;
  organizationName: string;
  mutable: boolean;
  role: Role | undefined;
  onClose: () => void;
}) {
  const detail = useApi<UserDetail>(`/users/${user.userId}`);
  const temporary = useSubmit<{ temporaryPassword: string; mustChangePassword: boolean }>();
  // The id, not the mock header: after cutover there is no header, and testing for one
  // would hide the extra fields for every user forever.
  const exact = detail.data?.userId === user.userId;

  return (
    <Inspector
      ref={ref}
      // Focused on open so a keyboard user lands in what they just opened. No ring:
      // the panel appearing beside the row *is* the signal, and a box drawn round a
      // whole landmark reads as an error state rather than a focus position.
      tabIndex={-1}
      className="outline-none"
      aria-label={`${user.firstName} ${user.lastName}`}
    >
      <InspectorHeader>
        <div className="min-w-0">
          <InspectorTitle>
            {user.firstName} {user.lastName}
          </InspectorTitle>
          <InspectorDescription>
            {ROLE_LABELS[user.role]} · {organizationName}
          </InspectorDescription>
        </div>
        <InspectorClose onClick={onClose} />
      </InspectorHeader>

      <InspectorBody>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="m-0 break-all">{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="m-0">{ROLE_LABELS[user.role]}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="m-0">{user.status}</dd>
          {exact && detail.data ? (
            <>
              <dt className="text-muted-foreground">First sign-in</dt>
              <dd className="m-0">
                {detail.data.mustChangePassword ? "Must change password" : "Password set"}
              </dd>
            </>
          ) : null}
        </dl>

        {!exact && detail.state === "ready" ? (
          <CorpusNote>
            the corpus recorded <code className="font-mono">GET /users/{"{id}"}</code> for one
            account only, so this person’s own record is not in it. Everything above comes from
            the user list, which is a real recording of {organizationName}; the fields that
            live only on the detail endpoint are left out rather than filled from somebody
            else’s.
          </CorpusNote>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">Reset password</h3>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">
            Generates a temporary password and requires a change at next sign-in. It is shown
            once.
          </p>
          <Guarded role={role} scope="bootstrap">
            {(denied) => (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                {...(denied ?? {})}
                onClick={() => void temporary.send("POST", `/users/${user.userId}/temporary-password`)}
              >
                Generate temporary password
              </Button>
            )}
          </Guarded>
          {temporary.state === "done" && temporary.data ? (
            <Badge variant="mono" className="w-fit text-sm">
              {temporary.data.temporaryPassword}
            </Badge>
          ) : null}
          <SubmitOutcome outcome={temporary} what="reset the password" />
        </div>

        {mutable ? null : (
          <CorpusNote>
            your role cannot administer this account, so the controls above are refused rather
            than hidden.
          </CorpusNote>
        )}
      </InspectorBody>
    </Inspector>
  );
}
