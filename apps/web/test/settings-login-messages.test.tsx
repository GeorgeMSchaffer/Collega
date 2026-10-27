import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginMessagesScreen } from '@/components/settings/login-messages-screen'
import type { LoginMessage, LoginMessageAcknowledgements } from '@/lib/data/login-messages'
import {
  deleteLoginMessage,
  endLoginMessageNow,
  saveLoginMessage,
} from '@/lib/server/login-message-actions'
import { stubDialogMethods } from './support/dialog'

stubDialogMethods()

/**
 * Settings → Sign-in messages (LMS-7): the list's cells, the row actions, the drawer's local-time
 * to UTC conversion, and the acknowledgements section. The router and the server actions are the
 * boundary.
 */
const search = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: search.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/settings/login-messages',
  useSearchParams: () => search.params,
  redirect: vi.fn(),
}))
vi.mock('@/lib/server/login-message-actions', () => ({
  saveLoginMessage: vi.fn(async () => ({ error: null, errors: {}, savedId: 'saved' })),
  endLoginMessageNow: vi.fn(async () => ({ error: null })),
  deleteLoginMessage: vi.fn(async () => ({ error: null })),
}))

function message(id: string, extra: Partial<LoginMessage> = {}): LoginMessage {
  return {
    id,
    organizationId: 'org-1',
    title: `Title ${id}`,
    body: `Body ${id}`,
    display: 'Modal',
    dismissalMode: 'EveryLogin',
    startsAtUtc: '2026-10-01T09:00:00.000Z',
    endsAtUtc: null,
    revision: 1,
    state: 'Live',
    createdAtUtc: '2026-10-01T08:00:00.000Z',
    updatedAtUtc: '2026-10-01T08:00:00.000Z',
    ...extra,
  }
}

const REPORT: LoginMessageAcknowledgements = {
  items: [
    {
      userId: 'u1',
      name: 'Ada User',
      email: 'ada@acme.test',
      organizationName: 'Acme Robotics',
      acknowledgedAtUtc: '2026-10-02T10:00:00.000Z',
    },
    {
      userId: 'u2',
      name: 'Bo User',
      email: 'bo@acme.test',
      organizationName: 'Acme Robotics',
      acknowledgedAtUtc: null,
    },
  ],
  page: 1,
  pageSize: 25,
  totalCount: 2,
  acknowledgedCount: 1,
  audienceCount: 2,
}

beforeEach(() => {
  search.params = new URLSearchParams()
  search.push.mockReset()
  vi.mocked(saveLoginMessage).mockClear()
  vi.mocked(endLoginMessageNow).mockClear()
  vi.mocked(deleteLoginMessage).mockClear()
})

const renderScreen = (
  messages: LoginMessage[],
  report: LoginMessageAcknowledgements | null = null,
) =>
  render(
    <LoginMessagesScreen
      messages={messages}
      system={false}
      organizationName="Acme Robotics"
      report={report}
    />,
  )

const rowFor = (title: string) => screen.getByRole('row', { name: new RegExp(title) })

describe('the list', () => {
  it('shows each message with its display, mode, window and state', () => {
    renderScreen([
      message('a', {
        display: 'Banner',
        dismissalMode: 'DismissOnce',
        state: 'Ended',
        endsAtUtc: '2026-10-02T09:00:00.000Z',
      }),
    ])

    const row = rowFor('Title a')
    expect(within(row).getByText('Banner')).toBeTruthy()
    expect(within(row).getByText('Dismiss once')).toBeTruthy()
    expect(within(row).getByText('Ended')).toBeTruthy()
    expect(within(row).getByText(/–/)).toBeTruthy()
  })

  it('writes an open-ended window as "From …, no end"', () => {
    renderScreen([message('a')])
    expect(within(rowFor('Title a')).getByText(/^From .*, no end$/)).toBeTruthy()
  })

  it('shows N of M acknowledged for a live Acknowledge required message', () => {
    renderScreen([
      message('a', {
        dismissalMode: 'AcknowledgeRequired',
        acknowledgedCount: 3,
        audienceCount: 12,
      }),
    ])
    expect(within(rowFor('Title a')).getByText(/3 of 12 acknowledged/)).toBeTruthy()
  })

  it('says "Not shown yet" for a scheduled Acknowledge required message', () => {
    renderScreen([message('a', { dismissalMode: 'AcknowledgeRequired', state: 'Scheduled' })])
    expect(within(rowFor('Title a')).getByText('Not shown yet')).toBeTruthy()
  })

  it('shows a dash in the acknowledged cell for other modes', () => {
    renderScreen([message('a', { dismissalMode: 'EveryLogin' })])
    expect(within(rowFor('Title a')).getByText('—')).toBeTruthy()
  })

  it('invites the first message when there are none', () => {
    renderScreen([])
    expect(screen.getByText('No sign-in messages yet')).toBeTruthy()
  })
})

