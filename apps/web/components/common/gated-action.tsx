import { Button, Denied } from '@collega/design-system'
import type { ReactNode } from 'react'

/**
 * An action rendered live when the role may take it, and disabled with the reason beside it when
 * it may not.
 *
 * This is the "Denied is shown, not hidden" rule (`SPEC/20-feature-client-ui.md`, 2026-09-02) in
 * one place, because comp Q applies it inconsistently: its delivery screens disable the empty-state
 * action with a reason, while `s-home`, `s-boards`, `s-board` and `s-outcome` simply omit it. Two
 * rules for one situation is worse than diverging from four screens, so every empty state uses this
 * — decided 2026-09-08, recorded in `SPEC/decisions.md`.
 *
 * `aria-disabled` and never the HTML `disabled` attribute: the control has to stay focusable, or
 * the explanation goes out of reach for exactly the reader who most needs it.
 */
export function GatedAction({
  id,
  label,
  denial,
  children,
}: {
  /** Ties the control to its reason. Must be unique on the page. */
  id: string
  label: string
  /** The reason the role may not act, or null when it may. */
  denial: string | null
  /** An alternative to the default Button — a Link styled as one, say. */
  children?: ReactNode
}) {
  if (!denial) {
    return children ?? <Button>{label}</Button>
  }

  return (
    <Denied reason={denial} id={id}>
      <Button aria-disabled="true" aria-describedby={id}>
        {label}
      </Button>
    </Denied>
  )
}
