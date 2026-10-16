'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export interface EnabledModules {
  project: boolean
}

const DEFAULT_MODULES: EnabledModules = { project: false }
export const MODULES_CHANGED_EVENT = 'rim-modules-changed'

// One request per page load, shared by every component that asks
let cached: Promise<EnabledModules> | null = null

function fetchModules(): Promise<EnabledModules> {
  if (!cached) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return Promise.resolve(DEFAULT_MODULES)
    cached = axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/settings/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => ({ ...DEFAULT_MODULES, ...res.data }))
      .catch(() => {
        cached = null
        return DEFAULT_MODULES
      })
  }
  return cached
}

/** Call after saving Settings › Modules so menus update without a reload. */
export function notifyModulesChanged(modules: EnabledModules) {
  cached = Promise.resolve(modules)
  window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: modules }))
}

/**
 * Optional feature modules switched on in Settings (default off).
 * `loaded` is false until the first response arrives.
 */
export function useModules() {
  const [modules, setModules] = useState<EnabledModules>(DEFAULT_MODULES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    fetchModules().then((m) => {
      if (alive) {
        setModules(m)
        setLoaded(true)
      }
    })
    const onChange = (e: Event) => setModules((e as CustomEvent<EnabledModules>).detail)
    window.addEventListener(MODULES_CHANGED_EVENT, onChange)
    return () => {
      alive = false
      window.removeEventListener(MODULES_CHANGED_EVENT, onChange)
    }
  }, [])

  return { modules, loaded }
}
