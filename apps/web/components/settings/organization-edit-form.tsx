'use client'

import { Alert, Button, Field, Input, Textarea } from '@collega/design-system'
import Link from 'next/link'
import { useActionState } from 'react'
import { ORGANIZATION_DESCRIPTION_MAX_LENGTH, ORGANIZATION_TITLE_MAX_LENGTH } from '@/lib/limits'
import {
  archiveOrganization,
  type CreateState,
  updateOrganization,
} from '@/lib/server/admin-actions'
import type { OrganizationDetail } from '@/lib/types'

const IDLE: CreateState = { error: null }

/**
 * Editing one organization, and archiving it.
 *
 * **Every profile field is on this form because the API replaces rather than patches.** A field
 * left off would be written as null on the next save, so "ask for what you need" is the wrong
 * instinct here — the form's job is to round-trip the record, not to collect a change. That is why
 * an empty address still renders an empty box rather than being hidden.
 *
 * The maximum lengths come from `lib/limits.ts`, which mirrors the domain's constants because
 * `apps/web` may not import them. They are a courtesy — the API enforces the same numbers and its
 * refusal renders above the fields either way.
 */
export function OrganizationEditForm({ organization }: { organization: OrganizationDetail }) {
  const [saveState, save, saving] = useActionState(updateOrganization, IDLE)
  const [archiveState, archive, archiving] = useActionState(archiveOrganization, IDLE)

  return (
    <div className="flex flex-col gap-8">
      <form action={save} className="flex flex-col gap-4">
        {saveState.error ? <Alert variant="destructive">{saveState.error}</Alert> : null}

        <input type="hidden" name="organizationId" value={organization.id} />

        <Field htmlFor="organization-title" label="Name">
          <Input
            id="organization-title"
            name="title"
            required
            maxLength={ORGANIZATION_TITLE_MAX_LENGTH}
            defaultValue={organization.name}
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
            defaultValue={organization.description}
          />
        </Field>

        <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">Contact</legend>

          <Field htmlFor="organization-address" label="Address">
            <Input
              id="organization-address"
              name="address"
              defaultValue={organization.address ?? ''}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field htmlFor="organization-city" label="City">
              <Input id="organization-city" name="city" defaultValue={organization.city ?? ''} />
            </Field>
            <Field htmlFor="organization-state" label="State">
              <Input id="organization-state" name="state" defaultValue={organization.state ?? ''} />
            </Field>
            <Field htmlFor="organization-zip" label="ZIP">
              <Input id="organization-zip" name="zip" defaultValue={organization.zip ?? ''} />
            </Field>
          </div>

          <Field htmlFor="organization-phone" label="Phone">
            <Input
              id="organization-phone"
              name="phone"
              type="tel"
              defaultValue={organization.phone ?? ''}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field htmlFor="organization-contact-first" label="Primary contact first name">
              <Input
                id="organization-contact-first"
                name="primaryContactFirstName"
                defaultValue={organization.primaryContactFirstName ?? ''}
              />
            </Field>
            <Field htmlFor="organization-contact-last" label="Primary contact last name">
              <Input
                id="organization-contact-last"
                name="primaryContactLastName"
                defaultValue={organization.primaryContactLastName ?? ''}
              />
            </Field>
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Link href="/settings/organizations" className="text-sm text-muted-foreground underline">
            Cancel
          </Link>
        </div>
      </form>

      {organization.isArchived ? (
        <p className="m-0 border-t pt-6 text-sm text-muted-foreground">
          This organization is archived. It still appears on the list, and its people, boards and
          ideas all still resolve.
        </p>
      ) : (
        <form action={archive} className="flex flex-col gap-2 border-t pt-6">
          {archiveState.error ? <Alert variant="destructive">{archiveState.error}</Alert> : null}

          <input type="hidden" name="organizationId" value={organization.id} />

          <p className="m-0 max-w-prose text-sm text-muted-foreground">
            Archiving stops this organization being somewhere new work is filed. Its people, boards
            and ideas keep resolving, and the list marks it rather than hiding it.
          </p>
          <Button type="submit" variant="outline" disabled={archiving} className="w-fit">
            {archiving ? 'Archiving…' : 'Archive organization'}
          </Button>
        </form>
      )}
    </div>
  )
}
