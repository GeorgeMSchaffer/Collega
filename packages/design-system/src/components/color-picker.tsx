'use client'

import { useState } from 'react'
import { cn } from '../lib/cn.js'
import { isHexColor, TAG_PALETTE } from '../lib/tag-colors.js'

/**
 * The tag colour picker (`20-feature-ideas-and-engagement.md` rule 12): the ten palette colours as
 * a radio group of swatches, each named by its hex for assistive technology, then a labelled
 * **Custom** colour — a `#RRGGBB` box and the native picker over the same value. Choosing a swatch
 * sets the colour; choosing a custom one clears the swatch selection.
 *
 * Controlled, and `onChange` only ever receives a valid upper-case `#RRGGBB`: a half-typed hex stays
 * in the box until it is complete. With `name`, the value also posts with a native form.
 */
export function ColorPicker({
  id,
  value,
  onChange,
  name,
  legend = 'Colour',
  className,
}: {
  /** Prefix for the controls' ids. */
  id: string
  /** `#RRGGBB`. */
  value: string
  onChange: (color: string) => void
  name?: string | undefined
  legend?: string | undefined
  className?: string | undefined
}) {
  const inPalette = (color: string) => TAG_PALETTE.some((c) => c === color.toUpperCase())
  const [custom, setCustom] = useState(!inPalette(value))
  const [draft, setDraft] = useState(value.toUpperCase())
  // The last colour this picker sent, so its own echo is told apart from the caller changing it.
  const [sent, setSent] = useState<string | null>(null)

  // A new value replaces the draft. One the caller set (a reset, a different tag) also decides
  // whether a swatch shows as chosen; one this picker sent keeps the mode the person chose.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(value.toUpperCase())
    if (value.toUpperCase() !== sent) setCustom(!inPalette(value))
  }

  const choose = (color: string, fromCustom: boolean) => {
    const next = color.toUpperCase()
    setCustom(fromCustom)
    setSent(next)
    onChange(next)
  }

  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className="mb-[5px] p-0 text-[length:var(--label-size)] font-medium text-secondary-foreground">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {TAG_PALETTE.map((color, n) => (
          <label key={color} className="relative m-0 cursor-pointer" title={color}>
            <input
              type="radio"
              name={`${id}-swatch`}
              value={color}
              checked={!custom && value.toUpperCase() === color}
              onChange={() => choose(color, false)}
              aria-label={`Colour ${n + 1} (${color})`}
              className="peer absolute size-px opacity-0"
            />
            <span
              className="block size-7 rounded-full border-2 border-card shadow-[0_0_0_1px_var(--input)] peer-checked:shadow-[0_0_0_2px_var(--foreground)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
              style={{ background: color }}
            />
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={`${id}-custom`} className="m-0 text-xs font-normal text-muted-foreground">
          Custom
        </label>
        <input
          id={`${id}-custom`}
          type="text"
          value={draft}
          maxLength={7}
          pattern="#[0-9A-Fa-f]{6}"
          spellCheck={false}
          aria-describedby={`${id}-custom-hint`}
          aria-invalid={!isHexColor(draft) || undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            if (isHexColor(event.target.value)) choose(event.target.value, true)
          }}
          className="w-28 font-mono uppercase"
        />
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(event) => choose(event.target.value, true)}
          aria-label="Pick a custom colour visually"
          className="h-[var(--control-h-sm)] w-11 flex-none cursor-pointer rounded-md border border-input bg-card p-0.5"
        />
        <span id={`${id}-custom-hint`} className="text-xs text-muted-foreground">
          Any #RRGGBB
        </span>
      </div>
      {name ? <input type="hidden" name={name} value={value.toUpperCase()} /> : null}
    </fieldset>
  )
}
