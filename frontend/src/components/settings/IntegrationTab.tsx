'use client'

// Settings › Integration (SUPER_ADMIN) — Integration API v1: API keys for other systems (e.g. RSM),
// the RSM URL for the "เบิกอะไหล่ (RSM)" button, and the recent call log.
// Allowed domain is computed from this server's own URL (read-only here).
import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plug, KeyRound, Copy, Plus, Ban, Save, Loader2, RefreshCw, ShieldCheck, ShieldOff, X } from 'lucide-react'
import { appConfirm } from '@/components/ConfirmDialog'

interface ApiKey {
  id: number
  name: string
  callerUrl: string
  keyPrefix: string
  scopes: string[]
  createdByName: string | null
  createdAt: string
  lastUsedAt: string | null
  lastUsedIp: string | null
  revokedAt: string | null
}

interface Overview {
  baseUrl: string
  ownDomain: string | null
  enabled: boolean
  rsmUrl: string | null
  rsmUrlStored: string | null
  hasRsmKey: boolean
  scopes: string[]
  keys: ApiKey[]
}

interface AuditLog {
  id: number
  keyName: string | null
  method: string
  path: string
  status: number
  durationMs: number
  ip: string | null
  createdAt: string
}

const API = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
const inputCls = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
const SCOPE_LABEL: Record<string, string> = {
  'meta:read': 'meta:read — ตรวจการเชื่อมต่อ (ให้เสมอ)',
  'incidents:read': 'incidents:read — ใบงาน อาการ อุปกรณ์ อะไหล่ที่เปลี่ยน',
  'projects:read': 'projects:read — งาน Project (ติดตั้ง / ปิดร้าน) และอุปกรณ์ของสาขา',
  'stats:read': 'stats:read — ตัวเลขสรุปแจ้งซ่อม / เปลี่ยนอุปกรณ์ / เครื่องติดตั้ง ต่อเดือน (พยากรณ์ใน RSM)',
}

