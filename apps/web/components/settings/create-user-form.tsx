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
} from '@collega/design-system'
import { useActionState } from 'react'
import { PERSON_NAME_MAX_LENGTH } from '@/lib/limits'
import { type CreateState, createUser } from '@/lib/server/admin-actions'

const IDLE: CreateState = { error: null }

/**
 * The roles an organization user may be given.
 *
 * **`SiteAdmin` is absent, and not by omission.** `parseAssignableRole` in the users service
 * refuses it outright — a Site Admin is a platform account belonging to no organization, so it
 * cannot be assigned to one by anybody, including another Site Admin. Offering it here would render
 * a choice the API answers 400 for.
 */
const ROLES = ['OrgAdmin', 'User', 'ReadOnly'] as const

/**
 * Adding a person to an organization.
 *
 * Simplest form that works, for the reasons `create-organization-form.tsx` gives: no client
 * validation, no field-level error mapping, the API's refusal rendered as it arrives.
 *
 * **The administrator sets the initial password here; the API does not generate one.** That is the
 * opposite of the CSV import on the people screen, which mints a temporary password per row and
 * shows it once. So there is nothing for this form to reveal after a successful create — whoever
 * filled it in already knows the credential, and `CreateUserResult` carries no password field.
 *
 * The account is created with `mustChangePassword` set, so signing in with it lands on the
 * change-password screen. That is auth requirement 9 working rather than a fault, and it is worth
 * knowing before it happens in front of an audience.
 */
export function CreateUserForm({
  organizationId,
  organizations,
}: {
  /** The acting organization, or null for a Site Admin, who picks one below. */
  organizationId: string | null
  /** Every organization, for a Site Admin. Empty for anyone else, who may not read the list. */
  organizations: readonly { id: string; name: string }[]
}) {
  const [state, action, pending] = useActionState(createUser, IDLE)

  return (
    <Card>
      <CardHeader>
        <CardTitle>New user</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

          {/* The organization being administered. A target, not a claim — the API decides what the
              session may do with it, so a Site Admin choosing one here is authorized the same way an
              Org Admin's hidden value is. See admin-actions.ts's header. */}
          {organizationId === null ? (
            <Field htmlFor="user-organization" label="Organization">
              <Select id="user-organization" name="organizationId" required defaultValue="">
                <option value="" disabled>
                  Choose an organization…
                </option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="organizationId" value={organizationId} />
          )}

          <Field htmlFor="user-first-name" label="First name">
            <Input
              id="user-first-name"
              name="firstName"
              required
              maxLength={PERSON_NAME_MAX_LENGTH}
              autoComplete="given-name"
            />
          </Field>

          <Field htmlFor="user-last-name" label="Last name">
            <Input
              id="user-last-name"
              name="lastName"
              required
              maxLength={PERSON_NAME_MAX_LENGTH}
              autoComplete="family-name"
            />
          </Field>

          <Field htmlFor="user-email" label="Email">
            <Input id="user-email" name="email" type="email" required autoComplete="email" />
          </Field>

          <Field htmlFor="user-role" label="Role">
            <Select id="user-role" name="role" defaultValue="User" required>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>

          <Field htmlFor="user-initial-password" label="Initial password">
            {/* `new-password` so a browser offers to generate one rather than filling in the
                administrator's own credential, which is what `current-password` would invite. */}
            <Input
              id="user-initial-password"
              name="initialPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </Field>

          <p className="text-sm text-muted-foreground">
            Hand this password to the person directly — it is not shown again. They will be asked to
            change it the first time they sign in.
          </p>

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
