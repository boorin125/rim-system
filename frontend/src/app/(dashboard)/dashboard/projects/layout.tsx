'use client'

// Gate every /dashboard/projects page behind Settings › Modules › Project
import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { useModules } from '@/hooks/useModules'

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const { modules, loaded } = useModules()

  if (!loaded) {
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
