// app/(dashboard)/dashboard/outsource/[id]/page.tsx - Outsource Job Detail
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ChevronLeft,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Trash2,
  ExternalLink,
  Calendar,
  ShieldCheck,
  XCircle,
  ShoppingBag,
  UserCheck,
  Upload,
  FileText,
  Package,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import { useRef } from 'react'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { getHighestRole } from '@/config/permissions'

// ─── Status & urgency maps ─────────────────────────────────────────
const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  OPEN: 'bg-green-500/20 text-green-400 border border-green-500/30',
  BIDDING_CLOSED: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  AWARDED: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  IN_PROGRESS: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  COMPLETED: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  DOCUMENT_SUBMITTED: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  VERIFIED: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border border-red-500/30',
  PAID: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-500 border border-gray-500/30',
  PENDING_CANCEL: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
}
const statusLabels: Record<string, string> = {
  DRAFT: 'ร่าง', PENDING_APPROVAL: 'รออนุมัติ', OPEN: 'เปิดรับงาน', BIDDING_CLOSED: 'ปิดรับงาน',
  AWARDED: 'กำลังดำเนินการ', IN_PROGRESS: 'กำลังดำเนินการ', COMPLETED: 'งานเสร็จ',
  DOCUMENT_SUBMITTED: 'ส่งเอกสารแล้ว', VERIFIED: 'ตรวจสอบเอกสารแล้ว', REJECTED: 'ไม่ผ่าน', PAID: 'จ่ายเงินแล้ว', CANCELLED: 'ยกเลิก',
  PENDING_CANCEL: 'รอยืนยันยกเลิก',
}
const urgencyColors: Record<string, string> = {
  LOW: 'text-gray-400', NORMAL: 'text-blue-400', HIGH: 'text-orange-400', URGENT: 'text-red-400',
}

