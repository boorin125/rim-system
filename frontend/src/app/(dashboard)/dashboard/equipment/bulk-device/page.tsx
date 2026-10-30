// app/(dashboard)/dashboard/equipment/bulk-device/page.tsx
// Add one device (e.g. "Router") to many stores at once — IT_MANAGER only.
// Each row is the truth: a blank field clears the old value (status blank = keep / ACTIVE for new).
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  ArrowLeft,
  Layers,
  Search,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  RefreshCw,
  MinusCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { formatStore } from '@/utils/formatStore'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface StoreItem {
  id: number
  storeCode: string
  name: string
  province?: string | null
  storeStatus?: string
}

interface Row {
  storeId: number
  storeCode: string
  storeName: string
  serialNumber: string
  ipAddress: string
  brand: string
  model: string
  purchaseDate: string
  warrantyExpiry: string
  status: string // '' = keep (existing) / ACTIVE (new)
  state: 'new' | 'existing' | 'duplicate'
}

type Action = 'create' | 'update' | 'unchanged' | 'error'
interface Summary { create: number; update: number; unchanged: number; error: number }
interface ResultRow { index: number; storeCode: string; storeName: string | null; action: Action; message?: string }
interface PlanResult { summary: Summary; rows: ResultRow[] }

type Step = 'setup' | 'grid' | 'preview' | 'done'

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE — ใช้งาน' },
  { value: 'MAINTENANCE', label: 'MAINTENANCE — ซ่อมบำรุง' },
  { value: 'INACTIVE', label: 'INACTIVE — ไม่ใช้งาน' },
  { value: 'RETIRED', label: 'RETIRED — ปลดระวาง' },
]

// Excel columns (header text → row field). Store Name is informational only.
const EXCEL_COLUMNS: Array<{ header: string; key: keyof Row | null }> = [
  { header: 'Store Code', key: 'storeCode' },
  { header: 'Store Name', key: null },
  { header: 'Serial Number', key: 'serialNumber' },
  { header: 'IP Address', key: 'ipAddress' },
  { header: 'Brand', key: 'brand' },
  { header: 'Model', key: 'model' },
  { header: 'Purchase Date (YYYY-MM-DD)', key: 'purchaseDate' },
  { header: 'Warranty Expiry (YYYY-MM-DD)', key: 'warrantyExpiry' },
  { header: 'Status', key: 'status' },
]

const selectCls =
  'bg-slate-800 border border-slate-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white'
const inputCls =
  'w-full bg-slate-800 border border-slate-600 rounded-lg text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const cellCls =
  'w-full min-w-[7rem] bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500'

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

/** Excel / pasted dates → YYYY-MM-DD (accepts d/m/yyyy, Buddhist years) */
function toIsoDay(v: string): string {
  const s = (v ?? '').toString().trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    let y = Number(m[3])
    if (y > 2400) y -= 543
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return s // left as typed — the server reports it as an invalid date
}

