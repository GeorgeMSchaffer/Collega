'use client'

import { useEffect } from 'react'
import { pathTemplate, type UsageEventType, type UsageProps } from '@/lib/usage-queue'
import { recordUsage } from './usage-recorder'

/**
 * Records one view event once the screen is on screen (`SPEC/20-feature-analytics.md` rule 7). A
 * server page renders it beside its content. `screen` adds the route template as the `screen` prop,
 * for `admin.viewed` and `settings.viewed`.
 */
export function UsageViewed({
  type,
  entityId = null,
  props = null,
  screen = false,
}: {
  type: UsageEventType
  entityId?: string | null
  props?: UsageProps | null
  screen?: boolean
}) {
  const key = JSON.stringify([type, entityId, props, screen])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the props it is built from.
  useEffect(() => {
    recordUsage({
      type,
      entityId,
      props: screen ? { ...props, screen: pathTemplate(window.location.pathname) } : props,
    })
  }, [key])
  return null
}
