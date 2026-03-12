// app/(dashboard)/dashboard/outsource/my-jobs/page.tsx - My Outsource Jobs
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  DollarSign,
  MapPin,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
} from 'lucide-react'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

const statusColors: Record<string, string> = {
  AWARDED: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  IN_PROGRESS: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  COMPLETED: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  VERIFIED: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border border-red-500/30',
  PAID: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
}
const statusLabels: Record<string, string> = {
  AWARDED: 'มอบหมายแล้ว', IN_PROGRESS: 'กำลังดำเนินการ', COMPLETED: 'รอตรวจสอบ',
  VERIFIED: 'ตรวจสอบผ่าน', REJECTED: 'ไม่ผ่าน', PAID: 'จ่ายเงินแล้ว',
}

export default function MyJobsPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', page: 1 })
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })

  useEffect(() => { loadJobs() }, [filter])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/outsource/my-jobs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: filter.page, limit: 20, status: filter.status || undefined },
      })
      setJobs(res.data.data || [])
      setPagination(res.data.pagination || { total: 0, totalPages: 0 })
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
    finally { setLoading(false) }
  }

  const handleStart = async (jobId: number) => {
    if (!confirm('ยืนยันเริ่มงาน?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${jobId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('เริ่มงานแล้ว')
      loadJobs()
    } catch (e: any) { toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด') }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="inline-flex items-center justify-center p-3 bg-slate-700/50 hover:bg-slate-600/70 text-gray-200 hover:text-white border border-slate-600/50 rounded-xl transition-all duration-200" title="กลับไปก่อนหน้า">
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">งานของฉัน</h1>
          <p className="text-sm text-gray-400">งาน Outsource ที่ได้รับมอบหมาย</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
        <select value={filter.status} onChange={(e) => setFilter({ status: e.target.value, page: 1 })}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">ทุกสถานะ</option>
          <option value="AWARDED">มอบหมายแล้ว</option>
          <option value="IN_PROGRESS">กำลังดำเนินการ</option>
          <option value="COMPLETED">รอตรวจสอบ</option>
          <option value="VERIFIED">ตรวจสอบผ่าน</option>
          <option value="PAID">จ่ายเงินแล้ว</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="mx-auto h-12 w-12 text-gray-500 mb-3" />
            <p className="text-white font-medium">ยังไม่มีงาน</p>
            <p className="text-sm text-gray-400 mt-1">เมื่อข้อเสนอของคุณได้รับเลือก งานจะแสดงที่นี่</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {jobs.map((job: any) => (
              <div key={job.id} className="p-6 hover:bg-slate-700/30 transition">
                <div className="flex items-start justify-between">
                  <Link href={`/dashboard/outsource/${job.id}`} className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-mono text-blue-400">{job.jobCode}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[job.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {statusLabels[job.status] || job.status}
                      </span>
                    </div>
                    <h3 className="text-white font-medium mt-1">{job.title}</h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                      {job.agreedPrice && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="text-emerald-400 font-medium">{Number(job.agreedPrice).toLocaleString()} บาท</span>
                        </span>
                      )}
                      {job.incident?.store && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {formatStore(job.incident.store)}
                        </span>
                      )}
                      {job.awardedAt && <span>ได้รับเมื่อ {formatDate(job.awardedAt)}</span>}
                    </div>
                  </Link>
                  <div className="ml-4 flex items-center gap-2">
                    {job.status === 'AWARDED' && (
                      <button onClick={() => handleStart(job.id)}
                        className="px-3 py-1.5 hover:brightness-110 text-white rounded-lg text-xs transition flex items-center gap-1"
                        style={{ backgroundColor: themeHighlight }}>
                        <Play className="h-3.5 w-3.5" /> เริ่มงาน
                      </button>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <Link href={`/dashboard/outsource/${job.id}`}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> ส่งงาน
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-700/50 px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-gray-400">แสดง {jobs.length} จาก {pagination.total}</span>
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
