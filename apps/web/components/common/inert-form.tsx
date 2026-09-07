'use client'

import type { FormHTMLAttributes } from 'react'

/**
 * A form whose submit does nothing, until the endpoint behind it exists.
 *
 * A bare `<form>` with no handler is **not** inert: submitting navigates to the current URL with
 * every named field appended as a query string. On the sign-in form that put an email and password
 * into browser history; on the outcome picker it discarded the user's selection while appearing to
 * save. `aria-disabled` on the submit button does not prevent it either — that attribute is
 * advisory, and unlike `disabled` it leaves the control fully operable.
 *
 * That is the trap this component exists to close: an accessibility fix replaced `disabled` with
 * `aria-disabled` and silently gave up the inertness `disabled` had been supplying. Wrap any form
 * that is still waiting on Wave D in this, and the submit becomes a no-op rather than a navigation.
 */
export function InertForm({ children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form {...props} onSubmit={(event) => event.preventDefault()}>
      {children}
    </form>
  )
}
