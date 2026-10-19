import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * Comp U's `.sw`: a labelled on/off switch. The children are its visible label, so the control is
 * named by what it says.
 *
 * A refused switch is `aria-disabled`, not `disabled`, for the reason `SwimlanePicker` gives: it
 * stays focusable so its `aria-describedby` reason can be reached. The click is ignored here.
 */
export function Switch({
  checked,
  onCheckedChange,
  className,
  children,
  type = 'button',
  onClick,
  ...props
}: SwitchProps) {
  const refused = props['aria-disabled'] === true || props['aria-disabled'] === 'true'
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      className={cn(
        'inline-flex items-center gap-2.5 bg-transparent p-0 text-sm text-foreground',
        refused ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      )}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || refused || props.disabled) return
        onCheckedChange(!checked)
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-block h-5 w-[34px] flex-none rounded-full',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full',
            checked ? 'left-4 bg-primary-foreground' : 'left-0.5 bg-muted-foreground',
          )}
        />
      </span>
      {children}
    </button>
  )
}
