'use client'

// Before Assign / Reassign: warn when the same store has other open jobs —
//  1. jobs held by another technician  → "ไม่ กลับไป Assign ใหม่" / "ยืนยันจ่ายงาน"
//  2. jobs nobody has yet               → "ตกลง และไปที่งาน WATxxx" / "ยืนยันจ่ายงาน"
// Used by AssignIncidentModal and ReassignmentModal.

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { AlertTriangle, Store } from 'lucide-react'
import { formatStore } from '@/utils/formatStore'

interface StorePendingResponse {
  store: { storeCode: string; name: string } | null
  items: { id: string; ticketNumber: string; title: string; status: string; technicians: { id: number; name: string }[] }[]
}

export type StoreWarning =
  | { kind: 'other-tech'; storeLabel: string; otherNames: string[]; newNames: string[] }
  | { kind: 'unassigned'; storeLabel: string; count: number; first: { id: string; ticketNumber: string } }

async function checkStoreWorkload(incidentId: string, selectedIds: number[], selectedNames: string[]): Promise<StoreWarning[]> {
  try {
    const res = await axios.get<StorePendingResponse>(`${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/store-pending`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    const storeLabel = formatStore(res.data.store, 'ร้านนี้')
    const warnings: StoreWarning[] = []

    const others = new Map<number, string>()
    for (const item of res.data.items) {
      for (const t of item.technicians) if (!selectedIds.includes(t.id)) others.set(t.id, t.name)
    }
    if (others.size > 0) {
      warnings.push({ kind: 'other-tech', storeLabel, otherNames: Array.from(others.values()), newNames: selectedNames })
    }

    const unassigned = res.data.items.filter((i) => i.technicians.length === 0)
    if (unassigned.length > 0) {
      warnings.push({ kind: 'unassigned', storeLabel, count: unassigned.length, first: { id: unassigned[0].id, ticketNumber: unassigned[0].ticketNumber } })
    }
    return warnings
  } catch {
    return [] // the check must never block assigning
  }
}

/**
 * const store = useStoreWorkloadCheck()
 * await store.run(incident.id, ids, names, doSubmit)   // doSubmit runs now, or after the user confirms
 * const goTo = store.takeGoTo()                         // after success: the job the user chose to go to next
 * {store.dialog}
 */
export function useStoreWorkloadCheck() {
  const [warnings, setWarnings] = useState<StoreWarning[]>([])
  const [checking, setChecking] = useState(false)
  const proceedRef = useRef<(() => void) | null>(null)
  const goToRef = useRef<{ id: string; ticketNumber: string } | null>(null)

  const run = async (incidentId: string, selectedIds: number[], selectedNames: string[], proceed: () => void) => {
    goToRef.current = null
    if (selectedIds.length === 0) return proceed() // un-assigning: nothing to compare
    setChecking(true)
    const found = await checkStoreWorkload(incidentId, selectedIds, selectedNames)
    setChecking(false)
    if (found.length === 0) return proceed()
    proceedRef.current = proceed
    setWarnings(found)
  }

  const confirm = () => {
    const rest = warnings.slice(1)
    if (rest.length) return setWarnings(rest)
    setWarnings([])
    proceedRef.current?.()
  }
  const goTo = (first: { id: string; ticketNumber: string }) => {
    goToRef.current = first
    setWarnings([])
    proceedRef.current?.()
  }
  const back = () => setWarnings([])

  const takeGoTo = () => {
    const g = goToRef.current
    goToRef.current = null
    return g
  }

  const w = warnings[0]
  const dialog =
    w && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={back}>
            <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-full">
                  {w.kind === 'other-tech' ? <AlertTriangle className="w-6 h-6 text-amber-400" /> : <Store className="w-6 h-6 text-amber-400" />}
                </div>
                <h3 className="text-lg font-semibold text-white">มีงานค้างในร้านเดียวกัน</h3>
              </div>

              {w.kind === 'other-tech' ? (
                <p className="text-gray-300 mb-5 leading-relaxed">
                  Store <span className="font-semibold text-white">{w.storeLabel}</span> มีงานที่จ่ายให้{' '}
                  <span className="font-semibold text-amber-300">{w.otherNames.join(', ')}</span> ค้างอยู่ คุณยืนยันจะจ่ายงานให้{' '}
                  <span className="font-semibold text-white">{w.newNames.join(', ') || 'ช่างที่เลือก'}</span> หรือไม่
                </p>
              ) : (
                <p className="text-gray-300 mb-5 leading-relaxed">
                  Store <span className="font-semibold text-white">{w.storeLabel}</span> มีงานที่ยังไม่ได้ Assign อีก{' '}
                  <span className="font-semibold text-amber-300">{w.count} งาน</span> คุณต้องการจ่ายงานให้ช่างคนเดียวกันหรือไม่
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {w.kind === 'other-tech' ? (
                  <button onClick={back} className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition">
                    ไม่ กลับไป Assign ใหม่
                  </button>
                ) : (
                  <button onClick={() => goTo(w.first)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">
                    ตกลง และไปที่งาน {w.first.ticketNumber}
                  </button>
                )}
                <button onClick={confirm} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition">
                  ยืนยันจ่ายงาน
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return { run, takeGoTo, dialog, checking }
}
