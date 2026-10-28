'use client'

import { Input } from '@collega/design-system'
import { useId, useState } from 'react'
import { Icon } from '@/components/list/icons'

/** One choice in the picker: a group or a person, with the small print beside the name. */
export type PickerOption = { kind: 'group' | 'person'; id: string; name: string; detail: string }

/**
 * A search box over people, and optionally groups, that adds one at a time (comp R board access,
 * "Add people or groups"). Focus stays in the input, which carries every key, as in the idea form's
 * tag box.
 */
export function PeoplePicker({
  id,
  options,
  onPick,
  placeholder,
  labelledBy,
  disabled = false,
}: {
  id: string
  /** What may still be added; the caller leaves out what is already chosen. */
  options: PickerOption[]
  onPick: (option: PickerOption) => void
  placeholder: string
  labelledBy: string
  disabled?: boolean
}) {
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const query = text.trim().toLowerCase()
  const matches = options.filter((option) => option.name.toLowerCase().includes(query))
  // Groups first, as the comp lists them, so the keyboard order matches the headings.
  const ordered = [
    ...matches.filter((option) => option.kind === 'group'),
    ...matches.filter((option) => option.kind === 'person'),
  ]
  const expanded = open && !disabled
  const optionId = (index: number) => `${listId}-${index}`

  function choose(index: number) {
    const option = ordered[index]
    if (!option) return
    onPick(option)
    setText('')
    setActive(-1)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
        <Icon name="search" />
      </span>
      <Input
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-labelledby={labelledBy}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        className="pl-8"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActive((current) => Math.min(current + 1, ordered.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            // Never submits the form around it: Enter here picks.
            event.preventDefault()
            if (expanded) choose(active < 0 ? 0 : active)
          } else if (event.key === 'Escape' && expanded) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            setActive(-1)
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
      />
      <div
        id={listId}
        role="listbox"
        aria-label="People and groups"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      >
        {ordered.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No match</div>
        ) : null}
        {ordered.map((option, index) => (
          <div key={`${option.kind}-${option.id}`}>
            {index === 0 || ordered[index - 1]?.kind !== option.kind ? (
              <div
                aria-hidden="true"
                className="px-2 pt-1.5 pb-0.5 text-[11px] tracking-wide text-muted-foreground uppercase"
              >
                {option.kind === 'group' ? 'Groups' : 'People'}
              </div>
            ) : null}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: focus stays in the combobox input, which carries every key (aria-activedescendant). */}
            <div
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 ${
                index === active ? 'bg-muted' : ''
              }`}
            >
              {option.kind === 'group' ? (
                <Icon name="group" className="size-4 text-primary" />
              ) : null}
              <span className="min-w-0 truncate">{option.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {option.detail}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
