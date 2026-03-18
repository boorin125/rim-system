'use client'

import { useEffect, useState } from 'react'
import { Copy, X } from 'lucide-react'

// Unique ID for this tab (lives only in memory — resets on every page load)
const THIS_TAB_ID = Math.random().toString(36).slice(2)
const CHANNEL_NAME = 'rim_single_tab'

export default function SingleTabGuard() {
  const [duplicateDetected, setDuplicateDetected] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return

    const channel = new BroadcastChannel(CHANNEL_NAME)

    // When this tab opens — announce presence
    channel.postMessage({ type: 'TAB_OPEN', tabId: THIS_TAB_ID })

    channel.onmessage = (event) => {
      const { type, tabId } = event.data

      // Another tab just opened — respond so it knows we exist
      if (type === 'TAB_OPEN' && tabId !== THIS_TAB_ID) {
        channel.postMessage({ type: 'TAB_EXISTS', tabId: THIS_TAB_ID })
      }

      // Another tab told us it already exists → we are the duplicate
      if (type === 'TAB_EXISTS') {
        setDuplicateDetected(true)
      }
    }

    return () => channel.close()
  }, [])

  // "ใช้แท็บนี้แทน" — tell all other tabs they are now the duplicate
  const claimThisTab = () => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage({ type: 'TAB_OPEN', tabId: THIS_TAB_ID })
    channel.close()
    setDuplicateDetected(false)
    setDismissed(false)
  }

  if (!duplicateDetected || dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/95 backdrop-blur text-white text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <Copy className="w-4 h-4 shrink-0" />
        <span className="font-medium">แอปนี้เปิดอยู่ในแท็บอื่นแล้ว</span>
        <span className="hidden sm:inline text-amber-100">— อาจเกิดปัญหาการแจ้งเตือนซ้ำซ้อน</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={claimThisTab}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition"
        >
          ใช้แท็บนี้แทน
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/20 rounded transition"
          title="ปิด"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
