'use client'

// Settings › Google Sign-In — this server's OAuth client (SUPER_ADMIN only).
// The secret is write-only: the backend never sends it back, only whether one is saved.
import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Copy, Save, Loader2, ExternalLink } from 'lucide-react'
import GoogleIcon from '@/components/GoogleIcon'

interface GoogleSettings {
  clientId: string
  hasSecret: boolean
  baseUrl: string
  redirectUri: string
  enabled: boolean
}

const API = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
const inputCls = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function GoogleSignInTab() {
  const [cfg, setCfg] = useState<GoogleSettings | null>(null)
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (s: GoogleSettings) => {
    setCfg(s)
    setClientId(s.clientId)
    setBaseUrl(s.baseUrl)
    setSecret('')
  }

  useEffect(() => {
    axios.get(`${API()}/settings/google`, { headers: auth() })
      .then((res) => apply(res.data))
      .catch(() => toast.error('โหลดการตั้งค่า Google Sign-In ไม่สำเร็จ'))
  }, [])

  const save = async (body: Record<string, string>, ok: string) => {
    setSaving(true)
    try {
      const res = await axios.post(`${API()}/settings/google`, body, { headers: auth() })
      apply(res.data)
      toast.success(ok)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const onSave = () => {
    const body: Record<string, string> = { clientId: clientId.trim(), baseUrl: baseUrl.trim() }
    if (secret.trim()) body.clientSecret = secret.trim()
    save(body, 'บันทึกการตั้งค่า Google Sign-In แล้ว')
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success('คัดลอกแล้ว')).catch(() => toast(text))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleIcon />
        <h2 className="text-lg font-semibold text-white">Google Sign-In</h2>
        {cfg && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${cfg.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
            {cfg.enabled ? 'เปิดใช้งาน' : 'ยังไม่ตั้งค่า'}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400">
        ให้ผู้ใช้เข้าสู่ระบบ / สมัครด้วยบัญชี Google — บัญชีที่อีเมลตรงกับผู้ใช้เดิมจะเชื่อมให้อัตโนมัติ, ผู้ใช้ใหม่จะรอ IT Manager อนุมัติ
        และผู้ใช้เชื่อมบัญชี Google เองได้ที่ Profile › Security
      </p>

      {/* Redirect URI to register in Google Cloud */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
        <p className="text-sm text-white font-medium">Authorized redirect URI (ใส่ใน Google Cloud Console)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate text-xs text-sky-300 bg-slate-900/60 px-3 py-2 rounded-lg">{cfg?.redirectUri || '…'}</code>
          <button onClick={() => cfg && copy(cfg.redirectUri)} className="p-2 rounded-lg border border-slate-600 text-gray-300 hover:bg-slate-700/50" title="คัดลอก">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">ต้องตรงกับ URL ที่ผู้ใช้เปิดเข้าระบบทุกตัวอักษร (https / โดเมน) — ถ้าไม่ตรง แก้ที่ช่อง &quot;Server URL&quot; ด้านล่าง</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Client ID</label>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls} placeholder="xxxxxxxx.apps.googleusercontent.com" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Client Secret</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className={inputCls}
            placeholder={cfg?.hasSecret ? '•••••••• (บันทึกไว้แล้ว — เว้นว่างเพื่อใช้ค่าเดิม)' : 'GOCSPX-…'}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Server URL <span className="text-gray-500">(ไม่บังคับ)</span></label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={inputCls} placeholder="เว้นว่าง = ใช้ APP_URL ของ server เช่น https://ws.x-tremeservice.co.th" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-700">
        {cfg?.enabled && (
          <button
            onClick={() => save({ clientId: '', clientSecret: '' }, 'ปิด Google Sign-In แล้ว')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm text-gray-300 border border-slate-600 hover:bg-slate-700/50 disabled:opacity-50"
          >
            ปิด Google Sign-In
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving || !clientId.trim() || (!cfg?.hasSecret && !secret.trim())}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: 'var(--theme-highlight)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
        </button>
      </div>

      {/* How to get the client */}
      <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 text-sm text-slate-300 space-y-1.5">
        <p className="text-white font-medium">วิธีสร้าง OAuth Client (ครั้งแรก)</p>
        <ol className="list-decimal list-inside space-y-1 text-slate-400">
          <li>
            เปิด{' '}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-0.5">
              Google Cloud Console › Credentials <ExternalLink className="w-3 h-3" />
            </a>{' '}
            (ใช้โปรเจกต์เดียวกับ RSM ได้)
          </li>
          <li>OAuth consent screen: User type = External, Publishing status = <b>In production</b></li>
          <li>Create Credentials › OAuth client ID › Web application</li>
          <li>Authorized redirect URIs: วาง URI ด้านบน (1 server = 1 บรรทัด, client เดียวใช้หลาย server ได้)</li>
          <li>คัดลอก Client ID / Client Secret มาใส่ที่นี่ แล้วกดบันทึก</li>
        </ol>
      </div>
    </div>
  )
}
