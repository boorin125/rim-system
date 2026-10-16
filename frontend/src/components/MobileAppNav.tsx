'use client'

// Bottom navigation for the installed PWA (standalone, < 1024px).
// Browser users keep the sidebar layout â€” see useIsInstalledApp() in (dashboard)/layout.tsx.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, X, ChevronRight, Moon, Sun, LogOut } from 'lucide-react'
import { getHighestRole } from '@/config/permissions'

export interface AppNavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

/** True when running as an installed app (standalone) on a phone/tablet-sized screen */
export function useIsInstalledApp() {
  const [isApp, setIsApp] = useState(false)
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)')
    const narrow = window.matchMedia('(max-width: 1023px)')
    const update = () =>
      setIsApp((standalone.matches || (navigator as any).standalone === true) && narrow.matches)
    update()
    standalone.addEventListener('change', update)
    narrow.addEventListener('change', update)
    return () => {
      standalone.removeEventListener('change', update)
      narrow.removeEventListener('change', update)
    }
  }, [])
  return isApp
}

// Preferred bottom tabs per role (only menus the user can access are used; the rest go to "à¹€à¸¡à¸™à¸¹")
const TAB_PREFERENCE: Record<string, string[]> = {
  TECHNICIAN: ['/dashboard', '/dashboard/incidents', '/dashboard/stores', '/dashboard/knowledge-base'],
  OUTSOURCE: ['/dashboard', '/dashboard/incidents', '/dashboard/outsource', '/dashboard/knowledge-base'],
  HELP_DESK: ['/dashboard', '/dashboard/incidents', '/dashboard/stores', '/dashboard/equipment'],
  SUPERVISOR: ['/dashboard', '/dashboard/incidents', '/dashboard/performance', '/dashboard/map'],
  MONITOR: ['/dashboard/performance', '/dashboard/map'],
}
const TAB_COUNT = 4

