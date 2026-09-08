import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'

export const alertVariants = cva('relative grid w-full gap-1 rounded-lg border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'border-border bg-card text-foreground',
      destructive: 'border-destructive/50 bg-destructive/5 text-destructive',
      note: 'border-border border-l-4 border-l-primary bg-card text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>

export function Alert({ className, variant, role = 'alert', ...props }: AlertProps) {
  return <div role={role} className={cn(alertVariants({ variant }), className)} {...props} />
}
