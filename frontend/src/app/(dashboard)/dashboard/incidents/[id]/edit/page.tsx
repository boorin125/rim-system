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

export default function EditIncidentPage() {
  const router = useRouter()
  const params = useParams()
  const themeHighlight = useThemeHighlight()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [stores, setStores] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [priorities, setPriorities] = useState<SlaConfig[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    category: '',
    jobType: '',
    storeId: '',
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

      // Backend returns { data: [...], meta: {...} }
      const storesData = storesRes.data?.data || storesRes.data || []
      setStores(Array.isArray(storesData) ? storesData : [])
      setCategories(categoriesRes.data)
      setJobTypes(jobTypesRes.data)

      // Filter only active priorities
      const activePriorities = (slaRes.data || []).filter((sla: SlaConfig) => sla.isActive)
      setPriorities(activePriorities)

      // Set form data
      setFormData({
        title: incident.title || '',
        description: incident.description || '',
        priority: incident.priority || 'MEDIUM',
        category: incident.category || '',
        jobType: incident.jobType || '',
        storeId: incident.storeId?.toString() || '',
      })
    } catch (error: any) {
      toast.error('Failed to load incident')
      console.error(error)
      router.push('/dashboard/incidents')
    } finally {
      setIsLoading(false)
    }
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

      // Add category if provided
      if (formData.category) {
        payload.category = formData.category
      }

      // Add jobType if provided
      if (formData.jobType) {
        payload.jobType = formData.jobType
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
        <h1 className="text-2xl font-bold text-white">Edit Incident #{params.id}</h1>
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

            {/* Category & Job Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Job Type
                </label>
                <select
                  value={formData.jobType}
                  onChange={(e) =>
                    setFormData({ ...formData, jobType: e.target.value })
                  }
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
              onChange={(e) =>
                setFormData({ ...formData, storeId: e.target.value })
              }
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
