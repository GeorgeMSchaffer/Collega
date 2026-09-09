import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@collega/design-system'

/** The muted sentence under a title. It carries no margin of its own. */
export const InHeader = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Users</CardTitle>
      <CardDescription>
        Everyone with an account in this organization, including read-only members.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="m-0 text-sm text-muted-foreground">48 users, 3 pending invitations.</p>
    </CardContent>
  </Card>
)

export const Standalone = () => (
  <CardDescription className="max-w-md">
    Tokens spent against today&rsquo;s deployment cap. The window rolls over at midnight UTC.
  </CardDescription>
)
