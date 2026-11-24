'use client'

// Install task evidence (Store Lifecycle v1 §A3): the units RSM issued for this task (pulled by the task's ticket no.)
// plus units the customer sent. Each unit: INSTALLED at a point / NOT_INSTALLED (return to stock) / LOST / DAMAGED.
// On verify, INSTALLED units become the store's Equipment.
import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { DownloadCloud, Plus, Trash2, Loader2, Camera, X, Save, Package } from 'lucide-react'
import { getPhotoUrl } from '@/utils/photoUtils'
import { resizeImage } from '@/utils/resizeImage'

const API = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
const inputCls = 'w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500'

const OUTCOMES: { value: string; label: string; on: string }[] = [
  { value: 'INSTALLED', label: 'ติดตั้ง', on: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' },
  { value: 'NOT_INSTALLED', label: 'ไม่ได้ติดตั้ง', on: 'bg-sky-500/20 border-sky-500/50 text-sky-300' },
  { value: 'LOST', label: 'หาย', on: 'bg-red-500/20 border-red-500/50 text-red-300' },
  { value: 'DAMAGED', label: 'เสียหาย', on: 'bg-orange-500/20 border-orange-500/50 text-orange-300' },
]

export function installItemMissing(i: any): string[] {
  if (!i.outcome) return ['ยังไม่ได้ระบุ']
  const m: string[] = []
  if (i.outcome === 'INSTALLED' && !(i.pointName || '').trim()) m.push('จุดที่ติดตั้ง')
  if (i.outcome === 'LOST' || i.outcome === 'DAMAGED') {
    if (!(i.note || '').trim()) m.push('หมายเหตุ')
    if (!i.photoPath) m.push('รูป')
  }
  return m
}

interface Props {
  task: any
  canEdit: boolean
  onChanged: () => void
  onView: (url: string) => void
  confirmDelete: (title: string) => Promise<boolean>
  highlight: string
}

export default function InstallInventory({ task, canEdit, onChanged, onView, confirmDelete, highlight }: Props) {
  const items: any[] = task.installItems || []
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ pointName: '', category: '', brand: '', model: '', serialNumber: '' })

  const run = async (key: string, work: () => Promise<any>, ok?: string) => {
    setBusy(key)
    try {
      const res = await work()
      if (typeof ok === 'string') toast.success(ok)
      onChanged()
      return res
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  const patch = (id: number, body: Record<string, any>) =>
    run(`i${id}`, () => axios.patch(`${API()}/projects/install-items/${id}`, body, { headers: auth() }))

  const importRsm = () =>
    run('import', async () => {
      const res = await axios.post(`${API()}/projects/tasks/${task.id}/install-items/import-rsm`, {}, { headers: auth() })
      const { added, tickets } = res.data
      if (!tickets.length) toast('RSM ยังไม่มีใบเบิกที่ส่งของแล้วสำหรับงานนี้', { icon: 'ℹ️' })
      else toast.success(added ? `เพิ่ม ${added} รายการจาก ${tickets.join(', ')}` : `ไม่มีรายการใหม่ (${tickets.join(', ')})`)
    })

  const addCustomer = () =>
    run('add', async () => {
      await axios.post(`${API()}/projects/tasks/${task.id}/install-items`, { ...form, outcome: 'INSTALLED' }, { headers: auth() })
      setForm({ pointName: '', category: '', brand: '', model: '', serialNumber: '' })
      setAdding(false)
    }, 'เพิ่มของที่ลูกค้าส่งมาแล้ว')

  const uploadPhoto = (id: number, file: File) =>
    run(`i${id}`, async () => {
      const fd = new FormData()
      fd.append('photo', await resizeImage(file))
      await axios.post(`${API()}/projects/install-items/${id}/photo`, fd, { headers: auth() })
    })

  const done = items.filter((i) => installItemMissing(i).length === 0).length

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={importRsm}
          disabled={!canEdit || busy === 'import'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white disabled:opacity-40"
          style={{ backgroundColor: highlight }}
        >
          {busy === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
          ดึงรายการที่เบิกจาก RSM
        </button>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!canEdit}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-dashed border-slate-500 text-gray-300 hover:bg-slate-700/40 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> ของที่ลูกค้าส่งมาเอง
        </button>
        {items.length > 0 && <span className="text-[11px] text-gray-400 ml-auto">ระบุแล้ว {done}/{items.length}</span>}
      </div>

      {adding && (
        <div className="rounded-lg border border-slate-600 p-3 space-y-2 bg-slate-900/40">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="จุดที่ติดตั้ง เช่น POS#1" value={form.pointName} onChange={(e) => setForm({ ...form, pointName: e.target.value })} />
            <input className={inputCls} placeholder="ประเภท เช่น Printer" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className={inputCls} placeholder="ยี่ห้อ" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <input className={inputCls} placeholder="รุ่น" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input className={`${inputCls} col-span-2`} placeholder="S/N (ถ้ามี)" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-gray-300"><X className="w-3.5 h-3.5 inline" /> ยกเลิก</button>
            <button
              onClick={addCustomer}
              disabled={busy === 'add' || !form.category.trim() || !form.pointName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
            >
              {busy === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <Save className="w-3.5 h-3.5 inline" />} เพิ่ม
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-500">ยังไม่มีรายการ — กด &quot;ดึงรายการที่เบิกจาก RSM&quot; หรือเพิ่มของที่ลูกค้าส่งมาเอง</p>
      ) : (
        <div className="divide-y divide-slate-700/40 rounded-lg border border-slate-700/60 overflow-hidden">
          {items.map((it, idx) => {
            const key = `i${it.id}`
            const missing = installItemMissing(it)
            const title = [it.itemName || it.category, it.brand, it.model].filter(Boolean).join(' · ') || 'อุปกรณ์'
            return (
              <div key={it.id} className={`p-3 space-y-2 ${idx % 2 === 1 ? 'bg-slate-700/20' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{title}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">{it.serialNumber || 'ไม่มี S/N'}</p>
                    <p className="text-[10px] text-gray-500">
                      {it.source === 'RSM' ? `เบิกจาก RSM ${it.rsmTicketNo || ''}` : 'ลูกค้าส่งมาเอง'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {busy === key && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                    {it.source !== 'RSM' && canEdit && (
                      <button
                        onClick={async () => {
                          if (!(await confirmDelete('ลบรายการนี้?'))) return
                          run(key, () => axios.delete(`${API()}/projects/install-items/${it.id}`, { headers: auth() }))
                        }}
                        className="p-1 text-gray-500 hover:text-red-400"
                        title="ลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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

                {it.outcome === 'INSTALLED' && (
                  <input
                    key={`p${it.id}-${it.pointName ?? ''}`}
                    defaultValue={it.pointName || ''}
                    disabled={!canEdit}
                    placeholder="จุดที่ติดตั้ง (จำเป็น) เช่น POS#1 Printer, PMC"
                    onBlur={(e) => { if (e.target.value.trim() !== (it.pointName || '')) patch(it.id, { pointName: e.target.value }) }}
                    className={`${inputCls} ${!it.pointName ? 'border-red-500/60' : ''}`}
                  />
                )}
                {it.outcome === 'NOT_INSTALLED' && (
                  <p className="text-[11px] text-sky-300">ของเหลือ — ต้องคืนคลัง RSM</p>
                )}
                {(it.outcome === 'LOST' || it.outcome === 'DAMAGED' || it.note) && (
                  <input
                    key={`n${it.id}-${it.note ?? ''}`}
                    defaultValue={it.note || ''}
                    disabled={!canEdit}
                    placeholder={it.outcome === 'LOST' || it.outcome === 'DAMAGED' ? 'หมายเหตุ (จำเป็น) — เกิดอะไรขึ้น' : 'หมายเหตุ'}
                    onBlur={(e) => { if (e.target.value.trim() !== (it.note || '')) patch(it.id, { note: e.target.value }) }}
                    className={`${inputCls} ${(it.outcome === 'LOST' || it.outcome === 'DAMAGED') && !it.note ? 'border-red-500/60' : ''}`}
                  />
                )}
                {(it.outcome === 'LOST' || it.outcome === 'DAMAGED' || it.photoPath) && (
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
          })}
        </div>
      )}
    </>
  )
}
