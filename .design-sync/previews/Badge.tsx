import { Badge } from '@collega/design-system'

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Accepted</Badge>
    <Badge variant="secondary">In review</Badge>
    <Badge variant="outline">Draft</Badge>
    <Badge variant="success">Shipped</Badge>
    <Badge variant="warning">Needs detail</Badge>
    <Badge variant="destructive">Declined</Badge>
  </div>
)

/** Status never rides on colour alone — the word is always the label. */
export const InContext = () => (
  <div className="flex max-w-lg flex-col gap-2">
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium">Automate weekly reporting</span>
      <Badge variant="success">Shipped</Badge>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium">Single sign-on for contractors</span>
      <Badge variant="warning">Needs detail</Badge>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium">Replace the intake spreadsheet</span>
      <Badge variant="destructive">Declined</Badge>
    </div>
  </div>
)
