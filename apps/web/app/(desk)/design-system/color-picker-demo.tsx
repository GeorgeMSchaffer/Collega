'use client'

import { ColorPicker, TAG_PALETTE, TagChip } from '@collega/design-system'
import { useState } from 'react'

/** The picker with a live preview chip, the way the tag drawer will use it. */
export function ColorPickerDemo() {
  const [color, setColor] = useState<string>(TAG_PALETTE[5])

  return (
    <div className="flex flex-col gap-3">
      <ColorPicker id="demo-colour" value={color} onChange={setColor} />
      <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground">
        Preview <TagChip color={color}>customer-portal</TagChip>
        <TagChip color={color} size="lg">
          customer-portal
        </TagChip>
      </p>
    </div>
  )
}
