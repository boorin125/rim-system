// app/(dashboard)/dashboard/equipment/page.tsx - Equipment Management
'use client'

import { formatStore } from '@/utils/formatStore'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTabState } from '@/hooks/useTabState'
import {
  Plus,
  Search,
  Monitor,
  Printer,
  Router,
  Server,
  Cpu,
  Camera,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building2,
  Shield,
  Download,
  Wifi,
  HardDrive,
  Code,
  MoreHorizontal,
  Tags,
  Trash2,
  Smartphone,
  ScanBarcode,
  ArchiveX,
  AlertCircle,
  ZoomIn,
  X,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { isViewOnly, canPerformAction, getUserRoles } from '@/config/permissions'
import ImportEquipmentModal from '@/components/ImportEquipmentModal'
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
  Smartphone,
  ScanBarcode,
  // Legacy fallbacks
  Router,
  Server,
  Cpu,
  Package,
}

// Equipment-specific category → icon (not tied to incident categories)
const equipmentCategoryIcons: Record<string, React.ComponentType<any>> = {
  PPC: Camera,
  HHT: Smartphone,
  'POS Scanner': ScanBarcode,
  'Access Point': Wifi,
}

// Equipment Status Config
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: XCircle },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  RETIRED: { label: 'ปลดระวาง', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: ArchiveX },
}

