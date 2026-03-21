// app/(dashboard)/dashboard/map/page.tsx - Check-in Map
'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import toast from 'react-hot-toast'
import { RefreshCw, MapPin, Calendar, ChevronLeft, ChevronRight, User, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { useLicense } from '@/context/LicenseContext'
import LicenseLock from '@/components/LicenseLock'
import { formatStore } from '@/utils/formatStore'

function useThemeHighlight() {
  const [color, setColor] = useState('#3b82f6')
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (v) setColor(v)
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return color
}

import type { TechnicianLocation } from '@/components/map/MapView'

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading map...</p>
      </div>
    </div>
  ),
})

interface MapCheckin {
  id: string
  ticketNumber: string
  title: string
  status: string
  latitude: number
  longitude: number
  checkInAt: string
  confirmedAt: string | null
  resolvedAt: string | null
  storeName: string
  storeCode: string
  storeId?: number
  technicianName: string
  technicianInitials: string
  technicianAvatar?: string | null
}

const statusFilters = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'ASSIGNED', label: 'มอบหมายแล้ว', color: 'bg-purple-500' },
  { value: 'IN_PROGRESS', label: 'กำลังดำเนินการ', color: 'bg-yellow-500' },
  { value: 'RESOLVED', label: 'แก้ไขแล้ว', color: 'bg-green-500' },
  { value: 'CLOSED', label: 'ปิดงาน', color: 'bg-green-500' },
]

