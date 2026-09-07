import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

/**
 * The base layer in `globals.css` already styles bare `input`, `select` and `textarea` — that is
 * deliberate, and comp Q relies on it. These wrappers exist only to add the invalid state and to
 * give callers a named import; they are not required for an input to look right.
 */
const FIELD = 'w-full'
const INVALID = 'border-destructive focus-visible:ring-destructive'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(FIELD, invalid && INVALID, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(FIELD, 'min-h-20 py-2', invalid && INVALID, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }

export function Select({ className, invalid, ...props }: SelectProps) {
  return (
    <select
      className={cn(FIELD, invalid && INVALID, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}
