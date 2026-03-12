'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to read the --theme-highlight CSS custom property set by the layout.
 * Uses MutationObserver to react to changes in real-time.
 * Default fallback: #3b82f6 (blue-500)
 */
export function useThemeHighlight() {
  const [color, setColor] = useState('#3b82f6')
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
