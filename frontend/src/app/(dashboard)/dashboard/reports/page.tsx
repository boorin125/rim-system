// app/(dashboard)/dashboard/reports/page.tsx - Reports & Analytics (Report Builder)
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useCallback, useEffect, useRef } from 'react'
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
  Award,
  ChevronDown,
  Check,
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
  sanitizeFilename,
  type ReportConfig,
} from '@/utils/reportExporter'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// ==================== TYPES ====================

interface TechDetailPerf {
  period: string
  overallScore: number
  grade: string
  gradeDescription: string
  ranking: number | null
  totalTechnicians: number | null
  slaCompliance: number
  workVolume: number
  avgResolutionTimeHrs: number
  avgResponseTimeMins: number
  firstTimeFixRate: number
  reopenRate: number
  avgCustomerRating: number | null
  bonusPoints: number
}

interface TechDetailRow {
  date: string
  loginAt: string | null
  logoutAt: string | null
  firstCheckIn: string | null
  lastCheckIn: string | null
  lastResolve: string | null
  totalJobs: number
  resolved: number
  slaPass: number
  slaTotal: number
}

interface TechDetailData {
  technician: { id: number; name: string; email: string; technicianType: string | null }
  dateRange: { from: string; to: string }
  performance: TechDetailPerf | null
  dailyRows: TechDetailRow[]
}

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
  { id: 'technician-detail', label: 'Technician Detail', icon: Users, description: 'รายงานรายบุคคล: Login/Logout, Check-in, คะแนน Performance', color: 'indigo' },
  { id: 'customer-ratings', label: 'Customer Ratings', icon: Star, description: 'Rating Statistics & Distribution', color: 'amber' },
  { id: 'incident-list', label: 'Incident List', icon: FileText, description: 'รายการ Incidents ทั้งหมดแบบละเอียด', color: 'cyan' },
] as const

type ReportTypeId = typeof REPORT_TYPES[number]['id']

