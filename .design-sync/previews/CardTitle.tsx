import { Card, CardContent, CardHeader, CardTitle } from '@collega/design-system'

/** An `h3` at base size, semibold, tight tracking. Shown where it belongs, in a header. */
export const InHeader = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Idea types</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="m-0 text-sm text-muted-foreground">
        Three types are configured: Improvement, Problem, Question.
      </p>
    </CardContent>
  </Card>
)

export const Standalone = () => (
  <div className="flex flex-col gap-2">
    <CardTitle>Assist budget</CardTitle>
    <CardTitle>Delivery roadmap</CardTitle>
  </div>
)
