// app/(dashboard)/dashboard/incidents/page.tsx - Incident Management
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState } from 'react'
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
import { isViewOnly, canPerformAction } from '@/config/permissions'
import { formatDateTime } from '@/utils/dateUtils'

export default function IncidentsPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<any[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
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

  // Theme highlight color for active sort buttons (reads CSS variable set by layout)
  const [sortActiveBg, setSortActiveBg] = useState('#3b82f6')
  useEffect(() => {
    const readTheme = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (val) setSortActiveBg(val)
    }
    // Read initial value (may already be set by layout)
    readTheme()
    // Also listen for theme updates (layout sets CSS vars async after API fetch)
    const observer = new MutationObserver(() => readTheme())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  const itemsPerPage = 10

  // Categories list (fetched from API)
  const [categories, setCategories] = useState<string[]>([])

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (Array.isArray(res.data)) {
        setCategories(res.data.filter((c: any) => c.isActive !== false).map((c: any) => c.name))
      }
    } catch {
      // Fallback
      setCategories(['POS', 'Network', 'Hardware', 'Software', 'Printer', 'Monitor', 'Other'])
    }
  }

  useEffect(() => {
    // Get current user from localStorage
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      
      // Check if SUPER_ADMIN
      if (user.role === 'SUPER_ADMIN') {
        setIsLoading(false)
        return
      }
    }
    
    fetchIncidents()
    fetchSlaConfigs()
    fetchCategories()
  }, [])

  useEffect(() => {
    filterIncidents()
  }, [incidents, searchTerm, filterStatus, filterCategory, advancedFilters, sortField, sortOrder])

  const fetchIncidents = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      // Handle both array and object responses
      const data = response.data
      if (Array.isArray(data)) {
        setIncidents(data)
      } else if (data && Array.isArray(data.incidents)) {
        setIncidents(data.incidents)
      } else if (data && Array.isArray(data.data)) {
        setIncidents(data.data)
      } else {
        console.error('Unexpected response format:', data)
        setIncidents([])
        toast.error('Unexpected data format from server')
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
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sla`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setSlaConfigs(response.data)
    } catch (error) {
      console.error('Failed to fetch SLA configs:', error)
    }
  }

  // Get priority display name from SLA config
  const getPriorityDisplayName = (priority: string): string => {
    const config = slaConfigs.find((c: any) => c.priority === priority)
    return config?.name || priority
  }

  // Calculate SLA status for an incident
  const getSLAStatus = (incident: any): { label: string; color: string; defended?: boolean } => {
    if (!incident.slaDeadline) {
      return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    }

    const slaDeadline = new Date(incident.slaDeadline)
    const now = new Date()
    const hasApprovedDefense = incident.slaDefenses?.some((d: any) => d.status === 'APPROVED')

    // If incident is CLOSED or RESOLVED
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

    // If incident is CANCELLED
    if (incident.status === 'CANCELLED') {
      return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    }

    // If incident is still open
    if (now > slaDeadline) {
      return { label: 'Breached', color: 'text-red-400 bg-red-500/20' }
    } else {
      return { label: 'On Track', color: 'text-yellow-400 bg-yellow-500/20' }
    }
  }

  const filterIncidents = () => {
    // Check if incidents is array
    if (!Array.isArray(incidents)) {
      setFilteredIncidents([])
      return
    }

    let filtered = [...incidents]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (incident) =>
          incident.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          incident.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          incident.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          incident.id?.toString().includes(searchTerm)
      )
    }

    // Basic filters (backward compatibility)
    if (filterStatus === 'PENDING') {
      // "Pending" = all non-closed/cancelled incidents
      filtered = filtered.filter((incident) => !['CLOSED', 'CANCELLED'].includes(incident.status))
    } else if (filterStatus !== 'ALL') {
      filtered = filtered.filter((incident) => incident.status === filterStatus)
    }

    if (filterCategory !== 'ALL') {
      filtered = filtered.filter((incident) => incident.category === filterCategory)
    }

    // Advanced filters
    if (advancedFilters.status.length > 0) {
      filtered = filtered.filter((incident) =>
        advancedFilters.status.includes(incident.status)
      )
    }

    if (advancedFilters.priority.length > 0) {
      filtered = filtered.filter((incident) =>
        advancedFilters.priority.includes(incident.priority)
      )
    }

    if (advancedFilters.category.length > 0) {
      filtered = filtered.filter((incident) =>
        advancedFilters.category.includes(incident.category)
      )
    }

    // Date range filter
    if (advancedFilters.dateRange.from) {
      const fromDate = new Date(advancedFilters.dateRange.from)
      filtered = filtered.filter((incident) =>
        new Date(incident.createdAt) >= fromDate
      )
    }

    if (advancedFilters.dateRange.to) {
      const toDate = new Date(advancedFilters.dateRange.to)
      toDate.setHours(23, 59, 59, 999) // End of day
      filtered = filtered.filter((incident) =>
        new Date(incident.createdAt) <= toDate
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      // Handle date fields
      if (sortField === 'createdAt' || sortField === 'updatedAt' || sortField === 'slaDeadline') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue?.toLowerCase() || ''
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredIncidents(filtered)
    setCurrentPage(1)
  }

  const handleExport = (format: 'csv' | 'excel') => {
    if (filteredIncidents.length === 0) {
      toast.error('No data to export')
      return
    }

    // Prepare data (using Gregorian year for reports)
    const exportData = filteredIncidents.map(incident => ({
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

    if (format === 'csv') {
      // Convert to CSV with proper escaping
      const headers = Object.keys(exportData[0])
      const csvContent = [
        // Headers wrapped in quotes
        headers.map(h => `"${h}"`).join(','),
        // Data rows
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header as keyof typeof row]
            // Convert to string and escape
            const stringValue = value != null ? String(value) : ''
            // Wrap all values in quotes and escape existing quotes
            return `"${stringValue.replace(/"/g, '""')}"`
          }).join(',')
        )
      ].join('\n')

      // Download CSV
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `incidents_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      toast.success('CSV file downloaded')
    } else {
      // For Excel, use tab-separated format with proper escaping
      const headers = Object.keys(exportData[0])
      const csvContent = [
        // Headers
        headers.join('\t'),
        // Data rows
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header as keyof typeof row]
            // Convert to string, escape tabs and newlines
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
  }

  const handleDelete = async () => {
    if (!incidentToDelete) return

    try {
      const token = localStorage.getItem('token')

      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentToDelete.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Incident deleted successfully')
      setDeleteModalOpen(false)
      setIncidentToDelete(null)
      fetchIncidents()
    } catch (error: any) {
      toast.error('Failed to delete incident')
      console.error(error)
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
      PENDING: { 
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30', 
        icon: Clock 
      },
      ASSIGNED: { 
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30', 
        icon: Clock 
      },
      IN_PROGRESS: { 
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', 
        icon: Clock 
      },
      RESOLVED: {
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        icon: CheckCircle2
      },
      CLOSED: { 
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30', 
        icon: CheckCircle2 
      },
      CANCELLED: {
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30',
        icon: XCircle
      },
      OUTSOURCED: {
        class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
        icon: Briefcase
      },
    }
    return badges[status] || { 
      class: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30', 
      icon: Clock 
    }
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

  // Pagination
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentIncidents = filteredIncidents.slice(startIndex, endIndex)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading incidents...</p>
        </div>
      </div>
    )
  }

  // Check if SUPER_ADMIN (no access to incidents)
  if (currentUser?.role === 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 rounded-2xl max-w-md text-center">
          <div className="p-4 bg-red-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            ไม่มีสิทธิ์ใช้งานฟีเจอร์นี้
          </h2>
          <p className="text-gray-400">
            Super Admin ไม่สามารถเข้าถึงระบบจัดการ Incidents ได้
          </p>
        </div>
      </div>
    )
  }

  // Check permissions using role-based access
  const viewOnly = isViewOnly(currentUser, '/dashboard/incidents')
  const canCreate = canPerformAction(currentUser, '/dashboard/incidents', 'create')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Incident Management</h1>
          <p className="text-gray-400 mt-1">
            Manage and track all IT incidents
          </p>
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
            {/* Search */}
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

            {/* Advanced Filter Component */}
            <AdvancedIncidentFilter
              onFilterChange={setAdvancedFilters}
              onExport={handleExport}
            />
          </div>

          {/* Bottom Row - Quick Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
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
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="ALL">All Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredIncidents.length)} of{' '}
            {filteredIncidents.length} incidents
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <button
              onClick={() => toggleSort('createdAt')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                sortField === 'createdAt'
                  ? 'text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
              }`}
              style={sortField === 'createdAt' ? { backgroundColor: sortActiveBg } : undefined}
            >
              Date
              {sortField === 'createdAt' && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => toggleSort('priority')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                sortField === 'priority'
                  ? 'text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
              }`}
              style={sortField === 'priority' ? { backgroundColor: sortActiveBg } : undefined}
            >
              Priority
              {sortField === 'priority' && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => toggleSort('status')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                sortField === 'status'
                  ? 'text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700'
              }`}
              style={sortField === 'status' ? { backgroundColor: sortActiveBg } : undefined}
            >
              Status
              {sortField === 'status' && (
                <ArrowUpDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {currentIncidents.length === 0 ? (
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
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Incident No.
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Store
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Province
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Job Type
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    SLA Result
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Aging (Days)
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentIncidents.map((incident, index) => {
                  const statusBadge = getStatusBadge(incident.status)
                  const StatusIcon = statusBadge.icon

                  // Calculate aging (days since creation, only if not Closed/Cancelled)
                  const calculateAging = () => {
                    if (incident.status === 'CLOSED' || incident.status === 'CANCELLED') {
                      return '-'
                    }
                    const createdAt = new Date(incident.createdAt)
                    const now = new Date()
                    const diffTime = Math.abs(now.getTime() - createdAt.getTime())
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                    return diffDays
                  }

                  const aging = calculateAging()

                  return (
                    <tr
                      key={incident.id}
                      onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                      className={`
                        border-b border-slate-700/30 cursor-pointer transition-all duration-200
                        ${index % 2 === 0 
                          ? 'bg-slate-800/30 hover:bg-slate-700/50' 
                          : 'bg-slate-700/50 hover:bg-slate-600/60'
                        }
                      `}
                    >
                      {/* Status */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <span className={statusBadge.class}>
                            {incident.status}
                          </span>
                          {incident.resolutionType && (
                            <span className={`text-[10px] ${
                              incident.resolutionType === 'PHONE_SUPPORT'
                                ? 'text-emerald-400'
                                : incident.resolutionType === 'REMOTE_SUPPORT'
                                ? 'text-blue-400'
                                : 'text-amber-400'
                            }`}>
                              {incident.resolutionType === 'PHONE_SUPPORT' ? 'Phone Support'
                                : incident.resolutionType === 'REMOTE_SUPPORT' ? 'Remote Support'
                                : 'Onsite'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Incident No. */}
                      <td className="py-4 px-6">
                        <span className="text-sm font-mono text-blue-400 font-semibold">
                          {incident.ticketNumber || `WAT-${String(incident.id).padStart(6, '0')}`}
                        </span>
                      </td>

                      {/* Store */}
                      <td className="py-4 px-6">
                        <span className="text-sm text-white">
                          {formatStore(incident.store)}
                        </span>
                      </td>

                      {/* Province */}
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-300">
                          {incident.store?.province || '-'}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="py-4 px-6">
                        <p className="text-sm font-medium text-white">
                          {incident.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {incident.description?.substring(0, 40)}
                          {incident.description?.length > 40 ? '...' : ''}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-6">
                        {incident.category ? (
                          <span className="text-sm text-white font-medium">
                            {incident.category}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>

                      {/* Job Type */}
                      <td className="py-4 px-6">
                        {incident.jobType ? (
                          <span className="text-sm text-white font-medium">
                            {incident.jobType}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-6">
                        <span className={getPriorityBadge(incident.priority)}>
                          {getPriorityDisplayName(incident.priority)}
                        </span>
                      </td>

                      {/* SLA Result */}
                      <td className="py-4 px-6">
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

                      {/* Aging */}
                      <td className="py-4 px-6">
                        {aging === '-' ? (
                          <span className="text-sm text-gray-500">-</span>
                        ) : (
                          <span className={`text-sm font-semibold ${
                            aging > 7 ? 'text-red-400' :
                            aging > 3 ? 'text-yellow-400' :
                            'text-green-400'
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm rounded-lg transition duration-200 ${
                    currentPage === page
                      ? 'text-white'
                      : 'text-gray-300 hover:bg-slate-700/50'
                  }`}
                  style={currentPage === page ? { backgroundColor: sortActiveBg } : undefined}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
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
                <h3 className="text-lg font-semibold text-white">
                  Delete Incident
                </h3>
                <p className="text-sm text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to delete incident{' '}
              <span className="font-semibold">#{incidentToDelete?.id}</span>?
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setIncidentToDelete(null)
                }}
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
