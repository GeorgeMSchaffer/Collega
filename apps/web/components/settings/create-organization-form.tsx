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
import {
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
  ORGANIZATION_TITLE_MAX_LENGTH,
  PERSON_NAME_MAX_LENGTH,
} from '@/lib/limits'
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
 * The profile — address, contact, phone — is not asked for here. The API requires none of it, so
 * this form asks for what it must and leaves the rest to `OrganizationEditForm`, reached from the
 * list's Manage control. Until 2026-09-14 that form did not exist and this comment claimed it did.
 *
 * **The first administrator is asked for, and that is the important half.** A Site Admin cannot add
 * people to an organization they are not in, and View as can only target an existing member — so an
 * organization created empty cannot be populated by anybody. Offering the administrator here is
 * what keeps that state from being reachable; `createOrganization` explains the loop in full.
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

          <fieldset className="m-0 flex flex-col gap-4 border-0 border-t p-0 pt-5">
            <legend className="sr-only">First administrator</legend>
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-sm font-semibold">Its first administrator</h3>
              <p className="m-0 text-sm text-muted-foreground">
                Strongly recommended, and close to required in practice.{' '}
                <strong className="font-semibold">
                  You cannot add people to an organization you are not in
                </strong>{' '}
                — a Site Admin reaches organization content through View as, and View as can only
                target somebody who is already a member. An organization created empty has nobody to
                become that first member.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field htmlFor="admin-first-name" label="First name">
                <Input
                  id="admin-first-name"
                  name="adminFirstName"
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  autoComplete="off"
                />
              </Field>
              <Field htmlFor="admin-last-name" label="Last name">
                <Input
                  id="admin-last-name"
                  name="adminLastName"
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  autoComplete="off"
                />
              </Field>
            </div>

            <Field
              htmlFor="admin-email"
              label="Email"
              hint="Leave blank to create the organization on its own. Everything else here is ignored if you do."
            >
              <Input id="admin-email" name="adminEmail" type="email" autoComplete="off" />
            </Field>

            <Field
              htmlFor="admin-password"
              label="Initial password"
              hint="They are asked to change it the first time they sign in."
            >
              <Input id="admin-password" name="adminPassword" type="text" autoComplete="off" />
            </Field>
          </fieldset>

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
