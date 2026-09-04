"use client";

/**
 * `/settings/profile` — the one settings screen every role reaches.
 *
 * It is also the only place a member changes their own password, which is why comp P puts it
 * under Settings rather than behind the avatar menu. Email and role render **read-only
 * rather than absent**: a member can see what they are without being able to change it.
 *
 * What the recordings support: `PUT /auth/me` is recorded at all four roles, so the name form
 * really saves and really answers. `POST /auth/change-password` is recorded **only as a
 * User** — a success and a wrong-current-password 401 — so an Org Admin, a Site Admin or a
 * read-only account submitting it meets the mock's 501, and the screen says which of the two
 * that is rather than showing a failure that is really a hole.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Screen,
  Skeleton,
  When,
  type ScreenState,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote, ErrorNotice } from "@/components/desk/notices";
import { PageHeader } from "@/components/desk/page-header";
import { DeskTopBar, DeskWork } from "@/components/nav/desk-top-bar";
import { ROLE_LABELS } from "@/lib/format";
import type { Me } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

import { useSubmit } from "@/app/(desk)/settings/_lib/api";
import { SubmitOutcome } from "@/app/(desk)/settings/_components/chrome";

/**
 * Email and role render read-only rather than absent, so a member can see what they are — but
 * an input that reads as editable and is not is worse than either, so the read-only pair are
 * visibly inert as well as functionally so.
 */
const READ_ONLY = "cursor-default bg-muted text-muted-foreground";

export function ProfileScreen() {
  const { me, meError, stateOverride } = useWorkspace();
  const nameSave = useSubmit<Me>();
  const passwordSave = useSubmit<null>();

  const [first, setFirst] = React.useState<string | null>(null);
  const [last, setLast] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  // The inputs are uncontrolled until the identity lands, then controlled from it. Seeding
  // them in an effect would flash an empty field first; falling back at read time does not.
  const firstValue = first ?? me?.firstName ?? "";
  const lastValue = last ?? me?.lastName ?? "";

  // Unconfirmed covers the case the confirm field exists for: a typo in New password that
  // is never retyped. Shown only once the field has been touched or a submit attempted, so
  // the error does not appear while the first character is still being typed.
  const [attempted, setAttempted] = React.useState(false);
  const unconfirmed = next !== confirm;
  const showMismatch = unconfirmed && (attempted || confirm.length > 0);
  const tooShort = next.length > 0 && next.length < 12;

  const state: ScreenState =
    stateOverride ?? (meError ? "error" : me ? "normal" : "loading");

  return (
    <>
      <DeskTopBar crumbs={[{ label: "Settings", href: "/settings" }, { label: "Profile" }]} />
      <DeskWork>
        <PageHeader title="My Profile">
          Edit your name and change your password. Email and role are read-only.
        </PageHeader>

        <Screen state={state} data-testid="profile-screen">
          <When state="loading">
            <Card className="max-w-[720px]">
              <CardContent className="flex flex-col gap-3">
                <span className="sr-only">Loading</span>
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </CardContent>
            </Card>
          </When>

          <When state="error">
            <ErrorNotice error={meError} what="your profile" />
          </When>

          <When state={["normal", "empty"]}>
            <div className="flex max-w-[720px] flex-col gap-4">
              <Card>
                <CardContent>
                  <h2 className="m-0 mb-1 text-xl font-semibold tracking-tight">Your details</h2>
                  <p className="m-0 mb-4 text-sm text-muted-foreground">
                    Your name is what everyone else in your organization sees on ideas and
                    comments.
                  </p>
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void nameSave.send("PUT", "/auth/me", {
                        firstName: firstValue,
                        lastName: lastValue,
                      });
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="profile-first">
                          First name <span aria-hidden="true">*</span>
                        </Label>
                        <Input
                          id="profile-first"
                          required
                          autoComplete="given-name"
                          value={firstValue}
                          onChange={(event) => setFirst(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="profile-last">
                          Last name <span aria-hidden="true">*</span>
                        </Label>
                        <Input
                          id="profile-last"
                          required
                          autoComplete="family-name"
                          value={lastValue}
                          onChange={(event) => setLast(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="profile-email">Email</Label>
                        <Input
                          id="profile-email"
                          readOnly
                          value={me?.email ?? ""}
                          className={READ_ONLY}
                        />
                        <p className="mt-1 mb-0 text-xs text-muted-foreground">
                          Your sign-in name. Only an administrator can change it.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="profile-role">Role</Label>
                        <Input
                          id="profile-role"
                          readOnly
                          value={me ? ROLE_LABELS[me.role] : ""}
                          className={READ_ONLY}
                        />
                        <p className="mt-1 mb-0 text-xs text-muted-foreground">
                          What you may do. Set by an administrator.
                        </p>
                      </div>
                    </div>

                    <Button type="submit" className="w-fit" disabled={nameSave.state === "sending"}>
                      Save changes
                    </Button>
                  </form>
                  <SubmitOutcome outcome={nameSave} what="save" className="mt-4" />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h2 className="m-0 mb-1 text-xl font-semibold tracking-tight">Change password</h2>
                  <p className="m-0 mb-4 text-sm text-muted-foreground">
                    After changing your password, sign in again with the new one.
                  </p>
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAttempted(true);
                      if (unconfirmed || tooShort || next.length === 0) return;
                      void passwordSave.send("POST", "/auth/change-password", {
                        currentPassword: current,
                        newPassword: next,
                      });
                    }}
                  >
                    <div className="max-w-[340px]">
                      <Label htmlFor="profile-current">Current password</Label>
                      <Input
                        id="profile-current"
                        type="password"
                        autoComplete="current-password"
                        value={current}
                        onChange={(event) => setCurrent(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="profile-new">New password</Label>
                        <Input
                          id="profile-new"
                          type="password"
                          autoComplete="new-password"
                          value={next}
                          aria-invalid={tooShort || undefined}
                          aria-describedby="profile-new-hint"
                          onChange={(event) => setNext(event.target.value)}
                        />
                        <p id="profile-new-hint" className="mt-1 mb-0 text-xs text-muted-foreground">
                          At least 12 characters.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="profile-confirm">Confirm new password</Label>
                        <Input
                          id="profile-confirm"
                          type="password"
                          autoComplete="new-password"
                          value={confirm}
                          aria-invalid={showMismatch || undefined}
                          aria-describedby={showMismatch ? "profile-confirm-error" : undefined}
                          onChange={(event) => setConfirm(event.target.value)}
                        />
                        {showMismatch ? (
                          <p id="profile-confirm-error" className="mt-1 mb-0 text-xs text-destructive">
                            {confirm.length === 0
                              ? "Retype the new password to confirm it."
                              : "The two passwords do not match."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-fit"
                      disabled={passwordSave.state === "sending"}
                    >
                      Change password
                    </Button>
                  </form>

                  {passwordSave.state === "done" ? (
                    <Alert role="status" className="mt-4">
                      <AlertTitle>Password changed.</AlertTitle>
                      <AlertDescription>
                        The API accepted it. Against the mock nothing is stored — this is the
                        recorded answer to the same request.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <SubmitOutcome outcome={passwordSave} what="change your password" className="mt-4" />
                  )}

                  {me && me.role !== "User" ? (
                    <CorpusNote className="mt-4">
                      the password change was captured as a <strong>User</strong> only — a
                      success and a wrong-current-password refusal. Submitting it as{" "}
                      {ROLE_LABELS[me.role]} reaches an endpoint the corpus never recorded at
                      that role, and the mock answers 501 rather than inventing a result.
                    </CorpusNote>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </When>
        </Screen>
      </DeskWork>
    </>
  );
}
