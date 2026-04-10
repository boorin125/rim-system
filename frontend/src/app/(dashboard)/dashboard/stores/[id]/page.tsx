// app/(dashboard)/dashboard/stores/[id]/page.tsx - Store Detail Page
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Edit,
  ArrowLeft,
  Network,
  Globe,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wifi,
  Server,
  Monitor,
  Trash2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
  Copy,
  CheckCheck,
  ClipboardCheck,
  Wrench,
  ImageIcon,
  Upload,
  Download,
  X,
  ZoomIn,
} from 'lucide-react'
import axios from 'axios'
import { compressImage } from '@/utils/imageUtils'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import BackButton from '@/components/BackButton'
import { TimeInput } from '@/components/TimeInput'
import { canPerformAction, getUserRoles } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

type TabType = 'overview' | 'incidents' | 'statistics' | 'equipment' | 'layout'

interface Store {
  id: number
  storeCode: string
  name: string
  company?: string
  storeType?: string
  province?: string
  district?: string
  subDistrict?: string
  postalCode?: string
  address?: string
  area?: string
  serviceCenter?: string
  phone?: string
  email?: string
  storeStatus: string
  openDate?: string
  closeDate?: string
  // Operating Hours
  mondayOpen?: string
  mondayClose?: string
  tuesdayOpen?: string
  tuesdayClose?: string
  wednesdayOpen?: string
  wednesdayClose?: string
  thursdayOpen?: string
  thursdayClose?: string
  fridayOpen?: string
  fridayClose?: string
  saturdayOpen?: string
  saturdayClose?: string
  sundayOpen?: string
  sundayClose?: string
  holidayOpen?: string
  holidayClose?: string
  latitude?: number
  longitude?: number
  googleMapLink?: string
  // Network
  circuitId?: string
  routerIp?: string
  switchIp?: string
  accessPointIp?: string
  pcServerIp?: string
  pcPrinterIp?: string
  pmcComputerIp?: string
  sbsComputerIp?: string
  vatComputerIp?: string
  posIp?: string
  edcIp?: string
  scoIp?: string
  peopleCounterIp?: string
  digitalTvIp?: string
  timeAttendanceIp?: string
  cctvIp?: string
  notes?: string
  layoutImagePath?: string
  ipRangeImagePath?: string
  lastPmAt?: string
  createdAt: string
  updatedAt: string
  _count?: {
    incidents: number
    equipment: number
  }
}

interface Incident {
  id: string
  ticketNumber: string
  title: string
  description?: string
  status: string
  priority: string
  jobType?: string
  createdAt: string
  resolvedAt?: string
  closedAt?: string
  slaDeadline?: string
  slaDefenses?: { status: string }[]
  assignee?: {
    id: number
    firstName: string
    lastName: string
  }
  equipment?: {
    id: number
    name: string
    serialNumber: string
  }
}

interface IncidentsSummary {
  total: number
  open: number
  assigned: number
  inProgress: number
  resolved: number
  closed: number
  avgResolutionTime: number | null
  slaCompliance: number
}

interface EquipmentStat {
  name: string
  count: number
}

interface MonthlyStat {
  month: string
  label: string
  count: number
}

interface Equipment {
  id: number
  name: string
  serialNumber?: string
  category: string
  status: string
  brand?: string
  model?: string
}

interface TopIssue {
  category: string
  count: number
  percentage: number
}

