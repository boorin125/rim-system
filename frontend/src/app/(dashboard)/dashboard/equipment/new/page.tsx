// app/(dashboard)/dashboard/equipment/new/page.tsx - Create Equipment
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save,
  Building2,
  Shield,
  Tag,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import StoreAutocomplete from '@/components/StoreAutocomplete'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { canPerformAction } from '@/config/permissions'

// Statuses list
const statuses = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
]

export default function CreateEquipmentPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(false)
  const [stores, setStores] = useState<any[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Form state - เรียงตามลำดับ: Name, Category, Brand, Model, Serial Number, Status
  const [formData, setFormData] = useState({
    name: '',           // ชื่ออุปกรณ์รวมตำแหน่ง เช่น "POS#1 Printer"
    category: '',
    brand: '',
    model: '',
    serialNumber: '',
    ipAddress: '',
    status: 'ACTIVE',
    purchaseDate: '',
    warrantyExpiry: '',
    storeId: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Get current user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      // Check permission using role-based access
      if (!canPerformAction(user, '/dashboard/equipment', 'create')) {
        toast.error('คุณไม่มีสิทธิ์เพิ่มอุปกรณ์')
        router.push('/dashboard/equipment')
        return
      }
    }

    fetchStores()
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const list = (response.data || []).filter((c: any) => c.isActive)
      setCategories(list)
      if (list.length > 0 && !formData.category) {
        setFormData((prev) => ({ ...prev, category: list[0].name }))
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores?limit=1000`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setStores(response.data?.data || [])
    } catch (error) {
      console.error('Failed to fetch stores:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Clear error when field changes
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.serialNumber.trim()) {
      newErrors.serialNumber = 'กรุณากรอก Serial Number'
    } else if (formData.serialNumber.length < 3) {
      newErrors.serialNumber = 'Serial Number ต้องมีอย่างน้อย 3 ตัวอักษร'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่ออุปกรณ์'
    }

    if (!formData.category) {
      newErrors.category = 'กรุณาเลือกประเภท'
    }

    if (!formData.storeId) {
      newErrors.storeId = 'กรุณาเลือกสาขา'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')

      // Prepare data
      const submitData: any = {
        name: formData.name.trim(),
        category: formData.category,
        serialNumber: formData.serialNumber.trim(),
        status: formData.status,
        storeId: parseInt(formData.storeId),
      }

      if (formData.brand) submitData.brand = formData.brand.trim()
      if (formData.model) submitData.model = formData.model.trim()
      if (formData.ipAddress) submitData.ipAddress = formData.ipAddress.trim()
      if (formData.purchaseDate) submitData.purchaseDate = formData.purchaseDate
      if (formData.warrantyExpiry) submitData.warrantyExpiry = formData.warrantyExpiry

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment`,
        submitData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('เพิ่มอุปกรณ์สำเร็จ')
      router.push('/dashboard/equipment')
    } catch (error: any) {
      const message = error.response?.data?.message || 'ไม่สามารถเพิ่มอุปกรณ์ได้'
      toast.error(message)
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Back Button */}
      <BackButton href="/dashboard/equipment" label="กลับไปหน้า Equipment" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">เพิ่มอุปกรณ์ใหม่</h1>
        <p className="text-gray-400">กรอกข้อมูลอุปกรณ์ IT</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-400" />
            ข้อมูลพื้นฐาน
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name - ชื่ออุปกรณ์รวมตำแหน่ง */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ชื่ออุปกรณ์ <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="เช่น POS#1 Printer, Kitchen Printer#1, Cashier#2 Terminal"
                className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-slate-600'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                ระบุชื่อและตำแหน่งของอุปกรณ์ เช่น "POS#1 Printer" หรือ "Kitchen Thermal Printer"
              </p>
              {errors.name && (
                <p className="text-red-400 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Category - ประเภท */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ประเภท <span className="text-red-400">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white ${
                  errors.category ? 'border-red-500' : 'border-slate-600'
                }`}
              >
                <option value="">-- เลือกประเภท --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-400 text-sm mt-1">{errors.category}</p>
              )}
            </div>

            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Brand
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="เช่น Epson, Dell, HP"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Model
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="เช่น TM-T88, Optiplex 7020"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Serial Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Serial Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="เช่น 12345678"
                className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.serialNumber ? 'border-red-500' : 'border-slate-600'
                }`}
              />
              {errors.serialNumber && (
                <p className="text-red-400 text-sm mt-1">{errors.serialNumber}</p>
              )}
            </div>

            {/* IP Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                IP Address
              </label>
              <input
                type="text"
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleChange}
                placeholder="เช่น 192.168.1.101"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                สถานะ
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Store */}
        <div className="glass-card p-6 rounded-2xl relative z-10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-400" />
            สาขา
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              เลือกสาขา <span className="text-red-400">*</span>
            </label>
            <StoreAutocomplete
              stores={stores}
              value={formData.storeId}
              onChange={(storeId) =>
                setFormData((prev) => ({ ...prev, storeId }))
              }
              error={errors.storeId}
              placeholder="พิมพ์รหัสสาขา, ชื่อสาขา หรือจังหวัด..."
            />
          </div>
        </div>

        {/* Purchase & Warranty */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            ข้อมูลการซื้อและประกัน
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Purchase Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                วันที่ซื้อ
              </label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Warranty Expiry */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                วันหมดประกัน
              </label>
              <input
                type="date"
                name="warrantyExpiry"
                value={formData.warrantyExpiry}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 text-white rounded-lg transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeHighlight }}
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  )
}
