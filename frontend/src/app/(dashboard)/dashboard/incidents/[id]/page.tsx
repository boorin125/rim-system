// app/(dashboard)/dashboard/incidents/[id]/page.tsx - View Incident Detail (UPDATED WITH TECHNICIAN WORKFLOW)
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  X,
  Clock,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Tag,
  UserPlus,
  Camera,
  CheckCircle,
  Edit3,
  MapPin,
  ExternalLink,
  Phone,
  Monitor,
  Briefcase,
  MessageSquare,
  FileText,
  Download,
  Mail,
  Image,
  ChevronDown,
  AlertTriangle,
  Shield,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { formatDateTime, formatDateTimeThai } from '@/utils/dateUtils'
import AssignIncidentModal from '@/components/AssignIncidentModal'
import ReassignmentModal from '@/components/ReassignmentModal'
import ReassignmentHistory from '@/components/ReassignmentHistory'
// ✅ STEP 1: เพิ่ม imports สำหรับ workflow modals
import ResponseModal from '@/components/ResponseModal'
import CheckInModal from '@/components/CheckInModal'
import ResolveIncidentModal from '@/components/ResolveIncidentModal'
import UpdateResolveModal from '@/components/UpdateResolveModal'
import ConfirmCloseModal from '@/components/ConfirmCloseModal'
import ReopenIncidentModal from '@/components/ReopenIncidentModal'
import AddBeforePhotosModal from '@/components/AddBeforePhotosModal'
import CommentSection from '@/components/CommentSection'
import IncidentTimeline from '@/components/IncidentTimeline'
import PhotoViewerModal from '@/components/PhotoViewerModal'
import { getPhotoUrl } from '@/utils/photoUtils'
import { generateServiceReportPDF, ServiceReportData } from '@/utils/serviceReportPdf'
import TechConfirmModal from '@/components/TechConfirmModal'
import PmChecklistSection from '@/components/PmChecklistSection'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

