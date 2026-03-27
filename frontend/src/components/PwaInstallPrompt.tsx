'use client'

import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Dismissed before — don't show again for 7 days
    const dismissed = localStorage.getItem('pwaPromptDismissed')
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    // iOS Safari — no beforeinstallprompt, show manual instructions
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    if (ios) {
      setIsIos(true)
      setTimeout(() => setShow(true), 3000)
      return
    }

    // Android Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('pwaPromptDismissed', String(Date.now()))
  }

  if (!show || isInstalled) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] animate-fade-in-up">
      <div className="bg-slate-800 border border-slate-600/60 rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-blue-600 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/pwa-icon" alt="App icon" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">ติดตั้ง RIM System</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {isIos
                ? 'แตะ Share แล้วเลือก "Add to Home Screen"'
                : 'ติดตั้งเป็น App เพื่อรับแจ้งเตือนพร้อม Logo ของคุณ'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {!isIos && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            ติดตั้ง App
          </button>
        )}

        {isIos && (
          <div className="mt-3 flex items-center gap-2 p-2.5 bg-slate-700/50 rounded-xl">
            <Smartphone className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-gray-300">
              แตะ <span className="font-semibold text-white">Share</span> → <span className="font-semibold text-white">Add to Home Screen</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
