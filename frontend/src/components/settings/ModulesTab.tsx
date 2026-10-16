'use client'

// Settings › Modules — switch optional feature modules on/off (SUPER_ADMIN only)
import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Blocks, FolderKanban } from 'lucide-react'
import { notifyModulesChanged, type EnabledModules } from '@/hooks/useModules'

const MODULE_LIST: { key: keyof EnabledModules; label: string; description: string; icon: typeof FolderKanban }[] = [
  {
    key: 'project',
    label: 'Project',
    description: 'โปรเจกต์ (เปิดร้านใหม่ / Rollout) — สาขาในโปรเจกต์, งานโปรเจกต์ให้ช่าง Check-in, รูป, อุปกรณ์, Checklist และตรวจรับงาน ใช้เลขงานชุดเดียวกับ Incident',
    icon: FolderKanban,
  },
]

export default function ModulesTab() {
  const [modules, setModules] = useState<EnabledModules | null>(null)
  const [saving, setSaving] = useState<keyof EnabledModules | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/settings/modules`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setModules(res.data))
      .catch(() => toast.error('โหลดการตั้งค่าโมดูลไม่สำเร็จ'))
  }, [])

  const toggle = async (key: keyof EnabledModules) => {
    if (!modules) return
    setSaving(key)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/modules`,
        { [key]: !modules[key] },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setModules(res.data)
      notifyModulesChanged(res.data)
      toast.success(res.data[key] ? 'เปิดใช้งานโมดูลแล้ว' : 'ปิดโมดูลแล้ว')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <Blocks className="w-5 h-5 text-sky-400" />
        <h2 className="text-lg font-semibold text-white">Modules</h2>
      </div>

      <p className="text-sm text-slate-400">
        เปิด/ปิดโมดูลเสริมของระบบ — เมื่อปิด เมนูจะถูกซ่อนและ API ของโมดูลจะใช้งานไม่ได้ (ข้อมูลเดิมยังอยู่ครบ)
      </p>

      <div className="space-y-3">
        {MODULE_LIST.map(({ key, label, description, icon: Icon }) => {
          const enabled = !!modules?.[key]
          return (
            <div key={key} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-start gap-4">
              <div className={`p-2.5 rounded-lg ${enabled ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700/60 text-slate-400'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{label}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`เปิด/ปิดโมดูล ${label}`}
                disabled={!modules || saving === key}
                onClick={() => toggle(key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-sky-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
