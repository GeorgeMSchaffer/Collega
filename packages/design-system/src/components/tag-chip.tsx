import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '../lib/cn.js'
import { THEME_NAMES, tagChipColors } from '../lib/tag-colors.js'

/**
 * A tag in its colour (comp R's `.tag`). The name is always the text: colour never carries meaning
 * alone.
 *
 * The colours are computed for all five themes at render and handed to CSS as variables, and the
 * `[data-theme]` on `<html>` picks one set. So the server render is already right, and switching
 * the theme in the picker needs no re-render. Terrazzo's set is the base because a document with no
 * `data-theme` is Terrazzo.
 */
export function TagChip({
  color,
  size = 'default',
  className,
  style,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  /** `#RRGGBB`. */
  color: string
  size?: 'default' | 'lg'
}) {
  const vars: Record<string, string> = {}
  for (const theme of THEME_NAMES) {
    const { ground, text, border } = tagChipColors(color, theme)
    vars[`--chip-bg-${theme}`] = ground
    vars[`--chip-fg-${theme}`] = text
    // The same in every theme: it is the tag colour over transparent.
    vars['--chip-line'] = border
  }

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border border-(color:--chip-line) font-medium',
        'bg-(color:--chip-bg-terrazzo) text-(color:--chip-fg-terrazzo)',
        'in-data-[theme=portico]:bg-(color:--chip-bg-portico) in-data-[theme=portico]:text-(color:--chip-fg-portico)',
        'in-data-[theme=sera]:bg-(color:--chip-bg-sera) in-data-[theme=sera]:text-(color:--chip-fg-sera)',
        'in-data-[theme=lagoon]:bg-(color:--chip-bg-lagoon) in-data-[theme=lagoon]:text-(color:--chip-fg-lagoon)',
        'in-data-[theme=graphite]:bg-(color:--chip-bg-graphite) in-data-[theme=graphite]:text-(color:--chip-fg-graphite)',
        size === 'lg' ? 'px-3 py-0.5 text-sm' : 'px-2 py-px text-[11px]',
        className,
      )}
      style={{ ...(vars as CSSProperties), ...style }}
      {...props}
    />
  )
}
