'use client'

// Settings › System Update (SUPER_ADMIN): the running version, a check of this server's release
// channel, a one-button install with live progress, and past updates. The work is done by the
// rim-updater container on the server (deploy/updater). Layout follows RSM's update screen.

import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { DownloadCloud } from 'lucide-react'
import releasesData from '@/data/releases.json'

type StepKey = 'prepare' | 'backup' | 'pull' | 'backend' | 'frontend' | 'finish'
type StepStatus = 'pending' | 'running' | 'done' | 'failed'

interface VersionInfo { version: string | null; commit: string | null; buildDate: string | null }
interface ReleaseNote { version: string; date: string | null; changes: { type: string; text: string }[]; manual?: string[] }
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
/** Release notes this frontend was built with (current version and older — for "What's new" and history). */
const LOCAL_RELEASES: ReleaseNote[] = (releasesData as { releases: ReleaseNote[] }).releases

const STEP_LABEL: Record<StepKey, string> = {
  prepare: 'Preparing update',
  backup: 'Backing up database',
  pull: 'Downloading new version',
  backend: 'Starting new version',
  frontend: 'Starting web + nginx',
  finish: 'Cleaning up',
}
// One short Thai hint under the current step, only where the user should know something.
const STEP_HINT: Partial<Record<StepKey, string>> = {
  pull: 'ระบบยังใช้งานได้ตามปกติ — ขั้นนี้ใช้เวลานานที่สุด',
  backend: 'ระบบหยุดชั่วครู่ระหว่างสลับเวอร์ชัน',
}

const api = () => process.env.NEXT_PUBLIC_API_URL
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const short = (v: string | null, commit: string | null) => v ?? commit?.slice(0, 7) ?? '?'
/** "1.0.28 → 1.0.29", or with commits when the same version was rebuilt */
const historyLabel = (h: { fromVersion: string | null; toVersion: string | null; from: string | null; to: string | null }) =>
  h.fromVersion && h.fromVersion === h.toVersion && h.from && h.to
    ? `${h.fromVersion} (${h.from.slice(0, 7)}) → ${h.toVersion} (${h.to.slice(0, 7)})`
    : `${short(h.fromVersion, h.from)} → ${short(h.toVersion, h.to)}`