describe('row actions', () => {
  it('offers End now on a live message only', () => {
    renderScreen([
      message('live'),
      message('soon', { state: 'Scheduled' }),
      message('old', { state: 'Ended' }),
    ])

    expect(within(rowFor('Title live')).queryByRole('button', { name: /End now/ })).toBeTruthy()
    expect(within(rowFor('Title soon')).queryByRole('button', { name: /End now/ })).toBeNull()
    expect(within(rowFor('Title old')).queryByRole('button', { name: /End now/ })).toBeNull()
  })

  it('ends a live message through the action with its id', async () => {
    renderScreen([message('live')])

    fireEvent.click(within(rowFor('Title live')).getByRole('button', { name: /End now/ }))

    await waitFor(() => expect(endLoginMessageNow).toHaveBeenCalledExactlyOnceWith('live'))
  })

  it('asks before deleting, and deletes only once confirmed', async () => {
    renderScreen([message('a')])

    fireEvent.click(within(rowFor('Title a')).getByRole('button', { name: /Delete/ }))
    expect(deleteLoginMessage).not.toHaveBeenCalled()
    expect(screen.getByText('Delete this message?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete message' }))
    await waitFor(() => expect(deleteLoginMessage).toHaveBeenCalledExactlyOnceWith('a'))
  })

  it('does not delete when the confirmation is cancelled', () => {
    renderScreen([message('a')])

    fireEvent.click(within(rowFor('Title a')).getByRole('button', { name: /Delete/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteLoginMessage).not.toHaveBeenCalled()
  })

  it('shows the refusal beside the list when End now fails', async () => {
    vi.mocked(endLoginMessageNow).mockResolvedValueOnce({ error: 'It already ended.' })
    renderScreen([message('live')])

    fireEvent.click(within(rowFor('Title live')).getByRole('button', { name: /End now/ }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('It already ended.')).toBeTruthy()
  })
})

describe('the drawer', () => {
  function openNew() {
    search.params = new URLSearchParams('message=new')
    return renderScreen([])
  }

  const submittedForm = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create message' }))
    await waitFor(() => expect(saveLoginMessage).toHaveBeenCalled())
    return vi.mocked(saveLoginMessage).mock.calls[0] as [string | null, FormData]
  }

  it('converts the local start and end to UTC in the hidden fields it submits', async () => {
    openNew()
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Maintenance' } })
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'Down briefly' } })
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: '2026-11-02T09:30' } })
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: '2026-11-03T17:00' } })

    const [id, form] = await submittedForm()

    expect(id).toBeNull()
    expect(form.get('startsAtUtc')).toBe(new Date(2026, 10, 2, 9, 30).toISOString())
    expect(form.get('endsAtUtc')).toBe(new Date(2026, 10, 3, 17, 0).toISOString())
    expect(form.get('title')).toBe('Maintenance')
    expect(form.get('display')).toBe('Modal')
    expect(form.get('dismissalMode')).toBe('EveryLogin')
  })

  it('submits an empty end when none is given', async () => {
    openNew()
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'No end' } })
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'Body' } })

    const [, form] = await submittedForm()

    expect(form.get('endsAtUtc')).toBe('')
    expect(String(form.get('startsAtUtc'))).toMatch(/Z$/)
  })

  it('submits the chosen display and mode', async () => {
    openNew()
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('radio', { name: /Banner/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Acknowledge required/ }))

    const [, form] = await submittedForm()

    expect(form.get('display')).toBe('Banner')
    expect(form.get('dismissalMode')).toBe('AcknowledgeRequired')
  })

  it('offers Show again to everyone on edit but not on a new message', () => {
    openNew()
    expect(screen.queryByLabelText(/Show again to everyone/)).toBeNull()
  })

  it('edits an existing message with its local times filled and Show again unticked', async () => {
    const existing = message('a', { endsAtUtc: '2026-10-05T12:00:00.000Z' })
    search.params = new URLSearchParams('message=a')
    renderScreen([existing])

    const pad = (n: number) => String(n).padStart(2, '0')
    const local = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    expect((screen.getByLabelText(/^Starts/) as HTMLInputElement).value).toBe(
      local(existing.startsAtUtc),
    )
    expect((screen.getByLabelText(/^Ends/) as HTMLInputElement).value).toBe(
      local(existing.endsAtUtc as string),
    )
    const showAgain = screen.getByLabelText(/Show again to everyone/) as HTMLInputElement
    expect(showAgain.checked).toBe(false)

    fireEvent.click(showAgain)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveLoginMessage).toHaveBeenCalled())
    const [id, form] = vi.mocked(saveLoginMessage).mock.calls[0] as [string, FormData]
    expect(id).toBe('a')
    expect(form.get('showAgain')).toBe('on')
    expect(form.get('startsAtUtc')).toBe(existing.startsAtUtc)
  })

  it('previews the title as it is typed', () => {
    openNew()
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Hello there' } })
    expect(screen.getAllByText('Hello there').length).toBeGreaterThan(0)
  })

  it('shows the acknowledgements section for an open Acknowledge required message', () => {
    search.params = new URLSearchParams('message=a')
    renderScreen([message('a', { dismissalMode: 'AcknowledgeRequired' })], REPORT)

    const section = screen.getByRole('region', { name: 'Acknowledgements' })
    expect(within(section).getByText('1 of 2 acknowledged')).toBeTruthy()
    expect(within(section).getByText('50%')).toBeTruthy()
    expect(within(section).getByText('Not yet')).toBeTruthy()
    expect(within(section).getByText('Ada User')).toBeTruthy()
  })

  it('omits the acknowledgements section when the message has no report', () => {
    search.params = new URLSearchParams('message=a')
    renderScreen([message('a')])
    expect(screen.queryByRole('region', { name: 'Acknowledgements' })).toBeNull()
  })
})