export default function BulkDevicePage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('setup')
  const [busy, setBusy] = useState(false)

  // Step 1 — device + stores
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')
  const [pasteText, setPasteText] = useState('')

  // Step 2 — one row per store
  const [rows, setRows] = useState<Row[]>([])
  const [fill, setFill] = useState({ brand: '', model: '', purchaseDate: '', warrantyExpiry: '', status: '' })

  // Step 3/4
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [result, setResult] = useState<PlanResult | null>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    const user = userStr ? JSON.parse(userStr) : null
    const roles: string[] = Array.isArray(user?.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.role || r?.name || ''))
      : [user?.role].filter(Boolean)
    if (!roles.includes('IT_MANAGER')) {
      toast.error('เฉพาะ IT Manager เท่านั้น')
      router.push('/dashboard/equipment')
      return
    }
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/stores?limit=10000`, { headers: authHeader() })
      .then((r) => setStores(r.data?.data || []))
      .catch(() => toast.error('โหลดรายชื่อสาขาไม่สำเร็จ'))
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories`, { headers: authHeader() })
      .then((r) => setCategories((r.data || []).filter((c: any) => c.isActive).map((c: any) => c.name)))
      .catch(() => {})
  }, [])

  const provinces = useMemo(
    () => Array.from(new Set(stores.map((s) => s.province).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'th')),
    [stores],
  )
  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stores.filter(
      (s) =>
        (!province || s.province === province) &&
        (!q || s.storeCode.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
    )
  }, [stores, search, province])

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectFiltered = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      filteredStores.forEach((s) => (on ? next.add(s.id) : next.delete(s.id)))
      return next
    })

  const addPastedCodes = () => {
    const codes = pasteText.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean)
    if (!codes.length) return
    const byCode = new Map(stores.map((s) => [s.storeCode.toUpperCase(), s]))
    const missing: string[] = []
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of codes) {
        const s = byCode.get(c.toUpperCase())
        s ? next.add(s.id) : missing.push(c)
      }
      return next
    })
    setPasteText('')
    if (missing.length) toast.error(`ไม่พบรหัสสาขา: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` และอีก ${missing.length - 10}` : ''}`, { duration: 6000 })
    else toast.success(`เพิ่ม ${codes.length} สาขา`)
  }

  /** Build the grid, pre-filled with the device's current values so untouched data is kept */
  const buildRows = async (storeIds: number[], keep?: Map<number, Row>) => {
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/equipment/bulk-device/existing`,
      { name: name.trim(), storeIds },
      { headers: authHeader() },
    )
    const existing = new Map<number, any>((res.data || []).map((e: any) => [e.storeId, e]))
    const byId = new Map(stores.map((s) => [s.id, s]))
    return storeIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.storeCode.localeCompare(b!.storeCode, undefined, { numeric: true }))
      .map((s) => {
        const prev = keep?.get(s!.id)
        if (prev) return prev
        const e = existing.get(s!.id)
        const eq = e?.equipment
        return {
          storeId: s!.id,
          storeCode: s!.storeCode,
          storeName: s!.name,
          serialNumber: eq?.serialNumber ?? '',
          ipAddress: eq?.ipAddress ?? '',
          brand: eq?.brand ?? '',
          model: eq?.model ?? '',
          purchaseDate: eq?.purchaseDate ?? '',
          warrantyExpiry: eq?.warrantyExpiry ?? '',
          status: eq?.status ?? '',
          state: e?.duplicates ? 'duplicate' : eq ? 'existing' : 'new',
        } as Row
      })
  }

  const goToGrid = async () => {
    if (!name.trim()) return toast.error('กรุณากรอก Device Name')
    if (!category) return toast.error('กรุณาเลือก Category')
    if (selected.size === 0) return toast.error('กรุณาเลือกอย่างน้อย 1 สาขา')
    setBusy(true)
    try {
      // Rows already typed for a store that stays selected are kept
      const keep = new Map(rows.map((r) => [r.storeId, r]))
      setRows(await buildRows(Array.from(selected), keep))
      setStep('grid')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'โหลดข้อมูลเดิมไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const updateRow = (storeId: number, key: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.storeId === storeId ? { ...r, [key]: value } : r)))

  const fillColumn = (key: keyof typeof fill) => {
    setRows((prev) => prev.map((r) => ({ ...r, [key]: fill[key] })))
    toast.success(`ใส่ให้ทั้ง ${rows.length} แถวแล้ว`)
  }

  const downloadExcel = () => {
    const aoa = [
      EXCEL_COLUMNS.map((c) => c.header),
      ...rows.map((r) => [r.storeCode, r.storeName, r.serialNumber, r.ipAddress, r.brand, r.model, r.purchaseDate, r.warrantyExpiry, r.status]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [12, 28, 20, 16, 14, 18, 16, 16, 12].map((wch) => ({ wch }))
    // Keep S/N / IP / codes as text so Excel does not turn them into numbers
    const range = XLSX.utils.decode_range(ws['!ref'] as string)
    for (let R = 1; R <= range.e.r; R++) {
      for (const C of [0, 2, 3]) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell) { cell.t = 's'; cell.z = '@' }
      }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Devices')
    const safe = name.trim().replace(/[^\w.#-]+/g, '_') || 'device'
    XLSX.writeFile(wb, `bulk-${safe}-${rows.length}-stores.xlsx`)
  }

  const uploadExcel = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' })
      const headerIdx = data.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === 'store code'))
      if (headerIdx < 0) return toast.error('ไม่พบหัวคอลัมน์ "Store Code" ในไฟล์')
      const header = data[headerIdx].map((h) => String(h).trim().toLowerCase())
      const colOf = (key: keyof Row) => {
        const def = EXCEL_COLUMNS.find((c) => c.key === key)!
        return header.findIndex((h) => h.startsWith(def.header.split(' (')[0].toLowerCase()))
      }

      const byCode = new Map(stores.map((s) => [s.storeCode.toUpperCase(), s]))
      const fromFile = new Map<number, Partial<Row>>()
      const missing: string[] = []
      for (const line of data.slice(headerIdx + 1)) {
        const code = String(line[colOf('storeCode')] ?? '').trim()
        if (!code) continue
        const store = byCode.get(code.toUpperCase())
        if (!store) { missing.push(code); continue }
        const get = (key: keyof Row) => { const i = colOf(key); return i < 0 ? '' : String(line[i] ?? '').trim() }
        fromFile.set(store.id, {
          serialNumber: get('serialNumber'),
          ipAddress: get('ipAddress'),
          brand: get('brand'),
          model: get('model'),
          purchaseDate: toIsoDay(get('purchaseDate')),
          warrantyExpiry: toIsoDay(get('warrantyExpiry')),
          status: get('status').toUpperCase(),
        })
      }
      if (fromFile.size === 0) return toast.error('ไม่พบแถวที่มีรหัสสาขาในระบบ')

      // Stores in the file but not in the grid are added (with their current values), then overwritten by the file
      const newIds = Array.from(fromFile.keys()).filter((id) => !rows.some((r) => r.storeId === id))
      let grid = rows
      if (newIds.length) {
        const keep = new Map(rows.map((r) => [r.storeId, r]))
        grid = await buildRows([...rows.map((r) => r.storeId), ...newIds], keep)
        setSelected(new Set(grid.map((r) => r.storeId)))
      }
      setRows(grid.map((r) => (fromFile.has(r.storeId) ? { ...r, ...fromFile.get(r.storeId) } : r)))
      toast.success(`อ่านไฟล์แล้ว ${fromFile.size} สาขา${newIds.length ? ` (เพิ่มสาขาใหม่ ${newIds.length})` : ''}`)
      if (missing.length) toast.error(`ไม่พบรหัสสาขา: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` และอีก ${missing.length - 10}` : ''}`, { duration: 6000 })
    } catch (err) {
      console.error(err)
      toast.error('อ่านไฟล์ Excel ไม่สำเร็จ')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const payload = () => ({
    name: name.trim(),
    category,
    rows: rows.map((r) => ({
      storeCode: r.storeCode,
      serialNumber: r.serialNumber,
      ipAddress: r.ipAddress,
      brand: r.brand,
      model: r.model,
      purchaseDate: r.purchaseDate,
      warrantyExpiry: r.warrantyExpiry,
      status: r.status,
    })),
  })

  const runPreview = async () => {
    setBusy(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/equipment/bulk-device/preview`, payload(), { headers: authHeader() })
      setPlan(res.data)
      setStep('preview')
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'ตรวจสอบไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const runApply = async () => {
    setBusy(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/equipment/bulk-device/apply`, payload(), { headers: authHeader() })
      setResult(res.data)
      setStep('done')
      toast.success('บันทึกเรียบร้อย')
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  /** After saving: keep only the rows that failed, to fix and save again */
  const fixProblems = () => {
    if (!result) return
    const failed = new Set(result.rows.filter((r) => r.action === 'error').map((r) => r.index))
    const keep = rows.filter((_, i) => failed.has(i))
    setRows(keep)
    setSelected(new Set(keep.map((r) => r.storeId)))
    setResult(null)
    setPlan(null)
    setStep('grid')
  }

  // ───────────────────────────── UI ─────────────────────────────

  const stepLabels: Array<[Step, string]> = [
    ['setup', '1. อุปกรณ์และสาขา'],
    ['grid', '2. ข้อมูลแต่ละสาขา'],
    ['preview', '3. ตรวจสอบ'],
    ['done', '4. ผลการบันทึก'],
  ]

  const SummaryCards = ({ s, saved }: { s: Summary; saved?: boolean }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { icon: PlusCircle, label: saved ? 'สร้างใหม่แล้ว' : 'สร้างใหม่', value: s.create, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
        { icon: RefreshCw, label: saved ? 'อัปเดตแล้ว' : 'อัปเดต', value: s.update, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
        { icon: MinusCircle, label: 'ข้อมูลเหมือนเดิม', value: s.unchanged, color: 'text-gray-400', bg: 'bg-slate-700/30 border-slate-600/50' },
        { icon: XCircle, label: saved ? 'ไม่สำเร็จ' : 'มีปัญหา (ข้าม)', value: s.error, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
      ].map(({ icon: Icon, label, value, color, bg }) => (
        <div key={label} className={`rounded-xl border p-4 ${bg}`}>
          <div className={`flex items-center gap-2 text-sm ${color}`}>
            <Icon className="w-4 h-4" />
            {label}
          </div>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
      ))}
    </div>
  )

  const ProblemList = ({ list }: { list: ResultRow[] }) =>
    list.length === 0 ? (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <CheckCircle className="w-4 h-4" /> ไม่มีรายการที่มีปัญหา
      </div>
    ) : (
      <div className="rounded-xl border border-red-500/30 overflow-hidden">
        <div className="px-4 py-2 bg-red-500/10 text-red-300 text-sm font-medium">รายการที่มีปัญหา ({list.length})</div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-700/50">
          {list.map((r) => (
            <div key={r.index} className="px-4 py-2 text-sm">
              <span className="text-white font-medium">{formatStore({ storeCode: r.storeCode, name: r.storeName })}</span>
              <span className="text-red-300 ml-2">{r.message}</span>
            </div>
          ))}
        </div>
      </div>
    )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/dashboard/equipment')} className="p-2 rounded-lg hover:bg-slate-700/50 text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-400" /> เพิ่มอุปกรณ์ให้หลายสาขา
          </h1>
          <p className="text-gray-400 mt-1 text-sm">เพิ่มหรืออัปเดตอุปกรณ์ 1 ชนิดให้หลายสาขาพร้อมกัน — จับคู่เครื่องเดิมด้วย Device Name ในแต่ละสาขา</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-wrap gap-2">
        {stepLabels.map(([key, label]) => (
          <span
            key={key}
            className={`px-3 py-1 rounded-full text-xs border ${step === key ? 'text-white border-transparent' : 'text-gray-400 border-slate-600'}`}
            style={step === key ? { backgroundColor: themeHighlight } : undefined}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Step 1 ── */}
      {step === 'setup' && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Device Name <span className="text-red-400">*</span></label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Router, POS#2, CCTV#1" />
              <p className="text-xs text-gray-500 mt-1">สาขาที่มีชื่อนี้อยู่แล้ว = อัปเดตเครื่องเดิม · ยังไม่มี = สร้างใหม่</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category <span className="text-red-400">*</span></label>
              <select className={`${selectCls} w-full`} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— เลือก Category —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-white font-semibold">เลือกสาขา <span className="text-blue-400">({selected.size})</span></h2>
              <div className="flex gap-2">
                <button onClick={() => selectFiltered(true)} className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white">เลือกทั้งหมดที่แสดง ({filteredStores.length})</button>
                <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white">ล้าง</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input className={`${inputCls} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหารหัส / ชื่อสาขา" />
                  </div>
                  <select className={selectCls} value={province} onChange={(e) => setProvince(e.target.value)}>
                    <option value="">ทุกจังหวัด</option>
                    {provinces.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                  {filteredStores.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/30 cursor-pointer text-sm">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-blue-500" />
                      <span className="text-white">{formatStore(s)}</span>
                      {s.province && <span className="text-gray-500 text-xs ml-auto">{s.province}</span>}
                    </label>
                  ))}
                  {filteredStores.length === 0 && <p className="px-3 py-6 text-center text-gray-500 text-sm">ไม่พบสาขา</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-300">วางรายการ Store Code (จาก Excel ได้)</label>
                <textarea
                  className={`${inputCls} h-40 font-mono`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'201\n202\n305'}
                />
                <button onClick={addPastedCodes} className="w-full px-3 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
                  เพิ่มสาขาจากรายการ
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={goToGrid}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: themeHighlight }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} ถัดไป: กรอกข้อมูลแต่ละสาขา
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 'grid' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              ตารางนี้คือค่าที่จะบันทึก — <b>ช่องที่ว่างจะลบข้อมูลเดิม</b>ของเครื่องนั้น (ยกเว้นสถานะ: ว่าง = คงเดิม / ACTIVE สำหรับเครื่องใหม่).
              ระบบใส่ค่าปัจจุบันของเครื่องเดิมไว้ให้แล้ว · <b>{name}</b> · {category}
            </div>
          </div>

          {/* Fill a whole column */}
          <div className="glass-card rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {([
              ['brand', 'Brand', 'text'],
              ['model', 'Model', 'text'],
              ['purchaseDate', 'Purchase Date', 'date'],
              ['warrantyExpiry', 'Warranty Expiry', 'date'],
            ] as const).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <div className="flex gap-1">
                  <input type={type} className={inputCls} value={fill[key]} onChange={(e) => setFill((f) => ({ ...f, [key]: e.target.value }))} />
                  <button onClick={() => fillColumn(key)} className="px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs whitespace-nowrap">ทุกแถว</button>
                </div>
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <div className="flex gap-1">
                <select className={`${selectCls} w-full`} value={fill.status} onChange={(e) => setFill((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">คงเดิม</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.value}</option>
                  ))}
                </select>
                <button onClick={() => fillColumn('status')} className="px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs whitespace-nowrap">ทุกแถว</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadExcel} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">
              <Download className="w-4 h-4" /> ดาวน์โหลดเป็น Excel
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">
              <Upload className="w-4 h-4" /> อัปโหลด Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && uploadExcel(e.target.files[0])} />
            <span className="text-xs text-gray-500">ดาวน์โหลดไฟล์นี้ไปกรอก แล้วอัปโหลดกลับ — จับคู่ด้วย Store Code</span>
          </div>

          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 text-gray-300 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">สาขา ({rows.length})</th>
                  <th className="px-2 py-2 text-left">Serial Number</th>
                  <th className="px-2 py-2 text-left">IP Address</th>
                  <th className="px-2 py-2 text-left">Brand</th>
                  <th className="px-2 py-2 text-left">Model</th>
                  <th className="px-2 py-2 text-left">Purchase</th>
                  <th className="px-2 py-2 text-left">Warranty</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rows.map((r) => (
                  <tr key={r.storeId} className="hover:bg-slate-700/20">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="text-white text-xs">{formatStore({ storeCode: r.storeCode, name: r.storeName })}</div>
                      <div className={`text-[10px] ${r.state === 'new' ? 'text-green-400' : r.state === 'existing' ? 'text-blue-400' : 'text-red-400'}`}>
                        {r.state === 'new' ? 'ใหม่' : r.state === 'existing' ? 'มีเครื่องเดิม' : 'ชื่อซ้ำหลายเครื่อง — จะถูกข้าม'}
                      </div>
                    </td>
                    {(['serialNumber', 'ipAddress', 'brand', 'model'] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5">
                        <input className={cellCls} value={r[k]} onChange={(e) => updateRow(r.storeId, k, e.target.value)} />
                      </td>
                    ))}
                    {(['purchaseDate', 'warrantyExpiry'] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5">
                        <input type="date" className={cellCls} value={r[k]} onChange={(e) => updateRow(r.storeId, k, e.target.value)} />
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <select
                        className="bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-white text-xs [&>option]:bg-slate-800 [&>option]:text-white"
                        value={r.status}
                        onChange={(e) => updateRow(r.storeId, 'status', e.target.value)}
                      >
                        <option value="">{r.state === 'new' ? 'ACTIVE' : 'คงเดิม'}</option>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.value}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep('setup')} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">ย้อนกลับ</button>
            <button
              onClick={runPreview}
              disabled={busy || rows.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: themeHighlight }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} ตรวจสอบก่อนบันทึก
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 'preview' && plan && (
        <div className="space-y-4">
          <SummaryCards s={plan.summary} />
          <ProblemList list={plan.rows.filter((r) => r.action === 'error')} />
          <div className="flex justify-between gap-2">
            <button onClick={() => setStep('grid')} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">กลับไปแก้ไข</button>
            <button
              onClick={runApply}
              disabled={busy || plan.summary.create + plan.summary.update === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: themeHighlight }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              ยืนยันบันทึก ({plan.summary.create + plan.summary.update} รายการ)
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4 ── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <SummaryCards s={result.summary} saved />
          <ProblemList list={result.rows.filter((r) => r.action === 'error')} />
          <div className="flex flex-wrap justify-end gap-2">
            {result.summary.error > 0 && (
              <button onClick={fixProblems} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">
                แก้ไขเฉพาะรายการที่มีปัญหา
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard/equipment')}
              className="px-5 py-2.5 rounded-lg text-white text-sm hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              ไปหน้า Equipment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
