import { Alert, Card, CardContent, CardHeader, CardTitle } from '@collega/design-system'

/**
 * Stands in for a screen a later slice owns.
 *
 * It exists so the sidebar can show the whole product without lying: hiding unbuilt items would
 * misrepresent the shape of the app, and a 404 would read as a defect rather than as work not yet
 * done. Delete each use as its slice lands.
 */
export function NotBuilt({ title, slice, owns }: { title: string; slice: string; owns: string }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="m-0 text-sm text-muted-foreground">
          Not built yet. This screen belongs to slice <b>{slice}</b>, which owns {owns}.
        </p>
        <Alert variant="note">
          <span>
            Its design is locked — see{' '}
            <code className="font-mono text-xs">SPEC/mockups/comp-q-*.html</code>. It also needs an
            API, and <code className="font-mono text-xs">apps/api</code> arrives in Wave D.
          </span>
        </Alert>
      </CardContent>
    </Card>
  )
}
