'use client'

// A technician's project task shown inside the Incidents list (phone card / table row),
// with an incident-style status so the status filter and badges work the same way.

import { useRouter } from 'next/navigation'
import { FolderKanban, DoorOpen, Calendar, AlertTriangle } from 'lucide-react'
import { formatStore } from '@/utils/formatStore'
import type { MyProjectTask } from '@/hooks/useMyProjectWork'

const REJECTED: Record<string, string> = { FAILED: 'ล้มเหลว', REVISIT: 'Revisit', ROLLBACK: 'Rollback' }

/** Project task status → the incident status it is shown (and filtered) as */
export function taskIncidentStatus(status: string): string {
  if (status === 'IN_PROGRESS' || REJECTED[status]) return 'IN_PROGRESS'
  if (status === 'PENDING_VERIFY') return 'RESOLVED'
  if (status === 'COMPLETED' || status === 'ACCEPTED') return 'CLOSED'
  return 'ASSIGNED' // PENDING / SCHEDULED / RESCHEDULED — waiting for check-in
}

/** Same matching rules as the Incidents filters (status dropdown + search box) */
export function taskMatchesFilters(t: MyProjectTask, filterStatus: string, search: string) {
  const st = taskIncidentStatus(t.status)
  if (filterStatus === 'PENDING') { if (st === 'CLOSED') return false }
  else if (filterStatus !== 'ALL' && st !== filterStatus) return false
  const q = search.trim().toLowerCase()
  if (!q) return true
  const s = t.projectStore.store
  return [t.ticketNo, t.title, s.storeCode, s.name, t.projectStore.project.name]
    .some(v => (v || '').toLowerCase().includes(q))
}

function dayDiff(d: string) {
  const a = new Date(d); a.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - t.getTime()) / 86400000)
}

/** Strip under the card (like the SLA strip): rejected / waiting for verification / appointment */
function taskStrip(t: MyProjectTask): { text: string; cls: string } | null {
  if (REJECTED[t.status]) return { text: `ถูกตีกลับ: ${REJECTED[t.status]} — แก้ไขแล้วส่งงานใหม่`, cls: 'bg-red-500/15 text-red-400' }
  if (t.status === 'PENDING_VERIFY') return { text: 'ส่งงานแล้ว · รอ Helpdesk ตรวจสอบ', cls: 'bg-purple-500/10 text-purple-300' }
  if (!t.scheduledDate) return null
  const diff = dayDiff(t.scheduledDate)
  const time = new Date(t.scheduledDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  if (diff < 0) return { text: `เลยกำหนดนัด ${-diff} วัน`, cls: 'bg-red-500/15 text-red-400' }
  if (diff === 0) return { text: `นัดหมายวันนี้ ${time}`, cls: 'bg-amber-500/15 text-amber-300' }
  if (diff === 1) return { text: `นัดหมายพรุ่งนี้ ${time}`, cls: 'bg-amber-500/10 text-amber-300' }
  return null
}

function fmtDate(d: string | null) {
  if (!d) return 'ยังไม่นัดวัน'
  return new Date(d).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ProjectBadge({ t }: { t: MyProjectTask }) {
  const color = t.projectStore.project.color || '#3b82f6'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1f` }}
      title={t.projectStore.project.name}
    >
      <FolderKanban className="w-3 h-3" /> PROJECT
    </span>
  )
}

function TaskTitle({ t }: { t: MyProjectTask }) {
  return (
    <>
      {t.taskType === 'OPENING' && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mr-1.5 rounded-full text-[10px] font-medium bg-sky-900/40 text-sky-400 align-middle">
          <DoorOpen className="w-2.5 h-2.5" /> Opening
        </span>
      )}
      {t.taskType === 'CLOSING' && (
        <span className="inline-flex items-center px-1.5 py-0.5 mr-1.5 rounded-full text-[10px] font-medium bg-red-900/40 text-red-400 align-middle">
          Closed Store
        </span>
      )}
      {t.title || 'ไม่มีชื่อ Task'}
    </>
  )
}

/** Phone card — same layout as the incident card */
export function ProjectTaskCard({ t, statusClass }: { t: MyProjectTask; statusClass: string }) {
  const router = useRouter()
  const strip = taskStrip(t)
  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard/projects/task/${t.id}`)}
      className="w-full text-left rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 overflow-hidden transition-colors"
    >
      <div className="px-3.5 py-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold text-blue-400">{t.ticketNo || `Task #${t.id}`}</span>
          <ProjectBadge t={t} />
          <span className={`${statusClass} !text-[10px] !px-2 !py-0.5 shrink-0 ml-auto`}>{taskIncidentStatus(t.status)}</span>
        </div>
        <p className="text-sm font-medium text-white line-clamp-2"><TaskTitle t={t} /></p>
        <p className="text-[13px] text-gray-300 truncate">
          {formatStore(t.projectStore.store)} <span className="text-gray-500">· {t.projectStore.project.name}</span>
        </p>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> นัด {fmtDate(t.scheduledDate)}
        </p>
      </div>
      {strip && (
        <div className={`px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1 ${strip.cls}`}>
          {strip.cls.includes('red') && <AlertTriangle className="w-3 h-3" />}
          {strip.text}
        </div>
      )}
    </button>
  )
}

/** Table row (tablet / desktop) — one wide cell so the incident columns stay untouched */
export function ProjectTaskRow({ t, statusClass, colSpan }: { t: MyProjectTask; statusClass: string; colSpan: number }) {
  const router = useRouter()
  const strip = taskStrip(t)
  return (
    <tr
      onClick={() => router.push(`/dashboard/projects/task/${t.id}`)}
      className="border-b border-slate-700/30 cursor-pointer bg-sky-900/10 hover:bg-slate-700/50 transition-colors"
    >
      <td colSpan={colSpan} className="py-3 px-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className={statusClass}>{taskIncidentStatus(t.status)}</span>
          <span className="text-sm font-mono font-semibold text-blue-400">{t.ticketNo || `Task #${t.id}`}</span>
          <ProjectBadge t={t} />
          <span className="text-sm text-white font-medium"><TaskTitle t={t} /></span>
          <span className="text-sm text-gray-300">{formatStore(t.projectStore.store)}</span>
          <span className="text-xs text-gray-500">{t.projectStore.project.name}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(t.scheduledDate)}</span>
          {strip && <span className={`text-xs font-semibold px-2 py-0.5 rounded ${strip.cls}`}>{strip.text}</span>}
        </div>
      </td>
    </tr>
  )
}
