// app/(dashboard)/dashboard/settings/categories/page.tsx - Incident Category Management
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Tags,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  GripVertical,
  Power,
  Sparkles,
  Monitor,
  Wifi,
  HardDrive,
  Code,
  Printer,
  Camera,
  MoreHorizontal,
  Smartphone,
  ScanBarcode,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// Icon mapping for categories
const iconMap: Record<string, React.ComponentType<any>> = {
  Monitor,
  Wifi,
  HardDrive,
  Code,
  Printer,
  Camera,
  MoreHorizontal,
  Tags,
  Smartphone,
  ScanBarcode,
}

interface Category {
  id: number
  name: string
  description?: string
  color: string
  icon?: string
  isActive: boolean
  sortOrder: number
}

export default function CategoriesSettingsPage() {
  const themeHighlight = useThemeHighlight()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
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
    icon: 'Tags',
    isActive: true,
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      const roles = user.roles || (user.role ? [user.role] : [])
      setUserRoles(roles)
    }
    fetchCategories()
  }, [])

  const canManage = userRoles.includes('SUPER_ADMIN') || userRoles.includes('IT_MANAGER')

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories?includeInactive=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCategories(response.data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('ไม่สามารถโหลดข้อมูล Category ได้')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อ Category')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/categories`,
        formData,
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
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อ Category')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`,
        formData,
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
    } catch (error: any) {
      toast.error('ไม่สามารถเปลี่ยนสถานะ Category ได้')
    }
  }

  const handleSeedDefaults = async () => {
    if (!confirm('ยืนยันการสร้าง Category เริ่มต้น? หากมีอยู่แล้วจะไม่ถูกเขียนทับ')) return

    setIsSeeding(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
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
      icon: 'Tags',
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

  const iconOptions = [
    { name: 'Monitor', label: 'POS/Monitor' },
    { name: 'Wifi', label: 'Network' },
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
          <div className="p-3 bg-blue-600/20 rounded-xl">
            <Tags className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Incident Categories</h1>
            <p className="text-gray-400">จัดการประเภทงานสำหรับ Incident</p>
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
              เพิ่ม Category
            </button>
          </div>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="glass-card p-6 rounded-2xl border-2 border-blue-500/50">
          <h3 className="text-lg font-semibold text-white mb-4">เพิ่ม Category ใหม่</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">ชื่อ Category *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น POS, Network, Hardware"
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
            <div>
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
                      className={`p-2 rounded-lg transition-all ${
                        formData.icon === icon.name
                          ? 'bg-blue-500 text-white ring-2 ring-blue-400'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                      title={icon.label}
                    >
                      <IconComponent className="w-5 h-5" />
                    </button>
                  )
                })}
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

      {/* Categories List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-12 text-center">
            <Tags className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">ยังไม่มี Category</h3>
            <p className="text-gray-400 mb-6">
              เริ่มต้นด้วยการสร้างค่าเริ่มต้น หรือเพิ่ม Category ใหม่ด้วยตัวเอง
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
                สร้าง Category เริ่มต้น
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`p-4 ${
                  !category.isActive ? 'opacity-50' : ''
                } ${editingId === category.id ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'} transition`}
              >
                {editingId === category.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">ชื่อ Category *</label>
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
                      <div>
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
                                className={`p-1.5 rounded transition-all ${
                                  formData.icon === icon.name
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                }`}
                                title={icon.label}
                              >
                                <IconComponent className="w-4 h-4" />
                              </button>
                            )
                          })}
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
                        onClick={() => handleUpdate(category.id)}
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
                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                      >
                        {renderIcon(category.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{category.name}</span>
                          {!category.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">
                              ปิดใช้งาน
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-400">{category.description}</p>
                        )}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(category)}
                          className={`p-2 rounded-lg transition ${
                            category.isActive
                              ? 'text-green-400 hover:bg-green-500/20'
                              : 'text-gray-400 hover:bg-gray-500/20'
                          }`}
                          title={category.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditing(category)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
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
            <p className="text-blue-400 font-medium">เกี่ยวกับ Incident Categories</p>
            <p className="text-sm text-gray-300">
              Categories ใช้สำหรับจัดกลุ่มประเภทของ Incident เช่น POS, Network, Hardware เป็นต้น
              การปิดใช้งาน Category จะทำให้ไม่สามารถเลือกได้ตอนสร้าง Incident ใหม่ แต่ Incident เก่าที่ใช้อยู่จะยังคงแสดงผลได้ปกติ
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
              เฉพาะ Super Admin และ IT Manager เท่านั้นที่สามารถจัดการ Categories ได้
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
