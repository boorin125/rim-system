'use client'

// Quick Manage Incident — open work per technician + Unassign, with Assign / Reassign in place.
// Reached from the Incident Management header (SUPERVISOR / IT_MANAGER only; not in the side menu).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import PendingIncidents from '@/components/incidents/PendingIncidents'
import { getUserRoles } from '@/config/permissions'

const ALL_JOB_TYPES: string[] = []

export default function PendingIncidentsPage() {
  const [roles, setRoles] = useState<string[] | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user')
      setRoles(raw ? getUserRoles(JSON.parse(raw)) : [])
    } catch {
      setRoles([])
    }
  }, [])

  if (!roles) return null

  const allowed = roles.includes('SUPERVISOR') || roles.includes('IT_MANAGER')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/incidents" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Incident Management
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Quick Manage Incident</h1>
        <p className="text-gray-400 mt-1">งานที่ยังไม่ Closed แยกตามช่าง — Assign / Reassign ได้จากหน้านี้</p>
      </div>

      {allowed ? (
        <PendingIncidents jobTypes={ALL_JOB_TYPES} userRoles={roles} />
      ) : (
        <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-2 text-center">
          <ShieldAlert className="w-8 h-8 text-amber-400" />
          <p className="text-white font-medium">หน้านี้สำหรับ Supervisor และ IT Manager</p>
        </div>
      )}
    </div>
  )
}
