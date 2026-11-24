'use client'

// Closed Store evidence (Store Lifecycle v1 §A4): every unit of the store (from the Equipment register — the
// count is whatever the store really has) and where each one went. The technician must answer every row.
// On verify: RETIRED (warehouse / customer / left with customer), moved to another store, or INACTIVE (not found).
import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ListChecks, Plus, Trash2, Loader2, Camera, X, Save, AlertTriangle, Search } from 'lucide-react'
import { getPhotoUrl } from '@/utils/photoUtils'
import { resizeImage } from '@/utils/resizeImage'
import { formatStore } from '@/utils/formatStore'

const API = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
const inputCls = 'w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500'

const OUTCOMES: { value: string; label: string; on: string }[] = [
  { value: 'TO_WAREHOUSE', label: 'เก็บกลับคลัง', on: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' },
  { value: 'TO_CUSTOMER', label: 'ส่งคืนลูกค้า', on: 'bg-sky-500/20 border-sky-500/50 text-sky-300' },
  { value: 'TRANSFERRED', label: 'ย้ายสาขา', on: 'bg-violet-500/20 border-violet-500/50 text-violet-300' },
  { value: 'LEFT_WITH_CUSTOMER', label: 'ลูกค้าเก็บเอง', on: 'bg-amber-500/20 border-amber-500/50 text-amber-300' },
  { value: 'NOT_FOUND', label: 'ไม่พบ', on: 'bg-red-500/20 border-red-500/50 text-red-300' },
]

export function closeItemMissing(i: any): string[] {
  if (!i.outcome) return ['ยังไม่ได้ระบุ']
  const m: string[] = []
  const blank = (s?: string | null) => !(s || '').trim()
  if (i.outcome === 'TO_WAREHOUSE') {
    if (blank(i.serialNumber) && !i.noSerial) m.push('S/N (หรือติ๊ก "ไม่มี S/N")')
    if (!i.photoPath) m.push('รูป')
  } else if (i.outcome === 'TO_CUSTOMER') {
    if (blank(i.handedTo)) m.push('ผู้รับ')
    if (blank(i.shipRef)) m.push('ที่อยู่ / เลขพัสดุ')
    if (!i.photoPath) m.push('รูป')
  } else if (i.outcome === 'TRANSFERRED') {
    if (!i.toStoreId) m.push('สาขาปลายทาง')
  } else if (i.outcome === 'LEFT_WITH_CUSTOMER') {
    if (blank(i.handedTo)) m.push('ชื่อผู้รับ')
    if (!i.photoPath) m.push('รูป')
  } else if (i.outcome === 'NOT_FOUND') {
    if (blank(i.note)) m.push('หมายเหตุ')
  }
  return m
}

/** Same rule as PM (isWithin6Months): never PM'd or older than 6 months → the list may be stale */
function pmStale(lastPmAt?: string | null) {
  if (!lastPmAt) return true
  const six = new Date()
  six.setMonth(six.getMonth() - 6)
  return new Date(lastPmAt) <= six
}

// Destination store picker (search by code / name)
function StorePicker({ value, label, disabled, excludeId, onPick }: {
  value: number | null; label?: string | null; disabled: boolean; excludeId?: number; onPick: (s: { id: number; storeCode: string; name: string } | null) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<any[]>([])
  useEffect(() => {
    if (!open || q.trim().length < 1) { setList([]); return }
    const t = setTimeout(() => {
      axios
        .get(`${API()}/stores`, { headers: auth(), params: { search: q.trim(), limit: 10, page: 1 } })
        .then((res) => setList((res.data?.data || []).filter((s: any) => s.id !== excludeId)))
        .catch(() => setList([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q, open, excludeId])

  if (value && !open) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-violet-300">→ {label || `สาขา #${value}`}</span>
        {!disabled && <button onClick={() => setOpen(true)} className="text-[11px] text-gray-400 hover:text-white">เปลี่ยน</button>}
      </div>
    )
  }
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-gray-500" />
        <input className={`${inputCls} ${!value ? 'border-red-500/60' : ''}`} placeholder="ค้นหาสาขาปลายทาง (รหัส / ชื่อ)" value={q} disabled={disabled}
          onFocus={() => setOpen(true)} onChange={(e) => setQ(e.target.value)} />
      </div>
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
          {list.map((s) => (
            <button key={s.id} onClick={() => { onPick(s); setOpen(false); setQ('') }} className="block w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-slate-700">
              {formatStore(s)}{s.province ? <span className="text-gray-500"> · {s.province}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  task: any
  canEdit: boolean
  onChanged: () => void
  onView: (url: string) => void
  confirmDelete: (title: string) => Promise<boolean>
  highlight: string
}

export default function CloseInventory({ task, canEdit, onChanged, onView, confirmDelete, highlight }: Props) {
  const items: any[] = task.closeItems || []
  const store = task.projectStore?.store
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ pointName: '', category: '', brand: '', model: '', serialNumber: '' })
  // Names of destination stores picked in this session (rows only carry toStoreId)
  const [storeNames, setStoreNames] = useState<Record<number, string>>({})

  const run = async (key: string, work: () => Promise<any>, ok?: string) => {
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
  const patch = (id: number, body: Record<string, any>) =>
    run(`c${id}`, () => axios.patch(`${API()}/projects/close-items/${id}`, body, { headers: auth() }))

  const load = () =>
    run('load', async () => {
      const res = await axios.post(`${API()}/projects/tasks/${task.id}/close-items/load`, {}, { headers: auth() })
      toast.success(res.data.added ? `โหลดอุปกรณ์ของสาขา ${res.data.added} รายการ` : 'รายการเป็นปัจจุบันแล้ว')
    })

  const add = () =>
    run('add', async () => {
      await axios.post(`${API()}/projects/tasks/${task.id}/close-items`, form, { headers: auth() })
      setForm({ pointName: '', category: '', brand: '', model: '', serialNumber: '' })
      setAdding(false)
    }, 'เพิ่มรายการแล้ว')

  const uploadPhoto = (id: number, file: File) =>
    run(`c${id}`, async () => {
      const fd = new FormData()
      fd.append('photo', await resizeImage(file))
      await axios.post(`${API()}/projects/close-items/${id}/photo`, fd, { headers: auth() })
    })

  const active = items.filter((i) => !i.inactive)
  const inactive = items.filter((i) => i.inactive)
  const done = items.filter((i) => closeItemMissing(i).length === 0).length

  const row = (it: any, idx: number) => {
    const key = `c${it.id}`
    const missing = closeItemMissing(it)
    const needsPhoto = ['TO_WAREHOUSE', 'TO_CUSTOMER', 'LEFT_WITH_CUSTOMER'].includes(it.outcome)
    return (
      <div key={it.id} className={`p-3 space-y-2 ${idx % 2 === 1 ? 'bg-slate-700/20' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{it.pointName || it.category || 'อุปกรณ์'}</p>
            <p className="text-[11px] text-gray-400">{[it.category, it.brand, it.model].filter(Boolean).join(' · ') || '-'}</p>
            {!it.equipmentId && <p className="text-[10px] text-amber-300/80">เพิ่มจากหน้างาน</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {busy === key && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            {!it.equipmentId && canEdit && (
              <button
                onClick={async () => {
                  if (!(await confirmDelete('ลบรายการนี้?'))) return
                  run(key, () => axios.delete(`${API()}/projects/close-items/${it.id}`, { headers: auth() }))
                }}
                className="p-1 text-gray-500 hover:text-red-400"
                title="ลบ"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Real S/N (Mockup S/N can be corrected) */}
        <div className="flex items-center gap-2">
          <input
            key={`s${it.id}-${it.serialNumber ?? ''}-${it.noSerial}`}
            defaultValue={it.serialNumber || ''}
            disabled={!canEdit || it.noSerial}
            placeholder={it.noSerial ? 'ไม่มี S/N' : 'S/N ของจริง'}
            onBlur={(e) => { if (e.target.value.trim() !== (it.serialNumber || '')) patch(it.id, { serialNumber: e.target.value }) }}
            className={`${inputCls} font-mono`}
          />
          <label className="flex items-center gap-1 text-[11px] text-gray-300 whitespace-nowrap">
            <input type="checkbox" checked={!!it.noSerial} disabled={!canEdit} onChange={(e) => patch(it.id, { noSerial: e.target.checked })} />
            ไม่มี S/N
          </label>
        </div>

        <div className="flex flex-wrap gap-1">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              disabled={!canEdit || busy === key}
              onClick={() => patch(it.id, { outcome: o.value })}
              className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                it.outcome === o.value ? o.on : 'border-slate-600 text-gray-400 hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {it.outcome === 'TRANSFERRED' && (
          <StorePicker
            value={it.toStoreId}
            label={storeNames[it.toStoreId] || it.toStoreLabel}
            disabled={!canEdit}
            excludeId={store?.id}
            onPick={(s) => {
              if (!s) return
              setStoreNames((m) => ({ ...m, [s.id]: formatStore(s) }))
              patch(it.id, { toStoreId: s.id })
            }}
          />
        )}
        {(it.outcome === 'TO_CUSTOMER' || it.outcome === 'LEFT_WITH_CUSTOMER') && (
          <input
            key={`h${it.id}-${it.handedTo ?? ''}`}
            defaultValue={it.handedTo || ''}
            disabled={!canEdit}
            placeholder={it.outcome === 'TO_CUSTOMER' ? 'ผู้รับ (จำเป็น)' : 'ชื่อผู้รับ เช่น Store Manager / Area (จำเป็น)'}
            onBlur={(e) => { if (e.target.value.trim() !== (it.handedTo || '')) patch(it.id, { handedTo: e.target.value }) }}
            className={`${inputCls} ${!it.handedTo ? 'border-red-500/60' : ''}`}
          />
        )}
        {it.outcome === 'TO_CUSTOMER' && (
          <input
            key={`r${it.id}-${it.shipRef ?? ''}`}
            defaultValue={it.shipRef || ''}
            disabled={!canEdit}
            placeholder="ที่อยู่ หรือ เลขพัสดุ (จำเป็น)"
            onBlur={(e) => { if (e.target.value.trim() !== (it.shipRef || '')) patch(it.id, { shipRef: e.target.value }) }}
            className={`${inputCls} ${!it.shipRef ? 'border-red-500/60' : ''}`}
          />
        )}
        {(it.outcome === 'NOT_FOUND' || it.note || it.outcome === 'TRANSFERRED') && (
          <input
            key={`n${it.id}-${it.note ?? ''}`}
            defaultValue={it.note || ''}
            disabled={!canEdit}
            placeholder={it.outcome === 'NOT_FOUND' ? 'หมายเหตุ (จำเป็น)' : 'หมายเหตุ'}
            onBlur={(e) => { if (e.target.value.trim() !== (it.note || '')) patch(it.id, { note: e.target.value }) }}
            className={`${inputCls} ${it.outcome === 'NOT_FOUND' && !it.note ? 'border-red-500/60' : ''}`}
          />
        )}
        {(needsPhoto || it.photoPath) && (
          <div className="flex items-center gap-2">
            {it.photoPath ? (
              <img src={getPhotoUrl(it.photoPath)} alt="" className="w-16 h-12 rounded object-cover border border-slate-600 cursor-pointer" onClick={() => onView(getPhotoUrl(it.photoPath))} />
            ) : (
              <span className="text-[11px] text-amber-300">ต้องมีรูป</span>
            )}
            <label className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white ${!canEdit ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}`} style={{ backgroundColor: highlight }}>
              <Camera className="w-3.5 h-3.5" /> รูป
              <input type="file" accept="image/*" className="hidden" disabled={!canEdit} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto(it.id, f) }} />
            </label>
          </div>
        )}
        {missing.length > 0 && it.outcome && <p className="text-[11px] text-amber-300/90">ยังขาด: {missing.join(', ')}</p>}
      </div>
    )
  }

  return (
    <>
      {/* Where the list comes from: the last PM keeps the register current */}
      <div className={`rounded-lg px-3 py-2 text-[11px] flex items-start gap-2 ${pmStale(store?.lastPmAt) ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200' : 'bg-slate-800/60 text-gray-300'}`}>
        {pmStale(store?.lastPmAt) && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
        <span>
          รายการอัปเดตล่าสุด: {store?.lastPmAt ? `PM ${new Date(store.lastPmAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'ยังไม่เคย PM'}
          {pmStale(store?.lastPmAt) && ' — รายการอาจไม่ครบ / S/N อาจไม่ตรง ตรวจของจริงทีละจุด'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={load}
          disabled={!canEdit || busy === 'load'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-40"
          style={{ backgroundColor: highlight }}
        >
          {busy === 'load' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
          {items.length ? 'โหลดรายการของสาขาอีกครั้ง' : 'โหลดรายการอุปกรณ์ของสาขา'}
        </button>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!canEdit}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-dashed border-slate-500 text-gray-300 hover:bg-slate-700/40 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> ของที่ไม่อยู่ในรายการ
        </button>
        {items.length > 0 && <span className="text-[11px] text-gray-400 ml-auto">ระบุแล้ว {done}/{items.length}</span>}
      </div>

      {adding && (
        <div className="rounded-lg border border-slate-600 p-3 space-y-2 bg-slate-900/40">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="ชื่อจุด เช่น POS#3" value={form.pointName} onChange={(e) => setForm({ ...form, pointName: e.target.value })} />
            <input className={inputCls} placeholder="ประเภท เช่น Smart Phone" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className={inputCls} placeholder="ยี่ห้อ" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <input className={inputCls} placeholder="รุ่น" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input className={`${inputCls} col-span-2`} placeholder="S/N (ถ้ามี)" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-gray-300"><X className="w-3.5 h-3.5 inline" /> ยกเลิก</button>
            <button
              onClick={add}
              disabled={busy === 'add' || (!form.category.trim() && !form.pointName.trim())}
              className="px-3 py-1.5 rounded-lg text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
            >
              {busy === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <Save className="w-3.5 h-3.5 inline" />} เพิ่ม
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-500">ยังไม่มีรายการ — กด &quot;โหลดรายการอุปกรณ์ของสาขา&quot;</p>
      ) : (
        <>
          <div className="divide-y divide-slate-700/40 rounded-lg border border-slate-700/60 overflow-visible">
            {active.map(row)}
          </div>
          {inactive.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-gray-500">เครื่องที่ PM ระบุว่าไม่ใช้งานแล้ว (ปกติไม่อยู่แล้ว — ระบุ &quot;ไม่พบ&quot; ได้)</p>
              <div className="divide-y divide-slate-700/40 rounded-lg border border-slate-700/60 opacity-80">
                {inactive.map(row)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
