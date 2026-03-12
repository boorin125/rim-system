// app/(dashboard)/dashboard/incidents/create/page.tsx - Create Incident
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertCircle, Search, X, ChevronDown, Store, Calendar, MessageSquare, AlertTriangle, CheckSquare } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { TimeInput } from '@/components/TimeInput'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { canPerformAction } from '@/config/permissions'
import ParseLineMessageModal from '@/components/ParseLineMessageModal'
import type { ParsedLineMessage } from '@/utils/lineMessageParser'

interface Category {
  id: number
  name: string
  color: string | null
  isActive: boolean
}

interface JobType {
  id: number
  name: string
  color: string | null
  isActive: boolean
}

interface SlaConfig {
  id: number
  priority: string
  name: string
  displayName?: string
  color: string | null
  isActive: boolean
}

interface StoreItem {
  id: number
  name: string
  storeCode: string
  address?: string
  province?: string
}

export default function CreateIncidentPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(false)
  const [stores, setStores] = useState<StoreItem[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [priorities, setPriorities] = useState<SlaConfig[]>([])
  const [equipment, setEquipment] = useState<any[]>([]) // Equipment for selected store
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [showNoEquipmentPopup, setShowNoEquipmentPopup] = useState(false)
  const [hasPermission, setHasPermission] = useState(true)

  // Service Warranty popup
  const [showWarrantyPopup, setShowWarrantyPopup] = useState(false)
  const [warrantyInfo, setWarrantyInfo] = useState<{
    warrantyDays: number
    incident: { id: string; ticketNumber: string; title: string; closedAt: string; storeName: string }
  } | null>(null)

  // Duplicate incident warning (same store + equipment, not yet closed/cancelled)
  const [duplicateIncident, setDuplicateIncident] = useState<{
    id: string; ticketNumber: string; title: string; status: string
  } | null>(null)
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false)

  // PM-specific checks
  const [pmOpenIncident, setPmOpenIncident] = useState<{
    id: string; ticketNumber: string; title: string; status: string
  } | null>(null)
  const [showPmOpenPopup, setShowPmOpenPopup] = useState(false)
  const [pm6MonthInfo, setPm6MonthInfo] = useState<{
    lastPmAt: string; storeCode: string; storeName: string
  } | null>(null)
  const [showPm6MonthPopup, setShowPm6MonthPopup] = useState(false)

  const [currentUser, setCurrentUser] = useState<any>(null)

  // LINE message parse modal
  const [showParseModal, setShowParseModal] = useState(false)

  // Store search states
  const [storeSearchTerm, setStoreSearchTerm] = useState('')
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false)
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null)
  const storeDropdownRef = useRef<HTMLDivElement>(null)

  // Helper function to get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    jobType: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    storeId: '',
    equipmentId: '', // อุปกรณ์ที่เกี่ยวข้อง (ถ้ามี)
    reportedById: '',
    assignedToId: '',
    incidentDateDate: getCurrentDate(), // วันที่ลูกค้าแจ้ง - default วันปัจจุบัน
    incidentDateTime: getCurrentTime(), // เวลาลูกค้าแจ้ง - default เวลาปัจจุบัน
    scheduledAtDate: '', // วันที่นัดเข้าดำเนินการ (Project/Adhoc)
    scheduledAtTime: '', // เวลานัดเข้าดำเนินการ (Project/Adhoc)
  })

  // Close store dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    // Check permissions on mount
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      // Check permission using config - roles with 'full' or 'create_view' access can create
      const canCreate = canPerformAction(user, '/dashboard/incidents', 'create')
      if (!canCreate) {
        setHasPermission(false)
        return
      }

      setHasPermission(true)
    }

    fetchStoresAndUsers()
    fetchCategoriesAndJobTypes()
  }, [])

  const fetchStoresAndUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      const currentUser = userStr ? JSON.parse(userStr) : null

      // Fetch stores - get all stores (high limit to bypass pagination)
      const storesRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores?limit=10000&status=ACTIVE`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      // Backend returns { data: [...], meta: {...} }
      const storesData = storesRes.data?.data || storesRes.data || []
      setStores(Array.isArray(storesData) ? storesData : [])

      // Fetch users
      const usersRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setUsers(usersRes.data)

      // Set current user as reporter
      if (currentUser) {
        setFormData((prev) => ({
          ...prev,
          reportedById: currentUser.id,
        }))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setStores([])
    }
  }

  const fetchCategoriesAndJobTypes = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [categoriesRes, jobTypesRes, slaRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/all`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sla`, { headers }),
      ])

      setCategories(categoriesRes.data)
      setJobTypes(jobTypesRes.data)

      // Filter only active priorities
      const activePriorities = (slaRes.data || []).filter((sla: SlaConfig) => sla.isActive)
      setPriorities(activePriorities)

      // Set default priority if available
      if (activePriorities.length > 0) {
        const mediumPriority = activePriorities.find((p: SlaConfig) => p.priority === 'MEDIUM')
        if (mediumPriority) {
          setFormData(prev => ({ ...prev, priority: mediumPriority.priority }))
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories([])
      setJobTypes([])
      setPriorities([])
    }
  }

  // Filter stores based on search term
  const filteredStores = stores.filter(store => {
    const searchLower = storeSearchTerm.toLowerCase()
    return (
      store.name?.toLowerCase().includes(searchLower) ||
      store.storeCode?.toLowerCase().includes(searchLower) ||
      store.province?.toLowerCase().includes(searchLower)
    )
  })

  // Fetch equipment for a store
  const fetchEquipmentForStore = async (storeId: number, currentJobType?: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment?storeId=${storeId}&status=ACTIVE&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      // Handle both array and paginated response
      const data = response.data
      let list: any[] = []
      if (Array.isArray(data)) {
        list = data
      } else if (data?.data) {
        list = data.data
      }
      setEquipment(list)
      // Show popup if MA job type and no equipment found
      if ((currentJobType || formData.jobType) === 'MA' && list.length === 0) {
        setShowNoEquipmentPopup(true)
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error)
      setEquipment([])
    }
  }

  const handleSelectStore = (store: StoreItem) => {
    setSelectedStore(store)
    setFormData(prev => ({ ...prev, storeId: store.id.toString(), equipmentId: '' }))
    setSelectedEquipmentIds([])
    setEquipmentSearch('')
    setStoreSearchTerm('')
    setIsStoreDropdownOpen(false)
    // Fetch equipment for this store
    fetchEquipmentForStore(store.id)
  }

  const handleClearStore = () => {
    setSelectedStore(null)
    setFormData(prev => ({ ...prev, storeId: '', equipmentId: '' }))
    setSelectedEquipmentIds([])
    setEquipmentSearch('')
    setStoreSearchTerm('')
    setEquipment([])
    setDuplicateIncident(null)
  }

  const handleJobTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, jobType: value }))
    setSelectedEquipmentIds([])
    setEquipmentSearch('')
    // If switching to MA and store already selected but no equipment
    if (value === 'MA' && selectedStore && equipment.length === 0) {
      setShowNoEquipmentPopup(true)
    }
  }

  const checkDuplicate = async (equipmentIds: number[], storeId: string) => {
    if (!equipmentIds.length || !storeId) {
      setDuplicateIncident(null)
      return
    }
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/duplicate-check?equipmentIds=${equipmentIds.join(',')}&storeId=${storeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setDuplicateIncident(res.data?.hasDuplicate ? res.data.incident : null)
    } catch {
      setDuplicateIncident(null)
    }
  }

  const toggleEquipmentSelection = (id: number) => {
    setSelectedEquipmentIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      checkDuplicate(next, formData.storeId)
      return next
    })
  }

  const handleApplyParsed = (parsed: ParsedLineMessage, matchedStore: StoreItem | null) => {
    setFormData(prev => ({
      ...prev,
      title: parsed.title || prev.title,
      description: parsed.rawText || prev.description,
      priority: parsed.priority || prev.priority,
      incidentDateDate: parsed.date || prev.incidentDateDate,
      incidentDateTime: parsed.time || prev.incidentDateTime,
    }))

    // Auto-select store if matched
    if (matchedStore) {
      handleSelectStore(matchedStore)
    }

    toast.success('กรอกข้อมูลจากข้อความสำเร็จ')
  }

  const validateForm = () => {
    if (!formData.title || !formData.description || !formData.category || !formData.jobType) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return false
    }
    if (!formData.storeId) {
      toast.error('กรุณาเลือก Store')
      return false
    }
    if (formData.jobType === 'MA' && selectedEquipmentIds.length === 0) {
      toast.error('งาน MA ต้องระบุอุปกรณ์อย่างน้อย 1 ชิ้น')
      return false
    }
    if (['Project', 'Adhoc'].includes(formData.jobType) && (!formData.scheduledAtDate || !formData.scheduledAtTime)) {
      toast.error('งาน Project และ Adhoc ต้องระบุวัน-เวลาที่เข้าดำเนินการ')
      return false
    }
    if (!formData.incidentDateDate || !formData.incidentDateTime) {
      toast.error('กรุณากรอกวันที่และเวลาลูกค้าแจ้ง')
      return false
    }
    const dt = new Date(`${formData.incidentDateDate}T${formData.incidentDateTime}:00`)
    if (isNaN(dt.getTime())) {
      toast.error('วันที่หรือเวลาไม่ถูกต้อง')
      return false
    }
    return true
  }

  const doActualSubmit = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const incidentDateTime = new Date(`${formData.incidentDateDate}T${formData.incidentDateTime}:00`)

      const payload: any = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        jobType: formData.jobType,
        priority: formData.priority,
        storeId: parseInt(formData.storeId),
        incidentDate: incidentDateTime.toISOString(),
        ...(formData.assignedToId && { assignedToId: parseInt(formData.assignedToId) }),
      }

      if (formData.jobType === 'MA') {
        payload.equipmentIds = selectedEquipmentIds
        payload.equipmentId = selectedEquipmentIds[0]
      } else if (formData.equipmentId) {
        payload.equipmentId = parseInt(formData.equipmentId)
      }

      if (['Project', 'Adhoc'].includes(formData.jobType) && formData.scheduledAtDate && formData.scheduledAtTime) {
        payload.scheduledAt = new Date(`${formData.scheduledAtDate}T${formData.scheduledAtTime}:00`).toISOString()
      }

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success('สร้าง Incident สำเร็จ')
      router.push('/dashboard/incidents')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถสร้าง Incident ได้')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    // ── PM-specific pre-creation checks ──────────────────────────────────────
    if (formData.jobType === 'Preventive Maintenance' && formData.storeId) {
      const token = localStorage.getItem('token')
      try {
        const pmRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/pm/store-check/${formData.storeId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        // 1. Hard-block: open PM incident still exists for this store
        if (pmRes.data?.openPmIncident) {
          setPmOpenIncident(pmRes.data.openPmIncident)
          setShowPmOpenPopup(true)
          return
        }
        // 2. Soft-warn: last PM was less than 6 months ago
        if (pmRes.data?.isWithin6Months) {
          setPm6MonthInfo({
            lastPmAt: pmRes.data.lastPmAt,
            storeCode: pmRes.data.storeCode,
            storeName: pmRes.data.storeName,
          })
          setShowPm6MonthPopup(true)
          return
        }
      } catch {
        // If check fails, proceed normally
      }
    }

    const equipmentIds = formData.jobType === 'MA'
      ? selectedEquipmentIds
      : formData.equipmentId ? [parseInt(formData.equipmentId)] : []

    if (equipmentIds.length > 0 && formData.storeId) {
      const token = localStorage.getItem('token')

      // 1. Hard-block: check for open (non-closed/cancelled) duplicate incident
      try {
        const dupRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/incidents/duplicate-check?equipmentIds=${equipmentIds.join(',')}&storeId=${formData.storeId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (dupRes.data?.hasDuplicate && dupRes.data?.incident) {
          setDuplicateIncident(dupRes.data.incident)
          setShowDuplicatePopup(true)
          return
        }
      } catch {
        // If check fails, proceed normally
      }

      // 2. Soft-warn: check service warranty
      try {
        const warnRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/incidents/warranty-check?equipmentIds=${equipmentIds.join(',')}&storeId=${formData.storeId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (warnRes.data?.hasWarranty && warnRes.data?.incident) {
          setWarrantyInfo({ warrantyDays: warnRes.data.warrantyDays, incident: warnRes.data.incident })
          setShowWarrantyPopup(true)
          return
        }
      } catch {
        // If warranty check fails, proceed normally
      }
    }

    await doActualSubmit()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Permission Check */}
      {!hasPermission ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="glass-card p-8 rounded-2xl max-w-md text-center">
            <div className="p-4 bg-red-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              ไม่มีสิทธิ์ใช้งานฟีเจอร์นี้
            </h2>
            <p className="text-gray-400 mb-6">
              โปรดแจ้งงานผ่าน Help Desk
            </p>
            <button
              onClick={() => router.push('/dashboard/incidents')}
              className="px-6 py-3 text-white rounded-lg transition hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              กลับหน้า Incidents
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Back Button */}
          <BackButton href="/dashboard/incidents" label="กลับไปหน้า Incidents" />

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white">Create New Incident</h1>
            <p className="text-gray-400 mt-1">กรอกรายละเอียดด้านล่าง</p>
          </div>

          {/* Quick Fill from LINE */}
          <button
            type="button"
            onClick={() => setShowParseModal(true)}
            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-purple-900/40 to-blue-900/40 hover:from-purple-900/60 hover:to-blue-900/60 border border-purple-700/50 hover:border-purple-600/70 rounded-2xl transition-all group"
          >
            <div className="p-2.5 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-white">วางข้อความจาก LINE</p>
              <p className="text-xs text-gray-400">ดึงข้อมูลจากข้อความอัตโนมัติ เช่น สาขา, อาการ, SLA, วันเวลา</p>
            </div>
            <div className="text-purple-400/60 group-hover:text-purple-400 transition-colors">
              <ChevronDown className="w-5 h-5 -rotate-90" />
            </div>
          </button>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="glass-card p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4">
                ข้อมูลพื้นฐาน
              </h2>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    หัวข้อ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="อธิบายปัญหาสั้นๆ"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                {/* Incident Date & Time - วันที่และเวลาลูกค้าแจ้ง */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-white" />
                      <span>วันที่และเวลาลูกค้าแจ้ง <span className="text-red-400">*</span></span>
                    </div>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Date Input */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">วันที่</label>
                      <input
                        type="date"
                        value={formData.incidentDateDate}
                        onChange={(e) =>
                          setFormData({ ...formData, incidentDateDate: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                        required
                      />
                    </div>
                    {/* Time Input */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">เวลา</label>
                      <TimeInput
                        value={formData.incidentDateTime}
                        onChange={(v) => setFormData({ ...formData, incidentDateTime: v })}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus-within:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    รายละเอียด <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="อธิบายปัญหาโดยละเอียด"
                    rows={5}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="" className="bg-slate-800">เลือก Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name} className="bg-slate-800">
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Job Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Job Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.jobType}
                    onChange={(e) => handleJobTypeChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="" className="bg-slate-800">เลือก Job Type</option>
                    {jobTypes.map((type) => (
                      <option key={type.id} value={type.name} className="bg-slate-800">
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scheduled Date/Time — required for Project and Adhoc */}
                {['Project', 'Adhoc'].includes(formData.jobType) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      วันเวลาที่กำหนดเข้าดำเนินการ <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={formData.scheduledAtDate}
                        onChange={(e) => setFormData({ ...formData, scheduledAtDate: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                      />
                      <TimeInput
                        value={formData.scheduledAtTime}
                        onChange={(v) => setFormData({ ...formData, scheduledAtTime: v })}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus-within:border-blue-500 transition-colors"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">วันเวลานัดหมายกับลูกค้า / ร้านค้าในการเข้าดำเนินการ</p>
                  </div>
                )}

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  >
                    {priorities.length > 0 ? (
                      priorities.map((sla) => (
                        <option key={sla.id} value={sla.priority} className="bg-slate-800">
                          {sla.displayName || sla.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="LOW" className="bg-slate-800">Low</option>
                        <option value="MEDIUM" className="bg-slate-800">Medium</option>
                        <option value="HIGH" className="bg-slate-800">High</option>
                        <option value="CRITICAL" className="bg-slate-800">Critical</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Assignment */}
            <div className="glass-card p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4">การมอบหมายงาน</h2>

              <div className="space-y-4">
                {/* Store - Searchable */}
                <div ref={storeDropdownRef}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Store <span className="text-red-400">*</span>
                  </label>

                  {selectedStore ? (
                    // Selected store display
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Store className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-white font-medium">{formatStore(selectedStore)}</p>
                          {selectedStore.province && (
                            <p className="text-sm text-gray-400">{selectedStore.province}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearStore}
                        className="p-1 hover:bg-slate-700 rounded transition"
                      >
                        <X className="w-5 h-5 text-gray-400 hover:text-white" />
                      </button>
                    </div>
                  ) : (
                    // Search input
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={storeSearchTerm}
                          onChange={(e) => {
                            setStoreSearchTerm(e.target.value)
                            setIsStoreDropdownOpen(true)
                          }}
                          onFocus={() => setIsStoreDropdownOpen(true)}
                          placeholder="พิมพ์เพื่อค้นหา Store (รหัส, ชื่อ, จังหวัด)"
                          className="w-full pl-10 pr-10 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <ChevronDown
                          className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${isStoreDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </div>

                      {/* Dropdown */}
                      {isStoreDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {filteredStores.length > 0 ? (
                            filteredStores.slice(0, 50).map((store) => (
                              <button
                                key={store.id}
                                type="button"
                                onClick={() => handleSelectStore(store)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-700 transition flex items-center gap-3 border-b border-slate-700/50 last:border-b-0"
                              >
                                <Store className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-white font-medium truncate">
                                    {formatStore(store)}
                                  </p>
                                  {store.province && (
                                    <p className="text-sm text-gray-400 truncate">{store.province}</p>
                                  )}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-400 text-center">
                              {storeSearchTerm ? 'ไม่พบ Store ที่ตรงกัน' : 'พิมพ์เพื่อค้นหา Store'}
                            </div>
                          )}
                          {filteredStores.length > 50 && (
                            <div className="px-4 py-2 text-sm text-gray-500 text-center bg-slate-700/30">
                              แสดง 50 รายการแรก พิมพ์เพิ่มเพื่อกรองผลลัพธ์
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Equipment - conditional on job type */}
                <div>
                  {formData.jobType === 'MA' ? (
                    /* MA: multi-select checkbox list (required) */
                    <>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        อุปกรณ์ที่เกี่ยวข้อง <span className="text-red-400">*</span>
                        <span className="text-xs text-gray-400 font-normal ml-2">(เลือกได้มากกว่า 1 อุปกรณ์)</span>
                      </label>
                      {!selectedStore ? (
                        <p className="text-sm text-gray-500 py-3">เลือก Store ก่อน</p>
                      ) : equipment.length === 0 ? (
                        <div className="flex items-center gap-2 py-3 text-yellow-400 text-sm">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          ไม่มีอุปกรณ์ในสาขานี้
                        </div>
                      ) : (
                        <div className="border border-slate-600 rounded-lg overflow-hidden">
                          {/* Search input */}
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-600 bg-slate-800/60">
                            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <input
                              type="text"
                              value={equipmentSearch}
                              onChange={(e) => setEquipmentSearch(e.target.value)}
                              placeholder="พิมพ์เพื่อค้นหาอุปกรณ์อื่น..."
                              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                            />
                            {equipmentSearch && (
                              <button onClick={() => setEquipmentSearch('')} className="text-gray-500 hover:text-gray-300">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Filtered list */}
                          <div className="max-h-48 overflow-y-auto">
                            {(() => {
                              const q = equipmentSearch.toLowerCase()
                              // Pre-filter by selected category words when search box is empty
                              const catWords = !q && formData.category
                                ? formData.category.toLowerCase().split(/\s+/).filter(Boolean)
                                : []
                              const filtered = q
                                ? equipment.filter(eq =>
                                    eq.name?.toLowerCase().includes(q) ||
                                    eq.serialNumber?.toLowerCase().includes(q) ||
                                    eq.category?.toLowerCase().includes(q) ||
                                    eq.position?.toLowerCase().includes(q)
                                  )
                                : catWords.length > 0
                                  ? equipment.filter(eq =>
                                      catWords.some(word => eq.category?.toLowerCase().includes(word))
                                    )
                                  : equipment
                              return filtered.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-4">ไม่พบอุปกรณ์ที่ค้นหา</p>
                              ) : (
                                filtered.map((eq) => (
                                  <label
                                    key={eq.id}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/40 last:border-b-0"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedEquipmentIds.includes(eq.id)}
                                      onChange={() => toggleEquipmentSelection(eq.id)}
                                      className="w-4 h-4 rounded accent-blue-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white truncate">
                                        {eq.position ? `[${eq.position}] ` : ''}{eq.name}
                                      </p>
                                      <p className="text-xs text-gray-400">{eq.category} · S/N: {eq.serialNumber}</p>
                                    </div>
                                  </label>
                                ))
                              )
                            })()}
                          </div>
                        </div>
                      )}
                      {selectedEquipmentIds.length > 0 && (
                        <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5" />
                          เลือกแล้ว {selectedEquipmentIds.length} อุปกรณ์
                        </p>
                      )}
                    </>
                  ) : (
                    /* Other job types: single optional select */
                    <>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        อุปกรณ์ที่เกี่ยวข้อง (ไม่บังคับ)
                      </label>
                      <select
                        value={formData.equipmentId}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData({ ...formData, equipmentId: val })
                          setDuplicateIncident(null)
                          if (val && formData.storeId) {
                            checkDuplicate([parseInt(val)], formData.storeId)
                          }
                        }}
                        disabled={!selectedStore || equipment.length === 0}
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" className="bg-slate-800">
                          {!selectedStore
                            ? 'เลือก Store ก่อน'
                            : equipment.length === 0
                              ? 'ไม่มีอุปกรณ์ในสาขานี้'
                              : '-- เลือกอุปกรณ์ --'}
                        </option>
                        {equipment.map((eq) => (
                          <option key={eq.id} value={eq.id} className="bg-slate-800">
                            {eq.position ? `[${eq.position}] ` : ''}{eq.name} - {eq.category} (S/N: {eq.serialNumber})
                          </option>
                        ))}
                      </select>
                      {selectedStore && equipment.length > 0 && !duplicateIncident && (
                        <p className="text-xs text-gray-500 mt-1">
                          พบ {equipment.length} อุปกรณ์ในสาขานี้
                        </p>
                      )}
                    </>
                  )}

                  {/* Inline duplicate warning */}
                  {duplicateIncident && (
                    <div className="mt-2 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/40 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="text-sm leading-snug">
                        <span className="text-red-300 font-semibold">มีการแจ้งงานอุปกรณ์นี้แล้วใน </span>
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/incidents/${duplicateIncident.id}`)}
                          className="text-red-200 font-bold underline underline-offset-2 hover:text-white transition"
                        >
                          {duplicateIncident.ticketNumber}
                        </button>
                        <span className="text-red-300"> ต้องปิดงานหรือยกเลิกงานเก่าก่อน</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    มอบหมายให้ (ไม่บังคับ)
                  </label>
                  <select
                    value={formData.assignedToId}
                    onChange={(e) =>
                      setFormData({ ...formData, assignedToId: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="" className="bg-slate-800">ยังไม่มอบหมาย</option>
                    {users
                      .filter(
                        (user) =>
                          user.role === 'TECHNICIAN' ||
                          user.role === 'SUPERVISOR' ||
                          user.role === 'IT_MANAGER'
                      )
                      .map((user) => (
                        <option key={user.id} value={user.id} className="bg-slate-800">
                          {user.firstName} {user.lastName} ({user.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: themeHighlight }}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังสร้าง...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>สร้าง Incident</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* No Equipment Popup */}
          {showNoEquipmentPopup && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 rounded-2xl max-w-sm w-full text-center animate-fade-in">
                <div className="p-3 bg-yellow-500/20 rounded-full w-14 h-14 mx-auto mb-3 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">ไม่มีอุปกรณ์ใน Store นี้</h3>
                <p className="text-gray-400 text-sm mb-5">
                  Store <span className="text-white font-medium">{selectedStore?.name}</span> ยังไม่มีอุปกรณ์ในระบบ
                  งาน MA ต้องระบุอุปกรณ์อย่างน้อย 1 ชิ้น
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNoEquipmentPopup(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/equipment')}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    ไปเพิ่มอุปกรณ์
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Incident Blocking Popup */}
          {showDuplicatePopup && duplicateIncident && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-500/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">อุปกรณ์นี้มีงานที่ยังเปิดอยู่</h3>
                    <p className="text-xs text-red-400">ต้องปิดหรือยกเลิกงานเก่าก่อนสร้างใหม่</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-700/50 rounded-xl mb-5 space-y-2">
                  <p className="text-sm text-gray-300">มีการแจ้งงานอุปกรณ์ดังกล่าวแล้วใน:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicatePopup(false)
                      router.push(`/dashboard/incidents/${duplicateIncident.id}`)
                    }}
                    className="text-left w-full group"
                  >
                    <p className="text-base font-bold text-blue-400 group-hover:text-blue-300 transition underline underline-offset-2">
                      {duplicateIncident.ticketNumber}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">{duplicateIncident.title}</p>
                    <p className="text-xs text-gray-500 mt-1">สถานะ: {duplicateIncident.status}</p>
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-5">
                  กรุณาปิดงานหรือยกเลิกงานข้างต้นก่อน จึงจะสามารถสร้าง Incident ใหม่สำหรับอุปกรณ์นี้ได้
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicatePopup(false)
                      router.push(`/dashboard/incidents/${duplicateIncident.id}`)
                    }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    ไปที่ {duplicateIncident.ticketNumber}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDuplicatePopup(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Service Warranty Popup */}
          {showWarrantyPopup && warrantyInfo && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">อุปกรณ์อยู่ในช่วงรับประกัน</h3>
                    <p className="text-xs text-amber-400">Service Warranty {warrantyInfo.warrantyDays} วัน</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-700/50 rounded-xl mb-5 space-y-2">
                  <p className="text-sm text-gray-300">
                    พบงานที่ปิดไปแล้วภายใน <span className="text-amber-300 font-medium">{warrantyInfo.warrantyDays} วัน</span>:
                  </p>
                  <p className="text-sm">
                    <span className="text-white font-semibold">{warrantyInfo.incident.ticketNumber}</span>
                    {' — '}
                    <span className="text-gray-300">{warrantyInfo.incident.title}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    ปิดงานเมื่อ: {new Date(warrantyInfo.incident.closedAt).toLocaleString('th-TH')}
                  </p>
                  <p className="text-xs text-gray-400">สาขา: {warrantyInfo.incident.storeName}</p>
                </div>
                <p className="text-sm text-gray-300 mb-5">ต้องการ Reopen งานเดิม หรือสร้าง Incident ใหม่?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWarrantyPopup(false)
                      router.push(`/dashboard/incidents/${warrantyInfo.incident.id}`)
                    }}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition"
                  >
                    ไปที่งานเดิม (Reopen)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowWarrantyPopup(false)
                      doActualSubmit()
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
                  >
                    สร้าง Incident ใหม่
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PM — Open Incident Blocking Popup */}
          {showPmOpenPopup && pmOpenIncident && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-500/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">มีงาน PM ที่ยังไม่ปิด</h3>
                    <p className="text-xs text-red-400">ต้องปิดงาน PM เดิมก่อนจึงจะเปิดงานใหม่ได้</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-700/50 rounded-xl mb-5 space-y-2">
                  <p className="text-sm text-gray-300">สาขานี้มีงาน PM ที่ยังเปิดค้างอยู่:</p>
                  <button
                    type="button"
                    onClick={() => { setShowPmOpenPopup(false); router.push(`/dashboard/incidents/${pmOpenIncident.id}`) }}
                    className="text-left w-full group"
                  >
                    <p className="text-base font-bold text-blue-400 group-hover:text-blue-300 transition underline underline-offset-2">
                      {pmOpenIncident.ticketNumber}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">{pmOpenIncident.title}</p>
                    <p className="text-xs text-gray-500 mt-1">สถานะ: {pmOpenIncident.status}</p>
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-5">
                  กรุณาปิดงาน PM ข้างต้นก่อน จึงจะสามารถเปิดคำขอ PM ใหม่สำหรับสาขานี้ได้
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowPmOpenPopup(false); router.push(`/dashboard/incidents/${pmOpenIncident.id}`) }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                  >
                    ไปที่งาน PM เดิม
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPmOpenPopup(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PM — 6-Month Interval Warning Popup */}
          {showPm6MonthPopup && pm6MonthInfo && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">ยังไม่ครบกำหนด PM</h3>
                    <p className="text-xs text-amber-400">ระยะเวลา PM ขั้นต่ำ 6 เดือน</p>
                  </div>
                </div>
                <div className="p-4 bg-slate-700/50 rounded-xl mb-5">
                  <p className="text-sm text-white font-medium mb-1">
                    {pm6MonthInfo.storeCode} {pm6MonthInfo.storeName}
                  </p>
                  <p className="text-sm text-gray-300">
                    ทำการ PM ครั้งล่าสุดเมื่อวันที่{' '}
                    <span className="text-amber-300 font-medium">
                      {new Date(pm6MonthInfo.lastPmAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </p>
                  <p className="text-sm text-gray-400 mt-1">ยังไม่ครบระยะเวลา 6 เดือน</p>
                </div>
                <p className="text-sm text-gray-300 mb-5">คุณต้องการดำเนินการเปิดงาน PM ใหม่หรือไม่?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowPm6MonthPopup(false); doActualSubmit() }}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition"
                  >
                    ใช่ เปิดงาน PM
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPm6MonthPopup(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Parse LINE Message Modal */}
          <ParseLineMessageModal
            isOpen={showParseModal}
            onClose={() => setShowParseModal(false)}
            onApply={handleApplyParsed}
            stores={stores}
          />
        </>
      )}
    </div>
  )
}
