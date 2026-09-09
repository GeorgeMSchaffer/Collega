import { Card, CardContent, CardHeader, CardTitle, Separator } from '@collega/design-system'

/** The padded body of a Card. */
export const InCard = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Sprint 14</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="m-0 text-sm text-muted-foreground">
        Runs 3&ndash;17 March. 11 issues committed, 4 closed.
      </p>
    </CardContent>
  </Card>
)

/** Several content blocks separated by rules — the pattern the settings screens use. */
export const Sections = () => (
  <Card className="max-w-lg">
    <CardContent>
      <p className="m-0 text-sm font-medium">Northwind</p>
      <p className="m-0 text-sm text-muted-foreground">48 users &middot; 4 boards</p>
    </CardContent>
    <Separator />
    <CardContent>
      <p className="m-0 text-sm font-medium">Contoso</p>
      <p className="m-0 text-sm text-muted-foreground">12 users &middot; 1 board</p>
    </CardContent>
  </Card>
)
