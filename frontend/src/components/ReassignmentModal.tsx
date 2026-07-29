// components/ReassignmentModal.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  UserPlus,
  Search,
  User,
  AlertTriangle,
  Check,
  MapPin,
  ExternalLink,
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

interface ActiveOutsourceJob {
  id: number
  jobCode: string
  status: string
  awardedToId: number | null
}

interface ReassignmentModalProps {
  isOpen: boolean
  onClose: () => void
  incident: {
    id: string
    ticketNumber: string
    title: string
    store?: { province?: string }
    assignee?: { id: number; firstName: string; lastName: string }
    assignees?: Array<{ user: { id: number; firstName: string; lastName: string } }>
  }
  onSuccess: () => void
}

type ConfirmScenario =
  | { type: 'outsource-redirect'; hasExistingJob: boolean; jobCode?: string }
  | { type: 'force-cancel-existing'; jobCode: string }
  | { type: 'request-cancel-checkedin'; jobCode: string }
  | { type: 'multi-assign'; count: number }

export default function ReassignmentModal({ isOpen, onClose, incident, onSuccess }: ReassignmentModalProps) {
  const router = useRouter()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeOutsourceJob, setActiveOutsourceJob] = useState<ActiveOutsourceJob | null>(null)
  const [confirmScenario, setConfirmScenario] = useState<ConfirmScenario | null>(null)

  const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

  useEffect(() => {
    if (isOpen) {
      fetchTechnicians()
      fetchActiveOutsourceJob()
      setConfirmScenario(null)
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
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        { ...config(), params: { role: 'TECHNICIAN', status: 'ACTIVE' } }
      )
      setTechnicians(response.data || [])
    } catch {
      toast.error('Failed to load technicians')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchActiveOutsourceJob = async () => {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/by-incident/${incident.id}`,
        config()
      )
      setActiveOutsourceJob(res.data || null)
    } catch {
      setActiveOutsourceJob(null)
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
    if (incidentProvince && rp.includes(incidentProvince)) return { label: incidentProvince, outOfArea: false }
    return { label: rp.slice(0, 3).join(', ') + (rp.length > 3 ? '...' : ''), outOfArea: true }
  }

  const filteredTechnicians = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = technicians
    if (q) {
      list = list.filter(tech => {
        const fullName = `${tech.firstName} ${tech.lastName}`.toLowerCase()
        return fullName.includes(q) || tech.email.toLowerCase().includes(q)
      })
    } else if (incidentProvince) {
      list = list.filter(coversProvince)
    }
    return [...list].sort((a, b) => (coversProvince(a) ? 0 : 1) - (coversProvince(b) ? 0 : 1))
  }, [technicians, searchQuery, incidentProvince])

  const toggleTechnician = (techId: number) => {
    setSelectedTechnicianIds(prev =>
      prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
    )
  }

  const selectedTechs = technicians.filter(t => selectedTechnicianIds.includes(t.id))
  const hasOutsourceInSelection = selectedTechs.some(t => t.technicianType === 'OUTSOURCE')
  const isUnassigning = selectedTechnicianIds.length === 0
  const isMultiSelect = selectedTechnicianIds.length > 1

  const handleSubmit = () => {
    if (reason.length < 10) {
      toast.error('เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร')
      return
    }

    if (!isUnassigning && hasOutsourceInSelection) {
      setConfirmScenario({
        type: 'outsource-redirect',
        hasExistingJob: !!activeOutsourceJob,
        jobCode: activeOutsourceJob?.jobCode,
      })
      return
    }

    if (!isUnassigning && activeOutsourceJob) {
      const hasCheckIn = activeOutsourceJob.status === 'IN_PROGRESS' || activeOutsourceJob.status === 'PENDING_CANCEL'
      if (hasCheckIn) {
        setConfirmScenario({ type: 'request-cancel-checkedin', jobCode: activeOutsourceJob.jobCode })
      } else {
        setConfirmScenario({ type: 'force-cancel-existing', jobCode: activeOutsourceJob.jobCode })
      }
      return
    }

    if (!isUnassigning && isMultiSelect) {
      setConfirmScenario({ type: 'multi-assign', count: selectedTechnicianIds.length })
      return
    }

    executeReassign()
  }

  const executeReassign = async () => {
    try {
      setIsSubmitting(true)
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incident.id}/reassign`,
        { technicianIds: selectedTechnicianIds, reassignReason: reason },
        config()
      )
      toast.success(isUnassigning ? 'ยกเลิกการมอบหมายสำเร็จ งานกลับสู่สถานะ OPEN' : 'เปลี่ยน Technician สำเร็จ')
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถเปลี่ยน Technician ได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  const executeConfirm = async () => {
    if (!confirmScenario) return
    try {
      setIsSubmitting(true)

      if (confirmScenario.type === 'outsource-redirect') {
        if (activeOutsourceJob) {
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${activeOutsourceJob.id}/force-cancel`,
            { reason },
            config()
          )
        }
        onClose()
        router.push(`/dashboard/outsource/create?incidentId=${incident.id}`)
        return
      }

      if (confirmScenario.type === 'force-cancel-existing') {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${activeOutsourceJob!.id}/force-cancel`,
          { reason },
          config()
        )
        // force-cancel already sets incident to OPEN with no assignees,
        // so use assign (not reassign) which works on OPEN incidents,
        // but flag it as isReassignment so backend records REASSIGNED history
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incident.id}/assign`,
          { technicianIds: selectedTechnicianIds, isReassignment: true, reassignReason: reason },
          config()
        )
        toast.success('ยกเลิก Outsource และมอบหมาย Inhouse สำเร็จ')
        onSuccess()
        onClose()
        return
      }

      if (confirmScenario.type === 'request-cancel-checkedin') {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs/${activeOutsourceJob!.id}/cancel`,
          { reason },
          config()
        )
        toast.success('ส่งคำขอยกเลิกงาน Outsource ให้ IT Manager อนุมัติแล้ว — รอ Approval ก่อนมอบหมายใหม่')
        onSuccess()
        onClose()
        return
      }

      if (confirmScenario.type === 'multi-assign') {
        await executeReassign()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'เกิดข้อผิดพลาด')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const currentAssigneeNames = incident.assignees && incident.assignees.length > 0
    ? incident.assignees.map(a => `${a.user.firstName} ${a.user.lastName}`).join(', ')
    : incident.assignee
      ? `${incident.assignee.firstName} ${incident.assignee.lastName}`
      : null

  // ── Confirm Step ──────────────────────────────────────────
  if (confirmScenario) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4">
        <div className="glass-card p-6 rounded-2xl max-w-lg w-full animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-3 bg-amber-500/20 rounded-full">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">ยืนยันการดำเนินการ</h3>
          </div>

          {confirmScenario.type === 'outsource-redirect' && (
            <div className="space-y-3 mb-6">
              <p className="text-gray-300">
                Tech ที่เลือกเป็น <span className="text-amber-400 font-semibold">Outsource</span> — ต้องดำเนินการผ่านระบบ Outsource
              </p>
              {confirmScenario.hasExistingJob && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-sm text-red-300">
                    งาน Outsource เดิม <span className="font-semibold">{confirmScenario.jobCode}</span> จะถูกยกเลิกอัตโนมัติ
                  </p>
                </div>
              )}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
                <ExternalLink className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-300">
                  ระบบจะพาไปยังหน้า <span className="font-semibold">สร้าง Outsource Job ใหม่</span> สำหรับ Incident นี้โดยอัตโนมัติ
                </p>
              </div>
            </div>
          )}

          {confirmScenario.type === 'force-cancel-existing' && (
            <div className="space-y-3 mb-6">
              <p className="text-gray-300">
                Incident นี้มีงาน Outsource <span className="text-amber-400 font-semibold">{confirmScenario.jobCode}</span> อยู่
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-300">
                  หากยืนยัน งาน Outsource จะถูกยกเลิกอัตโนมัติ และงานจะถูกมอบหมายให้ Inhouse Technician ที่เลือก
                </p>
              </div>
            </div>
          )}

          {confirmScenario.type === 'request-cancel-checkedin' && (
            <div className="space-y-3 mb-6">
              <p className="text-gray-300">
                งาน Outsource <span className="text-amber-400 font-semibold">{confirmScenario.jobCode}</span> มีการ Check-in แล้ว
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-300">
                  ต้องส่งคำขอยกเลิกให้ <span className="font-semibold">IT Manager อนุมัติ</span> — งานจะยังไม่ถูกมอบหมายใหม่จนกว่า IT Manager จะอนุมัติ
                </p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  หลัง IT Manager อนุมัติการยกเลิก Incident จะกลับสู่สถานะ <span className="font-semibold">OPEN</span> แล้วจึง Assign Tech ใหม่ได้
                </p>
              </div>
            </div>
          )}

          {confirmScenario.type === 'multi-assign' && (
            <div className="space-y-3 mb-6">
              <p className="text-gray-300">
                มอบหมายงานให้ <span className="text-orange-400 font-semibold">{confirmScenario.count} คน</span> พร้อมกัน
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-sm text-blue-300">ทุกคนจะได้รับ Notification และสามารถเข้าดูงานนี้ได้</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setConfirmScenario(null)}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              กลับ
            </button>
            <button
              onClick={executeConfirm}
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                confirmScenario.type === 'multi-assign'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : confirmScenario.type === 'request-cancel-checkedin'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? (
                <><div className="spinner-sm"></div> กำลังดำเนินการ...</>
              ) : confirmScenario.type === 'outsource-redirect' ? (
                <><ExternalLink className="w-4 h-4" /> ยืนยัน — ไปหน้า Outsource</>
              ) : confirmScenario.type === 'request-cancel-checkedin' ? (
                <><Check className="w-4 h-4" /> ส่งคำขอยกเลิก</>
              ) : (
                <><Check className="w-4 h-4" /> ยืนยัน</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Form ─────────────────────────────────────────────
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
              <h3 className="text-lg font-semibold text-white">เปลี่ยน Technician</h3>
              <p className="text-sm text-gray-400">{incident.ticketNumber}: {incident.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Active Outsource Job banner */}
        {activeOutsourceJob && (
          <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex-shrink-0">
            <p className="text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              มีงาน Outsource <span className="font-semibold">{activeOutsourceJob.jobCode}</span> อยู่ (สถานะ: {activeOutsourceJob.status})
            </p>
          </div>
        )}

        {/* Current Assignee(s) */}
        {currentAssigneeNames && (
          <div className="mb-3 p-3 bg-slate-800/50 rounded-lg flex-shrink-0">
            <p className="text-sm text-gray-400 mb-1">Technician ปัจจุบัน</p>
            <p className="text-white font-medium">{currentAssigneeNames}</p>
          </div>
        )}

        {/* Search */}
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
            <p className="text-xs text-orange-400 mb-2">
              เลือกแล้ว {selectedTechnicianIds.length} คน
              {hasOutsourceInSelection && <span className="text-amber-400 ml-1">(มี Outsource)</span>}
            </p>
          )}
        </div>

        {/* Scrollable content */}
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
                const isOutsource = tech.technicianType === 'OUTSOURCE'
                return (
                  <label
                    key={tech.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-700/30 transition-colors ${
                      isSelected ? 'bg-orange-500/10' : ''
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-500 bg-transparent'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleTechnician(tech.id)} className="sr-only" />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-orange-500/30' : 'bg-slate-700'
                    }`}>
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium truncate">{tech.firstName} {tech.lastName}</p>
                        {isOutsource && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium flex-shrink-0">OUT</span>
                        )}
                      </div>
                      <p className="text-xs truncate flex items-center gap-1">
                        <span className={outOfArea ? 'text-orange-400/70' : 'text-emerald-500/80'}>{provinceLabel}</span>
                        {outOfArea && <span className="text-orange-400/50">(นอกพื้นที่)</span>}
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

        {/* Actions */}
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
              isUnassigning ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isSubmitting ? (
              <><div className="spinner-sm"></div> กำลังดำเนินการ...</>
            ) : isUnassigning ? (
              <><X className="w-4 h-4" /> ยกเลิกการมอบหมาย</>
            ) : (
              <><UserPlus className="w-4 h-4" /> ยืนยัน ({selectedTechnicianIds.length})</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
