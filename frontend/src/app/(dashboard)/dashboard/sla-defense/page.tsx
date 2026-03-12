// app/(dashboard)/dashboard/sla-defense/page.tsx
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Shield, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateTime } from '@/utils/dateUtils'

const CLOSED_STATUSES = ['CLOSED', 'CANCELLED']
const STORAGE_KEY = 'sla_defense_date_range'

function getLastMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: first.toISOString().split('T')[0], to: last.toISOString().split('T')[0] }
}

function getStoredDateRange() {
  if (typeof window === 'undefined') return getLastMonthRange()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return getLastMonthRange()
}

function formatMonthLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
}

export default function SlaDefensePage() {
  const router = useRouter()
  const [defenses, setDefenses] = useState<any[]>([])
  const [approvedDefenses, setApprovedDefenses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [reviewModal, setReviewModal] = useState<{ defense: any; action: 'approve' | 'reject' | 'revoke' } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [searchTicket, setSearchTicket] = useState('')
  const [dateRange, setDateRange] = useState(getStoredDateRange)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
      const roles = user.roles || [user.role].filter(Boolean)
      if (!roles.includes('IT_MANAGER')) {
        router.push('/dashboard')
        return
      }
    }
    fetchDefenses()
  }, [])

  const saveDateRange = (range: { from: string; to: string }) => {
    setDateRange(range)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range))
  }

  const shiftMonth = (delta: number) => {
    const from = new Date(dateRange.from)
    const newFirst = new Date(from.getFullYear(), from.getMonth() + delta, 1)
    const newLast = new Date(newFirst.getFullYear(), newFirst.getMonth() + 1, 0)
    saveDateRange({
      from: newFirst.toISOString().split('T')[0],
      to: newLast.toISOString().split('T')[0],
    })
  }

  const setFullMonth = (year: number, month: number) => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    saveDateRange({
      from: first.toISOString().split('T')[0],
      to: last.toISOString().split('T')[0],
    })
  }

  const fetchDefenses = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const [pendingRes, approvedRes] = await Promise.allSettled([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents/sla-defenses/pending`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents/sla-defenses/approved`, { headers }),
      ])
      if (pendingRes.status === 'fulfilled') setDefenses(pendingRes.value.data)
      if (approvedRes.status === 'fulfilled') setApprovedDefenses(approvedRes.value.data)
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReview = async () => {
    if (!reviewModal) return
    if ((reviewModal.action === 'reject' || reviewModal.action === 'revoke') && !reviewNote.trim()) {
      toast.error(reviewModal.action === 'revoke' ? 'กรุณากรอกเหตุผลที่ยกเลิกการอนุมัติ' : 'กรุณากรอกเหตุผลที่ปฏิเสธ')
      return
    }
    try {
      setIsReviewing(true)
      const token = localStorage.getItem('token')
      const endpoint = reviewModal.action === 'approve' ? 'approve' : 'reject'
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/sla-defenses/${reviewModal.defense.id}/${endpoint}`,
        { reviewNote: reviewNote.trim() || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const successMsg = reviewModal.action === 'approve'
        ? 'อนุมัติเรียบร้อย'
        : reviewModal.action === 'revoke'
        ? 'ยกเลิกการอนุมัติเรียบร้อย'
        : 'ปฏิเสธเรียบร้อย'
      toast.success(successMsg)
      setReviewModal(null)
      setReviewNote('')
      fetchDefenses()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsReviewing(false)
    }
  }

  const formatOverdue = (slaDeadline: string, resolvedAt: string) => {
    if (!slaDeadline || !resolvedAt) return '-'
    const diff = new Date(resolvedAt).getTime() - new Date(slaDeadline).getTime()
    if (diff <= 0) return '-'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  // Date range filter helper
  const inRange = (defense: any) => {
    if (!dateRange.from && !dateRange.to) return true
    const d = new Date(defense.incident?.createdAt)
    if (dateRange.from && d < new Date(dateRange.from)) return false
    if (dateRange.to && d > new Date(dateRange.to + 'T23:59:59')) return false
    return true
  }

  const isSearching = searchTicket.trim().length > 0
  const searchQuery = searchTicket.trim().toLowerCase()

  const allDefenses = useMemo(() => [...defenses, ...approvedDefenses], [defenses, approvedDefenses])

  // Search: across ALL defenses filtered by date range
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    return allDefenses.filter(d =>
      d.incident?.ticketNumber?.toLowerCase().includes(searchQuery) && inRange(d)
    )
  }, [allDefenses, searchQuery, isSearching, dateRange])

  // Default view: PENDING + Incident ยังไม่ปิด + in date range
  const visiblePending = useMemo(() =>
    defenses.filter(d => !CLOSED_STATUSES.includes(d.incident?.status) && inRange(d)),
    [defenses, dateRange]
  )

  const hiddenCount = useMemo(() =>
    allDefenses.filter(inRange).length - visiblePending.length,
    [allDefenses, visiblePending, dateRange]
  )

  // Quick month presets (last 6 months)
  const monthPresets = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }) }
    }).reverse()
  }, [])

  const activeMonthKey = `${new Date(dateRange.from).getFullYear()}-${new Date(dateRange.from).getMonth()}`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20">
            <Shield className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SLA Defense</h1>
            <p className="text-sm text-gray-400">ประชุมสรุป SLA รายเดือน</p>
          </div>
        </div>
        {visiblePending.length > 0 && !isSearching && (
          <span className="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full text-sm font-semibold">
            {visiblePending.length} รายการรอพิจารณา
          </span>
        )}
      </div>

      {/* Date Range Selector */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-gray-200">ช่วงวันที่ Incident</span>
          <span className="text-xs text-gray-500">(บันทึกไว้จนกว่าจะเลือกใหม่)</span>
        </div>

        {/* Custom date range + nav arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={dateRange.from}
              onChange={e => saveDateRange({ ...dateRange, from: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="text-gray-500 text-sm">–</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => saveDateRange({ ...dateRange, to: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => shiftMonth(1)}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
            title="เดือนถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="px-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-blue-300 font-medium whitespace-nowrap">
            {formatMonthLabel(dateRange.from)}
            {dateRange.from.slice(0, 7) !== dateRange.to.slice(0, 7) && ` – ${formatMonthLabel(dateRange.to)}`}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTicket}
          onChange={(e) => setSearchTicket(e.target.value)}
          placeholder="ค้นหา Incident No."
          className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
        />
        {isSearching && (
          <button
            onClick={() => setSearchTicket('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {isSearching ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            ผลการค้นหา <span className="text-white font-medium">"{searchTicket}"</span> ในช่วงวันที่เลือก — พบ {searchResults.length} รายการ
          </p>
          {searchResults.length === 0 ? (
            <div className="glass-card p-8 text-center rounded-2xl">
              <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">ไม่พบ SLA Defense ที่ตรงกับ Incident No. นี้ในช่วงวันที่เลือก</p>
            </div>
          ) : (
            searchResults.map((defense) => (
              <DefenseCard
                key={defense.id}
                defense={defense}
                formatOverdue={formatOverdue}
                onAction={(action) => { setReviewModal({ defense, action }); setReviewNote('') }}
                showStatus
              />
            ))
          )}
        </div>
      ) : (
        <>

          {/* Pending */}
          {isLoading ? (
            <div className="glass-card p-12 text-center rounded-2xl">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-400">กำลังโหลด...</p>
            </div>
          ) : visiblePending.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">ไม่มีคำขอที่รอพิจารณาในช่วงวันนี้</p>
              <p className="text-sm text-gray-400">ลองเลือกช่วงวันอื่น หรือค้นหาด้วย Incident No.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visiblePending.map((defense) => (
                <DefenseCard
                  key={defense.id}
                  defense={defense}
                  formatOverdue={formatOverdue}
                  onAction={(action) => { setReviewModal({ defense, action }); setReviewNote('') }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              {reviewModal.action === 'approve' ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : reviewModal.action === 'revoke' ? (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <h3 className="text-lg font-semibold text-white">
                {reviewModal.action === 'approve'
                  ? 'อนุมัติ SLA Defense'
                  : reviewModal.action === 'revoke'
                  ? 'ยกเลิกการอนุมัติ SLA Defense'
                  : 'ปฏิเสธ SLA Defense'}
              </h3>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-slate-700/50">
              <p className="text-xs text-gray-400 mb-1">{reviewModal.defense.incident.ticketNumber}</p>
              <p className="text-sm text-white">{reviewModal.defense.incident.title}</p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{reviewModal.defense.reason}</p>
            </div>

            {reviewModal.action === 'approve' ? (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  เมื่ออนุมัติ Incident นี้จะถือว่า <span className="text-green-400 font-semibold">ผ่าน SLA</span> และจะถูกนับในการคำนวณคะแนน
                </p>
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-2">หมายเหตุ (ไม่บังคับ)</p>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="หมายเหตุเพิ่มเติม..."
                    rows={2}
                    className="w-full bg-slate-800 text-white text-sm rounded-lg px-4 py-3 border border-slate-600 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </>
            ) : reviewModal.action === 'revoke' ? (
              <div className="mb-4">
                <p className="text-sm text-amber-400/80 mb-3">
                  การยกเลิกการอนุมัติจะเปลี่ยนสถานะ Defense เป็น <span className="font-semibold">ปฏิเสธ</span> และแจ้ง Technician ทราบ
                </p>
                <p className="text-sm text-gray-400 mb-2">
                  เหตุผลที่ยกเลิก <span className="text-red-400">*</span>
                </p>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="กรอกเหตุผลที่ยกเลิกการอนุมัติ..."
                  rows={3}
                  className="w-full bg-slate-800 text-white text-sm rounded-lg px-4 py-3 border border-slate-600 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">
                  เหตุผลที่ปฏิเสธ <span className="text-red-400">*</span>
                </p>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="กรอกเหตุผล..."
                  rows={3}
                  className="w-full bg-slate-800 text-white text-sm rounded-lg px-4 py-3 border border-slate-600 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setReviewModal(null); setReviewNote('') }}
                className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleReview}
                disabled={isReviewing}
                className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                  reviewModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : reviewModal.action === 'revoke'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isReviewing
                  ? 'กำลังดำเนินการ...'
                  : reviewModal.action === 'approve'
                  ? 'ยืนยันอนุมัติ'
                  : reviewModal.action === 'revoke'
                  ? 'ยืนยันยกเลิกการอนุมัติ'
                  : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable defense card
function DefenseCard({
  defense,
  formatOverdue,
  onAction,
  showStatus = false,
}: {
  defense: any
  formatOverdue: (a: string, b: string) => string
  onAction: (action: 'approve' | 'reject' | 'revoke') => void
  showStatus?: boolean
}) {
  const isApproved = defense.status === 'APPROVED'
  const isClosedIncident = CLOSED_STATUSES.includes(defense.incident?.status)

  return (
    <div className={`glass-card p-6 rounded-2xl ${isApproved ? 'border border-green-500/20' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Link
              href={`/dashboard/incidents/${defense.incident.id}`}
              className="text-blue-400 hover:text-blue-300 font-semibold text-sm flex items-center gap-1"
            >
              {defense.incident.ticketNumber}
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-gray-500">·</span>
            <span className="text-sm text-gray-300 truncate">{defense.incident.title}</span>
            {showStatus && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                isApproved
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : defense.status === 'REJECTED'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              }`}>
                {isApproved ? 'อนุมัติแล้ว' : defense.status === 'REJECTED' ? 'ปฏิเสธแล้ว' : 'รอพิจารณา'}
              </span>
            )}
            {isClosedIncident && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-600/50 text-gray-400 border border-slate-600">
                {defense.incident.status}
              </span>
            )}
          </div>

          {defense.incident.store && (
            <p className="text-xs text-gray-400 mb-3">
              {formatStore(defense.incident.store)}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">SLA Deadline</p>
              <p className="text-sm text-white">{defense.incident.slaDeadline ? formatDateTime(defense.incident.slaDeadline) : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Resolved At</p>
              <p className="text-sm text-white">{defense.incident.resolvedAt ? formatDateTime(defense.incident.resolvedAt) : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">เกิน SLA</p>
              <p className="text-sm text-red-400 font-semibold">
                +{formatOverdue(defense.incident.slaDeadline, defense.incident.resolvedAt)}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Technician:</span>
              <span className="text-sm text-white font-medium">
                {defense.technician?.firstName} {defense.technician?.lastName}
              </span>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-500">{formatDateTime(defense.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">{defense.reason}</p>
            {defense.reviewNote && (
              <p className="text-xs text-gray-400 mt-2 border-t border-slate-700 pt-2">หมายเหตุ: {defense.reviewNote}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {isApproved ? (
            <button
              onClick={() => onAction('revoke')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30 text-xs rounded-lg font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              ยกเลิกการอนุมัติ
            </button>
          ) : defense.status === 'PENDING' ? (
            <>
              <button
                onClick={() => onAction('approve')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                อนุมัติ
              </button>
              <button
                onClick={() => onAction('reject')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                ปฏิเสธ
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
