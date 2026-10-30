import {
  LoginMessagesScreen,
  NewLoginMessageButton,
} from '@/components/settings/login-messages-screen'
import { SettingsPage } from '@/components/settings/settings-page'
import {
  getLoginMessageAcknowledgements,
  getManagedLoginMessages,
  type LoginMessageAcknowledgements,
} from '@/lib/data'
import { requireCurrentUser } from '@/lib/server/current-user'
import { currentUser, isAdministrator } from '@/lib/session'

export const metadata = { title: 'Sign-in messages · Collega' }

type Search = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Settings → Sign-in messages (`/settings/login-messages`, LMS-7). A Site Admin acting directly
 * manages the system's messages; an Org Admin, their organization's. Members and Read Only
 * accounts get the refusal panel from `SettingsPage`'s gate.
 *
 * The open message's acknowledgement report (LMS-6) is read here, from the URL the drawer writes:
 * `?message={id}&ack={page}`.
 */
export default async function LoginMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  await requireCurrentUser()

  const search = await searchParams
  const user = currentUser()
  const system = user.organizationId === null

  // Nothing is read for a role the gate refuses.
  const messages = isAdministrator(user.role) ? await getManagedLoginMessages() : []

  const open = messages.find((message) => message.id === first(search.message))
  const ackPage = Math.max(1, Number(first(search.ack)) || 1)
  const report: LoginMessageAcknowledgements | null =
    open && open.dismissalMode === 'AcknowledgeRequired' && open.state !== 'Scheduled'
      ? await getLoginMessageAcknowledgements(open.id, ackPage)
      : null

  return (
    <SettingsPage
      title={system ? 'System messages' : 'Sign-in messages'}
      gate="sign-in messages"
      lead={
        system
          ? 'Shown to every user in every organization when they sign in.'
          : `Shown to everyone in ${user.organizationName ?? 'your organization'} when they sign in.`
      }
      actions={<NewLoginMessageButton />}
    >
      <LoginMessagesScreen
        messages={messages}
        system={system}
        organizationName={user.organizationName}
        report={report}
      />
    </SettingsPage>
  )
}
