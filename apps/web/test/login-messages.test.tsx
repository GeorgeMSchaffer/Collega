import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginMessages } from '@/components/login-messages/login-messages'
import { MessageText } from '@/components/login-messages/message-views'
import type { VisibleLoginMessage } from '@/lib/data/login-messages'
import { respondToLoginMessage } from '@/lib/server/login-message-actions'
import { stubDialogMethods } from './support/dialog'

stubDialogMethods()

/**
 * The desk's sign-in messages (`SPEC/20-feature-login-messages.md` LMS-3, LMS-4): order and
 * stacking, the controls each mode offers, Escape as Close, and the call a response makes. The
 * server action is the boundary; the API decides what is recorded.
 */
vi.mock('@/lib/server/login-message-actions', () => ({
  respondToLoginMessage: vi.fn(async () => undefined),
}))

function message(id: string, extra: Partial<VisibleLoginMessage> = {}): VisibleLoginMessage {
  return {
    id,
    scope: 'System',
    title: `Title ${id}`,
    body: `Body ${id}`,
    display: 'Modal',
    dismissalMode: 'EveryLogin',
    revision: 1,
    ...extra,
  }
}

const show = (messages: VisibleLoginMessage[]) =>
  render(<LoginMessages messages={messages} organizationName="Acme Robotics" />)

const dialog = () => screen.getByRole('dialog')

beforeEach(() => {
  vi.mocked(respondToLoginMessage).mockClear()
})

describe('banners', () => {
  it('stack in the order the API gave them, system before organization', () => {
    show([
      message('s1', { display: 'Banner' }),
      message('o1', { display: 'Banner', scope: 'Organization' }),
      message('o2', { display: 'Banner', scope: 'Organization' }),
    ])

    const region = screen.getByRole('region', { name: 'Sign-in messages' })
    const labels = within(region)
      .getAllByRole('region')
      .map((banner) => banner.getAttribute('aria-label'))
    expect(labels).toEqual([
      'System message: Title s1',
      'Organization message: Title o1',
      'Organization message: Title o2',
    ])
  })

  it('name the organization on its own banners and System on the system banners', () => {
    show([
      message('s1', { display: 'Banner' }),
      message('o1', { display: 'Banner', scope: 'Organization' }),
    ])

    expect(screen.getByText('System')).toBeTruthy()
    expect(screen.getByText('Acme Robotics')).toBeTruthy()
  })

  it('are all shown at once, and stay while a modal is open', () => {
    show([
      message('m1'),
      message('b1', { display: 'Banner' }),
      message('b2', { display: 'Banner' }),
    ])

    expect(dialog()).toBeTruthy()
    expect(screen.getByText('Title b1')).toBeTruthy()
    expect(screen.getByText('Title b2')).toBeTruthy()
  })

  it('render nothing when there are no messages', () => {
    const { container } = show([])
    expect(container.innerHTML).toBe('')
  })

  it('hide at once when closed, and report Close to the action with their id', () => {
    show([message('b1', { display: 'Banner' }), message('b2', { display: 'Banner' })])

    const first = screen.getByRole('region', { name: 'System message: Title b1' })
    fireEvent.click(within(first).getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Title b1')).toBeNull()
    expect(screen.getByText('Title b2')).toBeTruthy()
    expect(respondToLoginMessage).toHaveBeenCalledExactlyOnceWith('b1', 'close')
  })
})

describe('controls by mode', () => {
  it.each([
    ['Banner', 'EveryLogin', ['Close']],
    ['Banner', 'DismissOnce', ['Dismiss']],
    ['Banner', 'AcknowledgeRequired', ['Close', 'Acknowledge']],
  ] as const)('a %s in %s mode offers %j', (display, dismissalMode, labels) => {
    show([message('x', { display, dismissalMode })])

    const banner = screen.getByRole('region', { name: 'System message: Title x' })
    expect(
      within(banner)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([...labels])
  })

  it.each([
    ['EveryLogin', ['Close message', 'Close']],
    ['DismissOnce', ['Close message', 'Dismiss']],
    ['AcknowledgeRequired', ['Close message', 'Close', 'Acknowledge']],
  ] as const)('a Modal in %s mode offers the cross and %j', (dismissalMode, names) => {
    show([message('x', { dismissalMode })])

    const labels = within(dialog())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent)
    expect(labels).toEqual([...names])
  })

  it('Acknowledge on a banner hides it and reports acknowledge', () => {
    show([message('x', { display: 'Banner', dismissalMode: 'AcknowledgeRequired' })])

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))

    expect(screen.queryByText('Title x')).toBeNull()
    expect(respondToLoginMessage).toHaveBeenCalledExactlyOnceWith('x', 'acknowledge')
  })

  it('explains that Close brings an acknowledge-required modal back', () => {
    show([message('x', { dismissalMode: 'AcknowledgeRequired' })])
    expect(within(dialog()).getByText(/next time you sign in/)).toBeTruthy()
  })
})

