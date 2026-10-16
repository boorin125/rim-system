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

      {/* Project List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.5fr] gap-3 pr-4 py-2.5 border-b border-slate-700/60 text-xs font-medium text-gray-400 uppercase tracking-wide bg-slate-800/80">
          <span className="pl-5">ชื่อโปรเจ็ค</span>
          <span className="pl-2">สถานะ</span>
          <span>ความคืบหน้า (%)</span>
          <span>จำนวนสาขา</span>
          <span>วันที่เริ่มโปรเจ็ค</span>
          <span>วันที่จบโปรเจ็ค</span>
          <span>Project Manager</span>
        </div>

        {isLoading ? (
          <div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.5fr] gap-3 pr-4 py-3.5 border-b border-slate-700/30 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-3/4" />
                <div className="h-4 bg-slate-700 rounded w-16" />
                <div className="h-4 bg-slate-700 rounded w-12" />
                <div className="h-4 bg-slate-700 rounded w-8" />
                <div className="h-4 bg-slate-700 rounded w-16" />
                <div className="h-4 bg-slate-700 rounded w-16" />
                <div className="h-4 bg-slate-700 rounded w-20" />
                <div className="h-4 bg-slate-700 rounded w-4" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
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
          <div>
            {projects.map((p, idx) => {
              const StatusIcon = STATUS_ICONS[p.status] || Briefcase
              const { label, color } = STATUS_LABELS[p.status] || { label: p.status, color: 'text-gray-400 bg-gray-800/60' }
              return (
                <div
                  key={p.id}
                  className={`relative group ${idx % 2 === 1 ? 'bg-slate-800/30' : ''} ${idx < projects.length - 1 ? 'border-b border-slate-700/30' : ''}`}
                >
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="block sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.5fr] gap-3 pr-10 py-3 sm:items-center hover:bg-slate-700/30 transition-colors cursor-pointer relative overflow-hidden"
                >
                  {/* Color bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                    style={{ backgroundColor: p.color ?? '#3b82f6' }}
                  />

                  {/* Name */}
                  <div className="min-w-0 pl-4">
                    <p className="text-white text-sm font-medium truncate group-hover:text-blue-300 transition-colors">
                      {p.name}
                    </p>
                    {p.description && (
                      <p className="text-gray-500 text-xs truncate mt-0.5">{p.description}</p>
                    )}

                    {/* Phone card: status, progress, stores, dates */}
                    <div className="sm:hidden mt-2 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {label}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Building2 className="w-3.5 h-3.5" />
                          {p._count?.projectStores ?? 0} สาขา
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex-1">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${p.progressPercent ?? 0}%`, backgroundColor: p.color ?? '#3b82f6' }}
                          />
                        </div>
                        <span className="text-xs font-medium text-white w-9 text-right">{p.progressPercent ?? 0}%</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {p.startDate ? formatDate(p.startDate) : '-'} → {p.endDate ? formatDate(p.endDate) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <span className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit ${color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {label}
                  </span>

                  {/* Progress */}
                  <div className="hidden sm:block min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium text-white">{p.progressPercent ?? 0}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden w-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${p.progressPercent ?? 0}%`,
                          backgroundColor: p.color ?? '#3b82f6',
                        }}
                      />
                    </div>
                  </div>

                  {/* Stores */}
                  <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                    <Building2 className="w-3.5 h-3.5" />
                    {p._count?.projectStores ?? 0}
                  </span>

                  {/* Start date */}
                  <span className="hidden sm:inline text-xs text-gray-400">
                    {p.startDate ? formatDate(p.startDate) : '-'}
                  </span>

                  {/* End date */}
                  <span className="hidden sm:inline text-xs text-gray-400">
                    {p.endDate ? formatDate(p.endDate) : '-'}
                  </span>

                  {/* Project Manager */}
                  {(() => {
                    const mgr = p.projectManager ?? p.createdBy
                    return (
                      <div className="hidden sm:flex items-center gap-1.5 min-w-0">
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
                        <span className="text-xs text-gray-400 truncate">
                          {mgr ? `${mgr.firstName} ${mgr.lastName}` : '-'}
                        </span>
                      </div>
                    )
                  })()}

                </Link>

                {/* 3-dot edit button */}
                {canCreate && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/dashboard/projects/${p.id}/edit`) }}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-slate-700/60 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
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
      </div>

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
