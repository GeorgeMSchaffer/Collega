'use client'

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CodeChip,
} from '@collega/design-system'
import { useActionState } from 'react'
import { type InviteCodeState, regenerateInviteCode } from '@/lib/server/admin-actions'

/**
 * A `'use server'` module may only export async functions, so the initial state cannot live beside
 * the action — see `profile-form.tsx`, which says why `tsc` does not catch that and `next build`
 * does.
 */
const NOTHING_SUBMITTED: InviteCodeState = { error: null }

/**
 * The organization's invite code, and the control that replaces it (comp P `s-users`, "Invite code").
 *
 * **The code is rendered in the body of the page and nowhere else.** It is a standing credential —
 * it does not expire, and anyone holding it self-registers into this organization — so it must not
 * reach a URL, a query string or a link, which is the same reasoning `app/(auth)/register/page.tsx`
 * applies to the other end of the same value. It reaches the browser only because an administrator
 * has to be able to read it out and hand it over, which is the whole purpose of the card.
 *
 * `organizationId` is a hidden field, bound by the page from the resolved principal. It is the
 * target of the write, not a claim about who is asking: the API answers 404 to an administrator
 * naming another organization and 403 to a member naming any, and nothing here consults a role.
 *
 * A client component only for `useActionState` — the pending flag and the refusal. The new code is
 * not returned by the action; the server re-renders this card with it, so there is one source of
 * truth for the code rather than two that could disagree.
 */
export function InviteCodeCard({
  organizationId,
  inviteCode,
}: {
  organizationId: string
  inviteCode: string
}) {
  const [state, formAction, pending] = useActionState<InviteCodeState, FormData>(
    regenerateInviteCode,
    NOTHING_SUBMITTED,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite code</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="m-0 mb-3 max-w-prose text-sm text-muted-foreground">
          Share this so new members can register themselves into this organization. Regenerating it
          invalidates the old one immediately; anyone who has already used it keeps their account.
        </p>

        {state.error ? (
          <Alert variant="destructive" className="mb-3">
            <span>{state.error}</span>
          </Alert>
        ) : null}

        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <CodeChip>{inviteCode}</CodeChip>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
