// app/(dashboard)/layout.tsx - Dashboard Layout (FIXED BREADCRUMB)
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  AlertCircle,
  Store,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Monitor,
  TrendingUp,
  Briefcase,
  ScrollText,
  BookOpen,
  MapPin,
  Shield,
  Lock,
  Sun,
  Moon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import NotificationBell from '@/components/NotificationBell'
import SupervisorPendingAlert from '@/components/SupervisorPendingAlert'
import SingleTabGuard from '@/components/SingleTabGuard'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import { hasMenuAccess, getUserRoles } from '@/config/permissions'
import { LicenseProvider, useLicense } from '@/context/LicenseContext'
import { usePushNotification } from '@/hooks/usePushNotification'

// Organization settings interface
interface OrgSettings {
  organizationName: string
  incidentPrefix: string
  logoPath: string
}

function LicenseExpiredBanner() {
  const { isExpired, hasLicense, loading, daysRemaining, isTrialFull, isTrialGrace, isTrialExpired, trialDaysRemaining } = useLicense()
  if (loading) return null

  const base = 'w-full px-4 py-1 text-xs font-medium flex items-center justify-center gap-1.5 truncate'

  if (isTrialExpired) return (
    <div className={`${base} bg-red-600/90 text-white`}>
      <Lock className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">ระยะทดลองใช้งานสิ้นสุดแล้ว — กรุณา Activate License (Settings → License)</span>
    </div>
  )

  if (isExpired && !isTrialGrace && !isTrialExpired) return (
    <div className={`${base} bg-red-600/90 text-white`}>
      <Lock className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">License หมดอายุแล้ว — กรุณาติดต่อผู้ให้บริการเพื่อต่ออายุ</span>
    </div>
  )

  if (!hasLicense) return (
    <div className={`${base} bg-red-600/90 text-white`}>
      <Lock className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">ยังไม่ได้ Activate License — ฟีเจอร์บางส่วนถูกจำกัด (Settings → License)</span>
    </div>
  )

  if (isTrialFull) return (
    <div className={`${base} ${(trialDaysRemaining ?? 99) <= 7 ? 'bg-red-600/90' : 'bg-yellow-500/90'} text-white`}>
      <Shield className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">ทดลองใช้งาน — เหลือ {trialDaysRemaining} วัน โปรด Activate License เพื่อใช้งานเต็มรูปแบบ</span>
    </div>
  )

  if (daysRemaining !== null && daysRemaining <= 30) return (
    <div className={`${base} bg-amber-500/90 text-white`}>
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">License จะหมดอายุใน {daysRemaining} วัน — กรุณาต่ออายุที่ Settings → License</span>
    </div>
  )

  return null
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  usePushNotification()
  // Desktop always shows sidebar via lg:translate-x-0 — start hidden so mobile doesn't flash open
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false) // For top-right menu
  const [user, setUser] = useState<any>(null)
  // Init from cache so logo/name show instantly on refresh (no flash of default)
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('orgSettings')
      if (cached) try { return JSON.parse(cached) } catch { /* ignore */ }
    }
    return null
  })
  const [showPendingAlert, setShowPendingAlert] = useState(false)
  const [profileIncompleteFields, setProfileIncompleteFields] = useState<string[]>([])
  const [themeStyle, setThemeStyle] = useState<{ bgStart: string; bgEnd: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('themeStyle')
      if (cached) try { return JSON.parse(cached) } catch { /* ignore */ }
    }
    return null
  })

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('colorTheme') || 'dark') === 'dark'
    }
    return true
  })

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    localStorage.setItem('colorTheme', next)
    document.documentElement.className = next
  }

  // Mix hex color with white at given intensity (0-1) → light tint
  const hexToLightTint = (hex: string, intensity: number): string => {
    const c = hex.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return `rgb(${Math.round(255-(255-r)*intensity)},${Math.round(255-(255-g)*intensity)},${Math.round(255-(255-b)*intensity)})`
  }

  // Compute main background: dark uses hardcoded slate, light uses tint of theme color
  const themeBase = themeStyle?.bgEnd || '#3b82f6'
  const mainBg = isDark
    ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
    : `linear-gradient(135deg, ${hexToLightTint(themeBase, 0.28)} 0%, ${hexToLightTint(themeBase, 0.38)} 100%)`

  // Chrome (sidebar + header): 1 shade darker than background
  const chromeStyle = !isDark ? {
    background: hexToLightTint(themeBase, 0.50),
    borderColor: hexToLightTint(themeBase, 0.62),
  } : undefined

  // Ensure html class stays in sync with isDark (e.g. after login redirect)
  useEffect(() => {
    document.documentElement.className = isDark ? 'dark' : 'light'
  }, [isDark])

  // Sync body CSS vars when light theme + themeStyle changes
  useEffect(() => {
    if (!isDark && themeStyle) {
      const toRgbStr = (hex: string, a: number) => {
        const c = hex.replace('#', '')
        const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
        return `${Math.round(255-(255-r)*a)}, ${Math.round(255-(255-g)*a)}, ${Math.round(255-(255-b)*a)}`
      }
      document.documentElement.style.setProperty('--background-start-rgb', toRgbStr(themeStyle.bgStart, 0.28))
      document.documentElement.style.setProperty('--background-end-rgb', toRgbStr(themeStyle.bgEnd, 0.38))
    } else if (!isDark) {
      document.documentElement.style.setProperty('--background-start-rgb', '220, 230, 242')
      document.documentElement.style.setProperty('--background-end-rgb', '238, 242, 248')
    } else {
      document.documentElement.style.removeProperty('--background-start-rgb')
      document.documentElement.style.removeProperty('--background-end-rgb')
    }
  }, [isDark, themeStyle])

  // Derive highlight color from theme for active menu items
  const getHighlightColor = (hex: string) => {
    const c = hex.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16) / 255
    const g = parseInt(c.substring(2, 4), 16) / 255
    const b = parseInt(c.substring(4, 6), 16) / 255
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (mx + mn) / 2
    if (mx !== mn) {
      const d = mx - mn
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (mx === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    return `hsl(${Math.round(h * 360)}, ${Math.max(Math.round(s * 100), 30)}%, 42%)`
  }
  const activeMenuBg = themeStyle ? getHighlightColor(themeStyle.bgEnd) : undefined
  // Lighter shade (62%) for light mode — used for active menu, avatar, and buttons
  const activeColor = activeMenuBg
    ? isDark ? activeMenuBg : activeMenuBg.replace(', 42%)', ', 62%)')
    : isDark ? '#2563eb' : '#6096f0'

  // Sync highlight color to CSS custom property so child pages can use it
  useEffect(() => {
    document.documentElement.style.setProperty('--theme-highlight', activeColor)
  }, [activeColor])

  // Listen for theme changes from settings page
  useEffect(() => {
    const handleThemeChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.bgStart && detail?.bgEnd) {
        setThemeStyle(detail)
        localStorage.setItem('themeStyle', JSON.stringify(detail))
      }
    }
    window.addEventListener('themeUpdated', handleThemeChanged)
    return () => window.removeEventListener('themeUpdated', handleThemeChanged)
  }, [])

  // Layer 4: Honeypot integrity check — fire-and-forget on every dashboard load
  useEffect(() => {
    const mid = localStorage.getItem('_machineId') || 'unset'
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/license/_sys/integrity-check`, {
      method: 'GET',
      headers: {
        'X-Client-Build': process.env.NEXT_PUBLIC_BUILD_FINGERPRINT || 'unset',
        'X-Machine-Id': mid,
      },
    }).catch(() => {})
  }, [])

  // Check authentication and refresh user data
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')

    if (!token) {
      toast.error('กรุณาเข้าสู่ระบบ')
      const next = window.location.pathname + window.location.search
      router.push(`/login?next=${encodeURIComponent(next)}`)
      return
    }

    // Set initial user from localStorage
    if (userStr) {
      setUser(JSON.parse(userStr))
    }

    // Fetch fresh user data from API to get updated roles
    const fetchUserProfile = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/profile`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.data) {
          // Update localStorage with fresh user data (including updated roles)
          localStorage.setItem('user', JSON.stringify(res.data))
          setUser(res.data)

          // Show profile incomplete warning once per day (first login of day)
          const today = new Date().toISOString().slice(0, 10)
          if (localStorage.getItem('profileCheckDate') !== today) {
            localStorage.setItem('profileCheckDate', today)
            const roles = (res.data.roles || []).map((r: any) => r.role || r)
            const isTech = roles.includes('TECHNICIAN')
            if (isTech) {
              const missing: string[] = []
              if (!res.data.province) missing.push('จังหวัด (จำเป็นสำหรับ Tracking Map)')
              if (!res.data.phone) missing.push('เบอร์โทรศัพท์')
              if (missing.length > 0) setProfileIncompleteFields(missing)
            }
          }
        }
      } catch (error: any) {
        // If token is invalid, redirect to login
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          const next = window.location.pathname + window.location.search
          router.push(`/login?next=${encodeURIComponent(next)}`)
        }
      }
    }
    fetchUserProfile()

    // Fetch organization settings for logo
    const fetchOrgSettings = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/organization`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.data) {
          setOrgSettings(res.data)
          // Cache for instant apply on next refresh
          localStorage.setItem('orgSettings', JSON.stringify(res.data))
        }
      } catch {
        // Use defaults if not found
      }
    }
    fetchOrgSettings()

  }, [router])

  // Helper: apply title + favicon from org settings object
  const applyBranding = (settings: { organizationName?: string; logoPath?: string }) => {
    const appName = settings.organizationName
      ? `${settings.organizationName} Incident Management`
      : 'Rubjobb Incident Management'
    document.title = appName

    if (settings.logoPath) {
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')
      const logoUrl = settings.logoPath.startsWith('http')
        ? settings.logoPath
        : `${API_BASE}${settings.logoPath}`
      const existing = document.querySelector("link[rel~='icon']") as HTMLLinkElement
      const link = existing || document.createElement('link')
      link.rel = 'icon'
      link.href = logoUrl
      if (!existing) document.head.appendChild(link)
    }
  }

  // Apply cached branding immediately on mount (before API responds)
  useEffect(() => {
    const cached = localStorage.getItem('orgSettings')
    if (cached) {
      try { applyBranding(JSON.parse(cached)) } catch {}
    }
  }, [])

  // Re-apply when org settings load from API or on navigation
  useEffect(() => {
    if (!orgSettings) return
    applyBranding(orgSettings)
  }, [orgSettings, pathname])

  // Supervisor: show pending incidents alert on login and every hour
  useEffect(() => {
    if (!user) return
    const roles: string[] = getUserRoles(user)
    if (!roles.includes('SUPERVISOR')) return

    const HOUR_MS = 60 * 60 * 1000
    const storageKey = `pendingAlertLastShown_${user.id}`

    const checkAndShow = () => {
      const lastShown = localStorage.getItem(storageKey)
      if (!lastShown || Date.now() - parseInt(lastShown) >= HOUR_MS) {
        setShowPendingAlert(true)
      }
    }

    // Check immediately on login/mount
    checkAndShow()

    // Re-check every minute (shows when 1h has elapsed)
    const interval = setInterval(checkAndShow, 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  // Fetch theme settings on every page navigation to keep in sync with admin changes
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    const fetchTheme = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/theme`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.data?.bgStart && res.data?.bgEnd) {
          const { bgStart, bgEnd } = res.data
          // Use functional setState to avoid stale closure issues
          setThemeStyle(prev => {
            if (prev?.bgStart === bgStart && prev?.bgEnd === bgEnd) {
              return prev // same reference = no re-render
            }
            localStorage.setItem('themeStyle', JSON.stringify({ bgStart, bgEnd }))
            return { bgStart, bgEnd }
          })
        }
      } catch {
        // Use default gradient
      }
    }
    fetchTheme()
  }, [pathname])

  // Fetch app version once on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/version`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (res.data?.version) setAppVersion(res.data.version)
    }).catch(() => {})
  }, [])

  // Handle logout
  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')

    // Call logout API to invalidate refresh token
    if (refreshToken) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        // Ignore errors, just clear local storage
      }
    }

    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    toast.success('ออกจากระบบสำเร็จ')
    router.push('/login')
  }

  // All navigation items
  const allNavItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Incidents',
      href: '/dashboard/incidents',
      icon: AlertCircle,
    },
    {
      name: 'Stores',
      href: '/dashboard/stores',
      icon: Store,
    },
    {
      name: 'Equipment',
      href: '/dashboard/equipment',
      icon: Monitor,
    },
    {
      name: 'Users',
      href: '/dashboard/users',
      icon: Users,
    },
    {
      name: 'Performance',
      href: '/dashboard/performance',
      icon: TrendingUp,
    },
    {
      name: 'Outsource',
      href: '/dashboard/outsource',
      icon: Briefcase,
    },
    {
      name: 'Realtime Tracking',
      href: '/dashboard/map',
      icon: MapPin,
    },
    {
      name: 'Reports',
      href: '/dashboard/reports',
      icon: BarChart3,
    },
    {
      name: 'Audit Trail',
      href: '/dashboard/audit-trail',
      icon: ScrollText,
    },
    {
      name: 'Knowledge Base',
      href: '/dashboard/knowledge-base',
      icon: BookOpen,
    },
    {
      name: 'SLA Defense',
      href: '/dashboard/sla-defense',
      icon: Shield,
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
    },
  ]

  // Filter navigation items based on user's role permissions
  const navItems = useMemo(() => {
    if (!user) return []
    const roles = getUserRoles(user)
    const higherThanTech = ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR', 'HELP_DESK']
    const isOutsourceTech =
      roles.includes('TECHNICIAN') &&
      !roles.some(r => higherThanTech.includes(r)) &&
      user?.technicianType === 'OUTSOURCE'
    return allNavItems
      .filter(item => hasMenuAccess(user, item.href))
      .map(item =>
        item.href === '/dashboard/outsource' && isOutsourceTech
          ? { ...item, name: 'Market Place' }
          : item
      )
  }, [user])

  // ✅ FIX: Get current page name based on pathname
  const getCurrentPageName = () => {
    // เรียงจากเฉพาะเจาะจงไปทั่วไป (ยาวไปสั้น)
    // ต้องเช็ค /dashboard/incidents ก่อน /dashboard

    // Exact match for dashboard home
    if (pathname === '/dashboard') {
      return 'Dashboard'
    }

    // Check other routes (use startsWith for sub-routes)
    const matchedItem = allNavItems
      .filter(item => item.href !== '/dashboard') // Skip dashboard home
      .find(item => pathname.startsWith(item.href))

    if (pathname.startsWith('/dashboard/sla-defense')) return 'SLA Defense'

    return matchedItem?.name || 'Dashboard'
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: mainBg }}>
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <LicenseProvider>
    <div className="min-h-screen" style={{ background: mainBg }}>
      {/* Single Tab Guard — warns when app is open in multiple tabs */}
      <SingleTabGuard />
      {/* PWA Install Prompt */}
      <PwaInstallPrompt />

      {/* Background Pattern */}
      <div className="fixed inset-0 bg-pattern"></div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full w-64 max-w-[85vw] glass-card border-r border-slate-700/50 flex flex-col">
          {/* Logo + Organization Name */}
          <div className="p-4 pb-3 border-b border-slate-700/50" style={chromeStyle}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {orgSettings?.logoPath ? (
                  <img
                    src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${orgSettings.logoPath}`}
                    alt={orgSettings.organizationName || 'Logo'}
                    className="w-full max-h-24 object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/logo.png'
                    }}
                  />
                ) : (
                  <img
                    src="/logo.png"
                    alt="RIM"
                    className="w-full max-h-24 object-contain"
                  />
                )}
                <p className="text-[11px] text-gray-400 mt-2 leading-tight truncate text-center">
                  {orgSettings?.organizationName
                    ? `${orgSettings.organizationName} Incident Management`
                    : 'Rubjobb Incident Management'}
                </p>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-700/50 transition duration-200 ml-2 flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false) }}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition duration-200 ${
                    isActive
                      ? 'text-white'
                      : 'text-gray-300 hover:bg-slate-700/50'
                  }`}
                  style={isActive ? { backgroundColor: activeColor } : undefined}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer - Version Info */}
          <div className="p-4 border-t border-slate-700/50">
            <div className="text-center">
              <p className="text-xs text-gray-500">Version {appVersion}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="transition-all duration-300 lg:ml-64">
        {/* Top Navbar - FIXED (ไม่เคลื่อนไหว) */}
        <header className="fixed top-0 right-0 left-0 lg:left-64 z-30 glass-card border-b border-slate-700/50" style={chromeStyle}>
          <LicenseExpiredBanner />
          {profileIncompleteFields.length > 0 && (
            <div className="w-full px-4 py-1.5 text-xs font-medium flex items-center justify-between gap-2 bg-amber-500/95 text-white">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  ⚠️ โปรไฟล์ยังไม่ครบถ้วน: <strong>{profileIncompleteFields.join(', ')}</strong>
                </span>
                <Link
                  href="/dashboard/profile"
                  className="underline underline-offset-2 whitespace-nowrap hover:text-amber-100 transition-colors ml-1"
                  onClick={() => setProfileIncompleteFields([])}
                >
                  อัพเดทโปรไฟล์ →
                </Link>
              </div>
              <button
                onClick={() => setProfileIncompleteFields([])}
                className="flex-shrink-0 p-0.5 hover:bg-amber-600/50 rounded transition-colors"
                title="ปิด"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition duration-200 lg:hidden"
            >
              <Menu className="w-6 h-6 text-gray-300" />
            </button>

            {/* Page Title - ✅ FIXED */}
            <div className="flex-1 lg:flex-none">
              <h2 className="text-xl font-semibold text-white">
                {getCurrentPageName()}
              </h2>
            </div>

            {/* Right Side - Notifications & User Info (All screens) */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                title={isDark ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all duration-300 text-xs font-medium ${
                  isDark
                    ? 'bg-slate-700/60 border-slate-600 text-gray-300 hover:bg-slate-600/60'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {isDark ? (
                  <><Moon className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dark</span></>
                ) : (
                  <><Sun className="w-3.5 h-3.5" /><span className="hidden sm:inline">Light</span></>
                )}
              </button>

              {/* Notification Bell */}
              <NotificationBell />

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsUserMenuOpen(!isUserMenuOpen)
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/50 transition duration-200"
                >
                  {/* Name + role - desktop only */}
                  <div className="hidden lg:block text-right">
                    <p className="text-sm font-medium text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{user?.role}</p>
                  </div>
                  {user?.avatarPath ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${user.avatarPath.startsWith('/uploads/') ? user.avatarPath : `/uploads/${user.avatarPath}`}`}
                      alt="Avatar"
                      className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover border-2"
                      style={{ borderColor: `${activeColor}80` }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-white text-xs lg:text-sm font-bold"
                      style={{ backgroundColor: activeColor }}
                    >
                      {(user?.firstNameEn?.[0] || user?.firstName?.[0] || '?')}{(user?.lastNameEn?.[0] || user?.lastName?.[0] || '')}
                    </div>
                  )}
                  <ChevronDown className="hidden lg:block w-4 h-4 text-gray-400" />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/10"
                      onClick={() => setIsUserMenuOpen(false)}
                    ></div>
                    <div
                      className="absolute right-0 top-full mt-2 w-56 bg-slate-800 backdrop-blur-xl rounded-lg overflow-hidden shadow-2xl border border-slate-600 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-3 border-b border-slate-700 bg-slate-900">
                        <p className="text-sm font-medium text-white">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{user?.email}</p>
                        <p className="text-xs text-gray-500 mt-1">{user?.role}</p>
                      </div>

                      <Link
                        href="/dashboard/profile"
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-slate-700 transition duration-200 text-gray-300"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile</span>
                      </Link>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          handleLogout()
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-red-600/40 transition duration-200 text-red-400"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - เพิ่ม pt-28 เพื่อไม่ให้ header ทับ */}
        <main className="relative z-10 p-4 lg:p-6 pt-20 lg:pt-28">{children}</main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Supervisor Pending Incidents Alert */}
      {showPendingAlert && user && (
        <SupervisorPendingAlert
          userId={user.id}
          onDismiss={() => setShowPendingAlert(false)}
        />
      )}
    </div>
    </LicenseProvider>
  )
}
