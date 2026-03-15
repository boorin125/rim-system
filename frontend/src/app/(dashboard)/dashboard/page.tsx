// app/(dashboard)/dashboard/page.tsx - Operational Dashboard
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  Bell,
  ChevronRight,
  RefreshCw,
  Activity,
  FileText,
  User,
  ShieldAlert,
  ClipboardList,
  ClipboardCheck,
  CheckSquare,
  X,
  Briefcase,
  XCircle,
} from 'lucide-react'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface Incident {
  id: string
  ticketNumber: string
  title: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  slaDeadline?: string
  store?: { id: number; name: string; storeCode: string }
  assignee?: { id: number; firstName: string; lastName: string }
  category?: string
  jobType?: string
}

interface Notification {
  id: number
  type: string
  title: string
  message: string
  incidentId?: string
  link?: string
  isRead: boolean
  createdAt: string
}

interface StatusCounts {
  total: number
  byStatus: {
    open: number
    assigned: number
    inProgress: number
    pending: number
    resolved: number
    closed: number
    cancelled: number
  }
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const PRIORITY_BAR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-slate-500',
}

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-300',
  HIGH: 'bg-orange-500/20 text-orange-300',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300',
  LOW: 'bg-slate-500/20 text-slate-400',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-slate-500/20 text-slate-300',
  ASSIGNED: 'bg-purple-500/20 text-purple-300',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300',
  RESOLVED: 'bg-blue-500/20 text-blue-300',
  CLOSED: 'bg-green-500/20 text-green-300',
  CANCELLED: 'bg-red-500/20 text-red-300',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'เปิด',
  ASSIGNED: 'รับงาน',
  IN_PROGRESS: 'กำลังทำ',
  RESOLVED: 'แก้แล้ว',
  CLOSED: 'ปิดแล้ว',
  CANCELLED: 'ยกเลิก',
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  IT_MANAGER: 'IT Manager',
  SUPERVISOR: 'Supervisor',
  HELP_DESK: 'Help Desk',
  TECHNICIAN: 'Technician',
  END_USER: 'End User',
  READ_ONLY: 'Read Only',
}

