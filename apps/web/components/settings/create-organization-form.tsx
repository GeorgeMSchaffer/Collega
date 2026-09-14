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
import { ORGANIZATION_DESCRIPTION_MAX_LENGTH, ORGANIZATION_TITLE_MAX_LENGTH } from '@/lib/limits'
import { type CreateState, createOrganization } from '@/lib/server/admin-actions'

const IDLE: CreateState = { error: null }

/**
 * Creating the first tenant, which is the write that makes a fresh deployment usable at all.
 *
 * **Deliberately the simplest form that works.** No client-side validation, no optimistic state, no
 * per-field error mapping — the API already enforces every rule and its refusal is rendered
 * verbatim. Two reasons, and both are about what happens next rather than what happens now: this
 * screen is expected to be revised once someone has used it, so the half that would be thrown away
 * is not written; and an API message that reads badly is only noticed when somebody sees it, which
 * is likelier during a demo than during a code review.
 *
 * Only `title` and `description` are asked for. The API accepts a full profile — address, contact,
 * phone — and requires none of it, so the form asks for what it must and leaves the rest to the
 * organization's own settings screen, which already edits them.
 */
export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganization, IDLE)

  return (
    <Card>
      <CardHeader>
        <CardTitle>New organization</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

          <Field htmlFor="organization-title" label="Name">
            <Input
              id="organization-title"
              name="title"
              required
              maxLength={ORGANIZATION_TITLE_MAX_LENGTH}
              autoComplete="organization"
            />
          </Field>

          <Field htmlFor="organization-description" label="Description">
            <Textarea
              id="organization-description"
              name="description"
              required
              rows={3}
              maxLength={ORGANIZATION_DESCRIPTION_MAX_LENGTH}
            />
          </Field>

          <p className="text-sm text-muted-foreground">
            Creating an organization also provisions its first board and its default status catalog,
            so there is nothing to set up afterwards — it is ready for its first idea.
          </p>

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create organization'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
