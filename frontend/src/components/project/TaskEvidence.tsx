'use client'

// Evidence of a project task, laid out by its work type (backend src/modules/project/work-types.ts):
// photo sets (with point names), before/after points and test items (PASS / FAIL / NA + photo + note).
// The backend checks the same rules before the task can be sent.

import { useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Camera, Image as ImageIcon, Pencil, Trash2, Plus, CheckCircle2, AlertTriangle, Loader2, X, Save, Package, ClipboardCheck,
} from 'lucide-react'
import { getPhotoUrl } from '@/utils/photoUtils'
import { resizeImage } from '@/utils/resizeImage'
import type { EvidenceSection, WorkTypeDef } from '@/hooks/useWorkTypes'

interface Props {
  task: any
  def: WorkTypeDef
  /** may add / edit (assigned tech while working, Help Desk, PM) — and the task is checked in */
  canEdit: boolean
  /** may delete photos / test items */
  canDelete: boolean
  onChanged: () => void
  onView: (url: string) => void
  confirmDelete: (title: string) => Promise<boolean>
  highlight: string
}

const API = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

async function uploadPhoto(taskId: number, file: File, fields: Record<string, string>) {
  const fd = new FormData()
  fd.append('photo', await resizeImage(file))
  for (const [k, v] of Object.entries(fields)) if (v) fd.append(k, v)
  await axios.post(`${API()}/projects/tasks/${taskId}/photos`, fd, { headers: auth() })
}

// ── Small dialog: ask for a name (point name / new test item) ───────────────
function NameDialog({ title, placeholder, initial, onSave, onClose }: {
  title: string; placeholder: string; initial?: string; onSave: (v: string) => void | Promise<void>; onClose: () => void
}) {
  const [value, setValue] = useState(initial || '')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!value.trim()) { toast.error('กรุณากรอกชื่อ'); return }
    setSaving(true)
    try { await onSave(value.trim()) } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()}>
      <div
        className="w-full sm:max-w-sm bg-slate-800 border border-slate-600/60 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 100))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
        </button>
      </div>
    </div>
  )
}

// Camera + gallery buttons (one picker each — some phones offer only one source per picker)
function PhotoButtons({ disabled, multiple, onFiles, highlight, compact }: {
  disabled: boolean; multiple?: boolean; onFiles: (files: File[]) => void; highlight: string; compact?: boolean
}) {
  const cls = `flex items-center gap-1 rounded-lg text-xs ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} ${disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:opacity-90'}`
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  return (
    <span className="flex items-center gap-1.5">
      <label className={`${cls} text-white`} style={{ backgroundColor: highlight }}>
        <Camera className="w-3.5 h-3.5" />{!compact && 'ถ่ายรูป'}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={disabled} onChange={pick} />
      </label>
      <label className={`${cls} border border-slate-600 text-gray-200`}>
        <ImageIcon className="w-3.5 h-3.5" />{!compact && 'คลังภาพ'}
        <input type="file" accept="image/*" multiple={multiple} className="hidden" disabled={disabled} onChange={pick} />
      </label>
    </span>
  )
}