const isActivePath = (pathname: string, href: string) =>
  href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`)

export default function MobileAppNav({
  user,
  navItems,
  isDark,
  onToggleTheme,
  onLogout,
  appVersion,
}: {
  user: any
  navItems: AppNavItem[]
  isDark: boolean
  onToggleTheme: () => void
  onLogout: () => void
  appVersion: string
}) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Close the sheet whenever the page changes
  useEffect(() => { setSheetOpen(false) }, [pathname])

  const role = getHighestRole(user) || 'TECHNICIAN'
  const prefKey =
    role === 'TECHNICIAN' && user?.technicianType === 'OUTSOURCE' ? 'OUTSOURCE'
    : ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR'].includes(role) ? 'SUPERVISOR'
    : role
  const preferred = TAB_PREFERENCE[prefKey] ?? TAB_PREFERENCE.TECHNICIAN

  const tabs = [
    ...preferred.map((href) => navItems.find((i) => i.href === href)).filter(Boolean) as AppNavItem[],
  ]
  for (const item of navItems) {
    if (tabs.length >= TAB_COUNT) break
    if (!tabs.includes(item)) tabs.push(item)
  }
  const tabItems = tabs.slice(0, TAB_COUNT)
  const moreItems = navItems.filter((i) => !tabItems.includes(i))
  const moreActive = sheetOpen || moreItems.some((i) => isActivePath(pathname, i.href)) || pathname.startsWith('/dashboard/profile')

  const avatarUrl = user?.avatarPath
    ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${user.avatarPath.startsWith('/uploads/') ? user.avatarPath : `/uploads/${user.avatarPath}`}`
    : null
  const initials = `${user?.firstNameEn?.[0] || user?.firstName?.[0] || '?'}${user?.lastNameEn?.[0] || user?.lastName?.[0] || ''}`

  const renderTab = (key: string, label: string, Icon: AppNavItem['icon'], active: boolean, content: { href?: string; onClick?: () => void }) => {
    const inner = (
      <>
        {/* Active tab: theme-colored bubble, slightly larger */}
        <span
          className={`flex items-center justify-center rounded-full transition-all duration-200 ${
            active ? 'w-14 h-9 -translate-y-0.5 scale-110 shadow-lg' : 'w-12 h-8 text-gray-400'
          }`}
          // inline color: html.light overrides .text-white to dark text
          style={active ? { backgroundColor: 'var(--theme-highlight)', color: '#ffffff' } : undefined}
        >
          <Icon className={active ? 'w-[22px] h-[22px]' : 'w-5 h-5'} />
        </span>
        <span className={`text-[11px] leading-tight truncate max-w-full ${active ? 'text-white font-semibold' : 'text-gray-400'}`}>
          {label}
        </span>
      </>
    )
    const cls = 'flex flex-col items-center justify-end gap-1 min-h-[52px] min-w-0 px-1'
    return content.href ? (
      <Link key={key} href={content.href} className={cls} aria-current={active ? 'page' : undefined}>
        {inner}
      </Link>
    ) : (
      <button key={key} type="button" onClick={content.onClick} className={cls} aria-expanded={sheetOpen}>
        {inner}
      </button>
    )
  }

  return (
    <>
      {/* "à¹€à¸¡à¸™à¸¹" bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSheetOpen(false)}>
          <div
            className="absolute left-0 right-0 bg-slate-800 rounded-t-3xl px-4 pt-2.5 pb-4 space-y-3.5 border-t border-slate-700 max-h-[75vh] overflow-y-auto"
            style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-600 mx-auto" />

            <Link href="/dashboard/profile" className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/50">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover border-2" style={{ borderColor: 'var(--theme-highlight)' }} />
              ) : (
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: 'var(--theme-highlight)' }}>
                  {initials}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-white truncate">{user?.firstName} {user?.lastName}</span>
                <span className="block text-xs text-gray-400 truncate">{user?.role} Â· à¸”à¸¹à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œ</span>
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>

            {moreItems.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((item) => {
                  const Icon = item.icon
                  const active = isActivePath(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex flex-col items-center gap-1.5 py-3.5 px-1.5 rounded-2xl text-center ${active ? '' : 'bg-slate-900/50 text-gray-300'}`}
                      style={active ? { backgroundColor: 'var(--theme-highlight)', color: '#ffffff' } : undefined}
                    >
                      <Icon className="w-[22px] h-[22px]" />
                      <span className="text-xs leading-tight">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="rounded-2xl bg-slate-900/50 overflow-hidden">
              <button type="button" onClick={onToggleTheme} className="w-full flex items-center gap-3 min-h-[52px] px-3.5 text-sm text-gray-200">
                {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <span className="flex-1 text-left">à¹‚à¸«à¸¡à¸”à¸¡à¸·à¸”</span>
                <span
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: isDark ? 'var(--theme-highlight)' : '#475569' }}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${isDark ? 'right-0.5' : 'left-0.5'}`} />
                </span>
              </button>
              <div className="h-px bg-slate-700/60 mx-3.5" />
              <button type="button" onClick={onLogout} className="w-full flex items-center gap-3 min-h-[52px] px-3.5 text-sm text-red-400">
                <LogOut className="w-5 h-5" />
                <span>à¸­à¸­à¸à¸ˆà¸²à¸à¸£à¸°à¸šà¸š</span>
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">Version {appVersion}</p>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        aria-label="à¹€à¸¡à¸™à¸¹à¸«à¸¥à¸±à¸"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-t border-slate-700/50 grid px-2 pt-2"
        style={{
          gridTemplateColumns: `repeat(${tabItems.length + 1}, minmax(0, 1fr))`,
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        }}
      >
        {tabItems.map((item) =>
          renderTab(item.href, item.name, item.icon, !sheetOpen && isActivePath(pathname, item.href), { href: item.href }),
        )}
        {renderTab('more', sheetOpen ? 'à¸›à¸´à¸”' : 'à¹€à¸¡à¸™à¸¹', sheetOpen ? X : LayoutGrid, moreActive, { onClick: () => setSheetOpen((v) => !v) })}
      </nav>
    </>
  )
}
