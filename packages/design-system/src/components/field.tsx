import {
  Children,
  cloneElement,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
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
 *
 * **`Field` binds `aria-describedby` itself, and must keep doing so.** It previously computed the
 * hint/error id, rendered it on the `<span>`, and never put `aria-describedby` on the control —
 * so the whole sign-in and password-change flow shipped with three ids nothing pointed at and zero
 * `aria-describedby` in the document. A screen-reader user heard "New password, secure edit text"
 * and never the password rules. Leaving the binding to the caller is what made that possible, and
 * it is the same defect `Denied` shipped with for the same reason: an id computed in one place and
 * a reference owed in another. Only this component knows the id, so only it can be responsible.
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
  // `| undefined` explicitly, because `exactOptionalPropertyTypes` is on and these are the two
  // props a caller computes rather than writes: `error={errors.email}` is the whole point of them,
  // and without this every such caller has to spread a conditional object instead.
  hint?: string | undefined
  error?: string | undefined
  className?: string | undefined
  children: ReactNode
}) {
  const describedBy = error ? `${htmlFor}-msg` : hint ? `${htmlFor}-hint` : undefined

  // `Children.only` throws for a fragment or multiple children rather than silently binding
  // nothing — a Field wraps exactly one control, and a caller who passes two should hear about it.
  const control = describedBy
    ? cloneElement(Children.only(children) as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': describedBy,
      })
    : children

  return (
    <div className={cn('mb-4', className)} data-invalid={error ? '' : undefined}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {control}
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
