// app/(dashboard)/dashboard/outsource/page.tsx - Outsource Marketplace
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import { useLicense } from '@/context/LicenseContext'
import LicenseLock from '@/components/LicenseLock'
import {
  Briefcase,
  DollarSign,
  Clock,
  MapPin,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Calendar,
  FileText,
} from 'lucide-react'
import { isViewOnly, canPerformAction, getUserRoles, getHighestRole } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface OutsourceJob {
  id: number
  jobCode: string
  title: string
  description: string
  budgetMin: number | null
  budgetMax: number | null
  agreedPrice: number | null
  deadline: string | null
  urgencyLevel: string
  status: string
  postedAt: string
  incident: {
    id: string
    ticketNumber: string
    title: string
    status: string
    store: {
      id: number
      name: string
      storeCode: string
      company?: string
      address?: string
      province?: string
      googleMapLink?: string
    }
  }
  postedBy: {
    firstName: string
    lastName: string
  }
  awardedTo?: {
    firstName: string
    lastName: string
  }
  verifiedAt?: string | null
  _count?: {
    bids: number
  }
}

interface Stats {
  totalJobs: number
  openJobs: number
  inProgressJobs: number
  completedJobs: number
  totalBids: number
  avgBidsPerJob: number
  totalPayments: number
  documentSubmittedJobs: number
  verifiedJobs: number
  paymentDueJobs: number
  paidJobs: number
}

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
  PAYMENT_DUE: 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'ร่าง',
  PENDING_APPROVAL: 'รออนุมัติ',
  OPEN: 'เปิดรับงาน',
  BIDDING_CLOSED: 'ปิดรับงาน',
  AWARDED: 'กำลังดำเนินการ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  COMPLETED: 'งานเสร็จ',
  DOCUMENT_SUBMITTED: 'ส่งเอกสารแล้ว',
  VERIFIED: 'ตรวจสอบเอกสารแล้ว',
  REJECTED: 'ไม่ผ่าน',
  PAID: 'จ่ายเงินแล้ว',
  CANCELLED: 'ยกเลิก',
  PENDING_CANCEL: 'รอยืนยันยกเลิก',
  PAYMENT_DUE: 'ครบกำหนดจ่าย',
}

const urgencyColors: Record<string, string> = {
  LOW: 'text-gray-400',
  NORMAL: 'text-blue-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
}

