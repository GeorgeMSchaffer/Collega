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
} from '@collega/design-system'
import { useActionState } from 'react'
import { type CreateCatalogItemState, createIdeaType } from '@/lib/server/catalog-actions'

const IDLE: CreateCatalogItemState = { error: null, name: '' }

/** `IDEA_TYPE_NAME_MAX_LENGTH`, mirrored — `apps/web` may not import the domain package. */
const NAME_MAX = 100

/**
 * "Add idea type", in the same create-beside-the-list column comp P gives the status catalog.
 *
 * A name and nothing else, because that is the whole of `POST /organizations/{id}/idea-types`. The
 * two things comp P shows on a type — which custom fields it asks for, and its badge colour and
 * icon — are separate routes on the type itself (`PUT …/{id}/fields`, `PUT …/{id}/appearance`), and
 * a new type starts in `AllActiveFields` mode: it shows every active field without being told which.
 * So there is nothing to ask for here that would not be a second request pretending to be a field.
 *
 * No local state, unlike `StatusForm` — one uncontrolled input, and the server echoes it back when
 * a name is refused for already being taken.
 */
export function IdeaTypeForm() {
  const [state, submit, pending] = useActionState(createIdeaType, IDLE)

  return (
    <Card className="h-fit" id="add-idea-type">
      <CardHeader>
        <CardTitle>Add idea type</CardTitle>
      </CardHeader>
      <CardContent>
        {state.error ? (
          <Alert variant="destructive" className="mb-4">
            <span>{state.error}</span>
          </Alert>
        ) : null}

        <form action={submit}>
          <Field
            htmlFor="idea-type-name"
            label="Name"
            hint="Names are unique within an organization. A new type shows every active custom field until you narrow it."
          >
            <Input
              id="idea-type-name"
              name="name"
              required
              maxLength={NAME_MAX}
              defaultValue={state.name}
            />
          </Field>

          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending ? 'Adding…' : 'Add idea type'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
