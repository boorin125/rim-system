'use client'

/**
 * ScheduledAssignmentPanel
 * Inline Supervisor-only panel placed between ReassignmentHistory and CommentSection
 * in the Incident Detail page.
 *
 * State 1 (OPEN / PENDING): shows technician picker + optional date/time → calls /assign
 * State 2 (ASSIGNED + scheduledAt set): shows info card with amber border
 */

import { useState, useEffect, useMemo } from 'react'
import { Calendar, Search, Check, AlertCircle, X } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { TimeInput } from '@/components/TimeInput'

interface Props {
  incident: any
  onSuccess: () => void
}

export default function ScheduledAssignmentPanel({ incident, onSuccess }: Props) {
  const [technicians, setTechnicians] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTechs, setLoadingTechs] = useState(false)

  const isUnassigned =
    incident.status === 'PENDING' || incident.status === 'OPEN'
  const isAssignedWithSchedule =
    incident.status === 'ASSIGNED' && incident.scheduledAt

  // Fetch technicians when in unassigned state
  useEffect(() => {
    if (isUnassigned) fetchTechnicians()
  }, [incident.id, isUnassigned])

  const fetchTechnicians = async () => {
    try {
      setLoadingTechs(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { role: 'TECHNICIAN', technicianType: 'INSOURCE' },
      })
      const data = res.data
      setTechnicians(Array.isArray(data) ? data : data?.data ?? data?.users ?? [])
    } catch {
      toast.error('ไม่สามารถโหลดรายชื่อช่างเทคนิคได้')
    } finally {
      setLoadingTechs(false)
    }
  }

  const filteredTechnicians = useMemo(() => {
    if (!searchQuery.trim()) return technicians
    const q = searchQuery.toLowerCase()
    return technicians.filter((t) =>
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q)
    )
  }, [technicians, searchQuery])

  const toggleTech = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const handleAssign = async () => {
    if (selectedIds.length === 0) {
      toast.error('กรุณาเลือกช่างเทคนิคอย่างน้อย 1 คน')
      return
    }
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const payload: any = { technicianIds: selectedIds }
      if (scheduledDate && scheduledTime) {
        payload.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
      }
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incident.id}/assign`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(
        scheduledDate
          ? `มอบหมายงานสำเร็จ — กำหนดเข้าดำเนินการ ${new Date(`${scheduledDate}T${scheduledTime}:00`).toLocaleDateString('th-TH')} ${scheduledTime}`
          : 'มอบหมายงานสำเร็จ'
      )
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ไม่สามารถมอบหมายงานได้')
    } finally {
      setIsLoading(false)
    }
  }

  const formatScheduledAt = (dt: string) =>
    new Date(dt).toLocaleString('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  // --- State 2: already assigned with scheduled time (info card) ---
  if (isAssignedWithSchedule) {
    const assignedTechs = incident.assignees?.filter((a: any) => a.user) ?? []
    return (
      <div className="glass-card p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
        <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          Scheduled Assignment
        </h2>
        <div className="space-y-2">
          {assignedTechs.length > 0 ? assignedTechs.map((a: any) => (
            <div
              key={a.userId ?? a.user?.id}
              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {a.user?.firstName} {a.user?.lastName}
                </p>
                <p className="text-xs text-amber-300 mt-0.5">
                  กำหนดเข้าดำเนินการ: {formatScheduledAt(incident.scheduledAt)}
                </p>
              </div>
              <span className="text-xs text-gray-400">SLA นับจากเวลานี้</span>
            </div>
          )) : (
            <p className="text-xs text-amber-300">
              กำหนดเข้าดำเนินการ: {formatScheduledAt(incident.scheduledAt)}
            </p>
          )}
        </div>
      </div>
    )
  }

  // --- State 1: unassigned — show assignment form ---
  if (!isUnassigned) return null

  return (
    <div className="glass-card p-6 rounded-2xl border border-blue-500/20">
      {/* Header */}
      <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-blue-400" />
        Assign with Schedule
      </h2>

      {/* Technician Picker */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          เลือกช่างเทคนิค <span className="text-red-400">*</span>
          {selectedIds.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
              เลือกแล้ว {selectedIds.length} คน
            </span>
          )}
        </label>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อหรืออีเมล..."
            className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* List */}
        {loadingTechs ? (
          <div className="text-center py-3 text-sm text-gray-400">
            <div className="spinner mx-auto mb-1" />
            กำลังโหลด...
          </div>
        ) : (
          <div className="overflow-y-auto max-h-44 border border-gray-600/50 rounded-lg divide-y divide-gray-700/50">
            {filteredTechnicians.length === 0 ? (
              <p className="p-3 text-center text-sm text-gray-400">
                {technicians.length === 0 ? 'ไม่มีช่างเทคนิค Inhouse' : 'ไม่พบผลการค้นหา'}
              </p>
            ) : filteredTechnicians.map((tech) => {
              const selected = selectedIds.includes(tech.id)
              return (
                <label
                  key={tech.id}
                  className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors ${selected ? 'bg-blue-500/10' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mr-3 transition-colors ${selected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <input type="checkbox" checked={selected} onChange={() => toggleTech(tech.id)} className="sr-only" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{tech.firstName} {tech.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{tech.email}</p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Scheduled Time (optional) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          กำหนดเวลาเข้าดำเนินการ
          <span className="ml-1.5 text-gray-500 text-xs font-normal">(ไม่บังคับ)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm [color-scheme:dark]"
          />
          <TimeInput
            value={scheduledTime}
            onChange={setScheduledTime}
            className="w-24 px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
          />
          {scheduledDate && (
            <button
              type="button"
              onClick={() => setScheduledDate('')}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="ล้างวัน"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {scheduledDate && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">SLA จะนับจากเวลาที่กำหนด ไม่ใช่วันที่แจ้ง Incident</p>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => { setSelectedIds([]); setScheduledDate(''); setSearchQuery('') }}
          className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          ล้าง
        </button>
        <button
          type="button"
          onClick={handleAssign}
          disabled={isLoading || selectedIds.length === 0}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="spinner w-4 h-4" />
              กำลังดำเนินการ...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Assign งาน {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              {scheduledDate && ' + กำหนดเวลา'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
