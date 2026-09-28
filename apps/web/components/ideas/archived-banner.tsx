'use client'

import { Alert, Button } from '@collega/design-system'
import { useState, useTransition } from 'react'
import { Icon } from '@/components/list/icons'
import { unarchiveBoard } from '@/lib/server/board-actions'

/**
 * The Archived banner on an archived board's own page (`20-feature-boards-and-statuses.md` rule 13):
 * lanes and list still show, adding, moving and editing do not, and an Org Admin can unarchive from
 * here. `canUnarchive` is the page's decision; the API makes the real one.
 */
export function ArchivedBanner({
  boardId,
  canUnarchive,
}: {
  boardId: string
  canUnarchive: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Alert role="status" className="flex flex-wrap items-center gap-2">
      <Icon name="archive" />
      <span className="flex-1">This board is archived. Its lanes and ideas are read-only.</span>
      {canUnarchive ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError((await unarchiveBoard(boardId)).error)
            })
          }
        >
          {pending ? 'Unarchiving…' : 'Unarchive'}
        </Button>
      ) : null}
      {error ? <span className="w-full text-destructive">{error}</span> : null}
    </Alert>
  )
}
