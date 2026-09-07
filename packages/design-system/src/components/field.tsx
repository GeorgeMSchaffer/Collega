import type { LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn.js'

/**
 * `htmlFor` is required, not optional — that is what binds the label to a control, and making it
 * optional is how the binding quietly gets dropped. The a11y rule cannot see across a component
 * boundary to verify it, so the type does the enforcing instead.
 */
export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & { htmlFor: string }

export function Label({ className, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is required by LabelProps, so every render is bound
    <label
      className={cn('mb-1.5 block text-sm font-medium text-foreground', className)}
      {...props}
    />
  )
}

/**
 * Comp Q's `.field`: label, control, and at most one of hint or error beneath it.
 *
 * `htmlFor` is required rather than optional — a real `<label for>` bound to a real control is one
 * of the three accessibility properties comp P carried over deliberately, and making it optional is
 * how that quietly gets dropped. The caller wires `id` on the control to match.
 */
export function Field({
  htmlFor,
  label,
  hint,
  error,
  className,
  children,
}: {
  htmlFor: string
  label: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  const describedBy = error ? `${htmlFor}-msg` : hint ? `${htmlFor}-hint` : undefined

  return (
    <div className={cn('mb-4', className)} data-invalid={error ? '' : undefined}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <span id={describedBy} className="mt-1 block text-[0.8rem] font-medium text-destructive">
          {error}
        </span>
      ) : hint ? (
        <span id={describedBy} className="mt-1 block text-[0.8rem] text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  )
}
