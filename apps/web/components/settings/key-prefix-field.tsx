'use client'

import { Field, Input } from '@collega/design-system'
import { useState } from 'react'
import { KEY_PREFIX_RULE } from '@/lib/server/rule-messages'

const VALID = /^[A-Z0-9]{2,10}$/

/**
 * The board's key prefix (comp U screen 1, frames A, D and E).
 *
 * Editable until the first key is issued. The board read says how far keys have gone
 * (`nextItemNumber`), so a board with keys opens locked with the issued range; a refusal
 * (`422 keyPrefixLocked`) locks it too, for a key issued since the page loaded. A prefix that is not 2 to 10 of A-Z and
 * 0-9 is flagged once the field has been left; the server stays the authority.
 *
 * Posts as `keyPrefix`, empty meaning none.
 */
export function KeyPrefixField({
  saved,
  nextItemNumber = 1,
  refusal,
}: {
  /** The prefix as stored; `null` for none, and on a board not yet created. */
  saved: string | null
  /** The number the next key takes; above `1`, keys `PREFIX-1` to `PREFIX-(n-1)` exist. */
  nextItemNumber?: number | undefined
  /** The last save's refusal of this field. */
  refusal?: { message: string; locked: boolean } | undefined
}) {
  const [value, setValue] = useState(saved ?? '')
  const [left, setLeft] = useState(false)
  // Typing answers a refusal: its message goes until the next save brings a new one.
  const [answered, setAnswered] = useState<typeof refusal>(undefined)
  const issued = saved !== null && nextItemNumber > 1 ? nextItemNumber - 1 : 0
  const locked = refusal?.locked === true || issued > 0
  const shown = locked ? (saved ?? '') : value

  const invalid = !locked && left && shown !== '' && !VALID.test(shown)
  const error = locked
    ? undefined
    : invalid
      ? KEY_PREFIX_RULE
      : answered === refusal
        ? undefined
        : refusal?.message
  const label = saved === null && !locked ? 'Key prefix (optional)' : 'Key prefix'
  const hint = locked
    ? `Locked. ${issued > 0 ? `Keys ${saved}-1 to ${saved}-${issued} have been issued, so the prefix can’t change.` : (refusal?.message ?? '')}${saved ? ` Items on this board are keyed ${saved}-1, ${saved}-2 … and never renumbered.` : ''}`
    : 'Upper-cased as you type. Editable until the first key is issued; leave empty and cards on this board have no key.'

  return (
    <Field htmlFor="board-key-prefix" label={label} hint={hint} error={error}>
      <Input
        id="board-key-prefix"
        name="keyPrefix"
        value={shown}
        maxLength={10}
        readOnly={locked}
        invalid={error !== undefined}
        autoComplete="off"
        onChange={(event) => {
          setValue(event.target.value.toUpperCase())
          setAnswered(refusal)
        }}
        onBlur={() => setLeft(true)}
      />
    </Field>
  )
}
