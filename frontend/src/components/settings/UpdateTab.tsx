'use client'

// Settings › อัปเดตระบบ (SUPER_ADMIN): the running version, a check of this server's release
// channel, a one-button install with live progress, and past updates. The work is done by the
// rim-updater container on the server (deploy/updater) — same flow as RSM.

import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  RefreshCw, Download, CheckCircle2, XCircle, Loader2, AlertTriangle, Server, History, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'

type StepKey = 'prepare' | 'backup' | 'pull' | 'backend' | 'frontend' | 'finish'
type StepStatus = 'pending' | 'running' | 'done' | 'failed'

interface VersionInfo { version: string | null; commit: string | null; buildDate: string | null }
interface ReleaseNote { version: string; date: string | null; changes: { type: string; text: string }[]; manual: string[] }
interface UpdateCheck {
  channel: string; available: boolean; current: VersionInfo; latest: VersionInfo
  releases: ReleaseNote[]; manual: string[]; checkedAt: string
}
interface HistoryEntry {
  startedAt: string | null; finishedAt: string | null; fromVersion: string | null; toVersion: string | null
  from: string | null; to: string | null; status: string; rolledBack: boolean; error: string | null; backup: string | null
}
interface UpdateStatus {
  channel: string; status: 'idle' | 'running' | 'done' | 'failed'
  steps: { key: StepKey; status: StepStatus }[]; log: string[]; error: string | null
  fromVersion: string | null; toVersion: string | null; backup: string | null
  startedAt: string | null; finishedAt: string | null; rollingBack: boolean; rolledBack: boolean
  history: HistoryEntry[]
}
interface Overview extends VersionInfo {
  configured: boolean; reachable: boolean; status: UpdateStatus | null; checking: boolean
  lastCheck: { at: string; result: UpdateCheck } | null; lastCheckError: string | null
}

const POLL_MS = 2000
const STEP_LABEL: Record<StepKey, string> = {
  prepare: 'ตรวจความพร้อม',
  backup: 'สำรองฐานข้อมูล',
  pull: 'ดาวน์โหลดเวอร์ชันใหม่',
  backend: 'เริ่ม Backend เวอร์ชันใหม่',
  frontend: 'เริ่ม Frontend + nginx',
  finish: 'ลบ image เก่า',
}
const CHANNEL_LABEL: Record<string, string> = { latest: 'Test (ทุก build)', stable: 'Stable (ผ่านการทดสอบแล้ว)' }
const CHANGE_STYLE: Record<string, string> = {
  new: 'bg-emerald-500/20 text-emerald-400',
  improved: 'bg-blue-500/20 text-blue-400',
  fixed: 'bg-amber-500/20 text-amber-400',
}
const CHANGE_LABEL: Record<string, string> = { new: 'NEW', improved: 'UPDATE', fixed: 'FIX' }

const api = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