// Warranty Status Config
const warrantyConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  EXPIRING_SOON: { label: 'Expiring Soon', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  EXPIRED: { label: 'Expired', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  NO_WARRANTY: { label: 'No Warranty', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

type TabKey = 'ACTIVE' | 'INACTIVE' | 'RETIRED'

const TABS: { key: TabKey; label: string; statusFilter: string; icon: React.ComponentType<any>; activeTextColor: string; activeBorderColor: string }[] = [
  {
    key: 'ACTIVE',
    label: 'Active',
    statusFilter: 'ACTIVE,MAINTENANCE',
    icon: CheckCircle,
    activeTextColor: 'text-green-400',
    activeBorderColor: 'border-green-400',
  },
  {
    key: 'INACTIVE',
    label: 'Inactive',
    statusFilter: 'INACTIVE',
    icon: AlertCircle,
    activeTextColor: 'text-gray-300',
    activeBorderColor: 'border-gray-400',
  },
  {
    key: 'RETIRED',
    label: 'ปลดระวาง',
    statusFilter: 'RETIRED',
    icon: ArchiveX,
    activeTextColor: 'text-red-400',
    activeBorderColor: 'border-red-400',
  },
]

export default function EquipmentPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [activeTab, setActiveTab] = useTabState<TabKey>('ACTIVE')
  const [equipment, setEquipment] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterWarranty, setFilterWarranty] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filterStore, setFilterStore] = useState('ALL')
  const [storeSearchText, setStoreSearchText] = useState('')
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  const storeDropdownRef = useRef<HTMLDivElement>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const itemsPerPage = 12

  // The status filter value derived from activeTab
  const currentStatusFilter = TABS.find((t) => t.key === activeTab)!.statusFilter

  useEffect(() => {
    // Get current user from localStorage
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      const roles = getUserRoles(user)
      const higherRoles = ['SUPER_ADMIN', 'IT_MANAGER', 'HELP_DESK', 'SUPERVISOR', 'FINANCE_ADMIN']

      // Block pure technicians (no higher role) from accessing this page
      if (roles.includes('TECHNICIAN') && !roles.some(r => higherRoles.includes(r))) {
        router.replace('/dashboard/incidents')
        return
      }

      // Check if SUPER_ADMIN
      if (roles.includes('SUPER_ADMIN')) {
        setIsLoading(false)
        return
      }
    }

    fetchEquipment()
    fetchStores()
    fetchCategories()
  }, [currentPage, filterCategory, filterStore, activeTab])

  // Close store dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
        setShowStoreDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchEquipment()
      } else {
        setCurrentPage(1)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/distinct-categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCategories(response.data || [])
    } catch (error) {
      console.error('Failed to fetch equipment categories:', error)
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

  const fetchEquipment = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      // Build query params
      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', itemsPerPage.toString())

      if (searchTerm) {
        params.append('search', searchTerm)
      }
      if (filterCategory !== 'ALL') {
        params.append('category', filterCategory)
      }
      // Always filter by active tab
      params.append('status', currentStatusFilter)

      if (filterStore !== 'ALL') {
        params.append('storeId', filterStore)
      }
      if (filterWarranty === 'EXPIRED') {
        params.append('warrantyExpired', 'true')
      } else if (filterWarranty === 'ACTIVE') {
        params.append('warrantyExpired', 'false')
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setEquipment(response.data?.data || [])
      setTotalPages(response.data?.meta?.totalPages || 1)
      setTotalItems(response.data?.meta?.total || 0)
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้')
      console.error(error)
      setEquipment([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  const handleImportSuccess = () => {
    setShowImportModal(false)
    fetchEquipment()
  }

  const getCategoryIcon = (categoryName: string) => {
    const eqIcon = equipmentCategoryIcons[categoryName]
    const Icon = eqIcon || Package
    return <Icon className="w-5 h-5" />
  }

  const getCategoryColor = (_categoryName: string): string => {
    return '#6B7280'
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.ACTIVE
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.color}`}>
        <config.icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const getWarrantyStatus = (warrantyExpiry: string | null) => {
    if (!warrantyExpiry) return 'NO_WARRANTY'

    const now = new Date()
    const expiry = new Date(warrantyExpiry)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) return 'EXPIRED'
    if (daysUntilExpiry <= 30) return 'EXPIRING_SOON'
    return 'ACTIVE'
  }

  const getWarrantyBadge = (warrantyExpiry: string | null) => {
    const status = getWarrantyStatus(warrantyExpiry)
    const config = warrantyConfig[status]
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.color}`}>
        <Shield className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading && equipment.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">กำลังโหลดข้อมูลอุปกรณ์...</p>
        </div>
      </div>
    )
  }

  // Check if SUPER_ADMIN
  if (getUserRoles(currentUser).includes('SUPER_ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-gray-400">
            Super Admin ไม่สามารถเข้าถึงระบบจัดการอุปกรณ์ได้
          </p>
        </div>
      </div>
    )
  }

  // Check permissions using role-based access
  const viewOnly = isViewOnly(currentUser, '/dashboard/equipment')
  const canCreate = canPerformAction(currentUser, '/dashboard/equipment', 'create')

  const isItManager = currentUser?.roles?.some((r: any) => {
    if (typeof r === 'string') return r === 'IT_MANAGER'
    return r?.role === 'IT_MANAGER' || r?.name === 'IT_MANAGER'
  }) || currentUser?.role === 'IT_MANAGER'

  const currentTabConfig = TABS.find((t) => t.key === activeTab)!

  // Empty state messages per tab
  const emptyMessages: Record<TabKey, string> = {
    ACTIVE: 'ไม่พบอุปกรณ์ที่ใช้งานอยู่',
    INACTIVE: 'ไม่มีอุปกรณ์ที่ถูกแทนที่จาก Spare Part',
    RETIRED: 'ไม่มีอุปกรณ์ที่ถูกปลดระวาง',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipment Management</h1>
          <p className="text-gray-400 mt-1">
            จัดการอุปกรณ์ IT ทั้งหมดในระบบ
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewOnly && (
            <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium">
              View Only
            </span>
          )}

          {/* Retirement Requests Button (IT Manager) */}
          {isItManager && (
            <button
              onClick={() => router.push('/dashboard/equipment/retirement-requests')}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition duration-200"
              title="คำขอปลดระวางอุปกรณ์"
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden sm:inline">คำขอปลดระวาง</span>
            </button>
          )}

          {/* Inventory Management Button */}
          {!viewOnly && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg transition duration-200"
              title="จัดการ Inventory (Import/Export)"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Inventory</span>
            </button>
          )}

          {/* Add Equipment Button */}
          {canCreate && !viewOnly && (
            <button
              onClick={() => router.push('/dashboard/equipment/new')}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-5 h-5" />
              <span>เพิ่มอุปกรณ์</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700/50 overflow-x-auto scrollbar-hide">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? `${tab.activeBorderColor} ${tab.activeTextColor}`
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 rounded-2xl sticky top-0 z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, S/N..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">ทุกประเภท</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Store Filter — live search */}
          <div className="relative" ref={storeDropdownRef}>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาสาขา..."
                value={storeSearchText}
                onChange={(e) => {
                  setStoreSearchText(e.target.value)
                  setShowStoreDropdown(true)
                  if (e.target.value === '') {
                    setFilterStore('ALL')
                  }
                }}
                onFocus={() => setShowStoreDropdown(true)}
                className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {storeSearchText && (
                <button
                  onClick={() => {
                    setStoreSearchText('')
                    setFilterStore('ALL')
                    setShowStoreDropdown(false)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
            {showStoreDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                <div
                  className="px-4 py-2.5 text-sm text-gray-300 hover:bg-slate-700 cursor-pointer"
                  onMouseDown={() => {
                    setFilterStore('ALL')
                    setStoreSearchText('')
                    setShowStoreDropdown(false)
                  }}
                >
                  ทุกสาขา
                </div>
                {stores
                  .filter((s) => {
                    const q = storeSearchText.toLowerCase()
                    return (
                      !q ||
                      s.storeCode?.toLowerCase().includes(q) ||
                      s.name?.toLowerCase().includes(q)
                    )
                  })
                  .slice(0, 50)
                  .map((store) => (
                    <div
                      key={store.id}
                      onMouseDown={() => {
                        setFilterStore(String(store.id))
                        setStoreSearchText(formatStore(store))
                        setShowStoreDropdown(false)
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        filterStore === String(store.id)
                          ? 'bg-blue-600/30 text-blue-300'
                          : 'text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      {formatStore(store)}
                    </div>
                  ))}
                {stores.filter((s) => {
                  const q = storeSearchText.toLowerCase()
                  return !q || s.storeCode?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)
                }).length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">ไม่พบสาขา</div>
                )}
              </div>
            )}
          </div>

          {/* Warranty Filter */}
          <div>
            <select
              value={filterWarranty}
              onChange={(e) => setFilterWarranty(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">ประกันทุกสถานะ</option>
              <option value="ACTIVE">ประกันยังมีผล</option>
              <option value="EXPIRED">ประกันหมดอายุ</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <div className="flex items-center gap-2">
            <currentTabConfig.icon className={`w-4 h-4 ${currentTabConfig.activeTextColor}`} />
            <p className="text-sm text-gray-400">
              {currentTabConfig.label}:&nbsp;
              <span className="text-white font-medium">{totalItems}</span> รายการ
              {totalItems > 0 && (
                <span className="ml-2 text-gray-500">
                  (แสดง {equipment.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                  {Math.min(currentPage * itemsPerPage, totalItems)})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {equipment.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <currentTabConfig.icon className={`w-16 h-16 mx-auto mb-4 ${currentTabConfig.color} opacity-40`} />
            <h3 className="text-xl font-semibold text-white mb-2">{emptyMessages[activeTab]}</h3>
            <p className="text-gray-400 mb-4">
              {searchTerm || filterCategory !== 'ALL' || filterStore !== 'ALL'
                ? 'ลองปรับตัวกรองใหม่'
                : activeTab === 'ACTIVE'
                ? 'เริ่มต้นโดยการเพิ่มอุปกรณ์ชิ้นแรก'
                : activeTab === 'INACTIVE'
                ? 'อุปกรณ์ที่ถูกแทนที่ผ่านฟังก์ชัน Spare Parts จะแสดงที่นี่'
                : 'อุปกรณ์ที่ผ่านกระบวนการปลดระวางจะแสดงที่นี่'}
            </p>
            {canCreate && !viewOnly && !searchTerm && filterCategory === 'ALL' && activeTab === 'ACTIVE' && (
              <button
                onClick={() => router.push('/dashboard/equipment/new')}
                className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg transition hover:brightness-110"
                style={{ backgroundColor: themeHighlight }}
              >
                <Plus className="w-5 h-5" />
                เพิ่มอุปกรณ์ชิ้นแรก
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/80 border-b border-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Equipment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Brand / Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Serial Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Store
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Warranty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Picture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Incidents
                  </th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/dashboard/equipment/${item.id}`)}
                    className={`
                      border-b border-slate-700/30 cursor-pointer transition-all duration-200
                      ${index % 2 === 0
                        ? 'bg-slate-800/30 hover:bg-slate-700/50'
                        : 'bg-slate-700/50 hover:bg-slate-600/60'
                      }
                      ${activeTab === 'RETIRED' ? 'opacity-75' : ''}
                    `}
                  >
                    {/* Equipment */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: getCategoryColor(item.category) + '33',
                            color: getCategoryColor(item.category),
                          }}
                        >
                          {getCategoryIcon(item.category)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.category}</p>
                        </div>
                      </div>
                    </td>

                    {/* Brand / Model */}
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-white">{item.brand || '-'}</p>
                        <p className="text-xs text-gray-400">{item.model || '-'}</p>
                      </div>
                    </td>

                    {/* Serial Number */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-white">
                        {item.serialNumber}
                      </span>
                    </td>

                    {/* IP Address */}
                    <td className="px-6 py-4">
                      {item.ipAddress ? (
                        <span className="text-sm font-mono text-white">{item.ipAddress}</span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>

                    {/* Store */}
                    <td className="px-6 py-4">
                      {item.store ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm text-white">{formatStore(item.store)}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>

                    {/* Warranty */}
                    <td className="px-6 py-4">
                      <div>
                        {getWarrantyBadge(item.warrantyExpiry)}
                        {item.warrantyExpiry && (
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(item.warrantyExpiry)}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Picture */}
                    <td className="px-6 py-4">
                      {item.imagePath ? (
                        <div
                          className="relative group w-12 h-12 cursor-pointer"
                          onClick={e => { e.stopPropagation(); setPreviewImage(`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${item.imagePath}`) }}
                        >
                          <img
                            src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${item.imagePath}`}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-600"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>

                    {/* Incidents Count */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${
                          (item._count?.incidents || 0) > 5 ? 'text-red-400' :
                          (item._count?.incidents || 0) > 2 ? 'text-yellow-400' :
                          'text-gray-400'
                        }`}>
                          {item._count?.incidents || 0}
                        </span>
                        <span className="text-xs text-gray-500">tickets</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number
                if (totalPages <= 5) {
                  page = i + 1
                } else if (currentPage <= 3) {
                  page = i + 1
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i
                } else {
                  page = currentPage - 2 + i
                }

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      currentPage === page
                        ? 'text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                    style={currentPage === page ? { backgroundColor: themeHighlight } : undefined}
                  >
                    {page}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Import Equipment Modal */}
      <ImportEquipmentModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
        stores={stores}
        userRoles={getUserRoles(currentUser)}
      />

      {/* Image Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImage}
            alt="Equipment preview"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