export default function IntegrationTab() {
  const [data, setData] = useState<Overview | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [rsmUrl, setRsmUrl] = useState('')
  const [savingRsm, setSavingRsm] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', callerUrl: '', incidents: true, projects: true, stats: true })
  const [rsmKey, setRsmKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)

  const load = () =>
    axios
      .get(`${API()}/integration/admin`, { headers: auth() })
      .then((res) => {
        setData(res.data)
        setRsmUrl(res.data.rsmUrlStored || '')
      })
      .catch(() => toast.error('โหลดการตั้งค่า Integration ไม่สำเร็จ'))

  const loadLogs = () => {
    setLoadingLogs(true)
    axios
      .get(`${API()}/integration/admin/logs`, { headers: auth() })
      .then((res) => setLogs(res.data))
      .catch(() => toast.error('โหลด Log ไม่สำเร็จ'))
      .finally(() => setLoadingLogs(false))
  }

  useEffect(() => {
    load()
    loadLogs()
  }, [])

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success('คัดลอกแล้ว')).catch(() => toast(text))
  }

  const saveRsm = async () => {
    setSavingRsm(true)
    try {
      await axios.put(`${API()}/integration/admin/rsm-url`, { rsmUrl: rsmUrl.trim() }, { headers: auth() })
      toast.success(rsmUrl.trim() ? 'บันทึก RSM URL แล้ว' : 'ล้าง RSM URL แล้ว — ซ่อนปุ่มเบิกอะไหล่')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSavingRsm(false)
    }
  }

  const createKey = async () => {
    setCreating(true)
    try {
      const res = await axios.post(
        `${API()}/integration/admin/keys`,
        {
          name: form.name.trim(),
          callerUrl: form.callerUrl.trim(),
          scopes: [
            ...(form.incidents ? ['incidents:read'] : []),
            ...(form.projects ? ['projects:read'] : []),
            ...(form.stats ? ['stats:read'] : []),
          ],
        },
        { headers: auth() },
      )
      setNewKey({ key: res.data.key, name: res.data.item.name })
      setShowCreate(false)
      setForm({ name: '', callerUrl: '', incidents: true, projects: true, stats: true })
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'สร้าง API Key ไม่สำเร็จ')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (k: ApiKey) => {
    const ok = await appConfirm({
      title: 'ยกเลิก API Key',
      message: `ยกเลิก Key "${k.name}" (${k.keyPrefix}…) ทันที? ระบบที่ใช้ Key นี้จะเรียกข้อมูลไม่ได้อีก และย้อนกลับไม่ได้`,
      confirmLabel: 'ยกเลิก Key',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await axios.post(`${API()}/integration/admin/keys/${k.id}/revoke`, {}, { headers: auth() })
      toast.success('ยกเลิก Key แล้ว')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'ยกเลิกไม่สำเร็จ')
    }
  }

  const active = data?.keys.filter((k) => !k.revokedAt) ?? []
  const revoked = data?.keys.filter((k) => k.revokedAt) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Plug className="w-5 h-5 text-sky-400" />
        <h2 className="text-lg font-semibold text-white">Integration API</h2>
        {data && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${data.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
            {data.enabled ? 'เปิดใช้งานได้' : 'ปิดอยู่'}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400">
        ให้ระบบอื่นในบริษัท (เช่น RSM) ดึงข้อมูลใบงานแบบอ่านอย่างเดียวผ่าน <code className="text-sky-300">/api/integration/v1/</code> ด้วย API Key ของแต่ละระบบ
      </p>

      {/* Domain rule */}
      <div className={`rounded-xl p-4 border flex items-start gap-3 ${data?.enabled ? 'bg-slate-800/50 border-slate-700/50' : 'bg-amber-500/10 border-amber-500/30'}`}>
        {data?.enabled ? <ShieldCheck className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> : <ShieldOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
        <div className="text-sm min-w-0">
          {data?.enabled ? (
            <p className="text-white">
              เชื่อมได้เฉพาะ <span className="font-mono text-sky-300">https://*.{data.ownDomain}</span>
            </p>
          ) : (
            <p className="text-amber-200">
              Integration ปิดอยู่ — URL ของเครื่องนี้ต้องเป็น https และเป็นชื่อโดเมน (ไม่ใช่ IP / localhost)
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1 break-all">
            คำนวณจาก URL ของเครื่องนี้: {data?.baseUrl || '-'} (APP_URL ใน .env) — แก้ไขในหน้านี้ไม่ได้
          </p>
        </div>
      </div>

      {/* New key — shown once */}
      {newKey && (
        <div className="rounded-xl p-4 border border-green-500/40 bg-green-500/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-green-300 font-medium">API Key ของ &quot;{newKey.name}&quot; — คัดลอกเก็บไว้ตอนนี้ ระบบจะไม่แสดงอีก</p>
            <button onClick={() => setNewKey(null)} className="p-1 text-gray-400 hover:text-white" title="ปิด"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 break-all text-xs text-white bg-slate-900/70 px-3 py-2 rounded-lg">{newKey.key}</code>
            <button onClick={() => copy(newKey.key)} className="p-2 rounded-lg border border-slate-600 text-gray-300 hover:bg-slate-700/50 shrink-0" title="คัดลอก">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* API keys */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-white font-medium flex items-center gap-2"><KeyRound className="w-4 h-4 text-sky-400" /> API Keys</h3>
          <button
            onClick={() => setShowCreate((v) => !v)}
            disabled={!data?.enabled}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> สร้าง API Key
          </button>
        </div>

        {showCreate && data && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">ชื่อผู้เรียก</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="เช่น RSM X-treme" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">URL ของผู้เรียก (X-Integration-Caller)</label>
              <input value={form.callerUrl} onChange={(e) => setForm({ ...form, callerUrl: e.target.value })} className={inputCls} placeholder={`https://rsm.${data.ownDomain ?? 'example.co.th'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-300 mb-1.5">สิทธิ์ (scope)</p>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <input type="checkbox" checked disabled className="rounded" /> {SCOPE_LABEL['meta:read']}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                <input type="checkbox" checked={form.incidents} onChange={(e) => setForm({ ...form, incidents: e.target.checked })} className="rounded" />
                {SCOPE_LABEL['incidents:read']}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer mt-1">
                <input type="checkbox" checked={form.projects} onChange={(e) => setForm({ ...form, projects: e.target.checked })} className="rounded" />
                {SCOPE_LABEL['projects:read']}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer mt-1">
                <input type="checkbox" checked={form.stats} onChange={(e) => setForm({ ...form, stats: e.target.checked })} className="rounded" />
                {SCOPE_LABEL['stats:read']}
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-gray-300 hover:bg-slate-700/50 text-sm">ยกเลิก</button>
              <button
                onClick={createKey}
                disabled={creating || !form.name.trim() || !form.callerUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} สร้าง Key
              </button>
            </div>
          </div>
        )}

        {active.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มี API Key</p>
        ) : (
          <div className="space-y-2">
            {active.map((k) => (
              <div key={k.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{k.name}</span>
                    <code className="text-[11px] text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded">{k.keyPrefix}…</code>
                  </div>
                  <p className="text-xs text-sky-300 break-all">{k.callerUrl}</p>
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{s}</span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    สร้าง {fmt(k.createdAt)}{k.createdByName ? ` โดย ${k.createdByName}` : ''} · ใช้ล่าสุด {fmt(k.lastUsedAt)}{k.lastUsedIp ? ` (${k.lastUsedIp})` : ''}
                  </p>
                </div>
                <button onClick={() => revoke(k)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm shrink-0">
                  <Ban className="w-4 h-4" /> ยกเลิก Key
                </button>
              </div>
            ))}
          </div>
        )}
        {revoked.length > 0 && (
          <details className="text-sm">
            <summary className="text-slate-500 cursor-pointer">Key ที่ยกเลิกแล้ว ({revoked.length})</summary>
            <div className="mt-2 space-y-1">
              {revoked.map((k) => (
                <p key={k.id} className="text-xs text-slate-500">
                  {k.name} · {k.keyPrefix}… · {k.callerUrl} · ยกเลิก {fmt(k.revokedAt)}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* RSM URL */}
      <div className="space-y-2 pt-4 border-t border-slate-700">
        <h3 className="text-white font-medium">RSM URL (ปุ่ม &quot;เบิกอะไหล่ (RSM)&quot; ในหน้าใบงาน)</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={rsmUrl}
            onChange={(e) => setRsmUrl(e.target.value)}
            className={inputCls}
            placeholder={data?.ownDomain ? `https://rsm.${data.ownDomain}` : 'ต้องเปิด Integration ก่อน'}
            disabled={!data?.enabled}
          />
          <button
            onClick={saveRsm}
            disabled={savingRsm || !data?.enabled}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 shrink-0"
          >
            {savingRsm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
          </button>
        </div>
        <p className="text-xs text-slate-500">เว้นว่าง = ไม่แสดงปุ่ม · ปุ่มแสดงเฉพาะใบงานที่ยังไม่ปิด / ยกเลิก (และปุ่ม &quot;เบิกอุปกรณ์ (RSM)&quot; ในงาน Project)</p>
      </div>

      {/* RIM → RSM: key that RSM issued for this server (pull issued S/N into install tasks) */}
      <div className="space-y-2 pt-4 border-t border-slate-700">
        <h3 className="text-white font-medium flex items-center gap-2">
          API Key จาก RSM (RIM เรียก RSM)
          {data && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${data.hasRsmKey ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {data.hasRsmKey ? 'บันทึกไว้แล้ว' : 'ยังไม่ได้ใส่'}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-500">
          ใช้ดึง S/N ที่ RSM เบิกให้งานติดตั้ง — สร้างใน RSM (ตั้งค่า › Integration) โดยตั้ง Caller = {data?.baseUrl || 'URL ของเครื่องนี้'} และ scope issues:read
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={rsmKey}
            onChange={(e) => setRsmKey(e.target.value)}
            className={inputCls}
            placeholder={data?.hasRsmKey ? '•••••••• (บันทึกไว้แล้ว — ใส่ใหม่เพื่อเปลี่ยน)' : 'rk_…'}
            autoComplete="new-password"
            disabled={!data?.enabled}
          />
          <button
            onClick={async () => {
              setSavingKey(true)
              try {
                await axios.put(`${API()}/integration/admin/rsm-key`, { rsmKey: rsmKey.trim() }, { headers: auth() })
                toast.success(rsmKey.trim() ? 'บันทึก API Key ของ RSM แล้ว' : 'ลบ API Key ของ RSM แล้ว')
                setRsmKey('')
                load()
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
              } finally {
                setSavingKey(false)
              }
            }}
            disabled={savingKey || !data?.enabled || (!rsmKey.trim() && !data?.hasRsmKey)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 shrink-0"
          >
            {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {rsmKey.trim() || !data?.hasRsmKey ? 'บันทึก' : 'ลบ Key'}
          </button>
          <button
            onClick={async () => {
              setTesting(true)
              try {
                const res = await axios.post(`${API()}/integration/admin/rsm-test`, {}, { headers: auth() })
                const m = res.data || {}
                toast.success(`เชื่อมต่อ RSM ได้: ${m.serverName || m.system || 'RSM'}${m.version ? ` v${m.version}` : ''} · scope ${(m.scopes || []).join(', ') || '-'}`, { duration: 6000 })
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'เชื่อมต่อ RSM ไม่ได้')
              } finally {
                setTesting(false)
              }
            }}
            disabled={testing || !data?.hasRsmKey || !data?.rsmUrl}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-600 text-gray-200 hover:bg-slate-700/50 text-sm disabled:opacity-50 shrink-0"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} ทดสอบการเชื่อมต่อ
          </button>
        </div>
      </div>

      {/* Call log */}
      <div className="space-y-2 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium">Log การเรียก (ล่าสุด 200 รายการ)</h3>
          <button onClick={loadLogs} className="p-2 rounded-lg border border-slate-600 text-gray-300 hover:bg-slate-700/50" title="โหลดใหม่">
            <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีการเรียก</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-left text-slate-400">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">เวลา</th>
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Path</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">ms</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-slate-700/40">
                    <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmt(l.createdAt)}</td>
                    <td className="px-3 py-1.5 text-white whitespace-nowrap">{l.keyName || '-'}</td>
                    <td className="px-3 py-1.5 text-slate-300 font-mono break-all">{l.method} {l.path}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded ${l.status < 300 ? 'bg-green-500/20 text-green-400' : l.status === 429 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 text-right">{l.durationMs}</td>
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{l.ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
