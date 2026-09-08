import { Input, Label } from '@collega/design-system'

/**
 * `htmlFor` is required by the type, not optional — that is what binds the label to a control, and
 * making it optional is how the binding quietly gets dropped.
 */
export const BoundToAControl = () => (
  <div className="max-w-sm">
    <Label htmlFor="p-first">First name</Label>
    <Input id="p-first" defaultValue="Dana" />
  </div>
)

export const Several = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <div>
      <Label htmlFor="p-org">Organization</Label>
      <Input id="p-org" defaultValue="Northwind" />
    </div>
    <div>
      <Label htmlFor="p-email2">Email address</Label>
      <Input id="p-email2" defaultValue="dana.okafor@northwind.example" />
    </div>
  </div>
)
