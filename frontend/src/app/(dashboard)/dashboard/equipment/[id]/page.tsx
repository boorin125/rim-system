// app/(dashboard)/dashboard/equipment/[id]/page.tsx - Equipment Detail
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTabState } from '@/hooks/useTabState'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Monitor,
  Printer,
  Router,
  Server,
  Cpu,
  Camera,
  Package,
  Building2,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  History,
  AlertCircle,
  Wrench,
  Tag,
  Hash,
  MapPin,
  Wifi,
  HardDrive,
  Code,
  MoreHorizontal,
  Tags,
  ImageIcon,
  Upload,
  ZoomIn,
  X,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { canPerformAction } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// Icon map matching Settings categories page
const iconMap: Record<string, React.ComponentType<any>> = {
  Monitor,
  Wifi,
  HardDrive,
  Code,
  Printer,
  Camera,
  MoreHorizontal,
  Tags,
  // Legacy fallbacks
  Router,
  Server,
  Cpu,
  Package,
}

// Equipment Status Config
const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  ACTIVE: { label: 'Active', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30', icon: CheckCircle },
  INACTIVE: { label: 'Inactive', color: 'text-gray-400', bgColor: 'bg-gray-500/20 border-gray-500/30', icon: XCircle },
  MAINTENANCE: { label: 'Maintenance', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30', icon: Wrench },
  RETIRED: { label: 'Retired', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30', icon: XCircle },
}

// Warranty Status Config
const warrantyConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'ประกันยังมีผล', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
  EXPIRING_SOON: { label: 'ใกล้หมดประกัน', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30' },
  EXPIRED: { label: 'หมดประกันแล้ว', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' },
  NO_WARRANTY: { label: 'ไม่มีประกัน', color: 'text-gray-400', bgColor: 'bg-gray-500/20 border-gray-500/30' },
}

// Log Action Config
const logActionConfig: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'สร้างใหม่', color: 'text-green-400' },
  UPDATED: { label: 'อัพเดท', color: 'text-blue-400' },
  STATUS_CHANGED: { label: 'เปลี่ยนสถานะ', color: 'text-yellow-400' },
  TRANSFERRED: { label: 'ย้ายสาขา', color: 'text-purple-400' },
  WARRANTY_UPDATED: { label: 'อัพเดทประกัน', color: 'text-orange-400' },
  RETIRED: { label: 'ปลดระวาง', color: 'text-red-400' },
}

export default function EquipmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') === 'store' && searchParams.get('storeId')
    ? `/dashboard/stores/${searchParams.get('storeId')}?tab=equipment`
    : undefined
  const themeHighlight = useThemeHighlight()
  const [equipment, setEquipment] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useTabState<'info' | 'incidents' | 'history'>('info')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [retireModalOpen, setRetireModalOpen] = useState(false)
  const [retireReason, setRetireReason] = useState('')
  const [retireReasonError, setRetireReasonError] = useState('')
  const [isRetiring, setIsRetiring] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [categories, setCategories] = useState<{ id: number; name: string; icon?: string; color: string }[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [showImageLightbox, setShowImageLightbox] = useState(false)

  useEffect(() => {
    // Get current user
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setCurrentUser(JSON.parse(userStr))
    }

    if (params.id) {
      fetchEquipment()
      fetchLogs()
      fetchStatistics()
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
      setCategories((response.data || []).filter((c: any) => c.isActive))
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

      setEquipment(response.data)
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้')
      console.error(error)
      router.push('/dashboard/equipment')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}/logs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setLogs(response.data?.data || [])
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}/statistics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setStatistics(response.data)
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
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
      setEquipment((prev: any) => ({ ...prev, imagePath: res.data.imagePath }))
      toast.success('อัปโหลดรูปสำเร็จ')
    } catch {
      toast.error('ไม่สามารถอัปโหลดรูปได้')
    } finally {
      setImageUploading(false)
      e.target.value = ''
    }
  }

  const handleRequestRetire = async () => {
    if (!retireReason.trim()) {
      setRetireReasonError('กรุณาระบุเหตุผลในการปลดระวาง')
      return
    }
    setRetireReasonError('')
    setIsRetiring(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}/request-retire`,
        { reason: retireReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ส่งคำขอปลดระวางเรียบร้อย รอ IT Manager อนุมัติ')
      setRetireModalOpen(false)
      setRetireReason('')
      setHasPendingRequest(true)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถส่งคำขอปลดระวางได้')
    } finally {
      setIsRetiring(false)
    }
  }

  const handleDeleteRetired = async () => {
    setIsDeleting(true)
    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/${params.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ลบอุปกรณ์ออกจากระบบเรียบร้อยแล้ว')
      router.push('/dashboard/equipment')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถลบอุปกรณ์ได้')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const getCategoryIcon = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName)
    const Icon = (cat?.icon ? iconMap[cat.icon] : null) || Package
    return <Icon className="w-6 h-6" />
  }

  const getCategoryColor = (categoryName: string): string => {
    const cat = categories.find(c => c.name === categoryName)
    return cat?.color || '#6B7280'
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.ACTIVE
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border ${config.bgColor} ${config.color}`}>
        <config.icon className="w-4 h-4" />
        {config.label}
      </span>
    )
  }

  const getWarrantyBadge = (status: string) => {
    const config = warrantyConfig[status] || warrantyConfig.NO_WARRANTY
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border ${config.bgColor} ${config.color}`}>
        <Shield className="w-4 h-4" />
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Permissions - use role-based access
  const canEdit = canPerformAction(currentUser, '/dashboard/equipment', 'edit')
  const canDelete = canPerformAction(currentUser, '/dashboard/equipment', 'delete')
  const isHelpDesk = currentUser?.role === 'HELP_DESK'

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

  if (!equipment) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">ไม่พบข้อมูลอุปกรณ์</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <BackButton href={backHref ?? '/dashboard/equipment'} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-xl"
              style={{
                backgroundColor: getCategoryColor(equipment.category) + '33',
                color: getCategoryColor(equipment.category),
              }}
            >
              {getCategoryIcon(equipment.category)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{equipment.name}</h1>
              <p className="text-gray-400">S/N: {equipment.serialNumber}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {canEdit && (
            <button
              onClick={() => router.push(`/dashboard/equipment/${equipment.id}/edit`)}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              <Edit className="w-4 h-4" />
              <span>แก้ไข</span>
            </button>
          )}
          {canDelete && equipment.status !== 'RETIRED' && (
            equipment.status !== 'INACTIVE' ? (
              // Equipment must be INACTIVE (replaced) before it can be retired
              <span
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-gray-500 border border-slate-600/50 rounded-lg text-sm cursor-not-allowed"
                title="ต้องถูกแทนที่ผ่านฟังก์ชัน Spare Parts ก่อนจึงจะปลดระวางได้"
              >
                <Trash2 className="w-4 h-4" />
                <span>ขอปลดระวาง</span>
              </span>
            ) : hasPendingRequest ? (
              <span className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm">
                <Clock className="w-4 h-4" />
                รอ IT Manager อนุมัติปลดระวาง
              </span>
            ) : (
              <button
                onClick={() => setRetireModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200"
              >
                <Trash2 className="w-4 h-4" />
                <span>ขอปลดระวาง</span>
              </button>
            )
          )}
          {/* HELP_DESK: hard-delete RETIRED equipment */}
          {canDelete && isHelpDesk && equipment.status === 'RETIRED' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition duration-200 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>ลบออกจากระบบ</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700/50 overflow-x-auto scrollbar-hide">
        <nav className="flex space-x-8 min-w-max">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            ข้อมูลอุปกรณ์
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'incidents'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            Incidents ({equipment.incidents?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            ประวัติการเปลี่ยนแปลง ({logs.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-400" />
              ข้อมูลพื้นฐาน
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">ชื่ออุปกรณ์</p>
                  <p className="text-white font-medium">{equipment.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">ประเภท</p>
                  <p className="text-white font-medium">{equipment.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Serial Number</p>
                  <p className="text-blue-400 font-mono">{equipment.serialNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">ตำแหน่งอุปกรณ์</p>
                  <p className={equipment.position ? "text-yellow-400 font-medium" : "text-gray-500"}>
                    {equipment.position || '-'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Brand</p>
                  <p className="text-white">{equipment.brand || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Model</p>
                  <p className="text-white">{equipment.model || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">IP Address</p>
                  <p className={equipment.ipAddress ? 'text-cyan-400 font-mono' : 'text-gray-500'}>
                    {equipment.ipAddress || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Store Info */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-400" />
              ข้อมูลสาขา
            </h2>
            {equipment.store ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">รหัสสาขา</p>
                    <p className="text-white font-medium">{equipment.store.storeCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">ชื่อสาขา</p>
                    <p className="text-white font-medium">{equipment.store.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">จังหวัด</p>
                    <p className="text-white">{equipment.store.province || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">สถานะสาขา</p>
                    <p className="text-white">{equipment.store.storeStatus}</p>
                  </div>
                </div>
                {equipment.store.phone && (
                  <div>
                    <p className="text-sm text-gray-400">เบอร์โทร</p>
                    <p className="text-white">{equipment.store.phone}</p>
                  </div>
                )}
                <button
                  onClick={() => router.push(`/dashboard/stores/${equipment.store.id}`)}
                  className="w-full mt-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg transition-colors text-sm"
                >
                  ดูรายละเอียดสาขา
                </button>
              </div>
            ) : (
              <p className="text-gray-400">ไม่มีข้อมูลสาขา</p>
            )}
          </div>

          {/* Equipment Image */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                รูปภาพอุปกรณ์
              </h2>
              {canPerformAction(currentUser?.role, 'equipment', 'edit') && (
                <label className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg text-xs cursor-pointer transition-colors">
                  {imageUploading ? (
                    <><Clock className="w-3.5 h-3.5 animate-spin" />กำลังอัปโหลด...</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" />{equipment.imagePath ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
                </label>
              )}
            </div>
            {equipment.imagePath ? (
              <div className="relative group cursor-pointer" onClick={() => setShowImageLightbox(true)}>
                <img
                  src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${equipment.imagePath}`}
                  alt="Equipment"
                  className="w-full h-52 object-cover rounded-xl border border-slate-700/50"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
                  <ZoomIn className="w-8 h-8 text-white" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-52 rounded-xl border border-dashed border-slate-600 text-gray-500">
                <ImageIcon className="w-12 h-12 mb-2 opacity-40" />
                <p className="text-sm">ยังไม่มีรูปภาพ</p>
              </div>
            )}
          </div>

          {/* Image Lightbox */}
          {showImageLightbox && equipment.imagePath && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setShowImageLightbox(false)}
            >
              <button className="absolute top-4 right-4 p-2 text-white hover:text-gray-300" onClick={() => setShowImageLightbox(false)}>
                <X className="w-7 h-7" />
              </button>
              <img
                src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${equipment.imagePath}`}
                alt="Equipment"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Purchase & Warranty */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" />
              ข้อมูลการซื้อและประกัน
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">วันที่ซื้อ</p>
                  <p className="text-white">{formatDate(equipment.purchaseDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">วันหมดประกัน</p>
                  <p className={`${
                    equipment.warrantyStatus === 'EXPIRED' ? 'text-red-400' :
                    equipment.warrantyStatus === 'EXPIRING_SOON' ? 'text-yellow-400' :
                    'text-white'
                  }`}>
                    {formatDate(equipment.warrantyExpiry)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400">สถานะประกัน</p>
                {getWarrantyBadge(equipment.warrantyStatus)}
              </div>
            </div>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="glass-card p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                สถิติ Incidents
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Incidents ทั้งหมด</p>
                    <p className="text-2xl font-bold text-white">{statistics.totalIncidents}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Logs ทั้งหมด</p>
                    <p className="text-2xl font-bold text-white">{statistics.totalLogs}</p>
                  </div>
                </div>
                {statistics.incidentsByStatus && Object.keys(statistics.incidentsByStatus).length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">แยกตามสถานะ</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statistics.incidentsByStatus).map(([status, count]) => (
                        <span
                          key={status}
                          className="px-2 py-1 bg-slate-700/50 rounded text-xs text-gray-300"
                        >
                          {status}: {count as number}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {equipment.incidents && equipment.incidents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr className="border-b border-slate-700/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                      Ticket
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                      หัวข้อ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                      สถานะ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                      วันที่สร้าง
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                      วันที่แก้ไข
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.incidents.map((incident: any, index: number) => (
                    <tr
                      key={incident.id}
                      onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                      className={`
                        border-b border-slate-700/30 cursor-pointer transition-all duration-200
                        ${index % 2 === 0
                          ? 'bg-slate-800/30 hover:bg-slate-700/50'
                          : 'bg-slate-700/50 hover:bg-slate-600/60'
                        }
                      `}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-blue-400">
                          {incident.ticketNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-white">{incident.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          incident.status === 'CLOSED' || incident.status === 'RESOLVED'
                            ? 'bg-green-500/20 text-green-400'
                            : incident.status === 'IN_PROGRESS'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {incident.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          incident.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                          incident.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                          incident.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {incident.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {formatDateTime(incident.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">ไม่มี Incidents สำหรับอุปกรณ์นี้</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            ประวัติการเปลี่ยนแปลง
          </h2>
          {logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log, index) => {
                const actionConfig = logActionConfig[log.action] || { label: log.action, color: 'text-gray-400' }
                return (
                  <div
                    key={log.id}
                    className={`flex gap-4 p-4 rounded-lg ${
                      index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${actionConfig.color}`}>
                          {actionConfig.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{log.description}</p>
                      {log.user && (
                        <p className="text-xs text-gray-500 mt-1">
                          โดย: {log.user.firstName} {log.user.lastName} ({log.user.role})
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">ไม่มีประวัติการเปลี่ยนแปลง</p>
            </div>
          )}
        </div>
      )}

      {/* Hard Delete Confirmation Modal (HELP_DESK only) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">ลบอุปกรณ์ออกจากระบบ</h3>
                <p className="text-sm text-red-400">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <p className="text-gray-300 mb-2">
              คุณต้องการลบ{' '}
              <span className="font-semibold text-white">{equipment.name}</span>
              <span className="text-gray-400 text-sm ml-1">(S/N: {equipment.serialNumber})</span>{' '}
              ออกจากระบบถาวรใช่หรือไม่?
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
              <p className="text-red-400 text-xs">
                ข้อมูลอุปกรณ์จะถูกลบออกอย่างถาวร รวมถึงประวัติการเปลี่ยนแปลงทั้งหมด
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteRetired}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition duration-200 disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบอุปกรณ์'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retire Request Modal */}
      {retireModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  ขอปลดระวางอุปกรณ์
                </h3>
                <p className="text-sm text-gray-400">
                  ต้องรอ IT Manager อนุมัติก่อนจึงจะมีผล
                </p>
              </div>
            </div>

            <p className="text-gray-300 mb-4">
              อุปกรณ์:{' '}
              <span className="font-semibold text-white">{equipment.name}</span>
              <span className="text-gray-400 text-sm ml-2">(S/N: {equipment.serialNumber})</span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                เหตุผลในการปลดระวาง <span className="text-red-400">*</span>
              </label>
              <textarea
                value={retireReason}
                onChange={(e) => {
                  setRetireReason(e.target.value)
                  if (retireReasonError) setRetireReasonError('')
                }}
                placeholder="ระบุเหตุผล เช่น อุปกรณ์ชำรุดเกินซ่อม, ครบอายุการใช้งาน, เปลี่ยนใหม่แล้ว..."
                rows={3}
                className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none ${
                  retireReasonError ? 'border-red-500' : 'border-slate-600'
                }`}
              />
              {retireReasonError && (
                <p className="text-red-400 text-sm mt-1">{retireReasonError}</p>
              )}
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
              <p className="text-yellow-400 text-xs">
                คำขอนี้จะถูกส่งไปยัง IT Manager เพื่ออนุมัติ อุปกรณ์จะยังคงใช้งานได้จนกว่าจะได้รับการอนุมัติ
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => { setRetireModalOpen(false); setRetireReason(''); setRetireReasonError('') }}
                disabled={isRetiring}
                className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRequestRetire}
                disabled={isRetiring}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-200 disabled:opacity-50"
              >
                {isRetiring ? 'กำลังส่งคำขอ...' : 'ส่งคำขอปลดระวาง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