const NOTIF_EMOJI: Record<string, string> = {
  SLA_BREACH: '🚨',
  SLA_WARNING: '⚠️',
  INCIDENT_ASSIGNED: '📋',
  INCIDENT_RESOLVED: '✅',
  INCIDENT_CANCELLED: '❌',
  INCIDENT_REOPENED: '🔄',
  INCIDENT_CREATED: '📝',
  INCIDENT_CONFIRMED: '🔒',
  SYSTEM_ALERT: '🔔',
  NEW_USER_REGISTERED: '👤',
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เมื่อกี้'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

function isSlaBreached(inc: Incident): boolean {
  return !!inc.slaDeadline && new Date(inc.slaDeadline) < new Date()
}

function isSlaWarning(inc: Incident): boolean {
  if (!inc.slaDeadline) return false
  const remaining = new Date(inc.slaDeadline).getTime() - Date.now()
  return remaining > 0 && remaining < 2 * 3600 * 1000
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'สวัสดีตอนเช้า'
  if (h >= 12 && h < 17) return 'สวัสดีตอนบ่าย'
  if (h >= 17 && h < 21) return 'สวัสดีตอนเย็น'
  return 'สวัสดีตอนดึก'
}

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-slate-700/40 rounded-lg animate-pulse ${className}`} />
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showPendingModal, setShowPendingModal] = useState(false)

  // ── Derived role flags ──
  const isTech = userRoles.includes('TECHNICIAN')
  const isSupervisor = userRoles.includes('SUPERVISOR')
  const canCreate = userRoles.some(r => ['HELP_DESK', 'IT_MANAGER', 'SUPERVISOR', 'SUPER_ADMIN', 'END_USER'].includes(r))

  // Show "งานที่รับผิดชอบ" only for pure technicians (not supervisors/IT managers)
  const showMyJobs = isTech && !isSupervisor

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    const h = { Authorization: `Bearer ${token}` }

    setIsLoading(true)
    try {
      const [statsRes, incRes, notifsRes, unreadRes] = await Promise.allSettled([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents/analytics/stats`, { headers: h }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents?limit=60`, { headers: h }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/notifications?limit=12`, { headers: h }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/notifications/unread-count`, { headers: h }),
      ])

      if (statsRes.status === 'fulfilled') setStatusCounts(statsRes.value.data)
      if (incRes.status === 'fulfilled') {
        const d = incRes.value.data
        const list: Incident[] = d?.data ?? (Array.isArray(d) ? d : [])
        setIncidents(list)
      }
      if (notifsRes.status === 'fulfilled') setNotifications(notifsRes.value.data ?? [])
      if (unreadRes.status === 'fulfilled') setUnreadCount(unreadRes.value.data?.count ?? 0)
    } finally {
      setIsLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const u = JSON.parse(userStr)
      setCurrentUser(u)
      setUserRoles(u.roles || (u.role ? [u.role] : []))
    }
    fetchData()
  }, [fetchData])

  // ── Show pending tasks modal once per session for Technicians ──
  useEffect(() => {
    if (isLoading || !currentUser || !userRoles.includes('TECHNICIAN') || incidents.length === 0) return

    const sessionKey = `pendingAlertShown_${currentUser.id}`
    if (sessionStorage.getItem(sessionKey)) return

    const userId = Number(currentUser.id)
    const hasPending = incidents.some(i => {
      const assigneeId = Number(i.assignee?.id)
      return assigneeId === userId && ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].includes(i.status)
    })

    if (hasPending) {
      setShowPendingModal(true)
      sessionStorage.setItem(sessionKey, 'true')
    }
  }, [isLoading, currentUser, incidents, userRoles])

  // ── Derived data ──
  const activeIncidents = incidents.filter(i => !['CLOSED', 'CANCELLED'].includes(i.status))

  const userId = currentUser ? Number(currentUser.id) : null

  const needsAttention = showMyJobs
    ? activeIncidents
        .filter(i => ['ASSIGNED', 'IN_PROGRESS'].includes(i.status) && Number(i.assignee?.id) === userId)
        .slice(0, 10)
    : activeIncidents
        .filter(i =>
          i.priority === 'CRITICAL' ||
          i.status === 'OPEN' ||
          isSlaBreached(i) ||
          isSlaWarning(i),
        )
        .sort((a, b) => {
          // SLA breached first
          const ab = isSlaBreached(a) ? 0 : isSlaWarning(a) ? 1 : 2
          const bb = isSlaBreached(b) ? 0 : isSlaWarning(b) ? 1 : 2
          if (ab !== bb) return ab - bb
          // Then by priority
          return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
        })
        .slice(0, 10)

  const pendingConfirm = incidents.filter(i => i.status === 'RESOLVED').slice(0, 8)
  const recentIncidents = incidents.slice(0, 12)

  // ── Status card definitions ──
  const statusCards = [
    {
      label: 'เปิดใหม่',
      count: statusCounts?.byStatus?.open ?? 0,
      icon: FileText,
      color: 'from-slate-500/20 to-slate-600/10',
      border: 'border-slate-500/30',
      textCls: 'text-slate-200',
      iconCls: 'text-slate-400',
      status: 'OPEN',
    },
    {
      label: 'รับงานแล้ว',
      count: statusCounts?.byStatus?.assigned ?? 0,
      icon: User,
      color: 'from-purple-500/20 to-purple-600/10',
      border: 'border-purple-500/30',
      textCls: 'text-purple-200',
      iconCls: 'text-purple-400',
      status: 'ASSIGNED',
    },
    {
      label: 'กำลังดำเนินการ',
      count: statusCounts?.byStatus?.inProgress ?? 0,
      icon: Activity,
      color: 'from-amber-500/20 to-amber-600/10',
      border: 'border-amber-500/30',
      textCls: 'text-amber-200',
      iconCls: 'text-amber-400',
      status: 'IN_PROGRESS',
    },
    {
      label: 'แก้ไขแล้ว (รอยืนยัน)',
      count: statusCounts?.byStatus?.resolved ?? 0,
      icon: CheckCircle,
      color: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/30',
      textCls: 'text-blue-200',
      iconCls: 'text-blue-400',
      status: 'RESOLVED',
    },
    {
      label: 'ปิดงานแล้ว',
      count: statusCounts?.byStatus?.closed ?? 0,
      icon: CheckSquare,
      color: 'from-green-500/20 to-green-600/10',
      border: 'border-green-500/30',
      textCls: 'text-green-200',
      iconCls: 'text-green-400',
      status: 'CLOSED',
    },
    {
      label: 'งานยกเลิก',
      count: statusCounts?.byStatus?.cancelled ?? 0,
      icon: XCircle,
      color: 'from-red-500/20 to-red-600/10',
      border: 'border-red-500/30',
      textCls: 'text-red-200',
      iconCls: 'text-red-400',
      status: 'CANCELLED',
    },
  ]

  const displayName = currentUser?.firstName || currentUser?.name || ''
  const roleName = ROLE_LABELS[userRoles[0] ?? ''] ?? userRoles[0] ?? ''
  const dateStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <>
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()},{' '}
              <span style={{ color: themeHighlight }}>{displayName}</span>
            </h1>
            {roleName && (
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-700 text-gray-300 rounded-full border border-slate-600">
                {roleName}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{dateStr}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-xs">รีเฟรช</span>
          </button>
          {canCreate && (
            <Link
              href="/dashboard/incidents/create"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-4 h-4" />
              สร้าง Incident
            </Link>
          )}
        </div>
      </div>

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.status}
              href={`/dashboard/incidents?status=${card.status}`}
              className={`glass-card p-4 rounded-2xl border ${card.border} bg-gradient-to-br ${card.color} hover:scale-[1.02] active:scale-[0.99] transition-all group`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${card.iconCls}`} />
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <div className={`text-3xl font-bold ${card.textCls} tabular-nums mb-1`}>
                  {card.count.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-gray-400 leading-snug">{card.label}</p>
            </Link>
          )
        })}
      </div>

      {/* ── Row 1: Needs Attention + Notifications ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Needs Attention (left, 2/3) */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-[18px] h-[18px]" style={{ color: 'var(--theme-highlight)' }} />
              <span className="font-semibold text-base text-white">
                {showMyJobs ? 'งานที่รับผิดชอบ' : 'Requires Attention'}
              </span>
              {!isLoading && needsAttention.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-300 rounded-full leading-none">
                  {needsAttention.length}
                </span>
              )}
            </div>
            <Link
              href="/dashboard/incidents"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition"
            >
              ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2.5">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : needsAttention.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-500 flex-1">
              <CheckCircle className="w-9 h-9 mb-2 text-green-500/30" />
              <p className="text-sm">ไม่มีงานที่ต้องดูแลเร่งด่วน</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30 overflow-y-auto max-h-[360px]">
              {needsAttention.map((inc) => {
                const breached = isSlaBreached(inc)
                const warning = isSlaWarning(inc)
                return (
                  <Link
                    key={inc.id}
                    href={`/dashboard/incidents/${inc.id}`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-700/30 transition group"
                  >
                    {/* Priority bar */}
                    <div className={`mt-0.5 shrink-0 w-1 h-11 rounded-full ${PRIORITY_BAR[inc.priority] ?? 'bg-slate-600'}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-mono text-blue-400 font-semibold">{inc.ticketNumber}</span>
                        {breached && (
                          <span className="flex items-center gap-0.5 text-xs text-red-400 font-medium">
                            <AlertTriangle className="w-3 h-3" /> SLA เกิน
                          </span>
                        )}
                        {warning && !breached && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-400">
                            <Clock className="w-3 h-3" /> ใกล้ SLA
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white font-medium truncate group-hover:text-blue-300 transition">
                        {inc.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {inc.store && (
                          <span className="text-xs text-gray-500">
                            {formatStore(inc.store)}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_BADGE[inc.priority] ?? ''}`}>
                          {inc.priority}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[inc.status] ?? ''}`}>
                          {STATUS_LABELS[inc.status] ?? inc.status}
                        </span>
                        {inc.assignee && (
                          <span className="text-xs text-blue-400/80 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {inc.assignee.firstName} {inc.assignee.lastName}
                          </span>
                        )}
                        {!inc.assignee && (
                          <span className="text-xs text-gray-600 italic">ยังไม่มีช่าง</span>
                        )}
                        <span className="text-xs text-gray-600">{timeAgo(inc.updatedAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 mt-2 transition" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending Confirm Close (right, 1/3) — moved from Row 2 */}
        <div className="lg:col-span-1 glass-card rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-[18px] h-[18px]" style={{ color: 'var(--theme-highlight)' }} />
              <span className="font-semibold text-base text-white">รอยืนยันปิดงาน</span>
              {!isLoading && pendingConfirm.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full leading-none">
                  {pendingConfirm.length}
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2.5 flex-1">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : pendingConfirm.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-12 text-gray-500">
              <CheckCircle className="w-8 h-8 mb-2 text-green-500/20" />
              <p className="text-sm">ไม่มีงานรอยืนยัน</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30 flex-1 overflow-y-auto max-h-[360px]">
              {pendingConfirm.map((inc) => (
                <Link
                  key={inc.id}
                  href={`/dashboard/incidents/${inc.id}`}
                  className="block px-4 py-3.5 hover:bg-slate-700/30 transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-blue-400">{inc.ticketNumber}</span>
                    <span className="text-xs text-gray-600">{timeAgo(inc.updatedAt)}</span>
                  </div>
                  <p className="text-sm text-white truncate group-hover:text-blue-300 transition">{inc.title}</p>
                  {inc.store && (
                    <p className="text-xs text-gray-500 mt-0.5">{formatStore(inc.store)}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Recent Incidents + Pending Confirm ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Incidents (left, 2/3) */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-[18px] h-[18px]" style={{ color: 'var(--theme-highlight)' }} />
              <span className="font-semibold text-base text-white">Incident ล่าสุด</span>
            </div>
            <Link
              href="/dashboard/incidents"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition"
            >
              ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2.5">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : recentIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-500">
              <FileText className="w-9 h-9 mb-2 opacity-20" />
              <p className="text-sm">ยังไม่มี Incident</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {recentIncidents.map((inc) => (
                <Link
                  key={inc.id}
                  href={`/dashboard/incidents/${inc.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-700/30 transition group"
                >
                  <div className={`w-1 h-7 rounded-full shrink-0 ${PRIORITY_BAR[inc.priority] ?? 'bg-slate-600'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-blue-400 font-semibold shrink-0">{inc.ticketNumber}</span>
                      <p className="text-sm text-white truncate group-hover:text-blue-300 transition">{inc.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {inc.store && (
                        <span className="text-xs text-gray-500 truncate">{formatStore(inc.store)}</span>
                      )}
                      <span className="text-xs text-gray-600">· {timeAgo(inc.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[inc.status] ?? ''}`}>
                      {STATUS_LABELS[inc.status] ?? inc.status}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications (right, 1/3) — moved from Row 1 */}
        <div className="lg:col-span-1 glass-card rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-[18px] h-[18px]" style={{ color: 'var(--theme-highlight)' }} />
              <span className="font-semibold text-base text-white">การแจ้งเตือน</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2.5 flex-1">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-12 text-gray-500">
              <Bell className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">ไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30 overflow-y-auto max-h-[360px]">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    if (notif.link) router.push(notif.link)
                    else if (notif.incidentId) router.push(`/dashboard/incidents/${notif.incidentId}`)
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-700/30 transition ${!notif.isRead ? 'bg-blue-500/5' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5 leading-none">
                      {NOTIF_EMOJI[notif.type] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!notif.isRead ? 'text-white' : 'text-gray-300'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-xs text-gray-600 text-right">
        อัพเดทล่าสุด {lastRefresh.toLocaleTimeString('th-TH')}
      </p>

    </div>

    {/* ── Pending Tasks Modal (Technician login alert) ── */}

    {(() => {
      if (!showPendingModal || !isTech || !currentUser) return null
      const userId = Number(currentUser.id)
      const pendingItems = incidents.filter(i => {
        const assigneeId = Number(i.assignee?.id)
        return assigneeId === userId && ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].includes(i.status)
      })
      if (pendingItems.length === 0) return null

      const assigned = pendingItems.filter(i => i.status === 'ASSIGNED')
      const inProgress = pendingItems.filter(i => i.status === 'IN_PROGRESS')
      const resolved = pendingItems.filter(i => i.status === 'RESOLVED')

      const closeFn = () => setShowPendingModal(false)

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-sm">งานค้างรอดำเนินการ</h2>
                  <p className="text-xs text-gray-400">คุณมีงานที่ต้องดำเนินการ {pendingItems.length} รายการ</p>
                </div>
              </div>
              <button
                onClick={closeFn}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-5 py-3 space-y-4">
              {/* ASSIGNED */}
              {assigned.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-purple-400 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                    รับงานแล้ว — รอ Check-in ({assigned.length})
                  </p>
                  <div className="space-y-1">
                    {assigned.map(inc => (
                      <Link
                        key={inc.id}
                        href={`/dashboard/incidents/${inc.id}`}
                        onClick={closeFn}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 transition group"
                      >
                        <div className="w-1 h-8 rounded-full bg-purple-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-400">{inc.ticketNumber}</p>
                          <p className="text-sm text-white truncate group-hover:text-purple-300 transition">{inc.title}</p>
                          {inc.store && <p className="text-xs text-gray-500">{formatStore(inc.store)}</p>}
                        </div>
                        {isSlaBreached(inc) && <span className="text-xs text-red-300 flex-shrink-0">🚨 SLA</span>}
                        {isSlaWarning(inc) && !isSlaBreached(inc) && <span className="text-xs text-amber-300 flex-shrink-0">⏰ ใกล้</span>}
                        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* IN_PROGRESS */}
              {inProgress.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    กำลังดำเนินการ ({inProgress.length})
                  </p>
                  <div className="space-y-1">
                    {inProgress.map(inc => (
                      <Link
                        key={inc.id}
                        href={`/dashboard/incidents/${inc.id}`}
                        onClick={closeFn}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 transition group"
                      >
                        <div className="w-1 h-8 rounded-full bg-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-400">{inc.ticketNumber}</p>
                          <p className="text-sm text-white truncate group-hover:text-amber-300 transition">{inc.title}</p>
                          {inc.store && <p className="text-xs text-gray-500">{formatStore(inc.store)}</p>}
                        </div>
                        {isSlaBreached(inc) && <span className="text-xs text-red-300 flex-shrink-0">🚨 SLA</span>}
                        {isSlaWarning(inc) && !isSlaBreached(inc) && <span className="text-xs text-amber-300 flex-shrink-0">⏰ ใกล้</span>}
                        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* RESOLVED — pending tech confirm */}
              {resolved.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    รอยืนยันปิดงาน ({resolved.length})
                  </p>
                  <div className="space-y-1">
                    {resolved.map(inc => (
                      <Link
                        key={inc.id}
                        href={`/dashboard/incidents/${inc.id}`}
                        onClick={closeFn}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 transition group"
                      >
                        <div className="w-1 h-8 rounded-full bg-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-400">{inc.ticketNumber}</p>
                          <p className="text-sm text-white truncate group-hover:text-blue-300 transition">{inc.title}</p>
                          {inc.store && <p className="text-xs text-gray-500">{formatStore(inc.store)}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-3 border-t border-slate-700/60">
              <Link
                href="/dashboard/incidents"
                onClick={closeFn}
                className="flex-1 text-center py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition"
              >
                ดูงานทั้งหมด
              </Link>
              <button
                onClick={closeFn}
                className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-200 transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )
    })()}
    </>
  )
}
