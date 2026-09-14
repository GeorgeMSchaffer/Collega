'use client'

import { Alert, Button, Field, Input } from '@collega/design-system'
import Link from 'next/link'
import { useActionState } from 'react'
import {
  deleteIdeaType,
  type EditCatalogItemState,
  updateIdeaType,
} from '@/lib/server/catalog-actions'
import type { IdeaType } from '@/lib/types'

const IDLE: EditCatalogItemState = { error: null }

/** `IDEA_TYPE_NAME_MAX_LENGTH`, mirrored — `apps/web` may not import the domain package. */
const NAME_MAX = 100

/**
 * Renaming one idea type, plus archiving it.
 *
 * Two forms rather than one with two submit buttons, for the reason `StatusEditForm` gives: they
 * are separate Server Functions with separate refusals, and sharing one `useActionState` would
 * render the archive's failure above the name field.
 *
 * **The curated field count is shown and not editable.** Which fields a type asks for is
 * `PUT …/{id}/fields`, it replaces the whole selection at once, and putting it on this form would
 * mean a rename could quietly turn a curated type back into "every active field". Saying what the
 * current selection is, and where it is not changed, beats a control that looks complete.
 */
export function IdeaTypeEditForm({ ideaType }: { ideaType: IdeaType }) {
  const [saveState, save, saving] = useActionState(updateIdeaType, IDLE)
  const [archiveState, archive, archiving] = useActionState(deleteIdeaType, IDLE)

  return (
    <div className="flex flex-col gap-8">
      <form action={save} className="flex flex-col gap-1">
        {saveState.error ? (
          <Alert variant="destructive" className="mb-4">
            <span>{saveState.error}</span>
          </Alert>
        ) : null}

        <input type="hidden" name="ideaTypeId" value={ideaType.id} />

        <Field
          htmlFor="idea-type-name"
          label="Name"
          hint="The option people choose when they author an idea."
        >
          <Input
            id="idea-type-name"
            name="name"
            required
            maxLength={NAME_MAX}
            defaultValue={ideaType.name}
          />
        </Field>

        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          {ideaType.curatedFieldCount === null
            ? 'Shows every active custom field. Which fields a type asks for is set on its own screen, not here.'
            : `Shows ${String(ideaType.curatedFieldCount)} chosen fields. That selection is set on its own screen, not here.`}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Link href="/settings/idea-types" className="text-sm text-muted-foreground underline">
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

        <input type="hidden" name="ideaTypeId" value={ideaType.id} />

        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          Archiving takes this off the create-idea form. Ideas already of this type keep it, so
          nothing is lost — and the last remaining type cannot be archived.
        </p>
        <Button type="submit" variant="outline" disabled={archiving} className="w-fit">
          {archiving ? 'Archiving…' : 'Archive idea type'}
        </Button>
      </form>
    </div>
  )
}