function Thumb({ src, label, onView, onRename, onDelete }: {
  src: string; label?: string | null; onView: () => void; onRename?: () => void; onDelete?: () => void
}) {
  return (
    <div className="relative rounded-lg overflow-hidden bg-slate-700/50 border border-slate-700/60">
      <img src={src} alt={label || ''} className="w-full aspect-video object-cover cursor-pointer" onClick={onView} />
      {label && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent px-2 pt-3 pb-1">
          <p className="text-white text-[11px] font-medium truncate">{label}</p>
        </div>
      )}
      {(onRename || onDelete) && (
        <div className="absolute top-1 right-1 flex gap-1">
          {onRename && (
            <button onClick={onRename} className="bg-black/70 p-1 rounded text-gray-200 hover:text-white" title="แก้ชื่อจุด">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="bg-black/70 p-1 rounded text-red-400 hover:text-red-300" title="ลบรูป">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function TaskEvidence({ task, def, canEdit, canDelete, onChanged, onView, confirmDelete, highlight }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | {
    title: string; placeholder: string; initial?: string; onSave: (v: string) => void | Promise<void>
  }>(null)
  // before/after points and custom test items that have no saved data yet
  const [newPoints, setNewPoints] = useState<Record<string, string[]>>({})
  const [newItems, setNewItems] = useState<Record<string, string[]>>({})
  const noteTimers = useRef<Record<string, string>>({})

  const status = (key: string) => (task.evidence || []).find((e: any) => e.key === key)
  const photosOf = (key: string) => (task.photos || []).filter((p: any) => p.section === key)

  const run = async (key: string, work: () => Promise<void>, ok?: string) => {
    setBusy(key)
    try {
      await work()
      if (ok) toast.success(ok)
      onChanged()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  const deletePhoto = async (id: number) => {
    if (!(await confirmDelete('ลบรูปนี้?'))) return
    run(`del-${id}`, () => axios.delete(`${API()}/projects/photos/${id}`, { headers: auth() }).then(() => {}), 'ลบรูปแล้ว')
  }

  const renamePhotos = (ids: number[], current: string) =>
    setDialog({
      title: 'แก้ชื่อจุด',
      placeholder: 'เช่น POS#1, AP หน้าร้าน',
      initial: current,
      onSave: async (v) => {
        await run('rename', () => Promise.all(ids.map((id) =>
          axios.patch(`${API()}/projects/photos/${id}`, { pointName: v }, { headers: auth() }))).then(() => {}))
        setDialog(null)
      },
    })

  // ── Photo set ─────────────────────────────────────────────────────────────
  const renderPhotos = (s: Extract<EvidenceSection, { kind: 'photos' }>) => {
    const photos = photosOf(s.key)
    const add = (files: File[]) => {
      const go = (pointName = '') =>
        run(s.key, async () => {
          for (const f of files) await uploadPhoto(task.id, f, { section: s.key, pointName })
        }, `เพิ่ม ${files.length} รูปแล้ว`)
      if (s.pointName) {
        setDialog({
          title: files.length > 1 ? `ชื่อจุดของ ${files.length} รูปนี้` : 'ชื่อจุดในรูปนี้',
          placeholder: 'เช่น POS#1, AP หน้าร้าน',
          onSave: async (v) => { setDialog(null); await go(v) },
        })
      } else go()
    }
    return (
      <>
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((p: any) => (
              <Thumb
                key={p.id}
                src={getPhotoUrl(p.photoPath)}
                label={p.pointName || p.comment}
                onView={() => onView(getPhotoUrl(p.photoPath))}
                onRename={canEdit && s.pointName ? () => renamePhotos([p.id], p.pointName || '') : undefined}
                onDelete={canDelete ? () => deletePhoto(p.id) : undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">ยังไม่มีรูป</p>
        )}
        <div className="flex items-center gap-2">
          <PhotoButtons disabled={!canEdit || busy === s.key} multiple onFiles={add} highlight={highlight} />
          {busy === s.key && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
      </>
    )
  }

  // ── Before / after points ─────────────────────────────────────────────────
  const renderBeforeAfter = (s: Extract<EvidenceSection, { kind: 'beforeAfter' }>) => {
    const photos = photosOf(s.key)
    const names: string[] = []
    for (const p of photos) { const n = p.pointName || '(ไม่มีชื่อจุด)'; if (!names.includes(n)) names.push(n) }
    for (const n of newPoints[s.key] || []) if (!names.includes(n)) names.push(n)

    const addPoint = () => setDialog({
      title: 'เพิ่มจุด',
      placeholder: s.hint?.match(/"([^"]+)"/)?.[1] || 'เช่น POS#1',
      onSave: (v) => {
        setNewPoints((m) => ({ ...m, [s.key]: [...(m[s.key] || []), v] }))
        setDialog(null)
      },
    })

    return (
      <>
        {names.length === 0 && <p className="text-xs text-gray-500">ยังไม่มีจุด — กด &quot;เพิ่มจุด&quot; แล้วใส่รูปก่อนและหลังทำ</p>}
        <div className="space-y-3">
          {names.map((name) => {
            const pts = photos.filter((p: any) => (p.pointName || '(ไม่มีชื่อจุด)') === name)
            const busyKey = `${s.key}:${name}`
            return (
              <div key={name} className="rounded-lg border border-slate-700/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white font-medium truncate">📍 {name}</p>
                  {canEdit && pts.length > 0 && (
                    <button onClick={() => renamePhotos(pts.map((p: any) => p.id), name === '(ไม่มีชื่อจุด)' ? '' : name)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> แก้ชื่อ
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['BEFORE', 'AFTER'] as const).map((phase) => {
                    const list = pts.filter((p: any) => p.phase === phase)
                    return (
                      <div key={phase} className="space-y-1.5">
                        <p className={`text-[11px] font-semibold ${phase === 'BEFORE' ? 'text-orange-300' : 'text-emerald-300'}`}>
                          {phase === 'BEFORE' ? 'ก่อนทำ' : 'หลังทำ'} {list.length > 0 ? `(${list.length})` : ''}
                        </p>
                        {list.map((p: any) => (
                          <Thumb
                            key={p.id}
                            src={getPhotoUrl(p.photoPath)}
                            onView={() => onView(getPhotoUrl(p.photoPath))}
                            onDelete={canDelete ? () => deletePhoto(p.id) : undefined}
                          />
                        ))}
                        <PhotoButtons
                          compact
                          disabled={!canEdit || busy === busyKey}
                          onFiles={(files) => run(busyKey, async () => {
                            for (const f of files) {
                              await uploadPhoto(task.id, f, { section: s.key, phase, pointName: name === '(ไม่มีชื่อจุด)' ? '' : name })
                            }
                          }, 'เพิ่มรูปแล้ว')}
                          highlight={highlight}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={addPoint}
          disabled={!canEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-dashed border-slate-500 text-gray-300 hover:bg-slate-700/40 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> เพิ่มจุด
        </button>
      </>
    )
  }

  // ── Test items ────────────────────────────────────────────────────────────
  const renderTests = (s: Extract<EvidenceSection, { kind: 'tests' }>) => {
    const rows: any[] = (task.testResults || []).filter((t: any) => t.section === s.key)
    const items = [...s.items]
    for (const r of rows) if (!items.includes(r.itemName)) items.push(r.itemName)
    for (const n of newItems[s.key] || []) if (!items.includes(n)) items.push(n)

    const save = (itemName: string, fields: { result?: string; note?: string; photo?: File }) => {
      const row = rows.find((r) => r.itemName === itemName)
      const result = fields.result || row?.result
      if (!result) { toast.error('เลือกผลทดสอบก่อน (ผ่าน / ไม่ผ่าน / ไม่มี)'); return }
      return run(`${s.key}:${itemName}`, async () => {
        const fd = new FormData()
        fd.append('section', s.key)
        fd.append('itemName', itemName)
        fd.append('result', result)
        if (fields.note !== undefined) fd.append('note', fields.note)
        if (fields.photo) fd.append('photo', await resizeImage(fields.photo))
        await axios.post(`${API()}/projects/tasks/${task.id}/tests`, fd, { headers: auth() })
      })
    }

    return (
      <>
        <div className="divide-y divide-slate-700/40 rounded-lg border border-slate-700/60 overflow-hidden">
          {items.map((itemName, idx) => {
            const row = rows.find((r) => r.itemName === itemName)
            const busyKey = `${s.key}:${itemName}`
            const custom = !s.items.includes(itemName)
            const btn = (value: string, label: string, on: string) => (
              <button
                key={value}
                disabled={!canEdit || busy === busyKey}
                onClick={() => save(itemName, { result: value })}
                className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                  row?.result === value ? on : 'border-slate-600 text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            )
            return (
              <div key={itemName} className={`p-3 space-y-2 ${idx % 2 === 1 ? 'bg-slate-700/20' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white">
                    {itemName}
                    {custom && <span className="ml-1.5 text-[10px] text-gray-500">(เพิ่มเอง)</span>}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {btn('PASS', 'ผ่าน', 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300')}
                    {btn('FAIL', 'ไม่ผ่าน', 'bg-red-500/20 border-red-500/50 text-red-300')}
                    {btn('NA', 'ไม่มี', 'bg-slate-500/30 border-slate-400/50 text-gray-200')}
                  </div>
                </div>
                {row && row.result !== 'NA' && (
                  <div className="flex items-center gap-2">
                    {row.photoPath ? (
                      <img
                        src={getPhotoUrl(row.photoPath)}
                        alt=""
                        className="w-16 h-12 rounded object-cover cursor-pointer border border-slate-600"
                        onClick={() => onView(getPhotoUrl(row.photoPath))}
                      />
                    ) : (
                      <span className="text-[11px] text-amber-300">ต้องมีรูปผลเทส</span>
                    )}
                    <PhotoButtons
                      compact
                      disabled={!canEdit || busy === busyKey}
                      onFiles={(files) => save(itemName, { photo: files[0] })}
                      highlight={highlight}
                    />
                    {busy === busyKey && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                )}
                {row && (row.result === 'FAIL' || row.note) && (
                  <input
                    defaultValue={row.note || ''}
                    disabled={!canEdit}
                    placeholder={row.result === 'FAIL' ? 'หมายเหตุ (จำเป็น) — ไม่ผ่านเพราะอะไร' : 'หมายเหตุ'}
                    onChange={(e) => { noteTimers.current[busyKey] = e.target.value }}
                    onBlur={() => {
                      const v = noteTimers.current[busyKey]
                      if (v !== undefined && v !== (row.note || '')) save(itemName, { note: v })
                    }}
                    className={`w-full px-2.5 py-1.5 bg-slate-800/60 border rounded text-xs text-white placeholder-gray-500 focus:outline-none ${
                      row.result === 'FAIL' && !row.note ? 'border-red-500/60' : 'border-slate-600'
                    }`}
                  />
                )}
                {custom && row && canDelete && (
                  <button
                    onClick={async () => {
                      if (!(await confirmDelete(`ลบหัวข้อ "${itemName}"?`))) return
                      run(busyKey, () => axios.delete(`${API()}/projects/tests/${row.id}`, { headers: auth() }).then(() => {}))
                    }}
                    className="text-[11px] text-gray-500 hover:text-red-400 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> ลบหัวข้อนี้
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button
          onClick={() => setDialog({
            title: 'เพิ่มหัวข้อทดสอบ',
            placeholder: 'เช่น POS#2 ขายทดสอบ',
            onSave: (v) => {
              setNewItems((m) => ({ ...m, [s.key]: [...(m[s.key] || []), v] }))
              setDialog(null)
            },
          })}
          disabled={!canEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-dashed border-slate-500 text-gray-300 hover:bg-slate-700/40 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> เพิ่มหัวข้อทดสอบ
        </button>
      </>
    )
  }

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-white font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" style={{ color: highlight }} />
          หลักฐานงาน — {def.label}
        </h2>
        <p className="text-xs text-gray-500 mt-1">{def.description}</p>
      </div>

      {def.sections.map((s) => {
        const st = status(s.key)
        return (
          <div key={s.key} className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-white font-semibold flex items-center gap-1.5">
                  {st?.ok
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                  {s.label}
                </p>
                {s.hint && <p className="text-[11px] text-gray-500 mt-0.5">{s.hint}</p>}
              </div>
            </div>
            {!st?.ok && (st?.missing?.length ?? 0) > 0 && (
              <ul className="text-[11px] text-amber-300/90 space-y-0.5">
                {st.missing.map((m: string) => <li key={m}>• {m}</li>)}
              </ul>
            )}
            {s.kind === 'photos' && renderPhotos(s)}
            {s.kind === 'beforeAfter' && renderBeforeAfter(s)}
            {s.kind === 'tests' && renderTests(s)}
            {s.kind === 'equipment' && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> กรอกในหัวข้อ &quot;อุปกรณ์ที่เปลี่ยน&quot; ด้านล่าง ({task.equipment?.length || 0} รายการ)
              </p>
            )}
          </div>
        )
      })}

      {dialog && <NameDialog {...dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
