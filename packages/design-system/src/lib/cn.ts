import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * The shadcn/ui class merger. Later Tailwind utilities win over earlier ones, which is what
 * lets a caller override a variant's padding or colour without fighting specificity.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
