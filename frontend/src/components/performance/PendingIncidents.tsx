'use client'

// Performance › Pending Incidents: open work (not CLOSED / CANCELLED) per technician plus the jobs
// nobody has yet, oldest first. Assign / Reassign open the same modals as the incident page, on
// top of this page — confirm or cancel, the user stays here and the list refreshes.

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { ChevronDown, ChevronRight, ClipboardList, RefreshCw, UserPlus, UserX, ExternalLink } from 'lucide-react'
import AssignIncidentModal from '@/components/AssignIncidentModal'
import ReassignmentModal from '@/components/ReassignmentModal'
import { formatStore } from '@/utils/formatStore'

interface Person { id: number; firstName: string; lastName: string; technicianType?: string | null }
interface PendingItem {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  jobType: string | null
  reportedAt: string
  resolutionType: string | null
  reopenCount: number
  storeCode: string | null
  storeName: string | null
  store: { storeCode: string; name: string; province: string | null } | null
  assigneeId: number | null
  assignee: Person | null
  assignees: { user: Person }[]
}
interface PendingData {
  total: number
  unassigned: PendingItem[]
  technicians: { id: number; name: string; technicianType: string | null; count: number; items: PendingItem[] }[]
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-sky-500/15 text-sky-300',
  PENDING: 'bg-amber-500/15 text-amber-300',
  ASSIGNED: 'bg-purple-500/15 text-purple-300',
  IN_PROGRESS: 'bg-indigo-500/15 text-indigo-300',
  RESOLVED: 'bg-emerald-500/15 text-emerald-300',
}

