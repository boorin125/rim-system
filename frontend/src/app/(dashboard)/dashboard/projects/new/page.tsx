'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Briefcase, Save, User, Search, X } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { getPhotoUrl } from '@/utils/photoUtils'

const PROJECT_COLORS = [
  { hex: '#3b82f6', label: 'น้ำเงิน' },
  { hex: '#8b5cf6', label: 'ม่วง' },
  { hex: '#06b6d4', label: 'ฟ้า' },
  { hex: '#10b981', label: 'เขียว' },
  { hex: '#f59e0b', label: 'เหลือง' },
  { hex: '#f97316', label: 'ส้ม' },
  { hex: '#ef4444', label: 'แดง' },
  { hex: '#ec4899', label: 'ชมพู' },
  { hex: '#64748b', label: 'เทา' },
  { hex: '#0f172a', label: 'ดำ' },
]

export default function NewProjectPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    budget: '',
    startDate: '',
    endDate: '',
    status: 'DRAFT',
    color: '#3b82f6',
  })

  // Project Manager selector
  const [users, setUsers] = useState<any[]>([])
  const [selectedManager, setSelectedManager] = useState<any>(null)
  const [managerSearch, setManagerSearch] = useState('')
  const [showManagerDropdown, setShowManagerDropdown] = useState(false)
  const managerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users?limit=200&status=ACTIVE`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      setUsers(res.data.data || res.data || [])
    }).catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (managerRef.current && !managerRef.current.contains(e.target as Node)) {
        setShowManagerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredUsers = users.filter(u => {
    const q = managerSearch.toLowerCase()
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    )
  })

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('กรุณากรอกชื่อ Project')
      return
    }

    const token = localStorage.getItem('token')
    setIsLoading(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        color: form.color,
      }
      if (form.budget) payload.budget = parseFloat(form.budget)
      if (form.startDate) payload.startDate = form.startDate
      if (form.endDate) payload.endDate = form.endDate
      if (selectedManager) payload.projectManagerId = selectedManager.id

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('สร้าง Project สำเร็จ')
      router.push(`/dashboard/projects/${res.data.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'สร้าง Project ไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/projects"
          className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6" style={{ color: themeHighlight }} />
            สร้าง Project ใหม่
          </h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            ชื่อ Project <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="เช่น Interior Rollout Q3 2026"
            className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            รายละเอียด
          </label>
          <textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="อธิบายรายละเอียดของ Project..."
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Project Manager */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Project Manager
          </label>
          <div ref={managerRef} className="relative">
            {selectedManager ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg">
                {selectedManager.avatarPath ? (
                  <img
                    src={getPhotoUrl(selectedManager.avatarPath)}
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                    alt=""
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center text-[10px] text-gray-200 shrink-0 font-medium">
                    {selectedManager.firstName?.charAt(0) ?? '?'}
                  </div>
                )}
                <span className="text-sm text-white flex-1">
                  {selectedManager.firstName} {selectedManager.lastName}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedManager(null); setManagerSearch('') }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(e) => { setManagerSearch(e.target.value); setShowManagerDropdown(true) }}
                  onFocus={() => setShowManagerDropdown(true)}
                  placeholder="ค้นหาชื่อ User..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Dropdown */}
            {showManagerDropdown && !selectedManager && (
              <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">ไม่พบ User</div>
                ) : (
                  filteredUsers.slice(0, 30).map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedManager(u)
                        setShowManagerDropdown(false)
                        setManagerSearch('')
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/70 transition-colors text-left"
                    >
                      {u.avatarPath ? (
                        <img
                          src={getPhotoUrl(u.avatarPath)}
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                          alt=""
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs text-gray-300 shrink-0 font-medium">
                          {u.firstName?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            งบประมาณ (บาท)
          </label>
          <input
            type="number"
            value={form.budget}
            onChange={(e) => handleChange('budget', e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              วันเริ่มต้น
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              วันสิ้นสุด
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            สถานะเริ่มต้น
          </label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="DRAFT">Draft — ยังไม่เริ่ม</option>
            <option value="ACTIVE">Active — กำลังดำเนินการ</option>
          </select>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            สีของ Project
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            {PROJECT_COLORS.map(c => (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                onClick={() => handleChange('color', c.hex)}
                className={`w-8 h-8 rounded-full transition-all duration-150 ${
                  form.color === c.hex
                    ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white scale-110'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {/* Custom color input */}
            <div className="relative">
              <input
                type="color"
                value={form.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent opacity-0 absolute inset-0"
              />
              <div
                className="w-8 h-8 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center text-slate-400 text-xs cursor-pointer hover:border-slate-300 transition-colors"
                title="เลือกสีเอง"
              >
                +
              </div>
            </div>
          </div>
          {/* Preview */}
          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-1.5 w-24 rounded-full"
              style={{ backgroundColor: form.color }}
            />
            <span className="text-xs text-gray-400">{form.color}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: themeHighlight }}
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'กำลังบันทึก...' : 'สร้าง Project'}
          </button>
          <Link
            href="/dashboard/projects"
            className="px-5 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm font-medium hover:bg-slate-700/50 transition-colors"
          >
            ยกเลิก
          </Link>
        </div>
      </form>
    </div>
  )
}
