import { CodeChip } from '@collega/design-system'

/** A bordered chip for a literal that stands on its own — an invite code, a temporary password. */
export const InviteCode = () => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Invite code</span>
      <CodeChip>NWND-7K2Q-84MX</CodeChip>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Temporary password</span>
      <CodeChip>rt9-Kmv2-Pq4d</CodeChip>
    </div>
  </div>
)

export const InProse = () => (
  <p className="m-0 max-w-prose text-sm">
    Send them the code <CodeChip>NWND-7K2Q-84MX</CodeChip> — it expires after seven days or on
    first use, whichever comes first.
  </p>
)
