// components/ReassignmentModal.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X,
  UserPlus,
  Search,
  User,
  AlertTriangle,
  Check,
  MapPin,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Technician {
  id: number
  firstName: string
  lastName: string
  email: string
  technicianType?: 'INSOURCE' | 'OUTSOURCE'
  responsibleProvinces?: string[]
}

interface ReassignmentModalProps {
  isOpen: boolean
  onClose: () => void
  incident: {
    id: string
    ticketNumber: string
    title: string
    store?: { province?: string }
    assignee?: {
      id: number
      firstName: string
      lastName: string
    }
    assignees?: Array<{
      user: { id: number; firstName: string; lastName: string }
    }>
  }
  onSuccess: () => void
}

export default function ReassignmentModal({
  isOpen,
  onClose,
  incident,
  onSuccess,
}: ReassignmentModalProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchTechnicians()
      // Pre-populate with current assignees
      if (incident.assignees && incident.assignees.length > 0) {
        setSelectedTechnicianIds(incident.assignees.map(a => a.user.id))
      } else if (incident.assignee) {
        setSelectedTechnicianIds([incident.assignee.id])
      } else {
        setSelectedTechnicianIds([])
      }
      setReason('')
      setSearchQuery('')
    }
  }, [isOpen])

  const fetchTechnicians = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { role: 'TECHNICIAN', technicianType: 'INSOURCE', status: 'ACTIVE' },
        }
      )

      setTechnicians(response.data || [])
    } catch (error) {
      console.error('Failed to fetch technicians:', error)
      toast.error('Failed to load technicians')
    } finally {
      setIsLoading(false)
    }
  }

  const incidentProvince = incident?.store?.province

  const coversProvince = (tech: Technician) => {
    if (!incidentProvince) return true
    const rp = tech.responsibleProvinces || []
    return rp.length === 0 || rp.includes(incidentProvince)
  }

  const getProvinceDisplay = (tech: Technician) => {
    const rp = tech.responsibleProvinces || []
    if (rp.length === 0) return { label: 'ทุกจังหวัด', outOfArea: false }
    if (incidentProvince && rp.includes(incidentProvince)) {
      return { label: incidentProvince, outOfArea: false }
    }
    return { label: rp.slice(0, 3).join(', ') + (rp.length > 3 ? '...' : ''), outOfArea: true }
  }

  const filteredTechnicians = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    if (q) {
      const matched = technicians.filter((tech) => {
        const fullName = `${tech.firstName} ${tech.lastName}`.toLowerCase()
        return fullName.includes(q) || tech.email.toLowerCase().includes(q)
      })
      return [...matched].sort((a, b) => (coversProvince(a) ? 0 : 1) - (coversProvince(b) ? 0 : 1))
    }

    return incidentProvince ? technicians.filter(coversProvince) : technicians
  }, [technicians, searchQuery, incidentProvince])

  const toggleTechnician = (techId: number) => {
    setSelectedTechnicianIds(prev =>
      prev.includes(techId)
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    )
  }

  const isUnassigning = selectedTechnicianIds.length === 0

  const handleSubmit = async () => {
    if (reason.length < 10) {
      toast.error('เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร')
      return
    }

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incident.id}/reassign`,
        {
          technicianIds: selectedTechnicianIds,
          reassignReason: reason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success(
        isUnassigning
          ? 'ยกเลิกการมอบหมายสำเร็จ งานกลับสู่สถานะ OPEN'
          : 'เปลี่ยน Technician สำเร็จ'
      )
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถเปลี่ยน Technician ได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Current assignee names for display
  const currentAssigneeNames = incident.assignees && incident.assignees.length > 0
    ? incident.assignees.map(a => `${a.user.firstName} ${a.user.lastName}`).join(', ')
    : incident.assignee
      ? `${incident.assignee.firstName} ${incident.assignee.lastName}`
      : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4">
      <div className="glass-card p-6 rounded-2xl max-w-lg w-full animate-fade-in max-h-[calc(100vh-88px)] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/20 rounded-full">
              <UserPlus className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                เปลี่ยน Technician
              </h3>
              <p className="text-sm text-gray-400">
                {incident.ticketNumber}: {incident.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Current Assignee(s) — fixed */}
        {currentAssigneeNames && (
          <div className="mb-3 p-3 bg-slate-800/50 rounded-lg flex-shrink-0">
            <p className="text-sm text-gray-400 mb-1">Technician ปัจจุบัน</p>
            <p className="text-white font-medium">{currentAssigneeNames}</p>
          </div>
        )}

        {/* Search — fixed */}
        <div className="flex-shrink-0">
          <div className="relative mb-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา Technician..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>
          {incidentProvince && (
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              แสดงช่างที่รับผิดชอบ: <span className="text-orange-400">{incidentProvince}</span>
              <span className="text-gray-600 ml-1">(รวมช่างที่ไม่ระบุพื้นที่)</span>
            </p>
          )}
          {selectedTechnicianIds.length > 0 && (
            <p className="text-xs text-orange-400 mb-2">เลือกแล้ว {selectedTechnicianIds.length} คน</p>
          )}
        </div>

        {/* Scrollable middle: tech list + reason + info */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {/* Technician List */}
          <div className="border border-slate-700 rounded-lg divide-y divide-slate-700/50">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="spinner"></div>
              </div>
            ) : filteredTechnicians.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>ไม่พบ Technician</p>
              </div>
            ) : (
              filteredTechnicians.map((tech) => {
                const isSelected = selectedTechnicianIds.includes(tech.id)
                const { label: provinceLabel, outOfArea } = getProvinceDisplay(tech)
                return (
                  <label
                    key={tech.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-700/30 transition-colors ${
                      isSelected ? 'bg-orange-500/10' : ''
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-orange-500 border-orange-500'
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
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-orange-500/30' : 'bg-slate-700'
                      }`}
                    >
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {tech.firstName} {tech.lastName}
                      </p>
                      <p className="text-xs truncate flex items-center gap-1">
                        <span className={outOfArea ? 'text-orange-400/70' : 'text-emerald-500/80'}>
                          {provinceLabel}
                        </span>
                        {outOfArea && (
                          <span className="text-orange-400/50">(นอกพื้นที่)</span>
                        )}
                      </p>
                    </div>
                  </label>
                )
              })
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              เหตุผลในการเปลี่ยน <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="กรุณาใส่เหตุผล (อย่างน้อย 10 ตัวอักษร)..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-0.5">{reason.length}/10 ตัวอักษรขั้นต่ำ</p>
          </div>

          {/* Info Box */}
          <div className={`p-3 border rounded-lg ${
            isUnassigning ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isUnassigning ? 'text-red-400' : 'text-blue-400'}`} />
              {isUnassigning ? (
                <p className="text-xs text-red-300">Incident จะกลับสู่สถานะ <span className="font-semibold">OPEN</span> และยกเลิกการมอบหมายทั้งหมด</p>
              ) : (
                <p className="text-xs text-blue-300">Incident จะถูกมอบหมายให้ Technician ที่เลือก และทุกคนจะได้รับ Notification</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions — fixed bottom */}
        <div className="flex items-center justify-end gap-3 pt-3 mt-3 border-t border-slate-700 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || reason.length < 10}
              className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                isUnassigning
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-sm"></div>
                  กำลังดำเนินการ...
                </>
              ) : isUnassigning ? (
                <>
                  <X className="w-4 h-4" />
                  ยกเลิกการมอบหมาย
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  ยืนยัน ({selectedTechnicianIds.length})
                </>
              )}
            </button>
          </div>
      </div>
    </div>
  )
}
