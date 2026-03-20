// app/(dashboard)/dashboard/settings/categories/page.tsx - Incident Category Management
'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Tags,
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
  Briefcase,
  Monitor,
  Wifi,
  HardDrive,
  Code,
  Printer,
  Camera,
  MoreHorizontal,
  Smartphone,
  ScanBarcode,
  Router,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

const iconMap: Record<string, React.ComponentType<any>> = {
  Monitor, Wifi, HardDrive, Code, Printer, Camera, MoreHorizontal, Tags, Smartphone, ScanBarcode, Router,
}

interface JobType {
  id: number
  name: string
  color: string
  isActive: boolean
}

interface Category {
  id: number
  name: string
  description?: string
  color: string
  icon?: string
  isActive: boolean
  sortOrder: number
  jobTypeId?: number | null
  jobType?: { id: number; name: string; color: string } | null
}

export default function CategoriesSettingsPage() {
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [showNameDropdown, setShowNameDropdown] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'Tags',
    isActive: true,
    jobTypeId: '' as string, // '' = ไม่ระบุ
  })

  // Live suggestions: categories matching what user is typing (create form only)
  const nameSuggestions = useMemo(() => {
    const q = formData.name.trim().toLowerCase()
    if (!q) return []
    return categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6)
  }, [formData.name, categories])

  const nameExactMatch = categories.some(
    c => c.name.toLowerCase() === formData.name.trim().toLowerCase()
  )

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserRoles(user.roles || (user.role ? [user.role] : []))
    }
    fetchCategories()
    fetchJobTypes()
  }, [])

  const canManage = userRoles.includes('SUPER_ADMIN') || userRoles.includes('IT_MANAGER')

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories?includeInactive=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCategories(res.data || [])
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูล Category ได้')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchJobTypes = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/all`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setJobTypes(res.data || [])
    } catch {}
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) { toast.error('กรุณากรอกชื่อ Category'); return }
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/categories`,
        {
          ...formData,
          jobTypeId: formData.jobTypeId ? parseInt(formData.jobTypeId) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('เพิ่ม Category สำเร็จ')
      setIsCreating(false)
      resetForm()
      fetchCategories()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถเพิ่ม Category ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (id: number) => {
    if (!formData.name.trim()) { toast.error('กรุณากรอกชื่อ Category'); return }
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`,
        {
          ...formData,
          jobTypeId: formData.jobTypeId ? parseInt(formData.jobTypeId) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('อัพเดต Category สำเร็จ')
      setEditingId(null)
      resetForm()
      fetchCategories()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถอัพเดต Category ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    if (!confirm(`ยืนยันการลบ Category "${category.name}"?`)) return
    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/${category.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ลบ Category สำเร็จ')
      fetchCategories()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถลบ Category ได้')
    }
  }

  const handleToggleActive = async (category: Category) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/${category.id}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(category.isActive ? 'ปิดใช้งาน Category สำเร็จ' : 'เปิดใช้งาน Category สำเร็จ')
      fetchCategories()
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะ Category ได้')
    }
  }

  const handleSeedDefaults = async () => {
    if (!confirm('ยืนยันการสร้าง Category เริ่มต้น? หากมีอยู่แล้วจะไม่ถูกเขียนทับ')) return
    setIsSeeding(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/categories/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('สร้าง Category เริ่มต้นสำเร็จ')
      fetchCategories()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถสร้าง Category เริ่มต้นได้')
    } finally {
      setIsSeeding(false)
    }
  }

  const startEditing = (category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon || 'Tags',
      isActive: category.isActive,
      jobTypeId: category.jobTypeId?.toString() || '',
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsCreating(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#3B82F6', icon: 'Tags', isActive: true, jobTypeId: '' })
  }

  const colorOptions = [
    '#EF4444','#F97316','#F59E0B','#EAB308','#84CC16','#22C55E',
    '#10B981','#14B8A6','#06B6D4','#0EA5E9','#3B82F6','#6366F1',
    '#8B5CF6','#A855F7','#D946EF','#EC4899','#6B7280',
  ]

  const iconOptions = [
    { name: 'Monitor', label: 'POS/Monitor' },
    { name: 'Wifi', label: 'Network' },
    { name: 'Router', label: 'Access Point' },
    { name: 'HardDrive', label: 'Hardware' },
    { name: 'Code', label: 'Software' },
    { name: 'Printer', label: 'Printer' },
    { name: 'Camera', label: 'CCTV' },
    { name: 'Smartphone', label: 'Mobile Phone' },
    { name: 'ScanBarcode', label: 'Barcode Scanner' },
    { name: 'MoreHorizontal', label: 'Other' },
    { name: 'Tags', label: 'Default' },
  ]

  const renderIcon = (iconName?: string) => {
    const IconComponent = iconMap[iconName || 'Tags'] || Tags
    return <IconComponent className="w-5 h-5" />
  }

  const renderFormFields = (isEdit = false) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">ชื่อ Category *</label>
        <div className="relative">
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onFocus={() => !isEdit && setShowNameDropdown(true)}
            onBlur={() => setTimeout(() => setShowNameDropdown(false), 150)}
            className={`w-full px-4 py-2 border rounded-lg text-white focus:outline-none focus:ring-2 ${
              !isEdit && nameExactMatch ? 'border-orange-500 focus:ring-orange-500' : 'focus:ring-blue-500'
            } ${isEdit ? 'bg-slate-600/50 border-slate-500' : 'bg-slate-700/50 border-slate-600'}`}
            placeholder="เช่น POS, Network, Hardware"
          />
          {!isEdit && nameExactMatch && (
            <p className="text-xs text-orange-400 mt-0.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> มี Category นี้อยู่แล้ว
            </p>
          )}
          {!isEdit && showNameDropdown && nameSuggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
              {nameSuggestions.map(c => (
                <div
                  key={c.id}
                  onMouseDown={() => { setFormData({ ...formData, name: c.name }); setShowNameDropdown(false) }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-white text-sm flex-1">{c.name}</span>
                  <span className="text-xs text-orange-400">มีอยู่แล้ว</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">คำอธิบาย</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className={`w-full px-4 py-2 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEdit ? 'bg-slate-600/50 border-slate-500' : 'bg-slate-700/50 border-slate-600'}`}
          placeholder="คำอธิบายสั้นๆ"
        />
      </div>

      {/* Job Type selector */}
      <div className="md:col-span-2">
        <label className="block text-sm text-gray-400 mb-1 flex items-center gap-1">
          <Briefcase className="w-3.5 h-3.5" /> อยู่ภายใต้ Job Type
        </label>
        <select
          value={formData.jobTypeId}
          onChange={(e) => setFormData({ ...formData, jobTypeId: e.target.value })}
          className={`w-full px-4 py-2 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEdit ? 'bg-slate-600/50 border-slate-500' : 'bg-slate-700/50 border-slate-600'}`}
        >
          <option value="">ไม่ระบุ (แสดงในทุก Job Type)</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>
              {jt.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-0.5">ถ้าระบุ จะแสดง Category นี้เฉพาะเมื่อเลือก Job Type นั้นในหน้า Create Incident</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">สี</label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`rounded-lg transition-all ${isEdit ? 'w-6 h-6' : 'w-8 h-8'} ${
                formData.color === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">ไอคอน</label>
        <div className="flex flex-wrap gap-2">
          {iconOptions.map((icon) => {
            const IconComponent = iconMap[icon.name] || Tags
            return (
              <button
                key={icon.name}
                type="button"
                onClick={() => setFormData({ ...formData, icon: icon.name })}
                className={`rounded-lg transition-all ${isEdit ? 'p-1.5' : 'p-2'} ${
                  formData.icon === icon.name
                    ? 'bg-blue-500 text-white ring-2 ring-blue-400'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
                title={icon.label}
              >
                <IconComponent className={isEdit ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

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
      <BackButton />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-600/20 rounded-xl">
            <Tags className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Incident Categories</h1>
            <p className="text-gray-400">จัดการประเภทย่อยของงาน พร้อมกำหนด Job Type ที่รองรับ</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {categories.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                สร้างค่าเริ่มต้น
              </button>
            )}
            <button
              onClick={() => { setIsCreating(true); resetForm() }}
              className="flex items-center gap-2 px-4 py-2 hover:brightness-110 text-white rounded-lg transition"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-4 h-4" />
              เพิ่ม Category
            </button>
          </div>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="glass-card p-6 rounded-2xl border-2 border-blue-500/50">
          <h3 className="text-lg font-semibold text-white mb-4">เพิ่ม Category ใหม่</h3>
          {renderFormFields()}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={cancelEditing} className="px-4 py-2 text-gray-400 hover:text-white transition">ยกเลิก</button>
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

      {/* Categories List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-12 text-center">
            <Tags className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">ยังไม่มี Category</h3>
            <p className="text-gray-400 mb-6">เริ่มต้นด้วยการสร้างค่าเริ่มต้น หรือเพิ่ม Category ใหม่ด้วยตัวเอง</p>
            {canManage && (
              <button
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition mx-auto disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                สร้าง Category เริ่มต้น
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'th')).map((category) => (
              <div
                key={category.id}
                className={`p-4 ${!category.isActive ? 'opacity-50' : ''} ${
                  editingId === category.id ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'
                } transition`}
              >
                {editingId === category.id ? (
                  <div className="space-y-4">
                    {renderFormFields(true)}
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEditing} className="p-2 text-gray-400 hover:text-white transition">
                        <X className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleUpdate(category.id)}
                        disabled={isSaving}
                        className="p-2 text-green-400 hover:text-green-300 transition disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                      >
                        {renderIcon(category.icon)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-white">{category.name}</span>
                          {category.jobType && (
                            <span
                              className="px-2 py-0.5 text-xs rounded-full text-white flex-shrink-0"
                              style={{ backgroundColor: category.jobType.color }}
                            >
                              {category.jobType.name}
                            </span>
                          )}
                          {!category.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">ปิดใช้งาน</span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-400 truncate">{category.description}</p>
                        )}
                        {!category.jobTypeId && (
                          <p className="text-xs text-gray-500">แสดงในทุก Job Type</p>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleActive(category)}
                          className={`p-2 rounded-lg transition ${
                            category.isActive ? 'text-green-400 hover:bg-green-500/20' : 'text-gray-400 hover:bg-gray-500/20'
                          }`}
                          title={category.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditing(category)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
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
            <p className="text-blue-400 font-medium">เกี่ยวกับ Incident Categories</p>
            <p className="text-sm text-gray-300">
              Categories ที่ผูกกับ Job Type จะแสดงเฉพาะเมื่อเลือก Job Type นั้นในหน้า Create Incident<br />
              Categories ที่ <strong>ไม่ระบุ Job Type</strong> จะแสดงในทุก Job Type
            </p>
          </div>
        </div>
      </div>

      {!canManage && (
        <div className="flex items-start space-x-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">View Only</p>
            <p className="text-sm text-gray-400">เฉพาะ Super Admin และ IT Manager เท่านั้นที่สามารถจัดการ Categories ได้</p>
          </div>
        </div>
      )}
    </div>
  )
}
