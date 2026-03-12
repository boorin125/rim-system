// app/(dashboard)/dashboard/settings/job-types/page.tsx - Job Type Management
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Power,
  Sparkles,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface JobType {
  id: number
  name: string
  description?: string
  color: string
  isActive: boolean
  sortOrder: number
}

export default function JobTypesSettingsPage() {
  const themeHighlight = useThemeHighlight()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [userRoles, setUserRoles] = useState<string[]>([])

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    isActive: true,
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      const roles = user.roles || (user.role ? [user.role] : [])
      setUserRoles(roles)
    }
    fetchJobTypes()
  }, [])

  const canManage = userRoles.includes('SUPER_ADMIN') || userRoles.includes('IT_MANAGER')

  const fetchJobTypes = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/all?includeInactive=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setJobTypes(response.data || [])
    } catch (error) {
      console.error('Error fetching job types:', error)
      toast.error('ไม่สามารถโหลดข้อมูล Job Type ได้')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อ Job Type')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('เพิ่ม Job Type สำเร็จ')
      setIsCreating(false)
      resetForm()
      fetchJobTypes()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถเพิ่ม Job Type ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (id: number) => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อ Job Type')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/${id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('อัพเดต Job Type สำเร็จ')
      setEditingId(null)
      resetForm()
      fetchJobTypes()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถอัพเดต Job Type ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (jobType: JobType) => {
    if (!confirm(`ยืนยันการลบ Job Type "${jobType.name}"?`)) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/${jobType.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ลบ Job Type สำเร็จ')
      fetchJobTypes()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถลบ Job Type ได้')
    }
  }

  const handleToggleActive = async (jobType: JobType) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/${jobType.id}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(jobType.isActive ? 'ปิดใช้งาน Job Type สำเร็จ' : 'เปิดใช้งาน Job Type สำเร็จ')
      fetchJobTypes()
    } catch (error: any) {
      toast.error('ไม่สามารถเปลี่ยนสถานะ Job Type ได้')
    }
  }

  const handleSeedDefaults = async () => {
    if (!confirm('ยืนยันการสร้าง Job Type เริ่มต้น? หากมีอยู่แล้วจะไม่ถูกเขียนทับ')) return

    setIsSeeding(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('สร้าง Job Type เริ่มต้นสำเร็จ')
      fetchJobTypes()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถสร้าง Job Type เริ่มต้นได้')
    } finally {
      setIsSeeding(false)
    }
  }

  const startEditing = (jobType: JobType) => {
    setEditingId(jobType.id)
    setFormData({
      name: jobType.name,
      description: jobType.description || '',
      color: jobType.color,
      isActive: jobType.isActive,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsCreating(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      isActive: true,
    })
  }

  const colorOptions = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#EAB308', // Yellow
    '#84CC16', // Lime
    '#22C55E', // Green
    '#10B981', // Emerald
    '#14B8A6', // Teal
    '#06B6D4', // Cyan
    '#0EA5E9', // Sky
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#A855F7', // Purple
    '#D946EF', // Fuchsia
    '#EC4899', // Pink
    '#6B7280', // Gray
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Back Button */}
      <BackButton href="/dashboard/settings" label="กลับไปหน้า Settings" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-600/20 rounded-xl">
            <Briefcase className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Job Types</h1>
            <p className="text-gray-400">จัดการประเภทงาน MA, Adhoc, Project</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {jobTypes.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {isSeeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                สร้างค่าเริ่มต้น
              </button>
            )}
            <button
              onClick={() => {
                setIsCreating(true)
                resetForm()
              }}
              className="flex items-center gap-2 px-4 py-2 hover:brightness-110 text-white rounded-lg transition"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-4 h-4" />
              เพิ่ม Job Type
            </button>
          </div>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="glass-card p-6 rounded-2xl border-2 border-blue-500/50">
          <h3 className="text-lg font-semibold text-white mb-4">เพิ่ม Job Type ใหม่</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">ชื่อ Job Type *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น MA, Adhoc, Project"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">คำอธิบาย</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="คำอธิบายสั้นๆ"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">สี</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      formData.color === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={cancelEditing}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึก
            </button>
          </div>
        </div>
      )}

      {/* Job Types List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {jobTypes.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">ยังไม่มี Job Type</h3>
            <p className="text-gray-400 mb-6">
              เริ่มต้นด้วยการสร้างค่าเริ่มต้น หรือเพิ่ม Job Type ใหม่ด้วยตัวเอง
            </p>
            {canManage && (
              <button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition mx-auto disabled:opacity-50"
              >
                {isSeeding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                สร้าง Job Type เริ่มต้น
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {jobTypes.map((jobType) => (
              <div
                key={jobType.id}
                className={`p-4 ${
                  !jobType.isActive ? 'opacity-50' : ''
                } ${editingId === jobType.id ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'} transition`}
              >
                {editingId === jobType.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">ชื่อ Job Type *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">คำอธิบาย</label>
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-400 mb-1">สี</label>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormData({ ...formData, color })}
                              className={`w-6 h-6 rounded transition-all ${
                                formData.color === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-gray-400 hover:text-white transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleUpdate(jobType.id)}
                        disabled={isSaving}
                        className="p-2 text-green-400 hover:text-green-300 transition disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${jobType.color}20`, color: jobType.color }}
                      >
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{jobType.name}</span>
                          <span
                            className="px-2 py-0.5 text-xs rounded-full text-white"
                            style={{ backgroundColor: jobType.color }}
                          >
                            {jobType.name}
                          </span>
                          {!jobType.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">
                              ปิดใช้งาน
                            </span>
                          )}
                        </div>
                        {jobType.description && (
                          <p className="text-sm text-gray-400">{jobType.description}</p>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(jobType)}
                          className={`p-2 rounded-lg transition ${
                            jobType.isActive
                              ? 'text-green-400 hover:bg-green-500/20'
                              : 'text-gray-400 hover:bg-gray-500/20'
                          }`}
                          title={jobType.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditing(jobType)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(jobType)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-400 font-medium">เกี่ยวกับ Job Types</p>
            <p className="text-sm text-gray-300">
              <strong>MA (Maintenance Agreement)</strong> - งานบำรุงรักษาตามสัญญา<br />
              <strong>Adhoc</strong> - งานเฉพาะกิจ นอกเหนือจากสัญญา MA<br />
              <strong>Project</strong> - งานโปรเจคติดตั้ง หรืองานขนาดใหญ่<br /><br />
              การปิดใช้งาน Job Type จะทำให้ไม่สามารถเลือกได้ตอนสร้าง Incident ใหม่
            </p>
          </div>
        </div>
      </div>

      {/* View Only Warning */}
      {!canManage && (
        <div className="flex items-start space-x-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">View Only</p>
            <p className="text-sm text-gray-400">
              เฉพาะ Super Admin และ IT Manager เท่านั้นที่สามารถจัดการ Job Types ได้
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
