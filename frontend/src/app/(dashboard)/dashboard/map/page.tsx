// app/(dashboard)/dashboard/map/page.tsx - Check-in Map
'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import toast from 'react-hot-toast'
import { RefreshCw, MapPin, Calendar, ChevronLeft, ChevronRight, User, Users } from 'lucide-react'
import { useLicense } from '@/context/LicenseContext'
import LicenseLock from '@/components/LicenseLock'

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
    <div className="h-[calc(100vh-14rem)] bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl flex items-center justify-center">
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

function getTodayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function formatDateThai(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MapPage() {
  const { isExpired, hasLicense, isTrialGrace, isTrialExpired, trialDaysRemaining } = useLicense()
  const [checkins, setCheckins] = useState<MapCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTechnician, setFilterTechnician] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [showTechnicianLocations, setShowTechnicianLocations] = useState(false)
  const [technicianLocations, setTechnicianLocations] = useState<TechnicianLocation[]>([])
  const [loadingTechs, setLoadingTechs] = useState(false)
  const themeHighlight = useThemeHighlight()

  const fetchCheckins = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const params: Record<string, string> = {
        from: selectedDate,
        to: selectedDate,
      }
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

  // Unique technicians for dropdown
  const uniqueTechnicians = useMemo(() => {
    const seen = new Set<string>()
    return checkins
      .filter(c => { if (seen.has(c.technicianName)) return false; seen.add(c.technicianName); return true })
      .map(c => c.technicianName)
      .sort()
  }, [checkins])

  // Filter checkins by technician (client-side)
  const filteredCheckins = useMemo(() => {
    if (!filterTechnician) return checkins
    return checkins.filter(c => c.technicianName === filterTechnician)
  }, [checkins, filterTechnician])

  // Count by status (from filtered list)
  const statusCounts = filteredCheckins.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (isExpired || !hasLicense) return (
    <LicenseLock
      featureName="Realtime Tracking"
      reason={isTrialGrace ? 'grace' : isTrialExpired ? 'trial_expired' : isExpired ? 'expired' : 'no_license'}
      daysRemaining={isTrialGrace ? trialDaysRemaining : null}
    />
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-6 w-6 text-blue-400" />
            Check-in Map
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            แสดงตำแหน่ง Check-in ของช่างบนแผนที่ ({filteredCheckins.length} จุด)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-slate-800/70 border border-slate-700/50 rounded-xl px-2 py-1">
            <button
              onClick={() => changeDate(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-600/50 text-gray-300 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="relative flex items-center gap-2 px-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-white font-medium">{formatDateThai(selectedDate)}</span>
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
              className="p-1.5 rounded-lg hover:bg-slate-600/50 text-gray-300 transition disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(getTodayStr())}
                className="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition"
              >
                วันนี้
              </button>
            )}
          </div>
          {/* Show All Technicians toggle */}
          <button
            onClick={handleToggleTechnicianLocations}
            disabled={loadingTechs}
            title="แสดงตำแหน่งช่างทั้งหมด"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              showTechnicianLocations
                ? 'bg-teal-600/30 border border-teal-500/50 text-teal-400 hover:bg-teal-600/40'
                : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
            }`}
          >
            {loadingTechs
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Users className="h-4 w-4" />
            }
            <span className="hidden sm:inline">ช่างทั้งหมด</span>
            {showTechnicianLocations && technicianLocations.length > 0 && (
              <span className="bg-teal-500/30 text-teal-300 text-xs px-1.5 py-0.5 rounded-full">
                {technicianLocations.filter(t => t.province && t.province in ({} as any)).length || technicianLocations.length}
              </span>
            )}
          </button>
          {/* Refresh */}
          <button
            onClick={fetchCheckins}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filters */}
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setFilterStatus(sf.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                filterStatus === sf.value
                  ? 'text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50'
              }`}
              style={filterStatus === sf.value ? { backgroundColor: themeHighlight } : undefined}
            >
              {sf.color && <span className={`w-2.5 h-2.5 rounded-full ${sf.color}`}></span>}
              {sf.label}
              {sf.value === '' && filteredCheckins.length > 0 && (
                <span className="bg-slate-600 px-1.5 py-0.5 rounded-full text-xs">{filteredCheckins.length}</span>
              )}
              {sf.value && statusCounts[sf.value] ? (
                <span className="bg-slate-600 px-1.5 py-0.5 rounded-full text-xs">{statusCounts[sf.value]}</span>
              ) : null}
            </button>
          ))}

          {/* Technician filter */}
          {uniqueTechnicians.length > 0 && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-600/50">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                className="bg-slate-700/50 border border-slate-600/50 text-sm text-gray-300 rounded-full px-3 py-1.5 focus:outline-none focus:border-slate-500 cursor-pointer"
              >
                <option value="">ช่างทั้งหมด ({checkins.length})</option>
                {uniqueTechnicians.map(name => {
                  const count = checkins.filter(c => c.technicianName === name).length
                  return (
                    <option key={name} value={name}>{name} ({count})</option>
                  )
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Technician location hint */}
      {showTechnicianLocations && (
        <div className="bg-teal-900/30 border border-teal-500/30 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-teal-300">
          <Users className="w-4 h-4 shrink-0" />
          แสดงหมุด <strong>{technicianLocations.filter(t => t.province).length}</strong> คน
          ตามจังหวัดที่บันทึกไว้ในโปรไฟล์
          {technicianLocations.filter(t => !t.province).length > 0 && (
            <span className="text-teal-500 text-xs ml-1">
              ({technicianLocations.filter(t => !t.province).length} คนยังไม่ระบุจังหวัด)
            </span>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className="h-[calc(100vh-14rem)] bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        <MapView
          checkins={filteredCheckins}
          technicianLocations={showTechnicianLocations ? technicianLocations : []}
        />
      </div>
    </div>
  )
}
