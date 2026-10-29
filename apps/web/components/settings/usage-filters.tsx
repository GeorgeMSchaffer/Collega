'use client'

import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useId } from 'react'
import { Pager, type PageSize } from '@/components/list'

/**
 * The usage screen's filters write the URL, and the server page reads it, so a filtered view is a
 * link a Site Admin can share. Changing any filter returns the trail to its first page.
 */
function useSetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in changes)) next.delete('page')
    const query = next.toString()
    router.replace(`${pathname}${query ? `?${query}` : ''}` as Route, { scroll: false })
  }
}

export function UsageSelect({
  name,
  label,
  value,
  options,
  placeholder,
}: {
  name: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  /** An empty first option, for a choice the screen waits on (organization, member). */
  placeholder?: string
}) {
  const id = useId()
  const setParams = useSetParams()
  return (
    <label
      htmlFor={id}
      className="m-0 flex flex-col gap-1 text-xs font-medium text-muted-foreground"
    >
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => setParams({ [name]: event.target.value })}
        className="w-auto min-w-48 text-sm text-foreground"
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function UsageTrailPager({
  page,
  size,
  total,
}: {
  page: number
  size: PageSize
  total: number
}) {
  const setParams = useSetParams()
  return (
    <Pager
      page={page}
      size={size}
      total={total}
      onPageChange={(next) => setParams({ page: String(next) })}
      onSizeChange={(next) => setParams({ pageSize: String(next) })}
    />
  )
}
