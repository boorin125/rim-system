// app/(dashboard)/dashboard/outsource/my-bids/page.tsx - My Outsource Bids
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  DollarSign,
  Clock,
  MapPin,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react'

const bidStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  SHORTLISTED: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ACCEPTED: 'bg-green-500/20 text-green-400 border border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border border-red-500/30',
  WITHDRAWN: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

const bidStatusLabels: Record<string, string> = {
  PENDING: 'รอพิจารณา',
  SHORTLISTED: 'ติดรายชื่อ',
  ACCEPTED: 'ได้รับเลือก',
  REJECTED: 'ไม่ผ่าน',
  WITHDRAWN: 'ถอนแล้ว',
}

export default function MyBidsPage() {
  const router = useRouter()
  const [bids, setBids] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', page: 1 })
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })

  useEffect(() => { loadBids() }, [filter])

  const loadBids = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/outsource/my-bids`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: filter.page, limit: 20, status: filter.status || undefined },
      })
      setBids(res.data.data || [])
      setPagination(res.data.pagination || { total: 0, totalPages: 0 })
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
    finally { setLoading(false) }
  }

  const handleWithdraw = async (bidId: number) => {
    if (!confirm('ยืนยันถอนข้อเสนอ?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/outsource/bids/${bidId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ถอนข้อเสนอสำเร็จ')
      loadBids()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="inline-flex items-center justify-center p-2.5 bg-slate-700/50 hover:bg-slate-600/70 text-gray-200 hover:text-white border border-slate-600/50 rounded-xl transition-all duration-200" title="กลับไปก่อนหน้า">
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">ข้อเสนอของฉัน</h1>
          <p className="text-sm text-gray-400">ดูสถานะข้อเสนอที่คุณส่งไป</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
        <select value={filter.status} onChange={(e) => setFilter({ status: e.target.value, page: 1 })}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">ทุกสถานะ</option>
          <option value="PENDING">รอพิจารณา</option>
          <option value="SHORTLISTED">ติดรายชื่อ</option>
          <option value="ACCEPTED">ได้รับเลือก</option>
          <option value="REJECTED">ไม่ผ่าน</option>
          <option value="WITHDRAWN">ถอนแล้ว</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : bids.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="mx-auto h-12 w-12 text-gray-500 mb-3" />
            <p className="text-white font-medium">ยังไม่มีข้อเสนอ</p>
            <p className="text-sm text-gray-400 mt-1">เลือกงานจาก Marketplace แล้วส่งข้อเสนอ</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {bids.map((bid: any) => (
              <div key={bid.id} className="p-6 hover:bg-slate-700/30 transition">
                <div className="flex items-start justify-between">
                  <Link href={`/dashboard/outsource/${bid.job?.id}`} className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-mono text-blue-400">{bid.job?.jobCode}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${bidStatusColors[bid.status]}`}>
                        {bidStatusLabels[bid.status] || bid.status}
                      </span>
                    </div>
                    <h3 className="text-white font-medium mt-1">{bid.job?.title}</h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        เสนอ <span className="text-emerald-400 font-medium">{Number(bid.proposedPrice).toLocaleString()} บาท</span>
                      </span>
                      {bid.estimatedHours && (
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {bid.estimatedHours} ชม.</span>
                      )}
                      {bid.job?.incident?.store && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {formatStore(bid.job.incident.store)}
                        </span>
                      )}
                      <span>ส่งเมื่อ {formatDate(bid.submittedAt)}</span>
                    </div>
                  </Link>
                  {bid.status === 'PENDING' && bid.job?.status === 'OPEN' && (
                    <button onClick={() => handleWithdraw(bid.id)}
                      className="ml-4 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs transition flex items-center gap-1">
                      <Trash2 className="h-3.5 w-3.5" /> ถอน
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-700/50 px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-gray-400">แสดง {bids.length} จาก {pagination.total}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setFilter({ ...filter, page: filter.page - 1 })} disabled={filter.page === 1}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 disabled:opacity-50 transition"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm text-gray-400">{filter.page}/{pagination.totalPages}</span>
              <button onClick={() => setFilter({ ...filter, page: filter.page + 1 })} disabled={filter.page === pagination.totalPages}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 disabled:opacity-50 transition"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
