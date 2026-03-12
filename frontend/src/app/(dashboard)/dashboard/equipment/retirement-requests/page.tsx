// app/(dashboard)/dashboard/equipment/retirement-requests/page.tsx
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  User,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface RetirementRequest {
  id: number
  equipmentId: number
  requestedBy: number
  reason: string
  status: string
  approvedBy: number | null
  approvalNote: string | null
  createdAt: string
  updatedAt: string
  equipment: {
    id: number
    serialNumber: string
    name: string
    category: string
    brand: string | null
    model: string | null
    status: string
    store: {
      id: number
      storeCode: string
      name: string
      province: string | null
    }
  }
  requester: {
    id: number
    firstName: string
    lastName: string
  }
}

export default function EquipmentRetirementRequestsPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [requests, setRequests] = useState<RetirementRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject'
    request: RetirementRequest
  } | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Role guard
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      const roles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.role || r?.name || ''))
        : [user.role].filter(Boolean)
      if (!roles.includes('IT_MANAGER') && !roles.includes('SUPER_ADMIN')) {
        toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')
        router.push('/dashboard/equipment')
        return
      }
    }
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/retirement-requests/pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setRequests(response.data || [])
    } catch (error) {
      console.error('Failed to fetch retirement requests:', error)
      toast.error('ไม่สามารถโหลดคำขอได้')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async () => {
    if (!actionModal) return
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = actionModal.type === 'approve' ? 'approve' : 'reject'
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/retirement-requests/${actionModal.request.id}/${endpoint}`,
        { note: actionNote.trim() || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(
        actionModal.type === 'approve'
          ? `อนุมัติปลดระวาง "${actionModal.request.equipment.name}" เรียบร้อย`
          : `ปฏิเสธคำขอปลดระวาง "${actionModal.request.equipment.name}" เรียบร้อย`
      )
      setActionModal(null)
      setActionNote('')
      fetchRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถดำเนินการได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="space-y-6 animate-fade-in">
      <BackButton href="/dashboard/equipment" label="กลับไปหน้า Equipment" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            คำขอปลดระวางอุปกรณ์
          </h1>
          <p className="text-gray-400 mt-1">รายการคำขอปลดระวางที่รอการอนุมัติ</p>
        </div>
        {requests.length > 0 && (
          <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl">
            <span className="text-red-400 font-bold text-xl">{requests.length}</span>
            <span className="text-red-300 text-sm ml-2">รายการรออนุมัติ</span>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-400">กำลังโหลด...</p>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-card p-16 rounded-2xl text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">ไม่มีคำขอรออนุมัติ</h3>
          <p className="text-gray-400">ไม่มีคำขอปลดระวางอุปกรณ์ที่รอดำเนินการ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="glass-card p-6 rounded-2xl">
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                {/* Equipment Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-slate-700/50 rounded-lg shrink-0">
                      <Package className="w-5 h-5 text-gray-300" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">{req.equipment.name}</h3>
                      <p className="text-blue-400 font-mono text-sm">S/N: {req.equipment.serialNumber}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-slate-700 text-gray-300 rounded-md">
                          {req.equipment.category}
                        </span>
                        {req.equipment.brand && (
                          <span className="text-xs px-2 py-0.5 bg-slate-700 text-gray-300 rounded-md">
                            {req.equipment.brand} {req.equipment.model}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Store */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">สาขา</p>
                      <p className="text-white font-medium text-sm">{formatStore(req.equipment.store)}</p>
                      <p className="text-gray-400 text-xs">{req.equipment.store.province || '-'}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">ผู้ขอปลดระวาง</p>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <p className="text-white text-sm">{req.requester.firstName} {req.requester.lastName}</p>
                      </div>
                      <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(req.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-red-400" />
                      <p className="text-xs font-semibold text-red-300">เหตุผลในการปลดระวาง</p>
                    </div>
                    <p className="text-gray-200 text-sm">{req.reason}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex lg:flex-col gap-3 shrink-0">
                  <button
                    onClick={() => { setActionModal({ type: 'approve', request: req }); setActionNote('') }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    อนุมัติ
                  </button>
                  <button
                    onClick={() => { setActionModal({ type: 'reject', request: req }); setActionNote('') }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition font-medium text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    ปฏิเสธ
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/equipment/${req.equipmentId}`)}
                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-600 hover:border-slate-500 text-gray-400 hover:text-gray-200 rounded-lg transition font-medium text-sm"
                  >
                    ดูอุปกรณ์
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-full ${actionModal.type === 'approve' ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                {actionModal.type === 'approve'
                  ? <CheckCircle2 className="w-6 h-6 text-green-400" />
                  : <XCircle className="w-6 h-6 text-gray-400" />
                }
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {actionModal.type === 'approve' ? 'ยืนยันอนุมัติปลดระวาง' : 'ปฏิเสธคำขอ'}
                </h3>
                <p className="text-sm text-gray-400">
                  {actionModal.type === 'approve'
                    ? 'อุปกรณ์จะถูกเปลี่ยนสถานะเป็น Retired ทันที'
                    : 'อุปกรณ์จะยังคงสถานะเดิม'
                  }
                </p>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
              <p className="text-white font-medium">{actionModal.request.equipment.name}</p>
              <p className="text-blue-400 font-mono text-sm">S/N: {actionModal.request.equipment.serialNumber}</p>
            </div>

            {actionModal.type === 'approve' && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-red-300 text-sm">การอนุมัตินี้จะเปลี่ยนสถานะเป็น Retired ทันทีและไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                หมายเหตุ (ไม่บังคับ)
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionModal.type === 'approve' ? 'หมายเหตุเพิ่มเติม...' : 'เหตุผลที่ปฏิเสธ...'}
                rows={2}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setActionModal(null); setActionNote('') }}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAction}
                disabled={isSubmitting}
                className={`px-5 py-2 rounded-lg text-white font-medium transition disabled:opacity-50 ${
                  actionModal.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-slate-600 hover:bg-slate-500'
                }`}
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : actionModal.type === 'approve' ? 'ยืนยันอนุมัติ' : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
