// app/(dashboard)/dashboard/projects/overview/page.tsx — Project analytics dashboard (merged from RPM)
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import {
  BarChart2, Clock, RefreshCw,
  TrendingUp, Zap, Timer, ChevronLeft, ChevronRight,
  MapPin, ChevronDown, Users, Calendar, Store,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Legend,
} from 'recharts'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { formatStore } from '@/utils/formatStore'

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
    </div>
  ),
})

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectItem {
  id: number
  name: string
  status: string
  color: string
}

interface TimingStats {
  count: number
  avgMinutes: number
  minMinutes: number
  maxMinutes: number
}

interface CalendarTask {
  id: number
  scheduledDate: string
  status: string
  projectStore: {
    project: { id: number; name: string; color: string }
    store: { id: number; name: string; storeCode: string }
  }
}

interface ActiveCheckin {
  id: number
  checkInAt: string
  checkInLat: number
  checkInLng: number
  status: string
  projectStore: {
    project: { id: number; name: string }
    store: { id: number; name: string; storeCode: string }
  }
  assignedTo?: { id: number; firstName: string; lastName: string; avatarPath?: string | null } | null
}

interface BrandBreakdown {
  id: number
  name: string
  color: string
  total: number
  completed: number
  accepted: number
  successPct: number
}

interface AgingTask {
  id: number
  ticketNo?: string | null
  title: string
  status: string
  agingDays: number
  rejectionNote?: string | null
  project?: { id: number; name: string } | null
  store?: { id: number; name: string; storeCode: string } | null
  assignedTo?: { id: number; firstName: string; lastName: string } | null
}

interface FtsByBrand {
  projectId: number
  name: string
  rate: number | null
  accepted: number
  total: number
}

interface DashboardData {
  taskStats: Record<string, number>
  rescheduledCount: number
  timingStats: TimingStats
  activeCheckins: ActiveCheckin[]
  projects: ProjectItem[]
  brandBreakdown?: BrandBreakdown[]
  agingStores?: AgingTask[]
  ftsRate?: number | null
  ftsTotal?: number
  ftsAccepted?: number
  ftsByBrand?: FtsByBrand[]
}

