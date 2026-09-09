import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@collega/design-system'

/** The full composition: header rule, title, description, content. */
export const Full = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Assist budget</CardTitle>
      <CardDescription>Tokens spent against today&rsquo;s deployment cap.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="m-0 text-sm text-muted-foreground">
        3.2M of 5M tokens used. The window rolls over at midnight UTC.
      </p>
    </CardContent>
  </Card>
)

/** Content only — Card is just the hairline surface, the header is optional. */
export const ContentOnly = () => (
  <Card className="max-w-lg">
    <CardContent>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Replace the intake spreadsheet</span>
        <Badge variant="secondary">In review</Badge>
      </div>
    </CardContent>
  </Card>
)

export const WithAction = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>System prompt</CardTitle>
      <CardDescription>Applies to every assist call in this organization.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="m-0 mb-4 text-sm text-muted-foreground">
        Last published 4 March by Dana Okafor. Editing it does not affect ideas already drafted.
      </p>
      <Button variant="outline" size="sm">
        Edit prompt
      </Button>
    </CardContent>
  </Card>
)
