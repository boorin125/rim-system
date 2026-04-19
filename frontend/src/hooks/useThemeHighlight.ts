'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to read the --theme-highlight CSS custom property set by the layout.
 * Reads synchronously on first render (inline script sets the var before paint).
 * Uses MutationObserver to react to real-time theme changes.
 */
export function useThemeHighlight() {
  const [color, setColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (v) return v
    }
    return '#3b82f6'
  })
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--theme-highlight')
        .trim()
      if (v) setColor(v)
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return color
}
