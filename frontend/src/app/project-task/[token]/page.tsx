// app/project-task/[token]/page.tsx - Public Read-Only Project Task View (No Login Required)
// Linked from the project close email ("ดูรายละเอียดงาน"). The link never expires.
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  FileText,
  MapPin,
  User,
  CheckCircle,
  Clock,
  Calendar,
  Camera,
  Wrench,
  ClipboardCheck,
  Loader2,
  AlertCircle,
  FolderKanban,
  X,
} from 'lucide-react'
import axios from 'axios'
import { getPhotoUrl } from '@/utils/photoUtils'

interface PublicProjectTask {
  organizationName?: string
  organizationLogo?: string
  ticketNo?: string | null
  title?: string | null
  workType?: string | null
  status: string
  notes?: string | null
  project: { name: string; color: string }
  store: { storeCode: string; name: string; province?: string | null; address?: string | null }
  technician?: { name: string } | null
  scheduledDate?: string | null
  checkInAt?: string | null
  completedAt?: string | null
  verifiedAt?: string | null
  photoGroups: { title: string; photos: { path: string; caption: string | null }[] }[]
  testSections: {
    title: string
    items: { itemName: string; result: string; note: string | null; photoPath: string | null }[]
  }[]
  equipment: {
    itemName: string
    oldModel: string | null
    oldSN: string | null
    newModel: string | null
    newSN: string | null
    notes: string | null
  }[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอมอบหมาย', cls: 'bg-gray-500/20 text-gray-300' },
  SCHEDULED: { label: 'นัดหมายแล้ว', cls: 'bg-blue-500/20 text-blue-300' },
  IN_PROGRESS: { label: 'กำลังทำงาน', cls: 'bg-yellow-500/20 text-yellow-300' },
  PENDING_VERIFY: { label: 'รอตรวจสอบ', cls: 'bg-purple-500/20 text-purple-300' },
  RESCHEDULED: { label: 'เลื่อนนัด', cls: 'bg-orange-500/20 text-orange-300' },
  ACCEPTED: { label: '✓ ปิดงานแล้ว', cls: 'bg-green-500/20 text-green-400' },
  COMPLETED: { label: '✓ ปิดงานแล้ว', cls: 'bg-green-500/20 text-green-400' },
  FAILED: { label: 'ไม่ผ่าน', cls: 'bg-red-500/20 text-red-300' },
  REVISIT: { label: 'Revisit', cls: 'bg-pink-500/20 text-pink-300' },
  ROLLBACK: { label: 'Rollback', cls: 'bg-amber-500/20 text-amber-300' },
}

const RESULT: Record<string, { label: string; cls: string }> = {
  PASS: { label: 'PASS', cls: 'bg-green-500/20 text-green-400' },
  FAIL: { label: 'FAIL', cls: 'bg-red-500/20 text-red-400' },
  NA: { label: 'N/A', cls: 'bg-gray-500/20 text-gray-400' },
}

export default function PublicProjectTaskPage() {
  const params = useParams()
  const token = params.token as string

  const [task, setTask] = useState<PublicProjectTask | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/public/project-tasks/${token}`)
      .then((res) => setTask(res.data))
      .catch((err) => setError(err.response?.data?.message || 'ไม่พบข้อมูลงาน'))
      .finally(() => setIsLoading(false))
  }, [token])

  const formatDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">กำลังโหลดข้อมูลงาน...</p>
        </div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Task Not Found</h2>
          <p className="text-gray-400">{error || 'ไม่พบข้อมูลงาน'}</p>
        </div>
      </div>
    )
  }

  const color = task.project.color || '#3b82f6'
  const taskTitle = task.title || task.ticketNo || 'Project Task'
  const store = `${task.store.storeCode} ${task.store.name}`
  const status = STATUS[task.status] || { label: task.status, cls: 'bg-gray-500/20 text-gray-300' }
  const photoCount = task.photoGroups.reduce((n, g) => n + g.photos.length, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="fixed inset-0 bg-pattern"></div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:p-6 sm:py-10">
        {/* Header */}
        <div className="glass-card rounded-2xl p-5 mb-6 flex items-center gap-4">
          {task.organizationLogo ? (
            <img
              src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${task.organizationLogo}`}
              alt="Logo"
              className="h-14 w-auto object-contain shrink-0"
            />
          ) : (
            <div className="w-14 h-14 bg-slate-700/60 rounded-xl flex items-center justify-center shrink-0">
              <FolderKanban className="w-7 h-7" style={{ color }} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">Project Task Details</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {task.organizationName ? `${task.organizationName} Incident Management` : 'Incident Management'}
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="h-1.5" style={{ background: color }} />
          {/* Title bar */}
          <div className="p-6 border-b border-slate-700/50 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white break-words">{taskTitle}</h2>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span>{task.project.name} · {store}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {task.ticketNo && (
                <span className="px-3 py-1 rounded-md text-sm font-semibold text-white border-2" style={{ borderColor: color }}>
                  {task.ticketNo}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.cls}`}>{status.label}</span>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-0">
            {/* ── Task details ── */}
            <SectionHeader icon={FileText} title="รายละเอียดงาน / Task Details" color={color} />
            <div className="p-4 space-y-3 mb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoCard icon={FolderKanban} label="โครงการ / Project" value={task.project.name} sub={task.workType || undefined} />
                <InfoCard icon={MapPin} label="สาขา / Store" value={store} sub={task.store.province || undefined} />
              </div>
              {task.store.address && <InfoCard icon={MapPin} label="ที่อยู่ / Address" value={task.store.address} fullWidth />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {task.technician && <InfoCard icon={User} label="ช่างผู้รับผิดชอบ / Technician" value={task.technician.name} />}
                {task.scheduledDate && <InfoCard icon={Calendar} label="วันนัดหมาย / Scheduled" value={formatDate(task.scheduledDate)} />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {task.checkInAt && <InfoCard icon={Clock} label="เวลาเริ่มงาน (Check-in)" value={formatDate(task.checkInAt)} />}
                {task.completedAt && <InfoCard icon={CheckCircle} label="เวลาปิดงาน (Resolve)" value={formatDate(task.completedAt)} />}
              </div>
            </div>

            {/* ── Notes ── */}
            {task.notes && (
              <>
                <SectionHeader icon={FileText} title="รายละเอียด / Notes" color={color} />
                <div className="p-4 mb-2">
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{task.notes}</p>
                </div>
              </>
            )}

            {/* ── Equipment ── */}
            {task.equipment.length > 0 && (
              <>
                <SectionHeader icon={Wrench} title="อุปกรณ์ที่เปลี่ยน / Equipment" color={color} />
                <div className="p-4 mb-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/60">
                        {['#', 'Equipment', 'Old Model', 'Old S/N', 'New Model', 'New S/N'].map((h) => (
                          <th key={h} className="text-left py-2 px-3 text-gray-300 font-semibold border border-slate-700/50 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {task.equipment.map((e, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 text-gray-500 border border-slate-700/30">{i + 1}</td>
                          <td className="py-2 px-3 text-white font-medium border border-slate-700/30">
                            {e.itemName}
                            {e.notes && <div className="text-xs text-gray-500 font-normal mt-0.5">{e.notes}</div>}
                          </td>
                          <td className="py-2 px-3 text-gray-400 border border-slate-700/30">{e.oldModel || '-'}</td>
                          <td className="py-2 px-3 text-gray-400 font-mono text-xs border border-slate-700/30">{e.oldSN || '-'}</td>
                          <td className="py-2 px-3 text-gray-300 border border-slate-700/30">{e.newModel || '-'}</td>
                          <td className="py-2 px-3 text-gray-300 font-mono text-xs border border-slate-700/30">{e.newSN || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Test results ── */}
            {task.testSections.length > 0 && (
              <>
                <SectionHeader icon={ClipboardCheck} title="ผลการทดสอบ / Test Results" color={color} />
                <div className="p-4 mb-2 space-y-4">
                  {task.testSections.map((sec, si) => (
                    <div key={si}>
                      {task.testSections.length > 1 && <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">{sec.title}</p>}
                      <div className="space-y-2">
                        {sec.items.map((t, ti) => {
                          const r = RESULT[t.result] || { label: t.result, cls: 'bg-gray-500/20 text-gray-400' }
                          return (
                            <div key={ti} className="bg-slate-800/50 rounded-xl p-3 flex items-start gap-3">
                              {t.photoPath && (
                                <img
                                  src={getPhotoUrl(t.photoPath)}
                                  alt={t.itemName}
                                  className="w-16 h-16 object-cover rounded-lg border border-slate-700/50 cursor-pointer hover:opacity-80 shrink-0"
                                  onClick={() => setLightbox(getPhotoUrl(t.photoPath!))}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-white text-sm font-medium break-words">{t.itemName}</p>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${r.cls}`}>{r.label}</span>
                                </div>
                                {t.note && <p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap">{t.note}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Photos ── */}
            {photoCount > 0 && (
              <>
                <SectionHeader icon={Camera} title={`ภาพถ่าย / Photos (${photoCount})`} color={color} />
                <div className="p-4 space-y-5 mb-2">
                  {task.photoGroups.map((g, gi) => (
                    <div key={gi}>
                      <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                        {g.title} ({g.photos.length})
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {g.photos.map((p, pi) => (
                          <div key={pi} className="min-w-0">
                            <img
                              src={getPhotoUrl(p.path)}
                              alt={p.caption || g.title}
                              loading="lazy"
                              className="w-full aspect-square object-cover rounded-lg border border-slate-700/50 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setLightbox(getPhotoUrl(p.path))}
                            />
                            {p.caption && <p className="text-[11px] text-gray-400 mt-1 leading-tight break-words">{p.caption}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>{task.organizationName ? `${task.organizationName} Incident Management System` : 'Incident Management System'}</p>
        </div>

        {/* Photo Lightbox */}
        {lightbox && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" onClick={() => setLightbox(null)}>
              <X className="w-8 h-8" />
            </button>
            <img
              src={lightbox}
              alt="Enlarged photo"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border-y border-slate-700/50 border-l-4 mt-4 first:mt-0"
      style={{ borderLeftColor: color }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <span className="text-sm font-semibold text-gray-200 tracking-wide">{title}</span>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, sub, fullWidth }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  fullWidth?: boolean
}) {
  return (
    <div className={`bg-slate-800/50 p-3 rounded-xl${fullWidth ? ' col-span-full' : ''}`}>
      <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-white text-sm font-medium break-words">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}
