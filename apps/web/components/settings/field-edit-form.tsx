'use client'

import { Alert, Badge, Button, Field, Input, Textarea } from '@collega/design-system'
import Link from 'next/link'
import { useActionState } from 'react'
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
 * One blank row is appended so an option can be added without a separate screen. It has no id, so
 * the server treats a filled one as new; left blank, the action drops it before sending, because
 * the API marks every option label required and an untouched row would otherwise be a 400.
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
  const rows = takesOptions ? [...field.options, { id: '', label: '', displayOrder: 0 }] : []

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
              Clearing a choice removes it, along with the answers ideas have already given using
              it. The empty row at the end adds one.
            </p>
            {rows.map((option, index) => (
              <div
                // The id for existing rows; the trailing blank row is the only one without one and
                // there is never more than one of it.
                key={option.id || 'new'}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="optionId" value={option.id} />
                <Input
                  name="optionLabel"
                  defaultValue={option.label}
                  maxLength={OPTION_LABEL_MAX}
                  aria-label={option.id ? `Choice ${String(index + 1)}` : 'Add a choice'}
                  placeholder={option.id ? undefined : 'Add a choice'}
                />
              </div>
            ))}
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
