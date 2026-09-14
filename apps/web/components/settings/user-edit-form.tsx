'use client'

import { Alert, Button, Field, Input, Select } from '@collega/design-system'
import Link from 'next/link'
import { useActionState } from 'react'
import { PERSON_NAME_MAX_LENGTH } from '@/lib/limits'
import { type CreateState, updateUser } from '@/lib/server/admin-actions'
import type { MemberDetail } from '@/lib/types'

const IDLE: CreateState = { error: null }

/**
 * The roles an organization user may hold — the same three the create form offers, and absent for
 * the same reason: `parseAssignableRole` refuses `SiteAdmin` outright, because a platform account
 * belongs to no organization and cannot be assigned to one by anybody.
 *
 * **Which means a Site Admin's own row cannot be saved from here**, and the page that renders this
 * says so rather than offering a role picker that has no correct answer.
 */
const ROLES = ['OrgAdmin', 'User', 'ReadOnly'] as const

/** Both spellings the API accepts, and the only two `users.status` holds. */
const STATUSES = ['Active', 'Inactive'] as const

/**
 * Editing one account.
 *
 * **Deactivating is a status, not a delete** — there is no user delete route in the API at all, and
 * that is correct for a product that attributes ideas and comments to people. An inactive account
 * is refused at sign-in and everything it wrote keeps resolving, so the destructive-looking choice
 * here is the reversible one.
 *
 * No password control. Resetting is its own route, it answers with a credential that can never be
 * retrieved again, and pairing it with a surname correction would make a one-way action a side
 * effect of an everyday save.
 */
export function UserEditForm({ member }: { member: MemberDetail }) {
  const [state, save, saving] = useActionState(updateUser, IDLE)

  return (
    <form action={save} className="flex flex-col gap-4">
      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

      <input type="hidden" name="userId" value={member.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field htmlFor="user-first-name" label="First name">
          <Input
            id="user-first-name"
            name="firstName"
            required
            maxLength={PERSON_NAME_MAX_LENGTH}
            defaultValue={member.firstName}
            autoComplete="given-name"
          />
        </Field>
        <Field htmlFor="user-last-name" label="Last name">
          <Input
            id="user-last-name"
            name="lastName"
            required
            maxLength={PERSON_NAME_MAX_LENGTH}
            defaultValue={member.lastName}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field
        htmlFor="user-email"
        label="Email"
        hint="This is what they sign in with. Changing it changes their credential."
      >
        <Input
          id="user-email"
          name="email"
          type="email"
          required
          defaultValue={member.email}
          autoComplete="email"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field htmlFor="user-role" label="Role">
          <Select id="user-role" name="role" required defaultValue={member.role}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          htmlFor="user-status"
          label="Status"
          hint="Inactive refuses sign-in. Everything they wrote keeps resolving."
        >
          <Select id="user-status" name="status" required defaultValue={member.status}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {member.mustChangePassword ? (
        <p className="m-0 text-sm text-muted-foreground">
          This account still has to change its password at its next sign-in. Saving here does not
          clear that.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Link href="/settings/users" className="text-sm text-muted-foreground underline">
          Cancel
        </Link>
      </div>
    </form>
  )
}
