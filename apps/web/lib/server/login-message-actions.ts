'use server'

/**
 * Sign-in messages' writes (`SPEC/20-feature-login-messages.md`): Settings → Sign-in messages'
 * create, edit, End now and delete (LMS-1, 2, 5, 7), and the desk's close and acknowledge (LMS-4).
 *
 * Identity follows `tag-actions.ts`: nothing here reads the principal beyond asking which
 * organization is acting. Who may write is the API's decision.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPath,
  apiPost,
  apiPostReturning,
  apiPut,
} from '../api/client'
import type { WireLoginMessage } from '../api/wire'
import { actingOrganizationId } from './current-user'

/** What the message form renders back; `errors` is the API's field-keyed 400. */
export type LoginMessageFormState = {
  error: string | null
  errors: Readonly<Record<string, string>>
  savedId: string | null
}

function refusal(error: unknown): Pick<LoginMessageFormState, 'error' | 'errors'> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect('/login?expired=1')
    if (error.status === 400 && Object.keys(error.errors).length > 0) {
      return { error: null, errors: error.errors }
    }
    if ([400, 403, 404, 422].includes(error.status)) return { error: error.detail, errors: {} }
  }
  throw error
}

function revalidateMessages(): void {
  revalidatePath('/settings/login-messages')
  // The desk layout reads the visible set on every render.
  revalidatePath('/', 'layout')
}

/** The times arrive as UTC ISO strings: the form converts the reader's local time in the browser. */
function messageBody(form: FormData) {
  const endsAtUtc = String(form.get('endsAtUtc') ?? '')
  return {
    title: String(form.get('title') ?? ''),
    body: String(form.get('body') ?? ''),
    display: String(form.get('display') ?? ''),
    dismissalMode: String(form.get('dismissalMode') ?? ''),
    startsAtUtc: String(form.get('startsAtUtc') ?? ''),
    endsAtUtc: endsAtUtc === '' ? null : endsAtUtc,
  }
}

/**
 * `messageId` null creates in the acting scope: the system's for a Site Admin acting directly,
 * otherwise the acting organization's. Otherwise replaces that message's fields.
 */
export async function saveLoginMessage(
  messageId: string | null,
  form: FormData,
): Promise<LoginMessageFormState> {
  let savedId: string
  try {
    if (messageId === null) {
      const organizationId = await actingOrganizationId()
      const created = await apiPostReturning<WireLoginMessage>(
        organizationId === null
          ? apiPath`/login-messages/system`
          : apiPath`/organizations/${organizationId}/login-messages`,
        messageBody(form),
      )
      savedId = created.id
    } else {
      await apiPut(apiPath`/login-messages/${messageId}`, {
        ...messageBody(form),
        showAgain: form.get('showAgain') === 'on',
      })
      savedId = messageId
    }
  } catch (error) {
    return { ...refusal(error), savedId: null }
  }

  revalidateMessages()
  return { error: null, errors: {}, savedId }
}

/** LMS-7e: ends a live message now, keeping everything else (and its acknowledgements). */
export async function endLoginMessageNow(messageId: string): Promise<{ error: string | null }> {
  try {
    const message = await apiGet<WireLoginMessage>(
      'endLoginMessageNow',
      apiPath`/login-messages/${messageId}`,
    )
    await apiPut(apiPath`/login-messages/${messageId}`, {
      title: message.title,
      body: message.body,
      display: message.display,
      dismissalMode: message.dismissalMode,
      startsAtUtc: message.startsAtUtc,
      endsAtUtc: new Date().toISOString(),
      showAgain: false,
    })
  } catch (error) {
    return { error: refusal(error).error ?? 'The message could not be ended.' }
  }

  revalidateMessages()
  return { error: null }
}

/** Removes the message and its receipts. */
export async function deleteLoginMessage(messageId: string): Promise<{ error: string | null }> {
  try {
    await apiDelete(apiPath`/login-messages/${messageId}`)
  } catch (error) {
    return { error: refusal(error).error ?? 'The message could not be deleted.' }
  }

  revalidateMessages()
  return { error: null }
}

/**
 * The desk's Close (or Dismiss) and Acknowledge. A 404 means the message ended or left scope while
 * it was on screen, and a 403 that View As started; either way it is gone on the next render, so
 * neither is shown as an error.
 */
export async function respondToLoginMessage(
  messageId: string,
  response: 'close' | 'acknowledge',
): Promise<void> {
  try {
    await apiPost(
      response === 'close'
        ? apiPath`/login-messages/${messageId}/close`
        : apiPath`/login-messages/${messageId}/acknowledge`,
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?expired=1')
    if (!(error instanceof ApiError && [403, 404].includes(error.status))) throw error
  }
  // An admin reading the report on screen sees their own acknowledgement counted.
  revalidatePath('/settings/login-messages')
}
