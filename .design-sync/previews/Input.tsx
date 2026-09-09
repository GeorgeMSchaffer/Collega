import { Input, Label } from '@collega/design-system'

/**
 * The types the base layer styles: `text`, `password`, `search` and `file`. It keys off those
 * selectors exactly, so an input of any other type (`email`, `url`, `number`) renders with no
 * border or padding — use `type="text"` for an email field until the base layer covers it.
 */
export const Types = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <div>
      <Label htmlFor="p-email">Email address</Label>
      <Input id="p-email" defaultValue="dana.okafor@northwind.example" />
    </div>
    <div>
      <Label htmlFor="p-pass">Password</Label>
      <Input id="p-pass" type="password" defaultValue="correct-horse" />
    </div>
    <div>
      <Label htmlFor="p-search">Search</Label>
      <Input id="p-search" type="search" placeholder="Search ideas" />
    </div>
  </div>
)

/** `invalid` adds the destructive border and sets `aria-invalid`. */
export const Invalid = () => (
  <div className="max-w-sm">
    <Label htmlFor="p-board">Board name</Label>
    <Input id="p-board" defaultValue="Q3 Intake" invalid />
  </div>
)

export const States = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <Input id="p-filled" defaultValue="Automate weekly reporting" />
    <Input id="p-empty" placeholder="Give the idea a short title" />
    <Input id="p-disabled" defaultValue="Read-only account" disabled />
  </div>
)
