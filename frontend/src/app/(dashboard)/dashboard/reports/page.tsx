// app/(dashboard)/dashboard/reports/page.tsx - Reports & Analytics (Report Builder)
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useLicense } from '@/context/LicenseContext'
import {
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Users,
  Star,
  Loader2,
  FileDown,
  Globe,
  FileType2,
  Search,
  ListFilter,
  Package,
} from 'lucide-react'
import {
  Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import {
  exportCSV,
  exportExcel,
  exportHTML,
  exportPDF,
  type ReportConfig,
} from '@/utils/reportExporter'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// ==================== TYPES ====================

interface SlaPerformance {
  total: number
  metSla: number
  breachedSla: number
  slaComplianceRate: string
  averageResolutionTimeHours: string
}

interface SlaTrendItem { period: string; slaPercent: number; total: number; slaPass: number; slaFail: number }
interface TechPerformance { name: string; total: number; resolved: number; resolvedRate: string; averageResolutionTime: string }
interface RatingStats {
  totalRatings: number
  averageRating: number
  averages: { overall: number; quality: number | null; professionalism: number | null; politeness: number | null }
  distribution: Record<string, number>
  distributionPercent: Record<string, number>
}

// ==================== CONSTANTS ====================

const API = process.env.NEXT_PUBLIC_API_URL

const REPORT_TYPES = [
  { id: 'inventory', label: 'Inventory Report', icon: Package, description: 'รายงาน Inventory ตาม Category หรือ Store', color: 'blue' },
  { id: 'sla-performance', label: 'SLA Performance', icon: ShieldCheck, description: 'SLA Compliance, Met/Breached, Monthly Trend', color: 'emerald' },
  { id: 'technician-performance', label: 'Technician Performance', icon: Users, description: 'ผลงานแต่ละ Technician (Total, Resolved, Rate)', color: 'purple' },
  { id: 'customer-ratings', label: 'Customer Ratings', icon: Star, description: 'Rating Statistics & Distribution', color: 'amber' },
  { id: 'incident-list', label: 'Incident List', icon: FileText, description: 'รายการ Incidents ทั้งหมดแบบละเอียด', color: 'cyan' },
] as const

type ReportTypeId = typeof REPORT_TYPES[number]['id']

const EQUIPMENT_CATEGORIES = ['All', 'NETWORK', 'COMPUTER', 'POS', 'PRINTER', 'ROUTER', 'SWITCH', 'CCTV', 'OTHER']
const EQUIPMENT_STATUSES = ['All', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']

const CATEGORIES = ['All', 'POS', 'Network', 'Hardware', 'Software', 'Printer', 'Monitor', 'Other']
const PRIORITIES = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const STATUSES = ['All', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED', 'CANCELLED']
const SLA_DEFENSE_FILTERS = [
  { value: 'All', label: 'All' },
  { value: 'HAS_DEFENSE', label: 'Has Defense (any)' },
  { value: 'PENDING', label: 'Defense Pending' },
  { value: 'APPROVED', label: 'Defense Approved' },
  { value: 'REJECTED', label: 'Defense Rejected' },
]

const RATING_COLORS: Record<string, string> = { '5': '#22c55e', '4': '#84cc16', '3': '#facc15', '2': '#f97316', '1': '#ef4444' }

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' },
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

// ==================== MAIN COMPONENT ====================

export default function ReportsPage() {
  const { isExpired, hasLicense } = useLicense()
  const themeHighlight = useThemeHighlight()

  // Step states
  const [selectedReport, setSelectedReport] = useState<ReportTypeId | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterSlaDefense, setFilterSlaDefense] = useState('All')
  const [inventorySubType, setInventorySubType] = useState<'by-category' | 'by-store'>('by-category')
  const [inventoryStoreId, setInventoryStoreId] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState('All')
  const [inventoryStatus, setInventoryStatus] = useState('All')
  const [storeList, setStoreList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [organizationName, setOrganizationName] = useState('')

  // Fetch organization name and store list
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/settings/organization`, { headers })
      .then((res) => setOrganizationName(res.data.organizationName || ''))
      .catch(() => {})
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/stores`, { headers, params: { limit: 500 } })
      .then((res) => {
        const stores = Array.isArray(res.data) ? res.data : (res.data.data || [])
        setStoreList(stores)
      })
      .catch(() => {})
  }, [])

  // Data states
  const [slaPerf, setSlaPerf] = useState<SlaPerformance | null>(null)
  const [slaTrend, setSlaTrend] = useState<SlaTrendItem[]>([])
  const [techPerf, setTechPerf] = useState<TechPerformance[]>([])
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null)

  // Table data for preview/export
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<(string | number)[][]>([])

  const getHeaders = () => {
    const token = localStorage.getItem('token')
    return { Authorization: `Bearer ${token}` }
  }

  const handleGenerate = useCallback(async () => {
    if (!selectedReport) return
    setIsLoading(true)
    setIsGenerated(false)
    const headers = getHeaders()
    const params: Record<string, string> = {}
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo

    try {
      switch (selectedReport) {
        case 'inventory': {
          const eqParams: Record<string, string | number> = { limit: 5000 }
          if (inventoryCategory !== 'All') eqParams.category = inventoryCategory
          if (inventoryStatus !== 'All') eqParams.status = inventoryStatus
          if (inventorySubType === 'by-store' && inventoryStoreId) eqParams.storeId = inventoryStoreId

          const res = await axios.get(`${API}/equipment`, { headers, params: eqParams })
          const items: any[] = Array.isArray(res.data) ? res.data : (res.data.data || [])

          if (inventorySubType === 'by-category') {
            // Group by category
            const grouped: Record<string, any[]> = {}
            items.forEach((eq: any) => {
              const cat = eq.category || 'OTHER'
              if (!grouped[cat]) grouped[cat] = []
              grouped[cat].push(eq)
            })

            const h = ['#', 'Category', 'Equipment Name', 'Brand', 'Model', 'Serial Number', 'Status', 'Store ID', 'Store Name']
            let rowIdx = 0
            const rows: (string | number)[][] = []
            Object.keys(grouped).sort().forEach((cat) => {
              grouped[cat].forEach((eq: any) => {
                rowIdx++
                rows.push([
                  rowIdx,
                  cat,
                  eq.name || '',
                  eq.brand || '',
                  eq.model || '',
                  eq.serialNumber || '',
                  eq.status || '',
                  eq.store?.storeCode ?? '',
                  eq.store?.name || '',
                ])
              })
            })
            setPreviewHeaders(h)
            setPreviewRows(rows)
          } else {
            // By Store - Helpdesk export style
            const h = ['No.', 'Equipment Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Status', 'Purchase Date', 'Warranty Expiry', 'Warranty Status']
            const rows = items.map((eq: any, idx: number) => {
              const now = new Date()
              const warrantyExpiry = eq.warrantyExpiry ? new Date(eq.warrantyExpiry) : null
              const warrantyStatus = !warrantyExpiry ? 'N/A' : warrantyExpiry >= now ? 'Active' : 'Expired'
              return [
                idx + 1,
                eq.name || '',
                eq.category || '',
                eq.brand || '',
                eq.model || '',
                eq.serialNumber || '',
                eq.status || '',
                eq.purchaseDate ? new Date(eq.purchaseDate).toLocaleDateString('th-TH') : '',
                warrantyExpiry ? warrantyExpiry.toLocaleDateString('th-TH') : '',
                warrantyStatus,
              ]
            })
            setPreviewHeaders(h)
            setPreviewRows(rows)
          }
          break
        }

        case 'sla-performance': {
          const [r1, r2] = await Promise.allSettled([
            axios.get(`${API}/incidents/analytics/sla-performance`, { headers, params }),
            axios.get(`${API}/performance/sla-trend`, { headers }),
          ])
          const sla = r1.status === 'fulfilled' ? r1.value.data : null
          const slT = r2.status === 'fulfilled' ? r2.value.data : []
          setSlaPerf(sla)
          setSlaTrend(slT)

          const h = ['Period', 'Total', 'SLA Pass', 'SLA Fail', 'SLA %']
          const rows: (string | number)[][] = []
          if (sla) rows.push(['Overall', sla.total, sla.metSla, sla.breachedSla, `${sla.slaComplianceRate}%`])
          slT.forEach((s: SlaTrendItem) => rows.push([s.period, s.total, s.slaPass, s.slaFail, `${s.slaPercent.toFixed(1)}%`]))
          setPreviewHeaders(h)
          setPreviewRows(rows)
          break
        }

        case 'technician-performance': {
          const r = await axios.get(`${API}/incidents/analytics/technician-performance`, { headers, params })
          setTechPerf(r.data)

          const h = ['#', 'Technician', 'Total', 'Resolved', 'Resolution Rate', 'Avg Time (hrs)', 'SLA Achieve', 'SLA%', 'Check-in Days', 'Avg Ticket', 'Star Rating']
          const rows = (r.data as any[]).map((t, idx) => [
            idx + 1,
            t.name,
            t.total,
            t.resolved,
            `${t.resolvedRate}%`,
            t.averageResolutionTime,
            t.slaAchieve ?? 0,
            t.slaPercent != null ? `${t.slaPercent}%` : 'N/A',
            t.checkInDays ?? 0,
            t.avgTicket ?? '0',
            t.starRating ?? 'N/A',
          ])
          setPreviewHeaders(h)
          setPreviewRows(rows)
          break
        }

        case 'customer-ratings': {
          const [statsRes, listRes] = await Promise.allSettled([
            axios.get(`${API}/ratings/stats`, { headers }),
            axios.get(`${API}/ratings`, { headers, params: { limit: 1000 } }),
          ])
          if (statsRes.status === 'fulfilled') setRatingStats(statsRes.value.data)

          const ratings: any[] = listRes.status === 'fulfilled'
            ? (Array.isArray(listRes.value.data) ? listRes.value.data : (listRes.value.data.data || []))
            : []

          const h = ['#', 'Star Rating', 'Suggestions', 'Store ID', 'Store Name', 'Incident No.', 'Title']
          const rows = ratings.map((r: any, idx: number) => [
            idx + 1,
            r.rating ?? '',
            r.comment || '',
            r.incident?.store?.storeCode ?? '',
            r.incident?.store?.name || 'N/A',
            r.incident?.ticketNumber || `#${r.incidentId}`,
            r.incident?.title || '',
          ])
          setPreviewHeaders(h)
          setPreviewRows(rows)
          break
        }

        case 'incident-list': {
          const r = await axios.get(`${API}/incidents`, { headers, params: { ...params, limit: 1000 } })
          let items: any[] = Array.isArray(r.data) ? r.data : (r.data.data || [])

          // Apply local filters
          if (filterCategory !== 'All') items = items.filter((i: any) => i.category === filterCategory)
          if (filterPriority !== 'All') items = items.filter((i: any) => i.priority === filterPriority)
          if (filterStatus !== 'All') items = items.filter((i: any) => i.status === filterStatus)
          if (filterSlaDefense !== 'All') {
            items = items.filter((i: any) => {
              const defense = i.slaDefenses?.[0]
              if (filterSlaDefense === 'HAS_DEFENSE') return !!defense
              return defense?.status === filterSlaDefense
            })
          }

          const getSlaDefenseLabel = (i: any) => {
            const defense = i.slaDefenses?.[0]
            if (!defense) return '-'
            if (defense.status === 'APPROVED') return 'Approved'
            if (defense.status === 'REJECTED') return 'Rejected'
            if (defense.status === 'PENDING') return 'Pending'
            return defense.status
          }

          const h = ['#', 'Status', 'Ticket No.', 'Store ID', 'Store Name', 'Title', 'Category', 'Priority', 'Job Type', 'Incident Date', 'Create Date', 'Closed Date', 'Technician', 'Resolution Note', 'SLA Defense', 'เหตุผล Defense SLA']
          const rows = items.map((i: any, idx: number) => {
            const techName = i.assignees?.length > 0
              ? i.assignees.map((a: any) => `${a.user.firstName} ${a.user.lastName}`).join(', ')
              : 'Unassigned'
            const closedDate = i.resolvedAt
            const fmtDate = (d: string) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}` }
            return [
              idx + 1,
              i.status || '',
              i.ticketNumber || `#${i.id}`,
              i.store?.storeCode ?? '',
              i.store?.name || 'N/A',
              i.title || '',
              i.category || 'N/A',
              i.priority || '',
              i.jobType || '',
              i.incidentDate ? new Date(i.incidentDate).toLocaleString('th-TH') : '',
              i.createdAt ? new Date(i.createdAt).toLocaleString('th-TH') : '',
              closedDate ? new Date(closedDate).toLocaleString('th-TH') : '',
              techName,
              i.resolutionNote || '',
              getSlaDefenseLabel(i),
              i.slaDefenses?.[0]?.reason || '-',
            ]
          })
          setPreviewHeaders(h)
          setPreviewRows(rows)
          break
        }
      }

      setIsGenerated(true)
      toast.success('Report generated')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Failed to generate report')
    } finally {
      setIsLoading(false)
    }
  }, [selectedReport, dateFrom, dateTo, filterCategory, filterPriority, filterStatus, filterSlaDefense, inventorySubType, inventoryStoreId, inventoryCategory, inventoryStatus])

  // ==================== EXPORT HANDLERS ====================

  const buildConfig = (): ReportConfig => {
    const reportDef = REPORT_TYPES.find((r) => r.id === selectedReport)
    const reportLabel = selectedReport === 'inventory'
      ? `Inventory Report - ${inventorySubType === 'by-category' ? 'By Category' : 'By Store'}${inventorySubType === 'by-store' && inventoryStoreId ? ` (${storeList.find((s: any) => String(s.id) === inventoryStoreId)?.name || inventoryStoreId})` : ''}`
      : (reportDef?.label || 'Report')

    const filters: Record<string, string> = {}
    if (selectedReport === 'inventory') {
      if (inventoryCategory !== 'All') filters.Category = inventoryCategory
      if (inventoryStatus !== 'All') filters.Status = inventoryStatus
      if (inventorySubType === 'by-store' && inventoryStoreId) {
        const store = storeList.find((s: any) => String(s.id) === inventoryStoreId)
        filters.Store = store ? formatStore(store) : inventoryStoreId
      }
    } else {
      filters.Category = filterCategory
      filters.Priority = filterPriority
      filters.Status = filterStatus
      if (selectedReport === 'incident-list' && filterSlaDefense !== 'All') {
        filters['SLA Defense'] = SLA_DEFENSE_FILTERS.find(f => f.value === filterSlaDefense)?.label || filterSlaDefense
      }
    }

    return {
      title: reportLabel,
      reportType: reportLabel,
      dateRange: { from: dateFrom, to: dateTo },
      filters,
      headers: previewHeaders,
      rows: previewRows,
      generatedAt: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      organizationName,
      summaryLine: selectedReport === 'customer-ratings' && ratingStats
        ? `★ ${ratingStats.averageRating.toFixed(1)} / 5.0  (${ratingStats.totalRatings} ratings)`
        : selectedReport === 'inventory'
        ? `Total: ${previewRows.length} items`
        : undefined,
      columnWidths: selectedReport === 'customer-ratings'
        ? [4, 7, 30, 8, 14, 10, 27]
        : selectedReport === 'incident-list'
        ? [2, 6, 7, 4, 9, 16, 6, 5, 7, 9, 10, 10, 11, 16, 7, 14]
        : undefined,
    }
  }

  const handleExport = async (format: 'csv' | 'excel' | 'html' | 'pdf') => {
    if (isExpired || !hasLicense) {
      toast.error('License หมดอายุแล้ว — ไม่สามารถ Export ได้ กรุณาต่ออายุ License')
      return
    }
    if (!isGenerated || previewRows.length === 0) {
      toast.error('No data to export. Generate report first.')
      return
    }
    const config = buildConfig()
    switch (format) {
      case 'csv': exportCSV(config); break
      case 'excel': exportExcel(config); break
      case 'html': exportHTML(config); break
      case 'pdf': await exportPDF(config); break
    }
    toast.success(`${format.toUpperCase()} exported`)
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-blue-400" />
          Reports & Analytics
        </h1>
        <p className="text-gray-400 mt-1">เลือกประเภทรายงาน กรองข้อมูล แล้ว Export ได้ทั้ง CSV, Excel, HTML, PDF</p>
      </div>

      {/* Step 1: Select Report Type */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold">1</span>
          Select Report Type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon
            const c = colorMap[rt.color]
            const isActive = selectedReport === rt.id
            return (
              <button
                key={rt.id}
                onClick={() => { setSelectedReport(rt.id); setIsGenerated(false) }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isActive
                    ? `${c.border} ${c.bg} ring-1 ring-offset-0 ring-opacity-50`
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                }`}
              >
                <div className={`p-2 ${c.bg} rounded-lg w-fit mb-3`}>
                  <Icon className={`w-5 h-5 ${c.text}`} />
                </div>
                <p className="text-white text-sm font-semibold">{rt.label}</p>
                <p className="text-gray-500 text-xs mt-1">{rt.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2: Filters */}
      {selectedReport && (
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold">2</span>
            Filters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-gray-400 text-xs font-medium mb-1.5">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-medium mb-1.5">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Inventory sub-type and filters */}
            {selectedReport === 'inventory' && (
              <>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Report Mode</label>
                  <select
                    value={inventorySubType}
                    onChange={(e) => setInventorySubType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="by-category">By Category</option>
                    <option value="by-store">By Store</option>
                  </select>
                </div>
                {inventorySubType === 'by-store' && (
                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5">Store</label>
                    <select
                      value={inventoryStoreId}
                      onChange={(e) => setInventoryStoreId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Stores</option>
                      {storeList.map((s: any) => (
                        <option key={s.id} value={s.id}>{formatStore(s)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Equipment Category</label>
                  <select
                    value={inventoryCategory}
                    onChange={(e) => setInventoryCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {EQUIPMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Equipment Status</label>
                  <select
                    value={inventoryStatus}
                    onChange={(e) => setInventoryStatus(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Category filter - for incident-list */}
            {selectedReport === 'incident-list' && (
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Priority filter */}
            {selectedReport === 'incident-list' && (
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* Status filter */}
            {selectedReport === 'incident-list' && (
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* SLA Defense filter */}
            {selectedReport === 'incident-list' && (
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">SLA Defense</label>
                <select
                  value={filterSlaDefense}
                  onChange={(e) => setFilterSlaDefense(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SLA_DEFENSE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="mt-5">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 hover:brightness-110 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: themeHighlight }}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Search className="w-4 h-4" /> Generate Report</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Export */}
      {isGenerated && selectedReport && (
        <div className="space-y-6">
          {/* Export Buttons */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold">3</span>
              Export Report
              <span className="ml-2 text-sm text-gray-500 font-normal">({previewRows.length} records)</span>
            </h2>
            {(isExpired || !hasLicense) && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <span>License หมดอายุ — ดูรายงานได้ แต่ Export ไม่ได้ กรุณาต่ออายุ License</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleExport('csv')} disabled={isExpired || !hasLicense} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl text-sm font-medium transition-colors border border-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
                <FileDown className="w-4 h-4" /> Export CSV
              </button>
              <button onClick={() => handleExport('excel')} disabled={isExpired || !hasLicense} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-colors border border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </button>
              <button onClick={() => handleExport('html')} disabled={isExpired || !hasLicense} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl text-sm font-medium transition-colors border border-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
                <Globe className="w-4 h-4" /> Export HTML
              </button>
              <button onClick={() => handleExport('pdf')} disabled={isExpired || !hasLicense} className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors border border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed">
                <FileType2 className="w-4 h-4" /> Export PDF
              </button>
            </div>
          </div>

          {/* Charts (visual preview for some report types) */}
          {selectedReport === 'sla-performance' && (
            <SLACharts slaPerf={slaPerf} slaTrend={slaTrend} />
          )}
          {selectedReport === 'technician-performance' && (
            <TechnicianCharts techPerf={techPerf} />
          )}
          {selectedReport === 'customer-ratings' && (
            <RatingCharts ratingStats={ratingStats} />
          )}

          {/* Data Preview Table */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-blue-400" /> Data Preview
              <span className="text-gray-600">({previewRows.length} rows)</span>
            </h3>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="border-b border-slate-700/50">
                    {previewHeaders.map((h, i) => (
                      <th key={i} className="text-left py-3 px-3 text-gray-400 bg-slate-800/90 text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                      {row.map((val, j) => (
                        <td key={j} className="py-2 px-3 text-gray-300 text-xs whitespace-nowrap max-w-[200px] truncate">
                          {String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 100 && (
                <p className="text-center text-gray-500 text-xs py-3">
                  Showing 100 of {previewRows.length} rows. Export to see all data.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== CHART COMPONENTS ====================

function SLACharts({ slaPerf, slaTrend }: { slaPerf: SlaPerformance | null; slaTrend: SlaTrendItem[] }) {
  const slaRate = slaPerf ? parseFloat(slaPerf.slaComplianceRate) : 0
  const slaColor = slaRate >= 90 ? 'text-green-400' : slaRate >= 70 ? 'text-yellow-400' : 'text-red-400'
  const slaBarColor = slaRate >= 90 ? 'bg-green-500' : slaRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-blue-500/30">
          <p className="text-gray-400 text-xs font-medium">Total</p>
          <p className="text-3xl font-bold text-white mt-2">{slaPerf?.total ?? 0}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-green-500/30">
          <p className="text-gray-400 text-xs font-medium">Met SLA</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{slaPerf?.metSla ?? 0}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-red-500/30">
          <p className="text-gray-400 text-xs font-medium">Breached</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{slaPerf?.breachedSla ?? 0}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-emerald-500/30">
          <p className="text-gray-400 text-xs font-medium">Compliance</p>
          <p className={`text-3xl font-bold mt-2 ${slaColor}`}>{slaPerf ? `${slaPerf.slaComplianceRate}%` : 'N/A'}</p>
        </div>
      </div>

      {slaPerf && (
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                <div className={`h-4 rounded-full transition-all ${slaBarColor}`} style={{ width: `${Math.min(slaRate, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
            <div className="text-center">
              <p className={`text-4xl font-bold ${slaColor}`}>{slaPerf.slaComplianceRate}%</p>
              <p className="text-gray-500 text-xs mt-1">Avg {slaPerf.averageResolutionTimeHours} hrs</p>
            </div>
          </div>
        </div>
      )}

      {slaTrend.length > 0 && (
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> SLA Monthly Trend
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={slaTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="slaPercent" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} name="SLA %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function TechnicianCharts({ techPerf }: { techPerf: TechPerformance[] }) {
  const sorted = [...techPerf].sort((a, b) => parseFloat(b.resolvedRate) - parseFloat(a.resolvedRate))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-blue-500/30">
          <p className="text-gray-400 text-xs">Technicians</p>
          <p className="text-3xl font-bold text-white mt-2">{techPerf.length}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-green-500/30">
          <p className="text-gray-400 text-xs">Total Resolved</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{techPerf.reduce((s, t) => s + t.resolved, 0)}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-purple-500/30">
          <p className="text-gray-400 text-xs">Avg Rate</p>
          <p className="text-3xl font-bold text-purple-400 mt-2">
            {techPerf.length > 0 ? (techPerf.reduce((s, t) => s + parseFloat(t.resolvedRate), 0) / techPerf.length).toFixed(1) : 0}%
          </p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-amber-500/30">
          <p className="text-gray-400 text-xs">Avg Time</p>
          <p className="text-3xl font-bold text-amber-400 mt-2">
            {techPerf.length > 0 ? (techPerf.reduce((s, t) => s + parseFloat(t.averageResolutionTime), 0) / techPerf.length).toFixed(1) : 0}
            <span className="text-sm text-gray-400 ml-1">hrs</span>
          </p>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Workload
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(250, sorted.length * 40)}>
            <BarChart data={sorted} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={130} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar dataKey="resolved" fill="#22c55e" name="Resolved" radius={[0, 4, 4, 0]} />
              <Bar dataKey="total" fill="#3b82f680" name="Total" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function RatingCharts({ ratingStats }: { ratingStats: RatingStats | null }) {
  if (!ratingStats) return <EmptyChart />

  const distData = [5, 4, 3, 2, 1].map((star) => ({
    name: `${star} Star`,
    value: ratingStats.distribution[star] || 0,
    percent: ratingStats.distributionPercent[star] || 0,
    star: String(star),
  }))

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <p className="text-5xl font-bold text-amber-400">{ratingStats.averageRating.toFixed(1)}</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className={`w-7 h-7 ${star <= Math.round(ratingStats.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
            ))}
          </div>
          <span className="text-gray-400 ml-2">({ratingStats.totalRatings} ratings)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Distribution Chart</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {distData.map((e, i) => <Cell key={i} fill={RATING_COLORS[e.star]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Distribution Breakdown</h3>
          <div className="space-y-4">
            {distData.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-gray-400 text-sm w-14">{item.name}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${item.percent}%`, backgroundColor: RATING_COLORS[item.star] }} />
                </div>
                <span className="text-white text-sm font-medium w-10 text-right">{item.value}</span>
                <span className="text-gray-500 text-xs w-12 text-right">{item.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[260px] text-gray-500 text-sm">
      No data available
    </div>
  )
}
