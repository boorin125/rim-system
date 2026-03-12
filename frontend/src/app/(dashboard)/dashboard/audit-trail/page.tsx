// app/(dashboard)/dashboard/audit-trail/page.tsx - Audit Trail
'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

interface AuditLog {
  id: number
  module: string
  action: string
  entityType: string
  entityId: string
  userId: number
  description: string
  createdAt: string
  user: {
    id: number
    username: string
    firstName: string
    lastName: string
  }
}

interface AuditMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'STORE', label: 'Store' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'USER', label: 'User' },
  { value: 'SYSTEM', label: 'System' },
]

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
  { value: 'ASSIGN', label: 'Assign' },
  { value: 'REASSIGN', label: 'Reassign' },
  { value: 'RESOLVE', label: 'Resolve' },
  { value: 'CONFIRM', label: 'Confirm' },
  { value: 'REOPEN', label: 'Reopen' },
  { value: 'CANCEL', label: 'Cancel' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'EXPORT', label: 'Export' },
]

const MODULE_COLORS: Record<string, string> = {
  INCIDENT: 'bg-red-500/20 text-red-400 border border-red-500/30',
  STORE: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  EQUIPMENT: 'bg-green-500/20 text-green-400 border border-green-500/30',
  USER: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  SYSTEM: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  UPDATE: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border border-red-500/30',
  STATUS_CHANGE: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ASSIGN: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  REASSIGN: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
  RESOLVE: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  CONFIRM: 'bg-green-500/20 text-green-400 border border-green-500/30',
  REOPEN: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  CANCEL: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  TRANSFER: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  IMPORT: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  EXPORT: 'bg-lime-500/20 text-lime-400 border border-lime-500/30',
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [meta, setMeta] = useState<AuditMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [filterModule, setFilterModule] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('limit', '20')
      if (filterModule) params.set('module', filterModule)
      if (filterAction) params.set('action', filterAction)
      if (searchTerm) params.set('search', searchTerm)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/audit-trail?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setLogs(res.data.data)
      setMeta(res.data.meta)
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูล Audit Trail ได้')
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, filterModule, filterAction, searchTerm, startDate, endDate])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterModule, filterAction, searchTerm, startDate, endDate])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const totalPages = meta.totalPages

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading audit trail...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <p className="text-gray-400 mt-1">
            Track all actions across the system
          </p>
        </div>
        <span className="text-sm text-gray-400">
          Total {meta.total.toLocaleString()} records
        </span>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Module */}
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              {MODULE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Action */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Start Date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-400">
            Showing page {currentPage} of {totalPages || 1} ({meta.total} records)
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No audit trail records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/80 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Date / Time</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Module</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Action</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Performed By</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-gray-200 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-6 whitespace-nowrap text-gray-400 text-xs">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${MODULE_COLORS[log.module] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-300 whitespace-nowrap">
                      {log.user.firstName} {log.user.lastName}
                    </td>
                    <td className="py-4 px-6 text-gray-400">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
            <span className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
