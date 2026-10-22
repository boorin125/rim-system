'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

// Mirrors backend src/modules/project/work-types.ts (served by GET /projects/meta/work-types)
export type EvidenceSection =
  | { key: string; kind: 'photos'; label: string; hint?: string; min: number; pointName?: boolean }
  | { key: string; kind: 'beforeAfter'; label: string; hint?: string; min: number }
  | { key: string; kind: 'tests'; label: string; hint?: string; items: string[] }
  | { key: string; kind: 'equipment'; label: string; hint?: string; min: number }

export interface WorkTypeDef {
  key: string
  label: string
  description: string
  sections: EvidenceSection[]
  legacy?: boolean
}

/** Short name for badges: "Rollout — เปลี่ยนอุปกรณ์" → "Rollout" */
export function workTypeShort(def?: WorkTypeDef) {
  return def ? def.label.split(' — ')[0] : ''
}

// One request per page load
let cached: Promise<WorkTypeDef[]> | null = null

function fetchWorkTypes(): Promise<WorkTypeDef[]> {
  if (!cached) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    cached = axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/projects/meta/work-types`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.data as WorkTypeDef[])
      .catch(() => {
        cached = null
        return []
      })
  }
  return cached
}

export function useWorkTypes() {
  const [workTypes, setWorkTypes] = useState<WorkTypeDef[]>([])
  useEffect(() => {
    let alive = true
    fetchWorkTypes().then((w) => { if (alive) setWorkTypes(w) })
    return () => { alive = false }
  }, [])
  const byKey = (key?: string | null) => workTypes.find((w) => w.key === (key || 'GENERAL'))
  return { workTypes, byKey }
}
