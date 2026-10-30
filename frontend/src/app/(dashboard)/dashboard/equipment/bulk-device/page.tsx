// app/(dashboard)/dashboard/equipment/bulk-device/page.tsx
// Devices for many stores from one Excel file — IT_MANAGER only.
// Download a template listing the stores → fill Device Name + details → upload → check → save.
// Blank cell = keep the old value, "-" = clear it. A store may have several rows (one per device).
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
  CheckCircle,
  PlusCircle,
  RefreshCw,
  MinusCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react'
import { formatStore } from '@/utils/formatStore'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface StoreItem {
  id: number
  storeCode: string
  name: string
  province?: string | null
}

interface ImportRow {
  row: number // Excel row number
  storeCode: string
  storeName: string
  name: string
  category: string
  brand: string
  model: string
  serialNumber: string
  ipAddress: string
  purchaseDate: string
  warrantyExpiry: string
  status: string
}

type Action = 'create' | 'update' | 'unchanged' | 'error'
interface Summary { create: number; update: number; unchanged: number; error: number }
interface ResultRow { index: number; row: number | null; storeCode: string; storeName: string | null; name: string; action: Action; message?: string }
interface PlanResult { summary: Summary; rows: ResultRow[] }

type Step = 'start' | 'preview' | 'done'

// Template columns — the upload finds them by header text, so users may reorder them
const COLUMNS: Array<{ key: keyof ImportRow; header: string; width: number }> = [
  { key: 'storeCode', header: 'Store Code', width: 12 },
  { key: 'storeName', header: 'Store Name', width: 30 },
  { key: 'name', header: 'Device Name', width: 20 },
  { key: 'category', header: 'Category', width: 14 },
  { key: 'brand', header: 'Brand', width: 14 },
  { key: 'model', header: 'Model', width: 18 },
  { key: 'serialNumber', header: 'Serial Number', width: 20 },
  { key: 'ipAddress', header: 'IP Address', width: 16 },
  { key: 'purchaseDate', header: 'Purchase Date (YYYY-MM-DD)', width: 16 },
  { key: 'warrantyExpiry', header: 'Warranty Expiry (YYYY-MM-DD)', width: 16 },
  { key: 'status', header: 'Status', width: 12 },
]
const TEXT_COLUMNS: Array<keyof ImportRow> = ['storeCode', 'serialNumber', 'ipAddress']
const STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'RETIRED']

const selectCls =
  'bg-slate-800 border border-slate-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white'
const inputCls =
  'w-full bg-slate-800 border border-slate-600 rounded-lg text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
const apiError = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

/** Excel dates → YYYY-MM-DD (accepts d/m/yyyy and Buddhist years); "-" and other text pass through */
function toIsoDay(v: string): string {
  const s = (v ?? '').toString().trim()
  if (!s || s === '-') return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    let y = Number(m[3])
    if (y > 2400) y -= 543
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return s // left as typed — the server reports it
}

/** One sheet of rows → workbook download; code / S/N / IP stay text so Excel does not turn them into numbers */
function writeSheet(rows: Array<Record<string, string | number>>, extraHeader: string[] = [], sheets: Array<[string, string[][]]> = [], file: string) {
  const header = [...COLUMNS.map((c) => c.header), ...extraHeader]
  const aoa = [header, ...rows.map((r) => [...COLUMNS.map((c) => r[c.key] ?? ''), ...extraHeader.map((h) => r[h] ?? '')])]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [...COLUMNS.map((c) => ({ wch: c.width })), ...extraHeader.map(() => ({ wch: 50 }))]
  const textCols = COLUMNS.map((c, i) => (TEXT_COLUMNS.includes(c.key) ? i : -1)).filter((i) => i >= 0)
  for (let R = 1; R <= rows.length + 200; R++) {
    for (const C of textCols) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C })
      ws[ref] = ws[ref] ? { ...ws[ref], t: 's', z: '@' } : { t: 's', v: '', z: '@' }
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 200, c: header.length - 1 } })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Devices')
  for (const [name, data] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name)
  XLSX.writeFile(wb, file)
}

