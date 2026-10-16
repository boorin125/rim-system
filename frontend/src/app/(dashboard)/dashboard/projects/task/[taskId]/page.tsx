'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Camera,
  Package,
  ClipboardList,
  CheckCircle2,
  Trash2,
  Plus,
  X,
  FileText,
  Building2,
  Briefcase,
  Hash,
  Tag,
  Upload,
  Lock,
  Loader2,
  Navigation,
  User,
  Calendar,
  Save,
  AlertTriangle,
  ScanLine,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { useConfirm } from '@/components/ConfirmDialog'
import { getUserRoles } from '@/config/permissions'
import { getPhotoUrl } from '@/utils/photoUtils'
import { formatStore } from '@/utils/formatStore'

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })

const TASK_STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  PENDING:        { label: 'รอมอบหมาย',    color: 'text-gray-300 bg-gray-700/80 border border-gray-600/50',         dot: 'bg-gray-400' },
  SCHEDULED:      { label: 'นัดหมายแล้ว',  color: 'text-blue-300 bg-blue-900/50 border border-blue-500/40',         dot: 'bg-blue-400' },
  IN_PROGRESS:    { label: 'กำลังทำงาน',   color: 'text-yellow-300 bg-yellow-900/50 border border-yellow-500/40',   dot: 'bg-yellow-400' },
  PENDING_VERIFY: { label: 'รอตรวจสอบ',    color: 'text-purple-300 bg-purple-900/50 border border-purple-500/40',   dot: 'bg-purple-400' },
  COMPLETED:      { label: 'เสร็จสมบูรณ์', color: 'text-green-300 bg-green-900/50 border border-green-500/40',     dot: 'bg-green-400' },
  RESCHEDULED:    { label: 'เลื่อนนัด',    color: 'text-orange-300 bg-orange-900/50 border border-orange-500/40',   dot: 'bg-orange-400' },
  ACCEPTED:       { label: 'ยอมรับแล้ว',   color: 'text-cyan-300 bg-cyan-900/50 border border-cyan-500/40',         dot: 'bg-cyan-400' },
  FAILED:         { label: 'ล้มเหลว',       color: 'text-red-300 bg-red-900/50 border border-red-500/40',           dot: 'bg-red-400' },
  REVISIT:        { label: 'Revisit',       color: 'text-pink-300 bg-pink-900/50 border border-pink-500/40',         dot: 'bg-pink-400' },
  ROLLBACK:       { label: 'Rollback',      color: 'text-amber-300 bg-amber-900/50 border border-amber-500/40',     dot: 'bg-amber-400' },
}

interface StagedPhoto {
  file: File
  previewUrl: string
  caption: string
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function resizeImage(file: File, maxDimension = 1920, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { naturalWidth: w, naturalHeight: h } = img
      if (w <= maxDimension && h <= maxDimension) { resolve(file); return }
      const ratio = Math.min(maxDimension / w, maxDimension / h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => resolve(file)
    img.src = objectUrl
  })
}

function LockedSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative glass-card rounded-xl overflow-hidden">
      {children}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 rounded-xl">
        <Lock className="w-6 h-6 text-gray-400" />
        <p className="text-sm text-gray-400 font-medium">กรุณา Check-in ก่อนเริ่มดำเนินการ</p>
      </div>
    </div>
  )
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const { confirm: confirmDialog, dialog: confirmDialogEl } = useConfirm()

  const [task, setTask] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Assign panel (Supervisor / Helpdesk)
  const [techUsers, setTechUsers] = useState<any[]>([])
  const [assignForm, setAssignForm] = useState({ assignedToId: '', scheduledDate: '', reason: '' })
  const [savingAssign, setSavingAssign] = useState(false)

  // Equipment modal
  const [showEquipmentForm, setShowEquipmentForm] = useState(false)
  const [editingEqId, setEditingEqId] = useState<number | null>(null)
  const [eqMode, setEqMode] = useState<'replace' | 'add'>('replace')
  const [eqForm, setEqForm] = useState({ itemName: '', oldModel: '', oldSN: '', newModel: '', newSN: '', notes: '' })
  const [addingEq, setAddingEq] = useState(false)
  const [scanTarget, setScanTarget] = useState<'oldSN' | 'newSN' | null>(null)

  // Photo staging modal (work photos)
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  // Check-in extra photos (after first check-in)
  const [uploadingCheckInPhoto, setUploadingCheckInPhoto] = useState(false)
  const checkInExtraInputRef = useRef<HTMLInputElement>(null)

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Verify modal (helpdesk)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyStep, setVerifyStep] = useState<'choose' | 'reject'>('choose')
  const [rejectType, setRejectType] = useState<'FAILED' | 'REVISIT' | 'ROLLBACK'>('FAILED')
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Check-in flow state
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null)
  const [checkInPreview, setCheckInPreview] = useState<string | null>(null)
  const [checkInGps, setCheckInGps] = useState<{ lat: number; lng: number } | null>(null)
  const [checkInGpsLoading, setCheckInGpsLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const checkInInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setCurrentUser(JSON.parse(userStr))
  }, [])

  const fetchTask = useCallback(async () => {
    const token = localStorage.getItem('token')
    setIsLoading(true)
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTask(res.data)
    } catch {
      toast.error('โหลดข้อมูล Task ไม่สำเร็จ')
      router.back()
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => { fetchTask() }, [fetchTask])

  // ── Role flags (computed from state — defined before useEffects that depend on them) ──
  const userRoles: string[] = currentUser ? getUserRoles(currentUser) : []

  const isTech = userRoles.includes('TECHNICIAN')
  const isSupervisor = userRoles.includes('SUPERVISOR')
  const isHelpdesk = userRoles.includes('HELP_DESK') || userRoles.includes('IT_MANAGER') || userRoles.includes('SUPER_ADMIN')
  const canManage = isHelpdesk || isSupervisor
  const canAssign = isSupervisor || userRoles.includes('IT_MANAGER') || userRoles.includes('SUPER_ADMIN')
  const isAssignedTech = isTech && task?.assignedToId === currentUser?.id
  const PRE_CHECKIN_STATUSES = ['PENDING', 'SCHEDULED', 'RESCHEDULED']
  const isBlocked = isAssignedTech && PRE_CHECKIN_STATUSES.includes(task?.status ?? '')
  const canMedia = (isAssignedTech && task?.status === 'IN_PROGRESS') || userRoles.includes('HELP_DESK')

  // Sync assign form when task loads
  useEffect(() => {
    if (!task) return
    setAssignForm({
      assignedToId: task.assignedToId ? String(task.assignedToId) : '',
      scheduledDate: task.scheduledDate ? toLocalDateTimeInput(task.scheduledDate) : '',
      reason: '',
    })
  }, [task])

  // Fetch tech users for assign dropdown
  useEffect(() => {
    if (!canAssign) return
    const token = localStorage.getItem('token')
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { role: 'TECHNICIAN', status: 'ACTIVE' },
    }).then(res => setTechUsers(res.data.data || res.data || [])).catch(() => {})
  }, [canAssign])

  // ── Check-in flow ────────────────────────────────────────────────────────

  // Step 1: request GPS first — on success, open file picker
  const handleCheckInStart = () => {
    if (checkInGpsLoading) return
    setCheckInGpsLoading(true)
    setCheckInGps(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCheckInGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setCheckInGpsLoading(false)
        // GPS granted → open file/camera picker
        checkInInputRef.current?.click()
      },
      () => {
        toast.error('ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาเปิดสิทธิ์ Location แล้วลองใหม่')
        setCheckInGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  // Step 2: GPS already obtained — resize then set photo
  const handleCheckInPhotoSelect = async (files: FileList | null) => {
    const raw = files?.[0]
    if (!raw) return
    const file = await resizeImage(raw)
    if (checkInPreview) URL.revokeObjectURL(checkInPreview)
    setCheckInPhoto(file)
    setCheckInPreview(URL.createObjectURL(file))
  }

  const handleCheckInSubmit = async () => {
    if (!checkInPhoto || !checkInGps) return
    const token = localStorage.getItem('token')
    setCheckingIn(true)
    try {
      const fd = new FormData()
      fd.append('photo', checkInPhoto)
      fd.append('lat', String(checkInGps.lat))
      fd.append('lng', String(checkInGps.lng))
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/check-in`,
        fd,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } },
      )
      toast.success('Check-in สำเร็จ เริ่มงานได้เลย!')
      if (checkInPreview) URL.revokeObjectURL(checkInPreview)
      setCheckInPhoto(null)
      setCheckInPreview(null)
      setCheckInGps(null)
      fetchTask()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-in ไม่สำเร็จ')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCancelCheckIn = () => {
    if (checkInPreview) URL.revokeObjectURL(checkInPreview)
    setCheckInPhoto(null)
    setCheckInPreview(null)
    setCheckInGps(null)
    if (checkInInputRef.current) checkInInputRef.current.value = ''
  }

  // ── Other handlers ───────────────────────────────────────────────────────

  const handleAction = async (endpoint: string, body?: any) => {
    const token = localStorage.getItem('token')
    setActionLoading(true)
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/${endpoint}`,
        body || {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('บันทึกสำเร็จ')
      fetchTask()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectTask = async () => {
    const token = localStorage.getItem('token')
    setRejecting(true)
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/reject`,
        { type: rejectType, note: rejectNote.trim() || undefined },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const typeLabel = rejectType === 'FAILED' ? 'ล้มเหลว' : rejectType === 'REVISIT' ? 'Revisit' : 'Rollback'
      toast.success(`อัปเดตสถานะเป็น ${typeLabel} แล้ว`)
      setShowVerifyModal(false)
      setVerifyStep('choose')
      setRejectNote('')
      fetchTask()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setRejecting(false)
    }
  }

  const handleDeletePhoto = async (photoId: number) => {
    const ok = await confirmDialog({ title: 'ลบรูปนี้?', variant: 'danger', confirmLabel: 'ลบ' })
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/photos/${photoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ลบรูปสำเร็จ')
      fetchTask()
    } catch { toast.error('ลบรูปไม่สำเร็จ') }
  }

  const handleDeleteEquipment = async (eqId: number) => {
    const ok = await confirmDialog({ title: 'ลบรายการนี้?', variant: 'danger', confirmLabel: 'ลบ' })
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/equipment/${eqId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ลบสำเร็จ')
      fetchTask()
    } catch { toast.error('ลบไม่สำเร็จ') }
  }

  const openEditEquipment = (eq: any) => {
    const isReplace = !!(eq.oldModel || eq.oldSN)
    setEditingEqId(eq.id)
    setEqMode(isReplace ? 'replace' : 'add')
    setEqForm({ itemName: eq.itemName || '', oldModel: eq.oldModel || '', oldSN: eq.oldSN || '', newModel: eq.newModel || '', newSN: eq.newSN || '', notes: eq.notes || '' })
    setShowEquipmentForm(true)
  }

  const handleSaveEquipment = async () => {
    if (!eqForm.itemName.trim()) { toast.error('กรอกชื่ออุปกรณ์'); return }
    const token = localStorage.getItem('token')
    const payload = {
      itemName: eqForm.itemName.trim(),
      oldModel: eqMode === 'replace' ? eqForm.oldModel : '',
      oldSN: eqMode === 'replace' ? eqForm.oldSN : '',
      newModel: eqForm.newModel,
      newSN: eqForm.newSN,
      notes: eqForm.notes,
    }
    setAddingEq(true)
    try {
      if (editingEqId) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/equipment/${editingEqId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        toast.success('แก้ไขอุปกรณ์สำเร็จ')
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/equipment`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        toast.success('เพิ่มอุปกรณ์สำเร็จ')
      }
      setShowEquipmentForm(false)
      setEditingEqId(null)
      setEqForm({ itemName: '', oldModel: '', oldSN: '', newModel: '', newSN: '', notes: '' })
      fetchTask()
    } catch { toast.error(editingEqId ? 'แก้ไขไม่สำเร็จ' : 'เพิ่มอุปกรณ์ไม่สำเร็จ') } finally { setAddingEq(false) }
  }

  const handleDeleteChecklist = async (clId: number) => {
    const ok = await confirmDialog({ title: 'ลบ Checklist นี้?', variant: 'danger', confirmLabel: 'ลบ' })
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/checklists/${clId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ลบ Checklist สำเร็จ')
      fetchTask()
    } catch { toast.error('ลบไม่สำเร็จ') }
  }

  const MAX_PHOTOS = 5

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const resized = await Promise.all(Array.from(files).map(f => resizeImage(f)))
    const newStaged: StagedPhoto[] = resized.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }))
    setStagedPhotos(newStaged)
  }

  const handleAddCheckInPhoto = async (files: FileList | null) => {
    const raw = files?.[0]
    if (!raw) return
    const file = await resizeImage(raw)
    const checkInPhotos = (task?.photos || []).filter((p: any) => p.category === 'CHECK_IN')
    // +1 for primary checkInPhotoPath
    const primaryCount = task?.checkInPhotoPath ? 1 : 0
    if (primaryCount + checkInPhotos.length >= MAX_PHOTOS) {
      toast.error(`เพิ่มรูป Check-in ได้สูงสุด ${MAX_PHOTOS} รูป`)
      return
    }
    const token = localStorage.getItem('token')
    setUploadingCheckInPhoto(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('category', 'CHECK_IN')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/photos`,
        fd,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } },
      )
      toast.success('เพิ่มรูป Check-in สำเร็จ')
      fetchTask()
    } catch {
      toast.error('อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setUploadingCheckInPhoto(false)
      if (checkInExtraInputRef.current) checkInExtraInputRef.current.value = ''
    }
  }

  const handleUploadStagedPhotos = async () => {
    if (stagedPhotos.length === 0) return
    const token = localStorage.getItem('token')
    setUploadingPhotos(true)
    let successCount = 0
    for (const staged of stagedPhotos) {
      const fd = new FormData()
      fd.append('photo', staged.file)
      if (staged.caption.trim()) fd.append('comment', staged.caption.trim())
      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/photos`,
          fd,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } },
        )
        successCount++
      } catch { toast.error(`อัปโหลด ${staged.file.name} ไม่สำเร็จ`) }
    }
    if (successCount > 0) toast.success(`อัปโหลด ${successCount} รูปสำเร็จ`)
    stagedPhotos.forEach(s => URL.revokeObjectURL(s.previewUrl))
    setStagedPhotos([])
    setUploadingPhotos(false)
    fetchTask()
  }

  const handleSaveAssign = async () => {
    const token = localStorage.getItem('token')
    const originalDate = task?.scheduledDate ? toLocalDateTimeInput(task.scheduledDate) : ''
    const dateChanged = assignForm.scheduledDate !== originalDate && assignForm.scheduledDate !== ''

    if (dateChanged && task?.status !== 'PENDING' && !assignForm.reason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่เปลี่ยนวันนัดหมาย')
      return
    }

    setSavingAssign(true)
    try {
      const payload: any = {}
      if (assignForm.assignedToId) payload.assignedToId = parseInt(assignForm.assignedToId)
      else payload.assignedToId = null
      if (assignForm.scheduledDate && !dateChanged) payload.scheduledDate = assignForm.scheduledDate
      if (assignForm.scheduledDate && dateChanged && task?.status === 'PENDING') {
        payload.scheduledDate = assignForm.scheduledDate
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (dateChanged && task?.status !== 'PENDING' && assignForm.scheduledDate) {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/reschedule`,
          { scheduledDate: assignForm.scheduledDate, reason: assignForm.reason.trim() },
          { headers: { Authorization: `Bearer ${token}` } },
        )
      }

      toast.success('บันทึกการมอบหมายงานสำเร็จ')
      fetchTask()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSavingAssign(false)
    }
  }

  const formatDate = (d?: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }


  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 bg-slate-700 rounded w-48 animate-pulse" />
        <div className="glass-card rounded-xl animate-pulse overflow-hidden">
          <div className="h-1.5 bg-slate-600" />
          <div className="p-5 space-y-4">
            <div className="h-7 bg-slate-700 rounded w-2/3" />
            <div className="h-4 bg-slate-700 rounded w-1/2" />
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-slate-700 rounded" />)}
        </div>
      </div>
    )
  }

  if (!task) return null

  const { label, color, dot } = TASK_STATUS_LABELS[task.status] || { label: task.status, color: 'text-gray-400 bg-gray-800/60 border border-gray-700', dot: 'bg-gray-400' }
  const projectId = task.projectStore?.project?.id
  const projectColor = task.projectStore?.project?.color ?? themeHighlight
  const store = task.projectStore?.store
  const project = task.projectStore?.project

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        {projectId ? (
          <Link href={`/dashboard/projects/${projectId}`} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Briefcase className="w-3.5 h-3.5" />
          <span>{project?.name || 'Project'}</span>
          <span>/</span>
          <span className="text-gray-400">Task Detail</span>
        </div>
      </div>

      {/* ── Header Card ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: projectColor }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-white leading-tight">
              {task.title || project?.name}
            </h1>
            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              {label}
            </span>
          </div>
          <div className="my-3 border-t border-slate-700/50" />
          <div className="flex flex-wrap gap-2 items-center">
            {task.ticketNo && (
              <span className="flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-900/30 text-orange-300 border border-orange-500/30">
                <Hash className="w-3 h-3" />
                {task.ticketNo}
              </span>
            )}
            {project && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-slate-700/40 px-2.5 py-1 rounded-lg border border-slate-600/40">
                <Briefcase className="w-3 h-3" />
                {project.name}
              </span>
            )}
            {store && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-slate-700/40 px-2.5 py-1 rounded-lg border border-slate-600/40">
                <Building2 className="w-3 h-3" />
                <span>{formatStore(store)}</span>
                {store.province && <span className="text-gray-500">· {store.province}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="border-t border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-700/40">
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">ช่างรับผิดชอบ</p>
            <p className="text-sm text-white font-medium truncate">
              {task.assignedTo
                ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                : <span className="text-gray-500 italic text-xs">ยังไม่มอบหมาย</span>}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">วันนัดหมาย</p>
            <p className="text-sm text-white font-medium">
              {task.scheduledDate ? formatDate(task.scheduledDate) : <span className="text-gray-500">-</span>}
            </p>
          </div>
          {task.checkInAt && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Check-in</p>
              <p className="text-sm text-white font-medium">{formatDate(task.checkInAt)}</p>
            </div>
          )}
          {task.completedAt && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">เสร็จงานเมื่อ</p>
              <p className="text-sm text-white font-medium">{formatDate(task.completedAt)}</p>
            </div>
          )}
          {task.verifiedAt && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">ตรวจสอบเมื่อ</p>
              <p className="text-sm text-white font-medium">{formatDate(task.verifiedAt)}</p>
            </div>
          )}
        </div>

        {task.notes && (
          <div className="border-t border-slate-700/50 px-5 py-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">หมายเหตุ</p>
            <p className="text-sm text-gray-300">{task.notes}</p>
          </div>
        )}
      </div>

      {/* ── Assign Task Panel (Supervisor / Manager / Super_Admin only) ── */}
      {canAssign && !['COMPLETED', 'CANCELLED'].includes(task.status) && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeHighlight}25` }}>
              <User className="w-4 h-4" style={{ color: themeHighlight }} />
            </div>
            <h2 className="text-white font-semibold">มอบหมายงาน</h2>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Assign Technician */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">ช่างรับผิดชอบ</label>
                <select
                  value={assignForm.assignedToId}
                  onChange={(e) => setAssignForm(f => ({ ...f, assignedToId: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- ยังไม่มอบหมาย --</option>
                  {techUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scheduled Date */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> วันนัดหมาย
                </label>
                <input
                  type="datetime-local"
                  value={assignForm.scheduledDate}
                  onChange={(e) => setAssignForm(f => ({ ...f, scheduledDate: e.target.value, reason: '' }))}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Reason — only when rescheduling existing date */}
            {assignForm.scheduledDate !== (task.scheduledDate ? toLocalDateTimeInput(task.scheduledDate) : '') &&
              assignForm.scheduledDate !== '' &&
              task.status !== 'PENDING' && (
              <div className="rounded-lg border border-orange-800/50 bg-orange-900/15 p-3 space-y-2">
                <label className="block text-sm text-orange-400 font-medium">
                  เหตุผลที่เปลี่ยนวันนัดหมาย <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={assignForm.reason}
                  onChange={(e) => setAssignForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  placeholder="เช่น ลูกค้าขอเลื่อน, ช่างติดงานด่วน..."
                  className="w-full px-3 py-2 bg-slate-800/60 border border-orange-800/40 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSaveAssign}
                disabled={
                  savingAssign ||
                  (assignForm.scheduledDate !== (task.scheduledDate ? toLocalDateTimeInput(task.scheduledDate) : '') &&
                   assignForm.scheduledDate !== '' &&
                   task.status !== 'PENDING' &&
                   !assignForm.reason.trim())
                }
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: themeHighlight }}
              >
                <Save className="w-3.5 h-3.5" />
                {savingAssign ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection banner (above Check-in) ── */}
      {(() => {
        const rejectLog = [...(task.logs || [])].find((l: any) => l.action === 'REJECT')
        if (!rejectLog || task.status !== 'IN_PROGRESS') return null
        return (
          <div className="rounded-xl border border-red-500/40 bg-red-900/20 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              งานถูกส่งคืนให้แก้ไข
            </div>
            <p className="text-red-300 text-sm">{rejectLog.reason}</p>
            <p className="text-gray-500 text-xs">โดย {rejectLog.user?.firstName} {rejectLog.user?.lastName} · {formatDate(rejectLog.createdAt)}</p>
          </div>
        )
      })()}

      {/* ── Check-in Section (always visible) ── */}
      {(() => {
        const checkInExtraPhotos = (task.photos || []).filter((p: any) => p.category === 'CHECK_IN')
        const primaryCount = task.checkInPhotoPath ? 1 : 0
        const totalCheckIn = primaryCount + checkInExtraPhotos.length
        const canAddMoreCheckIn = isAssignedTech && task.status === 'IN_PROGRESS' && totalCheckIn < MAX_PHOTOS
        return (
          <div className="glass-card rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeHighlight}25` }}>
                  <Camera className="w-4 h-4" style={{ color: themeHighlight }} />
                </div>
                รูป Check-in
                {totalCheckIn > 0 && (
                  <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${totalCheckIn >= MAX_PHOTOS ? 'bg-red-900/40 text-red-400' : 'bg-slate-700/60 text-gray-400'}`}>
                    {totalCheckIn}/{MAX_PHOTOS}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {/* Add more check-in photos button */}
                {canAddMoreCheckIn && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: themeHighlight }}>
                    {uploadingCheckInPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    เพิ่มรูป
                    <input
                      ref={checkInExtraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingCheckInPhoto}
                      onChange={(e) => handleAddCheckInPhoto(e.target.files)}
                    />
                  </label>
                )}
                {task.checkInAt ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/30 border border-green-500/30 px-2.5 py-1 rounded-full font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Check-in แล้ว
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-slate-700/50 border border-slate-600/50 px-2.5 py-1 rounded-full font-medium">
                    <Lock className="w-3 h-3" />
                    ยังไม่ได้ Check-in
                  </span>
                )}
              </div>
            </div>

            <div className="p-5">
              {task.checkInPhotoPath ? (
                <div className="space-y-3">
                  {/* Primary check-in photo + additional check-in photos grid */}
                  <div className={`grid gap-2 ${totalCheckIn === 1 ? '' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {/* Primary photo */}
                    <div className="relative rounded-xl overflow-hidden bg-slate-700">
                      <img
                        src={getPhotoUrl(task.checkInPhotoPath)}
                        alt="Check-in photo"
                        className={`w-full object-cover cursor-pointer ${totalCheckIn === 1 ? 'max-h-72' : 'aspect-video'}`}
                        onClick={() => setLightboxUrl(getPhotoUrl(task.checkInPhotoPath))}
                      />
                      {isAssignedTech && !['COMPLETED', 'PENDING_VERIFY'].includes(task.status) && (
                        <button
                          onClick={async (e) => { e.stopPropagation()
                            const ok = await confirmDialog({
                              title: 'ลบรูป Check-in หลัก?',
                              message: 'งานจะกลับสู่สถานะนัดหมายแล้ว และต้อง Check-in ใหม่',
                              confirmLabel: 'ลบและ Check-in ใหม่',
                              cancelLabel: 'ยกเลิก',
                              variant: 'danger',
                            })
                            if (!ok) return
                            const token = localStorage.getItem('token')
                            try {
                              await axios.delete(
                                `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/check-in`,
                                { headers: { Authorization: `Bearer ${token}` } },
                              )
                              toast.success('ลบรูป Check-in แล้ว สามารถ Check-in ใหม่ได้')
                              fetchTask()
                            } catch (err: any) {
                              toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ')
                            }
                          }}
                          className="absolute top-1.5 right-1.5 bg-black/70 p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-black/90 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Additional check-in photos */}
                    {checkInExtraPhotos.map((photo: any) => (
                      <div key={photo.id} className="relative rounded-xl overflow-hidden bg-slate-700">
                        <img
                          src={getPhotoUrl(photo.photoPath)}
                          alt="Check-in photo"
                          className="w-full aspect-video object-cover cursor-pointer"
                          onClick={() => setLightboxUrl(getPhotoUrl(photo.photoPath))}
                        />
                        {isAssignedTech && !['COMPLETED', 'PENDING_VERIFY'].includes(task.status) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                            className="absolute top-1.5 right-1.5 bg-black/70 p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-black/90 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {task.checkInLat && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Navigation className="w-3.5 h-3.5 text-blue-400" />
                      <span>{task.checkInLat?.toFixed(6)}, {task.checkInLng?.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              ) : isAssignedTech && PRE_CHECKIN_STATUSES.includes(task.status) ? (
                /* Not yet checked in — show upload flow */
                checkInPreview ? (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden bg-slate-700">
                      <img src={checkInPreview} alt="Check-in preview" className="w-full max-h-64 object-cover" />
                      <button onClick={handleCancelCheckIn} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-lg text-gray-300 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {checkInGps && (
                      <div className="flex items-center gap-2 text-sm text-green-300 bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                        <Navigation className="w-4 h-4 flex-shrink-0" />
                        <span>GPS: {checkInGps.lat.toFixed(6)}, {checkInGps.lng.toFixed(6)}</span>
                      </div>
                    )}
                    <button
                      onClick={handleCheckInSubmit}
                      disabled={!checkInGps || checkingIn || checkInGpsLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: themeHighlight }}
                    >
                      {checkingIn ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลัง Check-in...</> : <><CheckCircle2 className="w-4 h-4" /> Check-in เริ่มงาน</>}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 p-8">
                    <button
                      onClick={handleCheckInStart}
                      disabled={checkInGpsLoading}
                      className="flex flex-col items-center gap-3 w-full rounded-xl border-2 border-dashed p-8 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ borderColor: checkInGpsLoading ? '#6366f1' : `${themeHighlight}60`, backgroundColor: checkInGpsLoading ? 'rgba(99,102,241,0.08)' : `${themeHighlight}08` }}
                    >
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: checkInGpsLoading ? 'rgba(99,102,241,0.15)' : `${themeHighlight}20` }}>
                        {checkInGpsLoading ? <Loader2 className="w-7 h-7 animate-spin text-indigo-400" /> : <Camera className="w-7 h-7" style={{ color: themeHighlight }} />}
                      </div>
                      <div className="text-center">
                        {checkInGpsLoading
                          ? <><p className="text-indigo-300 font-semibold">กำลังระบุตำแหน่ง GPS...</p><p className="text-gray-400 text-xs mt-1">กรุณาอนุญาตการเข้าถึงตำแหน่ง</p></>
                          : <><p className="text-white font-semibold">ถ่ายรูป / เลือกรูป Check-in</p><p className="text-gray-400 text-xs mt-1">ระบบจะขอสิทธิ์ GPS ก่อนเปิดกล้อง</p></>
                        }
                      </div>
                    </button>
                    <input ref={checkInInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCheckInPhotoSelect(e.target.files)} />
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-700/60 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-500" />
                  </div>
                  <p className="text-gray-500 text-sm">ยังไม่มีรูป Check-in</p>
                  {!task.assignedTo && <p className="text-gray-600 text-xs">รอมอบหมายช่าง</p>}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Work Photos ── */}
      {isBlocked ? (
        <LockedSection>
          <div className="p-5 opacity-30 pointer-events-none">
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Camera className="w-4 h-4" style={{ color: themeHighlight }} />
              รูปภาพงาน (0)
            </h2>
            <p className="text-gray-500 text-sm text-center py-4">ยังไม่มีรูปภาพ</p>
          </div>
        </LockedSection>
      ) : (
        <div className="glass-card rounded-xl p-5 space-y-4">
          {(() => {
            const workPhotos = (task.photos || []).filter((p: any) => p.category !== 'CHECK_IN')
            return (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4" style={{ color: themeHighlight }} />
                    รูปภาพงาน ({workPhotos.length})
                  </h2>
                  {canMedia && (
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm cursor-pointer hover:opacity-90" style={{ backgroundColor: themeHighlight }}>
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มรูป
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
                    </label>
                  )}
                </div>
                {workPhotos.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">ยังไม่มีรูปภาพ</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {workPhotos.map((photo: any) => (
                      <div key={photo.id} className="relative rounded-xl overflow-hidden bg-slate-700/50 border border-slate-700/60 cursor-pointer" onClick={() => setLightboxUrl(getPhotoUrl(photo.photoPath))}>
                        <img src={getPhotoUrl(photo.photoPath)} alt={photo.comment || 'task photo'} className="w-full aspect-video object-cover" />
                        {photo.comment && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-4 pb-2">
                            <div className="flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                              <p className="text-white text-xs font-medium truncate">{photo.comment}</p>
                            </div>
                          </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }} className="absolute top-1.5 right-1.5 bg-black/70 p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-black/90 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── Equipment ── */}
      {isBlocked ? (
        <LockedSection>
          <div className="p-5 opacity-30 pointer-events-none">
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Package className="w-4 h-4" style={{ color: themeHighlight }} />
              อุปกรณ์ที่เปลี่ยน (0)
            </h2>
            <p className="text-gray-500 text-sm text-center py-2">ยังไม่มีรายการอุปกรณ์</p>
          </div>
        </LockedSection>
      ) : (
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: themeHighlight }} />
              อุปกรณ์ที่เปลี่ยน ({task.equipment?.length || 0})
            </h2>
            {(canMedia) && (
              <button
                onClick={() => { setEqMode('replace'); setEqForm({ itemName: '', oldModel: '', oldSN: '', newModel: '', newSN: '', notes: '' }); setShowEquipmentForm(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm hover:opacity-90"
                style={{ backgroundColor: themeHighlight }}
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่ม
              </button>
            )}
          </div>
          {task.equipment?.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-2">ยังไม่มีรายการอุปกรณ์</p>
          ) : (
            <div className="space-y-2">
              {task.equipment.map((eq: any) => {
                const isReplace = !!(eq.oldModel || eq.oldSN)
                return (
                  <div
                    key={eq.id}
                    onClick={() => canMedia && openEditEquipment(eq)}
                    className={`flex items-center justify-between bg-slate-700/30 rounded-lg px-4 py-3 transition-colors ${canMedia ? 'cursor-pointer hover:bg-slate-700/60' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{eq.itemName}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isReplace ? 'bg-orange-900/40 text-orange-400' : 'bg-green-900/40 text-green-400'}`}>
                          {isReplace ? 'เปลี่ยน' : 'เพิ่ม'}
                        </span>
                      </div>
                      {isReplace && (
                        <p className="text-gray-400 text-xs mt-0.5">เดิม: {eq.oldModel || '-'} {eq.oldSN && `(S/N: ${eq.oldSN})`}</p>
                      )}
                      {(eq.newModel || eq.newSN) && (
                        <p className="text-gray-400 text-xs">{isReplace ? 'ใหม่' : 'รุ่น'}: {eq.newModel || '-'} {eq.newSN && `(S/N: ${eq.newSN})`}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEquipment(eq.id) }}
                      className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Checklists ── */}
      {isBlocked ? (
        <LockedSection>
          <div className="p-5 opacity-30 pointer-events-none">
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4" style={{ color: themeHighlight }} />
              Checklist (0)
            </h2>
            <p className="text-gray-500 text-sm text-center py-2">ยังไม่มี Checklist</p>
          </div>
        </LockedSection>
      ) : (
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4" style={{ color: themeHighlight }} />
              Checklist ({task.checklists?.length || 0})
            </h2>
            {(canMedia) && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm cursor-pointer hover:opacity-90"
                style={{ backgroundColor: themeHighlight }}>
                <Plus className="w-3.5 h-3.5" />
                อัปโหลด
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const token = localStorage.getItem('token')
                    const fd = new FormData()
                    fd.append('file', file)
                    try {
                      await axios.post(
                        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}/checklists`,
                        fd,
                        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } },
                      )
                      toast.success('อัปโหลด Checklist สำเร็จ')
                      fetchTask()
                    } catch { toast.error('อัปโหลดไม่สำเร็จ') }
                  }}
                />
              </label>
            )}
          </div>
          {task.checklists?.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-2">ยังไม่มี Checklist</p>
          ) : (
            <div className="space-y-2">
              {task.checklists.map((cl: any) => (
                <div key={cl.id} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-4 py-3">
                  <a
                    href={getPhotoUrl(cl.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm truncate"
                  >
                    {cl.fileName}
                  </a>
                  <button onClick={() => handleDeleteChecklist(cl.id)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Complete button (tech, after checklist) ── */}
      {isAssignedTech && task.status === 'IN_PROGRESS' && (() => {
        const workPhotos = (task.photos || []).filter((p: any) => p.category !== 'CHECK_IN')
        const hasCheckIn = !!task.checkInPhotoPath
        const hasWorkPhotos = workPhotos.length > 0
        const hasChecklist = (task.checklists?.length || 0) > 0
        const canComplete = hasCheckIn && hasWorkPhotos && hasChecklist

        const wasRejected = (task.logs || []).some((l: any) => l.action === 'REJECT')

        const missing: string[] = []
        if (!hasCheckIn) missing.push('รูป Check-in')
        if (!hasWorkPhotos) missing.push('รูปภาพงาน')
        if (!hasChecklist) missing.push('Checklist')

        return (
          <div className="glass-card rounded-xl p-4 space-y-3">
            {!canComplete ? (
              <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>ต้องเพิ่ม <strong>{missing.join(' และ ')}</strong> ก่อนจึงจะปิดงานได้</span>
              </div>
            ) : wasRejected ? (
              <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-900/20 border border-blue-500/30 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>แก้ไขครบแล้ว — กดปิดงานเพื่อส่งตรวจสอบอีกครั้ง</span>
              </div>
            ) : null}
            <button
              onClick={() => handleAction('complete')}
              disabled={actionLoading || !canComplete}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-500"
            >
              <CheckCircle2 className="w-4 h-4" />
              {actionLoading ? 'กำลังบันทึก...' : wasRejected ? 'ส่งตรวจสอบอีกครั้ง' : 'ปิดงาน (ส่งตรวจสอบ)'}
            </button>
          </div>
        )
      })()}

      {/* ── Helpdesk verify button (below Checklist) ── */}
      {isHelpdesk && task.status === 'PENDING_VERIFY' && (
        <button
          onClick={() => { setVerifyStep('choose'); setRejectNote(''); setShowVerifyModal(true) }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          ตรวจสอบและยืนยันปิดงาน
        </button>
      )}

      {/* Edit Log */}
      {task.logs && task.logs.length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            ประวัติการแก้ไข
          </h2>
          <div className="space-y-2">
            {task.logs.map((log: any) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-300">{log.message}</p>
                  {log.reason && (
                    <p className="text-gray-500 text-xs mt-0.5">เหตุผล: {log.reason}</p>
                  )}
                  <p className="text-gray-600 text-xs mt-0.5">
                    {new Date(log.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Photo Staging Modal ── */}
      {stagedPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <div>
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <Upload className="w-4 h-4" style={{ color: themeHighlight }} />
                  อัปโหลดรูปภาพ
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">ระบุชื่อรูปเพื่อบอกจุดที่ถ่าย ({stagedPhotos.length} รูป)</p>
              </div>
              <button
                onClick={() => {
                  stagedPhotos.forEach(s => URL.revokeObjectURL(s.previewUrl))
                  setStagedPhotos([])
                }}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {stagedPhotos.map((staged, idx) => (
                <div key={idx} className="flex gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-700/50">
                  <div className="w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-700">
                    <img src={staged.previewUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <p className="text-xs text-gray-500 truncate">{staged.file.name}</p>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <input
                        type="text"
                        value={staged.caption}
                        onChange={(e) => {
                          const updated = [...stagedPhotos]
                          updated[idx] = { ...updated[idx], caption: e.target.value }
                          setStagedPhotos(updated)
                        }}
                        placeholder="ชื่อรูป / ระบุจุดที่ถ่าย เช่น มุมซ้ายห้องเซิร์ฟเวอร์"
                        className="w-full pl-9 pr-3 py-2 bg-slate-600/50 border border-slate-500/60 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(staged.previewUrl)
                      setStagedPhotos(prev => prev.filter((_, i) => i !== idx))
                    }}
                    className="self-start text-gray-500 hover:text-red-400 transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-700/60 flex gap-3">
              <button
                onClick={handleUploadStagedPhotos}
                disabled={uploadingPhotos}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: themeHighlight }}
              >
                <Upload className="w-4 h-4" />
                {uploadingPhotos ? 'กำลังอัปโหลด...' : `อัปโหลด ${stagedPhotos.length} รูป`}
              </button>
              <button
                onClick={() => {
                  stagedPhotos.forEach(s => URL.revokeObjectURL(s.previewUrl))
                  setStagedPhotos([])
                }}
                disabled={uploadingPhotos}
                className="px-5 py-2.5 rounded-xl text-gray-400 hover:text-white text-sm hover:bg-slate-700/50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {showEquipmentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">{editingEqId ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}</h3>
              <button onClick={() => { setShowEquipmentForm(false); setEditingEqId(null) }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-600 text-sm font-medium">
              <button
                onClick={() => setEqMode('replace')}
                className={`flex-1 py-2 transition-colors ${eqMode === 'replace' ? 'text-white' : 'text-gray-400 hover:text-gray-200 bg-slate-800/60'}`}
                style={eqMode === 'replace' ? { backgroundColor: themeHighlight } : {}}
              >
                เปลี่ยน
              </button>
              <button
                onClick={() => setEqMode('add')}
                className={`flex-1 py-2 transition-colors ${eqMode === 'add' ? 'text-white' : 'text-gray-400 hover:text-gray-200 bg-slate-800/60'}`}
                style={eqMode === 'add' ? { backgroundColor: themeHighlight } : {}}
              >
                เพิ่ม
              </button>
            </div>

            {/* ชื่ออุปกรณ์ */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">ชื่ออุปกรณ์ *</label>
              <input
                type="text"
                value={eqForm.itemName}
                onChange={(e) => setEqForm(f => ({ ...f, itemName: e.target.value }))}
                placeholder="เช่น Network Switch"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Old fields — only in replace mode */}
            {eqMode === 'replace' && (
              <div className="space-y-3 rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ของเดิม</p>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">รุ่นเดิม</label>
                  <input
                    type="text"
                    value={eqForm.oldModel}
                    onChange={(e) => setEqForm(f => ({ ...f, oldModel: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">S/N เดิม</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={eqForm.oldSN}
                      onChange={(e) => setEqForm(f => ({ ...f, oldSN: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="สแกนหรือพิมพ์"
                    />
                    <button
                      type="button"
                      onClick={() => setScanTarget('oldSN')}
                      className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-gray-300 hover:text-white hover:border-blue-500 transition-colors"
                      title="สแกน Barcode / QR"
                    >
                      <ScanLine className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* New fields */}
            <div className="space-y-3 rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{eqMode === 'replace' ? 'ของใหม่' : 'ข้อมูลอุปกรณ์'}</p>
              <div>
                <label className="block text-sm text-gray-300 mb-1">รุ่น</label>
                <input
                  type="text"
                  value={eqForm.newModel}
                  onChange={(e) => setEqForm(f => ({ ...f, newModel: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">S/N</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eqForm.newSN}
                    onChange={(e) => setEqForm(f => ({ ...f, newSN: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="สแกนหรือพิมพ์"
                  />
                  <button
                    type="button"
                    onClick={() => setScanTarget('newSN')}
                    className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-gray-300 hover:text-white hover:border-blue-500 transition-colors"
                    title="สแกน Barcode / QR"
                  >
                    <ScanLine className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveEquipment}
                disabled={addingEq}
                className="flex-1 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: themeHighlight }}
              >
                {addingEq ? 'กำลังบันทึก...' : editingEqId ? 'บันทึกการแก้ไข' : eqMode === 'replace' ? 'บันทึกการเปลี่ยน' : 'บันทึกการเพิ่ม'}
              </button>
              <button onClick={() => { setShowEquipmentForm(false); setEditingEqId(null) }} className="flex-1 py-2 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Verify Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                {verifyStep === 'choose' ? 'ตรวจสอบและยืนยันปิดงาน' : 'อัปเดตสถานะงาน'}
              </h3>
              <button
                onClick={() => { setShowVerifyModal(false); setVerifyStep('choose'); setRejectNote('') }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {verifyStep === 'choose' ? (
              /* Step 1: Choose confirm or update */
              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-400 text-center pb-1">เลือกผลการตรวจสอบสำหรับงานนี้</p>
                <button
                  onClick={() => handleAction('verify').then(() => setShowVerifyModal(false))}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white font-semibold text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {actionLoading ? 'กำลังบันทึก...' : 'ยืนยันปิดงาน (Confirm Close)'}
                </button>
                <button
                  onClick={() => setVerifyStep('reject')}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white font-semibold text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-50 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  อัปเดตสถานะ (Update)
                </button>
                <button
                  onClick={() => { setShowVerifyModal(false); setVerifyStep('choose') }}
                  className="w-full py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              /* Step 2: Select rejection type + note */
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-300">เลือกประเภทการอัปเดต</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { type: 'FAILED',   label: 'ล้มเหลว',  icon: '✕', cls: 'border-red-500/50 bg-red-900/20 text-red-300',    sel: 'border-red-500 bg-red-700/40 text-red-200' },
                    { type: 'REVISIT',  label: 'Revisit',   icon: '↩', cls: 'border-pink-500/50 bg-pink-900/20 text-pink-300', sel: 'border-pink-500 bg-pink-700/40 text-pink-200' },
                    { type: 'ROLLBACK', label: 'Rollback',  icon: '⟲', cls: 'border-amber-500/50 bg-amber-900/20 text-amber-300', sel: 'border-amber-500 bg-amber-700/40 text-amber-200' },
                  ] as const).map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => setRejectType(opt.type)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-semibold transition-all ${rejectType === opt.type ? opt.sel : opt.cls} hover:opacity-90`}
                    >
                      <span className="text-lg leading-none">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">หมายเหตุ (ไม่บังคับ)</label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={3}
                    placeholder="เช่น รูปภาพงานไม่ครบ, อุปกรณ์ไม่ตรงสเปค..."
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-slate-500 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleRejectTask}
                    disabled={rejecting}
                    className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold bg-slate-600 hover:bg-slate-500 disabled:opacity-40 transition-opacity"
                  >
                    {rejecting ? 'กำลังบันทึก...' : 'ยืนยันอัปเดต'}
                  </button>
                  <button
                    onClick={() => setVerifyStep('choose')}
                    disabled={rejecting}
                    className="px-5 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50"
                  >
                    ย้อนกลับ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {scanTarget && (
        <BarcodeScanner
          onScan={(result) => {
            setEqForm(f => ({ ...f, [scanTarget]: result }))
            setScanTarget(null)
          }}
          onClose={() => setScanTarget(null)}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {confirmDialogEl}
    </div>
  )
}
