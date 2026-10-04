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
  Textarea,
} from '@collega/design-system'
import { useActionState } from 'react'
import { type CreateFieldsetState, createFieldset } from '@/lib/server/catalog-actions'

const IDLE: CreateFieldsetState = {
  error: null,
  errors: {},
  name: '',
  description: '',
  created: false,
}

/** The name and description limits, mirrored — `apps/web` may not import the domain package. */
const NAME_MAX = 100
const DESCRIPTION_MAX = 500

/**
 * "Add fieldset", beside the list as Fields and Idea Types do it. A name and a description only:
 * which fields belong to the set is chosen on its edit screen, because membership is a separate
 * route and a new set starts empty.
 */
export function FieldsetForm() {
  const [state, submit, pending] = useActionState(createFieldset, IDLE)
  const unplaced = state.error !== null && !state.errors.name && !state.errors.description

  return (
    <Card className="h-fit" id="add-fieldset">
      <CardHeader>
        <CardTitle>Add fieldset</CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-live="polite">
          {unplaced ? (
            <Alert variant="destructive" className="mb-4">
              <span>{state.error}</span>
            </Alert>
          ) : null}
        </div>

        <form action={submit}>
          <Field htmlFor="new-fieldset-name" label="Name" error={state.errors.name}>
            <Input
              id="new-fieldset-name"
              name="name"
              required
              maxLength={NAME_MAX}
              defaultValue={state.name}
            />
          </Field>

          <Field
            htmlFor="new-fieldset-description"
            label="Description"
            hint="What the group is for. Choose its fields after adding it."
            error={state.errors.description}
          >
            <Textarea
              id="new-fieldset-description"
              name="description"
              rows={2}
              maxLength={DESCRIPTION_MAX}
              defaultValue={state.description}
            />
          </Field>

          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add fieldset'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
