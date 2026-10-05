'use client'

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from '@collega/design-system'
import { useActionState, useEffect, useState } from 'react'
import { type CreateFieldState, createFieldDefinition } from '@/lib/server/catalog-actions'

const IDLE: CreateFieldState = {
  error: null,
  errors: {},
  name: '',
  description: '',
  fieldType: 'Text',
  required: false,
  created: false,
}

/** `FIELD_TYPES`, mirrored — `apps/web` may not import the domain package. */
const FIELD_TYPES = ['Text', 'Number', 'Date', 'Boolean', 'Dropdown', 'MultiSelect', 'Url']

/** The two types that own selectable options (`isOptionBackedFieldType`). */
const OPTION_BACKED = ['Dropdown', 'MultiSelect']

/** Mirrored limits — `apps/web` may not import the domain package. */
const NAME_MAX = 100
const DESCRIPTION_MAX = 500
const OPTION_LABEL_MAX = 200

/**
 * "Add field", beside the list as Statuses and Idea Types do it: a card on the page, not a drawer.
 *
 * The type is chosen here and fixed afterwards (`FieldEditForm` says so), which is why it is a
 * select on this form only. Choosing Dropdown or MultiSelect reveals the choices, since the API
 * wants at least one at create time; the rows are held in state so one can be added without a
 * round trip. Validation is the API's — its messages render beside the control they belong to.
 */
export function FieldForm() {
  const [state, submit, pending] = useActionState(createFieldDefinition, IDLE)
  const [fieldType, setFieldType] = useState('Text')
  const [options, setOptions] = useState<string[]>([''])

  // A refusal keeps what was typed; a success starts the form over.
  useEffect(() => {
    if (state.created) {
      setFieldType('Text')
      setOptions([''])
    }
  }, [state])

  const takesOptions = OPTION_BACKED.includes(fieldType)
  const optionError =
    state.errors.fieldDefinition ??
    Object.entries(state.errors).find(([key]) => key.startsWith('options['))?.[1]
  // A refusal with no control to sit beside is shown above the form rather than lost.
  const placed = new Set(['name', 'description', 'fieldType', 'fieldDefinition'])
  const unplaced =
    state.error !== null &&
    Object.keys(state.errors).every((key) => !placed.has(key) && !key.startsWith('options['))
  const bannerText = optionError && !takesOptions ? optionError : state.error

  return (
    <Card className="h-fit" id="add-field">
      <CardHeader>
        <CardTitle>Add field</CardTitle>
      </CardHeader>
      <CardContent>
        {bannerText && (unplaced || (optionError && !takesOptions)) ? (
          <Alert variant="destructive" className="mb-4">
            <span>{bannerText}</span>
          </Alert>
        ) : null}

        <form action={submit}>
          <Field htmlFor="new-field-name" label="Name" error={state.errors.name}>
            <Input
              id="new-field-name"
              name="name"
              required
              maxLength={NAME_MAX}
              defaultValue={state.name}
            />
          </Field>

          <Field
            htmlFor="new-field-type"
            label="Type"
            hint="Fixed once the field is created."
            error={state.errors.fieldType}
          >
            <Select
              id="new-field-type"
              name="fieldType"
              value={fieldType}
              onChange={(event) => setFieldType(event.target.value)}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="new-field-description"
            label="Description"
            hint="Shown beside the field when somebody fills it in."
            error={state.errors.description}
          >
            <Textarea
              id="new-field-description"
              name="description"
              rows={2}
              maxLength={DESCRIPTION_MAX}
              defaultValue={state.description}
            />
          </Field>

          <label className="mb-4 flex items-center gap-2 text-sm" htmlFor="new-field-required">
            <input
              id="new-field-required"
              name="isRequired"
              type="checkbox"
              defaultChecked={state.required}
              className="size-4"
            />
            Required — an idea cannot be saved without it
          </label>

          {takesOptions ? (
            <fieldset className="m-0 mb-4 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 text-sm font-medium">Choices</legend>
              {options.map((label, index) => (
                <Input
                  // Rows have no identity beyond position and are only ever appended.
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional rows, append-only
                  key={index}
                  name="optionLabel"
                  value={label}
                  maxLength={OPTION_LABEL_MAX}
                  aria-label={`Choice ${String(index + 1)}`}
                  onChange={(event) =>
                    setOptions(options.map((o, i) => (i === index ? event.target.value : o)))
                  }
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setOptions([...options, ''])}
              >
                Add a choice
              </Button>
              {optionError ? (
                <span role="alert" className="text-xs font-semibold text-destructive">
                  {optionError}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  A {fieldType} field needs at least one choice.
                </span>
              )}
            </fieldset>
          ) : null}

          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending ? 'Adding…' : 'Add field'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
