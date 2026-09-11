'use client'

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Code,
  CodeChip,
  EmptyState,
  Field,
  FileButton,
} from '@collega/design-system'
import { useActionState } from 'react'
import { AdminTable, Th } from '@/components/settings/settings-page'
import { type ImportState, importUsers } from '@/lib/server/admin-actions'

/**
 * A `'use server'` module may only export async functions, so the initial state cannot live beside
 * the action — see `profile-form.tsx`, which says why `tsc` does not catch that and `next build`
 * does.
 */
const NOTHING_SUBMITTED: ImportState = { error: null, errors: {}, outcome: null }

/**
 * Import accounts from a CSV, and show what the import did (comp P `s-import`).
 *
 * **The outcome lives in this component's state because nothing can read it back.** The API keeps
 * no import history, and the temporary passwords in the table are generated once and never
 * retrievable — so comp P's "Last import" panel can only ever be the import this reader has just
 * run. Reloading the page empties it, correctly: there is no last import to show, only one that
 * happened while the screen was open.
 *
 * The file is submitted through the Server Function boundary rather than posted at the API from the
 * browser, which is what keeps the session cookie on one origin (`lib/api/config.ts`). Next caps a
 * Server Function's body, and `next.config.ts` raises that cap above the API's own 5 MB so the
 * bound a person meets is the API's, stated in the API's terms, rather than a framework limit
 * arriving as a crash.
 *
 * Submitted with a real submit button rather than on the file input's change event: a picker that
 * fires a write the moment a file is chosen gives no chance to notice the wrong file was picked,
 * and leaves a keyboard user no way to cancel.
 */
export function UserImportForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importUsers,
    NOTHING_SUBMITTED,
  )
  const outcome = state.outcome

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* The whole results column goes, not just the table: the "Last import" heading and the
            password warning both assert an import happened. No action either — the file picker
            beside this is the action, and a second button would only point at it. */}
        {outcome === null ? (
          <EmptyState heading="Nothing imported yet">
            Choose a CSV to see each row&rsquo;s outcome here, with the temporary password for every
            account it creates. Outcomes are shown once, while this page stays open.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="m-0 text-base font-semibold tracking-tight">Last import</h2>
              <Badge variant="secondary">{outcome.created} created</Badge>
              <Badge variant="secondary">{outcome.rejected} rejected</Badge>
            </div>

            <AdminTable
              summary={`${outcome.rows.length} rows — ${outcome.created} created, ${outcome.rejected} rejected.`}
            >
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th className="w-16">Row</Th>
                  <Th>Email</Th>
                  <Th className="w-28">Outcome</Th>
                  <Th>Temporary password / reason</Th>
                </tr>
              </thead>
              <tbody>
                {outcome.rows.map((row) => (
                  <tr key={row.row} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{row.row}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {row.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={row.created ? 'success' : 'warning'}>
                        {row.created ? 'Created' : 'Rejected'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.created ? (
                        <CodeChip>{row.detail}</CodeChip>
                      ) : (
                        <span className="text-muted-foreground">{row.detail}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>

            {outcome.created > 0 ? (
              <Alert role="status">
                <span>
                  <b>Copy the temporary passwords now.</b> They are generated once and never shown
                  again &mdash; a person whose password is lost here needs a fresh reset from their
                  row on the users screen.
                </span>
              </Alert>
            ) : null}
          </>
        )}
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Choose a file</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <input type="hidden" name="organizationId" value={organizationId} />

            {state.error ? (
              <Alert variant="destructive" className="mb-3">
                <span>{state.error}</span>
              </Alert>
            ) : null}

            <Field
              htmlFor="csvFile"
              label="CSV file"
              error={state.errors.csvFile}
              hint={
                state.errors.csvFile
                  ? undefined
                  : 'Up to 5 MB and 5,000 rows. Valid rows are imported even when others are rejected.'
              }
            >
              <FileButton id="csvFile" name="csvFile" label="Choose CSV…" accept=".csv,text/csv" />
            </Field>

            <Button type="submit" className="w-full justify-center" disabled={pending}>
              {pending ? 'Importing…' : 'Import users'}
            </Button>
          </form>

          <p className="m-0 mt-3 text-sm text-muted-foreground">
            Columns: <Code>firstName</Code>, <Code>lastName</Code>, <Code>email</Code>, and
            optionally <Code>role</Code>. A missing role becomes <b>User</b>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