describe('modals', () => {
  const two = () => [
    message('m1', { scope: 'System' }),
    message('m2', { scope: 'Organization', dismissalMode: 'AcknowledgeRequired' }),
  ]

  it('show one at a time, the first in the API order, with its position', () => {
    show(two())

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog()).getByRole('heading', { name: 'Title m1' })).toBeTruthy()
    expect(within(dialog()).getByText('1 of 2')).toBeTruthy()
    expect(screen.queryByText('Title m2')).toBeNull()
  })

  it('open the next one when the current is closed, and say 2 of 2', () => {
    show(two())

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))

    expect(within(dialog()).getByRole('heading', { name: 'Title m2' })).toBeTruthy()
    expect(within(dialog()).getByText('2 of 2')).toBeTruthy()
    expect(respondToLoginMessage).toHaveBeenCalledWith('m1', 'close')
  })

  it('open the next one when the current is acknowledged, then leave none', () => {
    show([
      message('m1', { dismissalMode: 'AcknowledgeRequired' }),
      message('m2', { dismissalMode: 'AcknowledgeRequired' }),
    ])

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Acknowledge' }))
    expect(within(dialog()).getByRole('heading', { name: 'Title m2' })).toBeTruthy()

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Acknowledge' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(vi.mocked(respondToLoginMessage).mock.calls).toEqual([
      ['m1', 'acknowledge'],
      ['m2', 'acknowledge'],
    ])
  })

  it('count only modals in the position, not banners', () => {
    show([message('b1', { display: 'Banner' }), message('m1')])
    expect(within(dialog()).getByText('1 of 1')).toBeTruthy()
  })

  it('treat Escape as Close, never as Acknowledge', () => {
    show([message('m1', { dismissalMode: 'AcknowledgeRequired' })])

    fireEvent.keyDown(dialog(), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(respondToLoginMessage).toHaveBeenCalledExactlyOnceWith('m1', 'close')
  })

  it('treat the cross as Close', () => {
    show([message('m1', { dismissalMode: 'DismissOnce' })])

    fireEvent.click(screen.getByRole('button', { name: 'Close message' }))

    expect(respondToLoginMessage).toHaveBeenCalledExactlyOnceWith('m1', 'close')
  })

  it('report Dismiss as the close route', () => {
    show([message('m1', { dismissalMode: 'DismissOnce' })])

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Dismiss' }))

    expect(respondToLoginMessage).toHaveBeenCalledExactlyOnceWith('m1', 'close')
  })

  it('label the dialog with its title and describe it with its body', () => {
    show([message('m1')])
    expect(
      screen.getByRole('dialog', { name: 'Title m1' }).getAttribute('aria-describedby'),
    ).toBeTruthy()
    expect(screen.getByRole('dialog', { description: 'Body m1' })).toBeTruthy()
  })
})

describe('MessageText', () => {
  it('turns web addresses into links that open safely in a new tab', () => {
    render(
      <p>
        <MessageText text={'Read https://example.test/terms now'} />
      </p>,
    )

    const link = screen.getByRole('link', { name: 'https://example.test/terms' })
    expect(link.getAttribute('href')).toBe('https://example.test/terms')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('leaves text without an address as plain text, and never renders markup', () => {
    render(
      <p data-testid="p">
        <MessageText text={'<b>bold</b> and plain'} />
      </p>,
    )

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('p').textContent).toBe('<b>bold</b> and plain')
  })
})
