import { Separator } from '@collega/design-system'

/** A one-pixel rule. It is an `<hr>`, so the separator role is implicit. */
export const BetweenRows = () => (
  <div className="flex max-w-md flex-col gap-3">
    <span className="text-sm font-medium">Northwind</span>
    <Separator />
    <span className="text-sm font-medium">Contoso</span>
    <Separator />
    <span className="text-sm font-medium">Fabrikam</span>
  </div>
)

/** Splitting a form into labelled sections. */
export const BetweenSections = () => (
  <div className="flex max-w-md flex-col gap-4">
    <div>
      <p className="m-0 text-sm font-medium">Profile</p>
      <p className="m-0 text-sm text-muted-foreground">Name and email address.</p>
    </div>
    <Separator />
    <div>
      <p className="m-0 text-sm font-medium">Password</p>
      <p className="m-0 text-sm text-muted-foreground">Changing it signs out other sessions.</p>
    </div>
  </div>
)
