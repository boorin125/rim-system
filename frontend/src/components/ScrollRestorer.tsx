'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ScrollRestorer() {
  const pathname = usePathname()

  // Save scroll position just before a hard refresh (beforeunload)
  // This does NOT fire on soft Next.js navigation, only on browser refresh/close
  useEffect(() => {
    const save = () => {
      sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY))
    }
    window.addEventListener('beforeunload', save)
    return () => window.removeEventListener('beforeunload', save)
  }, [pathname])

  // On path change: restore saved position (refresh) or scroll to top (navigation)
  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${pathname}`)
    if (!saved) {
      window.scrollTo(0, 0)
      return
    }
    const y = parseInt(saved, 10)
    // Attempt restore twice: immediately + after async content settles
    window.scrollTo(0, y)
    const t = setTimeout(() => window.scrollTo(0, y), 300)
    return () => clearTimeout(t)
  }, [pathname])

  return null
}
