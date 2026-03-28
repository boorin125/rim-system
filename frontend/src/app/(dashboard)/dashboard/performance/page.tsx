// app/(dashboard)/dashboard/performance/page.tsx - Performance Dashboard
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useLicense } from '@/context/LicenseContext'
import LicenseLock from '@/components/LicenseLock'
import {
  BarChart3,
  Trophy,
  Star,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  RefreshCcw,
  ThumbsUp,
  RotateCcw,
  Gauge,
  Timer,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
  MessageSquare,
  ClipboardList,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldX,
  ArrowUpDown,
  Activity,
  Lightbulb,
  ChevronDown,
} from 'lucide-react'
import { getUserRoles, getAccessLevel } from '@/config/permissions'

function useThemeHighlight() {
  const [color, setColor] = useState('#3b82f6')
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (v) setColor(v)
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return color
}

// ==================== TYPES ====================

interface MetricData {
  value: number
  score: number
  weight: number
  target?: number
  standard?: number
  unit?: string
}

interface PerformanceData {
  technicianId: number
  technicianName: string | null
  period: string
  overallScore: number
  grade: string
  gradeDescription: string
  ranking: number | null
  totalTechnicians: number | null
  metrics: {
    slaCompliance: MetricData
    workVolume: MetricData & { target: number }
    resolutionTime: MetricData & { standard: number; unit: string }
    responseTime: MetricData & { standard: number; unit: string }
    firstTimeFix: MetricData
    reopenRate: MetricData
    customerSatisfaction: {
      rating: number | null
      totalRatings: number
      score: number | null
      weight: number
    }
  }
  bonusPoints: number
  comparison: {
    teamAvgScore: number
    topPerformerScore: number
  }
  calculatedAt: string
}

interface LeaderboardEntry {
  rank: number
  technicianId: number
  technicianName: string
  technicianType: string | null
  score: number
  grade: string
  gradeDescription: string
  workVolume: number
  slaPercent: number
}

interface TeamStats {
  period: string
  totalTechnicians: number
  avgScore: number
  gradeDistribution: Record<string, number>
  topScore: number
  lowestScore: number
}

interface IncidentStats {
  period: string
  total: number
  closed: number
  pending: number
  cancelled: number
  open: number
  slaPass: number
  slaFail: number
  slaPercent: number
}

interface SlaTrendEntry {
  period: string
  slaPercent: number
  total: number
  slaPass: number
  slaFail: number
}

interface HistoryEntry {
  period: string
  score: number
  grade: string
  ranking: number | null
  totalTechnicians: number | null
}

interface ComparisonData {
  type: string
  label: string
  current: { avgScore: number; count: number; [key: string]: any }
  lastYear: { avgScore: number; count: number; [key: string]: any }
  change: number
  changePercent: number
}

interface MyRating {
  id: number
  rating: number
  comment?: string
  qualityRating?: number
  professionalismRating?: number
  politenessRating?: number
  createdAt: string
  incident: {
    ticketNumber: string
    title: string
  }
}

// ==================== CONSTANTS ====================

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  'A': 'bg-green-500/20 text-green-400 border-green-500/50',
  'B+': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  'B': 'bg-sky-500/20 text-sky-400 border-sky-500/50',
  'C+': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  'C': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  'D': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  'F': 'bg-red-500/20 text-red-400 border-red-500/50',
}

const GRADE_BG: Record<string, string> = {
  'A+': 'from-emerald-600 to-emerald-700',
  'A': 'from-green-600 to-green-700',
  'B+': 'from-blue-600 to-blue-700',
  'B': 'from-sky-600 to-sky-700',
  'C+': 'from-yellow-600 to-yellow-700',
  'C': 'from-amber-600 to-amber-700',
  'D': 'from-orange-600 to-orange-700',
  'F': 'from-red-600 to-red-700',
}

// ==================== MAIN COMPONENT ====================

