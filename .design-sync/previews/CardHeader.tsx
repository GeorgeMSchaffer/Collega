import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@collega/design-system'

/** CardHeader is the bordered top band — it only reads correctly inside a Card. */
export const InCard = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Boards</CardTitle>
      <CardDescription>Every intake board in this organization.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="m-0 text-sm text-muted-foreground">4 boards, 2 archived.</p>
    </CardContent>
  </Card>
)

/** Title alone, with no description — the header still keeps its rule and padding. */
export const TitleOnly = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Recent activity</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="m-0 text-sm text-muted-foreground">Nothing in the last seven days.</p>
    </CardContent>
  </Card>
)
