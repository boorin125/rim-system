'use client'

// "งานโปรเจกต์ของฉัน" — a technician's open project tasks at the top of the Incidents page
// (technicians no longer get the Projects menu; tapping a task opens the project task page to work / close it)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderKanban, ChevronDown, Calendar, AlertTriangle, DoorOpen } from 'lucide-react'
import { formatStore } from '@/utils/formatStore'
import { useMyProjectWork } from '@/hooks/useMyProjectWork'

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'รอมอบหมาย',   color: 'text-gray-400 bg-gray-800/60' },
  SCHEDULED:   { label: 'รอ Check-in',  color: 'text-blue-400 bg-blue-900/40' },
  IN_PROGRESS: { label: 'กำลังทำงาน',  color: 'text-yellow-400 bg-yellow-900/40' },
  RESCHEDULED: { label: 'เลื่อนนัด',   color: 'text-orange-400 bg-orange-900/40' },
  FAILED:      { label: 'ล้มเหลว',      color: 'text-red-400 bg-red-900/40' },
  REVISIT:     { label: 'Revisit',      color: 'text-pink-400 bg-pink-900/40' },
  ROLLBACK:    { label: 'Rollback',     color: 'text-amber-400 bg-amber-900/40' },
}

const COLLAPSE_KEY = 'myProjectTasksCollapsed'

function dayDiff(d: string) {
  const a = new Date(d); a.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - t.getTime()) / 86400000)
}

function whenLabel(d: string | null) {
  if (!d) return { text: 'ยังไม่นัดวัน', tone: 'text-gray-500' }
  const diff = dayDiff(d)
  const time = new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  if (diff < 0) return { text: `เลยกำหนด ${-diff} วัน`, tone: 'text-red-400' }
  if (diff === 0) return { text: `วันนี้ ${time}`, tone: 'text-amber-300' }
  if (diff === 1) return { text: `พรุ่งนี้ ${time}`, tone: 'text-amber-300' }
  return {
    text: new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ` ${time}`,
    tone: 'text-gray-400',
  }
}

export default function MyProjectTasks() {
  const { tasks } = useMyProjectWork()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1') } catch { /* ignore */ }
  }, [])

  if (tasks.length === 0) return null

  const overdue = tasks.filter(t => t.scheduledDate && dayDiff(t.scheduledDate) < 0).length

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* ignore */ }
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors">
        <span className="flex items-center gap-2 text-white font-semibold">
          <FolderKanban className="w-5 h-5" style={{ color: 'var(--theme-highlight)' }} />
          งานโปรเจกต์ของฉัน
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700/70 text-gray-200">{tasks.length}</span>
          {overdue > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
              เลยกำหนด {overdue}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          {collapsed ? 'แสดง' : 'ซ่อน'}
          <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-slate-700/30 border-t border-slate-700/40">
          {tasks.map((t, i) => {
            const st = STATUS[t.status] || { label: t.status, color: 'text-gray-400 bg-gray-800/60' }
            const when = whenLabel(t.scheduledDate)
            return (
              <Link
                key={t.id}
                href={`/dashboard/projects/task/${t.id}`}
                className={`block px-4 py-3 space-y-1 hover:bg-slate-700/30 active:bg-slate-700/40 transition-colors ${i % 2 === 1 ? 'bg-slate-700/20' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${st.color}`}>{st.label}</span>
                    <span className="font-mono text-[11px] text-gray-400 truncate">{t.ticketNo || '-'}</span>
                  </span>
                  <span className={`flex items-center gap-1 text-xs shrink-0 ${when.tone}`}>
                    {when.tone === 'text-red-400' ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                    {when.text}
                  </span>
                </div>
                <p className="text-sm text-white font-medium break-words">
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
                </p>
                <p className="text-xs text-gray-400 truncate">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: t.projectStore.project.color || '#3b82f6' }}
                  />
                  {formatStore(t.projectStore.store)} · {t.projectStore.project.name}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
