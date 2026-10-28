'use client'

// Profile › Security — link this account to a Google account (sign in with Google), or unlink it.
// Linking is a browser round trip: signed-in ticket → /api/auth/google/start → Google → back to
// /dashboard/profile?google=<result> (backend google-auth.service.ts).

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Link2, Unlink } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmDialog'
import GoogleIcon from '@/components/GoogleIcon'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

const RESULTS: Record<string, { text: string; ok?: boolean }> = {
  linked: { text: 'เชื่อมบัญชี Google แล้ว — เข้าสู่ระบบด้วย Google ได้ทันที', ok: true },
  taken: { text: 'บัญชี Google นี้ผูกกับผู้ใช้อื่นในระบบอยู่แล้ว' },
  expired: { text: 'หมดเวลาเชื่อมบัญชี กรุณากดเชื่อมบัญชี Google อีกครั้ง' },
  cancelled: { text: 'ยกเลิกการเชื่อมบัญชี Google' },
  error: { text: 'เชื่อมบัญชี Google ไม่สำเร็จ กรุณาลองใหม่' },
  not_configured: { text: 'Server นี้ยังไม่ได้ตั้งค่า Google Sign-In (Settings › Google Sign-In)' },
}

export default function GoogleAccountCard({ googleEmail, onChanged }: { googleEmail?: string | null; onChanged: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const { confirm, dialog } = useConfirm()
  const handled = useRef(false)

  useEffect(() => {
    fetch(`${API_URL}/settings/public/branding`)
      .then((r) => r.json())
      .then((b) => setEnabled(!!b?.googleEnabled))
      .catch(() => setEnabled(false))
  }, [])

  // Back from Google: ?google=<result>
  useEffect(() => {
    if (handled.current) return
    const params = new URLSearchParams(window.location.search)
    const result = params.get('google')
    if (!result) return
    handled.current = true
    params.delete('google')
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`)
    const msg = RESULTS[result] || RESULTS.error
    if (msg.ok) toast.success(msg.text, { duration: 6000 })
    else toast.error(msg.text, { duration: 6000 })
    if (result === 'linked') onChanged()
  }, [onChanged])

  const link = async () => {
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(`${API_URL}/auth/google/link-ticket`, {}, { headers: { Authorization: `Bearer ${token}` } })
      window.location.href = `${API_URL}/auth/google/start?ticket=${encodeURIComponent(res.data.ticket)}`
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เริ่มเชื่อมบัญชี Google ไม่สำเร็จ')
      setBusy(false)
    }
  }

  const unlink = async () => {
    const ok = await confirm({
      title: 'ยกเลิกการเชื่อมบัญชี Google?',
      message: `จะเข้าสู่ระบบด้วย ${googleEmail} ไม่ได้อีก (ยังเข้าด้วยอีเมลและรหัสผ่านได้ตามเดิม)`,
      confirmLabel: 'ยกเลิกการเชื่อม',
      variant: 'warning',
    })
    if (!ok) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/auth/google/link`, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('ยกเลิกการเชื่อมบัญชี Google แล้ว')
      onChanged()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ยกเลิกการเชื่อมไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  // Hide entirely on servers without Google Sign-In (unless an old link still exists)
  if (enabled === null || (!enabled && !googleEmail)) return null

  return (
    <div className="glass-card p-6 rounded-2xl">
      {dialog}
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <GoogleIcon /> บัญชี Google
      </h3>
      <p className="text-xs text-gray-500 mb-4">เข้าสู่ระบบด้วยปุ่ม &quot;เข้าสู่ระบบด้วย Google&quot; แทนการพิมพ์รหัสผ่าน</p>

      {googleEmail ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
            <Link2 className="w-5 h-5 text-green-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">เชื่อมอยู่กับ</p>
              <p className="text-sm text-gray-200 truncate">{googleEmail}</p>
            </div>
          </div>
          <button
            onClick={unlink}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-gray-300 border border-slate-600 hover:bg-slate-700/50 disabled:opacity-50"
          >
            <Unlink className="w-4 h-4" /> ยกเลิกการเชื่อม
          </button>
        </div>
      ) : (
        <button
          onClick={link}
          disabled={busy || !enabled}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-white text-slate-700 font-medium hover:bg-slate-100 transition disabled:opacity-60"
        >
          {busy ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <GoogleIcon />}
          เชื่อมบัญชี Google
        </button>
      )}
    </div>
  )
}
