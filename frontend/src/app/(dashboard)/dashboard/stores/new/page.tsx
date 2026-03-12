// app/(dashboard)/dashboard/stores/new/page.tsx - Create Store Page
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  ArrowLeft,
  Save,
  MapPin,
  Phone,
  Mail,
  Network,
  Clock,
  FileText,
  Globe,
  Server,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { TimeInput } from '@/components/TimeInput'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface StoreFormData {
  storeCode: string
  name: string
  company: string
  storeType: string
  storeStatus: string
  // Address
  address: string
  province: string
  postalCode: string
  area: string
  serviceCenter: string
  // Location
  latitude: string
  longitude: string
  googleMapLink: string
  // Contact
  phone: string
  email: string
  // Network
  circuitId: string
  routerIp: string
  switchIp: string
  accessPointIp: string
  pcServerIp: string
  pcPrinterIp: string
  pmcComputerIp: string
  sbsComputerIp: string
  vatComputerIp: string
  posIp: string
  edcIp: string
  scoIp: string
  peopleCounterIp: string
  digitalTvIp: string
  timeAttendanceIp: string
  cctvIp: string
  // Operating Hours
  mondayOpen: string
  mondayClose: string
  tuesdayOpen: string
  tuesdayClose: string
  wednesdayOpen: string
  wednesdayClose: string
  thursdayOpen: string
  thursdayClose: string
  fridayOpen: string
  fridayClose: string
  saturdayOpen: string
  saturdayClose: string
  sundayOpen: string
  sundayClose: string
  holidayOpen: string
  holidayClose: string
  // Dates
  openDate: string
  closeDate: string
  // Notes
  notes: string
}

const initialFormData: StoreFormData = {
  storeCode: '',
  name: '',
  company: '',
  storeType: 'PERMANENT',
  storeStatus: 'ACTIVE',
  address: '',
  province: '',
  postalCode: '',
  area: '',
  serviceCenter: '',
  latitude: '',
  longitude: '',
  googleMapLink: '',
  phone: '',
  email: '',
  circuitId: '',
  routerIp: '',
  switchIp: '',
  accessPointIp: '',
  pcServerIp: '',
  pcPrinterIp: '',
  pmcComputerIp: '',
  sbsComputerIp: '',
  vatComputerIp: '',
  posIp: '',
  edcIp: '',
  scoIp: '',
  peopleCounterIp: '',
  digitalTvIp: '',
  timeAttendanceIp: '',
  cctvIp: '',
  mondayOpen: '10:00',
  mondayClose: '22:00',
  tuesdayOpen: '10:00',
  tuesdayClose: '22:00',
  wednesdayOpen: '10:00',
  wednesdayClose: '22:00',
  thursdayOpen: '10:00',
  thursdayClose: '22:00',
  fridayOpen: '10:00',
  fridayClose: '22:00',
  saturdayOpen: '10:00',
  saturdayClose: '22:00',
  sundayOpen: '10:00',
  sundayClose: '22:00',
  holidayOpen: '10:00',
  holidayClose: '22:00',
  openDate: '',
  closeDate: '',
  notes: '',
}

