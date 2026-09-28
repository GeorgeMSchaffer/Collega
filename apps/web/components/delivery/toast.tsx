'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'

/**
 * Comp R's toast: one short confirmation at the foot of the screen, gone after a few seconds. The
 * live region is always mounted, so a screen reader hears the message when it arrives.
 */
export function useToast(): [ReactNode, (message: string) => void] {
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3200)
    return () => clearTimeout(timer)
  }, [message])

  // `n` makes the same message twice in a row a new value, so its timer restarts.
  const show = useCallback(
    (text: string) => setMessage((last) => ({ text, n: (last?.n ?? 0) + 1 })),
    [],
  )

  const node = (
    <div
      role="status"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[70] -translate-x-1/2"
    >
      {message ? (
        <div className="rounded-md bg-foreground px-4 py-2 text-[13px] font-semibold text-background shadow-lg">
          {message.text}
        </div>
      ) : null}
    </div>
  )

  return [node, show]
}