export default function BulkDevicePage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('start')
  const [busy, setBusy] = useState(false)

  const [stores, setStores] = useState<StoreItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')
  const [pasteText, setPasteText] = useState('')

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [skipped, setSkipped] = useState(0)
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
      (s) => (!province || s.province === province) && (!q || s.storeCode.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
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
    else toast.success(`เลือกเพิ่ม ${codes.length} สาขา`)
  }

  const templateStores = selected.size ? stores.filter((s) => selected.has(s.id)) : stores

  const downloadTemplate = () => {
    const list = [...templateStores].sort((a, b) => a.storeCode.localeCompare(b.storeCode, undefined, { numeric: true }))
    const guide: string[][] = [
      ['วิธีกรอก'],
      ['1 แถว = อุปกรณ์ 1 เครื่องของสาขานั้น — จะเพิ่มหลายเครื่องในสาขาเดียว ให้คัดลอกแถวสาขาเพิ่มแล้วใส่ Device Name อื่น'],
      ['แถวที่ไม่กรอก Device Name ระบบข้าม (สาขานั้นไม่เปลี่ยน)'],
      ['Device Name ตรงกับเครื่องที่มีอยู่ในสาขา = อัปเดตเครื่องเดิม · ยังไม่มี = สร้างใหม่ (ชื่อซ้ำในสาขาเดียวกันไม่ได้ เช่นใช้ POS#1, POS#2)'],
      ['ช่องที่เว้นว่าง = คงค่าเดิม · พิมพ์ - (ขีด) = ลบค่านั้นออก'],
      ['อุปกรณ์ใหม่ต้องระบุ Category · Status ว่าง = คงเดิม (เครื่องใหม่ = ACTIVE)'],
      ['วันที่ใช้รูปแบบ YYYY-MM-DD (รับ วว/ดด/ปปปป และปี พ.ศ. ได้)'],
      [],
      ['Category ที่ใช้ได้'],
      ...categories.map((c) => [c]),
      [],
      ['Status ที่ใช้ได้'],
      ...STATUSES.map((s) => [s]),
    ]
    writeSheet(
      list.map((s) => ({ storeCode: s.storeCode, storeName: s.name })),
      [],
      [['วิธีกรอก', guide]],
      `equipment-import-template-${list.length}-stores.xlsx`,
    )
  }

  const readFile = async (file: File) => {
    try {
      // Raw values: a real Excel date comes back as its serial number (formatted text would follow the
      // user's locale, e.g. "1/15/27"), and a long numeric S/N keeps all its digits
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1, raw: true, defval: '' })
      const headerIdx = data.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === 'store code'))
      if (headerIdx < 0) return toast.error('ไม่พบหัวคอลัมน์ "Store Code" — ใช้ไฟล์ Template จากหน้านี้')
      const header = data[headerIdx].map((h) => String(h).trim().toLowerCase())
      const col = (key: keyof ImportRow) => {
        const title = COLUMNS.find((c) => c.key === key)!.header.split(' (')[0].toLowerCase()
        return header.findIndex((h) => h.startsWith(title))
      }
      if (col('name') < 0) return toast.error('ไม่พบคอลัมน์ "Device Name"')

      const parsed: ImportRow[] = []
      let blank = 0
      data.slice(headerIdx + 1).forEach((line, i) => {
        const get = (key: keyof ImportRow) => {
          const c = col(key)
          const v = c < 0 ? '' : line[c]
          if (typeof v === 'number' && (key === 'purchaseDate' || key === 'warrantyExpiry')) return XLSX.SSF.format('yyyy-mm-dd', v)
          return String(v ?? '').trim()
        }
        if (!get('name')) {
          if (get('storeCode')) blank++
          return
        }
        parsed.push({
          row: headerIdx + 2 + i,
          storeCode: get('storeCode'),
          storeName: get('storeName'),
          name: get('name'),
          category: get('category'),
          brand: get('brand'),
          model: get('model'),
          serialNumber: get('serialNumber'),
          ipAddress: get('ipAddress'),
          purchaseDate: toIsoDay(get('purchaseDate')),
          warrantyExpiry: toIsoDay(get('warrantyExpiry')),
          status: get('status').toUpperCase(),
        })
      })
      if (!parsed.length) return toast.error('ไม่พบแถวที่กรอก Device Name ในไฟล์')

      setFileName(file.name)
      setRows(parsed)
      setSkipped(blank)
      await runPreview(parsed)
    } catch (err) {
      console.error(err)
      toast.error('อ่านไฟล์ Excel ไม่สำเร็จ')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const payload = (list: ImportRow[]) => ({
    rows: list.map(({ storeName, ...r }) => r),
  })

  const runPreview = async (list: ImportRow[]) => {
    setBusy(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/equipment/bulk-device/preview`, payload(list), { headers: authHeader() })
      setPlan(res.data)
      setResult(null)
      setStep('preview')
    } catch (err: any) {
      toast.error(apiError(err, 'ตรวจสอบไฟล์ไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  const runApply = async () => {
    setBusy(true)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/equipment/bulk-device/apply`, payload(rows), { headers: authHeader() })
      setResult(res.data)
      setStep('done')
      toast.success('บันทึกเรียบร้อย')
    } catch (err: any) {
      toast.error(apiError(err, 'บันทึกไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  /** The rows that had problems, with the reason in an extra column — fix and upload again */
  const downloadProblems = (res: PlanResult) => {
    const problems = res.rows.filter((r) => r.action === 'error')
    writeSheet(
      problems.map((p) => ({ ...rows[p.index], 'ปัญหา': p.message ?? '' })),
      ['ปัญหา'],
      [],
      `equipment-import-problems-${problems.length}.xlsx`,
    )
  }

  const reset = () => {
    setStep('start')
    setRows([])
    setPlan(null)
    setResult(null)
    setFileName('')
  }

  // ───────────────────────────── UI ─────────────────────────────

  const SummaryCards = ({ s, saved }: { s: Summary; saved?: boolean }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { icon: PlusCircle, label: saved ? 'สร้างใหม่แล้ว' : 'สร้างใหม่', value: s.create, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
        { icon: RefreshCw, label: saved ? 'อัปเดตแล้ว' : 'อัปเดต', value: s.update, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
        { icon: MinusCircle, label: 'ข้อมูลเหมือนเดิม', value: s.unchanged, color: 'text-gray-400', bg: 'bg-slate-700/30 border-slate-600/50' },
        { icon: XCircle, label: saved ? 'ไม่สำเร็จ' : 'มีปัญหา (จะข้าม)', value: s.error, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
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

  const ProblemList = ({ res }: { res: PlanResult }) => {
    const list = res.rows.filter((r) => r.action === 'error')
    if (list.length === 0) {
      return (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" /> ไม่มีรายการที่มีปัญหา
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-red-500/30 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-red-500/10">
          <span className="text-red-300 text-sm font-medium">รายการที่มีปัญหา ({list.length})</span>
          <button onClick={() => downloadProblems(res)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs">
            <Download className="w-3.5 h-3.5" /> ดาวน์โหลดเฉพาะแถวที่มีปัญหา
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-700/50">
          {list.map((r) => (
            <div key={r.index} className="px-4 py-2 text-sm">
              <span className="text-gray-500 text-xs mr-2">แถว {r.row ?? '-'}</span>
              <span className="text-white font-medium">{formatStore({ storeCode: r.storeCode, name: r.storeName }, r.storeCode || '-')}</span>
              {r.name && <span className="text-blue-300 ml-2">{r.name}</span>}
              <span className="text-red-300 ml-2">— {r.message}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/dashboard/equipment')} className="p-2 rounded-lg hover:bg-slate-700/50 text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-400" /> นำเข้าอุปกรณ์หลายสาขา
          </h1>
          <p className="text-gray-400 mt-1 text-sm">ดาวน์โหลด Template รายชื่อสาขา → กรอก Device Name, Brand, Model, S/N ฯลฯ → อัปโหลด → ตรวจสอบ → บันทึก</p>
        </div>
      </div>

      {step === 'start' && (
        <div className="space-y-6">
          {/* 1. Template */}
          <div className="glass-card rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-white font-semibold">1. ดาวน์โหลด Template</h2>
                <p className="text-gray-400 text-xs mt-1">
                  ไม่เลือกสาขา = ทุกสาขา ({stores.length}) · เลือกไว้ <span className="text-blue-400">{selected.size}</span> สาขา
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                disabled={!stores.length}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: themeHighlight }}
              >
                <FileSpreadsheet className="w-4 h-4" /> ดาวน์โหลด Template ({templateStores.length} สาขา)
              </button>
            </div>

            <details className="rounded-lg border border-slate-700">
              <summary className="cursor-pointer px-3 py-2 text-sm text-gray-300">เลือก / กรองสาขา (ไม่บังคับ)</summary>
              <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <div className="flex gap-2">
                    <button onClick={() => selectFiltered(true)} className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white">เลือกทั้งหมดที่แสดง ({filteredStores.length})</button>
                    <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white">ล้าง</button>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
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
                  <label className="block text-sm text-gray-300">วางรายการ Store Code</label>
                  <textarea className={`${inputCls} h-36 font-mono`} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'201\n202\n305'} />
                  <button onClick={addPastedCodes} className="w-full px-3 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-white">เลือกสาขาจากรายการ</button>
                </div>
              </div>
            </details>
          </div>

          {/* 2. Upload */}
          <div className="glass-card rounded-xl p-4 sm:p-6 space-y-3">
            <h2 className="text-white font-semibold">2. กรอกแล้วอัปโหลด</h2>
            <ul className="text-sm text-gray-300 space-y-1 list-disc pl-5">
              <li>1 แถว = อุปกรณ์ 1 เครื่อง · สาขาที่มีหลายเครื่อง คัดลอกแถวเพิ่มแล้วใส่ Device Name อื่น · แถวที่ไม่กรอก Device Name ระบบข้าม</li>
              <li>Device Name ตรงกับเครื่องที่มีในสาขา = <b>อัปเดตเครื่องเดิม</b> · ยังไม่มี = <b>สร้างใหม่</b> (ต้องระบุ Category)</li>
              <li>ช่องว่าง = <b>คงค่าเดิม</b> · พิมพ์ <code className="px-1 bg-slate-700 rounded">-</code> = <b>ลบค่านั้น</b></li>
            </ul>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} อัปโหลดไฟล์ Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {step === 'preview' && plan && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            ไฟล์ <span className="text-white">{fileName}</span> · {rows.length} แถวที่กรอก Device Name{skipped ? ` · ข้ามแถวที่ไม่ได้กรอก ${skipped} แถว` : ''}
          </p>
          <SummaryCards s={plan.summary} />
          <ProblemList res={plan} />
          <div className="flex flex-wrap justify-between gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">อัปโหลดไฟล์ใหม่</button>
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

      {step === 'done' && result && (
        <div className="space-y-4">
          <SummaryCards s={result.summary} saved />
          <ProblemList res={result} />
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">นำเข้าไฟล์อื่น</button>
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
