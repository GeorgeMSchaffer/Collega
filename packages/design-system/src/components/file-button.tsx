import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'
import { buttonVariants } from './button.js'

/**
 * A file picker that looks like a button.
 *
 * `<input type="file">` cannot be restyled, so comp Q wraps it in a `<label>` carrying the button
 * classes and hides the input. The input stays in the DOM and in the tab order — hiding it with
 * `display:none` or `visibility:hidden` would take it out of both, which is why it is positioned
 * 1x1 at zero opacity instead. Clicking the label activates the input because the label wraps it,
 * so no JavaScript is involved and this stays a server component.
 *
 * `id` is required for the same reason `Field` requires `htmlFor`: a file input with no id cannot be
 * pointed at by an error message, and every use of this here has one.
 */
export function FileButton({
  id,
  label,
  variant = 'outline',
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  id: string
  label: string
  variant?: 'default' | 'outline' | 'secondary'
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        buttonVariants({ variant }),
        'relative cursor-pointer focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      {label}
      <input {...props} id={id} type="file" className="absolute size-px opacity-0" />
    </label>
  )
}
