'use client'

import { Alert, Button, Input, Tag } from '@collega/design-system'
import { useActionState, useState } from 'react'
import { type EditCatalogItemState, saveIdeaTypeFields } from '@/lib/server/catalog-actions'
import type { FieldDefinition, Fieldset, IdeaType } from '@/lib/types'
import { moveItem, ReorderButtons } from './reorder-buttons'

const IDLE: EditCatalogItemState = { error: null }

type Direct = { id: string; required: boolean }

/**
 * Which fields an idea type asks for: individual fields, fieldsets, or neither.
 *
 * Two panes. The left lists what can be added (fields and fieldsets, searchable); the right is the
 * selection. Direct fields carry a per-type Required flag and an order. A fieldset is a live
 * reference, so it is shown as a chip with its members listed read-only — they are edited on the
 * set, not here, and a fieldset's fields use each field's own required flag.
 *
 * An empty selection is a meaningful state, not a blank one: the type shows every active field.
 * Saving it sends empty arrays, which is exactly how the API clears a curated type back to that.
 *
 * One form, one Save: `PUT …/fields` replaces the fields and the fieldset ids together, so they
 * travel together. State is posted as parallel hidden inputs (`fieldDefinitionId`/`fieldRequired`,
 * `fieldsetId`) in display order; `saveIdeaTypeFields` turns them into the request.
 *
 * A field that is both selected directly and inside an attached set appears once on the idea, with
 * the direct entry winning (and its per-type Required), so the left pane says so rather than
 * hiding the overlap.
 */
export function IdeaTypeFieldsPicker({
  ideaType,
  fields,
  fieldsets,
}: {
  ideaType: IdeaType
  /** The organization's active fields. */
  fields: FieldDefinition[]
  fieldsets: Fieldset[]
}) {
  const [state, save, saving] = useActionState(saveIdeaTypeFields, IDLE)
  const [direct, setDirect] = useState<Direct[]>(
    ideaType.fields.map((field) => ({ id: field.fieldDefinitionId, required: field.isRequired })),
  )
  const [setIds, setSetIds] = useState<string[]>(ideaType.fieldsets.map((set) => set.id))
  const [query, setQuery] = useState('')

  const fieldById = new Map(fields.map((field) => [field.id, field]))
  const setById = new Map(fieldsets.map((set) => [set.id, set]))
  const attached = setIds.flatMap((id) => setById.get(id) ?? [])
  const needle = query.trim().toLowerCase()
  const matches = (name: string) => needle === '' || name.toLowerCase().includes(needle)

  const directIds = new Set(direct.map((entry) => entry.id))
  const availableFields = fields.filter((field) => !directIds.has(field.id) && matches(field.name))
  const availableSets = fieldsets.filter((set) => !setIds.includes(set.id) && matches(set.name))

  const setsHolding = (fieldId: string) =>
    attached.filter((set) => set.fields.some((member) => member.id === fieldId))

  const empty = direct.length === 0 && setIds.length === 0

  return (
    <form action={save} className="flex flex-col gap-4">
      <input type="hidden" name="ideaTypeId" value={ideaType.id} />
      {direct.map((entry) => (
        <span key={entry.id} hidden>
          <input type="hidden" name="fieldDefinitionId" value={entry.id} />
          <input type="hidden" name="fieldRequired" value={entry.required ? '1' : '0'} />
        </span>
      ))}
      {setIds.map((id) => (
        <input key={id} type="hidden" name="fieldsetId" value={id} />
      ))}

      <div aria-live="polite">
        {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-labelledby="picker-available" className="flex flex-col gap-3">
          <h2 id="picker-available" className="m-0 text-sm font-medium">
            Available
          </h2>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fields and fieldsets"
            aria-label="Search fields and fieldsets"
          />

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-xs font-medium uppercase text-muted-foreground">Fieldsets</h3>
            {availableSets.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                {fieldsets.length === 0
                  ? 'The organization has no fieldsets yet.'
                  : needle === ''
                    ? 'Every fieldset is already on this type.'
                    : 'No fieldset matches.'}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {availableSets.map((set) => (
                  <li
                    key={set.id}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{set.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {set.fields.length} {set.fields.length === 1 ? 'field' : 'fields'}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Add fieldset ${set.name}`}
                      onClick={() => setSetIds([...setIds, set.id])}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-xs font-medium uppercase text-muted-foreground">Fields</h3>
            {availableFields.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                {fields.length === 0
                  ? 'The organization has no custom fields yet.'
                  : needle === ''
                    ? 'Every field is already chosen.'
                    : 'No field matches.'}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {availableFields.map((field) => {
                  const via = setsHolding(field.id)
                  return (
                    <li
                      key={field.id}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{field.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {field.fieldType}
                          {via.length > 0
                            ? ` · already in ${via.map((set) => set.name).join(', ')}`
                            : ''}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Add field ${field.name}`}
                        onClick={() =>
                          setDirect([...direct, { id: field.id, required: field.required }])
                        }
                      >
                        Add
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="picker-selected" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="picker-selected" className="m-0 text-sm font-medium">
              On this type
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={empty}
              onClick={() => {
                setDirect([])
                setSetIds([])
              }}
            >
              Clear all
            </Button>
          </div>

          {empty ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <p className="m-0 font-medium text-foreground">All active fields</p>
              <p className="m-0 mt-1">
                Nothing is chosen, so ideas of this type show every active custom field. Add a field
                or a fieldset to show only those.
              </p>
            </div>
          ) : null}

          {setIds.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-xs font-medium uppercase text-muted-foreground">Fieldsets</h3>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                {setIds.map((id, index) => {
                  const set = setById.get(id)
                  const name = set?.name ?? 'Unavailable fieldset'
                  return (
                    <li key={id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                        <ReorderButtons
                          what={`fieldset ${name}`}
                          index={index}
                          count={setIds.length}
                          onMove={(step) => setSetIds(moveItem(setIds, index, step))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Remove fieldset ${name}`}
                          onClick={() => setSetIds(setIds.filter((other) => other !== id))}
                        >
                          Remove
                        </Button>
                      </div>
                      <p className="m-0 mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {set === undefined || set.fields.length === 0 ? (
                          'No fields in this set.'
                        ) : (
                          <>
                            {set.fields.map((member) => (
                              <Tag key={member.id}>
                                {member.isActive ? member.name : `${member.name} (archived)`}
                              </Tag>
                            ))}
                          </>
                        )}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}

          {direct.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-xs font-medium uppercase text-muted-foreground">Fields</h3>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                {direct.map((entry, index) => {
                  const name = fieldById.get(entry.id)?.name ?? 'Unavailable field'
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={entry.required}
                          aria-label={`${name} is required on this type`}
                          onChange={(event) =>
                            setDirect(
                              direct.map((other) =>
                                other.id === entry.id
                                  ? { ...other, required: event.target.checked }
                                  : other,
                              ),
                            )
                          }
                        />
                        Required
                      </label>
                      <ReorderButtons
                        what={name}
                        index={index}
                        count={direct.length}
                        onMove={(step) => setDirect(moveItem(direct, index, step))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Remove field ${name}`}
                        onClick={() => setDirect(direct.filter((other) => other.id !== entry.id))}
                      >
                        Remove
                      </Button>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}

          <p className="m-0 text-xs text-muted-foreground">
            On the idea form the direct fields come first, then each fieldset in this order. Fields
            from a fieldset use the field&apos;s own Required setting.
          </p>
        </section>
      </div>

      <div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save fields'}
        </Button>
      </div>
    </form>
  )
}
