import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Code,
  CodeChip,
  FileButton,
} from '@collega/design-system'
import { AdminTable, SettingsPage, Th } from '@/components/settings/settings-page'
import { getLastImport } from '@/lib/data'

export const metadata = { title: 'Import users · Collega' }

export default async function ImportUsersPage() {
  const lastImport = await getLastImport()

  return (
    <SettingsPage
      title="Import users"
      gate="user import"
      lead="Create many accounts at once from a CSV. Every new account gets a temporary password and must change it at first sign-in."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-base font-semibold tracking-tight">
              Last import &mdash; {lastImport.completedAt}
            </h2>
            <Badge variant="secondary">{lastImport.created} created</Badge>
            <Badge variant="secondary">{lastImport.rejected} rejected</Badge>
          </div>

          <AdminTable
            summary={`${lastImport.rows.length} rows — ${lastImport.created} created, ${lastImport.rejected} rejected.`}
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
              {lastImport.rows.map((row) => (
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

          <Alert role="status">
            <span>
              <b>Copy the temporary passwords now.</b> They are generated once and never shown again
              &mdash; a person whose password is lost here needs a fresh reset from their row on the
              users screen.
            </span>
          </Alert>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Choose a file</CardTitle>
          </CardHeader>
          <CardContent>
            <FileButton id="csv" name="csv" label="Choose CSV…" accept=".csv" />
            <p className="m-0 mt-3 text-sm text-muted-foreground">
              Columns: <Code>firstName</Code>, <Code>lastName</Code>, <Code>email</Code>, and
              optionally <Code>role</Code>. A missing role becomes <b>User</b>.
            </p>
          </CardContent>
        </Card>
      </div>
    </SettingsPage>
  )
}
