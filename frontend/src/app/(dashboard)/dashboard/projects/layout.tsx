'use client'

// Gate every /dashboard/projects page behind Settings › Modules › Project.
// Technicians work their tasks from the Incidents page: unless they are a Project Manager,
// the project pages send them there (the task page itself stays open — they close jobs on it).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FolderKanban } from 'lucide-react'
import { useModules } from '@/hooks/useModules'
import { useMyProjectWork } from '@/hooks/useMyProjectWork'
import { getUserRoles } from '@/config/permissions'

const HIGHER_THAN_TECH = ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR', 'HELP_DESK']

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const { modules, loaded } = useModules()
  const { managesProjects, loaded: workLoaded, failed } = useMyProjectWork()
  const pathname = usePathname()
  const router = useRouter()
  const [isTechOnly, setIsTechOnly] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const roles = getUserRoles(JSON.parse(localStorage.getItem('user') || 'null')) as string[]
      setIsTechOnly(roles.includes('TECHNICIAN') && !roles.some(r => HIGHER_THAN_TECH.includes(r)))
    } catch {
      setIsTechOnly(false)
    }
  }, [])

  const isTaskPage = pathname?.startsWith('/dashboard/projects/task/')
  // Don't lock anyone out when the check itself failed
  const sendToIncidents = !!isTechOnly && !isTaskPage && workLoaded && !failed && !managesProjects

  useEffect(() => {
    if (sendToIncidents) router.replace('/dashboard/incidents')
  }, [sendToIncidents, router])

  if (!loaded || isTechOnly === null || (isTechOnly && !isTaskPage && !workLoaded) || sendToIncidents) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="spinner" />
      </div>
    )
  }

  if (!modules.project) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <FolderKanban className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">โมดูล Project ยังไม่เปิดใช้งาน</h2>
        <p className="text-sm text-gray-400 mb-6">ผู้ดูแลระบบ (Super Admin) เปิดได้ที่ Settings › Modules</p>
        <Link href="/dashboard" className="text-sm text-blue-400 hover:underline">กลับหน้าหลัก</Link>
      </div>
    )
  }

  return <>{children}</>
}