export default function OutsourceMarketplacePage() {
  const { isExpired, hasLicense, isTrialGrace, isTrialExpired, trialDaysRemaining } = useLicense()
  const themeHighlight = useThemeHighlight()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<OutsourceJob[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState({
    status: '',
    page: 1,
    search: '',
    dateFrom: '',
    dateTo: '',
  })
  const [searchInput, setSearchInput] = useState('')
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const parsed = JSON.parse(userStr)
      setUser(parsed)
      const roles = getUserRoles(parsed)
      const higherRoles = ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR']
      const hasHigherRole = roles.some(r => higherRoles.includes(r))
      if (roles.includes('HELP_DESK') && !hasHigherRole) {
        router.replace('/dashboard')
      }
    }
  }, [])

  const userRoles = getUserRoles(user)
  const highestRole = getHighestRole(user) || ''
  // Role flags derived from the highest-ranking role so multi-role users
  // always behave according to their most privileged role.
  const isItManager = ['SUPER_ADMIN', 'IT_MANAGER'].includes(highestRole)
  const isSupervisor = highestRole === 'SUPERVISOR'
  const isFinance = highestRole === 'FINANCE_ADMIN'
  const isAdmin = isItManager || isSupervisor || isFinance || highestRole === 'HELP_DESK'
  const isTechnician = !isAdmin && !isFinance && highestRole === 'TECHNICIAN'
  const isOutsource = user?.technicianType === 'OUTSOURCE'

  const viewOnly = isViewOnly(user, '/dashboard/outsource')
  const canCreate = canPerformAction(user, '/dashboard/outsource', 'create')

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [filter, user])

  const loadData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const config = { headers: { Authorization: `Bearer ${token}` } }

      if (isAdmin) {
        const [jobsRes, statsRes] = await Promise.all([
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs`, {
            ...config,
            params: {
              page: filter.page,
              limit: 20,
              status: filter.status || undefined,
              search: filter.search || undefined,
              dateFrom: filter.dateFrom || undefined,
              dateTo: filter.dateTo || undefined,
            },
          }),
          axios.get(`${process.env.NEXT_PUBLIC_API_URL}/outsource/stats`, config),
        ])
        setJobs(jobsRes.data.data)
        setPagination(jobsRes.data.pagination)
        setStats(statsRes.data)
      } else if (isTechnician && isOutsource) {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/outsource/marketplace`, {
          ...config,
          params: {
            page: filter.page,
            limit: 20,
          },
        })
        setJobs(res.data.data)
        setPagination(res.data.pagination)
      }
    } catch (err) {
      console.error('Error loading outsource data:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return 'ไม่ระบุ'
    if (min && max) return `${Number(min).toLocaleString()} - ${Number(max).toLocaleString()} บาท`
    if (min) return `ตั้งแต่ ${Number(min).toLocaleString()} บาท`
    if (max) return `ไม่เกิน ${Number(max).toLocaleString()} บาท`
    return 'ไม่ระบุ'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (isTechnician && !isOutsource) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400 mb-3" />
          <h3 className="text-lg font-medium text-white">เฉพาะช่าง Outsource</h3>
          <p className="mt-1 text-sm text-gray-400">
            ระบบ Marketplace นี้สำหรับช่าง Outsource เท่านั้น
          </p>
        </div>
      </div>
    )
  }

  if (isExpired || !hasLicense) return (
    <LicenseLock
      featureName="Outsource Marketplace"
      reason={isTrialGrace ? 'grace' : isTrialExpired ? 'trial_expired' : isExpired ? 'expired' : 'no_license'}
      daysRemaining={isTrialGrace ? trialDaysRemaining : null}
    />
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {(isFinance || isItManager) ? 'Outsource Finance' : isAdmin ? 'Outsource Marketplace' : 'หางาน Outsource'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {(isFinance || isItManager)
              ? 'ตรวจสอบเอกสารและจัดการการจ่ายเงินช่างภายนอก'
              : isAdmin
              ? 'จัดการงานจ้างช่างภายนอก'
              : 'เลือกงานที่สนใจและกดรับงาน'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewOnly && (
            <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium">
              View Only
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {isAdmin && stats && (
        (isFinance || isItManager) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="งานทั้งหมด" value={stats.totalJobs} icon={Briefcase} />
            <StatCard label="ส่งเอกสารแล้ว" value={stats.documentSubmittedJobs} icon={FileText} color="cyan" />
            <StatCard label="ตรวจสอบแล้ว" value={stats.verifiedJobs} icon={CheckCircle2} color="teal" />
            <StatCard label="ครบกำหนดจ่าย" value={stats.paymentDueJobs} icon={AlertTriangle} color="rose" />
            <StatCard label="จ่ายแล้ว" value={stats.paidJobs} icon={DollarSign} color="emerald" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="งานทั้งหมด" value={stats.totalJobs} icon={Briefcase} />
            <StatCard label="เปิดรับ" value={stats.openJobs} icon={CheckCircle2} color="green" />
            <StatCard label="กำลังทำ" value={stats.inProgressJobs} icon={Clock} color="blue" />
            <StatCard label="เสร็จสิ้น" value={stats.completedJobs} icon={CheckCircle2} color="emerald" />
          </div>
        )
      )}

      {/* Filters */}
      {isAdmin && (!isSupervisor || isItManager || isFinance) && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">ทุกสถานะ</option>
              <option value="PENDING_APPROVAL">รออนุมัติ</option>
              <option value="OPEN">เปิดรับงาน</option>
              {(isFinance || isItManager) && (
                <>
                  <option value="AWARDED">กำลังดำเนินการ</option>
                  <option value="COMPLETED">งานเสร็จ</option>
                  <option value="DOCUMENT_SUBMITTED">ส่งเอกสารแล้ว</option>
                  <option value="VERIFIED">ตรวจสอบเอกสารแล้ว</option>
                  <option value="PAYMENT_DUE">ครบกำหนดจ่าย</option>
                  <option value="PAID">จ่ายเงินแล้ว</option>
                </>
              )}
              <option value="PENDING_CANCEL">รอยืนยันยกเลิก</option>
              <option value="CANCELLED">ยกเลิก</option>
            </select>

            {/* Search technician name */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อช่าง..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setFilter({ ...filter, search: searchInput, page: 1 })
                  }
                }}
                onBlur={() => {
                  if (searchInput !== filter.search) {
                    setFilter({ ...filter, search: searchInput, page: 1 })
                  }
                }}
                className="bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value, page: 1 })}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400 text-sm">ถึง</span>
              <input
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value, page: 1 })}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Clear filters */}
            {(filter.search || filter.dateFrom || filter.dateTo) && (
              <button
                onClick={() => {
                  setSearchInput('')
                  setFilter({ ...filter, search: '', dateFrom: '', dateTo: '', page: 1 })
                }}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        {jobs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="mx-auto h-12 w-12 text-gray-500 mb-3" />
            <h3 className="text-lg font-medium text-white">
              {isAdmin ? 'ยังไม่มีงาน Outsource' : 'ไม่มีงานที่เปิดรับ'}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {isAdmin
                ? 'สร้างงาน Outsource ใหม่เพื่อเริ่มต้น'
                : 'กลับมาตรวจสอบภายหลัง'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/outsource/${job.id}`}
                className="block hover:bg-slate-700/30 transition duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono text-blue-400">
                          {job.incident?.ticketNumber}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                          {statusLabels[job.status]}
                        </span>
                        {/* ครบกำหนดจ่าย badge */}
                        {job.status === 'VERIFIED' && job.verifiedAt && (() => {
                          const days = Math.floor((Date.now() - new Date(job.verifiedAt).getTime()) / (1000 * 60 * 60 * 24))
                          return days >= 30 ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors['PAYMENT_DUE']}`}>
                              {statusLabels['PAYMENT_DUE']}
                            </span>
                          ) : null
                        })()}
                        <span className={`text-xs font-medium ${urgencyColors[job.urgencyLevel]}`}>
                          {job.urgencyLevel === 'URGENT' && '!!! '}
                          {job.urgencyLevel === 'HIGH' && '!! '}
                          {job.urgencyLevel}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-medium text-white">
                        {job.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                        {job.description}
                      </p>
                      {/* Store Details */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex items-center text-gray-400 sm:col-span-2">
                          <span className="text-gray-500 w-20 flex-shrink-0">Store</span>
                          <span className="text-white">{formatStore(job.incident?.store)}</span>
                        </div>
                        {job.incident?.store?.address && (
                          <div className="flex items-start text-gray-400 sm:col-span-2">
                            <span className="text-gray-500 w-20 flex-shrink-0">Address</span>
                            <span className="text-white">{job.incident.store.address}</span>
                          </div>
                        )}
                        {job.incident?.store?.province && (
                          <div className="flex items-center text-gray-400">
                            <span className="text-gray-500 w-20 flex-shrink-0">Province</span>
                            <span className="text-white">{job.incident.store.province}</span>
                          </div>
                        )}
                        {job.incident?.store?.googleMapLink && (
                          <div className="flex items-center text-gray-400">
                            <span className="text-gray-500 w-20 flex-shrink-0">Map</span>
                            <a
                              href={job.incident.store.googleMapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                            >
                              Google Map <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {job.agreedPrice && (
                          <div className="flex items-center text-gray-400">
                            <span className="text-gray-500 w-20 flex-shrink-0">ราคาจ้าง</span>
                            <span className="text-emerald-400 font-semibold">{Number(job.agreedPrice).toLocaleString()} บาท</span>
                          </div>
                        )}
                      </div>
                      {job.deadline && (
                        <div className="mt-2 flex items-center gap-1 text-sm text-gray-400">
                          <Clock className="h-4 w-4" />
                          นัดเข้างาน: {formatDate(job.deadline)}
                        </div>
                      )}
                      {job.verifiedAt && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <div className="flex items-center gap-1 text-teal-400">
                            <CheckCircle2 className="h-4 w-4" />
                            ตรวจสอบเอกสาร: {formatDate(job.verifiedAt)}
                          </div>
                          {(() => {
                            const days = Math.floor((Date.now() - new Date(job.verifiedAt).getTime()) / (1000 * 60 * 60 * 24))
                            return (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                days >= 30
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-slate-600/50 text-gray-300'
                              }`}>
                                {days} วันแล้ว
                              </span>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                    {job.awardedTo && (
                      <div className="ml-4 text-right">
                        <p className="text-xs text-gray-500">ผู้รับงาน</p>
                        <p className="text-sm font-medium text-white">
                          {job.awardedTo.firstName} {job.awardedTo.lastName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-700/50 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              แสดง {jobs.length} จาก {pagination.total} รายการ
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
                disabled={filter.page === 1}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-400">
                {filter.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
                disabled={filter.page === pagination.totalPages}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links for Technicians */}
      {isTechnician && isOutsource && (
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/dashboard/incidents"
            className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-700/50 transition duration-200"
          >
            <h3 className="text-lg font-medium text-white">งานของฉัน (Incidents)</h3>
            <p className="mt-1 text-sm text-gray-400">ดูงานที่รับแล้วและดำเนินการเหมือนช่างประจำ</p>
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'gray',
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color?: string
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-slate-700/50 text-gray-400',
    green: 'bg-green-500/15 text-green-400',
    blue: 'bg-blue-500/15 text-blue-400',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    indigo: 'bg-indigo-500/15 text-indigo-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
    teal: 'bg-teal-500/15 text-teal-400',
    rose: 'bg-rose-500/15 text-rose-400',
  }

  return (
    <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}