const EQUIPMENT_STATUSES = ['All', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']

const CATEGORIES = ['All', 'POS', 'Network', 'Hardware', 'Software', 'Printer', 'Monitor', 'Other']
const PRIORITIES = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED', 'CANCELLED']
const STATUS_CHIP: Record<string, string> = {
  OPEN:        'bg-slate-500/20 text-slate-300 border-slate-500/40',
  ASSIGNED:    'bg-purple-500/20 text-purple-300 border-purple-500/40',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  PENDING:     'bg-orange-500/20 text-orange-300 border-orange-500/40',
  RESOLVED:    'bg-blue-500/20 text-blue-300 border-blue-500/40',
  CLOSED:      'bg-green-500/20 text-green-300 border-green-500/40',
  CANCELLED:   'bg-red-500/20 text-red-300 border-red-500/40',
}
const SLA_DEFENSE_FILTERS = [
  { value: 'All', label: 'All' },
  { value: 'HAS_DEFENSE', label: 'Has Defense (any)' },
  { value: 'PENDING', label: 'Defense Pending' },
  { value: 'APPROVED', label: 'Defense Approved' },
  { value: 'REJECTED', label: 'Defense Rejected' },
]

const RATING_COLORS: Record<string, string> = { '5': '#22c55e', '4': '#84cc16', '3': '#facc15', '2': '#f97316', '1': '#ef4444' }

const INCIDENT_COLUMNS = [
  { key: 'idx',              label: '#',                   width: 2  },
  { key: 'status',           label: 'Status',              width: 6  },
  { key: 'ticketNo',         label: 'Ticket No.',          width: 7  },
  { key: 'storeId',          label: 'Store ID',            width: 4  },
  { key: 'storeName',        label: 'Store Name',          width: 9  },
  { key: 'title',            label: 'Title',               width: 14 },
  { key: 'category',         label: 'Category',            width: 6  },
  { key: 'priority',         label: 'Priority',            width: 5  },
  { key: 'jobType',          label: 'Job Type',            width: 6  },
  { key: 'incidentDate',     label: 'Incident Date',       width: 9  },
  { key: 'createDate',       label: 'Create Date',         width: 9  },
  { key: 'assignDate',       label: 'Assign Date',         width: 9  },
  { key: 'checkinDate',      label: 'Checkin Date',        width: 9  },
  { key: 'reassignDate',     label: 'Reassign Date',       width: 9  },
  { key: 'closedDate',       label: 'Closed Date',         width: 9  },
  { key: 'technician',       label: 'Technician',          width: 10 },
  { key: 'resolutionNote',   label: 'Resolution Note',     width: 14 },
  { key: 'slaDefense',       label: 'SLA Defense',         width: 6  },
  { key: 'slaDefenseReason', label: 'เหตุผล Defense SLA', width: 10 },
] as const

type IncidentColKey = typeof INCIDENT_COLUMNS[number]['key']
const ALL_INCIDENT_COL_KEYS = INCIDENT_COLUMNS.map(c => c.key) as IncidentColKey[]

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
  indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
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
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [filterJobType, setFilterJobType] = useState('All')
  const [categoryList, setCategoryList] = useState<{ id: number; name: string; jobTypeIds: number[] }[]>([])
  const [jobTypeList, setJobTypeList] = useState<{ id: number; name: string }[]>([])
  const [inventorySubType, setInventorySubType] = useState<'by-category' | 'by-store'>('by-category')
  const [inventoryStoreId, setInventoryStoreId] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState('All')
  const [inventoryStatus, setInventoryStatus] = useState('All')
  const [equipmentCategoryList, setEquipmentCategoryList] = useState<string[]>([])
  const [invCatSearch, setInvCatSearch] = useState('')
  const [invCatDropdownOpen, setInvCatDropdownOpen] = useState(false)
  const invCatRef = useRef<HTMLDivElement>(null)
  const [storeList, setStoreList] = useState<any[]>([])
  const [invStoreSearch, setInvStoreSearch] = useState('')
  const [invStoreDropdownOpen, setInvStoreDropdownOpen] = useState(false)
  const invStoreRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [organizationName, setOrganizationName] = useState('')

  // Incident column picker — array preserves selection order
  const [selectedIncidentCols, setSelectedIncidentCols] = useState<IncidentColKey[]>(() => {
    if (typeof window === 'undefined') return ALL_INCIDENT_COL_KEYS
    try {
      const saved = localStorage.getItem('rim_incident_cols')
      if (saved) {
        const keys = JSON.parse(saved) as IncidentColKey[]
        const valid = keys.filter(k => ALL_INCIDENT_COL_KEYS.includes(k))
        if (valid.length > 0) return valid
      }
    } catch {}
    return ALL_INCIDENT_COL_KEYS
  })

  const toggleIncidentCol = (key: IncidentColKey) => {
    setSelectedIncidentCols(prev => {
      const isSelected = prev.includes(key)
      if (isSelected && prev.length <= 1) return prev
      const next = isSelected ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem('rim_incident_cols', JSON.stringify(next))
      return next
    })
    setIsGenerated(false)
  }

  const setAllIncidentCols = (all: boolean) => {
    const next = all ? ALL_INCIDENT_COL_KEYS : [ALL_INCIDENT_COL_KEYS[0]]
    setSelectedIncidentCols(next)
    localStorage.setItem('rim_incident_cols', JSON.stringify(next))
    setIsGenerated(false)
  }

  // Technician detail report states
  const [technicianList, setTechnicianList] = useState<any[]>([])
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [techDetailPeriod, setTechDetailPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [techDetailData, setTechDetailData] = useState<TechDetailData | null>(null)

  // Fetch organization name and store list
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node))
        setStatusDropdownOpen(false)
      if (invCatRef.current && !invCatRef.current.contains(e.target as Node))
        setInvCatDropdownOpen(false)
      if (invStoreRef.current && !invStoreRef.current.contains(e.target as Node))
        setInvStoreDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/equipment/distinct-categories`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setEquipmentCategoryList(Array.isArray(res.data) ? res.data : []))
    .catch(() => {})
  }, [])

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
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/users`, { headers, params: { role: 'TECHNICIAN', limit: 200 } })
      .then((res) => {
        const users = Array.isArray(res.data) ? res.data : (res.data.data || [])
        setTechnicianList(users)
      })
      .catch(() => {})
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories`, { headers })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || [])
        setCategoryList(data)
      })
      .catch(() => {})
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories/job-types`, { headers })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || [])
        setJobTypeList(data)
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
          if (inventoryStoreId) eqParams.storeId = inventoryStoreId

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
          const incidentParams: Record<string, string | number> = { limit: 10000 }
          if (dateFrom) incidentParams.dateFrom = dateFrom
          if (dateTo) incidentParams.dateTo = dateTo
          if (filterStatuses.length > 0) incidentParams.status = filterStatuses.join(',')
          if (filterCategory !== 'All') incidentParams.category = filterCategory
          if (filterPriority !== 'All') incidentParams.priority = filterPriority
          if (filterJobType !== 'All') incidentParams.jobType = filterJobType

          const [r, slaRes] = await Promise.allSettled([
            axios.get(`${API}/incidents`, { headers, params: incidentParams }),
            axios.get(`${API}/sla`, { headers }),
          ])
          if (r.status === 'rejected') throw r.reason
          let items: any[] = Array.isArray(r.value.data) ? r.value.data : (r.value.data.data || [])
          const priorityMap = new Map<string, string>()
          if (slaRes.status === 'fulfilled') {
            const configs = Array.isArray(slaRes.value.data) ? slaRes.value.data : []
            configs.forEach((c: any) => { if (c.priority && c.name) priorityMap.set(c.priority, c.name) })
          }
          const getPriority = (p: string) => priorityMap.get(p) || p


          const getSlaDefenseLabel = (inc: any) => {
            const defense = inc.slaDefenses?.[0]
            if (!defense) return '-'
            if (defense.status === 'APPROVED') return 'Approved'
            if (defense.status === 'REJECTED') return 'Rejected'
            if (defense.status === 'PENDING') return 'Pending'
            return defense.status
          }

          const activeCols = selectedIncidentCols
            .map(key => INCIDENT_COLUMNS.find(c => c.key === key))
            .filter((c): c is typeof INCIDENT_COLUMNS[number] => !!c)
          const h = activeCols.map(c => c.label)
          const rows = items.map((inc: any, idx: number) => {
            const techName = inc.assignees?.length > 0
              ? inc.assignees.map((a: any) => `${a.user.firstName} ${a.user.lastName}`).join(', ')
              : 'Unassigned'
            const firstAssign = inc.assignees?.find((a: any) => a.assignedAt)
            const firstCheckin = inc.assignees?.find((a: any) => a.checkedInAt)
            const lastReassign = inc.reassignments?.[0]
            const closedDate = inc.resolvedAt
            const allData: Record<IncidentColKey, string | number> = {
              idx:              idx + 1,
              status:           inc.status || '',
              ticketNo:         inc.ticketNumber || `#${inc.id}`,
              storeId:          inc.store?.storeCode ?? '',
              storeName:        inc.store?.name || 'N/A',
              title:            inc.title || '',
              category:         inc.category || 'N/A',
              priority:         getPriority(inc.priority || ''),
              jobType:          inc.jobType || '',
              incidentDate:     inc.incidentDate ? new Date(inc.incidentDate).toLocaleString('th-TH') : '',
              createDate:       inc.createdAt ? new Date(inc.createdAt).toLocaleString('th-TH') : '',
              assignDate:       firstAssign?.assignedAt ? new Date(firstAssign.assignedAt).toLocaleString('th-TH') : '',
              checkinDate:      firstCheckin?.checkedInAt ? new Date(firstCheckin.checkedInAt).toLocaleString('th-TH') : '',
              reassignDate:     lastReassign?.reassignedAt ? new Date(lastReassign.reassignedAt).toLocaleString('th-TH') : '',
              closedDate:       closedDate ? new Date(closedDate).toLocaleString('th-TH') : '',
              technician:       techName,
              resolutionNote:   inc.resolutionNote || '',
              slaDefense:       getSlaDefenseLabel(inc),
              slaDefenseReason: inc.slaDefenses?.[0]?.reason || '-',
            }
            return activeCols.map(c => allData[c.key])
          })
          setPreviewHeaders(h)
          setPreviewRows(rows)
          break
        }

        case 'technician-detail': {
          if (!selectedTechnicianId) { toast.error('กรุณาเลือก Technician'); setIsLoading(false); return }
          const r = await axios.get(`${API}/incidents/analytics/technician-detail`, {
            headers,
            params: {
              technicianId: selectedTechnicianId,
              from: dateFrom || undefined,
              to: dateTo || undefined,
              period: techDetailPeriod || undefined,
            },
          })
          const data: TechDetailData = r.data
          setTechDetailData(data)

          const fmtDT = (iso: string | null) => {
            if (!iso) return '-'
            const d = new Date(iso)
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          }
          const fmtDate = (s: string) => {
            const [y, m, d] = s.split('-')
            return `${d}/${m}/${y}`
          }

          const h = ['#', 'Date', 'Login', 'Logout', 'First Check-in', 'Last Check-in', 'Last Resolve', 'Total Jobs', 'Resolved', 'SLA Pass', 'SLA Total']
          const rows = data.dailyRows.map((row, idx) => [
            idx + 1,
            fmtDate(row.date),
            fmtDT(row.loginAt),
            fmtDT(row.logoutAt),
            fmtDT(row.firstCheckIn),
            fmtDT(row.lastCheckIn),
            fmtDT(row.lastResolve),
            row.totalJobs,
            row.resolved,
            row.slaPass,
            row.slaTotal,
          ])
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
  }, [selectedReport, dateFrom, dateTo, filterCategory, filterPriority, filterStatuses, filterJobType, inventorySubType, inventoryStoreId, inventoryCategory, inventoryStatus, selectedTechnicianId, techDetailPeriod, selectedIncidentCols])

  // ==================== EXPORT HANDLERS ====================

  const buildConfig = (): ReportConfig => {
    const reportDef = REPORT_TYPES.find((r) => r.id === selectedReport)
    const reportLabel = selectedReport === 'inventory'
      ? `Inventory Report - ${inventorySubType === 'by-category' ? 'By Category' : 'By Store'}${inventorySubType === 'by-store' && inventoryStoreId ? ` (${storeList.find((s: any) => String(s.id) === inventoryStoreId)?.name || inventoryStoreId})` : ''}`
      : selectedReport === 'technician-detail' && techDetailData
      ? `Technician Detail Report - ${techDetailData.technician.name}`
      : (reportDef?.label || 'Report')

    const filters: Record<string, string> = {}
    if (selectedReport === 'inventory') {
      if (inventoryCategory !== 'All') filters.Category = inventoryCategory
      if (inventoryStatus !== 'All') filters.Status = inventoryStatus
      if (inventoryStoreId) {
        const store = storeList.find((s: any) => String(s.id) === inventoryStoreId)
        filters.Store = store ? formatStore(store) : inventoryStoreId
      }
    } else if (selectedReport === 'technician-detail' && techDetailData?.performance) {
      const p = techDetailData.performance
      filters['Technician'] = techDetailData.technician.name
      filters['Period'] = p.period
      filters['Overall Score'] = `${p.overallScore.toFixed(1)} pts`
      filters['Grade'] = `${p.grade} — ${p.gradeDescription}`
      filters['SLA Compliance'] = `${p.slaCompliance.toFixed(1)}%`
      filters['Work Volume'] = `${p.workVolume} jobs`
      filters['Avg Resolution'] = `${p.avgResolutionTimeHrs.toFixed(1)} hrs`
      filters['Avg Response'] = `${p.avgResponseTimeMins.toFixed(0)} min`
      filters['First Time Fix'] = `${p.firstTimeFixRate.toFixed(1)}%`
      filters['Reopen Rate'] = `${p.reopenRate.toFixed(1)}%`
      if (p.avgCustomerRating != null) filters['Customer Rating'] = `★ ${p.avgCustomerRating.toFixed(1)} / 5.0`
      if (p.ranking && p.totalTechnicians) filters['Ranking'] = `#${p.ranking} / ${p.totalTechnicians}`
    } else {
      if (selectedReport === 'incident-list' && filterJobType !== 'All') filters['Job Type'] = filterJobType
      filters.Category = filterCategory
      filters.Priority = filterPriority
      filters.Status = filterStatuses.length === 0 ? 'All' : filterStatuses.join(', ')
    }

    let fileNameBase: string | undefined
    if (selectedReport === 'inventory') {
      if (inventorySubType === 'by-category') {
        const catSlug = inventoryCategory !== 'All' ? sanitizeFilename(inventoryCategory) : 'all_categories'
        fileNameBase = `inventory_report_${catSlug}`
      } else {
        const store = storeList.find((s: any) => String(s.id) === inventoryStoreId)
        const storeSlug = inventoryStoreId
          ? sanitizeFilename(store ? `${store.storeCode}_${store.name}` : inventoryStoreId)
          : 'all_stores'
        fileNameBase = `inventory_report_${storeSlug}`
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
      fileNameBase,
      summaryLine: selectedReport === 'customer-ratings' && ratingStats
        ? `★ ${ratingStats.averageRating.toFixed(1)} / 5.0  (${ratingStats.totalRatings} ratings)`
        : selectedReport === 'inventory'
        ? `Total: ${previewRows.length} items`
        : selectedReport === 'technician-detail' && techDetailData?.performance
        ? `${techDetailData.performance.overallScore.toFixed(1)} pts — Grade ${techDetailData.performance.grade}`
        : undefined,
      columnWidths: selectedReport === 'customer-ratings'
        ? [4, 7, 30, 8, 14, 10, 27]
        : selectedReport === 'incident-list'
        ? selectedIncidentCols.map(key => INCIDENT_COLUMNS.find(c => c.key === key)?.width ?? 6)
        : selectedReport === 'technician-detail'
        ? [3, 9, 8, 8, 10, 10, 10, 8, 8, 8, 8]
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
            {/* Date Range — hidden for Inventory (dates not applicable) */}
            {selectedReport !== 'inventory' && (
              <>
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
              </>
            )}

            {/* Inventory filters */}
            {selectedReport === 'inventory' && (
              <>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Report Mode</label>
                  <select
                    value={inventorySubType}
                    onChange={(e) => {
                      const v = e.target.value as 'by-category' | 'by-store'
                      setInventorySubType(v)
                      setInventoryCategory('All')
                      setInvCatSearch('')
                      setInventoryStoreId('')
                      setInvStoreSearch('')
                    }}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
                  >
                    <option value="by-category">By Category</option>
                    <option value="by-store">By Store</option>
                  </select>
                </div>

                {/* Store — by-store only, live search */}
                {inventorySubType === 'by-store' && (
                  <div className="relative sm:col-span-2" ref={invStoreRef}>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5">Store</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={invStoreSearch}
                        onChange={(e) => { setInvStoreSearch(e.target.value); setInvStoreDropdownOpen(true) }}
                        onFocus={() => setInvStoreDropdownOpen(true)}
                        placeholder="All Stores"
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                      />
                      {inventoryStoreId && (
                        <button
                          type="button"
                          onClick={() => { setInventoryStoreId(''); setInvStoreSearch(''); setInvStoreDropdownOpen(false) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >✕</button>
                      )}
                    </div>
                    {invStoreDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setInventoryStoreId(''); setInvStoreSearch(''); setInvStoreDropdownOpen(false) }}
                          className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-slate-700 ${!inventoryStoreId ? 'text-cyan-300' : 'text-gray-400'}`}
                        >
                          All Stores
                        </button>
                        <div className="border-t border-slate-700" />
                        {storeList
                          .filter((s: any) => formatStore(s).toLowerCase().includes(invStoreSearch.toLowerCase()))
                          .map((s: any) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setInventoryStoreId(String(s.id))
                                setInvStoreSearch(formatStore(s))
                                setInvStoreDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-slate-700 ${String(inventoryStoreId) === String(s.id) ? 'text-cyan-300 font-medium' : 'text-white'}`}
                            >
                              {formatStore(s)}
                            </button>
                          ))
                        }
                        {storeList.filter((s: any) => formatStore(s).toLowerCase().includes(invStoreSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-500">No results</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Equipment Category — by-category only, live search */}
                {inventorySubType === 'by-category' && (
                  <div className="relative" ref={invCatRef}>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5">Equipment Category</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={invCatSearch}
                        onChange={(e) => { setInvCatSearch(e.target.value); setInvCatDropdownOpen(true) }}
                        onFocus={() => setInvCatDropdownOpen(true)}
                        placeholder="All Categories"
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                      />
                      {inventoryCategory !== 'All' && (
                        <button
                          type="button"
                          onClick={() => { setInventoryCategory('All'); setInvCatSearch(''); setInvCatDropdownOpen(false) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >✕</button>
                      )}
                    </div>
                    {invCatDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setInventoryCategory('All'); setInvCatSearch(''); setInvCatDropdownOpen(false) }}
                          className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-slate-700 ${inventoryCategory === 'All' ? 'text-cyan-300' : 'text-gray-400'}`}
                        >
                          All Categories
                        </button>
                        <div className="border-t border-slate-700" />
                        {equipmentCategoryList
                          .filter(c => c.toLowerCase().includes(invCatSearch.toLowerCase()))
                          .map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setInventoryCategory(c); setInvCatSearch(c); setInvCatDropdownOpen(false) }}
                              className={`w-full px-3 py-2 text-sm text-left transition-colors hover:bg-slate-700 ${inventoryCategory === c ? 'text-cyan-300 font-medium' : 'text-white'}`}
                            >
                              {c}
                            </button>
                          ))
                        }
                        {equipmentCategoryList.filter(c => c.toLowerCase().includes(invCatSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-500">No results</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Equipment Status</label>
                  <select
                    value={inventoryStatus}
                    onChange={(e) => setInventoryStatus(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
                  >
                    {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Technician picker - for technician-detail */}
            {selectedReport === 'technician-detail' && (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Technician</label>
                  <select
                    value={selectedTechnicianId}
                    onChange={(e) => setSelectedTechnicianId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 [&>option]:bg-slate-800 [&>option]:text-white"
                  >
                    <option value="">-- Select Technician --</option>
                    {technicianList.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Performance Period (YYYY-MM)</label>
                  <input
                    type="month"
                    value={techDetailPeriod}
                    onChange={(e) => setTechDetailPeriod(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            {/* Job Type filter - for incident-list */}
            {selectedReport === 'incident-list' && (
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Job Type</label>
                <select
                  value={filterJobType}
                  onChange={(e) => { setFilterJobType(e.target.value); setFilterCategory('All'); setIsGenerated(false) }}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
                >
                  <option value="All">All</option>
                  {jobTypeList.map((jt) => <option key={jt.id} value={jt.name}>{jt.name}</option>)}
                </select>
              </div>
            )}

            {/* Category filter - for incident-list (filtered by selected job type) */}
            {selectedReport === 'incident-list' && (
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
                >
                  <option value="All">All</option>
                  {(filterJobType === 'All'
                    ? categoryList
                    : (() => {
                        const jt = jobTypeList.find(j => j.name === filterJobType)
                        return jt ? categoryList.filter(c => c.jobTypeIds.includes(jt.id)) : categoryList
                      })()
                  ).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
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

            {/* Status filter — multi-select */}
            {selectedReport === 'incident-list' && (
              <div className="relative" ref={statusDropdownRef}>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Status</label>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(v => !v)}
                  className="w-full bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between gap-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <span className={filterStatuses.length === 0 ? 'text-gray-400' : 'text-white'}>
                    {filterStatuses.length === 0
                      ? 'All Statuses'
                      : filterStatuses.length === 1
                      ? filterStatuses[0]
                      : `${filterStatuses.length} selected`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {statusDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFilterStatuses([])}
                      className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-slate-700/60 text-left transition-colors"
                    >
                      Clear (All Statuses)
                    </button>
                    <div className="border-t border-slate-700" />
                    {STATUSES.map(s => {
                      const checked = filterStatuses.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFilterStatuses(prev =>
                            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                          )}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700/60 transition-colors"
                        >
                          <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CHIP[s] || 'text-gray-300 border-slate-500'}`}>
                            {s}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Column Picker — Incident List */}
          {selectedReport === 'incident-list' && (
            <div className="mt-5 pt-5 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">เลือกคอลัมน์</span>
                  <span className="text-xs text-gray-500">({selectedIncidentCols.length} / {INCIDENT_COLUMNS.length})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAllIncidentCols(true)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setAllIncidentCols(false)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Selected columns first — in selection order with number badge */}
                {selectedIncidentCols.map((key, idx) => {
                  const col = INCIDENT_COLUMNS.find(c => c.key === key)
                  if (!col) return null
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleIncidentCol(col.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                    >
                      <span className="w-4 h-4 rounded-sm bg-cyan-500 border-cyan-500 flex items-center justify-center shrink-0 text-white font-bold" style={{ fontSize: 9 }}>
                        {idx + 1}
                      </span>
                      {col.label}
                    </button>
                  )
                })}
                {/* Unselected columns — in default order */}
                {INCIDENT_COLUMNS.filter(col => !selectedIncidentCols.includes(col.key)).map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleIncidentCol(col.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all bg-slate-800 border-slate-600 text-gray-500 hover:border-slate-500 hover:text-gray-400"
                  >
                    <span className="w-4 h-4 rounded-sm border border-slate-500 flex items-center justify-center shrink-0" />
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
          {selectedReport === 'technician-detail' && techDetailData && (
            <TechnicianDetailCards data={techDetailData} />
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

// ==================== TECHNICIAN DETAIL CARDS ====================

function TechnicianDetailCards({ data }: { data: TechDetailData }) {
  const p = data.performance
  const gradeColor = !p ? 'text-gray-400' :
    p.overallScore >= 90 ? 'text-green-400' :
    p.overallScore >= 80 ? 'text-blue-400' :
    p.overallScore >= 70 ? 'text-yellow-400' :
    p.overallScore >= 60 ? 'text-orange-400' : 'text-red-400'

  const gradeRing = !p ? 'border-gray-500/30' :
    p.overallScore >= 90 ? 'border-green-500/50' :
    p.overallScore >= 80 ? 'border-blue-500/50' :
    p.overallScore >= 70 ? 'border-yellow-500/50' :
    p.overallScore >= 60 ? 'border-orange-500/50' : 'border-red-500/50'

  const MetricCard = ({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="glass-card p-4 rounded-xl border border-slate-700/50">
      <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Technician info + grade */}
      <div className="glass-card p-6 rounded-2xl border border-indigo-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{data.technician.name}</p>
                <p className="text-gray-400 text-xs">{data.technician.email}</p>
              </div>
            </div>
            {data.technician.technicianType && (
              <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30">
                {data.technician.technicianType}
              </span>
            )}
          </div>

          {p ? (
            <div className={`flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-2 ${gradeRing} bg-slate-800/60 shrink-0`}>
              <p className={`text-5xl font-black ${gradeColor}`}>{p.grade}</p>
              <p className={`text-lg font-bold ${gradeColor} mt-1`}>{p.overallScore.toFixed(1)}</p>
              <p className="text-gray-500 text-xs">{p.period}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-2 border-gray-700 bg-slate-800/60 shrink-0">
              <Award className="w-8 h-8 text-gray-600" />
              <p className="text-gray-500 text-xs mt-2">No performance data</p>
            </div>
          )}
        </div>

        {p && (
          <div className="mt-5">
            <p className="text-gray-500 text-xs mb-3">Performance Score Breakdown — {p.period}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              <MetricCard label="SLA Compliance" value={`${p.slaCompliance.toFixed(1)}%`} color={p.slaCompliance >= 95 ? 'text-green-400' : p.slaCompliance >= 80 ? 'text-yellow-400' : 'text-red-400'} />
              <MetricCard label="Work Volume" value={`${p.workVolume} jobs`} />
              <MetricCard label="Avg Resolution" value={`${p.avgResolutionTimeHrs.toFixed(1)} hrs`} color={p.avgResolutionTimeHrs <= 4 ? 'text-green-400' : p.avgResolutionTimeHrs <= 8 ? 'text-yellow-400' : 'text-red-400'} />
              <MetricCard label="Avg Response" value={`${p.avgResponseTimeMins.toFixed(0)} min`} color={p.avgResponseTimeMins <= 30 ? 'text-green-400' : p.avgResponseTimeMins <= 60 ? 'text-yellow-400' : 'text-red-400'} />
              <MetricCard label="First Time Fix" value={`${p.firstTimeFixRate.toFixed(1)}%`} color={p.firstTimeFixRate >= 85 ? 'text-green-400' : p.firstTimeFixRate >= 70 ? 'text-yellow-400' : 'text-red-400'} />
              <MetricCard label="Reopen Rate" value={`${p.reopenRate.toFixed(1)}%`} color={p.reopenRate <= 5 ? 'text-green-400' : p.reopenRate <= 10 ? 'text-yellow-400' : 'text-red-400'} />
              {p.avgCustomerRating != null && (
                <MetricCard label="Customer Rating" value={`★ ${p.avgCustomerRating.toFixed(1)}`} color={p.avgCustomerRating >= 4 ? 'text-yellow-400' : p.avgCustomerRating >= 3 ? 'text-orange-400' : 'text-red-400'} />
              )}
            </div>
            {p.ranking && p.totalTechnicians && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                <span className="text-indigo-400 font-semibold">Ranking: #{p.ranking}</span>
                <span>of {p.totalTechnicians} technicians</span>
                {p.bonusPoints > 0 && <span className="text-amber-400 ml-2">+{p.bonusPoints.toFixed(1)} bonus pts</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily activity summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-700/50">
          <p className="text-gray-400 text-xs font-medium mb-1">Active Days</p>
          <p className="text-2xl font-bold text-white">{data.dailyRows.filter(r => r.totalJobs > 0 || r.loginAt).length}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-green-500/30">
          <p className="text-gray-400 text-xs font-medium mb-1">Total Jobs</p>
          <p className="text-2xl font-bold text-green-400">{data.dailyRows.reduce((s, r) => s + r.totalJobs, 0)}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-blue-500/30">
          <p className="text-gray-400 text-xs font-medium mb-1">Resolved</p>
          <p className="text-2xl font-bold text-blue-400">{data.dailyRows.reduce((s, r) => s + r.resolved, 0)}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-emerald-500/30">
          <p className="text-gray-400 text-xs font-medium mb-1">Days Logged In</p>
          <p className="text-2xl font-bold text-emerald-400">{data.dailyRows.filter(r => r.loginAt).length}</p>
        </div>
      </div>
    </div>
  )
}
