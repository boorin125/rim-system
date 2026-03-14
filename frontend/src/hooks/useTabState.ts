'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Persists active tab in URL search params (?tab=xxx)
 * Refresh stays on same tab, URL is shareable/bookmarkable
 */
export function useTabState<T extends string>(defaultTab: T) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = (searchParams.get('tab') as T) || defaultTab

  const setActiveTab = useCallback(
    (tab: T) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  return [activeTab, setActiveTab] as const
}
