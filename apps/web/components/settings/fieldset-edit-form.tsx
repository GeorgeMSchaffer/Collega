'use client'

import { Alert, Badge, Button, Field, Input, Tag, Textarea } from '@collega/design-system'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import {
  deleteFieldset,
  type EditCatalogItemState,
  updateFieldset,
} from '@/lib/server/catalog-actions'
import type { FieldDefinition, Fieldset } from '@/lib/types'
import { moveItem, ReorderButtons } from './reorder-buttons'

const IDLE: EditCatalogItemState = { error: null }

/** Mirrored limits — `apps/web` may not import the domain package. */
const NAME_MAX = 100
const DESCRIPTION_MAX = 500

type Member = { id: string; name: string; fieldType: string; isActive: boolean }

/**
 * Editing one fieldset: its name, description, and which fields it holds, in order.
 *
 * ## It is a live reference
 *
 * Saving changes every idea type that attaches this set, at once — the note on the form says so,
 * with the count, because that is the consequence an administrator cannot see from this screen.
 *
 * ## Archived members
 *
 * The API keeps a membership when its field is archived and skips the field wherever fields
 * resolve, but refuses an archived id in the replacement list. So they are shown, marked, and left
 * out of what is posted: saving drops them, and the form says that.
 *
 * ## Delete
 *
 * Hard, and refused with a 409 while any idea type has the set attached. The button is not
 * disabled on the count — the API is the authority, and its message is what the form shows.
 */
export function FieldsetEditForm({
  fieldset,
  fields,
}: {
  fieldset: Fieldset
  /** The organization's active fields, for the picker. */
  fields: FieldDefinition[]
}) {
  const [saveState, save, saving] = useActionState(updateFieldset, IDLE)
  const [deleteState, remove, deleting] = useActionState(deleteFieldset, IDLE)
  const [members, setMembers] = useState<Member[]>(fieldset.fields)

  const memberIds = new Set(members.map((member) => member.id))
  const available = fields.filter((field) => !memberIds.has(field.id))
  const archivedCount = members.filter((member) => !member.isActive).length
  const usedBy = fieldset.usedByIdeaTypeCount

  return (
    <div className="flex flex-col gap-8">
      <form action={save} className="flex flex-col gap-4">
        <div aria-live="polite">
          {saveState.error ? <Alert variant="destructive">{saveState.error}</Alert> : null}
        </div>

        <input type="hidden" name="fieldsetId" value={fieldset.id} />

        <Field htmlFor="fieldset-name" label="Name">
          <Input
            id="fieldset-name"
            name="name"
            required
            maxLength={NAME_MAX}
            defaultValue={fieldset.name}
          />
        </Field>

        <Field htmlFor="fieldset-description" label="Description">
          <Textarea
            id="fieldset-description"
            name="description"
            rows={2}
            maxLength={DESCRIPTION_MAX}
            defaultValue={fieldset.description ?? ''}
          />
        </Field>

        <section aria-labelledby="fieldset-members" className="flex flex-col gap-3">
          <h2 id="fieldset-members" className="m-0 text-sm font-medium">
            Fields in this set
          </h2>

          {members.length === 0 ? (
            <p className="m-0 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No fields yet. Add some from the list below.
            </p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {members.map((member, index) => (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  {member.isActive ? (
                    <input type="hidden" name="fieldDefinitionId" value={member.id} />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
                  <span className="text-muted-foreground">{member.fieldType}</span>
                  {member.isActive ? null : <Badge variant="outline">Archived</Badge>}
                  <ReorderButtons
                    what={member.name}
                    index={index}
                    count={members.length}
                    onMove={(step) => setMembers(moveItem(members, index, step))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => setMembers(members.filter((m) => m.id !== member.id))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ol>
          )}

          {archivedCount > 0 ? (
            <p className="m-0 max-w-prose text-sm text-muted-foreground">
              Archived fields are skipped on ideas and are dropped from the set when you save.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-medium">Add a field</h3>
            {available.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                {fields.length === 0
                  ? 'The organization has no custom fields yet. Add some under Custom fields.'
                  : 'Every field is already in this set.'}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {available.map((field) => (
                  <li key={field.id}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Add ${field.name}`}
                      onClick={() =>
                        setMembers([
                          ...members,
                          {
                            id: field.id,
                            name: field.name,
                            fieldType: field.fieldType,
                            isActive: true,
                          },
                        ])
                      }
                    >
                      + {field.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          {usedBy === 0 ? (
            'No idea type uses this set yet.'
          ) : (
            <>
              <Tag>{`Used by ${String(usedBy)} idea type${usedBy === 1 ? '' : 's'}`}</Tag> Saving
              changes the fields on every one of them at once; answers already given are kept.
            </>
          )}
        </p>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Link href="/settings/fieldsets" className="text-sm text-muted-foreground underline">
            Cancel
          </Link>
        </div>
      </form>

      <form action={remove} className="flex flex-col gap-2 border-t pt-6">
        <div aria-live="polite">
          {deleteState.error ? <Alert variant="destructive">{deleteState.error}</Alert> : null}
        </div>

        <input type="hidden" name="fieldsetId" value={fieldset.id} />

        <p className="m-0 max-w-prose text-sm text-muted-foreground">
          Deleting removes the set but not its fields. It is refused while an idea type still uses
          it.
        </p>
        <Button type="submit" variant="outline" disabled={deleting} className="w-fit">
          {deleting ? 'Deleting…' : 'Delete fieldset'}
        </Button>
      </form>
    </div>
  )
}
