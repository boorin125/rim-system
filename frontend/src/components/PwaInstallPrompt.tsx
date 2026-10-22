'use client'

// Install-the-app flow for the web (PWA):
// - first visit: a one-time popup (closing it never auto-shows it again)
// - until installed: a 📲 button in the header (PwaInstallButton) + a user-menu item open the install sheet anytime
// - the sheet adapts to the device: Chrome one-tap install / manual Chrome menu steps / iPhone Share steps / LINE-Facebook in-app browser

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Download, X, Smartphone, Share, MoreVertical, PlusSquare, Copy, Bell, Maximize2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { appDisplayName } from './PwaBranding'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'inapp' | 'desktop'

const POPUP_SEEN_KEY = 'pwaPromptDismissed'
const HIDDEN_KEY = 'pwaInstallHidden'

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

interface PwaInstallState {
  /** Running in a browser tab (not the installed app) — install is possible */
  canInstall: boolean
  /** Show the header 📲 button (phone/tablet browser, not hidden by the user) */
  showButton: boolean
  openSheet: () => void
}

const PwaInstallContext = createContext<PwaInstallState>({ canInstall: false, showButton: false, openSheet: () => {} })
export const usePwaInstall = () => useContext(PwaInstallContext)

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/Line\/|FBAN|FBAV|Instagram/i.test(ua)) return 'inapp'
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [isInstalled, setIsInstalled] = useState(true) // until checked on the client
  const [isHidden, setIsHidden] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [popup, setPopup] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [branding, setBranding] = useState<{ name: string; isTest: boolean }>({ name: 'RIM System', isTest: false })

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    setIsInstalled(standalone)
    if (standalone) return

    setPlatform(detectPlatform())
    setIsTouch(window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024)
    setIsHidden(store.get(HIDDEN_KEY) === '1')

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/public/branding`)
      .then(r => (r.ok ? r.json() : null))
      .then(b => { if (b) setBranding({ name: appDisplayName(b), isTest: !!b.isTestServer }) })
      .catch(() => {})

    // Android Chrome — the event may have fired before React mounted (captured in app/layout.tsx)
    const existing = (window as any).__pwaPrompt as BeforeInstallPromptEvent | null
    if (existing) setDeferredPrompt(existing)
    const onReady = () => setDeferredPrompt((window as any).__pwaPrompt ?? null)
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent) }
    const onInstalled = () => {
      store.set(HIDDEN_KEY, '1')
      setIsInstalled(true)
      setSheet(false)
      setPopup(false)
    }
    window.addEventListener('pwaPromptReady', onReady)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // One-time popup on a phone/tablet browser
    const t = setTimeout(() => {
      const touch = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024
      if (touch && !store.get(POPUP_SEEN_KEY) && store.get(HIDDEN_KEY) !== '1') setPopup(true)
    }, 2500)

    return () => {
      clearTimeout(t)
      window.removeEventListener('pwaPromptReady', onReady)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const openSheet = useCallback(() => { setPopup(false); setSheet(true) }, [])

  const closePopup = () => {
    setPopup(false)
    store.set(POPUP_SEEN_KEY, String(Date.now()))
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // A prompt can only be used once — Chrome may fire a new one later
    setDeferredPrompt(null)
    ;(window as any).__pwaPrompt = null
    if (outcome === 'accepted') {
      store.set(HIDDEN_KEY, '1')
      setIsInstalled(true)
      setSheet(false)
    }
  }

  const hideButton = () => {
    store.set(HIDDEN_KEY, '1')
    store.set(POPUP_SEEN_KEY, String(Date.now()))
    setIsHidden(true)
    setSheet(false)
    toast.success('ซ่อนปุ่มติดตั้งแล้ว — ติดตั้งภายหลังได้จากเมนูผู้ใช้')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      toast.success('คัดลอกลิงก์แล้ว — วางใน Chrome / Safari')
    } catch {
      toast(window.location.origin)
    }
  }

  const iconSrc = `${process.env.NEXT_PUBLIC_API_URL}/settings/public/pwa/icon/192`
  const canInstall = !isInstalled
  const value: PwaInstallState = { canInstall, showButton: canInstall && isTouch && !isHidden, openSheet }

  return (
    <PwaInstallContext.Provider value={value}>
      {children}

      {/* One-time popup */}
      {popup && canInstall && !sheet && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] animate-fade-in-up">
          <div className="bg-slate-800 border border-slate-600/60 rounded-2xl shadow-2xl p-4">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSrc} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-slate-700" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">ติดตั้ง {branding.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  ใช้งานเต็มจอ เปิดเร็ว และรับแจ้งเตือนงานทันที
                </p>
              </div>
              <button onClick={closePopup} className="p-1 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0" title="ปิด">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <button
              onClick={openSheet}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              ติดตั้ง App
            </button>
            <p className="text-[11px] text-gray-500 text-center mt-2">ติดตั้งภายหลังได้จากปุ่ม 📲 ด้านบน</p>
          </div>
        </div>
      )}

      {/* Install sheet */}
      {sheet && canInstall && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSheet(false)}>
          <div
            className="w-full sm:max-w-sm bg-slate-800 border border-slate-600/60 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4 animate-fade-in-up"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSrc} alt="" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 bg-slate-700" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white truncate">{branding.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">ติดตั้งแอปบนมือถือ</p>
                {branding.isTest && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">TEST SERVER</span>
                )}
              </div>
              <button onClick={() => setSheet(false)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors" title="ปิด">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-700/40"><Maximize2 className="w-3.5 h-3.5 text-blue-400" /> เปิดเร็ว เต็มจอ</div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-700/40"><Bell className="w-3.5 h-3.5 text-blue-400" /> แจ้งเตือนงานทันที</div>
            </div>

            {platform === 'inapp' ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-300">
                  ติดตั้งจากในแอป LINE / Facebook ไม่ได้ — กรุณาเปิดลิงก์นี้ใน Chrome (Android) หรือ Safari (iPhone)
                </p>
                <button onClick={copyLink} className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
                  <Copy className="w-4 h-4" /> คัดลอกลิงก์
                </button>
              </div>
            ) : platform === 'ios' ? (
              <ol className="space-y-2 text-sm text-gray-300">
                <Step n={1}>แตะปุ่ม <Share className="inline w-4 h-4 text-blue-400 -mt-0.5" /> <b className="text-white">Share</b> ที่แถบล่างของ Safari</Step>
                <Step n={2}>เลื่อนลงแล้วเลือก <PlusSquare className="inline w-4 h-4 text-blue-400 -mt-0.5" /> <b className="text-white">เพิ่มไปยังหน้าจอโฮม</b> (Add to Home Screen)</Step>
                <Step n={3}>ตั้งชื่อเป็น <b className="text-white">{branding.name}</b> แล้วกด <b className="text-white">เพิ่ม</b></Step>
              </ol>
            ) : deferredPrompt ? (
              <button onClick={handleInstall} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <Download className="w-4 h-4" /> ติดตั้ง App
              </button>
            ) : (
              <ol className="space-y-2 text-sm text-gray-300">
                <Step n={1}>แตะเมนู <MoreVertical className="inline w-4 h-4 text-blue-400 -mt-0.5" /> มุมขวาบนของ {platform === 'desktop' ? 'Chrome / Edge' : 'Chrome'}</Step>
                <Step n={2}>เลือก <b className="text-white">ติดตั้งแอป</b> หรือ <b className="text-white">เพิ่มไปยังหน้าจอหลัก</b></Step>
                <Step n={3}>กด <b className="text-white">ติดตั้ง</b> — ไอคอน {branding.name} จะอยู่บนหน้าจอ</Step>
              </ol>
            )}

            <button onClick={hideButton} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">
              ติดตั้งแล้ว? ซ่อนปุ่มนี้
            </button>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}

/** Header button — stays until the app is installed (or the user hides it) */
export function PwaInstallButton() {
  const { showButton, openSheet } = usePwaInstall()
  if (!showButton) return null
  return (
    <button
      onClick={openSheet}
      title="ติดตั้งแอปบนมือถือ"
      className="relative p-2 rounded-lg hover:bg-slate-700/50 transition duration-200"
    >
      <Smartphone className="w-5 h-5 text-gray-300" />
      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
    </button>
  )
}

/** User-menu entry — always available in a browser tab, also after the header button was hidden */
export function PwaInstallMenuItem({ onClick }: { onClick?: () => void }) {
  const { canInstall, openSheet } = usePwaInstall()
  if (!canInstall) return null
  return (
    <button
      onClick={() => { onClick?.(); openSheet() }}
      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-700 transition duration-200 text-gray-300"
    >
      <Smartphone className="w-4 h-4" />
      <span className="text-sm">ติดตั้งแอปบนมือถือ</span>
    </button>
  )
}

export default PwaInstallProvider