function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block border-2 border-indigo-400 border-t-transparent rounded-full animate-spin ${className}`} />
}

function Notes({ changes }: { changes: { text: string }[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-300">
      {changes.map((c, i) => <li key={i}>{c.text}</li>)}
    </ul>
  )
}

function failText(s: { error: string | null; rolledBack: boolean }) {
  if (s.error === 'disk full') return 'พื้นที่ดิสก์บนเซิร์ฟเวอร์ไม่พอ — ระบบยังเป็นเวอร์ชันเดิม'
  if (s.error?.includes('backend image commit is'))
    return 'มีการ build ใหม่หลังจากตรวจครั้งล่าสุด — ระบบยังเป็นเวอร์ชันเดิม กด Check for Updates แล้วติดตั้งอีกครั้ง'
  if (s.error?.includes('ดาวน์โหลดจาก Docker Hub ไม่สำเร็จ')) return `${s.error.split(' [')[0]} — ระบบยังเป็นเวอร์ชันเดิม`
  if (s.error === 'interrupted') return 'การอัปเดตถูกขัดจังหวะ (เซิร์ฟเวอร์รีสตาร์ท) — ตรวจสอบว่าระบบใช้งานได้ปกติ'
  return s.rolledBack
    ? 'อัปเดตไม่สำเร็จ — ระบบย้อนกลับเป็นเวอร์ชันเดิมเรียบร้อยแล้ว ข้อมูลไม่เสียหาย'
    : 'อัปเดตไม่สำเร็จ และย้อนกลับได้ไม่ครบ — โปรดติดต่อผู้ดูแลระบบ'
}

/** The progress card: one line for the step in progress (or the step that failed) + a bar. */
function Progress({ status, restarting }: { status: UpdateStatus; restarting: boolean }) {
  const steps = status.steps
  const total = steps.length
  const done = steps.filter((s) => s.status === 'done').length
  const failed = steps.find((s) => s.status === 'failed')
  const current = steps.find((s) => s.status === 'running') ?? failed ?? steps.find((s) => s.status === 'pending')
  const running = status.status === 'running'
  const ok = status.status === 'done'
  const pct = ok ? 100 : Math.round((done / total) * 100)
  const index = current ? steps.indexOf(current) + 1 : total

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {running ? <Spinner className="w-5 h-5" /> : ok ? <span className="text-emerald-400 text-lg">✓</span> : <span className="text-red-400 text-lg">✕</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white">
            {ok ? 'All steps completed' : status.rollingBack ? 'Rolling back to previous version' : current ? STEP_LABEL[current.key] ?? current.key : '—'}
          </div>
          {running && !status.rollingBack && current && STEP_HINT[current.key] && (
            <div className="text-xs text-gray-400">{STEP_HINT[current.key]}</div>
          )}
          {restarting && <div className="text-xs text-gray-400">ระบบกำลังเริ่มใหม่ รอสักครู่…</div>}
        </div>
        <span className="text-xs tabular-nums text-gray-400 whitespace-nowrap">
          {ok ? `${total}/${total}` : `Step ${index} of ${total}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${ok ? 'bg-emerald-500' : failed ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${Math.max(pct, running ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}

const card = 'glass-card rounded-2xl p-5'
const btnPrimary = 'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50'
const btnSecondary = 'px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium disabled:opacity-50'

export default function UpdateTab() {
  const [info, setInfo] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [starting, setStarting] = useState(false)
  const [found, setFound] = useState<UpdateCheck | null>(null)
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [polling, setPolling] = useState(false)
  // The step-by-step card belongs to an update followed on this visit; after a reload only the history shows.
  const [following, setFollowing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [manualDone, setManualDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await axios.get<Overview>(`${api()}/system/update`, auth())
      setInfo(r.data)
      setStatus(r.data.status)
      // A new version found by the nightly check shows straight away (unless it is the one installed now).
      const last = r.data.lastCheck?.result
      if (last?.available && last.latest?.commit && !(r.data.commit && last.latest.commit.startsWith(r.data.commit.slice(0, 7)))) setFound(last)
      if (r.data.status?.status === 'running') {
        setFollowing(true)
        setPolling(true)
      }
      return r.data
    } catch {
      setInfo(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!polling) return
    let live = true
    const tick = async () => {
      try {
        const r = await axios.get<UpdateStatus>(`${api()}/system/update/status`, auth())
        if (!live) return
        setRestarting(false)
        setStatus(r.data)
        if (r.data.status !== 'running') {
          setPolling(false)
          return
        }
      } catch {
        // The backend is being replaced: it does not answer for a little while.
        if (live) setRestarting(true)
      }
      if (live) timer.current = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      live = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [polling])

  /** Check the channel now (the updater pulls in the background) and return the fresh result. */
  const runCheck = async (): Promise<UpdateCheck | null> => {
    await axios.post(`${api()}/system/update/check`, {}, auth())
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS))
      const r = await axios.get<Overview>(`${api()}/system/update`, auth())
      if (r.data.checking) continue
      setInfo(r.data)
      if (r.data.lastCheckError) {
        toast.error(`ตรวจหาเวอร์ชันใหม่ไม่สำเร็จ: ${r.data.lastCheckError}`)
        return null
      }
      return r.data.lastCheck?.result ?? null
    }
    return null
  }

  const check = async () => {
    setChecking(true)
    try {
      const fresh = await runCheck()
      if (fresh) setFound(fresh)
      setManualDone(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'ตรวจหาเวอร์ชันใหม่ไม่สำเร็จ')
    } finally {
      setChecking(false)
    }
  }

  const install = async () => {
    if (!found?.latest.version || !found.latest.commit) return
    setStarting(true)
    try {
      // The result on screen may be old (nightly check, or a build pushed since): check again first.
      const fresh = await runCheck()
      if (!fresh) return
      if (!fresh.available || fresh.latest.commit !== found.latest.commit) {
        setConfirming(false)
        setFound(fresh)
        setManualDone(false)
        toast(
          fresh.available
            ? `พบ build ใหม่กว่าที่ตรวจไว้ (${fresh.latest.version} · ${fresh.latest.commit}) — ตรวจ Release Notes แล้วกด Install Update อีกครั้ง`
            : 'ใช้เวอร์ชันล่าสุดอยู่แล้ว',
          { icon: 'ℹ️', duration: 6000 },
        )
        return
      }
      setConfirming(false)
      await axios.post(`${api()}/system/update/install`, { version: fresh.latest.version, commit: fresh.latest.commit }, auth())
      setFound(null)
      setStatus(null)
      setFollowing(true)
      setPolling(true)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'เริ่มอัปเดตไม่สำเร็จ')
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return <div className={`${card} flex justify-center`}><Spinner className="w-6 h-6" /></div>
  }

  const version = info?.version ?? '?'
  const currentNotes = LOCAL_RELEASES.find((r) => r.version === version)

  if (!info || !info.configured || !info.reachable) {
    return (
      <div className="space-y-5">
        <div className={card}>
          <h3 className="font-semibold text-white">Current Version {version}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {!info
              ? 'โหลดข้อมูลเวอร์ชันไม่สำเร็จ'
              : !info.configured
                ? 'เซิร์ฟเวอร์นี้ยังไม่ได้ติดตั้งตัวอัปเดต (rim-updater) — อัปเดตด้วยปุ่มนี้ไม่ได้ (ติดตั้งด้วย deploy/updater/setup-updater.sh)'
                : 'ติดต่อตัวอัปเดตบนเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบ container rim-updater (docker logs rim-updater)'}
          </p>
        </div>
      </div>
    )
  }

  const running = polling || status?.status === 'running'
  const showProgress = following && !!status
  const lastFailed = !following && status?.status === 'failed' ? status : null
  const busyChecking = checking || info.checking

  return (
    <div className="space-y-5">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white text-lg">Current Version {version}</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {status?.channel === 'stable' ? 'รับอัปเดตจากช่องทางหลัก (stable)' : `รับอัปเดตจากช่องทางทดสอบ (${status?.channel ?? '?'})`}
              {info.buildDate && <> · build {info.buildDate}</>}
              {info.commit && <> · <span className="font-mono">{info.commit}</span></>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              ตรวจหาเวอร์ชันใหม่อัตโนมัติทุกวัน 00:00 น.
              {info.lastCheck?.at && <> · ตรวจล่าสุด {fmt(info.lastCheck.at)}</>}
            </p>
          </div>
          <button type="button" onClick={check} disabled={busyChecking || running} className={`${btnSecondary} whitespace-nowrap inline-flex items-center gap-2`}>
            {busyChecking && <Spinner className="w-4 h-4" />}
            {busyChecking ? 'Checking…' : 'Check for Updates'}
          </button>
        </div>

        {currentNotes && currentNotes.changes.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-200">What&apos;s new in {version}</summary>
            <Notes changes={currentNotes.changes} />
          </details>
        )}

        {found && !running && (
          <div className="rounded-xl border border-slate-700 p-4 space-y-3">
            {!found.available ? (
              <p className="text-sm text-emerald-400 font-medium">
                ✓ You&apos;re up to date <span className="font-normal text-gray-400">— ใช้เวอร์ชันล่าสุดอยู่แล้ว</span>
              </p>
            ) : (
              <>
                <div className="font-semibold text-white">New Version Available · {short(found.latest.version, found.latest.commit)}</div>
                {found.releases.map((r) => (
                  <div key={r.version}>
                    <div className="text-sm font-medium text-gray-200">
                      Version {r.version}
                      {r.date && <span className="ml-2 text-gray-500 font-normal">{r.date}</span>}
                    </div>
                    <Notes changes={r.changes} />
                  </div>
                ))}
                {found.manual.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                    <p className="text-sm font-medium text-amber-300">⚠ ต้องทำบนเซิร์ฟเวอร์ด้วยตนเองก่อนติดตั้ง</p>
                    <ul className="list-disc pl-5 text-sm text-amber-100 space-y-0.5">
                      {found.manual.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                    <label className="flex items-center gap-2 text-sm text-amber-200 cursor-pointer">
                      <input type="checkbox" checked={manualDone} onChange={(e) => setManualDone(e.target.checked)} />
                      ทำขั้นตอนเหล่านี้แล้ว
                    </label>
                  </div>
                )}
                <p className="text-xs text-gray-400">ระบบจะสำรองฐานข้อมูลก่อนติดตั้งเสมอ ถ้าติดตั้งไม่สำเร็จจะย้อนกลับเป็นเวอร์ชันเดิมให้อัตโนมัติ</p>
                <button type="button" onClick={() => setConfirming(true)} disabled={starting || (found.manual.length > 0 && !manualDone)} className={btnPrimary}>
                  {starting ? 'Starting…' : 'Install Update'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showProgress && (
        <div className={`${card} space-y-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-white">
              {running ? 'Updating…' : status!.status === 'done' ? 'Update Completed' : 'Update Failed'}
            </h3>
            {!running && status!.finishedAt && <p className="text-sm text-gray-400">{fmt(status!.finishedAt)}</p>}
          </div>
          <Progress status={status!} restarting={restarting} />
          {!running && status!.status === 'done' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-300">โหลดหน้าใหม่เพื่อใช้เวอร์ชันล่าสุด (ผู้ใช้คนอื่นจะได้เวอร์ชันใหม่เมื่อรีเฟรชหน้า)</p>
              <button type="button" onClick={() => window.location.reload()} className={btnPrimary}>Reload</button>
            </div>
          )}
          {!running && status!.status === 'failed' && (
            <p className={`text-sm ${status!.rolledBack ? 'text-gray-300' : 'text-red-400'}`}>{failText(status!)}</p>
          )}
          {status!.log.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-200">Technical log</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-gray-300 whitespace-pre-wrap break-all">{status!.log.slice(-150).join('\n')}</pre>
            </details>
          )}
        </div>
      )}

      {lastFailed && (
        <div className={`${card} border border-red-500/30`}>
          <h3 className="font-semibold text-white">Last Update Failed · {short(lastFailed.fromVersion, null)} → {short(lastFailed.toVersion, null)}</h3>
          <p className={`text-sm mt-1 ${lastFailed.rolledBack ? 'text-gray-300' : 'text-red-400'}`}>{failText(lastFailed)}</p>
          {lastFailed.backup && <p className="text-xs text-gray-500 mt-1">Backup ฐานข้อมูล: <span className="font-mono">{lastFailed.backup}</span></p>}
        </div>
      )}

      {!running && (status?.history?.length ?? 0) > 0 && (
        <div className={card}>
          <h3 className="font-semibold text-white">Update History</h3>
          <ul className="mt-3 divide-y divide-slate-700/60">
            {status!.history.map((h, i) => {
              const notes = h.toVersion ? LOCAL_RELEASES.find((r) => r.version === h.toVersion)?.changes : undefined
              const ok = h.status === 'done'
              return (
                <li key={(h.startedAt ?? '') + i} className="py-2">
                  <details className="text-sm">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="w-40 shrink-0 tabular-nums text-gray-400">{fmt(h.finishedAt ?? h.startedAt)}</span>
                      <span className="font-medium text-gray-200">{historyLabel(h)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {ok ? 'Success' : h.error === 'interrupted' ? 'Interrupted' : h.error === 'disk full' ? 'Disk full' : h.rolledBack ? 'Failed · Rolled back' : 'Failed'}
                      </span>
                    </summary>
                    {notes && notes.length > 0 ? <Notes changes={notes} /> : <p className="mt-1 text-gray-500">No release notes</p>}
                  </details>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {confirming && found && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-indigo-500/20 rounded-full">
                <DownloadCloud className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">ติดตั้งเวอร์ชัน {short(found.latest.version, found.latest.commit)}</h3>
                <p className="text-sm text-gray-400">จาก v{version}</p>
              </div>
            </div>
            <p className="text-gray-300 mb-3 text-sm">
              ระบบจะสำรองฐานข้อมูลก่อน แล้วติดตั้งเวอร์ชันใหม่ ถ้าไม่สำเร็จระบบจะย้อนกลับเป็นเวอร์ชันเดิมให้อัตโนมัติ
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
              <p className="text-amber-300 text-xs">ระหว่างสลับเวอร์ชัน ผู้ใช้ทุกคนจะใช้งานไม่ได้ประมาณ 1 นาที — ควรติดตั้งช่วงที่มีผู้ใช้งานน้อย</p>
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={install}
                disabled={starting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition duration-200 disabled:opacity-50"
              >
                {starting ? 'กำลังตรวจเวอร์ชันล่าสุด...' : 'ติดตั้ง'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
