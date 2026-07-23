// app/(dashboard)/dashboard/incidents/page.tsx - Incident Management (Server-side pagination)
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Briefcase,
  ShieldCheck,
  Download,
  X,
  ChevronDown,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { isViewOnly, canPerformAction, getUserRoles, isPureTechnician } from '@/config/permissions'
import { formatDateTime } from '@/utils/dateUtils'

interface SearchableSelectProps {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}

function SearchableSelect({ value, onChange, options, placeholder }: SearchableSelectProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const selected = value !== 'ALL' ? value : null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setIsOpen(o => !o); setSearch('') }}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
      >
        <span className={selected ? 'text-white' : 'text-gray-400 text-sm'}>{selected || placeholder}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {selected && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange('ALL'); setIsOpen(false) }}
              className="p-0.5 hover:bg-slate-600 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange('ALL'); setIsOpen(false); setSearch('') }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${value === 'ALL' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}
            >
              {placeholder}
            </button>
            {filtered.map(opt => (
              <button
                type="button"
                key={opt}
                onClick={() => { onChange(opt); setIsOpen(false); setSearch('') }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${value === opt ? 'text-blue-400 font-medium' : 'text-gray-300'}`}
              >
                {opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const FILTER_KEY = 'incidents_filters'

function readFilter(key: string, def: any) {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return def
    const val = JSON.parse(raw)[key]
    return val !== undefined ? val : def
  } catch { return def }
}

export default function IncidentsPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState<string>(() => readFilter('searchTerm', ''))
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() => readFilter('searchTerm', ''))
  const [filterStatus, setFilterStatus] = useState<string>(() => readFilter('filterStatus', 'ALL'))
  const [filterCategory, setFilterCategory] = useState<string>(() => readFilter('filterCategory', 'ALL'))
  const [currentPage, setCurrentPage] = useState<number>(() => readFilter('currentPage', 1))
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [incidentToDelete, setIncidentToDelete] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sortField, setSortField] = useState<string>(() => readFilter('sortField', 'createdAt'))
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => readFilter('sortOrder', 'desc'))
  const [slaConfigs, setSlaConfigs] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filterProvince, setFilterProvince] = useState<string>(() => readFilter('filterProvince', 'ALL'))
  const [provinces, setProvinces] = useState<string[]>([])
  const [filterTechnicianId, setFilterTechnicianId] = useState<string>(() => readFilter('filterTechnicianId', 'ALL'))
  const [technicians, setTechnicians] = useState<{ id: number; name: string }[]>([])
  const isSuperAdmin = useRef(false)
  const isPureTech = useRef(false)
  const currentUserId = useRef<number | null>(null)

  const itemsPerPage = 50

  // Persist filters to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({
        searchTerm, filterStatus, filterCategory, filterProvince,
        filterTechnicianId, sortField, sortOrder, currentPage,
      }))
    } catch {}
  }, [searchTerm, filterStatus, filterCategory, filterProvince, filterTechnicianId, sortField, sortOrder, currentPage])

  // Theme highlight color
  const [sortActiveBg, setSortActiveBg] = useState('#3b82f6')
  useEffect(() => {
    const readTheme = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (val) setSortActiveBg(val)
    }
    readTheme()
    const observer = new MutationObserver(() => readTheme())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  // Debounce search term: 800ms delay, min 2 chars (or empty to clear)
  useEffect(() => {
    if (searchTerm.length === 1) return // ไม่ค้นหาถ้าพิมพ์ตัวเดียว
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 800)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const commitSearch = () => {
    setDebouncedSearch(searchTerm)
    setCurrentPage(1)
  }

  // Reset page when filters change (not search — handled by debounce above)
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterCategory, filterProvince, filterTechnicianId, sortField, sortOrder])

  // Mount: restore cache + kick off all fetches in parallel
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      isSuperAdmin.current = getUserRoles(user).includes('SUPER_ADMIN')
      isPureTech.current = isPureTechnician(user)
      currentUserId.current = user.id ? Number(user.id) : null
    }
    // Show cached incidents immediately (stale-while-revalidate)
    // Cache key is user-specific to prevent technician seeing another user's cache
    const cacheKey = `incidents_cache_${currentUserId.current ?? 'anon'}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const { data, total: t, totalPages: tp } = JSON.parse(cached)
        setIncidents(data)
        setTotal(t)
        setTotalPages(tp)
        setIsLoading(false)
      }
    } catch {}
    // Start all background fetches in parallel — no render-cycle gap
    if (!isSuperAdmin.current) fetchIncidents()
    fetchSlaConfigs()
    fetchCategories()
    fetchProvinces()
    if (!isPureTech.current) fetchTechnicians()
  }, [])

  // Auto-poll every 30s (silent — no spinner) for real-time monitor display
  const silentPollRef = useRef<() => void>(() => {})
  useEffect(() => { silentPollRef.current = () => { if (!isSuperAdmin.current) fetchIncidents(true) } })
  useEffect(() => {
    const timer = setInterval(() => silentPollRef.current(), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Re-fetch when filters/pagination change (skip initial mount — handled above)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (isSuperAdmin.current) { setIsLoading(false); return }
    fetchIncidents()
  }, [currentPage, debouncedSearch, filterStatus, filterCategory, filterProvince, filterTechnicianId, sortField, sortOrder])

  const buildParams = (overrides?: Record<string, any>) => {
    const params: Record<string, any> = {
      page: currentPage,
      limit: itemsPerPage,
      sortField,
      sortOrder,
    }

    // Pure technician: always scope to their own assignments (enforce on frontend too)
    if (isPureTech.current && currentUserId.current) {
      params.assigneeId = currentUserId.current
    }

    if (debouncedSearch) params.search = debouncedSearch

    // Status filter (basic dropdown)
    if (filterStatus === 'PENDING') {
      // handled server-side as "not CLOSED/CANCELLED" — pass special value
      params.statusGroup = 'PENDING'
    } else if (filterStatus !== 'ALL') {
      params.status = filterStatus
    }

    if (filterCategory !== 'ALL') params.category = filterCategory
    if (filterProvince !== 'ALL') params.province = filterProvince

    // Technician filter: only available to non-pure-technician users
    if (!isPureTech.current && filterTechnicianId !== 'ALL') {
      params.assigneeId = filterTechnicianId
    }

    return { ...params, ...overrides }
  }

  const fetchIncidents = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const token = localStorage.getItem('token')
      const params = buildParams()

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents`,
        { headers: { Authorization: `Bearer ${token}` }, params }
      )

      const data = response.data
      if (data && Array.isArray(data.data)) {
        setIncidents(data.data)
        setTotal(data.total ?? data.data.length)
        setTotalPages(data.totalPages ?? 1)
        // Cache only page 1 with default filters (user-specific key)
        if (currentPage === 1) {
          try {
            const cacheKey = `incidents_cache_${currentUserId.current ?? 'anon'}`
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: data.data,
              total: data.total ?? data.data.length,
              totalPages: data.totalPages ?? 1,
            }))
          } catch {}
        }
      } else if (Array.isArray(data)) {
        // Fallback: old response format (plain array)
        setIncidents(data)
        setTotal(data.length)
        setTotalPages(1)
      } else {
        setIncidents([])
        setTotal(0)
        setTotalPages(1)
      }
    } catch (error: any) {
      toast.error('Failed to load incidents')
      console.error(error)
      setIncidents([])
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const fetchSlaConfigs = async () => {
    try {
      const cached = sessionStorage.getItem('sla_configs_cache')
      if (cached) setSlaConfigs(JSON.parse(cached))
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sla`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSlaConfigs(response.data)
      try { sessionStorage.setItem('sla_configs_cache', JSON.stringify(response.data)) } catch {}
    } catch {}
  }

  const fetchCategories = async () => {
    try {
      const cached = sessionStorage.getItem('categories_cache')
      if (cached) setCategories(JSON.parse(cached))
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (Array.isArray(res.data)) {
        const cats = res.data.filter((c: any) => c.isActive !== false).map((c: any) => c.name)
        setCategories(cats)
        try { sessionStorage.setItem('categories_cache', JSON.stringify(cats)) } catch {}
      }
    } catch {
      setCategories(['POS', 'Network', 'Hardware', 'Software', 'Printer', 'Monitor', 'Other'])
    }
  }

  const fetchProvinces = async () => {
    try {
      const cached = sessionStorage.getItem('provinces_cache')
      if (cached) setProvinces(JSON.parse(cached))
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/stores/provinces`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (Array.isArray(res.data)) {
        setProvinces(res.data)
        try { sessionStorage.setItem('provinces_cache', JSON.stringify(res.data)) } catch {}
      }
    } catch {}
  }

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users?role=TECHNICIAN&status=ACTIVE`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const list = (res.data || []).map((u: any) => ({
        id: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      }))
      setTechnicians(list)
    } catch {}
  }

  const getPriorityDisplayName = (priority: string): string => {
    const config = slaConfigs.find((c: any) => c.priority === priority)
    return config?.name || priority
  }

  const getSLAStatus = (incident: any): { label: string; color: string; defended?: boolean } => {
    if (!incident.slaDeadline) {
      return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    }

    const slaDeadline = new Date(incident.slaDeadline)
    const now = new Date()
    const hasApprovedDefense = incident.slaDefenses?.some((d: any) => d.status === 'APPROVED')

    if (incident.status === 'CLOSED' || incident.status === 'RESOLVED') {
      const completedAt = incident.resolvedAt
        ? new Date(incident.resolvedAt)
        : incident.closedAt
          ? new Date(incident.closedAt)
          : new Date(incident.updatedAt)

      if (completedAt <= slaDeadline) {
        return { label: 'Achieved', color: 'text-green-400 bg-green-500/20' }
      } else if (hasApprovedDefense) {
        return { label: 'Achieved', color: 'text-green-400 bg-green-500/20', defended: true }
      } else {
        return { label: 'Failed', color: 'text-red-400 bg-red-500/20' }
      }
    }

    if (incident.status === 'CANCELLED') {
      return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    }

    if (now > slaDeadline) {
      return { label: 'Breached', color: 'text-red-400 bg-red-500/20' }
    } else {
      return { label: 'On Track', color: 'text-yellow-400 bg-yellow-500/20' }
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const token = localStorage.getItem('token')
      const params = buildParams({ page: 1, limit: 10000 })

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents`,
        { headers: { Authorization: `Bearer ${token}` }, params }
      )

      const allData = response.data?.data || response.data || []
      if (!Array.isArray(allData) || allData.length === 0) {
        toast.error('No data to export')
        return
      }

      const exportData = allData.map((incident: any) => {
        const technician = incident.assignees?.length > 0
          ? incident.assignees.map((a: any) => `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim()).join(', ')
          : incident.assignee ? `${incident.assignee.firstName} ${incident.assignee.lastName}` : 'Unassigned'
        const resolution = incident.resolutionType === 'PHONE_SUPPORT' ? 'Phone'
          : incident.resolutionType === 'REMOTE_SUPPORT' ? 'Remote'
          : incident.resolutionType === 'ONSITE' ? 'Onsite'
          : incident.resolutionType || ''
        return {
          'Status': incident.status,
          'Incident Date': incident.incidentDate ? formatDateTime(incident.incidentDate) : formatDateTime(incident.createdAt),
          'Ticket Number': String(incident.ticketNumber || incident.id),
          'Store': formatStore(incident.store),
          'Province': incident.store?.province || '',
          'Title': incident.title || '',
          'Category': incident.category || '',
          'Priority': getPriorityDisplayName(incident.priority),
          'Technician': technician,
          'Resolution': resolution,
          'Resolve': incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '',
        }
      })

      const headers = Object.keys(exportData[0])

      // Build filename: Incident_[Status_][Category_][Province_]ddmmyyyy
      const statusLabels: Record<string, string> = { PENDING: 'Pending', OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'InProgress', CLOSED: 'Closed', CANCELLED: 'Cancelled' }
      const parts = ['Incident']
      if (filterStatus !== 'ALL') parts.push(statusLabels[filterStatus] || filterStatus)
      if (filterCategory !== 'ALL') parts.push(filterCategory.replace(/[\s/\\]/g, ''))
      if (filterProvince !== 'ALL') parts.push(filterProvince.replace(/[\s/\\]/g, '_'))
      const d = new Date()
      parts.push(`${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`)
      const filename = parts.join('_')

      if (format === 'csv') {
        const csvContent = [
          headers.map(h => `"${h}"`).join(','),
          ...exportData.map((row: any) =>
            headers.map(header => {
              const stringValue = row[header] != null ? String(row[header]) : ''
              return `"${stringValue.replace(/"/g, '""')}"`
            }).join(',')
          )
        ].join('\r\n')

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${filename}.csv`
        link.click()
        toast.success('CSV file downloaded')
      } else {
        const ws = XLSX.utils.json_to_sheet(exportData, { header: headers })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Incidents')
        XLSX.writeFile(wb, `${filename}.xlsx`)
        toast.success('Excel file downloaded')
      }
    } catch {
      toast.error('Failed to export')
    }
  }

  const handleDelete = async () => {
    if (!incidentToDelete) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentToDelete.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Incident deleted successfully')
      setDeleteModalOpen(false)
      setIncidentToDelete(null)
      fetchIncidents()
    } catch (error: any) {
      toast.error('Failed to delete incident')
    }
  }

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      PENDING: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30', icon: Clock },
      ASSIGNED: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30', icon: Clock },
      IN_PROGRESS: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: Clock },
      RESOLVED: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: CheckCircle2 },
      CLOSED: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30', icon: CheckCircle2 },
      CANCELLED: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30', icon: XCircle },
      OUTSOURCED: { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30', icon: Briefcase },
    }
    return badges[status] || { class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30', icon: Clock }
  }

  const getPriorityBadge = (priority: string) => {
    const badges: any = {
      CRITICAL: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30',
      HIGH: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30',
      MEDIUM: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      LOW: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30',
    }
    return badges[priority] || badges.MEDIUM
  }

  // Pagination display info
  const startIndex = (currentPage - 1) * itemsPerPage + 1
  const endIndex = Math.min(currentPage * itemsPerPage, total)

  if (isLoading && incidents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading incidents...</p>
        </div>
      </div>
    )
  }

  if (getUserRoles(currentUser).includes('SUPER_ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 rounded-2xl max-w-md text-center">
          <div className="p-4 bg-red-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">ไม่มีสิทธิ์ใช้งานฟีเจอร์นี้</h2>
          <p className="text-gray-400">Super Admin ไม่สามารถเข้าถึงระบบจัดการ Incidents ได้</p>
        </div>
      </div>
    )
  }

  const viewOnly = isViewOnly(currentUser, '/dashboard/incidents')
  const canCreate = canPerformAction(currentUser, '/dashboard/incidents', 'create')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Incident Management</h1>
          <p className="text-gray-400 mt-1">Manage and track all IT incidents</p>
        </div>
        <div className="flex items-center gap-3">
          {viewOnly && (
            <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium">
              View Only
            </span>
          )}
          {canCreate && !viewOnly && (
            <button
              onClick={() => router.push('/dashboard/incidents/create')}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition duration-200 hover:brightness-110"
              style={{ backgroundColor: sortActiveBg }}
            >
              <Plus className="w-5 h-5" />
              <span>Create Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 rounded-2xl sticky top-0 z-10">
        <div className="flex flex-col gap-4">
          {/* Search row + Export buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหา ticket, หัวข้อ, รายละเอียด... (กด Enter เพื่อค้นหาทันที)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitSearch() }}
                className="w-full pl-9 pr-16 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isLoading && debouncedSearch && (
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setDebouncedSearch(''); setCurrentPage(1) }}
                    className="p-0.5 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-600/40 text-teal-400 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>

          {/* Bottom Row - Quick Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending (ยกเว้น Closed/Cancelled)</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <SearchableSelect
              value={filterCategory}
              onChange={setFilterCategory}
              options={categories}
              placeholder="All Category"
            />

            <SearchableSelect
              value={filterProvince}
              onChange={setFilterProvince}
              options={provinces}
              placeholder="All Province"
            />

            {!isPureTech.current && technicians.length > 0 && (
              <SearchableSelect
                value={filterTechnicianId === 'ALL' ? 'ALL' : (technicians.find(t => String(t.id) === filterTechnicianId)?.name ?? 'ALL')}
                onChange={(v) => setFilterTechnicianId(v === 'ALL' ? 'ALL' : String(technicians.find(t => t.name === v)?.id ?? 'ALL'))}
                options={technicians.map(t => t.name)}
                placeholder="All Technician"
              />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-xs sm:text-sm text-gray-400">
            {total > 0
              ? `Showing ${startIndex}–${endIndex} of ${total} incidents`
              : 'No incidents found'}
            {isLoading && <span className="ml-2 text-gray-500">Loading...</span>}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            {(['createdAt', 'priority', 'status'] as const).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortField === field ? 'text-white' : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
                }`}
                style={sortField === field ? { backgroundColor: sortActiveBg } : undefined}
              >
                {field === 'createdAt' ? 'Date' : field.charAt(0).toUpperCase() + field.slice(1)}
                {sortField === field && <ArrowUpDown className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {incidents.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No incidents found</p>
            {canCreate && !viewOnly && (
              <button
                onClick={() => router.push('/dashboard/incidents/create')}
                className="mt-4 hover:brightness-125 transition duration-200"
                style={{ color: sortActiveBg }}
              >
                Create your first incident
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/80 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Status</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Incident Date</th>
                  <th className="text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Incident No.</th>
                  <th className="hidden sm:table-cell text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Store</th>
                  <th className="hidden lg:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Province</th>
                  <th className="text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Title</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Category</th>
                  <th className="hidden lg:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Job Type</th>
                  <th className="hidden sm:table-cell text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Priority</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">SLA Result</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Aging</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident, index) => {
                  const statusBadge = getStatusBadge(incident.status)

                  const calculateAging = () => {
                    if (incident.status === 'CLOSED' || incident.status === 'CANCELLED') return null
                    const diffMs = new Date().getTime() - new Date(incident.createdAt).getTime()
                    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000))
                    const days = Math.floor(totalMinutes / 1440)
                    const hours = Math.floor((totalMinutes % 1440) / 60)
                    const minutes = totalMinutes % 60
                    return { days, hours, minutes, totalDays: diffMs / 86400000 }
                  }

                  const aging = calculateAging()

                  return (
                    <tr
                      key={incident.id}
                      onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                      className={`border-b border-slate-700/30 cursor-pointer transition-all duration-200 ${
                        index % 2 === 0
                          ? 'bg-slate-800/30 hover:bg-slate-700/50'
                          : 'bg-slate-700/50 hover:bg-slate-600/60'
                      }`}
                    >
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <div className="flex flex-col gap-1">
                          <span className={statusBadge.class}>{incident.status}</span>
                          {(() => {
                            const tech = incident.assignees?.[0]?.user || incident.assignee;
                            const label = incident.resolutionType === 'PHONE_SUPPORT' ? 'Phone'
                              : incident.resolutionType === 'REMOTE_SUPPORT' ? 'Remote'
                              : (incident.resolutionType || tech) ? 'Onsite' : null;
                            const color = incident.resolutionType === 'PHONE_SUPPORT' ? 'text-emerald-400'
                              : incident.resolutionType === 'REMOTE_SUPPORT' ? 'text-blue-400'
                              : 'text-amber-400';
                            if (!label && !tech) return null;
                            return (
                              <span className={`text-[10px] whitespace-nowrap ${color}`}>
                                {label}
                                {tech && <span className="text-gray-400"> · {tech.firstName} {tech.lastName}</span>}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="hidden md:table-cell py-4 px-6">
                        <span className="text-sm text-gray-300 whitespace-nowrap">
                          {incident.incidentDate ? formatDateTime(incident.incidentDate) : formatDateTime(incident.createdAt)}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-xs md:text-sm font-mono text-blue-400 font-semibold whitespace-nowrap">
                          {incident.ticketNumber || `WAT-${String(incident.id).padStart(6, '0')}`}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-3 md:py-4 md:px-6">
                        <span className="text-sm text-white">{formatStore(incident.store)}</span>
                      </td>
                      <td className="hidden lg:table-cell py-4 px-6">
                        <span className="text-sm text-gray-300">{incident.store?.province || '-'}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <p className="text-sm font-medium text-white line-clamp-2 md:line-clamp-1 max-w-[160px] md:max-w-[240px] lg:max-w-none">
                          {incident.title}
                        </p>
                        <p className="hidden md:block text-xs text-gray-400 mt-1">
                          {incident.description?.substring(0, 40)}{incident.description?.length > 40 ? '...' : ''}
                        </p>
                      </td>
                      <td className="hidden md:table-cell py-4 px-6">
                        {incident.category
                          ? <span className="text-sm text-white font-medium">{incident.category}</span>
                          : <span className="text-sm text-gray-500">-</span>}
                      </td>
                      <td className="hidden lg:table-cell py-4 px-6">
                        {incident.jobType
                          ? <span className="text-sm text-white font-medium">{incident.jobType}</span>
                          : <span className="text-sm text-gray-500">-</span>}
                      </td>
                      <td className="hidden sm:table-cell py-3 px-3 md:py-4 md:px-6">
                        <span className={getPriorityBadge(incident.priority)}>
                          {getPriorityDisplayName(incident.priority)}
                        </span>
                      </td>
                      <td className="hidden md:table-cell py-4 px-6">
                        {(() => {
                          const slaStatus = getSLAStatus(incident)
                          if (slaStatus.defended) {
                            return (
                              <span title="SLA Achieved โดย Defense" className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${slaStatus.color}`}>
                                <ShieldCheck className="w-3 h-3 text-yellow-400" />
                                Achieved
                              </span>
                            )
                          }
                          return (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${slaStatus.color}`}>
                              {slaStatus.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="hidden md:table-cell py-4 px-6">
                        {!aging ? (
                          <span className="text-sm text-gray-500">-</span>
                        ) : (
                          <span className={`text-sm font-semibold tabular-nums ${
                            aging.totalDays > 7 ? 'text-red-400'
                            : aging.totalDays > 3 ? 'text-yellow-400'
                            : 'text-green-400'
                          }`}>
                            {aging.days} {aging.days === 1 ? 'Day' : 'Days'} {String(aging.hours).padStart(2, '0')}:{String(aging.minutes).padStart(2, '0')} Hrs.
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-t border-slate-700/50">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || isLoading}
              className="px-3 md:px-4 py-2 text-sm text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  if (totalPages <= 7) return true
                  if (page === 1 || page === totalPages) return true
                  return Math.abs(page - currentPage) <= 1
                })
                .reduce<(number | string)[]>((acc, page, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                    acc.push('...')
                  }
                  acc.push(page)
                  return acc
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`dots-${idx}`} className="px-1 text-gray-500 text-sm">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      className={`w-8 h-8 text-sm rounded-lg transition duration-200 ${
                        currentPage === item ? 'text-white' : 'text-gray-300 hover:bg-slate-700/50'
                      }`}
                      style={currentPage === item ? { backgroundColor: sortActiveBg } : undefined}
                    >
                      {item}
                    </button>
                  )
                )}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="px-3 md:px-4 py-2 text-sm text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span> →
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Incident</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete incident{' '}
              <span className="font-semibold">#{incidentToDelete?.id}</span>?
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => { setDeleteModalOpen(false); setIncidentToDelete(null) }}
                className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
