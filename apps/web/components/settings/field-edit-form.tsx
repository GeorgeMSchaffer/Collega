'use client'

import { Alert, Badge, Button, Field, Input, Textarea } from '@collega/design-system'
import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import {
  deleteFieldDefinition,
  type EditCatalogItemState,
  updateFieldDefinition,
} from '@/lib/server/catalog-actions'
import type { FieldDefinitionDetail } from '@/lib/types'

const IDLE: EditCatalogItemState = { error: null }

/** `FIELD_NAME_MAX_LENGTH` and friends, mirrored — `apps/web` may not import the domain package. */
const NAME_MAX = 100
const DESCRIPTION_MAX = 500
const OPTION_LABEL_MAX = 100

/** The two types that own selectable options (`isOptionBackedFieldType`). */
const OPTION_BACKED = ['Dropdown', 'MultiSelect']

/**
 * Editing one custom field.
 *
 * ## Why every option is on screen
 *
 * `PUT` replaces the option list rather than merging into it, and an option's id is what every idea
 * value already recorded against it points to. So an option left off the form is not left alone —
 * it is deleted, and those values go with it. Rendering all of them, each carrying its id in a
 * hidden input, is what makes saving a renamed field safe.
 *
 * "Add a choice" appends a row without an id, which the server treats as new; left blank, the
 * action drops it before sending, because the API marks every option label required and an
 * untouched row would otherwise be a 400. "Remove" drops a row from the form, and an existing
 * option missing from the post is deleted by the server.
 *
 * ## What is shown and not editable
 *
 * The field type. `FieldDefinitionService.update` refuses to change it after creation outright —
 * the values already stored are typed by it — so it is rendered as a badge and posted back
 * unchanged rather than offered as a select that answers 400.
 */
export function FieldEditForm({ field }: { field: FieldDefinitionDetail }) {
  const [saveState, save, saving] = useActionState(updateFieldDefinition, IDLE)
  const [archiveState, archive, archiving] = useActionState(deleteFieldDefinition, IDLE)

  const takesOptions = OPTION_BACKED.includes(field.fieldType)
  // `key` is stable per row so removing one doesn't shift the typed text of the rest.
  const nextKey = useRef(0)
  const newRow = () => ({ key: `new-${String(nextKey.current++)}`, id: '', label: '' })
  const [rows, setRows] = useState(() =>
    takesOptions
      ? [...field.options.map((o) => ({ key: o.id, id: o.id, label: o.label })), newRow()]
      : [],
  )

  return (
    <div className="flex flex-col gap-8">
      <form action={save} className="flex flex-col gap-4">
        {saveState.error ? <Alert variant="destructive">{saveState.error}</Alert> : null}

        <input type="hidden" name="fieldDefinitionId" value={field.id} />
        <input type="hidden" name="fieldType" value={field.fieldType} />
        <input type="hidden" name="displayOrder" value={field.displayOrder} />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Type</span>
          <Badge variant="outline">{field.fieldType}</Badge>
          <span>— set when the field was created and fixed after that.</span>
        </div>

        <Field htmlFor="field-name" label="Name">
          <Input
            id="field-name"
            name="name"
            required
            maxLength={NAME_MAX}
            defaultValue={field.name}
          />
        </Field>

        <Field
          htmlFor="field-description"
          label="Description"
          hint="Shown beside the field when somebody fills it in."
        >
          <Textarea
            id="field-description"
            name="description"
            rows={2}
            maxLength={DESCRIPTION_MAX}
            defaultValue={field.description ?? ''}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm" htmlFor="field-required">
          <input
            id="field-required"
            name="isRequired"
            type="checkbox"
            defaultChecked={field.required}
            className="size-4"
          />
          Required — an idea cannot be saved without it
        </label>

        {takesOptions ? (
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Choices</legend>
            <p className="m-0 max-w-prose text-sm text-muted-foreground">
              Removing a choice deletes it, along with the answers ideas have already given using
              it. Rows left blank are ignored.
            </p>
            {rows.map((row, index) => (
              <div key={row.key} className="flex items-center gap-2">
                <input type="hidden" name="optionId" value={row.id} />
                <Input
                  name="optionLabel"
                  value={row.label}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  maxLength={OPTION_LABEL_MAX}
                  aria-label={`Choice ${String(index + 1)}`}
                  placeholder={row.id ? undefined : 'New choice'}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Remove choice ${String(index + 1)}`}
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setRows((rs) => [...rs, newRow()])}
            >
              Add a choice
            </Button>
          </fieldset>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Link href="/settings/fields" className="text-sm text-muted-foreground underline">
            Cancel
          </Link>
        </div>
      </form>

      <form action={archive} className="flex flex-col gap-2 border-t pt-6">
        {archiveState.error ? <Alert variant="destructive">{archiveState.error}</Alert> : null}

        <input type="hidden" name="fieldDefinitionId" value={field.id} />

        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          Archiving stops this field being asked for. The answers ideas have already given keep
          resolving, so nothing recorded is lost.
        </p>
        <Button type="submit" variant="outline" disabled={archiving} className="w-fit">
          {archiving ? 'Archiving…' : 'Archive field'}
        </Button>
      </form>
    </div>
  )
}
