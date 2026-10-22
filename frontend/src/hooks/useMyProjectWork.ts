'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useModules } from './useModules'

export interface MyProjectTask {
  id: number
  ticketNo: string | null
  title: string | null
  status: string
  taskType: string
  scheduledDate: string | null
  projectStore: {
    store: { storeCode: string; name: string }
    project: { id: number; name: string; color: string | null }
  }
}

/**
 * The signed-in user's open project tasks (Incidents page) and whether they manage a project
 * (technicians who don't manage one get no Projects menu). Nothing is fetched while the module is off.
 */
export function useMyProjectWork() {
  const { modules, loaded: modulesLoaded } = useModules()
  const [tasks, setTasks] = useState<MyProjectTask[]>([])
  const [managesProjects, setManagesProjects] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!modulesLoaded) return
    if (!modules.project) { setLoaded(true); return }
    const token = localStorage.getItem('token')
    if (!token) { setLoaded(true); return }
    let alive = true
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/projects/my-work`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!alive) return
        setTasks(res.data?.tasks || [])
        setManagesProjects(!!res.data?.managesProjects)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [modules.project, modulesLoaded])

  return { tasks, managesProjects, loaded }
}
