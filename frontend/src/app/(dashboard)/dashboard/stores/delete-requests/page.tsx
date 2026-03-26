// app/(dashboard)/dashboard/stores/delete-requests/page.tsx - Store Delete Request Approval
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Store,
  User,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface DeleteRequest {
  id: number
  storeId: number
  requestedBy: number
  reason: string
  status: string
  approvedBy: number | null
  approvalNote: string | null
  createdAt: string
  updatedAt: string
  store: {
    id: number
    storeCode: string
    name: string
    province: string | null
    company: string | null
  }
  requester: {
    id: number
    username: string
    firstName: string
    lastName: string
  }
}

export default function StoreDeleteRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<DeleteRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject'
    request: DeleteRequest
  } | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const themeHighlight = useThemeHighlight()

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/delete-requests/pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setRequests(res.data)
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดคำขอลบสาขาได้')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async () => {
    if (!actionModal) return

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem('token')
      const endpoint = actionModal.type === 'approve' ? 'approve' : 'reject'

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/delete-requests/${actionModal.request.id}/${endpoint}`,
        { note: actionNote || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success(
        actionModal.type === 'approve'
          ? `ลบสาขา "${actionModal.request.store.name}" สำเร็จ`
          : `ปฏิเสธคำขอลบสาขา "${actionModal.request.store.name}" แล้ว`
      )
      setActionModal(null)
      setActionNote('')
      fetchRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading delete requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center p-2.5 bg-slate-700/50 hover:bg-slate-600/70 text-gray-200 hover:text-white border border-slate-600/50 rounded-xl transition-all duration-200"
            title="กลับไปก่อนหน้า"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Store Delete Requests</h1>
            <p className="text-gray-400 mt-1">
              อนุมัติหรือปฏิเสธคำขอลบสาขาถาวร
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-sm font-medium">
            {requests.length} คำขอรออนุมัติ
          </span>
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">ไม่มีคำขอลบสาขาที่รออนุมัติ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="glass-card rounded-2xl p-6">
              <div className="flex items-start justify-between gap-6">
                {/* Left - Info */}
                <div className="flex-1 space-y-4">
                  {/* Store Info */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-500/20 rounded-xl">
                      <Store className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {formatStore(req.store)}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {[req.store.province, req.store.company].filter(Boolean).join(' | ')}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-sm text-gray-400 mb-1">เหตุผลในการลบ:</p>
                    <p className="text-white">{req.reason}</p>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>
                        ผู้ขอ: {req.requester.firstName} {req.requester.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatDate(req.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right - Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setActionModal({ type: 'approve', request: req })
                      setActionNote('')
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    อนุมัติลบถาวร
                  </button>
                  <button
                    onClick={() => {
                      setActionModal({ type: 'reject', request: req })
                      setActionNote('')
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors font-medium"
                  >
                    <XCircle className="w-5 h-5" />
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 border border-slate-700">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {actionModal.type === 'approve' ? (
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
              ) : (
                <div className="p-2 bg-slate-600/50 rounded-lg">
                  <XCircle className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {actionModal.type === 'approve'
                    ? 'ยืนยันการลบสาขาถาวร'
                    : 'ปฏิเสธคำขอลบสาขา'}
                </h3>
                <p className="text-sm text-gray-400">
                  {formatStore(actionModal.request.store)}
                </p>
              </div>
            </div>

            {/* Warning for approve */}
            {actionModal.type === 'approve' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-400">
                  การดำเนินการนี้จะลบข้อมูลสาขาออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้
                </p>
              </div>
            )}

            {/* Note */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                หมายเหตุ {actionModal.type === 'reject' ? '(เหตุผลที่ปฏิเสธ)' : '(ไม่บังคับ)'}
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={
                  actionModal.type === 'approve'
                    ? 'หมายเหตุเพิ่มเติม...'
                    : 'ระบุเหตุผลที่ปฏิเสธ...'
                }
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setActionModal(null)
                  setActionNote('')
                }}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAction}
                disabled={isSubmitting}
                className={`px-5 py-2 rounded-lg text-white font-medium transition-colors flex items-center gap-2 ${
                  actionModal.type === 'approve'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'hover:brightness-110'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={actionModal.type !== 'approve' ? { backgroundColor: themeHighlight } : undefined}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : actionModal.type === 'approve' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {actionModal.type === 'approve' ? 'ยืนยันลบถาวร' : 'ปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