function aging(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.max(0, Math.floor(ms / 3_600_000))
  const days = Math.floor(hours / 24)
  const text = days > 0 ? `${days} วัน ${hours % 24} ชม.` : `${hours} ชม.`
  const cls = days >= 7 ? 'text-red-400' : days >= 3 ? 'text-amber-400' : 'text-gray-300'
  return { text, cls }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function PendingIncidents({ jobTypes, userRoles }: { jobTypes: string[]; userRoles: string[] }) {
  const [data, setData] = useState<PendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<PendingItem | null>(null)
  const [reassignTarget, setReassignTarget] = useState<PendingItem | null>(null)
  /** Job just assigned/reassigned — its new group opens and the row is highlighted */
  const [moved, setMoved] = useState<string | null>(null)

  // Same rules as the incident page
  const canAssign = userRoles.includes('SUPERVISOR') || userRoles.includes('IT_MANAGER')
  const canReassign = userRoles.includes('SUPERVISOR')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const jt = jobTypes.length ? `?jobTypes=${jobTypes.join(',')}` : ''
      const res = await axios.get<PendingData>(`${process.env.NEXT_PUBLIC_API_URL}/performance/pending-incidents${jt}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [jobTypes])

  useEffect(() => { load() }, [load])

  // After Assign / Reassign: open the group(s) now holding the job, scroll to it, highlight briefly
  useEffect(() => {
    if (!moved || !data) return
    const keys = data.technicians.filter((t) => t.items.some((i) => i.id === moved)).map((t) => `tech-${t.id}`)
    if (data.unassigned.some((i) => i.id === moved)) keys.push('unassigned')
    if (keys.length) setOpen((prev) => new Set([...Array.from(prev), ...keys]))
    const scroll = setTimeout(() => document.getElementById(`pending-${moved}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    const clear = setTimeout(() => setMoved(null), 4000)
    return () => { clearTimeout(scroll); clearTimeout(clear) }
  }, [moved, data])

  const afterChange = (id: string) => {
    setAssignTarget(null)
    setReassignTarget(null)
    load().then(() => setMoved(id))
  }

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const assignState = (i: PendingItem): { ok: boolean; reason?: string } => {
    if (!['OPEN', 'PENDING'].includes(i.status)) return { ok: false, reason: `สถานะ ${i.status}` }
    if (i.resolutionType !== 'ONSITE' && !(i.reopenCount > 0)) return { ok: false, reason: 'Helpdesk ยังไม่ระบุให้ส่งช่าง Onsite' }
    return { ok: true }
  }
  const reassignState = (i: PendingItem): { ok: boolean; reason?: string } =>
    ['ASSIGNED', 'IN_PROGRESS'].includes(i.status) ? { ok: true } : { ok: false, reason: `Reassign ได้เฉพาะสถานะ ASSIGNED / IN_PROGRESS (ตอนนี้ ${i.status})` }

  const rows = (items: PendingItem[], unassigned: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        <thead>
          <tr className="text-gray-400 border-b border-slate-700">
            <th className="text-left py-2 px-3 font-medium">Incident No.</th>
            <th className="text-left py-2 px-3 font-medium">Title</th>
            <th className="text-left py-2 px-3 font-medium">Store</th>
            <th className="text-left py-2 px-3 font-medium">Status</th>
            <th className="text-left py-2 px-3 font-medium">Incident Date</th>
            <th className="text-left py-2 px-3 font-medium">Aging</th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const age = aging(i.reportedAt)
            const action = unassigned ? (canAssign ? assignState(i) : null) : canReassign ? reassignState(i) : null
            return (
              <tr
                key={i.id}
                id={`pending-${i.id}`}
                className={`border-b border-slate-700/40 transition-colors duration-700 ${moved === i.id ? 'bg-emerald-500/20' : 'hover:bg-slate-700/20'}`}
              >
                <td className="py-2 px-3 whitespace-nowrap">
                  <a
                    href={`/dashboard/incidents/${i.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    {i.ticketNumber} <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
                <td className="py-2 px-3 text-white max-w-[280px] truncate" title={i.title}>{i.title}</td>
                <td className="py-2 px-3 text-gray-300 whitespace-nowrap">{formatStore({ storeCode: i.storeCode, name: i.storeName }, '-')}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLE[i.status] ?? 'bg-slate-600/40 text-gray-300'}`}>{i.status}</span>
                </td>
                <td className="py-2 px-3 text-gray-300 whitespace-nowrap">{fmtDate(i.reportedAt)}</td>
                <td className={`py-2 px-3 whitespace-nowrap font-medium ${age.cls}`}>{age.text}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  {action && (
                    <button
                      type="button"
                      disabled={!action.ok}
                      title={action.reason}
                      onClick={() => (unassigned ? setAssignTarget(i) : setReassignTarget(i))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        unassigned ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {unassigned ? 'Assign' : 'Reassign'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const group = (key: string, label: React.ReactNode, count: number, items: PendingItem[], unassigned = false) => {
    const isOpen = open.has(key)
    return (
      <div key={key} className={`rounded-xl border ${unassigned ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700/60'}`}>
        <button type="button" onClick={() => toggle(key)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/20 rounded-xl">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="flex-1 min-w-0 truncate">{label}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-sm font-semibold ${unassigned ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/15 text-red-300'}`}>
            {count} งาน
          </span>
        </button>
        {isOpen && <div className="px-2 pb-3">{rows(items, unassigned)}</div>}
      </div>
    )
  }

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-400" />
          Pending Incidents
          {data && <span className="text-sm font-normal text-gray-400">· ยังไม่ Closed {data.total} งาน</span>}
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {!data ? (
        <p className="py-8 text-center text-sm text-gray-500">{loading ? 'กำลังโหลด…' : 'โหลดข้อมูลไม่สำเร็จ'}</p>
      ) : data.total === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">ไม่มีงานค้าง</p>
      ) : (
        <div className="space-y-2">
          {data.unassigned.length > 0 &&
            group(
              'unassigned',
              <span className="flex items-center gap-2 font-semibold text-amber-300"><UserX className="w-4 h-4" /> Unassign</span>,
              data.unassigned.length,
              data.unassigned,
              true,
            )}
          {data.technicians.map((t) =>
            group(
              `tech-${t.id}`,
              <span className="flex items-center gap-2">
                <span className="font-semibold text-white">{t.name}</span>
                {t.technicianType && <span className="text-[11px] text-gray-500">{t.technicianType}</span>}
              </span>,
              t.count,
              t.items,
            ),
          )}
        </div>
      )}

      {assignTarget && (
        <AssignIncidentModal
          incident={assignTarget}
          isOpen
          mode="assign"
          onClose={() => setAssignTarget(null)}
          onSuccess={() => afterChange(assignTarget.id)}
        />
      )}
      {reassignTarget && (
        <ReassignmentModal
          isOpen
          onClose={() => setReassignTarget(null)}
          incident={{
            id: reassignTarget.id,
            ticketNumber: reassignTarget.ticketNumber,
            title: reassignTarget.title,
            store: reassignTarget.store ? { province: reassignTarget.store.province ?? undefined } : undefined,
            assignee: reassignTarget.assignee ?? undefined,
            assignees: reassignTarget.assignees,
          }}
          onSuccess={() => afterChange(reassignTarget.id)}
        />
      )}
    </div>
  )
}
