'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck,
  X,
  ExternalLink,
  Clock,
  CheckCheck,
  RefreshCw,
  User,
} from 'lucide-react'
import axios from 'axios'
import { formatStore } from '@/utils/formatStore'

interface ResolvedIncident {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  resolvedAt?: string
  createdAt: string
  store?: { id: number; storeCode: string; name: string }
  assignees?: Array<{ user?: { firstName: string; lastName: string } }>
}

interface Props {
  userId: number
  onDismiss: () => void
}

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'วิกฤต', HIGH: 'สูง', MEDIUM: 'ปานกลาง', LOW: 'ต่ำ',
}
const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
  LOW: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' },
}

function getTimeSinceResolved(resolvedAt?: string): string {
  if (!resolvedAt) return ''
  const diffMs = Date.now() - new Date(resolvedAt).getTime()
  const days = Math.floor(diffMs / 86400000)
  const hours = Math.floor((diffMs % 86400000) / 3600000)
  const mins = Math.floor((diffMs % 3600000) / 60000)
  if (days > 0) return `resolve แล้ว ${days} วัน ${hours} ชม.`
  if (hours > 0) return `resolve แล้ว ${hours} ชม. ${mins} น.`
  return `resolve แล้ว ${mins} น.`
}

export default function HelpdeskResolvedAlert({ userId, onDismiss }: Props) {
  const router = useRouter()
  const [incidents, setIncidents] = useState<ResolvedIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState(new Date())
  const [slaNames, setSlaNames] = useState<Record<string, string>>({})
  const [themeHighlight, setThemeHighlight] = useState('#22c55e')
  const [isDark, setIsDark] = useState(() =>
    typeof window === 'undefined' || !document.documentElement.classList.contains('light')
  )

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(!document.documentElement.classList.contains('light'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const readHighlight = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (val) setThemeHighlight(val)
    }
    readHighlight()
    const obs = new MutationObserver(readHighlight)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

  const themeColor = (() => {
    try { return JSON.parse(localStorage.getItem('themeStyle') || '{}').bgEnd || '#3b82f6' } catch { return '#3b82f6' }
  })()

  const hexTint = (hex: string, intensity: number) => {
    const c = hex.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
    return `rgb(${Math.round(255-(255-r)*intensity)},${Math.round(255-(255-g)*intensity)},${Math.round(255-(255-b)*intensity)})`
  }

  const modalBg  = isDark ? undefined : hexTint(themeColor, 0.12)
  const headerBg = isDark ? undefined : hexTint(themeColor, 0.22)
  const rowBg    = isDark ? undefined : hexTint(themeColor, 0.10)
  const rowBorder= isDark ? undefined : hexTint(themeColor, 0.30)
  const footerBg = isDark ? undefined : hexTint(themeColor, 0.16)

  useEffect(() => {
    fetchResolvedIncidents()
    const token = localStorage.getItem('token')
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sla`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      const map: Record<string, string> = {}
      ;(res.data || []).forEach((c: any) => { map[c.priority] = c.name })
      setSlaNames(map)
    }).catch(() => {})
  }, [])

  const fetchResolvedIncidents = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents?limit=200&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const all: ResolvedIncident[] = response.data?.data || response.data || []
      const resolved = all
        .filter(i => i.status === 'RESOLVED')
        .sort((a, b) => {
          // Oldest resolved first (waiting longest = most urgent)
          const aTime = a.resolvedAt ? new Date(a.resolvedAt).getTime() : new Date(a.createdAt).getTime()
          const bTime = b.resolvedAt ? new Date(b.resolvedAt).getTime() : new Date(b.createdAt).getTime()
          return aTime - bTime
        })
      setIncidents(resolved)
      setCheckedAt(new Date())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(`helpdeskAlertLastShown_${userId}`, Date.now().toString())
    onDismiss()
  }

  const handleViewAll = () => {
    handleDismiss()
    router.push('/dashboard/incidents?status=RESOLVED')
  }

  const handleClickIncident = (id: string) => {
    handleDismiss()
    router.push(`/dashboard/incidents/${id}`)
  }

  const counts = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.priority] = (acc[i.priority] || 0) + 1
    return acc
  }, {})

  const formatCheckedAt = (d: Date) =>
    d.toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-2xl glass-card rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-green-500/30"
        style={modalBg ? { background: modalBg } : undefined}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 sm:p-5 border-b border-slate-700/50 flex-shrink-0 gap-2"
          style={headerBg ? { background: headerBg } : undefined}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-green-500/20 rounded-xl shrink-0">
              <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white whitespace-nowrap">
                  รอ Confirm ปิดงาน
                </h2>
                {!loading && (
                  <span className="px-2 py-0.5 text-xs sm:text-sm bg-green-500/20 text-green-400 rounded-full border border-green-500/30 whitespace-nowrap">
                    {incidents.length} งาน
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">ตรวจสอบเมื่อ {formatCheckedAt(checkedAt)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={fetchResolvedIncidents}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Priority Summary Chips */}
        {!loading && incidents.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-700/50 flex-shrink-0">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(p =>
              counts[p] ? (
                <span
                  key={p}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border ${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} ${PRIORITY_COLORS[p].border}`}
                >
                  {slaNames[p] || PRIORITY_LABELS[p]}: {counts[p]}
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Incident List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold">ไม่มีงานรอ Confirm</p>
              <p className="text-gray-400 text-sm mt-1">งานทั้งหมดได้รับการ Confirm ปิดแล้ว</p>
            </div>
          ) : (
            incidents.map(incident => {
              const pc = PRIORITY_COLORS[incident.priority] || PRIORITY_COLORS['LOW']
              const timeSince = getTimeSinceResolved(incident.resolvedAt)
              return (
                <div
                  key={incident.id}
                  className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 hover:border-slate-500/50 cursor-pointer transition-colors group"
                  style={rowBg ? { background: rowBg, borderColor: rowBorder } : undefined}
                  onClick={() => handleClickIncident(incident.id)}
                >
                  {/* Priority Badge */}
                  <span className={`flex-shrink-0 mt-0.5 px-2 py-0.5 text-xs font-bold rounded ${pc.bg} ${pc.text}`}>
                    {slaNames[incident.priority] || PRIORITY_LABELS[incident.priority] || incident.priority}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 font-mono">{incident.ticketNumber}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">
                        แก้ไขแล้ว
                      </span>
                      {timeSince && (
                        <span className="text-xs text-amber-400 font-medium">
                          ⏱ {timeSince}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white font-medium mt-0.5 truncate">{incident.title}</p>
                    {incident.store && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatStore(incident.store)}</p>
                    )}
                    {incident.assignees && incident.assignees.length > 0 ? (
                      <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0" />
                        {incident.assignees.map(a => `${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.trim()).filter(Boolean).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0" />
                        ไม่มีผู้รับผิดชอบ
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-green-400 flex-shrink-0 transition-colors mt-1" />
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between p-4 border-t border-slate-700/50 flex-shrink-0"
          style={footerBg ? { background: footerBg } : undefined}
        >
          <button
            onClick={handleViewAll}
            className="flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-400/50 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            ดูทั้งหมดใน Incident List
          </button>
          <button
            onClick={handleDismiss}
            className="flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium transition-all"
            style={{ backgroundColor: themeHighlight }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            <CheckCheck className="w-4 h-4" />
            รับทราบ
          </button>
        </div>
      </div>
    </div>
  )
}