export default function UpdateTab() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [manualDone, setManualDone] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadOverview = useCallback(async () => {
    const res = await axios.get<Overview>(`${api()}/system/update`, auth())
    setOverview(res.data)
    if (res.data.status) setStatus(res.data.status)
    return res.data
  }, [])

  // Follow a running install. Errors while the backend restarts are expected — keep polling.
  const followInstall = useCallback(() => {
    const tick = async () => {
      try {
        const res = await axios.get<UpdateStatus>(`${api()}/system/update/status`, auth())
        setRestarting(false)
        setStatus(res.data)
        if (res.data.status === 'running') {
          pollRef.current = setTimeout(tick, POLL_MS)
        } else {
          await loadOverview().catch(() => {})
        }
      } catch {
        setRestarting(true)
        pollRef.current = setTimeout(tick, POLL_MS)
      }
    }
    if (pollRef.current) clearTimeout(pollRef.current)
    tick()
  }, [loadOverview])

  useEffect(() => {
    loadOverview()
      .then((o) => { if (o.status?.status === 'running') followInstall() })
      .catch(() => toast.error('โหลดข้อมูลการอัปเดตไม่สำเร็จ'))
      .finally(() => setLoading(false))
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [loadOverview, followInstall])

  const runCheck = async () => {
    setChecking(true)
    try {
      await axios.post(`${api()}/system/update/check`, {}, auth())
      // The check pulls the channel image in the background — wait for it to finish.
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        const o = await loadOverview()
        if (!o.checking) {
          if (o.lastCheckError) toast.error(`ตรวจไม่สำเร็จ: ${o.lastCheckError}`)
          break
        }
      }
      setManualDone(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ตรวจหาเวอร์ชันใหม่ไม่สำเร็จ')
    } finally {
      setChecking(false)
    }
  }

  const install = async (check: UpdateCheck) => {
    const v = check.latest.version
    if (!v || !check.latest.commit) return
    if (!confirm(`ติดตั้ง RIM v${v}?\n\nระบบจะสำรองฐานข้อมูลก่อน แล้วรีสตาร์ท (ผู้ใช้จะเข้าใช้งานไม่ได้ประมาณ 1–3 นาที)\nถ้าติดตั้งไม่สำเร็จ ระบบจะกลับไปเวอร์ชันเดิมให้อัตโนมัติ`)) return
    try {
      await axios.post(`${api()}/system/update/install`, { version: v, commit: check.latest.commit }, auth())
      setShowLog(false)
      followInstall()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เริ่มติดตั้งไม่สำเร็จ')
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-10 rounded-2xl flex justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }
  if (!overview) return null

  const check = overview.lastCheck?.result ?? null
  const running = status?.status === 'running'
  const finished = status && (status.status === 'done' || status.status === 'failed') && status.toVersion
  const channel = status?.channel ?? check?.channel ?? null
  const lastLine = status?.log?.length ? status.log[status.log.length - 1] : ''

  return (
    <div className="space-y-6">
      {/* ── Current version ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/15 text-indigo-400"><Server className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-gray-400">เวอร์ชันที่ใช้งานอยู่</p>
              <p className="text-2xl font-bold text-white font-mono">v{overview.version}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Commit <span className="font-mono">{overview.commit ?? '-'}</span> · Build {overview.buildDate ?? '-'}
              </p>
            </div>
          </div>
          <div className="text-right space-y-1">
            {channel && (
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700 text-gray-200">
                ช่องทาง: {CHANNEL_LABEL[channel] ?? channel}
              </span>
            )}
            <p className={`text-xs ${overview.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
              {overview.reachable ? '● Updater พร้อมใช้งาน' : overview.configured ? '● ติดต่อ Updater ไม่ได้' : '● ยังไม่ได้ติดตั้ง Updater'}
            </p>
          </div>
        </div>

        {!overview.configured && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
            เครื่องนี้ยังไม่ได้ติดตั้ง Updater — ติดตั้งครั้งเดียวบน server ด้วย <code className="font-mono">deploy/updater/setup-updater.sh</code>
          </div>
        )}
      </div>

      {/* ── Install progress ── */}
      {(running || finished) && status && (
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {running
                ? `กำลังติดตั้ง v${status.toVersion}`
                : status.status === 'done'
                ? `ติดตั้ง v${status.toVersion} เรียบร้อย`
                : `ติดตั้ง v${status.toVersion} ไม่สำเร็จ`}
            </h3>
            {running && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
            {status.status === 'done' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
            {status.status === 'failed' && <XCircle className="w-6 h-6 text-red-400" />}
          </div>

          <ol className="space-y-2">
            {status.steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span className="w-5 flex justify-center">
                  {s.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {s.status === 'running' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                  {s.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                  {s.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-600" />}
                </span>
                <span className={s.status === 'pending' ? 'text-gray-500' : 'text-gray-200'}>
                  {i + 1}. {STEP_LABEL[s.key] ?? s.key}
                </span>
              </li>
            ))}
          </ol>

          {running && (
            <p className="mt-4 text-xs text-gray-400 font-mono truncate" title={lastLine}>
              {restarting ? 'ระบบกำลังรีสตาร์ท… หน้านี้จะติดตามต่อให้เอง' : status.rollingBack ? 'กำลังย้อนกลับเวอร์ชันเดิม…' : lastLine}
            </p>
          )}

          {status.status === 'done' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-gray-300">โหลดหน้าเว็บใหม่เพื่อใช้หน้าจอเวอร์ชันล่าสุด</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" /> โหลดหน้าใหม่
              </button>
            </div>
          )}

          {status.status === 'failed' && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm space-y-1">
              <p className="text-red-300">สาเหตุ: {status.error}</p>
              <p className={status.rolledBack ? 'text-emerald-300' : 'text-amber-300'}>
                {status.rolledBack ? `กลับไปใช้ v${status.fromVersion} เรียบร้อยแล้ว ระบบใช้งานได้ตามปกติ` : 'ย้อนกลับไม่ครบ — กรุณาตรวจสอบ server (docker logs rim-updater)'}
              </p>
              {status.backup && <p className="text-gray-400 text-xs">Backup ฐานข้อมูล: <span className="font-mono">{status.backup}</span></p>}
            </div>
          )}

          <button onClick={() => setShowLog((v) => !v)} className="mt-4 flex items-center gap-1 text-xs text-gray-400 hover:text-white">
            {showLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} รายละเอียด (log)
          </button>
          {showLog && (
            <pre className="mt-2 max-h-72 overflow-auto p-3 rounded-lg bg-black/40 text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap">
              {status.log.join('\n')}
            </pre>
          )}
        </div>
      )}

      {/* ── Check for a new version ── */}
      {overview.configured && !running && (
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">ตรวจหาเวอร์ชันใหม่</h3>
              <p className="text-xs text-gray-500">
                {overview.lastCheck ? `ตรวจล่าสุด ${fmtDate(overview.lastCheck.at)}` : 'ยังไม่เคยตรวจ'} · ระบบตรวจให้อัตโนมัติทุกคืนเวลา 00:00 น.
              </p>
            </div>
            <button
              onClick={runCheck}
              disabled={checking || overview.checking || !overview.reachable}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checking || overview.checking ? 'animate-spin' : ''}`} />
              {checking || overview.checking ? 'กำลังตรวจ…' : 'ตรวจหาเวอร์ชันใหม่'}
            </button>
          </div>

          {check && !check.available && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
              <CheckCircle2 className="w-5 h-5" /> ใช้เวอร์ชันล่าสุดของช่องทางนี้อยู่แล้ว (v{check.latest.version ?? overview.version})
            </div>
          )}

          {check?.available && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                <p className="text-white font-semibold">
                  มีเวอร์ชันใหม่ v{check.latest.version}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    commit <span className="font-mono">{check.latest.commit}</span> · build {check.latest.buildDate ?? '-'}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">จาก v{check.current.version ?? overview.version}</p>
              </div>

              {check.releases.map((r) => (
                <div key={r.version} className="rounded-xl border border-slate-700 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-800/60 flex items-center gap-3">
                    <span className="font-mono font-semibold text-white">v{r.version}</span>
                    {r.date && <span className="text-xs text-gray-400">{r.date}</span>}
                  </div>
                  <ul className="p-4 space-y-2">
                    {r.changes.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${CHANGE_STYLE[c.type] ?? 'bg-slate-600/40 text-gray-300'}`}>
                          {CHANGE_LABEL[c.type] ?? c.type.toUpperCase()}
                        </span>
                        <span className="text-gray-300">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {check.manual.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <p className="flex items-center gap-2 text-amber-300 font-medium text-sm">
                    <AlertTriangle className="w-4 h-4" /> ต้องทำบน server ด้วยตนเองก่อนติดตั้ง
                  </p>
                  <ul className="list-disc pl-6 text-sm text-amber-100 space-y-1">
                    {check.manual.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                  <label className="flex items-center gap-2 text-sm text-amber-200 cursor-pointer">
                    <input type="checkbox" checked={manualDone} onChange={(e) => setManualDone(e.target.checked)} />
                    ทำขั้นตอนเหล่านี้แล้ว
                  </label>
                </div>
              )}

              <button
                onClick={() => install(check)}
                disabled={check.manual.length > 0 && !manualDone}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> ติดตั้ง v{check.latest.version}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      {status?.history && status.history.length > 0 && (
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><History className="w-5 h-5" /> ประวัติการอัปเดต</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-gray-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2 font-medium">เวลา</th>
                  <th className="text-left py-2 px-2 font-medium">จาก → เป็น</th>
                  <th className="text-left py-2 px-2 font-medium">ผล</th>
                </tr>
              </thead>
              <tbody>
                {status.history.map((h, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="py-2 px-2 text-gray-300 whitespace-nowrap">{fmtDate(h.startedAt)}</td>
                    <td className="py-2 px-2 text-gray-300 font-mono">v{h.fromVersion ?? '?'} → v{h.toVersion ?? '?'}</td>
                    <td className="py-2 px-2">
                      {h.status === 'done' ? (
                        <span className="text-emerald-400">สำเร็จ</span>
                      ) : (
                        <span className="text-red-400" title={h.error ?? ''}>
                          ไม่สำเร็จ{h.rolledBack ? ' (กลับเวอร์ชันเดิมแล้ว)' : ''}{h.error ? ` — ${h.error}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
