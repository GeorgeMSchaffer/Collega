'use server'

/**
 * The administration writes the people screens make.
 *
 * ## Identity, and why an organization id is a parameter here
 *
 * Nothing below resolves a principal, for the reason `lib/server/idea-actions.ts` sets out at
 * length: `currentUser()` throws outside a render scope, and a Server Function runs outside one.
 * Identity travels as the session cookie `sessionHeader()` forwards, and the API decides what that
 * identity may do.
 *
 * The organization id is a *target*, exactly as `boardId` is on an idea write — the thing being
 * administered, not the claim about who is asking. It is bound by the component that rendered the
 * control, while that component was still inside a request, from the resolved principal. Posting a
 * different one changes nothing about authorization: an Org Admin naming another organization is
 * answered 404 and a plain User is answered 403, both by the API, which is the only thing enforcing
 * it. Nothing below consults a role.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { toImportOutcome } from '../api/adapt'
import { apiPath } from '../api/client'
import { apiBaseUrl } from '../api/config'
import { fieldErrors, type ProblemDetails } from '../api/problem'
import type { WireUserImportResult } from '../api/wire'
import type { ImportOutcome } from '../types'
import { sessionHeader } from './current-user'

/**
 * What the import form renders back.
 *
 * `outcome` is the whole of comp P's "Last import" panel, and it lives here rather than behind a
 * reader because nothing can read it back — see the note where `getLastImport` used to be in
 * `lib/data/admin.ts`. It carries the temporary passwords the import generated, which is the one
 * thing on this screen that must reach the person who ran it: they are shown once and are gone.
 * That is not the password echo `auth-actions.ts` forbids — nothing here was typed into a form, and
 * a generated credential the admin has to hand over is the entire product of the write.
 *
 * `errors` is keyed by the API's own field name, `csvFile`, which is the `name` the file input
 * posts — so the message lands beside the control rather than in a banner.
 */
export type ImportState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  outcome: ImportOutcome | null
}

/**
 * The refusal for a body the request pipeline stopped before the handler ran.
 *
 * `multer` aborts the upload at its `fileSize` limit and Nest renders that as a framework `413`,
 * whose body says "File too large" and names no field — so the controller's own size check is
 * unreachable and there is no `errors` bag to key a message from. The sentence is written here
 * instead, in the terms the person can act on: the bound, and that nothing was imported. Both
 * shapes were checked against a live API before this was written.
 *
 * The 5 MB figure is the API's (`SPEC/30-Contracts.md`, bounded 2026-09-10) and is repeated rather
 * than derived, because `apps/web` cannot import the constant across the layer boundary.
 */
const TOO_LARGE =
  'That file is larger than the 5 MB this import accepts, so nothing was imported. Split it into smaller files and import them one at a time.'

/**
 * Bulk-create accounts in `organizationId` from an uploaded CSV.
 *
 * `fetch` directly rather than through `apiPost`, for two reasons that compound: the request is
 * `multipart/form-data` where `apiPost` sends JSON, and both of this endpoint's designed refusals
 * need more of the response than a thrown `ApiError` keeps. The row-ceiling `400` carries its
 * message in the `errors` bag keyed on `csvFile`, and the `413` carries no useful body at all.
 *
 * **No `content-type` header.** `fetch` sets it from the `FormData`, including the multipart
 * boundary, and a hand-written one omits the boundary and makes the body unparseable.
 *
 * A partly bad file is a **success**, not a refusal: invalid rows are rejected individually and the
 * rest still import, which is why the outcome table names each row rather than the banner naming a
 * file. Only a missing file, a file over either bound, or a refusal of the whole request fails.
 */
export async function importUsers(_previous: ImportState, form: FormData): Promise<ImportState> {
  const organizationId = String(form.get('organizationId') ?? '')
  const file = form.get('csvFile')

  // Not defensive: submitting the form with nothing chosen posts an empty `File`, and the browser
  // is the only thing that could have stopped it. Asking the API to reject an empty body would cost
  // a round trip to be told what is already known here.
  if (!(file instanceof File) || file.size === 0) {
    return {
      error: 'Choose a CSV file to import.',
      errors: { csvFile: 'A CSV file is required.' },
      outcome: null,
    }
  }

  const body = new FormData()
  body.set('csvFile', file)

  const response = await fetch(
    `${apiBaseUrl()}${apiPath`/organizations/${organizationId}/users/import`}`,
    {
      method: 'POST',
      headers: { accept: 'application/json', ...(await sessionHeader()) },
      body,
      cache: 'no-store',
    },
  )

  if (response.status === 413) {
    return { error: TOO_LARGE, errors: { csvFile: TOO_LARGE }, outcome: null }
  }

  if (response.status === 400) {
    const problem = (await response.json()) as ProblemDetails
    return {
      error: 'That file could not be imported. Nothing was created.',
      errors: fieldErrors(problem.errors),
      outcome: null,
    }
  }

  // The session ended between this screen rendering and the file being chosen.
  if (response.status === 401) redirect('/login?expired=1')

  // The API refusing the caller or the organization — a member who reached the action past a
  // control they were not shown, or an administrator naming an organization outside their scope.
  // Its own words, for the reason `idea-actions.ts` gives: it is the only thing enforcing this.
  if (response.status === 403 || response.status === 404) {
    const problem = (await response.json()) as ProblemDetails
    return {
      error: typeof problem.detail === 'string' ? problem.detail : 'That import was refused.',
      errors: {},
      outcome: null,
    }
  }

  if (!response.ok) {
    throw new Error(`POST /organizations/{id}/users/import answered ${response.status}`)
  }

  const outcome = toImportOutcome((await response.json()) as WireUserImportResult)

  // The accounts it created belong on the users list, which is the screen this one is reached from.
  revalidatePath('/settings/users')

  return { error: null, errors: {}, outcome }
}