export default function CreateStorePage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [formData, setFormData] = useState<StoreFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'location' | 'network' | 'hours'>('basic')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.storeCode.trim()) {
      toast.error('Store Code is required')
      return false
    }
    if (!formData.name.trim()) {
      toast.error('Store Name is required')
      return false
    }
    if (!formData.company.trim()) {
      toast.error('Company is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem('token')

      // Prepare data - convert empty strings to null and numbers
      const submitData = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        openDate: formData.openDate || null,
        closeDate: formData.closeDate || null,
      }

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stores`,
        submitData,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success('Store created successfully')
      router.push('/dashboard/stores')
    } catch (error: any) {
      console.error('Error creating store:', error)
      toast.error(error.response?.data?.message || 'Failed to create store')
    } finally {
      setIsSubmitting(false)
    }
  }

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building2 },
    { id: 'location', label: 'Location & Contact', icon: MapPin },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'hours', label: 'Operating Hours', icon: Clock },
  ]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <BackButton href="/dashboard/stores" label="กลับไปหน้า Stores" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Add New Store</h1>
          <p className="text-gray-400">Create a new store in the system</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabs */}
        <div className="glass-card rounded-xl p-1 inline-flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                style={activeTab === tab.id ? { backgroundColor: themeHighlight } : undefined}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="glass-card rounded-2xl p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Store Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="storeCode"
                    value={formData.storeCode}
                    onChange={handleChange}
                    placeholder="e.g., W001"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Store Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Watsons Central World"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="e.g., Watsons Thailand"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Store Type
                  </label>
                  <select
                    name="storeType"
                    value={formData.storeType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PERMANENT">Permanent</option>
                    <option value="POP_UP">Pop-up</option>
                    <option value="SEASONAL">Seasonal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    name="storeStatus"
                    value={formData.storeStatus}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
                    <option value="PERMANENTLY_CLOSED">Permanently Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Area
                  </label>
                  <input
                    type="text"
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    placeholder="e.g., Central Region"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Service Center
                  </label>
                  <input
                    type="text"
                    name="serviceCenter"
                    value={formData.serviceCenter}
                    onChange={handleChange}
                    placeholder="e.g., Bangkok Service Center"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Open Date
                  </label>
                  <input
                    type="date"
                    name="openDate"
                    value={formData.openDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Close Date
                  </label>
                  <input
                    type="date"
                    name="closeDate"
                    value={formData.closeDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Additional notes about the store..."
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Location & Contact Tab */}
          {activeTab === 'location' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-400" />
                Address Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street address"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Province
                  </label>
                  <input
                    type="text"
                    name="province"
                    value={formData.province}
                    onChange={handleChange}
                    placeholder="Province"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    placeholder="Postal Code"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4">
                <Globe className="w-5 h-5 text-blue-400" />
                GPS Coordinates
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Latitude
                  </label>
                  <input
                    type="text"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="e.g., 13.7563"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Longitude
                  </label>
                  <input
                    type="text"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="e.g., 100.5018"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Google Maps Link
                  </label>
                  <input
                    type="text"
                    name="googleMapLink"
                    value={formData.googleMapLink}
                    onChange={handleChange}
                    placeholder="Google Maps URL"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4">
                <Phone className="w-5 h-5 text-purple-400" />
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g., 02-123-4567"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g., store@example.com"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Network Tab */}
          {activeTab === 'network' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-400" />
                Network Configuration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Circuit ID
                  </label>
                  <input
                    type="text"
                    name="circuitId"
                    value={formData.circuitId}
                    onChange={handleChange}
                    placeholder="Circuit ID"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Router IP
                  </label>
                  <input
                    type="text"
                    name="routerIp"
                    value={formData.routerIp}
                    onChange={handleChange}
                    placeholder="e.g., 192.168.1.1"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Switch IP
                  </label>
                  <input
                    type="text"
                    name="switchIp"
                    value={formData.switchIp}
                    onChange={handleChange}
                    placeholder="e.g., 192.168.1.2"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Access Point IP
                  </label>
                  <input
                    type="text"
                    name="accessPointIp"
                    value={formData.accessPointIp}
                    onChange={handleChange}
                    placeholder="e.g., 192.168.1.3"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4">
                <Server className="w-5 h-5 text-orange-400" />
                Computer IPs
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    PC Server IP
                  </label>
                  <input
                    type="text"
                    name="pcServerIp"
                    value={formData.pcServerIp}
                    onChange={handleChange}
                    placeholder="PC Server IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    PC Printer IP
                  </label>
                  <input
                    type="text"
                    name="pcPrinterIp"
                    value={formData.pcPrinterIp}
                    onChange={handleChange}
                    placeholder="PC Printer IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    PMC Computer IP
                  </label>
                  <input
                    type="text"
                    name="pmcComputerIp"
                    value={formData.pmcComputerIp}
                    onChange={handleChange}
                    placeholder="PMC Computer IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SBS Computer IP
                  </label>
                  <input
                    type="text"
                    name="sbsComputerIp"
                    value={formData.sbsComputerIp}
                    onChange={handleChange}
                    placeholder="SBS Computer IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    VAT Computer IP
                  </label>
                  <input
                    type="text"
                    name="vatComputerIp"
                    value={formData.vatComputerIp}
                    onChange={handleChange}
                    placeholder="VAT Computer IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white flex items-center gap-2 pt-4">
                <Server className="w-5 h-5 text-yellow-400" />
                Other Devices
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    POS IP
                  </label>
                  <input
                    type="text"
                    name="posIp"
                    value={formData.posIp}
                    onChange={handleChange}
                    placeholder="POS IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    EDC IP
                  </label>
                  <input
                    type="text"
                    name="edcIp"
                    value={formData.edcIp}
                    onChange={handleChange}
                    placeholder="EDC IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SCO IP
                  </label>
                  <input
                    type="text"
                    name="scoIp"
                    value={formData.scoIp}
                    onChange={handleChange}
                    placeholder="SCO IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    People Counter IP
                  </label>
                  <input
                    type="text"
                    name="peopleCounterIp"
                    value={formData.peopleCounterIp}
                    onChange={handleChange}
                    placeholder="People Counter IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Digital TV IP
                  </label>
                  <input
                    type="text"
                    name="digitalTvIp"
                    value={formData.digitalTvIp}
                    onChange={handleChange}
                    placeholder="Digital TV IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Time Attendance IP
                  </label>
                  <input
                    type="text"
                    name="timeAttendanceIp"
                    value={formData.timeAttendanceIp}
                    onChange={handleChange}
                    placeholder="Time Attendance IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    CCTV IP
                  </label>
                  <input
                    type="text"
                    name="cctvIp"
                    value={formData.cctvIp}
                    onChange={handleChange}
                    placeholder="CCTV IP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Operating Hours Tab */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-white" />
                Operating Hours
              </h3>

              <div className="space-y-4">
                {[
                  { day: 'Monday', openField: 'mondayOpen', closeField: 'mondayClose' },
                  { day: 'Tuesday', openField: 'tuesdayOpen', closeField: 'tuesdayClose' },
                  { day: 'Wednesday', openField: 'wednesdayOpen', closeField: 'wednesdayClose' },
                  { day: 'Thursday', openField: 'thursdayOpen', closeField: 'thursdayClose' },
                  { day: 'Friday', openField: 'fridayOpen', closeField: 'fridayClose' },
                  { day: 'Saturday', openField: 'saturdayOpen', closeField: 'saturdayClose' },
                  { day: 'Sunday', openField: 'sundayOpen', closeField: 'sundayClose' },
                  { day: 'Holiday', openField: 'holidayOpen', closeField: 'holidayClose' },
                ].map(({ day, openField, closeField }) => (
                  <div key={day} className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg">
                    <div className="w-28 font-medium text-gray-300">{day}</div>
                    <div className="flex items-center gap-2">
                      <TimeInput
                        value={formData[openField as keyof StoreFormData] as string}
                        onChange={(v) => setFormData(prev => ({ ...prev, [openField]: v }))}
                        className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 w-24"
                      />
                      <span className="text-gray-500">to</span>
                      <TimeInput
                        value={formData[closeField as keyof StoreFormData] as string}
                        onChange={(v) => setFormData(prev => ({ ...prev, [closeField]: v }))}
                        className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard/stores')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 hover:brightness-110 disabled:opacity-50 text-white rounded-lg transition-colors"
            style={{ backgroundColor: themeHighlight }}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Create Store
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
