// app/(dashboard)/dashboard/stores/page.tsx - Store Management
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Plus,
  Search,
  Building2,
  Store,
  MapPin,
  Phone,
  Download,
  Upload,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { isViewOnly, canPerformAction, getUserRoles } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

export default function StoresPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const FILTER_STORAGE_KEY = 'storeFilters'
  const LAST_PATH_KEY = 'storeLastPath'

  const getSavedFilters = () => {
    try {
      // Check if user came from a store sub-page (detail/edit/new/import)
      const lastPath = sessionStorage.getItem(LAST_PATH_KEY) || ''
      const fromStoreSubPage = lastPath.startsWith('/dashboard/stores/')
      if (!fromStoreSubPage) {
        sessionStorage.removeItem(FILTER_STORAGE_KEY)
        return null
      }
      const saved = sessionStorage.getItem(FILTER_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  }

  const savedFilters = getSavedFilters()

  // Navigate to store sub-page while marking origin so filters persist on return
  const navigateToStore = (path: string) => {
    try { sessionStorage.setItem(LAST_PATH_KEY, path) } catch {}
    router.push(path)
  }

  const [stores, setStores] = useState<any[]>([])
  const [filteredStores, setFilteredStores] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(savedFilters?.searchTerm || '')
  const [filterStatus, setFilterStatus] = useState(savedFilters?.filterStatus || 'ALL')
  const [filterProvince, setFilterProvince] = useState(savedFilters?.filterProvince || 'ALL')
  const [filterServiceCenter, setFilterServiceCenter] = useState(savedFilters?.filterServiceCenter || 'ALL')
  const [filterStoreType, setFilterStoreType] = useState(savedFilters?.filterStoreType || 'ALL')
  const [currentPage, setCurrentPage] = useState(savedFilters?.currentPage || 1)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const itemsPerPage = 12

  useEffect(() => {
    // Get current user from localStorage
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      // Block Outsource technicians from accessing this page
      const roles: string[] = (user.roles || []).map((r: any) =>
        typeof r === 'string' ? r : r?.role ?? ''
      )
      if (roles.includes('TECHNICIAN') && user.technicianType === 'OUTSOURCE') {
        router.replace('/dashboard/incidents')
        return
      }
    }

    fetchStores()
  }, [])

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        searchTerm, filterStatus, filterProvince, filterServiceCenter, filterStoreType, currentPage,
      }))
    } catch {}
  }, [searchTerm, filterStatus, filterProvince, filterServiceCenter, filterStoreType, currentPage])

  useEffect(() => {
    filterStoresData()
  }, [stores, searchTerm, filterStatus, filterProvince, filterServiceCenter, filterStoreType])

  const fetchStores = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores?limit=1000`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      // Backend returns { data: [], meta: {} }
      setStores(response.data?.data || [])
    } catch (error: any) {
      toast.error('Failed to load stores')
      console.error(error)
      setStores([])
    } finally {
      setIsLoading(false)
    }
  }

  const filterStoresData = () => {
    if (!Array.isArray(stores)) return
    let filtered = [...stores]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (store) =>
          store.storeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.province?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.district?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter((store) => store.storeStatus === filterStatus)
    }

    // Province filter
    if (filterProvince !== 'ALL') {
      filtered = filtered.filter((store) => store.province?.toUpperCase().trim() === filterProvince)
    }

    // Service Center filter
    if (filterServiceCenter !== 'ALL') {
      filtered = filtered.filter((store) => store.company === filterServiceCenter)
    }

    // Store Type filter
    if (filterStoreType !== 'ALL') {
      filtered = filtered.filter((store) => store.storeType === filterStoreType)
    }

    setFilteredStores(filtered)
    setCurrentPage(1)
  }

  const handleCopyPhone = (phone: string) => {
    if (!phone) {
      toast.error('No phone number available')
      return
    }
    navigator.clipboard.writeText(phone)
    toast.success('Phone number copied to clipboard')
  }

  const handleOpenGoogleMaps = (latitude?: number, longitude?: number) => {
    if (!latitude || !longitude) {
      toast.error('No location coordinates available')
      return
    }
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank')
  }

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `stores_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Stores exported successfully')
    } catch (error: any) {
      toast.error('Failed to export stores')
      console.error(error)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: any = {
      ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
      TEMPORARILY_CLOSED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      PERMANENTLY_CLOSED: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return badges[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const getStatusLabel = (status: string) => {
    const labels: any = {
      ACTIVE: 'Active',
      TEMPORARILY_CLOSED: 'Temp. Closed',
      PERMANENTLY_CLOSED: 'Perm. Closed',
    }
    return labels[status] || status
  }

  // Pagination
  const totalPages = Math.ceil(filteredStores.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentStores = filteredStores.slice(startIndex, endIndex)

  // Get unique values for filters
  const provinces = Array.isArray(stores)
    ? Array.from(new Set(stores.map(s => s.province).filter(Boolean).map((p: string) => p.toUpperCase().trim()))).sort()
    : []

  const customers = Array.isArray(stores)
    ? Array.from(new Set(stores.map(s => s.company).filter(Boolean))).sort()
    : []

  const storeTypes = ['PERMANENT', 'POP_UP', 'SEASONAL']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading stores...</p>
        </div>
      </div>
    )
  }

  // Check permissions using role-based access
  const isSuperAdmin = getUserRoles(currentUser).includes('SUPER_ADMIN')
  const viewOnly = isViewOnly(currentUser, '/dashboard/stores')
  const canCreate = canPerformAction(currentUser, '/dashboard/stores', 'create')
  const canImport = canPerformAction(currentUser, '/dashboard/stores/import', 'create') // SUPER_ADMIN only
  const isITManager = getUserRoles(currentUser).includes('IT_MANAGER')

  // Calculate store statistics from filtered results
  const storeStats = {
    total: filteredStores.length,
    active: filteredStores.filter(s => s.storeStatus === 'ACTIVE').length,
    tempClosed: filteredStores.filter(s => s.storeStatus === 'TEMPORARILY_CLOSED').length,
    permClosed: filteredStores.filter(s => s.storeStatus === 'PERMANENTLY_CLOSED').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Store Management</h1>
          <p className="text-gray-400 mt-1 text-sm">Manage store locations and information</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin ? (
            <button
              onClick={() => navigateToStore('/dashboard/stores/import')}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200 text-sm"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Import Stores</span>
            </button>
          ) : (
            <>
              {isITManager && (
                <button
                  onClick={() => navigateToStore('/dashboard/stores/delete-requests')}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition duration-200 text-sm"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Delete Requests</span>
                </button>
              )}
              {viewOnly && (
                <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium">
                  View Only
                </span>
              )}
              {canCreate && !viewOnly && (
                <>
                  <button
                    onClick={() => navigateToStore('/dashboard/stores/new')}
                    className="flex items-center gap-2 px-3 py-2 hover:brightness-110 text-white rounded-lg transition duration-200 text-sm"
                    style={{ backgroundColor: themeHighlight }}
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Add Store</span>
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition duration-200 text-sm"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </>
              )}
              {canImport && (
                <button
                  onClick={() => navigateToStore('/dashboard/stores/import')}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200 text-sm"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Import</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Stores */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">ทั้งหมด</p>
              <p className="text-2xl font-bold text-white">{storeStats.total}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Active Stores */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-400">{storeStats.active}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Store className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        {/* Temporarily Closed */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Temp. Closed</p>
              <p className="text-2xl font-bold text-yellow-400">{storeStats.tempClosed}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Store className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Permanently Closed */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Perm. Closed</p>
              <p className="text-2xl font-bold text-red-400">{storeStats.permClosed}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Store className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 rounded-2xl sticky top-0 z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search stores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={filterServiceCenter}
              onChange={(e) => setFilterServiceCenter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Province Filter */}
          <div>
            <select
              value={filterProvince}
              onChange={(e) => setFilterProvince(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Provinces</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>

          {/* Store Type Filter */}
          <div>
            <select
              value={filterStoreType}
              onChange={(e) => setFilterStoreType(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Store Types</option>
              <option value="PERMANENT">Permanent</option>
              <option value="POP_UP">Pop-up</option>
              <option value="SEASONAL">Seasonal</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
              <option value="PERMANENTLY_CLOSED">Permanently Closed</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredStores.length)} of{' '}
            {filteredStores.length} stores
          </p>
        </div>
      </div>

      {/* Stores Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/80 border-b border-slate-600">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Store Code
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Store Name
                </th>
                <th className="hidden sm:table-cell px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Province
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Service Center
                </th>
                <th className="hidden sm:table-cell px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Phone
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Location
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Operating Hours
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Store Type
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Store Status
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Last PM
                </th>
              </tr>
            </thead>
            <tbody>
              {currentStores.map((store, index) => {
                // Get current day operating hours
                const currentDay = new Date().getDay()
                const dayFields: { [key: number]: { open: string; close: string } } = {
                  0: { open: 'sundayOpen', close: 'sundayClose' },
                  1: { open: 'mondayOpen', close: 'mondayClose' },
                  2: { open: 'tuesdayOpen', close: 'tuesdayClose' },
                  3: { open: 'wednesdayOpen', close: 'wednesdayClose' },
                  4: { open: 'thursdayOpen', close: 'thursdayClose' },
                  5: { open: 'fridayOpen', close: 'fridayClose' },
                  6: { open: 'saturdayOpen', close: 'saturdayClose' },
                }
                const todayFields = dayFields[currentDay]
                const todayOpen = store[todayFields.open]
                const todayClose = store[todayFields.close]
                const todayHours = todayOpen && todayClose ? `${todayOpen} - ${todayClose}` : null

                return (
                  <tr
                    key={store.id}
                    onClick={() => navigateToStore(`/dashboard/stores/${store.id}`)}
                    className={`
                      border-b border-slate-700/30 cursor-pointer transition-all duration-200
                      ${index % 2 === 0
                        ? 'bg-slate-800/30 hover:bg-slate-700/50'
                        : 'bg-slate-700/50 hover:bg-slate-600/60'
                      }
                    `}
                  >
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span className="text-sm font-semibold text-blue-400">
                          {store.storeCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="text-sm font-medium text-white max-w-[120px] sm:max-w-xs truncate">
                        {store.name}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">
                      <span className="text-sm text-gray-300">
                        {store.province || '-'}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <span className="text-sm text-gray-300">
                        {store.serviceCenter || '-'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2">
                        {store.phone ? (
                          <>
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">{store.phone}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyPhone(store.phone)
                              }}
                              className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                              title="Copy phone number"
                            >
                              <Copy className="w-3 h-3 text-gray-400 hover:text-blue-400" />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      {(store.latitude && store.longitude) || store.googleMapLink ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (store.googleMapLink) {
                              window.open(store.googleMapLink, '_blank')
                            } else {
                              handleOpenGoogleMaps(store.latitude, store.longitude)
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors text-sm"
                          title="Open in Google Maps"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>View Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      {todayHours ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm">
                          <span className="text-xs text-blue-300">วันนี้</span>
                          <span className="font-medium">{todayHours}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm">
                          <span>ปิดทำการ</span>
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          store.storeType === 'PERMANENT'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : store.storeType === 'POP_UP'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : store.storeType === 'SEASONAL'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}
                      >
                        {store.storeType === 'PERMANENT' ? 'Permanent' :
                         store.storeType === 'POP_UP' ? 'Pop-up' :
                         store.storeType === 'SEASONAL' ? 'Seasonal' :
                         store.storeType || '-'}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getStatusBadge(
                          store.storeStatus
                        )}`}
                      >
                        {getStatusLabel(store.storeStatus)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                      {store.lastPmAt ? (
                        <span className="text-xs text-purple-300">
                          {new Date(store.lastPmAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {currentStores.length === 0 && (
        <div className="glass-card p-12 rounded-2xl text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-xl font-semibold text-white mb-2">No stores found</h3>
          <p className="text-gray-400 mb-4">
            {searchTerm || filterStatus !== 'ALL' || filterProvince !== 'ALL' || filterServiceCenter !== 'ALL' || filterStoreType !== 'ALL'
              ? 'Try adjusting your filters'
              : 'Get started by adding your first store'}
          </p>
          {canCreate && !viewOnly && !searchTerm && filterStatus === 'ALL' && filterProvince === 'ALL' && filterServiceCenter === 'ALL' && filterStoreType === 'ALL' && (
            <button
              onClick={() => navigateToStore('/dashboard/stores/new')}
              className="inline-flex items-center gap-2 px-6 py-3 hover:brightness-110 text-white rounded-lg transition-colors"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-5 h-5" />
              Add First Store
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* Page info */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/40 border border-slate-600/50 rounded-lg">
            <span className="text-xs text-gray-400">แสดง</span>
            <span className="text-sm font-semibold text-white">{startIndex + 1}–{Math.min(endIndex, filteredStores.length)}</span>
            <span className="text-xs text-gray-400">จาก</span>
            <span className="text-sm font-semibold text-white">{filteredStores.length}</span>
            <span className="text-xs text-gray-400">สาขา</span>
            <span className="w-px h-4 bg-slate-600"></span>
            <span className="text-xs text-gray-400">หน้า</span>
            <span className="text-sm font-semibold text-white">{currentPage}</span>
            <span className="text-xs text-gray-400">/</span>
            <span className="text-sm font-semibold text-white">{totalPages}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="หน้าแรก"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((prev: number) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-2 sm:px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">ก่อนหน้า</span>
            </button>

            {/* Page numbers — 3 on mobile, 5 on sm, 7 on lg */}
            <div className="flex items-center gap-1">
              {(() => {
                const maxVisible = typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 5
                let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                let endPage = Math.min(totalPages, startPage + maxVisible - 1)
                if (endPage - startPage + 1 < maxVisible) {
                  startPage = Math.max(1, endPage - maxVisible + 1)
                }
                const pages = []
                for (let i = startPage; i <= endPage; i++) pages.push(i)
                return pages.map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page ? 'text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                    style={currentPage === page ? { backgroundColor: themeHighlight } : undefined}
                  >
                    {page}
                  </button>
                ))
              })()}
            </div>

            <button
              onClick={() => setCurrentPage((prev: number) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-2 sm:px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <span className="hidden sm:inline">ถัดไป</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="หน้าสุดท้าย"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
