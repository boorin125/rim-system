// app/(dashboard)/dashboard/incidents/page.tsx - Incident Management (Server-side pagination)
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import AdvancedIncidentFilter from '@/components/AdvancedIncidentFilter'
import { isViewOnly, canPerformAction, getUserRoles } from '@/config/permissions'
import { formatDateTime } from '@/utils/dateUtils'

export default function IncidentsPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [incidentToDelete, setIncidentToDelete] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [advancedFilters, setAdvancedFilters] = useState<any>({
    status: [],
    priority: [],
    category: [],
    dateRange: { from: '', to: '' },
    assignee: '',
    store: '',
  })
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [slaConfigs, setSlaConfigs] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [userReady, setUserReady] = useState(false)
  const isSuperAdmin = useRef(false)

  const itemsPerPage = 50

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

  // Debounce search term (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset page when filters change (not search — handled by debounce above)
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterCategory, sortField, sortOrder, advancedFilters])

  // Fetch user on mount — restore cache immediately so page feels instant
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      isSuperAdmin.current = getUserRoles(user).includes('SUPER_ADMIN')
    }
    // Restore cached incidents so the list appears immediately (stale-while-revalidate)
    try {
      const cached = sessionStorage.getItem('incidents_cache')
      if (cached) {
        const { data, total: t, totalPages: tp } = JSON.parse(cached)
        setIncidents(data)
        setTotal(t)
        setTotalPages(tp)
        setIsLoading(false)
      }
    } catch {}
    fetchSlaConfigs()
    fetchCategories()
    setUserReady(true)
  }, [])

  // Main fetch effect — runs when page, filters, or sort changes
  useEffect(() => {
    if (!userReady) return
    if (isSuperAdmin.current) {
      setIsLoading(false)
      return
    }
    fetchIncidents()
  }, [userReady, currentPage, debouncedSearch, filterStatus, filterCategory, sortField, sortOrder, advancedFilters])

  const buildParams = (overrides?: Record<string, any>) => {
    const params: Record<string, any> = {
      page: currentPage,
      limit: itemsPerPage,
      sortField,
      sortOrder,
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

    // Advanced filters
    if (advancedFilters.status.length > 0) params.status = advancedFilters.status.join(',')
    if (advancedFilters.priority.length > 0) params.priority = advancedFilters.priority.join(',')
    if (advancedFilters.category.length > 0) params.category = advancedFilters.category.join(',')
    if (advancedFilters.dateRange.from) params.dateFrom = advancedFilters.dateRange.from
    if (advancedFilters.dateRange.to) params.dateTo = advancedFilters.dateRange.to

    return { ...params, ...overrides }
  }

  const fetchIncidents = async () => {
    try {
      setIsLoading(true)
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
        // Cache only page 1 with default filters (most common "back" scenario)
        if (currentPage === 1) {
          try {
            sessionStorage.setItem('incidents_cache', JSON.stringify({
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
      setIsLoading(false)
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

      const exportData = allData.map((incident: any) => ({
        'Ticket Number': incident.ticketNumber || incident.id,
        'Title': incident.title,
        'Description': incident.description,
        'Status': incident.status,
        'Priority': getPriorityDisplayName(incident.priority),
        'Category': incident.category,
        'Store': formatStore(incident.store),
        'Province': incident.store?.province || '',
        'Assignee': incident.assignees?.length > 0
          ? incident.assignees.map((a: any) => `${a.user?.firstName || ''} ${a.user?.lastName || ''}`).join(', ')
          : incident.assignee ? `${incident.assignee.firstName} ${incident.assignee.lastName}` : 'Unassigned',
        'Created At': formatDateTime(incident.createdAt),
        'Updated At': formatDateTime(incident.updatedAt),
        'SLA Deadline': incident.slaDeadline ? formatDateTime(incident.slaDeadline) : 'N/A',
      }))

      const headers = Object.keys(exportData[0])

      if (format === 'csv') {
        const csvContent = [
          headers.map(h => `"${h}"`).join(','),
          ...exportData.map((row: any) =>
            headers.map(header => {
              const value = row[header as keyof typeof row]
              const stringValue = value != null ? String(value) : ''
              return `"${stringValue.replace(/"/g, '""')}"`
            }).join(',')
          )
        ].join('\n')

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `incidents_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        toast.success('CSV file downloaded')
      } else {
        const csvContent = [
          headers.join('\t'),
          ...exportData.map((row: any) =>
            headers.map(header => {
              const value = row[header as keyof typeof row]
              const stringValue = value != null ? String(value) : ''
              return stringValue.replace(/\t/g, ' ').replace(/\n/g, ' ')
            }).join('\t')
          )
        ].join('\n')

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `incidents_${new Date().toISOString().split('T')[0]}.xls`
        link.click()
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
          {/* Top Row - Search and Advanced Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ticket number, title, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <AdvancedIncidentFilter
              onFilterChange={(filters) => {
                setAdvancedFilters(filters)
              }}
              onExport={handleExport}
            />
          </div>

          {/* Bottom Row - Quick Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-400">
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
                  <th className="text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Incident No.</th>
                  <th className="hidden sm:table-cell text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Store</th>
                  <th className="hidden lg:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Province</th>
                  <th className="text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Title</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Category</th>
                  <th className="hidden lg:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Job Type</th>
                  <th className="hidden sm:table-cell text-left py-3 px-3 md:px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Priority</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">SLA Result</th>
                  <th className="hidden md:table-cell text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Aging (Days)</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident, index) => {
                  const statusBadge = getStatusBadge(incident.status)

                  const calculateAging = () => {
                    if (incident.status === 'CLOSED' || incident.status === 'CANCELLED') return '-'
                    const diffMs = Math.abs(new Date().getTime() - new Date(incident.createdAt).getTime())
                    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
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
                          {incident.resolutionType && (
                            <span className={`text-[10px] ${
                              incident.resolutionType === 'PHONE_SUPPORT' ? 'text-emerald-400'
                              : incident.resolutionType === 'REMOTE_SUPPORT' ? 'text-blue-400'
                              : 'text-amber-400'
                            }`}>
                              {incident.resolutionType === 'PHONE_SUPPORT' ? 'Phone'
                                : incident.resolutionType === 'REMOTE_SUPPORT' ? 'Remote'
                                : 'Onsite'}
                            </span>
                          )}
                        </div>
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
                        {aging === '-' ? (
                          <span className="text-sm text-gray-500">-</span>
                        ) : (
                          <span className={`text-sm font-semibold ${
                            (aging as number) > 7 ? 'text-red-400'
                            : (aging as number) > 3 ? 'text-yellow-400'
                            : 'text-green-400'
                          }`}>
                            {aging} {aging === 1 ? 'day' : 'days'}
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