interface WeeklyStore {
  label: string
  dateRange: string
  assigned: number
  completed: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMinutes(min: number) {
  if (min === 0) return '—'
  if (min < 60) return `${min} นาที`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}ชม. ${m}น.` : `${h} ชม.`
}

function isoDateStr(date: Date) {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

function getMonthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function fmtTime(isoStr: string | null) {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDateThai(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoDateStr(d)
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600',
  'bg-cyan-600', 'bg-amber-600', 'bg-pink-600', 'bg-indigo-600',
]
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const TASK_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  IN_PROGRESS:   { label: 'กำลังทำ',     cls: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  COMPLETED:     { label: 'เสร็จสิ้น',   cls: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  PENDING_VERIFY:{ label: 'รอตรวจ',      cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  RESCHEDULED:   { label: 'เลื่อน',      cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  SCHEDULED:     { label: 'นัดหมาย',    cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  PENDING:       { label: 'รอดำเนินการ', cls: 'bg-slate-500/20 text-slate-300 border border-slate-500/30' },
  ACCEPTED:      { label: 'ยอมรับแล้ว',  cls: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
  FAILED:        { label: 'ล้มเหลว',      cls: 'bg-red-500/20 text-red-300 border border-red-500/30' },
  REVISIT:       { label: 'Revisit',      cls: 'bg-pink-500/20 text-pink-300 border border-pink-500/30' },
  ROLLBACK:      { label: 'Rollback',     cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const STATUS_ROWS = [
  { key: 'COMPLETED',     label: 'เสร็จสิ้น',    color: '#22c55e', ring: 'ring-green-500/30',  bg: 'bg-green-500/10' },
  { key: 'ACCEPTED',      label: 'ยอมรับแล้ว',   color: '#06b6d4', ring: 'ring-cyan-500/30',   bg: 'bg-cyan-500/10' },
  { key: 'IN_PROGRESS',   label: 'กำลังทำ',      color: '#eab308', ring: 'ring-yellow-500/30', bg: 'bg-yellow-500/10' },
  { key: 'PENDING_VERIFY',label: 'รอตรวจสอบ',    color: '#f97316', ring: 'ring-orange-500/30', bg: 'bg-orange-500/10' },
  { key: 'SCHEDULED',     label: 'นัดหมาย',      color: '#3b82f6', ring: 'ring-blue-500/30',   bg: 'bg-blue-500/10' },
  { key: 'FAILED',        label: 'ล้มเหลว',       color: '#ef4444', ring: 'ring-red-500/30',    bg: 'bg-red-500/10' },
  { key: 'ROLLBACK',      label: 'Rollback',      color: '#f97316', ring: 'ring-amber-500/30',  bg: 'bg-amber-500/10' },
  { key: 'REVISIT',       label: 'Revisit',       color: '#ec4899', ring: 'ring-pink-500/30',   bg: 'bg-pink-500/10' },
  { key: 'RESCHEDULED',   label: 'เลื่อนกำหนด',  color: '#a855f7', ring: 'ring-purple-500/30', bg: 'bg-purple-500/10' },
  { key: 'PENDING',       label: 'รอดำเนินการ',  color: '#64748b', ring: 'ring-slate-500/30',  bg: 'bg-slate-500/10' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectsOverviewPage() {
  const themeHighlight = useThemeHighlight()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem('rim_project_dashboard_projectId')
    return saved ? Number(saved) : null
  })

  const handleSelectProject = (id: number | null) => {
    setSelectedProjectId(id)
    if (id) localStorage.setItem('rim_project_dashboard_projectId', String(id))
    else localStorage.removeItem('rim_project_dashboard_projectId')
  }

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [calTasks, setCalTasks] = useState<CalendarTask[]>([])
  const [calLoading, setCalLoading] = useState(false)

  // Map state
  const todayStr = isoDateStr(new Date())
  const [mapDate, setMapDate] = useState(todayStr)
  const [mapCheckins, setMapCheckins] = useState<ActiveCheckin[]>([])
  const [mapLoading, setMapLoading] = useState(false)

  // Weekly stores chart state
  const [weeklyStores, setWeeklyStores] = useState<WeeklyStore[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)

  const getToken = () => localStorage.getItem('token')

  // Store visits (project task check-ins + incidents done for the store) — for future cost estimates
  const [storeVisits, setStoreVisits] = useState<any[]>([])
  useEffect(() => {
    const params: Record<string, string> = {}
    if (selectedProjectId) params.projectId = String(selectedProjectId)
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/projects/analytics/store-visits`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        params,
      })
      .then((res) => setStoreVisits(res.data || []))
      .catch(() => setStoreVisits([]))
  }, [selectedProjectId])

  // ── Fetch main dashboard data ──────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (selectedProjectId) params.projectId = String(selectedProjectId)
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/analytics/dashboard`,
        { headers: { Authorization: `Bearer ${getToken()}` }, params },
      )
      setData(res.data)
    } catch {
      // silent fail on refresh
    } finally {
      if (!silent) setLoading(false)
    }
  }, [selectedProjectId])

  // ── Fetch calendar tasks for displayed month ───────────────────────────────
  const fetchCalendar = useCallback(async () => {
    setCalLoading(true)
    try {
      const params: Record<string, string> = {
        year: String(calMonth.year),
        month: String(calMonth.month),
      }
      if (selectedProjectId) params.projectId = String(selectedProjectId)
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/analytics/calendar`,
        { headers: { Authorization: `Bearer ${getToken()}` }, params },
      )
      setCalTasks(res.data)
    } catch {
      // silent fail
    } finally {
      setCalLoading(false)
    }
  }, [calMonth, selectedProjectId])

  // ── Fetch check-ins for selected map date ──────────────────────────────────
  const fetchMapCheckins = useCallback(async () => {
    setMapLoading(true)
    try {
      const params: Record<string, string> = { date: mapDate }
      if (selectedProjectId) params.projectId = String(selectedProjectId)
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/analytics/checkins-by-date`,
        { headers: { Authorization: `Bearer ${getToken()}` }, params },
      )
      setMapCheckins(res.data)
    } catch {
      // silent fail
    } finally {
      setMapLoading(false)
    }
  }, [mapDate, selectedProjectId])

  // ── Fetch weekly stores chart ───────────────────────────────────────────────
  const fetchWeeklyStores = useCallback(async () => {
    setWeeklyLoading(true)
    try {
      const params: Record<string, string> = {}
      if (selectedProjectId) params.projectId = String(selectedProjectId)
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/analytics/weekly-stores`,
        { headers: { Authorization: `Bearer ${getToken()}` }, params },
      )
      setWeeklyStores(res.data)
    } catch {
      // silent fail
    } finally {
      setWeeklyLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    fetchData()
    const iv = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(iv)
  }, [fetchData])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])
  useEffect(() => { fetchMapCheckins() }, [fetchMapCheckins])
  useEffect(() => { fetchWeeklyStores() }, [fetchWeeklyStores])

  // ── Calendar map ────────────────────────────────────────────────────────────
  const calendarMap = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {}
    for (const t of calTasks) {
      const d = t.scheduledDate.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(t)
    }
    return map
  }, [calTasks])

  const calDays = useMemo(() => {
    const { year, month } = calMonth
    const firstDay = new Date(year, month, 1).getDay()
    const totalDays = getMonthDays(year, month)
    const prevMonthLastDate = new Date(year, month, 0).getDate()
    const nextMonthCells = 42 - firstDay - totalDays
    return { firstDay, totalDays, prevMonthLastDate, nextMonthCells }
  }, [calMonth])

  // ── Map markers ─────────────────────────────────────────────────────────────
  const mapMarkers = useMemo(() => mapCheckins.map(c => ({
    id: String(c.id),
    ticketNumber: `TASK-${c.id}`,
    title: `${c.projectStore.project.name} — ${c.projectStore.store.storeCode}`,
    status: c.status,
    latitude: c.checkInLat,
    longitude: c.checkInLng,
    checkInAt: c.checkInAt,
    confirmedAt: null,
    resolvedAt: null,
    storeName: c.projectStore.store.name,
    storeCode: c.projectStore.store.storeCode,
    technicianName: c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : '-',
    technicianInitials: c.assignedTo ? c.assignedTo.firstName.charAt(0) : '?',
    technicianAvatar: c.assignedTo?.avatarPath ?? null,
  })), [mapCheckins])

  // ── Sorted tech list for right panel ────────────────────────────────────────
  const sortedCheckins = useMemo(() =>
    [...mapCheckins].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime()),
    [mapCheckins]
  )

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  const totalTasks = Object.values(data.taskStats).reduce((a, b) => a + b, 0)
  const completedCount = (data.taskStats['COMPLETED'] ?? 0) + (data.taskStats['ACCEPTED'] ?? 0)
  const overallPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0
  // SVG circle circumference for r=38: 2π×38 ≈ 238.76
  const CIRC = 238.76

  return (
    <div id="dashboard-root" className="p-4 md:p-6 space-y-5">
      <style>{`
        #dashboard-root .glass-card {
          box-shadow: 0 0 0 1px ${themeHighlight}18, 0 6px 32px -8px ${themeHighlight}45;
          transition: box-shadow 0.3s ease;
        }
        #dashboard-root .glass-card:hover {
          box-shadow: 0 0 0 1px ${themeHighlight}30, 0 8px 40px -6px ${themeHighlight}55;
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6" style={{ color: themeHighlight }} />
          <h1 className="text-2xl font-bold text-white">Project Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedProjectId ?? ''}
              onChange={e => handleSelectProject(e.target.value ? Number(e.target.value) : null)}
              className="appearance-none bg-slate-800 border border-slate-700 [&>option]:bg-slate-800 [&>option]:text-white text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[200px]"
            >
              <option value="">ทุกโปรเจกต์</option>
              {data.projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => { fetchData(); fetchCalendar(); fetchMapCheckins(); fetchWeeklyStores() }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* ── Row 1: Progress Card (left 1/2) + Weekly Stores Chart (right 1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Progress Card */}
        <div className="glass-card rounded-2xl p-6 border border-slate-700/50 flex flex-col">
          <div className="flex items-center gap-2 mb-5 shrink-0">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="font-semibold text-white text-lg">Over All</span>
            {selectedProjectId && (
              <span className="text-sm text-gray-500 truncate">
                — {data.projects.find(p => p.id === selectedProjectId)?.name}
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Ring */}
            <div className="shrink-0 flex flex-col items-center justify-center">
              <div className="relative" style={{ width: 360, height: 360 }}>
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={themeHighlight} strokeWidth="6"
                    strokeDasharray={`${(overallPercent / 100) * 251.33} 251.33`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-bold text-white leading-none">{overallPercent}%</span>
                  <span className="text-lg text-gray-400 mt-2">Progress</span>
                  <p className="text-base text-gray-400 mt-3">
                    <span className="text-white font-bold text-2xl">{completedCount}</span>
                    <span className="text-gray-500 text-base"> / {totalTasks} งาน</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 10 status cards 5×2 */}
            <div className="flex-1 grid grid-cols-5 gap-2">
              {STATUS_ROWS.map(s => {
                const cnt = data.taskStats[s.key] ?? 0
                const pct = totalTasks > 0 ? Math.round((cnt / totalTasks) * 100) : 0
                return (
                  <div key={s.key} className={`rounded-xl p-2.5 ring-1 ${s.ring} ${s.bg} flex flex-col min-h-0`}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] text-gray-300 leading-tight truncate">{s.label}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <p className="text-3xl font-bold text-white leading-none">{cnt}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Weekly Stores Bar Chart */}
        <div className="glass-card rounded-2xl p-6 border border-slate-700/50 flex flex-col">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-white text-lg">Qty. / Week</span>
            </div>
            <span className="text-sm font-semibold text-gray-300 bg-slate-700/60 px-2.5 py-1 rounded-lg">
              {new Date().getFullYear()}
            </span>
          </div>

          {weeklyLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="flex-1 min-h-0" style={{ minHeight: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyStores.map(w => ({ ...w, remaining: Math.max(0, w.assigned - w.completed) }))}
                  margin={{ top: 22, right: 4, left: -20, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as WeeklyStore
                      return (
                        <div style={{
                          backgroundColor: '#1e293b', border: '1px solid #334155',
                          borderRadius: 10, padding: '10px 14px', fontSize: 12,
                        }}>
                          <p style={{ color: '#94a3b8', marginBottom: 6 }}>{d.label} · {d.dateRange}</p>
                          <p style={{ color: '#3b82f6', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                            {d.assigned} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>มอบหมาย</span>
                          </p>
                          <p style={{ color: '#22c55e', fontWeight: 700, fontSize: 14 }}>
                            {d.completed} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>สำเร็จ</span>
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    formatter={(value) => value === 'assigned' ? 'มอบหมาย' : 'สำเร็จ'}
                    wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 4 }}
                  />
                  <Bar dataKey="completed" fill="#22c55e" stackId="a" maxBarSize={36} />
                  <Bar dataKey="remaining" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    <LabelList
                      dataKey="assigned"
                      position="top"
                      formatter={(v: number) => v > 0 ? v : ''}
                      style={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>

      </div>

      {/* ── Row 2: Timing Stats + FTS Rate (4 cards) ──────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: <Clock className="w-5 h-5 text-blue-400" />,   label: 'เวลาเฉลี่ย', value: fmtMinutes(data.timingStats.avgMinutes), sub: `จาก ${data.timingStats.count} งาน` },
          { icon: <Zap className="w-5 h-5 text-green-400" />,    label: 'เร็วที่สุด', value: fmtMinutes(data.timingStats.minMinutes), sub: 'เวลาน้อยที่สุด' },
          { icon: <Timer className="w-5 h-5 text-orange-400" />, label: 'ช้าที่สุด',  value: fmtMinutes(data.timingStats.maxMinutes), sub: 'เวลามากที่สุด' },
        ].map(card => (
          <div key={card.label} className="glass-card rounded-2xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-xs text-gray-400">{card.label}</span></div>
            <p className="text-xl font-bold text-white leading-none">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1.5">{card.sub}</p>
          </div>
        ))}
        {/* FTS Rate card */}
        <div className="glass-card rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <span className="text-xs text-gray-400">First-time Success</span>
          </div>
          {data.ftsRate != null ? (
            <>
              <p className="text-xl font-bold text-cyan-400 leading-none">{data.ftsRate}%</p>
              <p className="text-xs text-gray-500 mt-1.5">{data.ftsAccepted ?? 0} / {data.ftsTotal ?? 0} งาน</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-600 leading-none">—</p>
              <p className="text-xs text-gray-600 mt-1.5">ยังไม่มีข้อมูล</p>
            </>
          )}
        </div>
      </div>

      {/* ── Row 3: Brand Breakdown + Aging Stores ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Brand Breakdown */}
        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 flex flex-col">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <BarChart2 className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white text-base">Brand Breakdown</span>
            <span className="text-xs text-gray-500 ml-auto">% ผ่านการตรวจสอบ</span>
          </div>
          {!data.brandBreakdown?.length ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">ไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 280 }}>
              {data.brandBreakdown.map(b => (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="text-sm text-gray-200 truncate">{b.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs text-gray-500">{b.completed}/{b.total}</span>
                      <span className="text-sm font-bold text-white w-10 text-right">{b.successPct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${b.successPct}%`, backgroundColor: b.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* FTS per brand */}
          {!!data.ftsByBrand?.length && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <p className="text-xs text-gray-500 mb-2.5">First-time Success Rate per โปรเจกต์</p>
              <div className="space-y-1.5">
                {data.ftsByBrand.map(f => (
                  <div key={f.projectId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate">{f.name}</span>
                    <span className={`font-bold ml-2 ${f.rate != null && f.rate >= 80 ? 'text-green-400' : f.rate != null && f.rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {f.rate != null ? `${f.rate}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aging Stores */}
        <div className="glass-card rounded-2xl p-5 border border-slate-700/50 flex flex-col">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Timer className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-white text-base">Aging Stores</span>
            <span className="text-xs text-gray-500 ml-auto">งานที่ค้างอยู่ในสถานะปัญหา</span>
          </div>
          {!data.agingStores?.length ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600">
              <Zap className="w-8 h-8 opacity-20" />
              <p className="text-sm text-gray-500">ไม่มีงานค้าง</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-slate-700/50">
                    <th className="text-left pb-2 pr-2 font-medium">Store</th>
                    <th className="text-left pb-2 pr-2 font-medium">สถานะ</th>
                    <th className="text-right pb-2 font-medium">วันที่ค้าง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {data.agingStores.map(t => {
                    const agingColor = t.agingDays >= 14 ? 'text-red-400' : t.agingDays >= 7 ? 'text-amber-400' : 'text-yellow-300'
                    const statusColor: Record<string, string> = {
                      FAILED: 'bg-red-500/20 text-red-400',
                      REVISIT: 'bg-pink-500/20 text-pink-400',
                      ROLLBACK: 'bg-amber-500/20 text-amber-400',
                    }
                    return (
                      <tr key={t.id} className="hover:bg-slate-700/20 transition">
                        <td className="py-2 pr-2">
                          <div className="text-gray-200 font-medium truncate max-w-[140px]">
                            {t.store?.storeCode ?? '—'}
                          </div>
                          <div className="text-gray-500 truncate max-w-[140px]">{t.store?.name}</div>
                          <div className="text-gray-600 truncate max-w-[140px]">{t.project?.name}</div>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor[t.status] ?? 'bg-slate-500/20 text-gray-400'}`}>
                            {t.status}
                          </span>
                          {t.rejectionNote && (
                            <div className="text-gray-600 mt-0.5 truncate max-w-[100px]" title={t.rejectionNote}>
                              {t.rejectionNote}
                            </div>
                          )}
                        </td>
                        <td className={`py-2 text-right font-bold tabular-nums ${agingColor}`}>
                          {t.agingDays}d
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── Row 4: Tracking (full width, map 2/3 + tech list 1/3) ─────────── */}
      <div className="glass-card rounded-2xl border border-slate-700/50 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-white text-base">Tracking</span>
            <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ml-1 ${
              mapDate === todayStr ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${mapDate === todayStr ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
              {mapDate === todayStr ? 'Realtime' : 'ประวัติย้อนหลัง'}
            </span>
          </div>

          {/* Date navigation (RIM-style) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setMapDate(d => shiftDate(d, -1))}
                className="p-2.5 hover:bg-slate-700 text-gray-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="relative flex items-center gap-1.5 px-3">
                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-sm text-white font-medium whitespace-nowrap">
                  {fmtDateThai(mapDate)}
                </span>
                <input
                  type="date"
                  value={mapDate}
                  max={todayStr}
                  onChange={e => e.target.value && setMapDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <button
                onClick={() => setMapDate(d => shiftDate(d, 1))}
                disabled={mapDate >= todayStr}
                className="p-2.5 hover:bg-slate-700 text-gray-300 transition disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {mapDate !== todayStr && (
                <button
                  onClick={() => setMapDate(todayStr)}
                  className="px-3 py-2.5 bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition border-l border-slate-700"
                >
                  วันนี้
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body: map (2/3) + tech panel (1/3) */}
        <div className="flex" style={{ height: 680 }}>

          {/* Map */}
          <div className="flex-1 relative">
            {mapLoading && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
              </div>
            )}
            <MapView checkins={mapMarkers} technicianLocations={[]} />
            {mapMarkers.length === 0 && !mapLoading && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-800/90 text-gray-400 text-sm px-4 py-2 rounded-full border border-slate-700 pointer-events-none whitespace-nowrap">
                ไม่มีข้อมูล Check-in ในวันที่เลือก
              </div>
            )}
          </div>

          {/* Tech list panel (1/3) */}
          <div className="w-1/3 shrink-0 border-l border-slate-700/50 flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Check-in วันนี้</span>
              </div>
              <span className="text-xs text-gray-400 bg-slate-700/60 px-2 py-0.5 rounded-full">
                {sortedCheckins.length} รายการ
              </span>
            </div>

            {/* List */}
            {sortedCheckins.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-600">
                <MapPin className="w-10 h-10 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">ไม่มีข้อมูล</p>
                  <p className="text-xs text-gray-600 mt-1">ยังไม่มีการ Check-in ในวันที่เลือก</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-700/40">
                {sortedCheckins.map((c, idx) => {
                  const techName = c.assignedTo
                    ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}`
                    : 'ไม่ระบุ'
                  const initials = c.assignedTo
                    ? `${c.assignedTo.firstName.charAt(0)}${c.assignedTo.lastName.charAt(0)}`
                    : '?'
                  const badge = TASK_STATUS_BADGE[c.status] ?? { label: c.status, cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' }
                  const bgColor = avatarColor(techName)

                  return (
                    <div key={c.id} className="px-4 py-3 hover:bg-slate-700/25 transition">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}>
                          {c.assignedTo?.avatarPath ? (
                            <img src={c.assignedTo.avatarPath} alt={initials} className="w-full h-full rounded-full object-cover" />
                          ) : initials}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name + sequence */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono shrink-0">#{idx + 1}</span>
                            <span className="text-sm font-semibold text-white truncate">{techName}</span>
                          </div>

                          {/* Store */}
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="text-xs text-gray-300 truncate">
                              <span className="font-medium text-blue-400">{c.projectStore.store.storeCode}</span>
                              {' · '}{c.projectStore.store.name}
                            </span>
                          </div>

                          {/* Project */}
                          <p className="text-xs text-gray-500 truncate mt-0.5 pl-4">
                            {c.projectStore.project.name}
                          </p>

                          {/* Time + status */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-400 font-mono bg-slate-700/60 px-1.5 py-0.5 rounded">
                              🕐 {fmtTime(c.checkInAt)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Calendar ──────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl border border-slate-700/50">

        {/* Card title */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50 bg-slate-800/40">
          <Calendar className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white text-lg">ปฏิทินแผนงาน</span>
          {calLoading && <div className="w-4 h-4 rounded-full border-2 border-gray-600 border-t-blue-400 animate-spin ml-1" />}
        </div>

        {/* Month + Year navigation */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-slate-600/50">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCalMonth(m => ({ ...m, year: m.year - 1 }))}
              className="hidden sm:block p-2 hover:bg-slate-700/60 rounded-lg transition text-sm font-bold"
              style={{ color: themeHighlight }} title="ปีก่อน"
            >««</button>
            <button
              onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() } })}
              className="p-1.5 hover:bg-slate-700/60 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: themeHighlight }} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={calMonth.month}
              onChange={e => setCalMonth(m => ({ ...m, month: Number(e.target.value) }))}
              className="bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white text-white text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {THAI_MONTHS.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <select
              value={calMonth.year}
              onChange={e => setCalMonth(m => ({ ...m, year: Number(e.target.value) }))}
              className="bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white text-white text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => setCalMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })}
              className="hidden sm:block px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 rounded-lg transition font-medium"
            >วันนี้</button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() } })}
              className="p-1.5 hover:bg-slate-700/60 rounded-lg transition"
            >
              <ChevronRight className="w-5 h-5" style={{ color: themeHighlight }} />
            </button>
            <button
              onClick={() => setCalMonth(m => ({ ...m, year: m.year + 1 }))}
              className="hidden sm:block p-2 hover:bg-slate-700/60 rounded-lg transition text-sm font-bold"
              style={{ color: themeHighlight }} title="ปีถัดไป"
            >»»</button>
          </div>
        </div>

        {/* Day-of-week headers + grid — scrollable on mobile */}
        <div className="overflow-x-auto">
        <div className="min-w-[560px]">
        <div className="grid grid-cols-7 px-1.5 pb-0 pt-1">
          {[
            { label: 'อาทิตย์', short: 'อา', weekend: true },
            { label: 'จันทร์',  short: 'จ',  weekend: false },
            { label: 'อังคาร', short: 'อ',  weekend: false },
            { label: 'พุธ',     short: 'พ',  weekend: false },
            { label: 'พฤหัส',  short: 'พฤ', weekend: false },
            { label: 'ศุกร์',   short: 'ศ',  weekend: false },
            { label: 'เสาร์',   short: 'ส',  weekend: true },
          ].map(d => (
            <div key={d.label}
              className={`text-center py-2 text-xs font-semibold tracking-wide
                ${d.weekend ? 'text-red-400' : 'text-slate-400'}`}>
              <span className="hidden sm:inline">{d.label}</span>
              <span className="sm:hidden">{d.short}</span>
            </div>
          ))}
        </div>

        {/* Day grid — 42 cells */}
        <div className="grid grid-cols-7 gap-2 p-2 bg-slate-900/60 rounded-lg">

          {/* Previous month trailing days */}
          {Array.from({ length: calDays.firstDay }).map((_, i) => {
            const day = calDays.prevMonthLastDate - calDays.firstDay + 1 + i
            return (
              <div key={`prev-${i}`} className="rounded-lg min-h-[130px] p-2 bg-slate-900/60">
                <span className="text-sm font-bold text-slate-700">{day}</span>
              </div>
            )
          })}

          {/* Current month days */}
          {Array.from({ length: calDays.totalDays }).map((_, i) => {
            const day = i + 1
            const col = (calDays.firstDay + i) % 7
            const isWeekend = col === 0 || col === 6
            const mo = String(calMonth.month + 1).padStart(2, '0')
            const dd = String(day).padStart(2, '0')
            const dateStr = `${calMonth.year}-${mo}-${dd}`
            const tasks = calendarMap[dateStr] ?? []
            const isToday = dateStr === todayStr

            // Group by project
            const projectGroups = Object.values(
              tasks.reduce<Record<number, { project: { id: number; name: string; color: string }; stores: { id: number; name: string; storeCode: string }[] }>>(
                (acc, t) => {
                  const pid = t.projectStore.project.id
                  if (!acc[pid]) acc[pid] = { project: t.projectStore.project, stores: [] }
                  acc[pid].stores.push(t.projectStore.store)
                  return acc
                }, {}
              )
            )

            return (
              <div
                key={day}
                className={`rounded-lg min-h-[130px] p-2 flex flex-col gap-1 transition-colors
                  ${isToday
                    ? 'ring-2 ring-blue-500/60 bg-blue-900/30'
                    : isWeekend
                    ? 'bg-slate-800/30 hover:bg-slate-700/40'
                    : 'bg-slate-800/50 hover:bg-slate-700/50'}`}
              >
                {/* Date number — top left */}
                <span className={`text-sm font-bold leading-none mb-0.5
                  ${isToday ? 'text-blue-300' : isWeekend ? 'text-red-400' : 'text-gray-200'}`}>
                  {day}
                </span>

                {/* Project bars — full width stacked */}
                {projectGroups.slice(0, 10).map(({ project, stores }) => (
                  <div
                    key={project.id}
                    className="text-[10px] leading-tight px-1.5 py-[3px] rounded text-white font-semibold truncate cursor-default w-full"
                    style={{ backgroundColor: project.color ?? '#3b82f6' }}
                    title={`${project.name}\n${stores.map(s => `${s.storeCode} · ${s.name}`).join('\n')}`}
                  >
                    {project.name}
                  </div>
                ))}
                {projectGroups.length > 10 && (
                  <div className="text-[10px] text-slate-500 pl-0.5">+{projectGroups.length - 10} more</div>
                )}
              </div>
            )
          })}

          {/* Next month leading days */}
          {Array.from({ length: calDays.nextMonthCells }).map((_, i) => {
            const day = i + 1
            return (
              <div key={`next-${i}`} className="rounded-lg min-h-[130px] p-2 bg-slate-900/60">
                <span className="text-sm font-bold text-slate-700">{day}</span>
              </div>
            )
          })}

        </div>
        </div>{/* min-w */}
        </div>{/* overflow-x-auto */}

        {/* Legend */}
        {calTasks.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-600/50 flex flex-wrap gap-x-4 gap-y-1.5 bg-slate-800/30">
            {Array.from(new Map(calTasks.map(t => [t.projectStore.project.id, t.projectStore.project])).values()).map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: p.color ?? '#3b82f6' }} />
                <span className="text-sm text-gray-300 max-w-[160px] truncate">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Store visits ───────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-600/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" style={{ color: themeHighlight }} />
            <h2 className="text-white font-semibold">จำนวนครั้งเข้างานต่อสาขา</h2>
          </div>
          <p className="text-xs text-gray-400">
            นับจาก Check-in ของงานโปรเจกต์ + Incident ที่เลือก &quot;ทำงานให้โปรเจกต์&quot; (เช่น MA ร้านอื่นเพื่อเซ็ตเครื่องให้ร้านนี้)
          </p>
        </div>
        {storeVisits.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">ยังไม่มีสาขาในโปรเจกต์</p>
        ) : (
          <div className="divide-y divide-slate-700/40">
            <div className="hidden sm:grid grid-cols-[2fr_1.5fr_90px_90px_90px] gap-3 px-5 py-2 text-xs font-medium text-gray-400 bg-slate-800/50">
              <span>สาขา</span>
              <span>โปรเจกต์</span>
              <span className="text-right">งานโปรเจกต์</span>
              <span className="text-right">Incident</span>
              <span className="text-right">รวม</span>
            </div>
            {storeVisits.map((row: any) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1.5fr_90px_90px_90px] gap-x-3 gap-y-0.5 px-5 py-2.5 text-sm items-center">
                <span className="text-white truncate">
                  {formatStore(row.store)}
                  {row.store.storeStatus === 'OPENING' && <span className="ml-2 text-[10px] text-sky-400">กำลังเปิดร้าน</span>}
                </span>
                <span className="text-gray-400 truncate hidden sm:flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.project.color ?? '#3b82f6' }} />
                  {row.project.name}
                </span>
                <span className="text-right text-gray-300 tabular-nums hidden sm:block">{row.visits.tasks}</span>
                <span className="text-right text-gray-300 tabular-nums hidden sm:block">{row.visits.incidents}</span>
                <span className="text-right font-semibold text-white tabular-nums">
                  {row.visits.total}<span className="sm:hidden text-xs font-normal text-gray-500"> ครั้ง</span>
                </span>
                <span className="sm:hidden col-span-2 text-xs text-gray-500 truncate">
                  {row.project.name} · งานโปรเจกต์ {row.visits.tasks} · Incident {row.visits.incidents}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
