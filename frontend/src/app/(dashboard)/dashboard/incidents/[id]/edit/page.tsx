// app/(dashboard)/dashboard/incidents/[id]/edit/page.tsx - Edit Incident (WITH JOB TYPE & CATEGORY)
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface Category {
  id: number
  name: string
  color: string | null
  isActive: boolean
  jobTypeId?: number | null
}

interface JobType {
  id: number
  name: string
  color: string | null
  isActive: boolean
  defaultPriority?: string | null
  ignoreSla?: boolean
}

interface SlaConfig {
  id: number
  priority: string
  name: string
  displayName?: string
  color: string | null
  isActive: boolean
}

export default function EditIncidentPage() {
  const router = useRouter()
  const params = useParams()
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [ticketNumber, setTicketNumber] = useState<string>('')
  const [stores, setStores] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [priorities, setPriorities] = useState<SlaConfig[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    category: '',
    jobType: '',
    storeId: '',
    equipmentId: '',
  })

  useEffect(() => {
    if (params.id) {
      fetchIncidentAndData()
    }
  }, [params.id])

  const fetchIncidentAndData = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch incident, stores, categories, job types, and priorities in parallel
      const [incidentRes, storesRes, categoriesRes, jobTypesRes, slaRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/stores?limit=10000&status=ACTIVE`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/all`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sla`, { headers }),
      ])

      const incident = incidentRes.data
      setTicketNumber(incident.ticketNumber || incident.id)

      // Backend returns { data: [...], meta: {...} }
      const storesData = storesRes.data?.data || storesRes.data || []
      setStores(Array.isArray(storesData) ? storesData : [])
      setCategories(categoriesRes.data)
      setJobTypes(jobTypesRes.data)

      // Filter only active priorities
      const activePriorities = (slaRes.data || []).filter((sla: SlaConfig) => sla.isActive)
      setPriorities(activePriorities)

      // Set form data
      const storeId = incident.storeId?.toString() || ''
      setFormData({
        title: incident.title || '',
        description: incident.description || '',
        priority: incident.priority || 'MEDIUM',
        category: incident.category || '',
        jobType: incident.jobType || '',
        storeId,
        equipmentId: incident.equipmentId?.toString() || '',
      })

      // Load equipment for this store
      if (storeId) {
        fetchEquipmentByStore(storeId, token)
      }
    } catch (error: any) {
      toast.error('Failed to load incident')
      console.error(error)
      router.push('/dashboard/incidents')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEquipmentByStore = async (storeId: string, token?: string | null) => {
    if (!storeId) { setEquipment([]); return }
    setLoadingEquipment(true)
    try {
      const t = token || localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment?storeId=${storeId}&limit=1000&status=ACTIVE`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      setEquipment(res.data?.data || res.data || [])
    } catch {
      setEquipment([])
    } finally {
      setLoadingEquipment(false)
    }
  }

  const handleStoreChange = (storeId: string) => {
    setFormData(prev => ({ ...prev, storeId, equipmentId: '' }))
    fetchEquipmentByStore(storeId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!formData.storeId) {
      toast.error('Please select a store')
      return
    }

    setIsSaving(true)

    try {
      const token = localStorage.getItem('token')

      const payload: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        storeId: parseInt(formData.storeId),
      }

      if (formData.category) payload.category = formData.category
      if (formData.jobType) payload.jobType = formData.jobType
      if (formData.equipmentId) {
        payload.equipmentId = parseInt(formData.equipmentId)
      } else {
        payload.equipmentId = null
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${params.id}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('Incident updated successfully')
      router.push(`/dashboard/incidents/${params.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update incident')
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
          <p className="text-gray-400">Loading incident...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <BackButton href={`/dashboard/incidents/${params.id}`} label="กลับไปหน้ารายละเอียด" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Edit Incident #{ticketNumber || params.id}</h1>
        <p className="text-gray-400 mt-1">Update incident details</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">
            Basic Information
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Brief description of the incident"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed description of the issue"
                rows={6}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                required
              />
            </div>

            {/* Job Type & Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Job Type
                </label>
                <select
                  value={formData.jobType}
                  onChange={(e) => {
                    const value = e.target.value
                    const selectedJobType = jobTypes.find(jt => jt.name === value)
                    setFormData(prev => ({
                      ...prev,
                      jobType: value,
                      category: '', // reset category when job type changes
                      priority: selectedJobType?.defaultPriority || prev.priority,
                    }))
                  }}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select job type</option>
                  {jobTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                  {formData.jobType && (() => {
                    const jt = jobTypes.find(j => j.name === formData.jobType)
                    return jt?.ignoreSla ? (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                        Ignore SLA
                      </span>
                    ) : null
                  })()}
                </label>
                {(() => {
                  const selectedJobType = jobTypes.find(jt => jt.name === formData.jobType)
                  const filteredCategories = selectedJobType
                    ? categories.filter(cat => cat.jobTypeId === selectedJobType.id)
                    : []
                  return (
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      {filteredCategories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )
                })()}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Priority <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {priorities.length > 0 ? (
                  priorities.map((sla) => (
                    <option key={sla.id} value={sla.priority}>
                      {sla.displayName || sla.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Store Selection */}
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-4">Store</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Store <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.storeId}
              onChange={(e) => handleStoreChange(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {formatStore(store)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              💡 To assign or reassign technician, use the Assign/Reassign button on the detail page
            </p>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              อุปกรณ์ที่เกี่ยวข้อง
            </label>
            <select
              value={formData.equipmentId}
              onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
              disabled={!formData.storeId || loadingEquipment}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">
                {loadingEquipment ? 'กำลังโหลด...' : !formData.storeId ? 'เลือกสาขาก่อน' : 'ไม่ระบุอุปกรณ์'}
              </option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}{eq.serialNumber ? ` (S/N: ${eq.serialNumber})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-gray-300 hover:bg-slate-700/50 rounded-lg transition duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 px-6 py-3 hover:brightness-110 text-white rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeHighlight }}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