export default function StoreDetailPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string

  const [store, setStore] = useState<Store | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent'>('soft')
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // PM Request state
  const [showPmModal, setShowPmModal] = useState(false)
  const [pmScheduledDate, setPmScheduledDate] = useState('')
  const [pmScheduledTime, setPmScheduledTime] = useState('09:00')
  const [isCreatingPm, setIsCreatingPm] = useState(false)
  const [pmOpenIncident, setPmOpenIncident] = useState<{
    id: string; ticketNumber: string; title: string; status: string
  } | null>(null)
  const [showPmOpenPopup, setShowPmOpenPopup] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'overview')

  // SLA configs map: priority → name
  const [slaNames, setSlaNames] = useState<Record<string, string>>({})

  // Incidents tab state
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentsLoading, setIncidentsLoading] = useState(false)
  const [incidentFilterOptions, setIncidentFilterOptions] = useState<{ statuses: string[]; priorities: string[] }>({ statuses: [], priorities: [] })
  const [incidentsPagination, setIncidentsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [incidentFilters, setIncidentFilters] = useState({
    status: '',
    priority: '',
    period: 30,
  })

  // Statistics tab state
  const [summary, setSummary] = useState<IncidentsSummary | null>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [topIssues, setTopIssues] = useState<TopIssue[]>([])
  const [equipmentStats, setEquipmentStats] = useState<EquipmentStat[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([])
  const [statisticsLoading, setStatisticsLoading] = useState(false)
  const [statisticsPeriod, setStatisticsPeriod] = useState(30)
  const [equipmentTabLoading, setEquipmentTabLoading] = useState(false)

  // Layout image state
  const [showLayoutLightbox, setShowLayoutLightbox] = useState(false)
  const [layoutUploading, setLayoutUploading] = useState(false)
  const [showIpRangeLightbox, setShowIpRangeLightbox] = useState(false)
  const [ipRangeUploading, setIpRangeUploading] = useState(false)

  useEffect(() => {
    // Get current user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setCurrentUser(JSON.parse(userStr))
    }

    if (id) {
      fetchStoreDetail()
    }

    // Fetch SLA configs for priority name mapping
    const token = localStorage.getItem('token')
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sla`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const map: Record<string, string> = {}
        ;(res.data || []).forEach((c: any) => { map[c.priority] = c.name })
        setSlaNames(map)
      })
      .catch(() => {})
  }, [id])

  // Fetch incidents when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'incidents' && id) {
      fetchIncidents()
    }
  }, [activeTab, id, incidentsPagination.page, incidentFilters])

  // Fetch filter options when tab becomes active or period changes
  useEffect(() => {
    if (activeTab === 'incidents' && id) {
      const token = localStorage.getItem('token')
      axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/incidents/filter-options?period=${incidentFilters.period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(res => setIncidentFilterOptions(res.data)).catch(() => {})
    }
  }, [activeTab, id, incidentFilters.period])

  // Fetch statistics when tab changes or period changes
  useEffect(() => {
    if (activeTab === 'statistics' && id) {
      fetchStatistics()
    }
  }, [activeTab, id, statisticsPeriod])

  // Fetch equipment when equipment tab is active
  useEffect(() => {
    if (activeTab === 'equipment' && id) {
      fetchEquipmentTab()
    }
  }, [activeTab, id])

  const fetchStoreDetail = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setStore(response.data)
    } catch (error: any) {
      toast.error('Failed to load store details')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchIncidents = async () => {
    try {
      setIncidentsLoading(true)
      const token = localStorage.getItem('token')

      const params = new URLSearchParams({
        page: incidentsPagination.page.toString(),
        limit: incidentsPagination.limit.toString(),
        period: incidentFilters.period.toString(),
      })

      if (incidentFilters.status) {
        params.append('status', incidentFilters.status)
      }
      if (incidentFilters.priority) {
        params.append('priority', incidentFilters.priority)
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/incidents?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setIncidents(response.data.data)
      setIncidentsPagination((prev) => ({
        ...prev,
        total: response.data.meta.total,
        totalPages: response.data.meta.totalPages,
      }))
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูล Incidents ได้')
      console.error(error)
    } finally {
      setIncidentsLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      setStatisticsLoading(true)
      const token = localStorage.getItem('token')

      const [summaryRes, equipmentRes, topIssuesRes, equipStatsRes, monthlyRes] = await Promise.all([
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/incidents/summary?period=${statisticsPeriod}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/equipment`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/top-issues?period=${statisticsPeriod}&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/incidents/equipment-stats?period=${statisticsPeriod}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/incidents/monthly-stats`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ])

      setSummary(summaryRes.data)
      setEquipment(equipmentRes.data.data || [])
      setTopIssues(topIssuesRes.data.topIssues || [])
      setEquipmentStats(equipStatsRes.data || [])
      setMonthlyStats(monthlyRes.data || [])
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลสถิติได้')
      console.error(error)
    } finally {
      setStatisticsLoading(false)
    }
  }

  const fetchEquipmentTab = async () => {
    try {
      setEquipmentTabLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/equipment`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setEquipment(response.data.data || [])
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้')
      console.error(error)
    } finally {
      setEquipmentTabLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle },
      INACTIVE: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle },
      TEMPORARILY_CLOSED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: AlertCircle },
      PERMANENTLY_CLOSED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle },
    }
    return badges[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: AlertCircle }
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      TEMPORARILY_CLOSED: 'Temporarily Closed',
      PERMANENTLY_CLOSED: 'Permanently Closed',
    }
    return labels[status] || status
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getIncidentStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      OPEN: { bg: 'bg-red-500/20', text: 'text-red-400' },
      ASSIGNED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      IN_PROGRESS: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      RESOLVED: { bg: 'bg-green-500/20', text: 'text-green-400' },
      CLOSED: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
      REOPENED: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    }
    return badges[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  }

  const getIncidentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      OPEN: 'เปิด',
      ASSIGNED: 'มอบหมายแล้ว',
      IN_PROGRESS: 'กำลังดำเนินการ',
      RESOLVED: 'แก้ไขแล้ว',
      CLOSED: 'ปิด',
      REOPENED: 'เปิดใหม่',
    }
    return labels[status] || status
  }

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400' },
      HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
      MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      LOW: { bg: 'bg-green-500/20', text: 'text-green-400' },
    }
    return badges[priority] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      CRITICAL: 'วิกฤต',
      HIGH: 'สูง',
      MEDIUM: 'ปานกลาง',
      LOW: 'ต่ำ',
    }
    return labels[priority] || priority
  }

  const getSLAStatus = (incident: Incident): { label: string; color: string; defended?: boolean } => {
    if (incident.jobType === 'Project') return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    if (incident.jobType === 'Adhoc') return { label: 'Achieved', color: 'text-green-400 bg-green-500/20' }
    if (!incident.slaDeadline) return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    const slaDeadline = new Date(incident.slaDeadline)
    const now = new Date()
    const hasApprovedDefense = incident.slaDefenses?.some((d) => d.status === 'APPROVED')
    if (incident.status === 'CLOSED' || incident.status === 'RESOLVED') {
      const completedAt = incident.resolvedAt
        ? new Date(incident.resolvedAt)
        : incident.closedAt
          ? new Date(incident.closedAt)
          : now
      if (completedAt <= slaDeadline) return { label: 'Achieved', color: 'text-green-400 bg-green-500/20' }
      if (hasApprovedDefense) return { label: 'Achieved', color: 'text-green-400 bg-green-500/20', defended: true }
      return { label: 'Failed', color: 'text-red-400 bg-red-500/20' }
    }
    if (incident.status === 'CANCELLED') return { label: 'N/A', color: 'text-gray-400 bg-gray-500/20' }
    if (now > slaDeadline) return { label: 'Breached', color: 'text-red-400 bg-red-500/20' }
    return { label: 'On Track', color: 'text-yellow-400 bg-yellow-500/20' }
  }

  const getEquipmentStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400' },
      INACTIVE: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
      MAINTENANCE: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      RETIRED: { bg: 'bg-red-500/20', text: 'text-red-400' },
    }
    return badges[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  }

  // Format operating hours - return 'ปิดทำการ' if no data
  const formatOperatingHours = (openTime?: string, closeTime?: string) => {
    if (!openTime || !closeTime) {
      return 'ปิดทำการ'
    }
    return `${openTime} - ${closeTime}`
  }

  // Soft Delete: Change status to PERMANENTLY_CLOSED (no approval needed)
  const handleSoftDelete = async () => {
    try {
      setIsDeleting(true)
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/soft-delete`,
        { reason: deleteReason },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('สาขาถูกเปลี่ยนสถานะเป็นปิดถาวรสำเร็จ')
      setShowDeleteModal(false)
      setDeleteReason('')
      setDeleteMode('soft')
      router.push('/dashboard/stores')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถเปลี่ยนสถานะสาขาได้')
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Permanent Delete: Request IT Manager approval
  const handleRequestPermanentDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการลบถาวร')
      return
    }

    try {
      setIsDeleting(true)
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/request-delete`,
        { reason: deleteReason },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('ส่งคำขอลบถาวรไปยัง IT Manager เรียบร้อยแล้ว')
      setShowDeleteModal(false)
      setDeleteReason('')
      setDeleteMode('soft')
      router.push('/dashboard/stores')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถส่งคำขอลบถาวรได้')
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle delete based on selected mode
  const handleDelete = () => {
    if (deleteMode === 'soft') {
      handleSoftDelete()
    } else {
      handleRequestPermanentDelete()
    }
  }

  // Request Preventive Maintenance
  const handleRequestPm = async () => {
    if (!store) return
    if (!pmScheduledDate || !pmScheduledTime) {
      toast.error('กรุณาระบุวันและเวลาที่กำหนด PM')
      return
    }
    try {
      setIsCreatingPm(true)
      const token = localStorage.getItem('token')

      // Hard-block: check if there is already an open PM for this store
      try {
        const pmCheckRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/pm/store-check/${store.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (pmCheckRes.data?.openPmIncident) {
          setPmOpenIncident(pmCheckRes.data.openPmIncident)
          setShowPmModal(false)
          setShowPmOpenPopup(true)
          setIsCreatingPm(false)
          return
        }
      } catch {
        // If check fails, proceed
      }

      const scheduledAt = new Date(`${pmScheduledDate}T${pmScheduledTime}:00`).toISOString()
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents`,
        {
          title: `Preventive Maintenance Store ${store.storeCode} ${store.name}`,
          description: 'Preventive Maintenance ตามแผนประจำปี',
          category: 'PM',
          jobType: 'Preventive Maintenance',
          priority: 'LOW',
          storeId: store.id,
          scheduledAt,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('สร้าง PM Request สำเร็จ ระบบแจ้ง Supervisor แล้ว')
      setShowPmModal(false)
      setPmScheduledDate('')
      setPmScheduledTime('09:00')
      router.push(`/dashboard/incidents/${response.data.id}`)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsCreatingPm(false)
    }
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('คัดลอกแล้ว')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleLayoutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setLayoutUploading(true)
      const token = localStorage.getItem('token')
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 })
      const formData = new FormData()
      formData.append('file', compressed)
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/layout-image`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } },
      )
      toast.success('อัปโหลด Layout Image สำเร็จ')
      fetchStoreDetail()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setLayoutUploading(false)
      e.target.value = ''
    }
  }

  const handleLayoutDownload = () => {
    if (!store?.layoutImagePath) return
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''
    const url = `${apiBase}${store.layoutImagePath}`
    const a = document.createElement('a')
    a.href = url
    a.download = `layout-${store.storeCode}.jpg`
    a.click()
  }

  const handleIpRangeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Compress and convert (handles iOS HEIC/HEIF → JPEG)
    const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 })
    const formData = new FormData()
    formData.append('file', compressed)
    try {
      setIpRangeUploading(true)
      const token = localStorage.getItem('token')
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${id}/ip-range-image`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } },
      )
      toast.success('อัปโหลด IP Range Image สำเร็จ')
      fetchStoreDetail()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setIpRangeUploading(false)
      e.target.value = ''
    }
  }

  const handleIpRangeDownload = () => {
    if (!store?.ipRangeImagePath) return
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''
    const url = `${apiBase}${store.ipRangeImagePath}`
    const a = document.createElement('a')
    a.href = url
    a.download = `iprange-${store.storeCode}.jpg`
    a.click()
  }

  // Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const currentDayIndex = new Date().getDay()

  // Map day index to day name
  const dayIndexMap: { [key: string]: number } = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
    'Holiday': -1, // Holiday is special, not based on day
  }

  // Operating hours data
  const operatingHoursData = store ? [
    { day: 'วันจันทร์', dayEn: 'Monday', open: store.mondayOpen, close: store.mondayClose },
    { day: 'วันอังคาร', dayEn: 'Tuesday', open: store.tuesdayOpen, close: store.tuesdayClose },
    { day: 'วันพุธ', dayEn: 'Wednesday', open: store.wednesdayOpen, close: store.wednesdayClose },
    { day: 'วันพฤหัสบดี', dayEn: 'Thursday', open: store.thursdayOpen, close: store.thursdayClose },
    { day: 'วันศุกร์', dayEn: 'Friday', open: store.fridayOpen, close: store.fridayClose },
    { day: 'วันเสาร์', dayEn: 'Saturday', open: store.saturdayOpen, close: store.saturdayClose },
    { day: 'วันอาทิตย์', dayEn: 'Sunday', open: store.sundayOpen, close: store.sundayClose },
    { day: 'วันหยุดนักขัตฤกษ์', dayEn: 'Holiday', open: store.holidayOpen, close: store.holidayClose },
  ] : []

  // Check if a day is today
  const isToday = (dayEn: string) => {
    return dayIndexMap[dayEn] === currentDayIndex
  }

  // Check if store has any network info
  const hasNetworkInfo = store && (
    store.circuitId || store.routerIp || store.switchIp || store.accessPointIp ||
    store.pcServerIp || store.pcPrinterIp || store.pmcComputerIp || store.sbsComputerIp ||
    store.vatComputerIp || store.posIp || store.edcIp || store.scoIp ||
    store.peopleCounterIp || store.digitalTvIp || store.timeAttendanceIp || store.cctvIp
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading store details...</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-xl font-semibold text-white mb-2">Store not found</h3>
          <button
            onClick={() => router.push('/dashboard/stores')}
            className="mt-4 px-6 py-2 hover:brightness-110 text-white rounded-lg transition-colors"
            style={{ backgroundColor: themeHighlight }}
          >
            Back to Stores
          </button>
        </div>
      </div>
    )
  }

  const canEdit = canPerformAction(currentUser, '/dashboard/stores', 'edit')
  const canDelete = canPerformAction(currentUser, '/dashboard/stores', 'delete')
  const pmAllowedRoles = ['HELP_DESK', 'SUPERVISOR', 'IT_MANAGER', 'SUPER_ADMIN']
  const userRoles = getUserRoles(currentUser)
  const canRequestPm = pmAllowedRoles.some((r) => userRoles.includes(r as any))
  const statusInfo = getStatusBadge(store.storeStatus)
  const StatusIcon = statusInfo.icon

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <BackButton href="/dashboard/stores" label="กลับไปหน้า Stores" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              <span className="text-blue-400">{store.storeCode}</span>
              {' '}{store.name}
            </h1>
            <span
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs sm:text-sm font-semibold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {getStatusLabel(store.storeStatus)}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {store.company && <span>{store.company}</span>}
            {store.company && store.storeType && <span className="mx-2">•</span>}
            {store.storeType && <span>{store.storeType}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canRequestPm && (
            <button
              onClick={() => setShowPmModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
            >
              <Wrench className="w-4 h-4" />
              <span>Request PM</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => router.push(`/dashboard/stores/${store.id}/edit`)}
              className="flex items-center gap-2 px-3 py-2 hover:brightness-110 text-white rounded-lg transition-colors text-sm"
              style={{ backgroundColor: themeHighlight }}
            >
              <Edit className="w-4 h-4" />
              <span>Edit Store</span>
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Store</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700/50 overflow-x-auto scrollbar-hide">
        <nav className="flex gap-4 min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            ภาพรวม
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'incidents'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Incidents
            {store._count && store._count.incidents > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
                {store._count.incidents}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'statistics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            สถิติ
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'equipment'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <Monitor className="w-4 h-4 inline mr-2" />
            อุปกรณ์
            {store._count && store._count.equipment > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                {store._count.equipment}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'layout'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <ImageIcon className="w-4 h-4 inline mr-2" />
            Layout
            {(store.layoutImagePath || store.ipRangeImagePath) && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                {[store.layoutImagePath, store.ipRangeImagePath].filter(Boolean).length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
      {/* Main Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-400" />
            Contact Information
          </h2>
          <div className="space-y-3">
            {store.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Phone</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white">{store.phone}</p>
                    <button
                      onClick={() => handleCopy(store.phone!, 'phone')}
                      className="p-1 text-gray-500 hover:text-white transition-colors"
                      title="คัดลอก"
                    >
                      {copiedField === 'phone' ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {store.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white">{store.email}</p>
                    <button
                      onClick={() => handleCopy(store.email!, 'email')}
                      className="p-1 text-gray-500 hover:text-white transition-colors"
                      title="คัดลอก"
                    >
                      {copiedField === 'email' ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {store.area && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-400">Area</p>
                  <p className="text-white">{store.area}</p>
                </div>
              </div>
            )}
            {store.serviceCenter && (
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-400">Service Center</p>
                  <p className="text-white">{store.serviceCenter}</p>
                </div>
              </div>
            )}
            {!store.phone && !store.email && !store.area && !store.serviceCenter && (
              <p className="text-gray-500 text-sm">No contact information available</p>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Location
          </h2>
          <div className="space-y-3">
            {store.address && (
              <div>
                <p className="text-sm text-gray-400">Address</p>
                <div className="flex items-start gap-2">
                  <p className="text-white flex-1">{store.address}</p>
                  <button
                    onClick={() => handleCopy(store.address!, 'address')}
                    className="p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                    title="คัดลอก"
                  >
                    {copiedField === 'address' ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {store.subDistrict && (
                <div>
                  <p className="text-sm text-gray-400">Sub-district</p>
                  <p className="text-white">{store.subDistrict}</p>
                </div>
              )}
              {store.district && (
                <div>
                  <p className="text-sm text-gray-400">District</p>
                  <p className="text-white">{store.district}</p>
                </div>
              )}
              {store.province && (
                <div>
                  <p className="text-sm text-gray-400">Province</p>
                  <p className="text-white">{store.province}</p>
                </div>
              )}
              {store.postalCode && (
                <div>
                  <p className="text-sm text-gray-400">Postal Code</p>
                  <p className="text-white">{store.postalCode}</p>
                </div>
              )}
            </div>
            {(store.latitude && store.longitude) || store.googleMapLink ? (
              <div className="pt-3 border-t border-gray-700/50">
                <a
                  href={store.googleMapLink || `https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  View on Google Maps
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {/* Operating Hours & Important Dates - Combined Card */}
        <div className="glass-card p-6 rounded-2xl lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Operating Hours & Important Dates
          </h2>

          <div className="space-y-4">
            {/* Operating Hours - Single Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">เวลาทำการ</h3>
              <div className="space-y-2">
                {operatingHoursData.map((item) => {
                  const hours = formatOperatingHours(item.open, item.close)
                  const isClosed = hours === 'ปิดทำการ'
                  const isTodayItem = isToday(item.dayEn)

                  return (
                    <div
                      key={item.dayEn}
                      className={`inline-flex items-center gap-4 px-4 py-2 rounded-lg transition-all ${
                        isTodayItem
                          ? 'bg-blue-500/20 border-2 border-blue-500 ring-2 ring-blue-500/30'
                          : isClosed
                            ? 'bg-red-500/10 border border-red-500/20'
                            : 'bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isTodayItem && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                        )}
                        <span className={`${isTodayItem ? 'text-blue-300 font-semibold' : 'text-gray-300'}`}>
                          {item.day}
                          {isTodayItem && <span className="ml-1 text-xs text-blue-400">(วันนี้)</span>}
                        </span>
                      </div>
                      <span className={`font-medium ${
                        isTodayItem
                          ? isClosed ? 'text-red-400' : 'text-blue-300'
                          : isClosed ? 'text-red-400' : 'text-white'
                      }`}>
                        {hours}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Important Dates - Below Operating Hours */}
            <div className="pt-4 border-t border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-3">วันที่สำคัญ</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-400">วันเปิดทำการ</span>
                  </div>
                  <p className="text-white font-medium">
                    {store.openDate ? formatDate(store.openDate) : 'ไม่ระบุ'}
                  </p>
                </div>
                {store.closeDate && (
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-gray-400">วันปิดทำการ</span>
                    </div>
                    <p className="text-white font-medium">{formatDate(store.closeDate)}</p>
                  </div>
                )}
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-400">PM ล่าสุด</span>
                  </div>
                  <p className={`font-medium ${store.lastPmAt ? 'text-white' : 'text-gray-500'}`}>
                    {store.lastPmAt ? formatDate(store.lastPmAt) : 'ยังไม่เคย PM'}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-400">อัปเดตล่าสุด</span>
                  </div>
                  <p className="text-white font-medium">{formatDate(store.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Notes */}
      {store.notes && (
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            Notes
          </h2>
          <p className="text-gray-300 whitespace-pre-wrap">{store.notes}</p>
        </div>
      )}
        </>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">ตัวกรอง:</span>
              </div>
              <select
                value={incidentFilters.status}
                onChange={(e) => {
                  setIncidentFilters((prev) => ({ ...prev, status: e.target.value }))
                  setIncidentsPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                {incidentFilterOptions.statuses.map((s) => (
                  <option key={s} value={s}>{getIncidentStatusLabel(s)}</option>
                ))}
              </select>
              <select
                value={incidentFilters.priority}
                onChange={(e) => {
                  setIncidentFilters((prev) => ({ ...prev, priority: e.target.value }))
                  setIncidentsPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Priority</option>
                {incidentFilterOptions.priorities.map((p) => (
                  <option key={p} value={p}>{slaNames[p] || getPriorityLabel(p)}</option>
                ))}
              </select>
              <select
                value={incidentFilters.period}
                onChange={(e) => {
                  setIncidentFilters((prev) => ({ ...prev, period: parseInt(e.target.value) }))
                  setIncidentsPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 วันล่าสุด</option>
                <option value={30}>30 วันล่าสุด</option>
                <option value={90}>90 วันล่าสุด</option>
                <option value={365}>1 ปี</option>
              </select>
            </div>
          </div>

          {/* Incidents List */}
          <div className="glass-card rounded-2xl overflow-hidden">
            {incidentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner mr-3"></div>
                <span className="text-gray-400">กำลังโหลด...</span>
              </div>
            ) : incidents.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400">ไม่พบ Incident ในช่วงเวลาที่เลือก</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Incident No.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Technician</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Created Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {incidents.map((incident) => {
                        const statusBadge = getIncidentStatusBadge(incident.status)
                        const slaStatus = getSLAStatus(incident)
                        return (
                          <tr key={incident.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-blue-400 font-mono text-sm">{incident.ticketNumber}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-white font-medium">{incident.title}</p>
                                {incident.equipment && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {incident.equipment.name}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${statusBadge.bg} ${statusBadge.text}`}>
                                {getIncidentStatusLabel(incident.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${slaStatus.color}`}>
                                {slaStatus.defended && <span className="mr-1">🛡</span>}
                                {slaStatus.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {incident.assignee
                                ? `${incident.assignee.firstName} ${incident.assignee.lastName}`
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {formatDateTime(incident.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {incidentsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
                    <p className="text-sm text-gray-400">
                      แสดง {(incidentsPagination.page - 1) * incidentsPagination.limit + 1} -{' '}
                      {Math.min(incidentsPagination.page * incidentsPagination.limit, incidentsPagination.total)} จาก{' '}
                      {incidentsPagination.total} รายการ
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setIncidentsPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                        }
                        disabled={incidentsPagination.page === 1}
                        className="p-2 hover:bg-gray-700/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                      </button>
                      <span className="text-sm text-gray-300">
                        หน้า {incidentsPagination.page} / {incidentsPagination.totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setIncidentsPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                        }
                        disabled={incidentsPagination.page === incidentsPagination.totalPages}
                        className="p-2 hover:bg-gray-700/50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {/* Period Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">ช่วงเวลา:</span>
            <select
              value={statisticsPeriod}
              onChange={(e) => setStatisticsPeriod(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 วันล่าสุด</option>
              <option value={30}>30 วันล่าสุด</option>
              <option value={90}>90 วันล่าสุด</option>
              <option value={365}>1 ปี</option>
            </select>
          </div>

          {statisticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner mr-3"></div>
              <span className="text-gray-400">กำลังโหลดสถิติ...</span>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="glass-card p-3 sm:p-4 rounded-xl">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">ทั้งหมด</p>
                    <p className="text-xl sm:text-2xl font-bold text-white">{summary.total}</p>
                  </div>
                  <div className="glass-card p-3 sm:p-4 rounded-xl">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">รอดำเนิน</p>
                    <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                      {summary.open + summary.assigned + summary.inProgress}
                    </p>
                  </div>
                  <div className="glass-card p-3 sm:p-4 rounded-xl">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">แก้ไขแล้ว</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-400">
                      {summary.resolved + summary.closed}
                    </p>
                  </div>
                </div>
              )}

              {/* Bar Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly incidents chart */}
                <div className="glass-card p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    จำนวนงานรายเดือน
                  </h3>
                  {monthlyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthlyStats} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                          labelStyle={{ color: '#f1f5f9' }}
                          itemStyle={{ color: '#60a5fa' }}
                          formatter={(v: any) => [v, 'งาน']}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="count" position="top" style={{ fill: '#94a3b8', fontSize: 11 }} formatter={(v: number) => v > 0 ? v : ''} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-12">ไม่มีข้อมูล</p>
                  )}
                </div>

                {/* Equipment incidents chart */}
                <div className="glass-card p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-blue-400" />
                    อุปกรณ์ที่มีการแจ้งงานสูงสุด
                  </h3>
                  {equipmentStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={equipmentStats} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                          labelStyle={{ color: '#f1f5f9' }}
                          itemStyle={{ color: '#a78bfa' }}
                          formatter={(v: any) => [v, 'งาน']}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-12">ไม่มีข้อมูล (ไม่มีงานที่ระบุอุปกรณ์)</p>
                  )}
                </div>
              </div>

              {/* Top Issues */}
              {topIssues.length > 0 && (
                <div className="glass-card p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    ปัญหาที่พบบ่อย
                  </h3>
                  <div className="space-y-4">
                    {topIssues.map((issue, index) => (
                      <div key={`${issue.category}-${index}`} className="flex items-center gap-4">
                        <span className="text-sm text-gray-400 w-6">{index + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white">{issue.category}</span>
                            <span className="text-sm text-gray-400">
                              {issue.count} รายการ ({issue.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${issue.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-400" />
              อุปกรณ์ในสาขา
            </h2>
            <button
              onClick={() => router.push(`/dashboard/equipment?storeId=${store.id}`)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              จัดการอุปกรณ์
            </button>
          </div>

          {equipmentTabLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : equipment.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl text-center">
              <Monitor className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">ไม่มีอุปกรณ์ในสาขานี้</p>
              <button
                onClick={() => router.push(`/dashboard/equipment?storeId=${store.id}`)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                เพิ่มอุปกรณ์
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment.map((item) => {
                const statusBadge = getEquipmentStatusBadge(item.status)
                return (
                  <div
                    key={item.id}
                    className="glass-card p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/equipment/${item.id}?from=store&storeId=${store.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-white font-medium truncate pr-2">{item.name}</p>
                      <span className={`px-2 py-0.5 text-xs rounded flex-shrink-0 ${statusBadge.bg} ${statusBadge.text}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{item.category}</p>
                    {item.brand && <p className="text-xs text-gray-500 mt-1">{item.brand}{item.model ? ` / ${item.model}` : ''}</p>}
                    {item.serialNumber && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">SN: {item.serialNumber}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Layout Image Tab */}
      {activeTab === 'layout' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-400" />
            รูปภาพสาขา
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Layout Image ── */}
            <div className="glass-card p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  Layout พื้นที่สาขา
                </p>
                {canEdit && (
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${layoutUploading ? 'opacity-50 cursor-not-allowed bg-slate-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    <Upload className="w-3.5 h-3.5" />
                    {layoutUploading ? 'กำลังอัปโหลด...' : store.layoutImagePath ? 'อัปเดต' : 'อัปโหลด'}
                    <input type="file" accept="image/*" className="hidden" disabled={layoutUploading} onChange={handleLayoutUpload} />
                  </label>
                )}
              </div>

              {store.layoutImagePath ? (
                <>
                  <div
                    className="relative group cursor-pointer overflow-hidden rounded-xl bg-slate-900/60"
                    onClick={() => setShowLayoutLightbox(true)}
                  >
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${store.layoutImagePath}`}
                      alt={`Layout ${store.storeCode}`}
                      className="w-full max-h-[320px] object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-3">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowLayoutLightbox(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-colors">
                      <ZoomIn className="w-3.5 h-3.5" /> ดูขนาดเต็ม
                    </button>
                    <button onClick={handleLayoutDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-xs transition-colors">
                      <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่มีรูป Layout</p>
                </div>
              )}
            </div>

            {/* ── IP Range Image ── */}
            <div className="glass-card p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-400" />
                  IP Range
                </p>
                {canEdit && (
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${ipRangeUploading ? 'opacity-50 cursor-not-allowed bg-slate-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    <Upload className="w-3.5 h-3.5" />
                    {ipRangeUploading ? 'กำลังอัปโหลด...' : store.ipRangeImagePath ? 'อัปเดต' : 'อัปโหลด'}
                    <input type="file" accept="image/*" className="hidden" disabled={ipRangeUploading} onChange={handleIpRangeUpload} />
                  </label>
                )}
              </div>

              {store.ipRangeImagePath ? (
                <>
                  <div
                    className="relative group cursor-pointer overflow-hidden rounded-xl bg-slate-900/60"
                    onClick={() => setShowIpRangeLightbox(true)}
                  >
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${store.ipRangeImagePath}`}
                      alt={`IP Range ${store.storeCode}`}
                      className="w-full max-h-[320px] object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-3">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowIpRangeLightbox(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-colors">
                      <ZoomIn className="w-3.5 h-3.5" /> ดูขนาดเต็ม
                    </button>
                    <button onClick={handleIpRangeDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-xs transition-colors">
                      <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <Network className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่มีรูป IP Range</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Layout Lightbox */}
      {showLayoutLightbox && store.layoutImagePath && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowLayoutLightbox(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowLayoutLightbox(false)} className="absolute -top-12 right-0 p-2 text-gray-300 hover:text-white transition-colors">
              <X className="w-7 h-7" />
            </button>
            <button onClick={handleLayoutDownload} className="absolute -top-12 right-12 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> ดาวน์โหลด
            </button>
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${store.layoutImagePath}`}
              alt={`Layout ${store.storeCode}`}
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
            <p className="text-center text-gray-400 text-sm mt-3">Layout — {store.storeCode} {store.name}</p>
          </div>
        </div>
      )}

      {/* IP Range Lightbox */}
      {showIpRangeLightbox && store.ipRangeImagePath && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowIpRangeLightbox(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowIpRangeLightbox(false)} className="absolute -top-12 right-0 p-2 text-gray-300 hover:text-white transition-colors">
              <X className="w-7 h-7" />
            </button>
            <button onClick={handleIpRangeDownload} className="absolute -top-12 right-12 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> ดาวน์โหลด
            </button>
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${store.ipRangeImagePath}`}
              alt={`IP Range ${store.storeCode}`}
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
            <p className="text-center text-gray-400 text-sm mt-3">IP Range — {store.storeCode} {store.name}</p>
          </div>
        </div>
      )}

      {/* PM Request Modal */}
      {showPmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Wrench className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Request Preventive Maintenance</h3>
                <p className="text-sm text-gray-400">{store.storeCode} — {store.name}</p>
              </div>
            </div>

            {store.lastPmAt && (
              <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-sm text-purple-300">
                  <ClipboardCheck className="w-4 h-4 inline mr-1" />
                  PM ล่าสุด: {formatDate(store.lastPmAt)}
                </p>
              </div>
            )}

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  วันที่กำหนด PM <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={pmScheduledDate}
                  onChange={(e) => setPmScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">เวลา</label>
                <TimeInput
                  value={pmScheduledTime}
                  onChange={setPmScheduledTime}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus-within:border-purple-500"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-5">
              ระบบจะสร้าง Incident (Preventive Maintenance) และแจ้ง Supervisor โดยอัตโนมัติ
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowPmModal(false); setPmScheduledDate(''); setPmScheduledTime('09:00') }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
                disabled={isCreatingPm}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRequestPm}
                disabled={isCreatingPm || !pmScheduledDate}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isCreatingPm ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                {isCreatingPm ? 'กำลังสร้าง...' : 'Confirm PM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PM — Open Incident Blocking Popup */}
      {showPmOpenPopup && pmOpenIncident && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">มีงาน PM ค้างอยู่</h3>
                <p className="text-sm text-gray-400">ไม่สามารถเปิด PM ใหม่ได้</p>
              </div>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-xl mb-5 space-y-2">
              <p className="text-sm text-gray-300">สาขานี้มีงาน PM ที่ยังเปิดค้างอยู่:</p>
              <button
                type="button"
                onClick={() => { setShowPmOpenPopup(false); router.push(`/dashboard/incidents/${pmOpenIncident.id}`) }}
                className="text-left w-full group"
              >
                <p className="text-base font-bold text-blue-400 group-hover:text-blue-300 transition underline underline-offset-2">
                  {pmOpenIncident.ticketNumber}
                </p>
                <p className="text-sm text-gray-300 mt-1">{pmOpenIncident.title}</p>
                <p className="text-xs text-gray-500 mt-1">สถานะ: {pmOpenIncident.status}</p>
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              กรุณาปิดงาน PM ข้างต้นก่อน จึงจะสามารถเปิดคำขอ PM ใหม่สำหรับสาขานี้ได้
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowPmOpenPopup(false); router.push(`/dashboard/incidents/${pmOpenIncident.id}`) }}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                ไปที่งาน PM เดิม
              </button>
              <button
                type="button"
                onClick={() => setShowPmOpenPopup(false)}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg font-medium transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="glass-card p-6 rounded-2xl max-w-lg w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  ลบสาขา
                </h3>
                <p className="text-sm text-gray-400">
                  เลือกรูปแบบการลบสาขาที่ต้องการ
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Store Details */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ข้อมูลสาขา
                </label>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-white font-semibold">{store.name}</p>
                  <p className="text-sm text-gray-400">รหัส: {store.storeCode}</p>
                </div>
              </div>

              {/* Delete Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  รูปแบบการลบ
                </label>
                <div className="space-y-3">
                  {/* Soft Delete Option */}
                  <label
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      deleteMode === 'soft'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteMode"
                      value="soft"
                      checked={deleteMode === 'soft'}
                      onChange={() => setDeleteMode('soft')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium">ปิดสาขาถาวร (Soft Delete)</p>
                      <p className="text-sm text-gray-400 mt-1">
                        เปลี่ยนสถานะเป็น "ปิดถาวร" - ข้อมูลยังคงอยู่ในระบบ สามารถเรียกดูประวัติได้
                      </p>
                      <p className="text-xs text-green-400 mt-2">
                        ✓ ไม่ต้องรออนุมัติ - ดำเนินการได้ทันที
                      </p>
                    </div>
                  </label>

                  {/* Permanent Delete Option */}
                  <label
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      deleteMode === 'permanent'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteMode"
                      value="permanent"
                      checked={deleteMode === 'permanent'}
                      onChange={() => setDeleteMode('permanent')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium">ลบถาวร (Permanent Delete)</p>
                      <p className="text-sm text-gray-400 mt-1">
                        ลบข้อมูลสาขาออกจากระบบทั้งหมด - ไม่สามารถกู้คืนได้
                      </p>
                      <p className="text-xs text-yellow-400 mt-2">
                        ⚠ ต้องรออนุมัติจาก IT Manager
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Reason (required for permanent delete) */}
              {deleteMode === 'permanent' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    เหตุผลในการลบถาวร <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="กรุณาระบุเหตุผลที่ต้องการลบข้อมูลสาขานี้ออกจากระบบถาวร..."
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Warning Message */}
              <div className={`p-3 rounded-lg border ${
                deleteMode === 'soft'
                  ? 'bg-orange-500/10 border-orange-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <p className={`text-sm ${deleteMode === 'soft' ? 'text-orange-400' : 'text-red-400'}`}>
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {deleteMode === 'soft'
                    ? 'สาขาจะถูกเปลี่ยนสถานะเป็น "ปิดถาวร" และจะไม่แสดงในรายการสาขาที่เปิดใช้งาน'
                    : 'การลบถาวรจะลบข้อมูลสาขาทั้งหมดออกจากระบบ รวมถึง Incident และ Equipment ที่เกี่ยวข้อง'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteReason('')
                  setDeleteMode('soft')
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting || (deleteMode === 'permanent' && !deleteReason.trim())}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  deleteMode === 'soft'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeleting
                  ? 'กำลังดำเนินการ...'
                  : deleteMode === 'soft'
                    ? 'ปิดสาขาถาวร'
                    : 'ส่งคำขอลบถาวร'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