export default function IncidentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const themeHighlight = useThemeHighlight()
  const [incident, setIncident] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignMode, setAssignMode] = useState<'assign' | 'reassign'>('assign')
  const [showReassignmentModal, setShowReassignmentModal] = useState(false)
  
  // ✅ STEP 2: เพิ่ม states สำหรับ workflow modals
  const [showResponse, setShowResponse] = useState(false)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAddBeforePhotos, setShowAddBeforePhotos] = useState(false)
  const [showTechConfirm, setShowTechConfirm] = useState(false)
  const [isTechConfirming, setIsTechConfirming] = useState(false)
  const [isGeneratingBlankPdf, setIsGeneratingBlankPdf] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [showSrMenu, setShowSrMenu] = useState(false)
  const srMenuRef = useRef<HTMLDivElement>(null)
  const [showReopen, setShowReopen] = useState(false)
  const [showDirectClose, setShowDirectClose] = useState(false)


  // Photo Viewer state
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([])
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  const [photoViewerTitle, setPhotoViewerTitle] = useState('')

  // Helper to open photo viewer
  const openPhotoViewer = (photos: string[], index: number, title: string) => {
    setPhotoViewerPhotos(photos)
    setPhotoViewerIndex(index)
    setPhotoViewerTitle(title)
    setShowPhotoViewer(true)
  }
  const [technicians, setTechnicians] = useState<any[]>([])
  const [slaConfigs, setSlaConfigs] = useState<any[]>([])
  const [slaDefense, setSlaDefense] = useState<any>(null)
  const [showSlaDefenseModal, setShowSlaDefenseModal] = useState(false)
  const [slaDefenseReason, setSlaDefenseReason] = useState('')
  const [isSubmittingDefense, setIsSubmittingDefense] = useState(false)
  const [showRevokeModal, setShowRevokeModal] = useState(false)
  const [revokeNote, setRevokeNote] = useState('')
  const [isRevoking, setIsRevoking] = useState(false)
  const [showApproveFromRejectModal, setShowApproveFromRejectModal] = useState(false)
  const [approveFromRejectNote, setApproveFromRejectNote] = useState('')
  const [isApprovingFromReject, setIsApprovingFromReject] = useState(false)
  const [kbArticles, setKbArticles] = useState<any[]>([])
  const [kbLoading, setKbLoading] = useState(false)
  const [selectedKbArticle, setSelectedKbArticle] = useState<any>(null)
  const [showKbArticleModal, setShowKbArticleModal] = useState(false)

  useEffect(() => {
    // Get current user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setCurrentUser(JSON.parse(userStr))
    }

    if (params.id) {
      fetchIncident()
    }

    // Fetch technicians for reopen modal
    fetchTechnicians()
    // Fetch SLA configs for priority display
    fetchSlaConfigs()
  }, [params.id])

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users?role=TECHNICIAN`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setTechnicians(
        response.data.map((user: any) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        }))
      )
    } catch (error) {
      console.error('Failed to fetch technicians:', error)
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

  // Close SR dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (srMenuRef.current && !srMenuRef.current.contains(e.target as Node)) {
        setShowSrMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  // Fetch KB articles when incident loads
  useEffect(() => {
    if (incident?.category) {
      fetchKbArticles(incident.category, incident.title || '')
    }
  }, [incident?.id, incident?.category])

  const fetchIncident = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setIncident(response.data)

      // Fetch SLA defense status for CLOSED incidents
      if (response.data.status === 'CLOSED') {
        try {
          const defenseRes = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/sla-defense`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          setSlaDefense(defenseRes.data)
        } catch {
          // ignore
        }
      }
    } catch (error: any) {
      toast.error('Failed to load incident')
      console.error(error)
      router.push('/dashboard/incidents')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchKbArticles = async (category: string, title: string) => {
    try {
      setKbLoading(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({ category })
      if (title) params.set('keywords', title)
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/suggested?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setKbArticles(Array.isArray(res.data) ? res.data : res.data?.articles || [])
    } catch {
      // silently fail — KB is optional context
    } finally {
      setKbLoading(false)
    }
  }

  const openKbArticle = async (articleId: number) => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${articleId}?incrementView=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedKbArticle(res.data)
      setShowKbArticleModal(true)
    } catch {
      toast.error('ไม่สามารถโหลดบทความได้')
    }
  }

  const handleSubmitSlaDefense = async () => {
    if (!slaDefenseReason.trim()) {
      toast.error('กรุณากรอกเหตุผล')
      return
    }
    try {
      setIsSubmittingDefense(true)
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/sla-defense`,
        { reason: slaDefenseReason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ส่งคำขอ Defend SLA แล้ว')
      setShowSlaDefenseModal(false)
      setSlaDefenseReason('')
      // Refresh defense status
      const defenseRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/sla-defense`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSlaDefense(defenseRes.data)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถส่งคำขอได้')
    } finally {
      setIsSubmittingDefense(false)
    }
  }

  const handleRevokeSlaDefense = async () => {
    if (!revokeNote.trim()) {
      toast.error('กรุณากรอกเหตุผลการยกเลิก')
      return
    }
    try {
      setIsRevoking(true)
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/sla-defenses/${slaDefense.defense.id}/reject`,
        { note: revokeNote },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ยกเลิกการอนุมัติ SLA Defense แล้ว')
      setShowRevokeModal(false)
      setRevokeNote('')
      const defenseRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/sla-defense`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSlaDefense(defenseRes.data)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถยกเลิกการอนุมัติได้')
    } finally {
      setIsRevoking(false)
    }
  }

  const handleApproveFromReject = async () => {
    try {
      setIsApprovingFromReject(true)
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/sla-defenses/${slaDefense.defense.id}/approve`,
        { note: approveFromRejectNote || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('อนุมัติ SLA Defense แล้ว')
      setShowApproveFromRejectModal(false)
      setApproveFromRejectNote('')
      const defenseRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/sla-defense`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSlaDefense(defenseRes.data)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถอนุมัติได้')
    } finally {
      setIsApprovingFromReject(false)
    }
  }

  // ✅ STEP 3: เพิ่ม API handlers สำหรับ workflow

  /**
   * Handle Check-In
   * ASSIGNED → IN_PROGRESS
   */
  const handleCheckIn = async (
    beforePhotos: string[],
    gpsLocation?: { latitude: number; longitude: number; accuracy: number; timestamp: number }
  ) => {
    try {
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/checkin`,
        {
          beforePhotos,
          checkInLatitude: gpsLocation?.latitude,
          checkInLongitude: gpsLocation?.longitude,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Check In สำเร็จ! เริ่มทำงานแล้ว')
      await fetchIncident() // Refresh incident data
      setShowCheckIn(false)
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'ไม่สามารถ Check In ได้'
      )
    }
  }

  /**
   * Handle Add More Before Photos
   * Only when IN_PROGRESS and photos < 5
   */
  const handleAddBeforePhotos = async (photos: string[]) => {
    try {
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/add-before-photos`,
        { beforePhotos: photos },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success(`เพิ่มรูปก่อนทำสำเร็จ ${photos.length} รูป`)
      await fetchIncident() // Refresh incident data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถเพิ่มรูปได้')
      throw error
    }
  }

  /**
   * Handle Resolve Incident
   * IN_PROGRESS → RESOLVED
   */
  const handleResolve = async (data: any) => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/resolve`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Incident resolved successfully! Awaiting confirmation.')
      await fetchIncident() // Refresh incident data
      setShowResolve(false)
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to resolve incident'
      )
    }
  }

  /**
   * Handle Update Resolution
   * RESOLVED (no status change)
   */
  const handleUpdateResolve = async (data: any) => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/update-resolve`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Resolution updated successfully!')
      await fetchIncident() // Refresh incident data
      setShowUpdate(false)
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to update resolution'
      )
    }
  }

  /**
   * Handle Confirm & Close
   * RESOLVED → CLOSED
   */
  const handleTechConfirm = async () => {
    try {
      setIsTechConfirming(true)
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/tech-confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success('ยืนยันปิดงานเรียบร้อย รอ Helpdesk ตรวจสอบ')
      await fetchIncident()
      setShowTechConfirm(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถยืนยันปิดงานได้')
    } finally {
      setIsTechConfirming(false)
    }
  }

  const handleConfirmClose = async () => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/confirm-close`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Incident closed successfully!')
      await fetchIncident() // Refresh incident data
      setShowConfirm(false)
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to close incident'
      )
    }
  }

  /**
   * Handle Reopen Incident
   * CLOSED → IN_PROGRESS
   */
  const handleReopen = async (data: { reason: string; assignTo?: number }) => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/reopen`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Incident reopened successfully!')
      await fetchIncident() // Refresh incident data
      setShowReopen(false)
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to reopen incident'
      )
    }
  }

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please enter cancellation reason')
      return
    }

    setIsCancelling(true)

    try {
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/cancel`,
        { cancellationReason },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Incident cancelled successfully')
      setCancelModalOpen(false)
      fetchIncident() // Refresh data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel incident')
      console.error(error)
    } finally {
      setIsCancelling(false)
    }
  }

  // Handle Request Onsite
  const handleRequestOnsite = async () => {
    if (!confirm('ต้องการส่งงานให้ Supervisor มอบหมายช่างเทคนิค Onsite หรือไม่?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/request-onsite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ส่งคำขอ Onsite สำเร็จ! Supervisor จะได้รับแจ้งเตือน')
      fetchIncident()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to request onsite')
    }
  }

  // Handle Direct Close (Phone/Remote Support)
  const handleDirectClose = async (resolutionType: 'PHONE_SUPPORT' | 'REMOTE_SUPPORT', resolutionNote: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/direct-close`,
        { resolutionType, resolutionNote },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(`Incident ถูกปิดแล้ว (${resolutionType === 'PHONE_SUPPORT' ? 'Phone Support' : 'Remote Support'})`)
      setShowDirectClose(false)
      fetchIncident()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to close incident')
    }
  }

  // Handle Generate Service Report Token
  const handleGenerateServiceReport = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/generate-service-report`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const reportToken = response.data.token || response.data.serviceReportToken
      if (reportToken) {
        window.open(`/service-report/${reportToken}`, '_blank')
        await fetchIncident()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถสร้าง Service Report ได้')
    }
  }

  // Handle Download blank-signature Service Report PDF
  const handleDownloadBlankServiceReport = async () => {
    setIsGeneratingBlankPdf(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/service-report-data`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const reportData: ServiceReportData = {
        ...response.data,
        reportUrl: response.data.reportUrl || '',
      }
      await generateServiceReportPDF(reportData, { blankSignature: true, style: response.data.templateStyle || 'classic' })
      toast.success('ดาวน์โหลด Service Report (ลายเซ็นเปล่า) สำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถดาวน์โหลด PDF ได้')
    } finally {
      setIsGeneratingBlankPdf(false)
    }
  }

  // Handle Send blank-signature PDF to store email
  const handleSendServiceReportEmail = async () => {
    if (!incident?.store?.email) {
      toast.error('สาขานี้ไม่มีอีเมล')
      return
    }
    setIsSendingEmail(true)
    try {
      const token = localStorage.getItem('token')
      // 1. Fetch service report data
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/service-report-data`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const reportData: ServiceReportData = {
        ...response.data,
        reportUrl: response.data.reportUrl || '',
      }
      // 2. Generate PDF as blob
      const pdfBlob = await generateServiceReportPDF(reportData, {
        blankSignature: true,
        returnBlob: true,
        style: response.data.templateStyle || 'classic',
      }) as Blob
      // 3. Convert blob to base64
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob)
      })
      // 4. Send email
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}/send-service-report-email`,
        { pdfBase64, toEmail: incident.store.email },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(`ส่ง Service Report ไปที่ ${incident.store.email} สำเร็จ`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถส่งเมลได้')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const copyToClipboard = async () => {
    if (!incident) return

    // Format Created date - dd/mm/yyyy hh:mm (Buddhist year for clipboard)
    const createdText = formatDateTimeThai(new Date(incident.createdAt))

    // Calculate and format SLA Breach Time - dd/mm/yyyy hh:mm (Buddhist year for clipboard)
    const slaTime = calculateSLATime()
    const slaBreachText = slaTime ? formatDateTimeThai(new Date(slaTime)) : '-'

    // Get technician name(s)
    const technicianName = incident.assignees?.length > 0
      ? incident.assignees.map((a: any) => `${a.user?.firstName || ''} ${a.user?.lastName || ''}`).join(', ')
      : incident.assignedTo
        ? `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`
        : (incident.assignee
            ? `${incident.assignee.firstName} ${incident.assignee.lastName}`
            : 'Not assigned yet')

    // Build message with new order
    const message = `Incident Report
Incident No: ${incident.ticketNumber || `INC-${incident.id}`}
Store: ${formatStore(incident.store)}
Title: ${incident.title}
Category: ${incident.category || '-'}
Priority: ${getPriorityDisplayName(incident.priority)}
Job Type: ${incident.jobType || '-'}
Status: ${incident.status}
Technician: ${technicianName}
Incident Date: ${createdText}
SLA Breach Time: ${slaBreachText}`

    try {
      await navigator.clipboard.writeText(message)
      toast.success('Copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy')
      console.error(error)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      PENDING: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30',
      ASSIGNED: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30',
      IN_PROGRESS: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      RESOLVED: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30',
      CLOSED: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30',
      CANCELLED: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30',
      OUTSOURCED: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    }
    return badges[status] || 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30'
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

  // Helper: Get store operating hours for a specific day
  const getStoreHoursForDay = (store: any, dayOfWeek: number): { open: string | null; close: string | null } => {
    if (!store) return { open: null, close: null }

    const dayMapping: { [key: number]: { open: string; close: string } } = {
      0: { open: store.sundayOpen, close: store.sundayClose },
      1: { open: store.mondayOpen, close: store.mondayClose },
      2: { open: store.tuesdayOpen, close: store.tuesdayClose },
      3: { open: store.wednesdayOpen, close: store.wednesdayClose },
      4: { open: store.thursdayOpen, close: store.thursdayClose },
      5: { open: store.fridayOpen, close: store.fridayClose },
      6: { open: store.saturdayOpen, close: store.saturdayClose },
    }

    return dayMapping[dayOfWeek] || { open: null, close: null }
  }

  // Helper: Parse time string (HH:mm) to minutes from midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + (minutes || 0)
  }

  // Helper: Check if store is open 24 hours (no hours defined)
  const isStore24Hours = (store: any): boolean => {
    if (!store) return true
    // If any day has operating hours defined, store is not 24h
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) {
      if (store[`${day}Open`] || store[`${day}Close`]) {
        return false
      }
    }
    return true
  }

  // Calculate SLA breach time considering store operating hours
  const calculateSLATime = () => {
    if (!incident) return null

    // Get SLA minutes from config
    const slaConfig = slaConfigs.find((c: any) => c.priority === incident.priority)
    let totalSlaMinutes: number

    if (slaConfig) {
      // Check store region for provincial vs metro SLA time
      const store = incident.store
      const isProvincial = store?.slaRegion && store.slaRegion !== 'BANGKOK_METRO'

      if (isProvincial && slaConfig.resolutionTimeProvincial) {
        totalSlaMinutes = slaConfig.resolutionTimeProvincial
      } else {
        totalSlaMinutes = slaConfig.resolutionTimeMinutes
      }
    } else {
      // Fallback to hardcoded values if no config found
      const slaHours: any = {
        CRITICAL: 4,
        HIGH: 8,
        MEDIUM: 24,
        LOW: 48,
      }
      totalSlaMinutes = (slaHours[incident.priority] || 24) * 60
    }

    // Use scheduledAt as SLA start if set via Scheduled Assignment
    const slaStart = incident.scheduledAt
      ? new Date(incident.scheduledAt)
      : new Date(incident.createdAt)
    const store = incident.store

    // If store has no operating hours, assume 24h operation
    if (isStore24Hours(store)) {
      return new Date(slaStart.getTime() + totalSlaMinutes * 60 * 1000)
    }

    // Calculate SLA deadline considering store operating hours
    let remainingMinutes = totalSlaMinutes
    let currentTime = new Date(slaStart)
    let iterations = 0
    const maxIterations = 365 // Prevent infinite loop (max 1 year)

    while (remainingMinutes > 0 && iterations < maxIterations) {
      iterations++
      const dayOfWeek = currentTime.getDay()
      const { open, close } = getStoreHoursForDay(store, dayOfWeek)

      // If no hours defined for this day, treat as 24h operation for that day
      if (!open || !close) {
        // Add remaining minutes and we're done
        currentTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000)
        break
      }

      const openMinutes = parseTimeToMinutes(open)
      const closeMinutes = parseTimeToMinutes(close)
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()

      // If store closes after midnight (e.g., open 10:00, close 02:00)
      const closesAfterMidnight = closeMinutes < openMinutes

      if (closesAfterMidnight) {
        // Complex case: store hours span midnight
        if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) {
          // Currently within operating hours
          let availableMinutes: number
          if (currentMinutes >= openMinutes) {
            // Before midnight
            availableMinutes = (24 * 60 - currentMinutes) + closeMinutes
          } else {
            // After midnight
            availableMinutes = closeMinutes - currentMinutes
          }

          if (remainingMinutes <= availableMinutes) {
            currentTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000)
            remainingMinutes = 0
          } else {
            remainingMinutes -= availableMinutes
            // Move to next day's opening
            currentTime.setDate(currentTime.getDate() + 1)
            currentTime.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
          }
        } else {
          // Outside operating hours, move to opening time
          if (currentMinutes < openMinutes) {
            currentTime.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
          } else {
            // After close, before midnight, move to next day opening
            currentTime.setDate(currentTime.getDate() + 1)
            currentTime.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
          }
        }
      } else {
        // Normal case: store opens and closes on same day
        if (currentMinutes < openMinutes) {
          // Before store opens, move to opening time
          currentTime.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
        } else if (currentMinutes >= closeMinutes) {
          // After store closed, move to next day's opening
          currentTime.setDate(currentTime.getDate() + 1)
          currentTime.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
        } else {
          // Within operating hours
          const availableMinutes = closeMinutes - currentMinutes

          if (remainingMinutes <= availableMinutes) {
            currentTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000)
            remainingMinutes = 0
          } else {
            remainingMinutes -= availableMinutes
            // Move to next day's opening
            currentTime.setDate(currentTime.getDate() + 1)
            currentTime.setHours(Math.floor(openMinutes / 60), openMinutes % 60, 0, 0)
          }
        }
      }
    }

    return currentTime
  }

  // Check permissions
  const userRoles = currentUser?.roles || [currentUser?.role].filter(Boolean)
  const hasRole = (role: string) => userRoles.includes(role)

  // Higher-role hierarchy: higher roles override lower ones
  const _higherThanHelpDesk = ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR']
  const _higherThanTech = [..._higherThanHelpDesk, 'HELP_DESK']
  const _hasHigherThanHelpDesk = userRoles.some((r: string) => _higherThanHelpDesk.includes(r))

  const canEdit = (hasRole('HELP_DESK') || hasRole('IT_MANAGER')) && incident?.status !== 'CLOSED' && incident?.status !== 'CANCELLED'
  const canCancel = (hasRole('HELP_DESK') || hasRole('IT_MANAGER')) && incident?.status !== 'CLOSED' && incident?.status !== 'CANCELLED'

  // Assign permission - SUPERVISOR or IT_MANAGER
  const canAssign = hasRole('SUPERVISOR') || hasRole('IT_MANAGER')

  // Reassign permission - SUPERVISOR only, not for CLOSED/CANCELLED/RESOLVED
  const canRequestReassign =
    hasRole('SUPERVISOR') &&
    incident?.assignee &&
    (incident?.status === 'ASSIGNED' || incident?.status === 'IN_PROGRESS')

  // Old reassign for SUPERVISOR (direct) - same status restriction
  const canReassign =
    hasRole('SUPERVISOR') &&
    (incident?.status === 'ASSIGNED' || incident?.status === 'IN_PROGRESS')

  // ✅ STEP 4: เพิ่ม permission checks สำหรับ workflow buttons
  
  // Helper: Get assigned technician (รองรับทั้ง assignedTo และ assignee)
  const assignedTech = incident?.assignedTo || incident?.assignee
  const assignedTechId = assignedTech?.id

  // Helper: Check if current user is the assigned technician (support multi-technician)
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null
  const isAssignedToMe = incident?.assignees?.some((a: any) => Number(a.user?.id || a.userId) === currentUserId)
    || (assignedTechId != null && Number(assignedTechId) === currentUserId)

  // Role flags — highest role wins: TECHNICIAN/HELP_DESK flags suppressed when higher role exists
  const isTechnician = hasRole('TECHNICIAN') && !userRoles.some((r: string) => _higherThanTech.includes(r))
  const isHelpDesk = hasRole('HELP_DESK') && !_hasHigherThanHelpDesk
  const isSupervisor = hasRole('SUPERVISOR')
  const isITManager = hasRole('IT_MANAGER')

  // Raw technician role check (no hierarchy suppression) — for workflow actions
  // IT_MANAGER who also has TECHNICIAN role can check-in/resolve when assigned
  const hasTechnicianRole = hasRole('TECHNICIAN')

  // Response - TECHNICIAN ที่ถูก assign สามารถตอบรับก่อน Check-in (ไม่บังคับ)
  const canResponse =
    incident?.status === 'ASSIGNED' &&
    hasTechnicianRole &&
    isAssignedToMe &&
    !incident?.respondedAt  // ยังไม่เคย response

  // Check if current user already checked in (via junction table, with fallback for pre-migration data)
  const myAssignment = incident?.assignees?.find((a: any) => Number(a.user?.id || a.userId) === currentUserId)
  const hasCheckedIn = !!myAssignment?.checkedInAt
    || (!!incident?.checkInAt && currentUserId != null && Number(incident?.assigneeId) === currentUserId)

  // Check In - TECHNICIAN ที่ถูก assign, ASSIGNED หรือ IN_PROGRESS, ยังไม่เคย check in
  const canCheckIn =
    (incident?.status === 'ASSIGNED' || incident?.status === 'IN_PROGRESS') &&
    hasTechnicianRole &&
    isAssignedToMe &&
    !hasCheckedIn

  // Resolve - TECHNICIAN ที่ถูก assign คนไหนก็ resolve ได้
  const canResolve =
    incident?.status === 'IN_PROGRESS' &&
    hasTechnicianRole &&
    isAssignedToMe

  // Add Before Photos - TECHNICIAN ที่ถูก assign, สถานะ IN_PROGRESS, รูปยังไม่ครบ 5
  const currentBeforePhotosCount = incident?.beforePhotos?.length || 0
  const canAddBeforePhotos =
    incident?.status === 'IN_PROGRESS' &&
    hasTechnicianRole &&
    isAssignedToMe &&
    currentBeforePhotosCount < 5

  // Update Resolution - TECHNICIAN ที่ถูก assign (รวม IT_MANAGER+TECH)
  const canUpdate =
    incident?.status === 'RESOLVED' &&
    hasTechnicianRole &&
    isAssignedToMe

  // Direct Close (Phone/Remote Support) - HELP_DESK, OPEN or PENDING, no resolutionType yet
  const canDirectClose =
    isHelpDesk &&
    (incident?.status === 'OPEN' || incident?.status === 'PENDING') &&
    !incident?.resolutionType

  // Request Onsite - HELP_DESK, OPEN or PENDING, no resolutionType yet
  const canRequestOnsite =
    isHelpDesk &&
    (incident?.status === 'OPEN' || incident?.status === 'PENDING') &&
    !incident?.resolutionType

  // Tech Confirm Resolve - TECHNICIAN ที่ assign, RESOLVED, ยังไม่ได้ tech confirm (รวม IT_MANAGER+TECH)
  const canTechConfirm =
    incident?.status === 'RESOLVED' &&
    hasTechnicianRole &&
    isAssignedToMe &&
    !incident?.techConfirmedAt

  // Confirm & Close - HELP_DESK หรือ IT_MANAGER AND tech must have confirmed
  const canConfirm =
    incident?.status === 'RESOLVED' &&
    (isHelpDesk || hasRole('IT_MANAGER')) &&
    !!incident?.techConfirmedAt

  // Reopen - HELP_DESK เท่านั้น และต้องเป็น CLOSED
  const canReopen =
    incident?.status === 'CLOSED' &&
    isHelpDesk

  // ✅ Helper: Get action guidance message for Technician
  const getTechnicianGuidance = (): { message: string; type: 'info' | 'warning' | 'error' } | null => {
    if (!hasTechnicianRole) return null

    // Not assigned to any incident
    if (!assignedTechId) {
      return {
        message: 'Incident นี้ยังไม่ได้มอบหมายให้ช่างเทคนิค กรุณารอการมอบหมายจาก Supervisor',
        type: 'info',
      }
    }

    // Assigned to different technician
    if (!isAssignedToMe) {
      const assignedName = assignedTech?.firstName
        ? `${assignedTech.firstName} ${assignedTech.lastName}`
        : 'ช่างเทคนิคอื่น'
      return {
        message: `Incident นี้มอบหมายให้ ${assignedName} คุณไม่สามารถดำเนินการได้`,
        type: 'warning',
      }
    }

    // Assigned to me - check status
    switch (incident?.status) {
      case 'OPEN':
      case 'PENDING':
        return {
          message: 'Incident นี้รอการมอบหมายจาก Supervisor',
          type: 'info',
        }
      case 'ASSIGNED':
        return {
          message: '📷 กรุณากด "Check In & Start" เพื่อเริ่มงานและถ่ายรูปก่อนซ่อม',
          type: 'info',
        }
      case 'IN_PROGRESS':
        return {
          message: '✅ คุณสามารถกด "Resolve Incident" เพื่อปิดงานได้แล้ว',
          type: 'info',
        }
      case 'RESOLVED':
        if (!incident?.techConfirmedAt) {
          return {
            message: '📋 กรุณาตรวจสอบเอกสาร/รอลูกค้าเซ็น Service Report แล้วกด "ยืนยันปิดงาน"',
            type: 'info',
          }
        }
        return {
          message: '⏳ รอ Help Desk ยืนยันการปิดงาน คุณสามารถแก้ไข Resolution ได้ถ้าต้องการ',
          type: 'info',
        }
      case 'CLOSED':
        return {
          message: '✓ งานนี้ปิดเรียบร้อยแล้ว',
          type: 'info',
        }
      case 'CANCELLED':
        return {
          message: 'งานนี้ถูกยกเลิกแล้ว',
          type: 'warning',
        }
      default:
        return null
    }
  }

  const technicianGuidance = getTechnicianGuidance()

  // Helpdesk guidance
  const getHelpdeskGuidance = (): { message: string; type: 'info' | 'warning' } | null => {
    if (!isHelpDesk) return null
    if ((incident?.status === 'OPEN' || incident?.status === 'PENDING') && !incident?.resolutionType) {
      return {
        message: 'กรุณาเลือกวิธีดำเนินการ: Phone Support, Remote Support หรือ Request Onsite',
        type: 'info',
      }
    }
    if ((incident?.status === 'OPEN' || incident?.status === 'PENDING') && incident?.resolutionType === 'ONSITE') {
      return {
        message: 'รอ Supervisor มอบหมายช่างเทคนิค Onsite',
        type: 'info',
      }
    }
    if (incident?.status === 'RESOLVED' && !incident?.techConfirmedAt) {
      return {
        message: 'รอช่างเทคนิคยืนยันปิดงาน (อัปโหลดเอกสาร/ลูกค้าเซ็น Service Report)',
        type: 'info',
      }
    }
    return null
  }
  const helpdeskGuidance = getHelpdeskGuidance()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading incident...</p>
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Incident not found</p>
        </div>
      </div>
    )
  }

  const slaTime = calculateSLATime()

  // Calculate SLA Achievement Status
  const getSLAStatus = (): { status: 'ACHIEVED' | 'FAILED' | 'PENDING' | 'N/A'; label: string; color: string } => {
    // Project / PM: no SLA
    if (incident.jobType === 'Project' || incident.jobType === 'Preventive Maintenance') {
      return { status: 'N/A', label: 'ไม่มี SLA', color: 'text-gray-400 bg-gray-500/20 border-gray-500/30' }
    }
    // Adhoc: always passes
    if (incident.jobType === 'Adhoc') {
      return { status: 'ACHIEVED', label: 'SLA Passed (Adhoc) ✓', color: 'text-green-400 bg-green-500/20 border-green-500/30' }
    }

    if (!slaTime) {
      return { status: 'N/A', label: 'N/A', color: 'text-gray-400 bg-gray-500/20 border-gray-500/30' }
    }

    const slaDeadline = new Date(slaTime)
    const now = new Date()

    // If incident is CLOSED or RESOLVED, check against resolution/close time
    if (incident.status === 'CLOSED' || incident.status === 'RESOLVED') {
      // Use resolvedAt if available, otherwise use closedAt or updatedAt
      const completedAt = incident.resolvedAt
        ? new Date(incident.resolvedAt)
        : incident.closedAt
          ? new Date(incident.closedAt)
          : new Date(incident.updatedAt)

      if (completedAt <= slaDeadline) {
        return { status: 'ACHIEVED', label: 'SLA Achieved ✓', color: 'text-green-400 bg-green-500/20 border-green-500/30' }
      } else if (slaDefense?.defense?.status === 'APPROVED') {
        return { status: 'ACHIEVED', label: 'SLA Achieved (Defended) ✓', color: 'text-green-400 bg-green-500/20 border-green-500/30' }
      } else {
        return { status: 'FAILED', label: 'SLA Failed ✗', color: 'text-red-400 bg-red-500/20 border-red-500/30' }
      }
    }

    // If incident is CANCELLED, show N/A
    if (incident.status === 'CANCELLED') {
      return { status: 'N/A', label: 'Cancelled', color: 'text-gray-400 bg-gray-500/20 border-gray-500/30' }
    }

    // If incident is still open (PENDING, ASSIGNED, IN_PROGRESS)
    if (now > slaDeadline) {
      return { status: 'FAILED', label: 'SLA Breached ✗', color: 'text-red-400 bg-red-500/20 border-red-500/30' }
    } else {
      return { status: 'PENDING', label: 'Within SLA', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' }
    }
  }

  const slaStatus = getSLAStatus()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <BackButton href="/dashboard/incidents" label="กลับไปหน้า Incidents" />

      {/* Title */}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
          Incident #{incident.ticketNumber || incident.id}
        </h1>
      </div>

      {/* Action Buttons — 2 sides */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">

        {/* LEFT: Workflow buttons (technician actions) */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          {canRequestOnsite && (
            <button onClick={handleRequestOnsite}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <MapPin className="w-4 h-4 shrink-0" /><span>Request Onsite</span>
            </button>
          )}
          {canDirectClose && (
            <button onClick={() => setShowDirectClose(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>ปิดงานโดย Helpdesk</span>
            </button>
          )}
          {canResponse && (
            <button onClick={() => setShowResponse(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <MessageSquare className="w-4 h-4 shrink-0" /><span>แจ้งกำหนดการเข้าซ่อม</span>
            </button>
          )}
          {canCheckIn && (
            <button onClick={() => setShowCheckIn(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 hover:brightness-110 text-white rounded-lg transition duration-200 text-sm font-medium"
              style={{ backgroundColor: themeHighlight }}>
              <Camera className="w-4 h-4 shrink-0" /><span>Check In & Start</span>
            </button>
          )}
          {canAddBeforePhotos && (
            <button onClick={() => setShowAddBeforePhotos(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <Camera className="w-4 h-4 shrink-0" /><span>เพิ่มรูปก่อนทำ ({currentBeforePhotosCount}/5)</span>
            </button>
          )}
          {canResolve && (
            <button onClick={() => setShowResolve(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" /><span>Resolve Incident</span>
            </button>
          )}
          {canUpdate && (
            <button onClick={() => setShowUpdate(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <Edit3 className="w-4 h-4 shrink-0" /><span>Update Resolution</span>
            </button>
          )}
          {canTechConfirm && (
            <button onClick={() => setShowTechConfirm(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" /><span>ยืนยันปิดงาน</span>
            </button>
          )}
          {canConfirm && (
            <button onClick={() => setShowConfirm(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>Confirm & Close</span>
            </button>
          )}
          {canReopen && (
            <button onClick={() => setShowReopen(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reopen Incident</span>
            </button>
          )}
          {/* Helpdesk info: waiting for tech to confirm */}
          {incident?.status === 'RESOLVED' && (isHelpDesk || hasRole('IT_MANAGER')) && !incident?.techConfirmedAt && (
            <div className="flex items-start gap-3 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                <p className="font-medium">รอช่างเทคนิคยืนยันปิดงาน</p>
                <p className="text-xs text-amber-200/60 mt-0.5">คุณจะได้รับแจ้งเตือนเมื่อช่างยืนยันแล้ว</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Management buttons */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2">
          {/* Assign + Outsource */}
          {canAssign && !incident.assignee && incident?.resolutionType === 'ONSITE' && (
            incident.status === 'PENDING' || incident.status === 'OPEN'
          ) && !(incident.outsourceJobs?.some((oj: any) => oj.status !== 'CANCELLED')) && (
            <>
              <button
                onClick={() => { setAssignMode('assign'); setAssignModalOpen(true) }}
                className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200 text-sm font-medium">
                <UserPlus className="w-4 h-4 shrink-0" /><span>Assign</span>
              </button>
              {isSupervisor && (
                <button
                  onClick={() => router.push(`/dashboard/outsource/create?incidentId=${incident.id}`)}
                  className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 hover:brightness-110 text-white rounded-lg transition duration-200 text-sm font-medium"
                  style={{ backgroundColor: themeHighlight }}>
                  <Briefcase className="w-4 h-4 shrink-0" /><span>ส่งไป Outsource</span>
                </button>
              )}
            </>
          )}
          {/* Request Reassign */}
          {canRequestReassign && (
            <button onClick={() => setShowReassignmentModal(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <UserPlus className="w-4 h-4 shrink-0" /><span>Request Reassign</span>
            </button>
          )}
          {/* Direct Reassign */}
          {canReassign && incident.assignee && !canRequestReassign && (
            <button
              onClick={() => { setAssignMode('reassign'); setAssignModalOpen(true) }}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <UserPlus className="w-4 h-4 shrink-0" /><span>Direct Reassign</span>
            </button>
          )}
          {/* Edit */}
          {canEdit && (
            <button onClick={() => router.push(`/dashboard/incidents/${incident.id}/edit`)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <Edit className="w-4 h-4 shrink-0" /><span>Edit</span>
            </button>
          )}
          {/* Cancel */}
          {canCancel && incident.status !== 'CANCELLED' && (
            <button onClick={() => setCancelModalOpen(true)}
              className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200 text-sm font-medium">
              <X className="w-4 h-4 shrink-0" /><span>Cancel</span>
            </button>
          )}
          {/* Service Report - Technician dropdown */}
          {(incident.status === 'RESOLVED' || incident.status === 'CLOSED') && hasTechnicianRole && (
            <div className="relative" ref={srMenuRef}>
              <button onClick={() => setShowSrMenu(!showSrMenu)}
                className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition duration-200 text-sm font-medium">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Service Report</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showSrMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSrMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                  {incident.serviceReportToken ? (
                    <a href={`/service-report/${incident.serviceReportToken}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-slate-700 transition"
                      onClick={() => setShowSrMenu(false)}>
                      <ExternalLink className="w-4 h-4 text-teal-400" /><span>Service Report Online</span>
                    </a>
                  ) : (
                    <button onClick={() => { handleGenerateServiceReport(); setShowSrMenu(false) }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-slate-700 transition text-left">
                      <ExternalLink className="w-4 h-4 text-teal-400" /><span>Service Report Online</span>
                    </button>
                  )}
                  <button onClick={() => { handleDownloadBlankServiceReport(); setShowSrMenu(false) }}
                    disabled={isGeneratingBlankPdf}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-slate-700 transition text-left disabled:opacity-50">
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>{isGeneratingBlankPdf ? 'กำลังสร้าง PDF...' : 'Download Service Report'}</span>
                  </button>
                  {incident.store?.email && (
                    <button onClick={() => { handleSendServiceReportEmail(); setShowSrMenu(false) }}
                      disabled={isSendingEmail}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-slate-700 transition text-left disabled:opacity-50">
                      <Mail className="w-4 h-4 text-cyan-400" />
                      <span>{isSendingEmail ? 'กำลังส่งเมล...' : 'ส่งเข้า Email สาขา'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Service Report - Other roles view-only */}
          {(incident.status === 'RESOLVED' || incident.status === 'CLOSED') &&
            !hasTechnicianRole && (isHelpDesk || isITManager || isSupervisor) &&
            !!incident.techConfirmedAt && incident.serviceReportToken && (
              <a href={`/service-report/${incident.serviceReportToken}`} target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto sm:min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition duration-200 text-sm font-medium">
                <FileText className="w-4 h-4 shrink-0" /><span>ดู Service Report</span><ExternalLink className="w-3 h-3" />
              </a>
          )}
        </div>

      </div>

      {/* ✅ Technician Guidance Banner - แสดงคำแนะนำสำหรับ Technician */}
      {technicianGuidance && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            technicianGuidance.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : technicianGuidance.type === 'warning'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{technicianGuidance.message}</p>
            {hasTechnicianRole && isAssignedToMe && incident?.status === 'ASSIGNED' && (
              <p className="text-sm mt-1 text-gray-400">
                ต้อง Check-in ก่อนถึงจะสามารถกด Resolve Incident ได้
              </p>
            )}
          </div>
        </div>
      )}

      {/* Helpdesk Guidance Banner */}
      {helpdeskGuidance && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            helpdeskGuidance.type === 'warning'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{helpdeskGuidance.message}</p>
        </div>
      )}

      {/* Outsource Job Status - Show linked outsource jobs */}
      {incident.outsourceJobs && incident.outsourceJobs.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-400" />
            งาน Outsource ที่เชื่อมโยง
          </h2>
          <div className="space-y-3">
            {incident.outsourceJobs.map((oj: any) => {
              const osStatusColors: Record<string, string> = {
                OPEN: 'bg-green-500/20 text-green-400 border-green-500/30',
                AWARDED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                IN_PROGRESS: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
                COMPLETED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                VERIFIED: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
                PAID: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                CANCELLED: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
                PENDING_CANCEL: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
              }
              const osStatusLabels: Record<string, string> = {
                OPEN: 'เปิดรับเสนอราคา',
                BIDDING_CLOSED: 'ปิดรับเสนอราคา',
                AWARDED: 'มอบหมายแล้ว',
                IN_PROGRESS: 'กำลังดำเนินการ',
                COMPLETED: 'รอตรวจสอบ',
                VERIFIED: 'ตรวจสอบผ่าน',
                PAID: 'จ่ายเงินแล้ว',
                CANCELLED: 'ยกเลิก',
                PENDING_CANCEL: 'รอยืนยันยกเลิก',
              }
              return (
                <Link
                  key={oj.id}
                  href={`/dashboard/outsource/${oj.id}`}
                  className="block bg-slate-800/70 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono text-blue-400">{oj.jobCode}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${osStatusColors[oj.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {osStatusLabels[oj.status] || oj.status}
                        </span>
                      </div>
                      <p className="text-white font-medium mt-1">{oj.title}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                        <span>{oj._count?.bids || 0} ข้อเสนอ</span>
                        {oj.agreedPrice && (
                          <span className="text-emerald-400">{Number(oj.agreedPrice).toLocaleString()} บาท</span>
                        )}
                        {oj.awardedTo && (
                          <span>ผู้รับงาน: <span className="text-white">{oj.awardedTo.firstName} {oj.awardedTo.lastName}</span></span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Incident Information - Layout ใหม่ */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            Incident Information
          </h2>
          <button
            onClick={() => copyToClipboard()}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition duration-200 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copy to Clipboard</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* Row 1: Incident No + Job Type + Priority + Status + SLA Status */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pb-6 border-b border-gray-700/50">
            <div>
              <p className="text-sm text-gray-400 mb-2">Incident No</p>
              <p className="text-white font-mono text-lg font-semibold">
                {incident.ticketNumber || `INC-${incident.id}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">Job Type</p>
              <p className="text-white font-medium">{incident.jobType || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">Priority</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityBadge(incident.priority)}`}>
                {getPriorityDisplayName(incident.priority)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusBadge(incident.status)}`}>
                {incident.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">SLA Result</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${slaStatus.color}`}>
                {slaStatus.label}
              </span>
            </div>
          </div>

          {/* Resolution Type Badge */}
          {incident.resolutionType && (
            <div className="pb-6 border-b border-gray-700/50">
              <p className="text-sm text-gray-400 mb-2">Resolution Type</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${
                incident.resolutionType === 'PHONE_SUPPORT'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : incident.resolutionType === 'REMOTE_SUPPORT'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {incident.resolutionType === 'PHONE_SUPPORT' ? 'Phone Support'
                  : incident.resolutionType === 'REMOTE_SUPPORT' ? 'Remote Support'
                  : 'Onsite'}
              </span>
            </div>
          )}

          {/* Row 2: Store + Province */}
          <div className="pb-6 border-b border-gray-700/50 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">Store</p>
              {incident.store?.id ? (
                <Link
                  href={`/dashboard/stores/${incident.store.id}`}
                  className="text-white font-semibold text-lg hover:text-blue-400 hover:underline transition-colors"
                >
                  {formatStore(incident.store)}
                </Link>
              ) : (
                <p className="text-white font-semibold text-lg">
                  {formatStore(incident.store)}
                </p>
              )}
            </div>
            {incident.store?.province && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Province</p>
                <p className="text-white font-medium">{incident.store.province}</p>
              </div>
            )}
          </div>

          {/* Row 3: Title + Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-700/50">
            <div>
              <p className="text-sm text-gray-400 mb-2">Title</p>
              <p className="text-white font-medium">{incident.title}</p>
            </div>
            {incident.category && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Category</p>
                <p className="text-white font-medium">{incident.category}</p>
              </div>
            )}
          </div>

          {/* Row 4: Description */}
          <div className="pb-6 border-b border-gray-700/50">
            <p className="text-sm text-gray-400 mb-2">Description</p>
            <p className="text-gray-300 whitespace-pre-wrap">
              {incident.description}
            </p>
          </div>

          {/* Row 5: Technician(s) */}
          <div className="pb-6 border-b border-gray-700/50">
            <p className="text-sm text-gray-400 mb-2">Technician</p>
            {incident.assignees?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {incident.assignees.map((a: any, idx: number) => (
                  <span key={a.user?.id || idx} className="inline-flex items-center px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-sm text-white">
                    {a.user?.firstName} {a.user?.lastName}
                  </span>
                ))}
              </div>
            ) : incident.assignedTo || incident.assignee ? (
              <p className="text-white font-medium">
                {(incident.assignedTo || incident.assignee)?.firstName}{' '}
                {(incident.assignedTo || incident.assignee)?.lastName}
              </p>
            ) : (
              <p className="text-gray-400 italic">Not assigned yet</p>
            )}
          </div>

          {/* Row 7: Incident Date + Created Date + SLA Breach Time + Last Updated */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Incident Date - วันที่ลูกค้าแจ้ง */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Incident Date</p>
              <p className="text-white">
                {incident.incidentDate
                  ? formatDateTime(new Date(incident.incidentDate))
                  : formatDateTime(new Date(incident.createdAt))}
              </p>
            </div>
            {/* Scheduled At - วันเวลาเข้าดำเนินการ */}
            {incident.scheduledAt && (
              <div>
                <p className="text-sm text-gray-400 mb-2">วันเวลาเข้าดำเนินการ</p>
                <p className="text-white font-medium">{formatDateTime(new Date(incident.scheduledAt))}</p>
                {incident.scheduledReason && (
                  <p className="text-xs text-amber-400 mt-1">เหตุผล: {incident.scheduledReason}</p>
                )}
              </div>
            )}
            <div>
              <p className="text-sm text-gray-400 mb-2">Created Date</p>
              <p className="text-white">
                {formatDateTime(new Date(incident.createdAt))}
              </p>
            </div>
            {slaTime && (
              <div>
                <p className="text-sm text-gray-400 mb-2">
                  SLA Deadline{incident.scheduledAt ? ' (นับจากเวลานัด)' : ''}
                </p>
                <p className="text-white">
                  {formatDateTime(new Date(slaTime))}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-400 mb-2">Last Updated</p>
              <p className="text-white">
                {formatDateTime(new Date(incident.updatedAt))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Response & Check-in Info (above Resolution) */}
      {(incident.respondedAt || incident.checkInAt || incident.assignees?.some((a: any) => a.checkedInAt)) && (
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Response & Check-in</h2>
          <div className="space-y-3">
            {/* Response Info */}
            {incident.respondedAt && (
              <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-700/50">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-purple-300 font-medium">Response</span>
                      <span className="text-gray-400">{formatDateTime(incident.respondedAt)}</span>
                      {incident.estimatedArrivalTime && (
                        <span className="text-purple-400">
                          ETA: {formatDateTime(incident.estimatedArrivalTime)}
                        </span>
                      )}
                    </div>
                    {incident.responseMessage && (
                      <p className="text-gray-300 mt-1">{incident.responseMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Check-in Info — show each technician's check-in */}
            {incident.assignees?.filter((a: any) => a.checkedInAt).length > 0 ? (
              incident.assignees
                .filter((a: any) => a.checkedInAt)
                .map((a: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-400">Check-in:</span>
                        <span className="text-white font-medium">
                          {a.user?.firstName} {a.user?.lastName}
                        </span>
                        <span className="text-gray-500">—</span>
                        <span className="text-white">{formatDateTime(a.checkedInAt)}</span>
                      </div>
                      {a.checkInLatitude && a.checkInLongitude && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-400" />
                          <span className="text-gray-400">GPS:</span>
                          <a
                            href={`https://www.google.com/maps?q=${a.checkInLatitude},${a.checkInLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                          >
                            {Number(a.checkInLatitude).toFixed(6)}, {Number(a.checkInLongitude).toFixed(6)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : incident.checkInAt ? (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400">Check-in:</span>
                    <span className="text-white">{formatDateTime(incident.checkInAt)}</span>
                  </div>
                  {incident.checkInLatitude && incident.checkInLongitude && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="text-gray-400">GPS:</span>
                      <a
                        href={`https://www.google.com/maps?q=${incident.checkInLatitude},${incident.checkInLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                      >
                        {incident.checkInLatitude.toFixed(6)}, {incident.checkInLongitude.toFixed(6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Resolution (if resolved or closed) */}
      {(incident.status === 'RESOLVED' || incident.status === 'CLOSED') && incident.resolutionNote && (
        <div className="glass-card p-6 rounded-2xl bg-green-500/5 border border-green-500/20">
          <h2 className="text-lg font-semibold text-green-400 mb-4">Resolution</h2>
          <p className="text-gray-300 whitespace-pre-wrap">
            {incident.resolutionNote}
          </p>
          
          {/* Spare Parts (if any) */}
          {incident.usedSpareParts && incident.spareParts && incident.spareParts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-500/20">
              <h3 className="text-sm font-semibold text-green-400 mb-3">Spare Parts Used</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-500/20">
                      <th className="text-left py-2 px-3 text-gray-400 font-medium w-8">#</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Old Equipment</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Old Serial No.</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-medium w-8"></th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">New Equipment</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">New Serial No.</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incident.spareParts.map((part: any, index: number) => {
                      const deviceNames = part.deviceName?.includes(' → ')
                        ? part.deviceName.split(' → ')
                        : [part.deviceName, part.deviceName]
                      const oldName = deviceNames[0]?.trim() || '-'
                      const newName = deviceNames[1]?.trim() || deviceNames[0]?.trim() || '-'
                      const replacementType = part.replacementType as 'PERMANENT' | 'TEMPORARY' | undefined
                      // Strip legacy embedded type strings that old data had stored inside the notes field
                      const cleanNotes = part.notes
                        ?.replace(/^\[Component Replacement\]\s*/i, '')
                        ?.replace(/^Type:\s*(PERMANENT|TEMPORARY)\s*\|?\s*/i, '')
                        ?.trim() || ''
                      return (
                        <tr key={index} className="border-b border-slate-700/30">
                          <td className="py-2.5 px-3">
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-300">{oldName}</td>
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{part.oldSerialNo}</td>
                          <td className="py-2.5 px-3 text-center text-green-400">→</td>
                          <td className="py-2.5 px-3 text-white font-medium">{newName}</td>
                          <td className="py-2.5 px-3 text-green-400 font-mono text-xs">{part.newSerialNo}</td>
                          <td className="py-2.5 px-3 text-xs">
                            {replacementType && (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs mr-1 ${replacementType === 'PERMANENT' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {replacementType}
                              </span>
                            )}
                            {cleanNotes && <span className="text-gray-500 italic">{cleanNotes}</span>}
                            {!replacementType && !cleanNotes && <span className="text-gray-600">-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PM Checklist — only for Preventive Maintenance incidents */}
      {incident.jobType === 'Preventive Maintenance' && (
        <PmChecklistSection
          incidentId={incident.id}
          ticketNumber={incident.ticketNumber || `INC-${incident.id}`}
          canEdit={
            hasRole('TECHNICIAN') ||
            hasRole('SUPERVISOR') ||
            hasRole('HELP_DESK') ||
            hasRole('IT_MANAGER') ||
            hasRole('SUPER_ADMIN')
          }
          onPmSubmitted={() => fetchIncident()}
        />
      )}

      {/* Photos (if any) */}
      {((incident.beforePhotos && incident.beforePhotos.length > 0) ||
        (incident.afterPhotos && incident.afterPhotos.length > 0) ||
        (incident.signedReportPhotos && incident.signedReportPhotos.length > 0)) && (
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Photos</h2>

          <div className="space-y-8">
            {/* Before Photos - แสดงบนสุด */}
            {incident.beforePhotos && incident.beforePhotos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <span className="text-sm font-semibold text-blue-400">
                      BEFORE
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    ({incident.beforePhotos.length} {incident.beforePhotos.length === 1 ? 'photo' : 'photos'})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {incident.beforePhotos.map((photo: string, index: number) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                      onClick={() => openPhotoViewer(incident.beforePhotos, index, 'Before Photos')}
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`Before ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* After Photos - แสดงด้านล่าง */}
            {incident.afterPhotos && incident.afterPhotos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                    <span className="text-sm font-semibold text-green-400">
                      AFTER
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    ({incident.afterPhotos.length} {incident.afterPhotos.length === 1 ? 'photo' : 'photos'})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {incident.afterPhotos.map((photo: string, index: number) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                      onClick={() => openPhotoViewer(incident.afterPhotos, index, 'After Photos')}
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`After ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signed Service Report Photos */}
            {incident.signedReportPhotos && incident.signedReportPhotos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                    <span className="text-sm font-semibold text-amber-400">
                      SIGNED SR
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    ({incident.signedReportPhotos.length} {incident.signedReportPhotos.length === 1 ? 'photo' : 'photos'})
                  </span>
                  <span className="text-xs text-gray-500">ภาพ Service Report ที่เซ็นแล้ว</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {incident.signedReportPhotos.map((photo: string, index: number) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                      onClick={() => openPhotoViewer(incident.signedReportPhotos, index, 'Signed Service Report')}
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`Signed SR ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reassignment History */}
      <ReassignmentHistory incidentId={incident.id} />


      {/* Knowledge Base — Related Articles */}
      {incident.category && (kbLoading || kbArticles.length > 0) && (
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/20">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">บทความที่เกี่ยวข้อง</h2>
              <p className="text-xs text-gray-400">หมวด: {incident.category}</p>
            </div>
          </div>
          {kbLoading ? (
            <p className="text-sm text-gray-400">กำลังโหลด...</p>
          ) : (
            <ul className="divide-y divide-slate-700/50">
              {kbArticles.map((article: any) => (
                <li key={article.id}>
                  <button
                    onClick={() => openKbArticle(article.id)}
                    className="w-full flex items-center justify-between py-3 text-left hover:text-blue-400 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-blue-400 truncate">
                        {article.title}
                      </p>
                      {article.summary && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{article.summary}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 flex-shrink-0 ml-2" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Comment Section */}
      <CommentSection incidentId={incident.id} currentUser={currentUser} />

      {/* SLA Defense Card */}
      {incident.status === 'CLOSED' && slaDefense?.slaFailed && (
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-orange-500/20">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">SLA Defense</h2>
          </div>

          {!slaDefense.defense && (
            (hasRole('TECHNICIAN') && Number(incident.assigneeId) === currentUserId) ||
            hasRole('SUPERVISOR') ||
            hasRole('SUPER_ADMIN')
          ) && (
            <button
              onClick={() => setShowSlaDefenseModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              ขอ Defend SLA
            </button>
          )}

          {!slaDefense.defense && !(
            (hasRole('TECHNICIAN') && Number(incident.assigneeId) === currentUserId) ||
            hasRole('SUPERVISOR') ||
            hasRole('SUPER_ADMIN')
          ) && (
            <p className="text-sm text-gray-400">ยังไม่มีคำขอ Defend SLA สำหรับ Incident นี้</p>
          )}

          {slaDefense.defense && (
            <div className={`p-4 rounded-xl border ${
              slaDefense.defense.status === 'APPROVED' ? 'bg-green-500/10 border-green-500/30' :
              slaDefense.defense.status === 'REJECTED' ? 'bg-red-500/10 border-red-500/30' :
              'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${
                  slaDefense.defense.status === 'APPROVED' ? 'text-green-400' :
                  slaDefense.defense.status === 'REJECTED' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {slaDefense.defense.status === 'APPROVED' ? '✓ อนุมัติแล้ว' :
                   slaDefense.defense.status === 'REJECTED' ? '✗ ปฏิเสธ' : '⏳ รอการพิจารณา'}
                </span>
                <span className="text-xs text-gray-500">
                  {slaDefense.defense.technician?.firstName} {slaDefense.defense.technician?.lastName}
                </span>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{slaDefense.defense.reason}</p>
              {slaDefense.defense.reviewNote && (
                <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-600/50">
                  หมายเหตุจาก IT Manager: {slaDefense.defense.reviewNote}
                </p>
              )}
              {hasRole('IT_MANAGER') && (
                <div className="mt-3 pt-3 border-t border-gray-600/50 flex gap-2">
                  {slaDefense.defense.status === 'APPROVED' && (
                    <button
                      onClick={() => setShowRevokeModal(true)}
                      className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      ยกเลิกการอนุมัติ
                    </button>
                  )}
                  {slaDefense.defense.status === 'REJECTED' && (
                    <button
                      onClick={() => setShowApproveFromRejectModal(true)}
                      className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      อนุมัติ Defense SLA
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SLA Defense Submit Modal */}
      {showSlaDefenseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">ขอ Defend SLA</h3>
            <p className="text-sm text-gray-400 mb-4">กรอกเหตุผลที่ SLA ไม่ผ่าน เพื่อให้ IT Manager พิจารณา</p>
            {/* Show scheduled reason as context if available */}
            {incident.scheduledAt && incident.scheduledReason && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 font-medium mb-1">เหตุผลการนัดหมายล่วงหน้า</p>
                <p className="text-xs text-gray-300">{incident.scheduledReason}</p>
              </div>
            )}
            <textarea
              value={slaDefenseReason}
              onChange={(e) => setSlaDefenseReason(e.target.value)}
              placeholder="เช่น ร้านค้าไม่สะดวกให้เข้าเวลาทำการ จึงนัดหลังร้านปิด..."
              rows={4}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-4 py-3 border border-slate-600 focus:border-blue-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSlaDefenseModal(false); setSlaDefenseReason('') }}
                className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmitSlaDefense}
                disabled={isSubmittingDefense}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isSubmittingDefense ? 'กำลังส่ง...' : 'ส่งคำขอ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Defense Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">ยกเลิกการอนุมัติ SLA Defense</h3>
            <p className="text-sm text-amber-400 mb-4">⚠️ การยกเลิกอนุมัติจะทำให้ SLA กลับเป็น "ไม่ผ่าน" กรุณาระบุเหตุผล</p>
            <textarea
              value={revokeNote}
              onChange={(e) => setRevokeNote(e.target.value)}
              placeholder="เหตุผลในการยกเลิกการอนุมัติ..."
              rows={4}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-4 py-3 border border-slate-600 focus:border-amber-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRevokeModal(false); setRevokeNote('') }}
                className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRevokeSlaDefense}
                disabled={isRevoking}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isRevoking ? 'กำลังดำเนินการ...' : 'ยืนยันยกเลิกอนุมัติ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Defense Approve-from-Reject Modal */}
      {showApproveFromRejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">อนุมัติ SLA Defense</h3>
            <p className="text-sm text-gray-400 mb-4">อนุมัติคำขอ Defend SLA ที่เคยถูกปฏิเสธ — SLA จะถือว่าผ่าน</p>
            <textarea
              value={approveFromRejectNote}
              onChange={(e) => setApproveFromRejectNote(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)..."
              rows={3}
              className="w-full bg-slate-800 text-white text-sm rounded-lg px-4 py-3 border border-slate-600 focus:border-green-500 outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowApproveFromRejectModal(false); setApproveFromRejectNote('') }}
                className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleApproveFromReject}
                disabled={isApprovingFromReject}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isApprovingFromReject ? 'กำลังดำเนินการ...' : 'ยืนยันอนุมัติ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KB Article Modal */}
      {showKbArticleModal && selectedKbArticle && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between p-6 border-b border-slate-700">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-xs text-blue-400 font-medium">{selectedKbArticle.category?.name}</span>
                <h3 className="text-lg font-semibold text-white mt-1">{selectedKbArticle.title}</h3>
                {selectedKbArticle.summary && (
                  <p className="text-sm text-gray-400 mt-1">{selectedKbArticle.summary}</p>
                )}
              </div>
              <button
                onClick={() => { setShowKbArticleModal(false); setSelectedKbArticle(null) }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-200 font-sans leading-relaxed">
                  {selectedKbArticle.content}
                </pre>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                เปิดดูแล้ว {selectedKbArticle.viewCount?.toLocaleString()} ครั้ง
              </span>
              <button
                onClick={() => { setShowKbArticleModal(false); setSelectedKbArticle(null) }}
                className="px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm hover:bg-slate-600"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <IncidentTimeline incidentId={incident.id} />

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {incident.checkInAt ? 'ยกเลิกงาน (หลัง Check-in)' : 'Cancel Incident'}
                </h3>
                <p className="text-sm text-gray-400">
                  Please provide cancellation reason
                </p>
              </div>
            </div>

            {/* Warning: cancelled after check-in */}
            {incident.checkInAt && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-300 font-semibold mb-1">⚠️ Technician ได้ Check-in แล้ว</p>
                  <p className="text-gray-400">
                    Check-in เมื่อ{' '}
                    <span className="text-white font-medium">
                      {new Date(incident.checkInAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </p>
                  <p className="text-gray-400 mt-1">
                    ข้อมูล Check-in จะถูกบันทึกไว้เพื่อใช้ในการเบิกค่าเดินทาง
                  </p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cancellation Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setCancelModalOpen(false)
                  setCancellationReason('')
                }}
                disabled={isCancelling}
                className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50"
              >
                Close
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancelling || !cancellationReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Assign/Reassign Modal */}
      <AssignIncidentModal
        incident={incident}
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onSuccess={fetchIncident}
        mode={assignMode}
      />

      {/* Reassignment Request Modal (New Flow) */}
      <ReassignmentModal
        isOpen={showReassignmentModal}
        onClose={() => setShowReassignmentModal(false)}
        incident={{
          id: incident.id,
          ticketNumber: incident.ticketNumber || `INC-${incident.id}`,
          title: incident.title,
          store: incident.store,
          assignee: incident.assignee || incident.assignedTo,
          assignees: incident.assignees,
        }}
        onSuccess={fetchIncident}
      />

      {/* ✅ STEP 6: เพิ่ม Workflow Modals */}

      {/* Response Modal - Submit ETA before going onsite */}
      <ResponseModal
        isOpen={showResponse}
        onClose={() => setShowResponse(false)}
        incidentId={incident.id}
        ticketNumber={incident.ticketNumber || `INC-${incident.id}`}
        onSuccess={fetchIncident}
      />

      {/* Check-In Modal */}
      <CheckInModal
        isOpen={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        incidentId={incident.id}
        onCheckIn={handleCheckIn}
      />

      {/* Add Before Photos Modal */}
      <AddBeforePhotosModal
        isOpen={showAddBeforePhotos}
        onClose={() => setShowAddBeforePhotos(false)}
        onSubmit={handleAddBeforePhotos}
        currentPhotoCount={currentBeforePhotosCount}
        maxPhotos={5}
      />

      {/* Resolve Incident Modal */}
      <ResolveIncidentModal
        isOpen={showResolve}
        onClose={() => setShowResolve(false)}
        incidentId={incident.id}
        onResolve={handleResolve}
        storeId={incident.store?.id}
        incidentEquipmentIds={incident.equipmentIds || []}
        onlineSRToken={incident.serviceReportToken}
        onlineSRSigned={!!incident.customerSignedAt}
      />

      {/* Update Resolution Modal */}
      <UpdateResolveModal
        isOpen={showUpdate}
        onClose={() => setShowUpdate(false)}
        incidentId={incident.id}
        storeId={incident.store?.id}
        currentData={{
          resolutionNote: incident.resolutionNote || '',
          usedSpareParts: incident.usedSpareParts || false,
          spareParts: incident.spareParts || [],
          afterPhotos: incident.afterPhotos || [],
          signedReportPhotos: incident.signedReportPhotos || [],
        }}
        onUpdate={handleUpdateResolve}
      />

      {/* Tech Confirm Resolve Modal */}
      <TechConfirmModal
        isOpen={showTechConfirm}
        onClose={() => setShowTechConfirm(false)}
        incident={{
          id: incident.id,
          ticketNumber: incident.ticketNumber || `INC-${incident.id}`,
          title: incident.title,
          signedReportPhotos: incident.signedReportPhotos,
          customerSignedAt: incident.customerSignedAt,
          serviceReportToken: incident.serviceReportToken,
        }}
        onConfirm={handleTechConfirm}
        isConfirming={isTechConfirming}
      />

      {/* Confirm & Close Modal */}
      <ConfirmCloseModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        incident={{
          id: incident.id,
          title: incident.title,
          ticketNumber: incident.ticketNumber || `INC-${incident.id}`,
          technician: incident.assignedTo,
          resolutionNote: incident.resolutionNote,
          usedSpareParts: incident.usedSpareParts,
          spareParts: incident.spareParts,
          beforePhotos: incident.beforePhotos,
          afterPhotos: incident.afterPhotos,
          signedReportPhotos: incident.signedReportPhotos,
          serviceReportToken: incident.serviceReportToken,
          customerSignedAt: incident.customerSignedAt,
          resolvedAt: incident.resolvedAt,
        }}
        onConfirm={handleConfirmClose}
      />

      {/* Reopen Incident Modal */}
      <ReopenIncidentModal
        isOpen={showReopen}
        onClose={() => setShowReopen(false)}
        incident={{
          id: incident.id,
          title: incident.title,
          ticketNumber: incident.ticketNumber || `INC-${incident.id}`,
          resolvedBy: incident.resolvedBy,
          confirmedBy: incident.confirmedBy,
          resolutionNote: incident.resolutionNote,
          closedAt: incident.confirmedAt,
          reopenCount: incident.reopenCount,
        }}
        technicians={technicians}
        onReopen={handleReopen}
      />

      {/* Direct Close Modal (Phone/Remote Support) */}
      {showDirectClose && (
        <DirectCloseModal
          isOpen={showDirectClose}
          onClose={() => setShowDirectClose(false)}
          incident={{ id: incident.id, title: incident.title, ticketNumber: incident.ticketNumber }}
          onConfirm={handleDirectClose}
        />
      )}

      {/* Photo Viewer Modal */}
      <PhotoViewerModal
        isOpen={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
        photos={photoViewerPhotos}
        initialIndex={photoViewerIndex}
        title={photoViewerTitle}
      />
    </div>
  )
}

// Direct Close Modal for Phone/Remote Support
function DirectCloseModal({
  isOpen,
  onClose,
  incident,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  incident: { id: string; title: string; ticketNumber: string }
  onConfirm: (resolutionType: 'PHONE_SUPPORT' | 'REMOTE_SUPPORT', resolutionNote: string) => void
}) {
  const themeHighlight = useThemeHighlight()
  const [selectedType, setSelectedType] = useState<'PHONE_SUPPORT' | 'REMOTE_SUPPORT'>('PHONE_SUPPORT')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm(selectedType, note)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            ปิดงานโดย Helpdesk
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {incident.ticketNumber} - {incident.title}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              เลือกวิธีปิดงาน
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedType('PHONE_SUPPORT')}
                className={`p-3 rounded-lg border-2 text-center transition ${
                  selectedType === 'PHONE_SUPPORT'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                    : 'border-slate-600 bg-slate-700/50 text-gray-400 hover:border-slate-500'
                }`}
              >
                <Phone className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Phone Support</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('REMOTE_SUPPORT')}
                className={`p-3 rounded-lg border-2 text-center transition ${
                  selectedType === 'REMOTE_SUPPORT'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                    : 'border-slate-600 bg-slate-700/50 text-gray-400 hover:border-slate-500'
                }`}
              >
                <Monitor className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Remote Support</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Resolution Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดการแก้ไข..."
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-4 py-2 text-white rounded-lg transition ${
              selectedType === 'PHONE_SUPPORT'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'hover:brightness-110'
            } disabled:opacity-50`}
            style={selectedType !== 'PHONE_SUPPORT' ? { backgroundColor: themeHighlight } : undefined}
          >
            {isSubmitting ? 'กำลังปิดงาน...' : 'ยืนยันปิดงาน'}
          </button>
        </div>
      </div>
    </div>
  )
}
