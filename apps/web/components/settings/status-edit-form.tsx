'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { deleteStatus, type EditCatalogItemState, updateStatus } from '@/lib/server/catalog-actions'
import type { Status } from '@/lib/types'

const IDLE: EditCatalogItemState = { error: null }

/** `STATUS_NAME_MAX_LENGTH`, mirrored — `apps/web` may not import the domain package. */
const NAME_MAX = 100

/** The only colour shape the API accepts (`statuses.controller.ts`, `HEX_COLOR`). */
const HEX = '#[0-9a-fA-F]{6}'

/**
 * Renaming and recolouring one status, plus archiving it.
 *
 * **Two forms, not one form with two submit buttons.** They are separate Server Functions with
 * separate failure messages, and a shared `useActionState` would render the archive's refusal
 * above the name field as though the rename had failed. The cost is that the archive form repeats
 * the status id in a hidden field, which is a line rather than a design.
 *
 * Archiving is deliberately plain — a button that submits, with the consequence written beside it
 * rather than behind a confirmation dialog. It is a soft delete: the ideas already in this status
 * keep resolving it, so the board loses a lane and nothing loses its history. A dialog would imply
 * a severity this does not have, and the API refuses to archive the last remaining status anyway.
 */
export function StatusEditForm({ status }: { status: Status }) {
  const [saveState, save, saving] = useActionState(updateStatus, IDLE)
  const [archiveState, archive, archiving] = useActionState(deleteStatus, IDLE)
  const [color, setColor] = useState(status.color)

  return (
    <div className="flex flex-col gap-8">
      <form action={save} className="flex flex-col gap-1">
        {saveState.error ? (
          <Alert variant="destructive" className="mb-4">
            <span>{saveState.error}</span>
          </Alert>
        ) : null}

        <input type="hidden" name="statusId" value={status.id} />

        <Field htmlFor="status-name" label="Name" hint="Shown as a lane header on every board.">
          <Input
            id="status-name"
            name="name"
            required
            maxLength={NAME_MAX}
            defaultValue={status.name}
          />
        </Field>

        <Field
          htmlFor="status-color"
          label="Colour"
          hint="Six-digit hex. Colour is decoration — the status name always shows beside it."
        >
          <span className="flex gap-2">
            <Input
              id="status-color"
              name="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              pattern={HEX}
              maxLength={7}
              className="flex-1"
            />
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Pick colour visually"
              className="h-9 w-11 flex-none p-0.5"
            />
          </span>
        </Field>

        <div className="mt-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Link href="/settings/statuses" className="text-sm text-muted-foreground underline">
            Cancel
          </Link>
        </div>
      </form>

      <form action={archive} className="flex flex-col gap-2 border-t pt-6">
        {archiveState.error ? (
          <Alert variant="destructive">
            <span>{archiveState.error}</span>
          </Alert>
        ) : null}

        <input type="hidden" name="statusId" value={status.id} />

        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          Archiving removes this lane from every board. Ideas already in it keep the status, so
          nothing is lost — and the last remaining status cannot be archived.
        </p>
        <Button type="submit" variant="outline" disabled={archiving} className="w-fit">
          {archiving ? 'Archiving…' : 'Archive status'}
        </Button>
      </form>
    </div>
  )
}