const statusBadge: Record<string, { label: string; cls: string }> = {
  ASSIGNED:    { label: 'มอบหมายแล้ว',       cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ',    cls: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  RESOLVED:    { label: 'แก้ไขแล้ว',          cls: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  CLOSED:      { label: 'ปิดงาน',             cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  OPEN:        { label: 'เปิด',               cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  CANCELLED:   { label: 'ยกเลิก',            cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
}

function getTodayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function formatDateThai(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateThaiShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function formatTime(isoStr: string | null) {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function MapPage() {
  const { isExpired, hasLicense, isTrialGrace, isTrialExpired, trialDaysRemaining } = useLicense()
  const [checkins, setCheckins] = useState<MapCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTechnician, setFilterTechnician] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [showTechnicianLocations, setShowTechnicianLocations] = useState(false)
  const [filterTechType, setFilterTechType] = useState<'' | 'INSOURCE' | 'OUTSOURCE'>('')
  const [technicianLocations, setTechnicianLocations] = useState<TechnicianLocation[]>([])
  const [loadingTechs, setLoadingTechs] = useState(false)
  const themeHighlight = useThemeHighlight()

  const fetchCheckins = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const params: Record<string, string> = { from: selectedDate, to: selectedDate }
      if (filterStatus) params.status = filterStatus
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/analytics/map-checkins`,
        { headers: { Authorization: `Bearer ${token}` }, params }
      )
      setCheckins(res.data)
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลแผนที่ได้')
    } finally {
      setLoading(false)
    }
  }

  const fetchTechnicianLocations = async () => {
    try {
      setLoadingTechs(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/technicians/locations`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTechnicianLocations(res.data || [])
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลช่างได้')
    } finally {
      setLoadingTechs(false)
    }
  }

  const handleToggleTechnicianLocations = () => {
    if (!showTechnicianLocations && technicianLocations.length === 0) {
      fetchTechnicianLocations()
    }
    setShowTechnicianLocations(prev => !prev)
  }

  useEffect(() => {
    fetchCheckins()
  }, [filterStatus, selectedDate])

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))
  }

  const isToday = selectedDate === getTodayStr()

  const uniqueTechnicians = useMemo(() => {
    const seen = new Set<string>()
    return checkins
      .filter(c => { if (seen.has(c.technicianName)) return false; seen.add(c.technicianName); return true })
      .map(c => c.technicianName)
      .sort()
  }, [checkins])

  const filteredCheckins = useMemo(() => {
    if (!filterTechnician) return checkins
    return checkins.filter(c => c.technicianName === filterTechnician)
  }, [checkins, filterTechnician])

  // Sort checkins by checkInAt for the list below the map
  const sortedCheckins = useMemo(() =>
    [...filteredCheckins].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime()),
    [filteredCheckins]
  )

  const statusCounts = filteredCheckins.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Filter technician locations by type
  const filteredTechLocations = useMemo(() => {
    if (!filterTechType) return technicianLocations
    return technicianLocations.filter(t => t.technicianType === filterTechType)
  }, [technicianLocations, filterTechType])

  const activeTechsWithLocation = filteredTechLocations.filter(
    t => t.province || (t.responsibleProvinces && t.responsibleProvinces.length > 0)
  ).length

  if (isExpired || !hasLicense) return (
    <LicenseLock
      featureName="Realtime Tracking"
      reason={isTrialGrace ? 'grace' : isTrialExpired ? 'trial_expired' : isExpired ? 'expired' : 'no_license'}
      daysRemaining={isTrialGrace ? trialDaysRemaining : null}
    />
  )

  return (
    <div className="flex flex-col gap-3">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 shrink-0" />
            Check-in Map
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-400">
            แสดงตำแหน่ง Check-in ของช่างบนแผนที่ ({filteredCheckins.length} จุด)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center flex-1 sm:flex-none bg-slate-800/70 border border-slate-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => changeDate(-1)}
              className="p-3 sm:p-2 hover:bg-slate-600/50 text-gray-300 transition active:bg-slate-500/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative flex items-center gap-1.5 px-2 flex-1 sm:flex-none sm:px-3 min-w-0">
              <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-xs sm:text-sm text-white font-medium truncate">
                <span className="sm:hidden">{formatDateThaiShort(selectedDate)}</span>
                <span className="hidden sm:inline">{formatDateThai(selectedDate)}</span>
              </span>
              <input
                type="date"
                value={selectedDate}
                max={getTodayStr()}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              className="p-3 sm:p-2 hover:bg-slate-600/50 text-gray-300 transition disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(getTodayStr())}
                className="px-3 py-3 sm:py-2 bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition border-l border-slate-700/50"
              >
                วันนี้
              </button>
            )}
          </div>

          {/* Show Technicians toggle */}
          <button
            onClick={handleToggleTechnicianLocations}
            disabled={loadingTechs}
            title="แสดงตำแหน่งช่างทั้งหมด"
            className={`flex items-center gap-1.5 px-3 py-3 sm:py-2 rounded-xl text-sm font-medium transition active:scale-95 ${
              showTechnicianLocations
                ? 'bg-teal-600/30 border border-teal-500/50 text-teal-400'
                : 'bg-slate-800/70 border border-slate-700/50 text-gray-300 hover:bg-slate-700/70'
            }`}
          >
            {loadingTechs ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            <span className="hidden sm:inline text-sm">ช่างทั้งหมด</span>
            {showTechnicianLocations && technicianLocations.length > 0 && (
              <span className="bg-teal-500/30 text-teal-300 text-xs px-1.5 py-0.5 rounded-full">
                {activeTechsWithLocation || technicianLocations.length}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchCheckins}
            disabled={loading}
            className="p-3 sm:p-2 rounded-xl bg-slate-800/70 border border-slate-700/50 hover:bg-slate-700/70 text-gray-300 transition disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Status + Technician Filters ───────────────────────── */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Status filter — scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-hide">
            {statusFilters.map((sf) => (
              <button
                key={sf.value}
                onClick={() => setFilterStatus(sf.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition whitespace-nowrap active:scale-95 ${
                  filterStatus === sf.value ? 'text-white' : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50'
                }`}
                style={filterStatus === sf.value ? { backgroundColor: themeHighlight } : undefined}
              >
                {sf.color && <span className={`w-2 h-2 rounded-full shrink-0 ${sf.color}`} />}
                {sf.label}
                {sf.value === '' && filteredCheckins.length > 0 && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{filteredCheckins.length}</span>
                )}
                {sf.value && statusCounts[sf.value] ? (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{statusCounts[sf.value]}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Technician dropdown filter */}
          {uniqueTechnicians.length > 0 && (
            <div className="flex items-center gap-2 sm:ml-2 sm:pl-2 sm:border-l sm:border-slate-600/50">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-700/50 border border-slate-600/50 text-sm text-gray-300 rounded-full px-3 py-2 focus:outline-none focus:border-slate-500 cursor-pointer"
              >
                <option value="">ช่างทั้งหมด ({checkins.length})</option>
                {uniqueTechnicians.map(name => {
                  const count = checkins.filter(c => c.technicianName === name).length
                  return <option key={name} value={name}>{name} ({count})</option>
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Technician location hint + type filter ────────────── */}
      {showTechnicianLocations && (
        <div className="bg-teal-900/30 border border-teal-500/30 rounded-xl px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-teal-300">
            <Users className="w-4 h-4 shrink-0" />
            <span>
              แสดงหมุด <strong>{activeTechsWithLocation}</strong> คน ตามจังหวัดที่บันทึกไว้
              {filteredTechLocations.filter(t => !t.province && !(t.responsibleProvinces && t.responsibleProvinces.length > 0)).length > 0 && (
                <span className="text-teal-500 text-xs ml-1">
                  ({filteredTechLocations.filter(t => !t.province && !(t.responsibleProvinces && t.responsibleProvinces.length > 0)).length} คนยังไม่ระบุจังหวัด)
                </span>
              )}
            </span>
          </div>

          {/* Inhouse / Outsource filter pills */}
          <div className="flex items-center gap-1.5">
            {([
              { value: '' as const,         label: 'ทั้งหมด',  count: technicianLocations.length },
              { value: 'INSOURCE' as const, label: 'Inhouse',  count: technicianLocations.filter(t => t.technicianType === 'INSOURCE').length },
              { value: 'OUTSOURCE' as const,label: 'Outsource',count: technicianLocations.filter(t => t.technicianType === 'OUTSOURCE').length },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterTechType(opt.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  filterTechType === opt.value
                    ? 'bg-teal-500 text-white'
                    : 'bg-teal-900/50 text-teal-300 hover:bg-teal-800/60 border border-teal-600/30'
                }`}
              >
                {opt.label}
                <span className={`px-1 rounded-full text-xs ${filterTechType === opt.value ? 'bg-white/20' : 'bg-teal-800/60'}`}>
                  {opt.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Map — portrait ratio to match Thailand's shape ───── */}
      <div
        className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden w-full"
        style={{ aspectRatio: '3 / 4', maxHeight: '82vh', minHeight: '340px' }}
      >
        <MapView
          checkins={showTechnicianLocations ? [] : filteredCheckins}
          technicianLocations={showTechnicianLocations ? filteredTechLocations : []}
        />
      </div>

      {/* ── Check-in List ─────────────────────────────────────── */}
      {!showTechnicianLocations && sortedCheckins.length > 0 && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              รายชื่อ Check-in วันนี้
              <span className="text-xs font-normal text-gray-400 ml-1">เรียงตามเวลา Check-in</span>
            </h2>
            <span className="text-xs text-gray-400">{sortedCheckins.length} รายการ</span>
          </div>

          {/* Table: desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-slate-700/50">
                  <th className="px-4 py-2.5 text-left w-8">#</th>
                  <th className="px-4 py-2.5 text-left">ช่าง</th>
                  <th className="px-4 py-2.5 text-left">Check-in ที่</th>
                  <th className="px-4 py-2.5 text-left">เวลา Check-in</th>
                  <th className="px-4 py-2.5 text-left">Incident</th>
                  <th className="px-4 py-2.5 text-left">รายละเอียด</th>
                  <th className="px-4 py-2.5 text-left">เวลา Resolve</th>
                  <th className="px-4 py-2.5 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {sortedCheckins.map((c, idx) => {
                  const badge = statusBadge[c.status] || { label: c.status, cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' }
                  return (
                    <tr key={c.id} className="hover:bg-slate-700/20 transition">
                      <td className="px-4 py-3 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{c.technicianName}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {formatStore({ storeCode: c.storeCode, name: c.storeName })}
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono text-xs">
                        {formatTime(c.checkInAt)}
                      </td>
                      <td className="px-4 py-3 text-blue-400 font-medium whitespace-nowrap text-xs">
                        {c.ticketNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={c.title}>
                        {c.title}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                        {c.resolvedAt
                          ? <span className="text-green-400">{formatTime(c.resolvedAt)}</span>
                          : <span className="text-gray-500">-</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards: mobile */}
          <div className="sm:hidden divide-y divide-slate-700/30">
            {sortedCheckins.map((c, idx) => {
              const badge = statusBadge[c.status] || { label: c.status, cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' }
              return (
                <div key={c.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-500 text-xs shrink-0">#{idx + 1}</span>
                      <span className="text-white font-semibold text-sm truncate">{c.technicianName}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                    {formatStore({ storeCode: c.storeCode, name: c.storeName })}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      Check-in: <span className="text-white font-mono">{formatTime(c.checkInAt)}</span>
                    </span>
                    {c.resolvedAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        Resolve: <span className="text-green-400 font-mono">{formatTime(c.resolvedAt)}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    <span className="text-blue-400 font-medium">{c.ticketNumber}</span>
                    <span className="text-gray-500 mx-1">·</span>
                    <span className="text-gray-300">{c.title}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state when no checkins */}
      {!showTechnicianLocations && !loading && sortedCheckins.length === 0 && (
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl py-8 flex flex-col items-center gap-2 text-gray-500">
          <AlertCircle className="w-8 h-8 text-slate-600" />
          <p className="text-sm">ไม่มีข้อมูล Check-in ในวันที่เลือก</p>
        </div>
      )}

      {/* ── Technician Location List (shown when toggle is on) ─── */}
      {showTechnicianLocations && filteredTechLocations.length > 0 && (
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              รายชื่อช่างเทคนิค
              <span className="text-xs font-normal text-gray-400 ml-1">ตำแหน่งตาม Profile</span>
            </h2>
            <span className="text-xs text-gray-400">{filteredTechLocations.length} คน</span>
          </div>

          {/* Table: desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-slate-700/50">
                  <th className="px-4 py-2.5 text-left w-8">#</th>
                  <th className="px-4 py-2.5 text-left">ชื่อช่าง</th>
                  <th className="px-4 py-2.5 text-left">ประเภท</th>
                  <th className="px-4 py-2.5 text-left">อำเภอ</th>
                  <th className="px-4 py-2.5 text-left">จังหวัด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filteredTechLocations.map((t, idx) => {
                  const isOut = t.technicianType === 'OUTSOURCE'
                  const province = t.province || (t.responsibleProvinces?.[0] ?? '-')
                  return (
                    <tr key={t.id} className="hover:bg-slate-700/20 transition">
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                        {t.firstName} {t.lastName}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isOut
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        }`}>
                          {isOut ? 'Outsource' : 'Inhouse'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-300">{t.district || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-300">{province}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards: mobile */}
          <div className="sm:hidden divide-y divide-slate-700/30">
            {filteredTechLocations.map((t, idx) => {
              const isOut = t.technicianType === 'OUTSOURCE'
              const province = t.province || (t.responsibleProvinces?.[0] ?? '-')
              return (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{t.firstName} {t.lastName}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        isOut
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-teal-500/20 text-teal-300'
                      }`}>
                        {isOut ? 'Outsource' : 'Inhouse'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {t.district ? `${t.district} · ` : ''}{province}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
