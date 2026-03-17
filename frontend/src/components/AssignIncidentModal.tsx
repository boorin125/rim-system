// components/AssignIncidentModal.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, User, AlertCircle, Search, Check, MapPin } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { TimeInput } from '@/components/TimeInput'

interface AssignIncidentModalProps {
  incident: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  mode: 'assign' | 'reassign'
}

export default function AssignIncidentModal({
  incident,
  isOpen,
  onClose,
  onSuccess,
  mode,
}: AssignIncidentModalProps) {
  const [technicians, setTechnicians] = useState<any[]>([])
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<number[]>([])
  const [reassignReason, setReassignReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [scheduleReason, setScheduleReason] = useState('')

  const incidentProvince = incident?.store?.province as string | undefined

  useEffect(() => {
    if (isOpen) {
      fetchTechnicians()
      setSearchQuery('')
      // Pre-populate with current assignees in reassign mode
      if (mode === 'reassign' && incident?.assignees?.length > 0) {
        setSelectedTechnicianIds(incident.assignees.map((a: any) => a.user?.id || a.userId))
      } else if (mode === 'reassign' && incident?.assigneeId) {
        setSelectedTechnicianIds([incident.assigneeId])
      } else {
        setSelectedTechnicianIds([])
      }
      setReassignReason('')
      setScheduledDate('')
      setScheduledTime('09:00')
      setScheduleReason('')
    }
  }, [isOpen])

  const fetchTechnicians = async () => {
    try {
      setLoadingTechnicians(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { role: 'TECHNICIAN', technicianType: 'INSOURCE' },
        }
      )

      const data = response.data
      let users: any[] = []

      if (Array.isArray(data)) {
        users = data
      } else if (data && Array.isArray(data.data)) {
        users = data.data
      } else if (data && Array.isArray(data.users)) {
        users = data.users
      }

      if (users.length === 0) {
        toast.error('ไม่มีช่างเทคนิค Inhouse กรุณาสร้างผู้ใช้ที่มี role TECHNICIAN และ type INSOURCE ก่อน')
      }

      setTechnicians(users)
    } catch (error: any) {
      toast.error('Failed to load technicians')
      console.error(error)
      setTechnicians([])
    } finally {
      setLoadingTechnicians(false)
    }
  }

  // Check if a technician covers the incident's province
  const coversProvince = (tech: any) => {
    if (!incidentProvince) return true
    const rp: string[] = tech.responsibleProvinces || []
    return rp.length === 0 || rp.includes(incidentProvince)
  }

  const filteredTechnicians = useMemo(() => {
    // Always filter by province first (province match OR no province defined)
    const provinceFiltered = incidentProvince
      ? technicians.filter(coversProvince)
      : technicians

    const q = searchQuery.trim().toLowerCase()
    if (!q) return provinceFiltered

    // Search within province-filtered list by name or email
    return provinceFiltered.filter((tech) => {
      const fullName = `${tech.firstName || ''} ${tech.lastName || ''}`.toLowerCase()
      const email = (tech.email || '').toLowerCase()
      return fullName.includes(q) || email.includes(q)
    })
  }, [technicians, searchQuery, incidentProvince])

  const toggleTechnician = (techId: number) => {
    setSelectedTechnicianIds(prev =>
      prev.includes(techId)
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'assign' && selectedTechnicianIds.length === 0) {
      toast.error('กรุณาเลือกช่างเทคนิคอย่างน้อย 1 คน')
      return
    }

    if (mode === 'reassign' && !reassignReason.trim()) {
      toast.error('กรุณาระบุเหตุผล')
      return
    }

    if (mode === 'assign' && scheduledDate && !scheduleReason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่กำหนดเวลาเข้าดำเนินการ')
      return
    }

    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')
      const endpoint = mode === 'assign' ? 'assign' : 'reassign'

      const payload: any = {
        technicianIds: selectedTechnicianIds,
      }

      if (mode === 'reassign') {
        payload.reassignReason = reassignReason
      }

      if (mode === 'assign' && scheduledDate && scheduledTime) {
        payload.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        payload.scheduleReason = scheduleReason
      }

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incident.id}/${endpoint}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success(
        mode === 'assign'
          ? 'มอบหมายงานสำเร็จ'
          : selectedTechnicianIds.length === 0
            ? 'ยกเลิกการมอบหมายสำเร็จ งานกลับสู่สถานะ OPEN'
            : 'มอบหมายงานใหม่สำเร็จ'
      )

      onSuccess()
      onClose()

      setSelectedTechnicianIds([])
      setReassignReason('')
      setSearchQuery('')
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
        `Failed to ${mode} incident`
      )
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-500/20 rounded-full">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {mode === 'assign' ? 'Assign Technician(s)' : 'Reassign Technician(s)'}
              </h3>
              <p className="text-sm text-gray-400">
                {incident.ticketNumber || `#${incident.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition duration-200"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 min-h-0 flex flex-col overflow-y-auto">
          {/* Search + Technician List */}
          <div className="flex-shrink-0 flex flex-col">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {mode === 'assign' ? 'เลือกช่างเทคนิค' : 'เลือกช่างเทคนิคใหม่'}{' '}
              <span className="text-red-400">*</span>
              {selectedTechnicianIds.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                  เลือกแล้ว {selectedTechnicianIds.length} คน
                </span>
              )}
            </label>

            {/* Search Input */}
            <div className="relative mb-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมล..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Province hint */}
            {incidentProvince && (
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                แสดงช่างที่รับผิดชอบ: <span className="text-blue-400">{incidentProvince}</span>
                <span className="text-gray-600 ml-1">(รวมช่างที่ไม่ระบุพื้นที่)</span>
              </p>
            )}

            {/* Technician List */}
            {loadingTechnicians ? (
              <div className="text-center py-4">
                <div className="spinner mx-auto mb-2"></div>
                <p className="text-sm text-gray-400">Loading technicians...</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-44 border border-gray-600/50 rounded-lg divide-y divide-gray-700/50">
                {filteredTechnicians.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    {technicians.length === 0
                      ? 'ไม่มีช่างเทคนิค Inhouse กรุณาตรวจสอบว่ามีผู้ใช้ที่มี role TECHNICIAN และ type INSOURCE'
                      : searchQuery
                        ? 'ไม่พบช่างเทคนิค Inhouse ที่ค้นหา'
                        : `ไม่มีช่างเทคนิคที่รับผิดชอบจังหวัด${incidentProvince ? ` ${incidentProvince}` : ''}`}
                  </div>
                ) : (
                  filteredTechnicians.map((tech) => {
                    const isSelected = selectedTechnicianIds.includes(tech.id)
                    const isProvince = coversProvince(tech)
                    return (
                      <label
                        key={tech.id}
                        className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors ${
                          isSelected ? 'bg-blue-500/10' : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mr-3 transition-colors ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-500 bg-transparent'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTechnician(tech.id)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {tech.firstName} {tech.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {tech.responsibleProvinces?.length > 0
                              ? <span className="text-emerald-500/80">{tech.responsibleProvinces.join(', ')}</span>
                              : <span className="text-gray-600">ทุกจังหวัด</span>
                            }
                          </p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Reassign Reason (only for reassign) */}
          {mode === 'reassign' && (
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                เหตุผลในการมอบหมายใหม่ <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="ระบุเหตุผลในการมอบหมายงานใหม่..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                required
              />
            </div>
          )}

          {/* Scheduled Time (assign mode only) */}
          {mode === 'assign' && (
            <div className="flex-shrink-0 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  กำหนดเวลาเข้าดำเนินการ
                  <span className="ml-1.5 text-gray-500 text-xs font-normal">(ไม่บังคับ)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => { setScheduledDate(e.target.value); if (!e.target.value) setScheduleReason('') }}
                    min={new Date().toISOString().slice(0, 10)}
                    className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm [color-scheme:dark]"
                  />
                  <TimeInput
                    value={scheduledTime}
                    onChange={setScheduledTime}
                    className="w-24 px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                  />
                </div>
                {scheduledDate && (
                  <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    SLA จะนับจากเวลาที่กำหนด ไม่ใช่วันที่แจ้ง Incident
                  </p>
                )}
              </div>

              {/* Schedule Reason — required when date is set */}
              {scheduledDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    เหตุผลที่กำหนดเวลา <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={scheduleReason}
                    onChange={(e) => setScheduleReason(e.target.value)}
                    placeholder="เช่น ร้านค้าขอนัดหมายล่วงหน้า, ต้องรอวัสดุอุปกรณ์..."
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Technician จะเห็นเหตุผลนี้ในการแจ้งเตือน</p>
                </div>
              )}
            </div>
          )}

          {/* Info Alert */}
          <div className={`flex-shrink-0 flex items-start space-x-3 p-3 border rounded-lg ${
            mode === 'reassign' && selectedTechnicianIds.length === 0
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}>
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              mode === 'reassign' && selectedTechnicianIds.length === 0
                ? 'text-red-400'
                : 'text-blue-400'
            }`} />
            <div className="text-xs text-gray-300">
              {mode === 'assign' ? (
                <>
                  สถานะ Incident จะเปลี่ยนเป็น{' '}
                  <span className="text-blue-400 font-semibold">ASSIGNED</span>{' '}
                  และช่างเทคนิคที่เลือกจะได้รับแจ้งเตือน
                </>
              ) : selectedTechnicianIds.length === 0 ? (
                <>
                  การยกเลิกการมอบหมายจะทำให้ Incident กลับสู่สถานะ{' '}
                  <span className="text-red-400 font-semibold">OPEN</span>
                </>
              ) : (
                <>
                  Incident จะถูกมอบหมายให้ช่างเทคนิคที่เลือกใหม่
                  ช่างเทคนิคทุกคนจะได้รับแจ้งเตือน
                </>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex-shrink-0 flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 text-gray-300 hover:bg-gray-700/50 rounded-lg transition duration-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading || (mode === 'assign' && selectedTechnicianIds.length === 0)}
              className={`px-6 py-3 text-white rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'reassign' && selectedTechnicianIds.length === 0
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading
                ? 'กำลังดำเนินการ...'
                : mode === 'assign'
                  ? `มอบหมาย (${selectedTechnicianIds.length})`
                  : selectedTechnicianIds.length === 0
                    ? 'ยกเลิกการมอบหมาย'
                    : `มอบหมายใหม่ (${selectedTechnicianIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
