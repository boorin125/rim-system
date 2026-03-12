// app/(dashboard)/dashboard/equipment/[id]/edit/page.tsx - Edit Equipment
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Save,
  Building2,
  Shield,
  Tag,
  ImageIcon,
  Upload,
  ZoomIn,
  X,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import StoreAutocomplete from '@/components/StoreAutocomplete'
import { canPerformAction } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// Statuses list
const statuses = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
]

export default function EditEquipmentPage() {
  const router = useRouter()
  const params = useParams()
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [showImageLightbox, setShowImageLightbox] = useState(false)

  useEffect(() => {
    // Get current user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      // Check permission using role-based access
      if (!canPerformAction(user, '/dashboard/equipment', 'edit')) {
        toast.error('คุณไม่มีสิทธิ์แก้ไขอุปกรณ์')
        router.push('/dashboard/equipment')
        return
      }
    }

    if (params.id) {
      fetchEquipment()
      fetchStores()
      fetchCategories()
    }
  }, [params.id])

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const list = (response.data || []).filter((c: any) => c.isActive)
      setCategories(list)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchEquipment = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const data = response.data

      setFormData({
        name: data.name || '',
        category: data.category || '',
        brand: data.brand || '',
        model: data.model || '',
        serialNumber: data.serialNumber || '',
        ipAddress: data.ipAddress || '',
        status: data.status || 'ACTIVE',
        purchaseDate: data.purchaseDate ? data.purchaseDate.split('T')[0] : '',
        warrantyExpiry: data.warrantyExpiry ? data.warrantyExpiry.split('T')[0] : '',
        storeId: data.storeId?.toString() || '',
      })
      setImagePath(data.imagePath || null)
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้')
      console.error(error)
      router.push('/dashboard/equipment')
    } finally {
      setIsLoading(false)
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)
      const res = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}/image`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      )
      setImagePath(res.data.imagePath)
      toast.success('อัปโหลดรูปสำเร็จ')
    } catch {
      toast.error('อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setImageUploading(false)
      e.target.value = ''
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

    setIsSaving(true)

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

      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}`,
        submitData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('แก้ไขอุปกรณ์สำเร็จ')
      router.push(`/dashboard/equipment/${params.id}`)
    } catch (error: any) {
      const message = error.response?.data?.message || 'ไม่สามารถแก้ไขอุปกรณ์ได้'
      toast.error(message)
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Back Button */}
      <BackButton href={`/dashboard/equipment/${params.id}`} label="กลับไปหน้ารายละเอียด" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">แก้ไขอุปกรณ์</h1>
        <p className="text-gray-400">S/N: {formData.serialNumber}</p>
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
        <div className="glass-card p-6 rounded-2xl">
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

        {/* Equipment Photo */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              รูปภาพอุปกรณ์
            </h2>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm rounded-lg cursor-pointer transition">
              {imageUploading ? (
                <span className="text-xs">กำลังอัปโหลด...</span>
              ) : (
                <><Upload className="w-3.5 h-3.5" />{imagePath ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
            </label>
          </div>

          {imagePath ? (
            <div className="relative group w-40 h-40 cursor-pointer" onClick={() => setShowImageLightbox(true)}>
              <img
                src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${imagePath}`}
                alt="Equipment"
                className="w-40 h-40 object-cover rounded-xl border border-slate-600"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-slate-600 rounded-xl text-gray-500">
              <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
              <span className="text-xs">ยังไม่มีรูป</span>
            </div>
          )}
        </div>

        {/* Lightbox */}
        {showImageLightbox && imagePath && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowImageLightbox(false)}>
            <button className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
            <img
              src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${imagePath}`}
              alt="Equipment"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

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
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 text-white rounded-lg transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeHighlight }}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  )
}
