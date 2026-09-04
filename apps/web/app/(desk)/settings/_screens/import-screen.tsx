"use client";

/**
 * User CSV import, at `/settings/users/import` and
 * `/settings/organizations/{orgId}/users/import`.
 *
 * The results table is the whole point of the page: it is the only place a temporary password
 * is ever shown, and it is shown once. That makes the upload control the small half of the
 * screen and the outcome the large one.
 *
 * Import is user administration, so it is the bootstrap exception — a Site Admin may run it
 * against any organization, and the corpus records exactly that (200 at both admin roles,
 * 403 at the other two).
 *
 * The corpus holds one import outcome: one row, rejected, because the address already had an
 * account. That is a thin but real recording, and the screen shows it as what it is rather
 * than padding it out.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@collega/design-system";
import * as React from "react";

import { CorpusNote } from "@/components/desk/notices";
import { Marker } from "@/components/desk/marker";
import { PageHeader } from "@/components/desk/page-header";
import type { Role } from "@/lib/types";

import { Cols, SubmitOutcome } from "@/app/(desk)/settings/_components/chrome";
import { useSubmit } from "@/app/(desk)/settings/_lib/api";

interface ImportRow {
  readonly rowNumber: number;
  readonly email: string;
  readonly outcome: string;
  readonly error: string | null;
  readonly temporaryPassword: string | null;
}

interface ImportResult {
  readonly createdCount: number;
  readonly rejectedCount: number;
  readonly rows: readonly ImportRow[];
}

export function ImportScreen({
  organizationId,
  organizationName,
  title,
}: {
  role: Role | undefined;
  organizationId: string | null;
  organizationName: string;
  title: string;
}) {
  const upload = useSubmit<ImportResult>();
  const [file, setFile] = React.useState<File | null>(null);

  const result = upload.state === "done" ? upload.data : null;

  return (
    <>
      <PageHeader title={title}>
        {organizationName} · create many accounts at once from a CSV. Every new account gets a
        temporary password and must change it at first sign-in.
      </PageHeader>

      <Cols
        aside={
          <Card>
            <CardContent className="flex flex-col gap-3">
              <h2 className="m-0 text-lg font-semibold tracking-tight">Choose a file</h2>
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!organizationId || !file) return;
                  const body = new FormData();
                  // `csvFile`, per SPEC/30-Contracts.md and the recorded multipart body.
                  body.append("csvFile", file);
                  void upload.send("POST", `/organizations/${organizationId}/users/import`, body);
                }}
              >
                <div>
                  <label
                    htmlFor="settings-import-file"
                    className="mb-1 block text-sm font-medium"
                  >
                    CSV file
                  </label>
                  <input
                    id="settings-import-file"
                    type="file"
                    accept=".csv,text/csv"
                    aria-describedby="settings-import-hint"
                    className="w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <p id="settings-import-hint" className="mt-2 mb-0 text-xs text-muted-foreground">
                    Columns: <code className="font-mono">firstName</code>,{" "}
                    <code className="font-mono">lastName</code>,{" "}
                    <code className="font-mono">email</code>, and optionally{" "}
                    <code className="font-mono">role</code>. A missing role becomes User.
                  </p>
                </div>
                <Button type="submit" disabled={file === null || upload.state === "sending"}>
                  Import
                </Button>
              </form>

              <p className="m-0 rounded-lg border-l-4 border-l-secondary bg-muted/40 px-3 py-2 text-xs leading-relaxed">
                <strong>Valid rows are imported even when others fail.</strong> A rejected row
                does not roll the rest back, so a partially bad file still gets you most of the
                way and the table names what to fix.
              </p>

              <CorpusNote>
                the mock replays the one import the capture recorded, whatever file you choose —
                so the outcome below is that recording, not a reading of your CSV.
              </CorpusNote>
            </CardContent>
          </Card>
        }
      >
        {result === null ? (
          <Card>
            <CardContent>
              <Empty>
                <EmptyTitle>Nothing imported yet</EmptyTitle>
                <EmptyDescription>
                  Choose a CSV to see each row’s outcome here, with the temporary password for
                  every account it creates.
                </EmptyDescription>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <h2 className="m-0 mr-2 text-base font-semibold">Last import</h2>
              <Badge variant="secondary">{result.createdCount} created</Badge>
              <Badge variant="outline">{result.rejectedCount} rejected</Badge>
            </div>
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-right">Row</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-32">Outcome</TableHead>
                    <TableHead className="w-64">Temporary password / reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => {
                    const created = row.outcome.toLowerCase() === "created";
                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="text-right tabular-nums">{row.rowNumber}</TableCell>
                        <TableCell className="break-all text-muted-foreground">{row.email}</TableCell>
                        <TableCell>
                          {/* The word is the meaning; the dot is decoration. */}
                          <Marker color={created ? "var(--green)" : "var(--orange)"}>
                            {created ? "Created" : "Rejected"}
                          </Marker>
                        </TableCell>
                        <TableCell>
                          {row.temporaryPassword ? (
                            <Badge variant="mono">{row.temporaryPassword}</Badge>
                          ) : (
                            <span className="text-muted-foreground">{row.error ?? "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {result.createdCount > 0 ? (
              <Alert variant="warning" role="status" className="m-4 w-auto">
                <AlertTitle>Copy the temporary passwords now.</AlertTitle>
                <AlertDescription>
                  They are generated once and never shown again — a person whose password is
                  lost here needs a fresh reset from their row on the users screen.
                </AlertDescription>
              </Alert>
            ) : null}
          </Card>
        )}

        <SubmitOutcome outcome={upload} what="import" className="mt-4" />
      </Cols>
    </>
  );
}