export default function PerformancePage() {
  const { isExpired, hasLicense, isTrialGrace, isTrialExpired, trialDaysRemaining } = useLicense()
  const themeHighlight = useThemeHighlight()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)

  // Period
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Job Type filter (persisted)
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['MA']
    try {
      const stored = localStorage.getItem('perf_job_types')
      return stored ? JSON.parse(stored) : ['MA']
    } catch { return ['MA'] }
  })
  const [availableJobTypes, setAvailableJobTypes] = useState<{ id: number; name: string; color: string }[]>([])

  // Data
  const [myPerformance, setMyPerformance] = useState<PerformanceData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [incidentStats, setIncidentStats] = useState<IncidentStats | null>(null)
  const [slaTrend, setSlaTrend] = useState<SlaTrendEntry[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [myRatings, setMyRatings] = useState<MyRating[]>([])
  const [ytd, setYtd] = useState<ComparisonData | null>(null)
  const [ytm, setYtm] = useState<ComparisonData | null>(null)
  const [yty, setYty] = useState<ComparisonData | null>(null)

  // Leaderboard sort
  const [sortBy, setSortBy] = useState<'score' | 'workVolume' | 'sla'>('score')

  // Detail modal
  const [selectedPerformance, setSelectedPerformance] = useState<PerformanceData | null>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setCurrentUser(JSON.parse(userStr))
  }, [])

  useEffect(() => {
    const fetchJobTypes = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/all`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setAvailableJobTypes((res.data || []).filter((jt: any) => jt.name !== 'Incident'))
      } catch { /* ignore */ }
    }
    fetchJobTypes()
  }, [])

  const toggleJobType = (name: string) => {
    setSelectedJobTypes(prev => {
      const next = prev.includes(name) ? prev.filter(j => j !== name) : [...prev, name]
      localStorage.setItem('perf_job_types', JSON.stringify(next))
      return next
    })
  }

  const [jtDropdownOpen, setJtDropdownOpen] = useState(false)
  const jtDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (jtDropdownRef.current && !jtDropdownRef.current.contains(e.target as Node)) {
        setJtDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userRoles = getUserRoles(currentUser)
  const higherRoles = ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR', 'HELP_DESK']
  const hasHigherRole = userRoles.some(r => higherRoles.includes(r))
  const isTechnician = userRoles.includes('TECHNICIAN') && !hasHigherRole
  const accessLevel = getAccessLevel(currentUser, '/dashboard/performance')
  const isManager = accessLevel === 'full'
  const isSelfOnly = accessLevel === 'self' && !hasHigherRole

  const loadData = useCallback(async () => {
    if (!currentUser) return
    setIsLoading(true)
    const token = localStorage.getItem('token')
    const cfg = { headers: { Authorization: `Bearer ${token}` } }
    const api = process.env.NEXT_PUBLIC_API_URL
    const jtParam = selectedJobTypes.length > 0 ? `&jobTypes=${selectedJobTypes.join(',')}` : ''

    try {
      // Technician: own data
      if (isTechnician || isSelfOnly) {
        const calls = [
          axios.get(`${api}/performance/my?period=${period}`, cfg).catch(() => null),
          axios.get(`${api}/performance/my/history?months=12`, cfg).catch(() => null),
          axios.get(`${api}/ratings/my?limit=10`, cfg).catch(() => null),
          axios.get(`${api}/performance/my/ytd`, cfg).catch(() => null),
          axios.get(`${api}/performance/my/ytm`, cfg).catch(() => null),
          axios.get(`${api}/performance/my/yty`, cfg).catch(() => null),
        ]
        const [perfRes, histRes, ratingsRes, ytdRes, ytmRes, ytyRes] = await Promise.all(calls)
        setMyPerformance(perfRes?.data || null)
        setHistory(histRes?.data || [])
        setMyRatings(ratingsRes?.data?.data || ratingsRes?.data || [])
        setYtd(ytdRes?.data || null)
        setYtm(ytmRes?.data || null)
        setYty(ytyRes?.data || null)
      }

      // Manager: team data
      if (isManager) {
        const calls = [
          axios.get(`${api}/performance/leaderboard?period=${period}&limit=50&sortBy=${sortBy}${jtParam}`, cfg).catch(() => null),
          axios.get(`${api}/performance/incident-stats?period=${period}${jtParam}`, cfg).catch(() => null),
          axios.get(`${api}/performance/sla-trend?months=12${jtParam}`, cfg).catch(() => null),
          axios.get(`${api}/performance/ytd`, cfg).catch(() => null),
          axios.get(`${api}/performance/ytm`, cfg).catch(() => null),
          axios.get(`${api}/performance/yty`, cfg).catch(() => null),
        ]
        const [lbRes, statsRes, trendRes, ytdRes, ytmRes, ytyRes] = await Promise.all(calls)
        setLeaderboard(lbRes?.data || [])
        setIncidentStats(statsRes?.data || null)
        setSlaTrend(trendRes?.data || [])
        setYtd(ytdRes?.data || null)
        setYtm(ytmRes?.data || null)
        setYty(ytyRes?.data || null)
      }
    } catch (err) {
      console.error('Error loading performance:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser, period, isTechnician, isSelfOnly, isManager, sortBy, selectedJobTypes])

  useEffect(() => {
    if (currentUser) loadData()
  }, [currentUser, loadData])

  // Calculate (Admin)
  const handleCalculate = async () => {
    setIsCalculating(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/performance/calculate?period=${period}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(res.data.message || 'คำนวณ Performance สำเร็จ')
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsCalculating(false)
    }
  }

  // View technician detail
  const viewDetail = async (techId: number) => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/performance/technicians/${techId}?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedPerformance(res.data)
    } catch { toast.error('ไม่สามารถโหลดข้อมูลได้') }
  }

  // Format helpers
  const fmtTime = (v: number, u?: string) => {
    if (!v) return '-'
    if (u === 'hours') return v < 1 ? `${Math.round(v * 60)} นาที` : `${v.toFixed(1)} ชม.`
    if (u === 'minutes') return v >= 60 ? `${(v / 60).toFixed(1)} ชม.` : `${Math.round(v)} นาที`
    return v.toFixed(1)
  }
  const fmtPct = (v: number | null) => v !== null && v !== undefined ? `${v.toFixed(1)}%` : '-'
  const scoreColor = (s: number) => s >= 90 ? 'text-emerald-400' : s >= 80 ? 'text-green-400' : s >= 70 ? 'text-yellow-400' : s >= 60 ? 'text-orange-400' : 'text-red-400'
  const barColor = (s: number) => s >= 90 ? 'bg-emerald-500' : s >= 80 ? 'bg-green-500' : s >= 70 ? 'bg-yellow-500' : s >= 60 ? 'bg-orange-500' : 'bg-red-500'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading performance data...</p>
        </div>
      </div>
    )
  }

  // ==================== RENDER ====================
  if (isExpired || !hasLicense) return (
    <LicenseLock
      featureName="Performance"
      reason={isTrialGrace ? 'grace' : isTrialExpired ? 'trial_expired' : isExpired ? 'expired' : 'no_license'}
      daysRemaining={isTrialGrace ? trialDaysRemaining : null}
    />
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance Dashboard</h1>
          <p className="text-gray-400 mt-1">ติดตามและประเมินผลการทำงาน</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Job Type Filter Dropdown */}
          {isManager && availableJobTypes.length > 0 && (
            <div className="relative" ref={jtDropdownRef}>
              <button
                onClick={() => setJtDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white hover:border-slate-500 transition-colors min-w-[160px]"
              >
                <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-left truncate">
                  {selectedJobTypes.length === 0
                    ? 'All Job Types'
                    : selectedJobTypes.length === availableJobTypes.length
                    ? 'All Job Types'
                    : selectedJobTypes.join(', ')}
                </span>
                {selectedJobTypes.length > 0 && selectedJobTypes.length < availableJobTypes.length && (
                  <span className="flex-shrink-0 text-xs bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                    {selectedJobTypes.length}
                  </span>
                )}
                <X className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${jtDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {jtDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">เลือก Job Type</span>
                    <button
                      onClick={() => {
                        const allNames = availableJobTypes.map(j => j.name)
                        const next = selectedJobTypes.length === availableJobTypes.length ? [] : allNames
                        setSelectedJobTypes(next)
                        localStorage.setItem('perf_job_types', JSON.stringify(next))
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {selectedJobTypes.length === availableJobTypes.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                  {availableJobTypes.map(jt => {
                    const active = selectedJobTypes.includes(jt.name)
                    return (
                      <button
                        key={jt.id}
                        onClick={() => toggleJobType(jt.name)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/50 transition-colors text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'border-transparent' : 'border-slate-500 bg-slate-700'}`}
                          style={active ? { backgroundColor: jt.color || themeHighlight } : {}}>
                          {active && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {jt.color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: jt.color }} />}
                          <span className="text-sm text-white truncate">{jt.name}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <input
            type="month"
            value={period}
            max={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` })()}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isManager && (
            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: themeHighlight }}
            >
              <RefreshCcw className={`w-5 h-5 ${isCalculating ? 'animate-spin' : ''}`} />
              <span>{isCalculating ? 'กำลังคำนวณ...' : 'คำนวณ Performance'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Previous Month / Current / 12-Month Avg Cards */}
      {(ytd || ytm || yty) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ytd && <ComparisonCard data={ytd} icon={Calendar} title="Previous Month" variant="previous" />}
          {ytm && <ComparisonCard data={ytm} icon={Activity} title="Current" variant="current" />}
          {yty && <ComparisonCard data={yty} icon={BarChart3} title="12-Month Avg" variant="yearly" />}
        </div>
      )}

      {/* ==================== TECHNICIAN VIEW ==================== */}
      {(isTechnician || isSelfOnly) && (
        <div className="space-y-6">
          {myPerformance ? (
            <PerformanceDetail data={myPerformance} fmtTime={fmtTime} fmtPct={fmtPct} barColor={barColor} />
          ) : (
            <EmptyState msg="ยังไม่มีข้อมูล Performance สำหรับเดือนนี้" sub="ระบบจะคำนวณเมื่อมีข้อมูล Incident ที่เสร็จสมบูรณ์" />
          )}

          {/* Performance History Chart */}
          {history.length > 0 && (
            <PerformanceHistoryChart data={history} themeColor={themeHighlight} />
          )}

          {/* My Ratings */}
          {myRatings.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Customer Ratings ล่าสุด
              </h3>
              <div className="space-y-3">
                {myRatings.map((r) => (
                  <div key={r.id} className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-4 h-4 ${s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {r.incident?.ticketNumber} - {r.incident?.title}
                      </p>
                      {r.comment && (
                        <p className="text-gray-400 text-xs mt-1 flex items-start gap-1">
                          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {r.comment}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {new Date(r.createdAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== MANAGER VIEW ==================== */}
      {isManager && (
        <div className="space-y-6">
          {/* Incident Stats Cards */}
          {incidentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <StatCard icon={ClipboardList} label="Total Incident" value={incidentStats.total} color="blue" />
              <StatCard icon={CheckCircle2} label="Closed" value={incidentStats.closed} color="green" />
              <StatCard icon={Clock} label="Pending" value={incidentStats.pending} color="yellow" />
              <StatCard icon={XCircle} label="Cancelled" value={incidentStats.cancelled} color="red" />
              <StatCard icon={ShieldCheck} label="Achieve SLA" value={incidentStats.slaPass} color="emerald" />
            </div>
          )}

          {/* SLA Achievement + SLA Trend side by side */}
          {(incidentStats || slaTrend.length > 0) && (
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left 30%: SLA Achievement Gauge */}
              {incidentStats && (
                <div className="lg:w-[30%]">
                  <SlaGaugeCard
                    percent={incidentStats.slaPercent}
                    pass={incidentStats.slaPass}
                    total={incidentStats.slaPass + incidentStats.slaFail}
                  />
                </div>
              )}
              {/* Right 70%: SLA Trend */}
              {slaTrend.length > 0 && (
                <div className="lg:w-[70%] glass-card p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    SLA % Trend (12 เดือน)
                  </h3>
                  <SlaLineChart data={slaTrend} />
                </div>
              )}
            </div>
          )}

          {/* Leaderboard */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Leaderboard - {period}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">เรียงตาม:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="score">คะแนน</option>
                  <option value="workVolume">ปริมาณงาน</option>
                  <option value="sla">SLA Achieve %</option>
                </select>
              </div>
            </div>
            {leaderboard.length === 0 ? (
              <EmptyState msg="ยังไม่มีข้อมูล Performance" sub="คลิก 'คำนวณ Performance' เพื่อคำนวณผลการปฏิบัติงาน" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-4 px-4 text-sm font-medium text-gray-400 w-16">อันดับ</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-gray-400">ชื่อช่าง</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-gray-400">
                        <button onClick={() => setSortBy('workVolume')} className={`flex items-center gap-1 mx-auto hover:text-white transition-colors ${sortBy === 'workVolume' ? 'text-blue-400' : ''}`}>
                          ปริมาณงาน
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-gray-400">
                        <button onClick={() => setSortBy('sla')} className={`flex items-center gap-1 mx-auto hover:text-white transition-colors ${sortBy === 'sla' ? 'text-blue-400' : ''}`}>
                          SLA Achieve %
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-gray-400">
                        <button onClick={() => setSortBy('score')} className={`flex items-center gap-1 mx-auto hover:text-white transition-colors ${sortBy === 'score' ? 'text-blue-400' : ''}`}>
                          คะแนน
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-gray-400">เกรด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((e) => (
                      <tr key={e.technicianId} onClick={() => viewDetail(e.technicianId)} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
                        <td className="py-4 px-4">
                          {e.rank <= 3 ? (
                            <div className="flex items-center gap-1">
                              <Trophy className={`w-5 h-5 ${e.rank === 1 ? 'text-yellow-400' : e.rank === 2 ? 'text-gray-400' : 'text-amber-600'}`} />
                              <span className="text-xs text-gray-500">{e.rank}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium pl-1">{e.rank}</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-white font-medium">{e.technicianName}</p>
                          {e.technicianType && <p className="text-xs text-gray-500">{e.technicianType}</p>}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-white font-semibold">{e.workVolume}</span>
                          <span className="text-gray-500 text-xs ml-1">งาน</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`font-semibold ${e.slaPercent >= 95 ? 'text-emerald-400' : e.slaPercent >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {e.slaPercent}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`text-lg font-semibold ${scoreColor(e.score)}`}>{e.score.toFixed(1)}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full border ${GRADE_COLORS[e.grade] || 'bg-gray-500/20 text-gray-400'}`}>
                            {e.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedPerformance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Performance: {selectedPerformance.technicianName}
              </h2>
              <button onClick={() => setSelectedPerformance(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <PerformanceDetail data={selectedPerformance} fmtTime={fmtTime} fmtPct={fmtPct} barColor={barColor} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== SLA LINE CHART (SVG) ====================

function PerformanceHistoryChart({ data, themeColor }: { data: HistoryEntry[]; themeColor: string }) {
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period))
  if (sorted.length < 1) return null

  const W = 900, H = 320
  const padL = 44, padR = 48, padT = 52, padB = 64
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const getX = (i: number) => padL + (sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW)
  const getY = (v: number) => padT + chartH - (v / 100) * chartH

  // Smooth cubic bezier path
  const buildPath = (pts: [number, number][]) => {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`
    let d = `M ${pts[0][0]},${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const tension = 0.35
      const cpx = (pts[i][0] - pts[i - 1][0]) * tension
      d += ` C ${pts[i - 1][0] + cpx},${pts[i - 1][1]} ${pts[i][0] - cpx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
    }
    return d
  }

  const pts: [number, number][] = sorted.map((e, i) => [getX(i), getY(e.score)])
  const linePath = buildPath(pts)
  const areaPath = sorted.length > 1
    ? `${linePath} L ${getX(sorted.length - 1)},${padT + chartH} L ${getX(0)},${padT + chartH} Z`
    : ''

  const gradeColor = (g: string) => ({
    'A+': '#10b981', 'A': '#22c55e', 'B+': '#3b82f6', 'B': '#0ea5e9',
    'C+': '#eab308', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
  }[g] ?? '#6b7280')

  const fmtMonth = (p: string) => {
    const [y, m] = p.split('-')
    return `${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[parseInt(m) - 1]} '${y.slice(2)}`
  }

  const thresholds = [
    { v: 90, label: 'A', color: '#10b981' },
    { v: 80, label: 'B', color: '#3b82f6' },
    { v: 70, label: 'C', color: '#f59e0b' },
  ]

  // Trend: compare first vs last
  const trend = sorted.length >= 2 ? sorted[sorted.length - 1].score - sorted[0].score : 0
  const trendUp = trend >= 0

  const gradId = `perfGrad-${Math.random().toString(36).slice(2)}`

  return (
    <div className="glass-card p-6 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/15">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Score History</h3>
            <p className="text-xs text-gray-400">คะแนนย้อนหลัง {sorted.length} เดือน</p>
          </div>
        </div>
        {sorted.length >= 2 && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${trendUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend).toFixed(1)} pts
          </div>
        )}
      </div>

      {/* Grade Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {[['A+/A', '#10b981'], ['B+/B', '#3b82f6'], ['C+/C', '#eab308'], ['D/F', '#ef4444']].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c as string }} />
            <span className="text-xs text-gray-400">{l}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-500">- - -</span>
          <span className="text-xs text-gray-400">Grade thresholds</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" style={{ maxHeight: '320px' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.3" />
              <stop offset="85%" stopColor={themeColor} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Y-axis grid + labels */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)}
                stroke="#1e293b" strokeWidth={v === 0 ? '1' : '1'} strokeDasharray={v === 0 ? '0' : '4,4'} />
              <text x={padL - 6} y={getY(v) + 4} textAnchor="end" fill="#475569" fontSize="11">{v}</text>
            </g>
          ))}

          {/* Grade threshold lines */}
          {thresholds.map(t => (
            <g key={t.label}>
              <line x1={padL} x2={W - padR} y1={getY(t.v)} y2={getY(t.v)}
                stroke={t.color} strokeWidth="1" strokeDasharray="5,4" opacity="0.45" />
              <text x={W - padR + 5} y={getY(t.v) + 4} fill={t.color} fontSize="10" fontWeight="600" opacity="0.8">{t.label}</text>
            </g>
          ))}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

          {/* Line */}
          <path d={linePath} fill="none" stroke={themeColor} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {sorted.map((e, i) => {
            const cx = getX(i)
            const cy = getY(e.score)
            const dc = gradeColor(e.grade)
            return (
              <g key={e.period}>
                {/* Score label */}
                <text x={cx} y={cy - 16} textAnchor="middle" fill="white" fontSize="12" fontWeight="700"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {e.score.toFixed(1)}
                </text>

                {/* Glow ring */}
                <circle cx={cx} cy={cy} r="11" fill={dc} opacity="0.18" />
                {/* Dot */}
                <circle cx={cx} cy={cy} r="7" fill={dc} stroke="#0f172a" strokeWidth="2.5" />
                <circle cx={cx} cy={cy} r="2.5" fill="white" opacity="0.9" />

                {/* Grade pill */}
                <rect x={cx - 13} y={cy + 13} width="26" height="15" rx="7.5"
                  fill={dc} opacity="0.25" />
                <text x={cx} y={cy + 24} textAnchor="middle" fill={dc} fontSize="10" fontWeight="700">{e.grade}</text>

                {/* Ranking */}
                {e.ranking && (
                  <text x={cx} y={cy + 40} textAnchor="middle" fill="#475569" fontSize="9">
                    #{e.ranking}
                  </text>
                )}

                {/* Month label */}
                <text x={cx} y={H - 8} textAnchor="middle" fill="#64748b" fontSize="11">
                  {fmtMonth(e.period)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function SlaLineChart({ data }: { data: SlaTrendEntry[] }) {
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

  const colW = 76
  const padL = 44, padR = 20, padT = 36, padB = 40
  const svgW = Math.max(colW * data.length + padL + padR, 600)
  const height = 300
  const chartW = svgW - padL - padR
  const chartH = height - padT - padB

  if (data.length === 0) return null

  const values = data.map(d => d.slaPercent)
  const minVal = Math.max(Math.floor(Math.min(...values) / 10) * 10 - 10, 0)
  const maxVal = 100

  const getX = (i: number) => padL + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)
  const getY = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal || 1)) * chartH

  const points = data.map((d, i) => `${getX(i)},${getY(d.slaPercent)}`)
  const linePath = `M ${points.join(' L ')}`
  const areaPath = `${linePath} L ${getX(data.length - 1)},${getY(minVal)} L ${getX(0)},${getY(minVal)} Z`

  const yTicks: number[] = []
  for (let v = minVal; v <= maxVal; v += 10) yTicks.push(v)

  const fmtPeriod = (p: string) => {
    const [y, m] = p.split('-')
    const months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return `${months[parseInt(m)] || m} '${y.slice(2)}`
  }

  const gridColor = isDark ? '#334155' : '#cbd5e1'
  const axisTextColor = isDark ? '#64748b' : '#475569'
  const dotStroke = isDark ? '#1e293b' : '#ffffff'
  const labelBg = isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)'

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: `${svgW}px` }}>
        <svg viewBox={`0 0 ${svgW} ${height}`} className="w-full" style={{ height: `${height}px` }}>
          <defs>
            <linearGradient id="slaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={padL} x2={svgW - padR} y1={getY(v)} y2={getY(v)}
                stroke={gridColor} strokeWidth="1" strokeDasharray="4,4" />
              <text x={padL - 8} y={getY(v) + 4} textAnchor="end" fill={axisTextColor} fontSize="11">{v}%</text>
            </g>
          ))}

          {/* Area + Line */}
          <path d={areaPath} fill="url(#slaGradient)" opacity="0.4" />
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Data points + labels */}
          {data.map((d, i) => {
            const cx = getX(i)
            const cy = getY(d.slaPercent)
            const label = `${d.slaPercent}%`
            const labelW = label.length * 8 + 12
            return (
              <g key={d.period}>
                {/* Label bg + text */}
                <rect x={cx - labelW / 2} y={cy - 30} width={labelW} height={18} rx="5"
                  fill={labelBg} />
                <text x={cx} y={cy - 17} textAnchor="middle" fill="#3b82f6"
                  fontSize="13" fontWeight="700">
                  {label}
                </text>
                {/* Dot */}
                <circle cx={cx} cy={cy} r="5.5" fill="#3b82f6" stroke={dotStroke} strokeWidth="2.5" />
                {/* X axis label */}
                <text x={cx} y={height - 6} textAnchor="middle" fill={axisTextColor} fontSize="11">
                  {fmtPeriod(d.period)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

// ── Gauge helpers ──────────────────────────────────────────

function gaugeColor(score: number): string {
  return score >= 90 ? '#10b981' : score >= 80 ? '#22c55e' : score >= 70 ? '#eab308' : score >= 60 ? '#f97316' : '#ef4444'
}

function GaugeArc({ percent, cx, cy, r, strokeWidth = 20, startAngle = -210, sweepAngle = 240, color }: {
  percent: number; cx: number; cy: number; r: number; strokeWidth?: number
  startAngle?: number; sweepAngle?: number; color: string
}) {
  const p = Math.min(Math.max(percent, 0), 100)
  const toRad = (d: number) => (d * Math.PI) / 180
  const pt = (deg: number) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) })
  const s = pt(startAngle), e = pt(startAngle + sweepAngle)
  const ve = pt(startAngle + (sweepAngle * p) / 100)
  const la = sweepAngle * p / 100 > 180 ? 1 : 0
  const tla = sweepAngle > 180 ? 1 : 0
  return (
    <g>
      <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${tla} 1 ${e.x} ${e.y}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />
      {p > 0 && (
        <path d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${la} 1 ${ve.x} ${ve.y}`}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      )}
    </g>
  )
}

// ── Mini gauge card (SLA / Cust Sat / First Fix / Reopen) ──

function MiniGaugeCard({ label, score, displayValue, weight, icon: Icon, target, subtitle, tips }: {
  label: string; score: number; displayValue: string; weight: number
  icon: React.ElementType; target?: string; subtitle?: string; tips?: string[]
}) {
  const [showTips, setShowTips] = useState(false)
  const color = gaugeColor(score)
  // W=180 H=148: end_y = 90+74*0.5+6.5=133 < 148 ✓  top=90-74=16 ✓
  const W = 180, H = 148, cx = 90, cy = 90, r = 74, sw = 13
  return (
    <div className="relative glass-card p-4 rounded-2xl flex flex-col items-center text-center"
      style={{ boxShadow: `0 2px 20px ${color}1A` }}>
      {/* Tips button — fixed to top-right corner of card */}
      {tips && tips.length > 0 && (
        <button
          onClick={() => setShowTips(v => !v)}
          className={`absolute top-2 right-2 p-1 rounded-md transition-colors ${showTips ? 'text-amber-300' : 'text-amber-500 hover:text-amber-300'}`}
          title="Tips เพิ่มคะแนน"
        >
          <Lightbulb className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Header row */}
      <div className="flex items-start gap-1.5 mb-1 justify-center min-h-[2.5rem]">
        <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
        <span className="text-xs font-medium text-gray-400 leading-tight">{label}</span>
      </div>

      {/* Gauge */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '120px' }}>
        <GaugeArc percent={score} cx={cx} cy={cy} r={r} strokeWidth={sw} color={color} />
        <text x={cx} y={cy - 12} textAnchor="middle" fill="white" fontSize="21" fontWeight="700">{displayValue}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={color} fontSize="12" fontWeight="600">{score.toFixed(0)} pts</text>
      </svg>
      <p className="text-xs text-gray-500 mt-0.5">W: {weight}%{target ? ` · ${target}` : ''}</p>
      {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}

      {/* Tips panel */}
      {showTips && tips && tips.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 w-full text-left">
          <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> วิธีเพิ่มคะแนน
          </p>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <span className="text-amber-400/70 flex-shrink-0 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Metric row (bar chart style for time/volume metrics) ───

function MetricRow({ icon: Icon, label, value, score, weight, target, color, barColor, tips }: {
  icon: React.ElementType; label: string; value: string; score: number; weight: number
  target?: string; color: string; barColor: (s: number) => string; tips?: string[]
}) {
  const [showTips, setShowTips] = useState(false)
  const iconCls: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/15', indigo: 'text-indigo-400 bg-indigo-500/15', purple: 'text-purple-400 bg-purple-500/15',
  }
  const sc = (s: number) => s >= 90 ? 'text-emerald-400' : s >= 80 ? 'text-green-400' : s >= 70 ? 'text-yellow-400' : s >= 60 ? 'text-orange-400' : 'text-red-400'
  return (
    <div className="p-3 bg-slate-800/40 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${iconCls[color] || 'text-gray-400 bg-gray-500/15'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-white">{label}</span>
            <div className="flex items-center gap-2 text-xs">
              {target && <span className="text-gray-500">Target: {target}</span>}
              <span className="text-gray-600">W: {weight}%</span>
              <span className={`font-semibold ${sc(score)}`}>{score.toFixed(0)}</span>
              {tips && tips.length > 0 && (
                <button
                  onClick={() => setShowTips(v => !v)}
                  className={`ml-1 p-0.5 rounded transition-colors ${showTips ? 'text-amber-300' : 'text-amber-500 hover:text-amber-300'}`}
                  title="Tips เพิ่มคะแนน"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor(score)}`} style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
            <span className="text-sm text-white font-medium flex-shrink-0 min-w-[90px] text-right">{value}</span>
          </div>
        </div>
      </div>
      {/* Tips panel */}
      {showTips && tips && tips.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 ml-11">
          <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> วิธีเพิ่มคะแนน
          </p>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <span className="text-amber-400/70 flex-shrink-0 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Main performance detail (technician view + manager modal) ──

function PerformanceDetail({ data, fmtTime, fmtPct, barColor }: {
  data: PerformanceData
  fmtTime: (v: number, u?: string) => string
  fmtPct: (v: number | null) => string
  barColor: (s: number) => string
}) {
  const mainColor = gaugeColor(data.overallScore)
  // Big gauge: W=320 H=268 cx=160 cy=178 r=142 sw=22
  // end_y = 178+142*0.5+11=260 < 268 ✓  top=178-142=36 ✓
  const gW = 320, gH = 268, gcx = 160, gcy = 178, gr = 142, gsw = 22
  const toRad = (d: number) => (d * Math.PI) / 180

  return (
    <div className="space-y-5">

      {/* ── HERO: Big Gauge + Grade Info ── */}
      <div className="glass-card p-6 rounded-2xl" style={{ boxShadow: `0 0 32px ${mainColor}18` }}>
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">

          {/* Big Score Gauge */}
          <div className="w-full md:w-72 flex-shrink-0">
            <svg viewBox={`0 0 ${gW} ${gH}`} className="w-full" style={{ maxHeight: '220px' }}>
              <GaugeArc percent={data.overallScore} cx={gcx} cy={gcy} r={gr} strokeWidth={gsw} color={mainColor} />
              {/* Grade-threshold tick marks */}
              {[60, 70, 80, 90].map(v => {
                const deg = -210 + (240 * v / 100)
                const cos = Math.cos(toRad(deg)), sin = Math.sin(toRad(deg))
                return (
                  <line key={v}
                    x1={gcx + (gr - gsw * 0.45) * cos} y1={gcy + (gr - gsw * 0.45) * sin}
                    x2={gcx + (gr + gsw * 0.45) * cos} y2={gcy + (gr + gsw * 0.45) * sin}
                    stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
                )
              })}
              {/* Score */}
              <text x={gcx} y={gcy - 22} textAnchor="middle" fill="white" fontSize="54" fontWeight="800" fontFamily="monospace">
                {data.overallScore.toFixed(1)}
              </text>
              <text x={gcx} y={gcy + 6} textAnchor="middle" fill="#64748b" fontSize="15">/ 100 pts</text>
              <text x={gcx} y={gcy + 36} textAnchor="middle" fill={mainColor} fontSize="26" fontWeight="900" letterSpacing="3">
                {data.grade}
              </text>
            </svg>
          </div>

          {/* Info Panel */}
          <div className="flex-1 w-full space-y-4 text-center md:text-left">
            {/* Grade badge + description */}
            <div className="flex flex-col sm:flex-row items-center md:items-start gap-4 justify-center md:justify-start">
              <div className={`flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${GRADE_BG[data.grade] || 'from-gray-600 to-gray-700'} shadow-lg flex-shrink-0`}>
                <span className="text-3xl font-bold text-white">{data.grade}</span>
              </div>
              <div>
                <p className="text-xl font-semibold text-white">{data.gradeDescription}</p>
                <p className="text-gray-400 text-sm mt-0.5">เดือน {data.period}</p>
                {data.ranking && data.totalTechnicians && (
                  <div className="flex items-center gap-1.5 mt-2 justify-center md:justify-start">
                    <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">
                      อันดับที่ <strong className="text-white text-base">{data.ranking}</strong>
                      <span className="text-gray-500"> / {data.totalTechnicians} คน</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Comparison */}
            {data.comparison && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-gray-300">{data.comparison.teamAvgScore?.toFixed(1)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Team Average</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                  <p className="text-2xl font-bold text-yellow-300">{data.comparison.topPerformerScore?.toFixed(1)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Top Score</p>
                </div>
              </div>
            )}

            {/* Bonus */}
            {data.bonusPoints > 0 && (
              <div className="flex items-center gap-2 p-3 bg-purple-500/15 border border-purple-500/20 rounded-xl justify-center md:justify-start">
                <Award className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <span className="text-purple-300 font-semibold">+{data.bonusPoints.toFixed(1)} Bonus Points</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MINI GAUGES: 4 key indicators ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniGaugeCard label="SLA Compliance"
          score={data.metrics.slaCompliance.score}
          displayValue={fmtPct(data.metrics.slaCompliance.value)}
          weight={data.metrics.slaCompliance.weight}
          icon={ShieldCheck} target={`${data.metrics.slaCompliance.target}%`}
          tips={[
            'รับงานและเริ่มดำเนินการทันทีหลังได้รับมอบหมาย',
            'จัดลำดับความสำคัญงาน Priority สูงก่อนเสมอ',
            'แจ้ง Supervisor ล่วงหน้าหากคาดว่างานจะล่าช้า',
            'ติดตามงานที่ใกล้ครบ SLA ก่อนจะเกินกำหนด',
          ]} />
        <MiniGaugeCard label="Customer Satisfaction"
          score={data.metrics.customerSatisfaction.score ?? 0}
          displayValue={data.metrics.customerSatisfaction.rating != null
            ? `${data.metrics.customerSatisfaction.rating.toFixed(1)}/5` : 'N/A'}
          weight={data.metrics.customerSatisfaction.weight}
          icon={Star} target="5.0"
          subtitle={`${data.metrics.customerSatisfaction.totalRatings} ratings`}
          tips={[
            'ทักทายและแนะนำตัวก่อนเริ่มงานทุกครั้ง',
            'อธิบายสิ่งที่กำลังทำและผลลัพธ์ที่คาดหวัง',
            'ถามลูกค้าว่าพอใจก่อนออกจากพื้นที่',
            'ทำความสะอาดและเก็บอุปกรณ์ให้เรียบร้อยหลังงาน',
          ]} />
        <MiniGaugeCard label="First Time Fix"
          score={data.metrics.firstTimeFix.score}
          displayValue={fmtPct(data.metrics.firstTimeFix.value)}
          weight={data.metrics.firstTimeFix.weight}
          icon={ThumbsUp} target={`${data.metrics.firstTimeFix.target}%`}
          tips={[
            'อ่าน History งานและ Root Cause ก่อนลงพื้นที่',
            'เตรียมอะไหล่และเครื่องมือให้ครบก่อนออกเดินทาง',
            'วินิจฉัยปัญหาให้ครบถ้วนก่อนเริ่มซ่อม',
            'ทดสอบระบบอย่างละเอียดก่อนปิดงานทุกครั้ง',
          ]} />
        <MiniGaugeCard label="Reopen Rate"
          score={data.metrics.reopenRate.score}
          displayValue={fmtPct(data.metrics.reopenRate.value)}
          weight={data.metrics.reopenRate.weight}
          icon={RotateCcw} target={`≤${data.metrics.reopenRate.target}%`}
          tips={[
            'ทดสอบซ้ำหลายรอบและแก้ Root Cause จริงก่อนปิดงาน',
            'บันทึก Resolution Notes ให้ครบถ้วนชัดเจน',
            'แนะนำการใช้งานที่ถูกต้องและวิธีป้องกันปัญหาซ้ำ',
            'Follow up ลูกค้า 1–2 วันหลังปิดงาน',
          ]} />
      </div>

      {/* ── TIME & VOLUME METRICS (bar rows) ── */}
      <div className="glass-card p-5 rounded-2xl">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" /> Time &amp; Volume Metrics
        </h3>
        <div className="space-y-3">
          <MetricRow icon={BarChart3} label="Work Volume"
            value={`${data.metrics.workVolume.value} งาน`}
            score={data.metrics.workVolume.score} weight={data.metrics.workVolume.weight}
            target={`${data.metrics.workVolume.target} งาน`} color="blue" barColor={barColor}
            tips={[
              'วางแผนเส้นทางให้มีประสิทธิภาพ จัดกลุ่มงานในพื้นที่ใกล้กัน',
              'แจ้งความพร้อมรับงานเพิ่มเมื่อปิดงานเร็วกว่ากำหนด',
              'บันทึกข้อมูลผ่าน App ทันทีเพื่อลดเวลา Admin',
              'ประสานงานกับลูกค้าล่วงหน้าเพื่อลดเวลารอหน้างาน',
            ]} />
          <MetricRow icon={Timer} label="Resolution Time"
            value={fmtTime(data.metrics.resolutionTime.value, data.metrics.resolutionTime.unit)}
            score={data.metrics.resolutionTime.score} weight={data.metrics.resolutionTime.weight}
            target={fmtTime(data.metrics.resolutionTime.standard, data.metrics.resolutionTime.unit)}
            color="indigo" barColor={barColor}
            tips={[
              'เตรียมอุปกรณ์ Diagnose และอะไหล่สำรองทั่วไปติดตัวตลอด',
              'ศึกษา Knowledge Base และคู่มือสินค้าล่วงหน้า',
              'ขอความช่วยเหลือจาก Senior Tech ทันทีเมื่อติดขัด',
              'หลีกเลี่ยงการเดินทางกลับมาขออะไหล่เพิ่ม',
            ]} />
          <MetricRow icon={Zap} label="Response Time"
            value={fmtTime(data.metrics.responseTime.value, data.metrics.responseTime.unit)}
            score={data.metrics.responseTime.score} weight={data.metrics.responseTime.weight}
            target={fmtTime(data.metrics.responseTime.standard, data.metrics.responseTime.unit)}
            color="purple" barColor={barColor}
            tips={[
              'ตอบรับงานภายใน 15 นาทีหลังได้รับแจ้งทุกครั้ง',
              'แจ้ง ETA ที่ชัดเจนให้ Helpdesk และลูกค้าทราบทันที',
              'เปิดการแจ้งเตือน App ตลอดเวลาทำการ',
              'แจ้งทันทีหากมีเหตุจำเป็นที่ทำให้ Response ช้า',
            ]} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, className }: {
  icon: React.ElementType; label: string; value: string | number; color: string; className?: string
}) {
  const cls: Record<string, string> = {
    green: 'text-green-400 bg-green-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/20',
    orange: 'text-orange-400 bg-orange-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
    red: 'text-red-400 bg-red-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
  }
  return (
    <div className={`glass-card p-4 rounded-xl h-full ${className || ''}`}>
      <div className="flex flex-col items-center justify-center text-center gap-2 h-full">
        <div className={`p-2.5 rounded-lg ${cls[color] || 'text-gray-400 bg-gray-500/20'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  )
}

function SlaGaugeCard({ percent, pass, total }: { percent: number; pass: number; total: number }) {
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

  const p = Math.min(Math.max(percent, 0), 100)
  const color = p >= 95 ? '#10b981' : p >= 80 ? '#f59e0b' : '#ef4444'
  const glowColor = p >= 95 ? 'rgba(16,185,129,0.25)' : p >= 80 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'
  const label = p >= 95 ? 'Excellent' : p >= 80 ? 'Good' : p >= 60 ? 'Fair' : 'Poor'

  // SVG arc — fill card width
  const size = 340
  const cx = 170; const cy = 165
  const r = 148
  const startAngle = -210
  const sweepAngle = 240
  const toRad = (d: number) => (d * Math.PI) / 180
  const arcPoint = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  })
  const start = arcPoint(startAngle)
  const end = arcPoint(startAngle + sweepAngle)
  const valueDeg = startAngle + (sweepAngle * p) / 100
  const valueEnd = arcPoint(valueDeg)
  const largeArc = sweepAngle * p / 100 > 180 ? 1 : 0
  const trackLargeArc = sweepAngle > 180 ? 1 : 0
  const svgH = Math.round(size * 0.80)

  return (
    <div className="glass-card p-6 rounded-2xl h-full flex flex-col" style={{ boxShadow: `0 0 24px ${glowColor}` }}>
      {/* Header — same style as SLA Trend */}
      <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
        <Gauge className="w-5 h-5 text-blue-400" />
        SLA Achievement
      </h3>

      {/* Gauge centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <svg width="100%" viewBox={`0 0 ${size} ${svgH}`} style={{ maxHeight: '300px' }}>
          {/* Track arc */}
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${trackLargeArc} 1 ${end.x} ${end.y}`}
            fill="none" stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.12)'} strokeWidth="34" strokeLinecap="round"
          />
          {/* Value arc */}
          {p > 0 && (
            <path
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${valueEnd.x} ${valueEnd.y}`}
              fill="none" stroke={color} strokeWidth="34" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
          )}
          {/* Center: big % number */}
          <text x={cx} y={cy - 2} textAnchor="middle" fill={isDark ? 'white' : '#0f172a'} fontSize="50" fontWeight="700" fontFamily="monospace">
            {p.toFixed(2)}%
          </text>
          {/* Status label */}
          <text x={cx} y={cy + 40} textAnchor="middle" fill={color} fontSize="24" fontWeight="900" letterSpacing="4">
            {label.toUpperCase()}
          </text>
        </svg>

        {/* Stats row — Pass left, Total right */}
        <div className="w-full flex justify-between items-center px-1 mt-1">
          <div className="text-left">
            <p className="text-3xl font-bold text-emerald-400">{pass}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Pass</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-400">{total}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComparisonCard({
  data,
  icon: Icon,
  title,
  variant = 'default',
}: {
  data: ComparisonData
  icon: React.ElementType
  title?: string
  variant?: 'previous' | 'current' | 'yearly' | 'default'
}) {
  const change = data?.change ?? 0
  const changePercent = data?.changePercent ?? 0
  const currentScore = data?.current?.avgScore ?? 0
  const lastScore = data?.lastYear?.avgScore ?? 0
  const isUp = change >= 0
  const displayTitle = title ?? data?.type ?? '-'

  // "เดือนก่อนหน้า" — simple, no arrow
  if (variant === 'previous') {
    return (
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">{displayTitle}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">{data?.label ?? '-'}</p>
        <p className="text-3xl font-bold text-white">{currentScore.toFixed(1)}</p>
        <p className="text-xs text-gray-500 mt-1">Score</p>
      </div>
    )
  }

  // "เดือนนี้" — prominent arrow vs previous month
  if (variant === 'current') {
    return (
      <div className="glass-card p-4 rounded-xl border border-blue-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-white">{displayTitle}</span>
          </div>
          <span className={`flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full ${isUp ? 'text-green-400 bg-green-500/15' : 'text-red-400 bg-red-500/15'}`}>
            {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {changePercent.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">{data?.label ?? '-'}</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-white">{currentScore.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">This Month</p>
          </div>
          <div className="text-right">
            <p className="text-lg text-gray-400">{lastScore.toFixed(1)}</p>
            <p className="text-xs text-gray-500">Prev Month</p>
          </div>
        </div>
      </div>
    )
  }

  // "เฉลี่ย 12 เดือนย้อนหลัง" — rolling average
  if (variant === 'yearly') {
    return (
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-gray-300">{displayTitle}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">{data?.label ?? '-'}</p>
        <p className="text-3xl font-bold text-white">{currentScore.toFixed(1)}</p>
        <p className="text-xs text-gray-500 mt-1">Avg Score</p>
      </div>
    )
  }

  // default (fallback)
  return (
    <div className="glass-card p-4 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">{displayTitle}</span>
        </div>
        <span className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {changePercent.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{data?.label ?? '-'}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-white">{currentScore.toFixed(1)}</p>
          <p className="text-xs text-gray-500">Current</p>
        </div>
        <div className="text-right">
          <p className="text-lg text-gray-400">{lastScore.toFixed(1)}</p>
          <p className="text-xs text-gray-500">Previous</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ msg, sub }: { msg: string; sub?: string }) {
  return (
    <div className="glass-card p-8 rounded-2xl text-center">
      <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <p className="text-gray-400">{msg}</p>
      {sub && <p className="text-sm text-gray-500 mt-2">{sub}</p>}
    </div>
  )
}