export default function OutsourceJobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id

  const [user, setUser] = useState<any>(null)
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const [showPayment, setShowPayment] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showReject, setShowReject] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setUser(JSON.parse(userStr))
  }, [])

  useEffect(() => {
    if (user) fetchJob()
  }, [user, jobId])

  const token = () => localStorage.getItem('token')
  const config = () => ({ headers: { Authorization: `Bearer ${token()}` } })

  const highestRole = getHighestRole(user) || ''
  // Role flags derived from highest-ranking role so multi-role users always
  // behave according to their most privileged role.
  const isITManager = ['SUPER_ADMIN', 'IT_MANAGER'].includes(highestRole)
  const isSupervisor = highestRole === 'SUPERVISOR'
  const isFinance = highestRole === 'FINANCE_ADMIN' || isITManager
  const isAdmin = isITManager || isSupervisor || isFinance || highestRole === 'HELP_DESK'
  const isTechnician = !isAdmin && highestRole === 'TECHNICIAN'
  const isOutsource = user?.technicianType === 'OUTSOURCE'

  const fetchJob = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}`, config())
      setJob(res.data)
    } catch {
      toast.error('ไม่พบงาน Outsource')
      router.push('/dashboard/outsource')
    } finally {
      setLoading(false)
    }
  }

  const formatBudget = (min: any, max: any) => {
    if (!min && !max) return 'ไม่ระบุ'
    if (min && max) return `${Number(min).toLocaleString()} - ${Number(max).toLocaleString()} บาท`
    if (min) return `ตั้งแต่ ${Number(min).toLocaleString()} บาท`
    if (max) return `ไม่เกิน ${Number(max).toLocaleString()} บาท`
    return 'ไม่ระบุ'
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  const formatDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ─── Actions ──────────────────────────────────────────────────────
  const handlePayment = async (data: { amount: number; note: string; withholdingTax?: number; netPaymentAmount?: number; paymentSlipPath?: string }) => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/pay`, {
        paymentAmount: data.amount,
        paymentNote: data.note,
        withholdingTax: data.withholdingTax,
        netPaymentAmount: data.netPaymentAmount,
        paymentSlipPath: data.paymentSlipPath,
      }, config())
      toast.success('บันทึกการจ่ายเงินสำเร็จ')
      setShowPayment(false)
      fetchJob()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const handleCancel = async (reason: string) => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/cancel`, { reason }, config())
      toast.success('ยกเลิกงานสำเร็จ')
      setShowCancel(false)
      fetchJob()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const handleAcceptJob = async () => {
    if (!confirm('ยืนยันรับงานนี้? เมื่อรับแล้วจะถูกมอบหมายเป็นผู้ดูแล Incident นี้')) return
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/accept`, {}, config())
      toast.success('รับงานสำเร็จ! งานจะปรากฏใน Incident ของคุณ')
      fetchJob()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const handleConfirmCancel = async () => {
    if (!confirm('ยืนยันยกเลิกงานนี้? การยกเลิกจะทำให้ Incident กลับสู่สถานะ OPEN')) return
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/confirm-cancel`, {}, config())
      toast.success('ยืนยันยกเลิกงานสำเร็จ')
      fetchJob()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const handleApprove = async () => {
    if (!confirm('ยืนยันอนุมัติงาน Outsource นี้?')) return
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/approve`, { action: 'APPROVED' }, config())
      toast.success('อนุมัติงานสำเร็จ')
      fetchJob()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const handleReject = async (reason: string) => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/approve`, { action: 'REJECTED', rejectionReason: reason }, config())
      toast.success('ปฏิเสธงานแล้ว')
      setShowReject(false)
      fetchJob()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  // ─── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!job) return null

  const isAwarded = job.awardedToId === user?.id

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={() => router.back()} className="inline-flex items-center justify-center p-2.5 bg-slate-700/50 hover:bg-slate-600/70 text-gray-200 hover:text-white border border-slate-600/50 rounded-xl transition-all duration-200 shrink-0 mt-0.5" title="กลับไปก่อนหน้า">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-blue-400">{job.jobCode}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                {statusLabels[job.status]}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                job.jobType === 'DIRECT_ASSIGN'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              }`}>
                {job.jobType === 'DIRECT_ASSIGN' ? 'มอบหมายเจาะจง' : 'Marketplace'}
              </span>
              <span className={`text-xs font-medium ${urgencyColors[job.urgencyLevel]}`}>
                {job.urgencyLevel === 'URGENT' && '!!! '}{job.urgencyLevel === 'HIGH' && '!! '}{job.urgencyLevel}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">{job.title}</h1>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* IT Manager: Approve / Reject */}
          {isITManager && job.status === 'PENDING_APPROVAL' && (
            <>
              <button onClick={handleApprove} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> อนุมัติ
              </button>
              <button onClick={() => setShowReject(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition flex items-center gap-2">
                <XCircle className="h-4 w-4" /> ปฏิเสธ
              </button>
            </>
          )}
          {isFinance && job.status === 'VERIFIED' && job.paymentStatus !== 'PAID' && (
            <button onClick={() => setShowPayment(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> จ่ายเงิน
            </button>
          )}
          {isSupervisor && !['PAID', 'CANCELLED', 'VERIFIED', 'PENDING_CANCEL', 'PENDING_APPROVAL'].includes(job.status) && (
            <button onClick={() => setShowCancel(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> ขอยกเลิก
            </button>
          )}
          {(isTechnician && isAwarded || isITManager) && job.status === 'PENDING_CANCEL' && (
            <button onClick={handleConfirmCancel} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> อนุมัติยกเลิก
            </button>
          )}
        </div>
      </div>

      {/* Pending Approval Banner */}
      {job.status === 'PENDING_APPROVAL' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">รอ IT Manager อนุมัติ</h3>
              <p className="text-sm text-amber-400/80 mt-1">
                งานนี้ ({job.jobType === 'DIRECT_ASSIGN' ? 'มอบหมายเจาะจง' : 'Marketplace'}) กำลังรอการอนุมัติจาก IT Manager
                {job.jobType === 'DIRECT_ASSIGN' && job.awardedTo && (
                  <span> — มอบหมายให้: <strong>{job.awardedTo.firstName} {job.awardedTo.lastName}</strong></span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Info */}
      {job.approvalStatus === 'REJECTED' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">งานถูกปฏิเสธ</h3>
              {job.rejectionReason && <p className="text-sm text-red-400/80 mt-1">เหตุผล: {job.rejectionReason}</p>}
              {job.approvedBy && <p className="text-xs text-red-400/60 mt-1">โดย: {job.approvedBy.firstName} {job.approvedBy.lastName}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Pending Cancel Banner */}
      {job.status === 'PENDING_CANCEL' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-orange-400 font-semibold">Supervisor ขอยกเลิกงาน — รอการอนุมัติ</h3>
              <p className="text-sm text-gray-300 mt-1">
                รอการอนุมัติจาก Outsource เจ้าของงาน หรือ IT Manager
              </p>
              {job.cancellationReason && (
                <p className="text-sm text-white mt-2 bg-slate-700/50 rounded-lg p-3">
                  <span className="text-gray-400">เหตุผล:</span> {job.cancellationReason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job Information */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">รายละเอียดงาน</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-400">Description</p>
            <p className="text-white whitespace-pre-wrap">{job.description}</p>
          </div>
          {job.requirements && (
            <div>
              <p className="text-sm text-gray-400">Requirements</p>
              <p className="text-white whitespace-pre-wrap">{job.requirements}</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-700/50">
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Location</p>
              <p className="text-sm text-white mt-0.5">
                {job.incident?.store
                  ? `${formatStore(job.incident.store)}${job.incident.store.address ? ' - ' + job.incident.store.address : ''}`
                  : job.location || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> ราคาจ้าง</p>
              <p className="text-sm text-emerald-400 font-semibold mt-0.5">{job.agreedPrice ? `${Number(job.agreedPrice).toLocaleString()} บาท` : formatBudget(job.budgetMin, job.budgetMax)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Estimated</p>
              <p className="text-sm text-white mt-0.5">{job.estimatedHours ? `${job.estimatedHours} ชม.` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> นัดเข้างาน</p>
              <p className="text-sm text-white mt-0.5">{job.deadline ? formatDate(job.deadline) : '-'}</p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-700/50 flex flex-wrap gap-6 text-sm text-gray-400">
            <span>Posted by: <span className="text-white">{job.postedBy?.firstName} {job.postedBy?.lastName}</span></span>
            <span>Posted: <span className="text-white">{job.postedAt ? formatDateTime(job.postedAt) : '-'}</span></span>
            {job.awardedTo && (
              <span>Awarded to: <span className="text-white">{job.awardedTo.firstName} {job.awardedTo.lastName}</span></span>
            )}
          </div>
        </div>
      </div>

      {/* Linked Incident */}
      {job.incident && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Incident ที่เกี่ยวข้อง</h2>
          <Link href={`/dashboard/incidents/${job.incident.id}`} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-blue-400">{job.incident.ticketNumber}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/30 text-gray-300">{job.incident.status}</span>
              </div>
              <p className="text-white mt-1">{job.incident.title}</p>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center">
                <MapPin className="h-3.5 w-3.5 mr-1" />
                {formatStore(job.incident.store)}
              </p>
            </div>
            <ExternalLink className="h-5 w-5 text-gray-400" />
          </Link>
        </div>
      )}

      {/* Accept Job (Outsource Technician, OPEN status) */}
      {isTechnician && isOutsource && job.status === 'OPEN' && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" /> รับงานนี้
          </h2>
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-300 mb-3">เมื่อกดรับงาน:</p>
            <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>คุณจะถูกมอบหมายเป็นช่างดูแล Incident นี้</li>
              <li>งานจะหายจาก Marketplace และไปอยู่ใน Incident ของคุณ</li>
              <li>ดำเนินงานเหมือนช่างประจำ (Check-in, แก้ไข, ปิดงาน)</li>
            </ul>
            {job.agreedPrice && (
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                <p className="text-sm text-gray-400">ค่าจ้างที่กำหนด</p>
                <p className="text-xl font-bold text-emerald-400">{Number(job.agreedPrice).toLocaleString()} บาท</p>
              </div>
            )}
            {job.deadline && (
              <div className="mt-2">
                <p className="text-sm text-gray-400">วันที่นัดเข้างาน</p>
                <p className="text-white font-medium">{formatDate(job.deadline)}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleAcceptJob}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
          >
            <CheckCircle2 className="h-5 w-5" /> ยอมรับเงื่อนไขและรับงาน
          </button>
        </div>
      )}

      {/* Document Submission (Outsource tech - COMPLETED or DOCUMENT_SUBMITTED) */}
      {isTechnician && isAwarded && (job.status === 'COMPLETED' || job.status === 'DOCUMENT_SUBMITTED') && (
        <DocumentSubmissionSection jobId={jobId} job={job} onSuccess={fetchJob} />
      )}

      {/* Submitted Documents Display (for Finance/Admin — outsource tech sees DocumentSubmissionSection) */}
      {job.status === 'DOCUMENT_SUBMITTED' && !(isTechnician && isAwarded) && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" /> เอกสารที่ส่ง
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.documentSlipPath && (
              <div>
                <p className="text-sm text-gray-400 mb-2">สลิป</p>
                <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${job.documentSlipPath}`} target="_blank" rel="noopener noreferrer">
                  <img src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${job.documentSlipPath}`} alt="สลิป" className="max-h-48 rounded-lg border border-slate-600 hover:border-blue-500 transition" />
                </a>
              </div>
            )}
            {job.documentWorkOrderPath && (
              <div>
                <p className="text-sm text-gray-400 mb-2">ใบงาน</p>
                <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${job.documentWorkOrderPath}`} target="_blank" rel="noopener noreferrer">
                  <img src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${job.documentWorkOrderPath}`} alt="ใบงาน" className="max-h-48 rounded-lg border border-slate-600 hover:border-blue-500 transition" />
                </a>
              </div>
            )}
          </div>
          {job.documentPhotos && job.documentPhotos.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">รูปเพิ่มเติม ({job.documentPhotos.length} รูป)</p>
              <div className="flex flex-wrap gap-3">
                {job.documentPhotos.map((p: string, i: number) => (
                  <a key={i} href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${p}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${p}`} alt={`Photo ${i+1}`} className="h-24 rounded-lg border border-slate-600 hover:border-blue-500 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {job.shippingCost && Number(job.shippingCost) > 0 && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
              <p className="text-sm text-gray-400">ค่าส่งเอกสาร</p>
              <p className="text-lg font-semibold text-white">{Number(job.shippingCost).toLocaleString()} บาท</p>
            </div>
          )}
          {job.documentSubmittedAt && (
            <p className="text-sm text-gray-500 mt-3">ส่งเมื่อ: {formatDateTime(job.documentSubmittedAt)}</p>
          )}

          {/* Review Notes History */}
          <DocumentReviewNotesDisplay notes={job.documentReviewNotes} />

          {/* Finance Confirmation Buttons */}
          {isFinance && (
            <FinanceConfirmationSection job={job} jobId={jobId} onSuccess={fetchJob} />
          )}
        </div>
      )}

      {/* Payment Info */}
      {job.paymentStatus && job.paymentStatus !== 'UNPAID' && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">การจ่ายเงิน</h2>
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              job.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>{job.paymentStatus === 'PAID' ? 'จ่ายแล้ว' : job.paymentStatus}</span>
          </div>
          {job.paymentAmount && (
            <div className="mt-3 space-y-1">
              {job.withholdingTax ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">ยอดเต็ม</span>
                    <span className="text-white">{Number(job.paymentAmount).toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">หักภาษี ณ ที่จ่าย 3%</span>
                    <span className="text-red-400">-{Number(job.withholdingTax).toLocaleString()} บาท</span>
                  </div>
                  <div className="border-t border-slate-600 pt-1 flex justify-between text-sm font-semibold">
                    <span className="text-gray-300">ยอดสุทธิ</span>
                    <span className="text-emerald-400">{Number(job.netPaymentAmount).toLocaleString()} บาท</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">จำนวนเงิน</span>
                  <span className="text-lg font-semibold text-emerald-400">{Number(job.paymentAmount).toLocaleString()} บาท</span>
                </div>
              )}
            </div>
          )}
          {job.paymentNote && <p className="text-gray-300 mt-3 text-sm">{job.paymentNote}</p>}
          {job.paidAt && <p className="text-sm text-gray-400 mt-2">จ่ายเมื่อ: {formatDateTime(job.paidAt)}</p>}
          {job.paymentSlipPath && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">สลิปโอนเงิน</p>
              <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${job.paymentSlipPath}`} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${job.paymentSlipPath}`}
                  alt="สลิปโอนเงิน"
                  className="max-w-xs rounded-lg border border-slate-600 hover:border-blue-500 transition cursor-pointer"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────────── */}
      {showPayment && <PaymentModal agreedPrice={job.agreedPrice} shippingCost={job.shippingCost} jobId={jobId} onConfirm={handlePayment} onClose={() => setShowPayment(false)} />}
      {showCancel && <CancelModal onConfirm={handleCancel} onClose={() => setShowCancel(false)} />}
      {showReject && <RejectModal onConfirm={handleReject} onClose={() => setShowReject(false)} />}
    </div>
  )
}

// ─── Modal Components ─────────────────────────────────────────────

function ModalWrapper({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

function PaymentModal({ agreedPrice, shippingCost, jobId, onConfirm, onClose }: {
  agreedPrice: any;
  shippingCost: any;
  jobId: any;
  onConfirm: (data: { amount: number; note: string; withholdingTax?: number; netPaymentAmount?: number; paymentSlipPath?: string }) => void;
  onClose: () => void;
}) {
  const themeHighlight = useThemeHighlight()
  const numShipping = shippingCost ? Number(shippingCost) : 0
  const [amount, setAmount] = useState(agreedPrice ? String(Number(agreedPrice)) : '')
  const [note, setNote] = useState('')
  const [withTax, setWithTax] = useState(true)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [slipPath, setSlipPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const numAmount = Number(amount) || 0
  const totalBeforeTax = numAmount + numShipping
  const taxAmount = withTax ? Math.round(totalBeforeTax * 0.03 * 100) / 100 : 0
  const netAmount = withTax ? Math.round((totalBeforeTax - taxAmount) * 100) / 100 : totalBeforeTax

  const handleSlipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))

    // Upload immediately
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('slip', file)
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/payment-slip`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      )
      setSlipPath(res.data.slipUrl)
      toast.success('อัปโหลดสลิปสำเร็จ')
    } catch {
      toast.error('อัปโหลดสลิปล้มเหลว')
      setSlipFile(null)
      setSlipPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!amount) return
    setSubmitting(true)
    await onConfirm({
      amount: numAmount,
      note,
      withholdingTax: withTax ? taxAmount : undefined,
      netPaymentAmount: withTax ? netAmount : undefined,
      paymentSlipPath: slipPath || undefined,
    })
    setSubmitting(false)
  }

  return (
    <ModalWrapper title="จ่ายเงิน" onClose={onClose}>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">จำนวนเงิน (บาท) *</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {/* Withholding Tax Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
          <div>
            <p className="text-sm font-medium text-gray-300">หักภาษี ณ ที่จ่าย 3%</p>
            <p className="text-xs text-gray-500">คำนวณภาษีหัก ณ ที่จ่ายอัตโนมัติ</p>
          </div>
          <button
            type="button"
            onClick={() => setWithTax(!withTax)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${withTax ? '' : 'bg-slate-600'}`}
            style={withTax ? { backgroundColor: themeHighlight } : undefined}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${withTax ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Tax Breakdown */}
        {numAmount > 0 && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">ค่าจ้าง</span>
              <span className="text-white">{numAmount.toLocaleString()} บาท</span>
            </div>
            {numShipping > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ค่าส่งเอกสาร</span>
                <span className="text-white">+{numShipping.toLocaleString()} บาท</span>
              </div>
            )}
            {(numShipping > 0 || withTax) && (
              <div className="flex justify-between text-sm border-t border-blue-500/20 pt-1">
                <span className="text-gray-400">ยอดรวม</span>
                <span className="text-white">{totalBeforeTax.toLocaleString()} บาท</span>
              </div>
            )}
            {withTax && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">หักภาษี ณ ที่จ่าย 3%</span>
                <span className="text-red-400">-{taxAmount.toLocaleString()} บาท</span>
              </div>
            )}
            <div className="border-t border-blue-500/30 pt-1 flex justify-between text-sm font-semibold">
              <span className="text-gray-300">ยอดสุทธิที่จ่าย</span>
              <span className="text-emerald-400">{netAmount.toLocaleString()} บาท</span>
            </div>
          </div>
        )}

        {/* Note */}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุการจ่ายเงิน..." rows={2}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />

        {/* Slip Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">แนบสลิปโอนเงิน</label>
          {slipPreview ? (
            <div className="relative">
              <img src={slipPreview} alt="สลิป" className="max-h-48 rounded-lg border border-slate-600 mx-auto" />
              <button
                onClick={() => { setSlipFile(null); setSlipPreview(null); setSlipPath(null) }}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 transition">
              <CreditCard className="w-8 h-8 text-gray-500 mb-2" />
              <span className="text-sm text-gray-400">คลิกเพื่อแนบสลิป</span>
              <span className="text-xs text-gray-500 mt-1">PNG, JPG (ไม่เกิน 5MB)</span>
              <input type="file" accept="image/*" onChange={handleSlipSelect} className="hidden" />
            </label>
          )}
        </div>
      </div>
      <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
        <button onClick={onClose} disabled={submitting} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition">ยกเลิก</button>
        <button onClick={handleSubmit} disabled={submitting || !amount || uploading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50">
          {submitting ? 'กำลังบันทึก...' : 'ยืนยันจ่ายเงิน'}
        </button>
      </div>
    </ModalWrapper>
  )
}

function CancelModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  return (
    <ModalWrapper title="ยกเลิกงาน" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">การยกเลิกไม่สามารถเรียกคืนได้</p>
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลในการยกเลิก *" rows={3}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
      <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
        <button onClick={onClose} disabled={submitting} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition">ไม่ยกเลิก</button>
        <button onClick={async () => { if (!reason.trim()) return; setSubmitting(true); await onConfirm(reason); setSubmitting(false) }} disabled={submitting || !reason.trim()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50">
          {submitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
        </button>
      </div>
    </ModalWrapper>
  )
}

function RejectModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  return (
    <ModalWrapper title="ปฏิเสธงาน Outsource" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">งานจะถูกยกเลิกและแจ้งผู้สร้างงาน</p>
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลในการปฏิเสธ..." rows={3}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
      <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
        <button onClick={onClose} disabled={submitting} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition">ยกเลิก</button>
        <button onClick={async () => { setSubmitting(true); await onConfirm(reason); setSubmitting(false) }} disabled={submitting}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50">
          {submitting ? 'กำลังดำเนินการ...' : 'ยืนยันปฏิเสธ'}
        </button>
      </div>
    </ModalWrapper>
  )
}

// ─── Document Submission Section (Outsource Tech) ─────────────────
function DocumentSubmissionSection({ jobId, job, onSuccess }: { jobId: any; job: any; onSuccess: () => void }) {
  const isResubmission = job.status === 'DOCUMENT_SUBMITTED'
  const [slipPath, setSlipPath] = useState('')
  const [workOrderPath, setWorkOrderPath] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [shippingCost, setShippingCost] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const slipInputRef = useRef<HTMLInputElement>(null)
  const workOrderInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/document-upload`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      )
      return res.data.filePath
    } catch {
      toast.error('อัปโหลดไม่สำเร็จ')
      return null
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'slip' | 'workOrder' | 'photo') => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(type)
    const path = await uploadFile(file)
    if (path) {
      if (type === 'slip') setSlipPath(path)
      else if (type === 'workOrder') setWorkOrderPath(path)
      else setPhotos(prev => [...prev, path])
      toast.success('อัปโหลดสำเร็จ')
    }
    setUploading(null)
    if (type === 'slip' && slipInputRef.current) slipInputRef.current.value = ''
    if (type === 'workOrder' && workOrderInputRef.current) workOrderInputRef.current.value = ''
    if (type === 'photo' && photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!isResubmission && !slipPath && !workOrderPath) {
      toast.error('กรุณาอัปโหลดสลิปหรือใบงานอย่างน้อย 1 รายการ')
      return
    }
    if (isResubmission && !slipPath && !workOrderPath && photos.length === 0 && !shippingCost) {
      toast.error('กรุณาเพิ่มเอกสารหรือรูปอย่างน้อย 1 รายการ')
      return
    }
    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/submit-documents`,
        {
          documentSlipPath: slipPath || undefined,
          documentWorkOrderPath: workOrderPath || undefined,
          documentPhotos: photos.length > 0 ? photos : undefined,
          shippingCost: shippingCost ? Number(shippingCost) : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(isResubmission ? 'ส่งเอกสารเพิ่มเติมสำเร็จ' : 'ส่งเอกสารสำเร็จ')
      setSlipPath('')
      setWorkOrderPath('')
      setPhotos([])
      setShippingCost('')
      onSuccess()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')
  const formatDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-cyan-400" />
        {isResubmission ? 'เอกสารที่ส่ง / เพิ่มเอกสาร' : 'ส่งเอกสาร'}
      </h2>

      {/* Show existing documents when resubmitting */}
      {isResubmission && (
        <div className="mb-6 pb-4 border-b border-slate-700/50">
          <p className="text-sm font-medium text-gray-300 mb-3">เอกสารที่ส่งแล้ว:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.documentSlipPath && (
              <div>
                <p className="text-xs text-gray-400 mb-1">สลิป</p>
                <a href={`${baseUrl}${job.documentSlipPath}`} target="_blank" rel="noopener noreferrer">
                  <img src={`${baseUrl}${job.documentSlipPath}`} alt="สลิป" className="max-h-36 rounded-lg border border-slate-600 hover:border-blue-500 transition" />
                </a>
              </div>
            )}
            {job.documentWorkOrderPath && (
              <div>
                <p className="text-xs text-gray-400 mb-1">ใบงาน</p>
                <a href={`${baseUrl}${job.documentWorkOrderPath}`} target="_blank" rel="noopener noreferrer">
                  <img src={`${baseUrl}${job.documentWorkOrderPath}`} alt="ใบงาน" className="max-h-36 rounded-lg border border-slate-600 hover:border-blue-500 transition" />
                </a>
              </div>
            )}
          </div>
          {job.documentPhotos && job.documentPhotos.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">รูปที่ส่งแล้ว ({job.documentPhotos.length} รูป)</p>
              <div className="flex flex-wrap gap-2">
                {job.documentPhotos.map((p: string, i: number) => (
                  <a key={i} href={`${baseUrl}${p}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${baseUrl}${p}`} alt={`Photo ${i+1}`} className="h-20 rounded-lg border border-slate-600 hover:border-blue-500 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {job.shippingCost && Number(job.shippingCost) > 0 && (
            <div className="mt-3 p-2 bg-slate-700/50 rounded-lg inline-block">
              <span className="text-xs text-gray-400">ค่าส่ง: </span>
              <span className="text-sm font-semibold text-white">{Number(job.shippingCost).toLocaleString()} บาท</span>
            </div>
          )}
          {job.documentSubmittedAt && (
            <p className="text-xs text-gray-500 mt-2">ส่งล่าสุดเมื่อ: {formatDateTime(job.documentSubmittedAt)}</p>
          )}
        </div>
      )}

      {/* Review Notes from Finance */}
      <DocumentReviewNotesDisplay notes={job.documentReviewNotes} />

      {/* Upload Form */}
      <p className="text-sm text-gray-400 mb-4">
        {isResubmission
          ? 'อัปโหลดเอกสารเพิ่มเติมตามที่ Finance แจ้ง'
          : 'อัปโหลดสลิป, ใบงาน และเอกสารอื่นๆ เพื่อส่งให้ Finance ตรวจรับ'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Slip */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            สลิป {isResubmission && job.documentSlipPath && <span className="text-xs text-gray-500">(อัปโหลดใหม่จะแทนที่)</span>}
          </label>
          {slipPath ? (
            <div className="relative">
              <img src={`${baseUrl}${slipPath}`} alt="สลิป" className="h-32 rounded-lg border border-slate-600 object-cover" />
              <button onClick={() => setSlipPath('')} className="absolute top-1 right-1 bg-red-600 rounded-full p-1 text-white">
                <XCircle className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => slipInputRef.current?.click()}
              disabled={uploading === 'slip'}
              className="w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 transition"
            >
              {uploading === 'slip' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 mb-1" />}
              <span className="text-xs">{uploading === 'slip' ? 'กำลังอัปโหลด...' : 'อัปโหลดสลิป'}</span>
            </button>
          )}
          <input ref={slipInputRef} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'slip')} className="hidden" />
        </div>

        {/* Work Order */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            ใบงาน {isResubmission && job.documentWorkOrderPath && <span className="text-xs text-gray-500">(อัปโหลดใหม่จะแทนที่)</span>}
          </label>
          {workOrderPath ? (
            <div className="relative">
              <img src={`${baseUrl}${workOrderPath}`} alt="ใบงาน" className="h-32 rounded-lg border border-slate-600 object-cover" />
              <button onClick={() => setWorkOrderPath('')} className="absolute top-1 right-1 bg-red-600 rounded-full p-1 text-white">
                <XCircle className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => workOrderInputRef.current?.click()}
              disabled={uploading === 'workOrder'}
              className="w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 transition"
            >
              {uploading === 'workOrder' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 mb-1" />}
              <span className="text-xs">{uploading === 'workOrder' ? 'กำลังอัปโหลด...' : 'อัปโหลดใบงาน'}</span>
            </button>
          )}
          <input ref={workOrderInputRef} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'workOrder')} className="hidden" />
        </div>
      </div>

      {/* Additional Photos */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">รูปเพิ่มเติม</label>
        <div className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={`${baseUrl}${p}`} alt={`Photo ${i+1}`} className="h-20 rounded-lg border border-slate-600" />
              <button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 text-white">
                <XCircle className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading === 'photo'}
            className="h-20 w-20 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 transition"
          >
            {uploading === 'photo' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
          </button>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'photo')} className="hidden" />
      </div>

      {/* Shipping Cost */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">ค่าส่งเอกสาร (บาท)</label>
        <input
          type="number"
          value={shippingCost}
          onChange={(e) => setShippingCost(e.target.value)}
          placeholder={isResubmission && job.shippingCost ? `ปัจจุบัน: ${Number(job.shippingCost).toLocaleString()}` : '0'}
          min="0"
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">ค่าส่งจะรวมเข้ากับยอดค่าจ้างก่อนหักภาษี</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || (!isResubmission && !slipPath && !workOrderPath)}
        className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
        {submitting ? 'กำลังส่ง...' : isResubmission ? 'ส่งเอกสารเพิ่มเติม' : 'ส่งเอกสาร'}
      </button>
    </div>
  )
}

// ─── Document Review Notes Display ────────────────────────────────
function DocumentReviewNotesDisplay({ notes }: { notes: any }) {
  const reviewNotes = Array.isArray(notes) ? notes : []
  if (reviewNotes.length === 0) return null

  const formatDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1">
        <AlertTriangle className="h-4 w-4" /> ข้อความจาก Finance
      </p>
      <div className="space-y-2">
        {reviewNotes.map((n: any, i: number) => (
          <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-sm text-white">{n.note}</p>
            <p className="text-xs text-gray-500 mt-1">
              โดย {n.by} — {n.at ? formatDateTime(n.at) : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Finance Confirmation Section ─────────────────────────────────
function FinanceConfirmationSection({ job, jobId, onSuccess }: { job: any; jobId: any; onSuccess: () => void }) {
  const [confirmingSpare, setConfirmingSpare] = useState(false)
  const [confirmingDocs, setConfirmingDocs] = useState(false)
  const [showRequestMore, setShowRequestMore] = useState(false)
  const [requestNote, setRequestNote] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)

  const handleConfirmSpareParts = async () => {
    if (!confirm('ยืนยันว่าได้รับ Spare Parts คืนแล้ว?')) return
    setConfirmingSpare(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/confirm-spare-parts`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('บันทึกรับ Spare Parts คืนสำเร็จ')
      onSuccess()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setConfirmingSpare(false)
    }
  }

  const handleConfirmDocuments = async () => {
    if (!confirm('ยืนยันรับเอกสาร? งานจะเข้าสู่ขั้นตอนรอจ่ายเงิน')) return
    setConfirmingDocs(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/confirm-documents`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ยืนยันรับเอกสารสำเร็จ — งานเข้าสู่ขั้นตอนรอจ่ายเงิน')
      onSuccess()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setConfirmingDocs(false)
    }
  }

  const handleRequestMoreDocuments = async () => {
    if (!requestNote.trim()) {
      toast.error('กรุณาระบุรายละเอียดเอกสารที่ต้องการเพิ่มเติม')
      return
    }
    setSubmittingRequest(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/request-more-documents`, {
        note: requestNote.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ส่งคำขอเอกสารเพิ่มเติมสำเร็จ — ช่างจะได้รับแจ้ง')
      setRequestNote('')
      setShowRequestMore(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmittingRequest(false)
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-slate-700/50">
      <h3 className="text-sm font-semibold text-white mb-3">Finance Confirmation</h3>

      {/* Review Notes History */}
      <DocumentReviewNotesDisplay notes={job.documentReviewNotes} />

      <div className="flex flex-wrap gap-3">
        {/* Spare Parts Return */}
        <button
          onClick={handleConfirmSpareParts}
          disabled={confirmingSpare || job.sparePartsReturned}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            job.sparePartsReturned
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
              : 'bg-orange-600 hover:bg-orange-700 text-white'
          } disabled:opacity-70`}
        >
          {confirmingSpare ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
          {job.sparePartsReturned ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> รับ Spare Parts คืนแล้ว
              {job.sparePartsConfirmedBy && (
                <span className="text-xs opacity-75">({job.sparePartsConfirmedBy.firstName})</span>
              )}
            </>
          ) : (
            'Check รับ Spare Parts คืน'
          )}
        </button>

        {/* Confirm Documents */}
        <button
          onClick={handleConfirmDocuments}
          disabled={confirmingDocs}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {confirmingDocs ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          ตรวจสอบเอกสารแล้ว
        </button>

        {/* Request More Documents */}
        <button
          onClick={() => setShowRequestMore(!showRequestMore)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition"
        >
          <AlertTriangle className="h-4 w-4" />
          เอกสารไม่ครบ
        </button>
      </div>

      {/* Request More Documents Form */}
      {showRequestMore && (
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <label className="block text-sm font-medium text-amber-400 mb-2">
            ระบุเอกสารที่ต้องการเพิ่มเติม
          </label>
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="เช่น ขาดรูปสลิปค่าขนส่ง, รูปใบงานไม่ชัด กรุณาอัปโหลดใหม่..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleRequestMoreDocuments}
              disabled={submittingRequest || !requestNote.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
            >
              {submittingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submittingRequest ? 'กำลังส่ง...' : 'ส่งคำขอ'}
            </button>
            <button
              onClick={() => { setShowRequestMore(false); setRequestNote('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm transition"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        กด &ldquo;ตรวจสอบเอกสารแล้ว&rdquo; เพื่อย้ายงานเข้าสู่ขั้นตอนรอจ่ายเงิน
      </p>
    </div>
  )
}

