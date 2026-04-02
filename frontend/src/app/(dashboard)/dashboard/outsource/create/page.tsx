// app/(dashboard)/dashboard/outsource/create/page.tsx - Create Outsource Job
'use client'

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ChevronLeft,
  Search,
  Briefcase,
  MapPin,
  AlertTriangle,
  X,
  Users,
  ShoppingBag,
  UserCheck,
} from 'lucide-react'
import { canPerformAction } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface Incident {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority?: string
  store: { id: number; name: string; storeCode: string; address?: string; province?: string }
  category?: string
}

interface OutsourceTechnician {
  id: number
  firstName: string
  lastName: string
  email: string
  responsibleProvinces?: string[]
  phone?: string
}

interface SlaConfig {
  id: number
  priority: string
  name: string
  color?: string
  isActive: boolean
}

export default function CreateOutsourceJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const themeHighlight = useThemeHighlight()
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  // Incident search
  const [incidentSearch, setIncidentSearch] = useState('')
  const [incidentResults, setIncidentResults] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  // Job type: MARKETPLACE or DIRECT_ASSIGN
  const [jobType, setJobType] = useState<'MARKETPLACE' | 'DIRECT_ASSIGN'>('MARKETPLACE')
  const [outsourceTechs, setOutsourceTechs] = useState<OutsourceTechnician[]>([])
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null)
  const [techSearch, setTechSearch] = useState('')
  const [showTechDropdown, setShowTechDropdown] = useState(false)
  const techDropdownRef = useRef<HTMLDivElement>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [location, setLocation] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [agreedPrice, setAgreedPrice] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [urgencyLevel, setUrgencyLevel] = useState('NORMAL')
  const [slaConfigs, setSlaConfigs] = useState<SlaConfig[]>([])

  // Map incident priority → outsource urgency level
  const priorityToUrgency: Record<string, string> = {
    CRITICAL: 'URGENT',
    HIGH: 'HIGH',
    MEDIUM: 'NORMAL',
    LOW: 'LOW',
  }

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setUser(JSON.parse(userStr))
    const token = localStorage.getItem('token')
    const authHeader = { headers: { Authorization: `Bearer ${token}` } }
    // Load SLA configs for urgency dropdown
    const loadSla = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sla`, authHeader)
        setSlaConfigs(res.data)
      } catch {
        // fallback: keep default options
      }
    }
    // Load outsource technicians for DIRECT_ASSIGN (with responsibleProvinces)
    const loadTechs = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          ...authHeader,
          params: { technicianType: 'OUTSOURCE', status: 'ACTIVE' },
        })
        const allUsers = Array.isArray(res.data) ? res.data : res.data.data || []
        setOutsourceTechs(allUsers)
      } catch {
        // ignore
      }
    }
    loadSla()
    loadTechs()
  }, [])

  // Auto-load incident from query parameter (e.g., ?incidentId=xxx)
  useEffect(() => {
    const incidentId = searchParams.get('incidentId')
    if (incidentId && !selectedIncident) {
      const loadIncident = async () => {
        try {
          const token = localStorage.getItem('token')
          const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const inc = res.data
          if (inc) {
            const mapped: Incident = {
              id: inc.id,
              ticketNumber: inc.ticketNumber,
              title: inc.title,
              status: inc.status,
              store: { ...inc.store, province: inc.store?.province },
              category: inc.category,
            }
            setSelectedIncident(mapped)
            setTitle(inc.title || '')
            if (inc.store) {
              setLocation(`${formatStore(inc.store)}${inc.store.address ? ' - ' + inc.store.address : ''}`)
            }
            if (inc.description) setDescription(inc.description)
            // Auto-set urgency from incident priority
            if (inc.priority && priorityToUrgency[inc.priority]) {
              setUrgencyLevel(priorityToUrgency[inc.priority])
            }
          }
        } catch {
          toast.error('ไม่พบ Incident ที่ระบุ')
        }
      }
      loadIncident()
    }
  }, [searchParams, selectedIncident])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (techDropdownRef.current && !techDropdownRef.current.contains(e.target as Node)) {
        setShowTechDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const canCreate = canPerformAction(user, '/dashboard/outsource', 'create')

  const searchIncidents = async (query: string) => {
    if (query.length < 2) {
      setIncidentResults([])
      return
    }
    setSearchLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { search: query, limit: 10 },
      })
      const data = res.data.data || res.data
      setIncidentResults(Array.isArray(data) ? data : [])
      setShowDropdown(true)
    } catch {
      setIncidentResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setIncidentSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchIncidents(value), 300)
  }

  const selectIncident = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowDropdown(false)
    setIncidentSearch('')
    // Pre-fill fields
    if (!title) setTitle(incident.title)
    if (!location && incident.store) {
      setLocation(`${formatStore(incident.store)}${incident.store.address ? ' - ' + incident.store.address : ''}`)
    }
    // Auto-set urgency from incident priority
    if (incident.priority && priorityToUrgency[incident.priority]) {
      setUrgencyLevel(priorityToUrgency[incident.priority])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIncident) {
      toast.error('กรุณาเลือก Incident')
      return
    }
    if (!title.trim() || !description.trim()) {
      toast.error('กรุณากรอก Title และ Description')
      return
    }
    if (!agreedPrice || Number(agreedPrice) <= 0) {
      toast.error('กรุณากำหนดราคาจ้าง')
      return
    }
    if (jobType === 'DIRECT_ASSIGN' && !selectedTechId) {
      toast.error('กรุณาเลือกช่าง Outsource')
      return
    }

    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const payload: any = {
        incidentId: selectedIncident.id,
        title: title.trim(),
        description: description.trim(),
        urgencyLevel,
        jobType,
      }
      if (jobType === 'DIRECT_ASSIGN' && selectedTechId) {
        payload.assignToId = selectedTechId
      }
      if (requirements.trim()) payload.requirements = requirements.trim()
      if (location.trim()) payload.location = location.trim()
      if (estimatedHours) payload.estimatedHours = Number(estimatedHours)
      if (agreedPrice) payload.agreedPrice = Number(agreedPrice)
      if (scheduledDate) payload.deadline = new Date(scheduledDate).toISOString()

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/outsource/jobs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('สร้างงานสำเร็จ - รอ IT Manager อนุมัติ')
      router.push('/dashboard/outsource')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถสร้างงานได้')
    } finally {
      setSubmitting(false)
    }
  }

  if (user && !canCreate) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400 mb-3" />
          <h3 className="text-lg font-medium text-white">ไม่มีสิทธิ์</h3>
          <p className="mt-1 text-sm text-gray-400">คุณไม่มีสิทธิ์สร้างงาน Outsource</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center p-2.5 bg-slate-700/50 hover:bg-slate-600/70 text-gray-200 hover:text-white border border-slate-600/50 rounded-xl transition-all duration-200"
          title="กลับไปก่อนหน้า"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">สร้างงาน Outsource</h1>
          <p className="text-sm text-gray-400">กำหนดราคา เงื่อนไข และส่งขออนุมัติจาก IT Manager</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Incident Link */}
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">เลือก Incident</h2>

          {!selectedIncident ? (
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={incidentSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="ค้นหาด้วยเลข Ticket หรือ Title..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>

              {showDropdown && incidentResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {incidentResults.map((inc) => (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => selectIncident(inc)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-600 transition border-b border-slate-600/50 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-blue-400">{inc.ticketNumber}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/30 text-gray-300">{inc.status}</span>
                      </div>
                      <p className="text-sm text-white mt-1 truncate">{inc.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatStore(inc.store)}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && incidentSearch.length >= 2 && incidentResults.length === 0 && !searchLoading && (
                <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg p-4 text-center text-gray-400 text-sm">
                  ไม่พบ Incident
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-blue-400">{selectedIncident.ticketNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/30 text-gray-300">{selectedIncident.status}</span>
                  </div>
                  <p className="text-white font-medium mt-1">{selectedIncident.title}</p>
                  <p className="text-sm text-gray-400 mt-0.5 flex items-center">
                    <MapPin className="h-3.5 w-3.5 mr-1" />
                    {formatStore(selectedIncident.store)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedIncident(null); setTitle(''); setLocation('') }}
                  className="p-1 rounded hover:bg-slate-600 text-gray-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Job Type */}
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 overflow-visible relative z-10">
          <h2 className="text-lg font-semibold text-white mb-4">ประเภทการเปิดงาน</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setJobType('MARKETPLACE'); setSelectedTechId(null) }}
              className={`p-4 rounded-xl border-2 text-left transition ${
                jobType === 'MARKETPLACE'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <ShoppingBag className={`h-5 w-5 ${jobType === 'MARKETPLACE' ? 'text-blue-400' : 'text-gray-400'}`} />
                <span className={`font-semibold ${jobType === 'MARKETPLACE' ? 'text-blue-400' : 'text-gray-300'}`}>Marketplace</span>
              </div>
              <p className="text-xs text-gray-400">ปล่อยงานให้ช่าง Outsource ทุกคนเห็นและกดรับงาน</p>
            </button>
            <button
              type="button"
              onClick={() => setJobType('DIRECT_ASSIGN')}
              className={`p-4 rounded-xl border-2 text-left transition ${
                jobType === 'DIRECT_ASSIGN'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <UserCheck className={`h-5 w-5 ${jobType === 'DIRECT_ASSIGN' ? 'text-emerald-400' : 'text-gray-400'}`} />
                <span className={`font-semibold ${jobType === 'DIRECT_ASSIGN' ? 'text-emerald-400' : 'text-gray-300'}`}>มอบหมายเจาะจง</span>
              </div>
              <p className="text-xs text-gray-400">เลือกช่าง Outsource โดยตรง ไม่ผ่าน Marketplace</p>
            </button>
          </div>

          {/* Technician selector for DIRECT_ASSIGN */}
          {jobType === 'DIRECT_ASSIGN' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">เลือกช่าง Outsource *</label>
              {outsourceTechs.length === 0 ? (
                <p className="text-sm text-yellow-400">ไม่พบช่าง Outsource ในระบบ</p>
              ) : (
                <div ref={techDropdownRef} className="relative">
                  {/* Selected tech display or search input */}
                  {selectedTechId ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-700 border border-emerald-500 rounded-lg">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-emerald-500/20 text-emerald-400">
                        {outsourceTechs.find(t => t.id === selectedTechId)?.firstName?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-400">
                          {outsourceTechs.find(t => t.id === selectedTechId)?.firstName}{' '}
                          {outsourceTechs.find(t => t.id === selectedTechId)?.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {outsourceTechs.find(t => t.id === selectedTechId)?.email}
                          {outsourceTechs.find(t => t.id === selectedTechId)?.phone ? ` | ${outsourceTechs.find(t => t.id === selectedTechId)?.phone}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedTechId(null); setTechSearch('') }}
                        className="p-1 rounded hover:bg-slate-600 text-gray-400 hover:text-white transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={techSearch}
                        onChange={(e) => { setTechSearch(e.target.value); setShowTechDropdown(true) }}
                        onFocus={() => setShowTechDropdown(true)}
                        placeholder="พิมพ์ชื่อช่างเพื่อค้นหา..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Dropdown list */}
                  {showTechDropdown && !selectedTechId && (() => {
                    const incidentProvince = selectedIncident?.store?.province
                    // Filter by province: match OR no province defined
                    const provinceFiltered = incidentProvince
                      ? outsourceTechs.filter(t => {
                          const rp = t.responsibleProvinces || []
                          return rp.length === 0 || rp.includes(incidentProvince)
                        })
                      : outsourceTechs
                    // Then filter by search query
                    const filtered = techSearch.trim()
                      ? provinceFiltered.filter(t => {
                          const q = techSearch.toLowerCase()
                          return (
                            t.firstName?.toLowerCase().includes(q) ||
                            t.lastName?.toLowerCase().includes(q) ||
                            t.phone?.includes(q)
                          )
                        })
                      : provinceFiltered
                    return (
                      <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {incidentProvince && (
                          <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-slate-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            แสดงช่างที่รับผิดชอบ: <span className="text-blue-400 ml-1">{incidentProvince}</span>
                            <span className="text-gray-600 ml-1">(รวมช่างที่ไม่ระบุพื้นที่)</span>
                          </div>
                        )}
                        {filtered.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 text-sm">
                            {outsourceTechs.length === 0 ? 'ไม่มีช่าง Outsource' : `ไม่พบช่างที่รับผิดชอบจังหวัด${incidentProvince ? ` ${incidentProvince}` : ''}`}
                          </div>
                        ) : (
                          filtered.map((tech) => (
                            <button
                              key={tech.id}
                              type="button"
                              onClick={() => { setSelectedTechId(tech.id); setShowTechDropdown(false); setTechSearch('') }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-600 transition border-b border-slate-600/50 last:border-b-0 flex items-center gap-3"
                            >
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-slate-600 text-gray-300">
                                {tech.firstName?.[0]}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">{tech.firstName} {tech.lastName}</p>
                                <p className="text-xs text-gray-500">
                                  {(tech.responsibleProvinces?.length ?? 0) > 0
                                    ? <span className="text-emerald-500/80">{tech.responsibleProvinces!.join(', ')}</span>
                                    : <span className="text-gray-600">ทุกจังหวัด</span>
                                  }
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Job Details */}
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">รายละเอียดงาน</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="ชื่องาน"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="รายละเอียดงาน..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Requirements</label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={3}
                placeholder="ทักษะหรือเครื่องมือที่ต้องการ..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="สถานที่ทำงาน"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Estimated Hours</label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="ชั่วโมงโดยประมาณ"
                  min="0"
                  step="0.5"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: ราคาและกำหนดเวลา */}
        <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">ราคาและกำหนดเวลา</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ราคาจ้าง (บาท) *</label>
              <input
                type="number"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                required
                placeholder="กำหนดราคาจ้างงาน"
                min="0"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">วันที่และเวลานัดเข้างาน</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Urgency Level</label>
              <select
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {slaConfigs.length > 0 ? (
                  slaConfigs.map((sla) => {
                    const mapped = priorityToUrgency[sla.priority] || 'NORMAL'
                    return (
                      <option key={sla.priority} value={mapped}>
                        {sla.name} ({mapped})
                      </option>
                    )
                  })
                ) : (
                  <>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Approval note */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 inline mr-1 -mt-0.5" />
            งานจะถูกส่งให้ <span className="font-semibold">IT Manager อนุมัติ</span>ก่อนเปิดใช้งาน
            {jobType === 'MARKETPLACE' ? ' — หลังอนุมัติจะเปิดใน Marketplace ให้ช่างกดรับงาน' : ' — หลังอนุมัติจะมอบหมายให้ช่างที่เลือกทันที'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center p-2.5 bg-slate-700/50 hover:bg-slate-600/70 text-gray-200 hover:text-white border border-slate-600/50 rounded-xl transition-all duration-200"
            title="กลับไปก่อนหน้า"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedIncident || (jobType === 'DIRECT_ASSIGN' && !selectedTechId)}
            className="px-6 py-3 hover:brightness-110 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: themeHighlight }}
          >
            <Briefcase className="h-4 w-4" />
            {submitting ? 'กำลังส่ง...' : 'ส่งขออนุมัติ'}
          </button>
        </div>
      </form>
    </div>
  )
}
