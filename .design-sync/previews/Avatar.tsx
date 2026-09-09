import { Avatar } from '@collega/design-system'

/** Initials on a muted disc. There is no image variant — nothing in Collega uploads one. */
export const Initials = () => (
  <div className="flex items-center gap-2">
    <Avatar initials="DO" />
    <Avatar initials="RK" />
    <Avatar initials="MA" />
    <Avatar initials="JT" />
  </div>
)

export const InARow = () => (
  <div className="flex max-w-md flex-col gap-3">
    <div className="flex items-center gap-2 text-sm">
      <Avatar initials="DO" />
      <span className="font-medium">Dana Okafor</span>
      <span className="text-muted-foreground">Administrator</span>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <Avatar initials="RK" />
      <span className="font-medium">Rohan Krishnan</span>
      <span className="text-muted-foreground">Member</span>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <Avatar initials="MA" />
      <span className="font-medium">Mira Adeyemi</span>
      <span className="text-muted-foreground">Read-only</span>
    </div>
  </div>
)
