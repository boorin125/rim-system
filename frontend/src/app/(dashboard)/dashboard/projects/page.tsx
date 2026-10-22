'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  PauseCircle,
  XCircle,
  FileEdit,
  MoreVertical,
  BarChart2,
  Bell,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { getPhotoUrl } from '@/utils/photoUtils'
import { canPerformAction } from '@/config/permissions'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Draft',     color: 'text-gray-400 bg-gray-800/60' },
  ACTIVE:    { label: 'Active',    color: 'text-green-400 bg-green-900/40' },
  PAUSED:    { label: 'Paused',    color: 'text-yellow-400 bg-yellow-900/40' },
  COMPLETED: { label: 'Completed', color: 'text-blue-400 bg-blue-900/40' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400 bg-red-900/40' },
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  DRAFT:     FileEdit,
  ACTIVE:    CheckCircle2,
  PAUSED:    PauseCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
}

// Same rule as the "วันนี้" / "พรุ่งนี้" badges on the project detail page
function countTaskDates(dates: string[] = []) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(today.getDate() + 2)
  let dueSoon = 0
  let overdue = 0
  for (const s of dates) {
    const d = new Date(s); d.setHours(0, 0, 0, 0)
    if (d < today) overdue++
    else if (d < dayAfterTomorrow) dueSoon++
  }
  return { dueSoon, overdue }
}

export default function ProjectsPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()

  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const LIMIT = 20

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setCurrentUser(JSON.parse(userStr))
  }, [])

  const fetchProjects = useCallback(async () => {
    setIsLoading(true)
    const token = localStorage.getItem('token')
    try {
      const params: any = { page, limit: LIMIT }
      if (filterStatus !== 'ALL') params.status = filterStatus
      if (search.trim()) params.search = search.trim()

      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
      setProjects(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('โหลดข้อมูล Project ไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }, [page, filterStatus, search])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const canCreate = currentUser && canPerformAction(currentUser, '/dashboard/projects', 'create')

  const formatDate = (d?: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6" style={{ color: themeHighlight }} />
            Projects
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            บริหารจัดการโปรเจกต์ทั้งหมด ({total} รายการ)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/projects/overview"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
          </Link>
          {canCreate && (
            <Link
              href="/dashboard/projects/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-4 h-4" />
              สร้าง Project ใหม่
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ Project..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">ทุกสถานะ</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Project Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-4 animate-pulse">
              <div className="h-5 bg-slate-700 rounded w-2/3" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
              <div className="h-2 bg-slate-700 rounded w-full" />
              <div className="h-3 bg-slate-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">ยังไม่มี Project</p>
          {canCreate && (
            <Link
              href="/dashboard/projects/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-4 h-4" />
              สร้าง Project แรก
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const StatusIcon = STATUS_ICONS[p.status] || Briefcase
            const { label, color } = STATUS_LABELS[p.status] || { label: p.status, color: 'text-gray-400 bg-gray-800/60' }
            const { dueSoon, overdue } = countTaskDates(p.openTaskDates)
            const mgr = p.projectManager ?? p.createdBy
            const barColor = p.color ?? '#3b82f6'
            return (
              <div key={p.id} className="relative group">
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="glass-card rounded-xl overflow-hidden flex flex-col h-full hover:border-slate-500 hover:bg-slate-700/30 transition-colors"
                >
                  {/* Color bar */}
                  <div className="h-1 w-full" style={{ backgroundColor: barColor }} />

                  <div className="p-5 flex flex-col gap-4 flex-1">
                    {/* Name + status */}
                    <div className="pr-8">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white text-base font-semibold truncate group-hover:text-blue-300 transition-colors">
                          {p.name}
                        </h3>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {label}
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-gray-500 text-xs truncate mt-1">{p.description}</p>
                      )}
                    </div>

                    {/* Notifications */}
                    {(dueSoon > 0 || overdue > 0) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {dueSoon > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            title="Task ที่ยังไม่เสร็จ นัดวันนี้หรือพรุ่งนี้"
                          >
                            <Bell className="w-3 h-3" /> ใกล้ถึงเวลา {dueSoon} งาน
                          </span>
                        )}
                        {overdue > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30"
                            title="Task ที่ยังไม่เสร็จ และเลยวันนัดแล้ว"
                          >
                            <AlertTriangle className="w-3 h-3" /> เลยกำหนด {overdue} งาน
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">ความคืบหน้า</span>
                        <span className="text-xs font-medium text-white">{p.progressPercent ?? 0}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${p.progressPercent ?? 0}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>

                    {/* Stores + dates */}
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {p._count?.projectStores ?? 0} สาขา
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {formatDate(p.startDate)} → {formatDate(p.endDate)}
                      </span>
                    </div>

                    {/* Project Manager */}
                    <div className="flex items-center gap-1.5 min-w-0 pt-3 mt-auto border-t border-slate-700/50">
                      {mgr?.avatarPath ? (
                        <img
                          src={getPhotoUrl(mgr.avatarPath)}
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                          alt=""
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[9px] text-gray-300 shrink-0">
                          {mgr?.firstName?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <span className="text-xs text-gray-500 shrink-0">PM:</span>
                      <span className="text-xs text-gray-300 truncate">
                        {mgr ? `${mgr.firstName} ${mgr.lastName}` : '-'}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 3-dot edit button */}
                {canCreate && (
                  <div className="absolute right-3 top-4">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/dashboard/projects/${p.id}/edit`) }}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-slate-700/60 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                      title="แก้ไข Project"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-gray-300 disabled:opacity-40 hover:bg-slate-600/50 transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-gray-400">หน้า {page} / {Math.ceil(total / LIMIT)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / LIMIT)}
            className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-gray-300 disabled:opacity-40 hover:bg-slate-600/50 transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
