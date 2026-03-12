// app/(dashboard)/dashboard/users/[id]/edit/page.tsx - Edit User Roles (Multi-select)
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  Check,
  Building,
  Wrench,
  MapPin,
  Users,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface UserData {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  department?: string
  address?: string
  technicianType?: 'INSOURCE' | 'OUTSOURCE' | null
  serviceCenter?: string
  responsibleProvinces?: string[]
  isTechnician?: boolean
  roles: string[]
  status: string
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const themeHighlight = useThemeHighlight()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [department, setDepartment] = useState('')
  const [isTechnician, setIsTechnician] = useState(false)
  const [technicianType, setTechnicianType] = useState<'INSOURCE' | 'OUTSOURCE' | ''>('')
  const [serviceCenter, setServiceCenter] = useState('')
  const [responsibleProvinces, setResponsibleProvinces] = useState<string[]>([])
  const [provinceSearch, setProvinceSearch] = useState('')

  // Type-change confirmation modal
  const [showTypeChangeModal, setShowTypeChangeModal] = useState(false)
  const [pendingTypeChange, setPendingTypeChange] = useState<'INSOURCE' | 'OUTSOURCE' | null>(null)
  const [typeChangeCheck, setTypeChangeCheck] = useState<{
    activeOutsourceJobs: number
    pendingBids: number
    activeIncidents: number
  } | null>(null)
  const [isCheckingTypeChange, setIsCheckingTypeChange] = useState(false)

const [allProvinces, setAllProvinces] = useState<string[]>([])

  const allRoles = [
    { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access', color: 'red' },
    { value: 'IT_MANAGER', label: 'IT Manager', description: 'Manage IT operations and users', color: 'purple' },
    { value: 'FINANCE_ADMIN', label: 'Finance Admin', description: 'Financial management access', color: 'blue' },
    { value: 'HELP_DESK', label: 'Help Desk', description: 'Customer support and incident management', color: 'green' },
    { value: 'SUPERVISOR', label: 'Supervisor', description: 'Team oversight and reporting', color: 'orange' },
    { value: 'TECHNICIAN', label: 'Technician', description: 'Technical support and field work', color: 'cyan' },
    { value: 'END_USER', label: 'End User', description: 'Standard user access', color: 'gray' },
    { value: 'READ_ONLY', label: 'Read Only', description: 'View-only access to system', color: 'slate' },
  ]

  // Filter roles based on current user's permissions
  const currentUserRoles = Array.isArray(currentUser?.roles) ? currentUser.roles : [currentUser?.role]
  const isSuperAdmin = currentUserRoles.includes('SUPER_ADMIN')

  const roles = allRoles.filter(role => {
    if (isSuperAdmin) return true
    return role.value !== 'SUPER_ADMIN'
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      const userRoles = Array.isArray(user.roles) ? user.roles : [user.role]
      if (!userRoles.some((r: string) => ['SUPER_ADMIN', 'IT_MANAGER'].includes(r))) {
        toast.error('You do not have permission to edit users')
        router.push('/dashboard/users')
        return
      }
    }
    fetchUser()
    fetchProvinces()
  }, [userId, router])

  const fetchProvinces = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/provinces`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAllProvinces(response.data || [])
    } catch (error) {
      console.error('Failed to load provinces', error)
    }
  }

  const fetchUser = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const user = response.data
      setUserData(user)
      const userRoles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : [])
      setSelectedRoles(userRoles)
      setDepartment(user.department || '')
      setIsTechnician(userRoles.includes('TECHNICIAN') || !!user.technicianType)
      setTechnicianType(user.technicianType || '')
      setServiceCenter(user.serviceCenter || '')
      setResponsibleProvinces(user.responsibleProvinces || [])
    } catch (error: any) {
      toast.error('Failed to load user data')
      if (error.response?.status === 404) {
        router.push('/dashboard/users')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRole = (roleValue: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleValue)) {
        if (prev.length === 1) {
          toast.error('User must have at least one role')
          return prev
        }
        return prev.filter(r => r !== roleValue)
      } else {
        return [...prev, roleValue]
      }
    })
  }

  const handleTechnicianTypeChange = async (newType: 'INSOURCE' | 'OUTSOURCE') => {
    const currentType = userData?.technicianType
    if (!currentType || currentType === newType) {
      setTechnicianType(newType)
      return
    }

    try {
      setIsCheckingTypeChange(true)
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/type-change-check`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTypeChangeCheck(res.data)
      setPendingTypeChange(newType)
      setShowTypeChangeModal(true)
    } catch {
      setTechnicianType(newType)
    } finally {
      setIsCheckingTypeChange(false)
    }
  }

  const confirmTypeChange = () => {
    if (pendingTypeChange) {
      setTechnicianType(pendingTypeChange)
    }
    setShowTypeChangeModal(false)
    setPendingTypeChange(null)
    setTypeChangeCheck(null)
  }

  const cancelTypeChange = () => {
    setShowTypeChangeModal(false)
    setPendingTypeChange(null)
    setTypeChangeCheck(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedRoles.length === 0) {
      toast.error('Please select at least one role')
      return
    }

    try {
      setIsSaving(true)
      const token = localStorage.getItem('token')

      // Update roles
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/update-roles`,
        { roles: selectedRoles },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Build update payload
      const updateData: any = {}

      if (department !== (userData?.department || '')) {
        updateData.department = department || null
      }
      if (isTechnician && technicianType !== (userData?.technicianType || '')) {
        updateData.technicianType = technicianType || null
      }
      if (!isTechnician && userData?.technicianType) {
        updateData.technicianType = null
      }
      if (isTechnician && serviceCenter !== (userData?.serviceCenter || '')) {
        updateData.serviceCenter = serviceCenter || null
      }
      if (!isTechnician && userData?.serviceCenter) {
        updateData.serviceCenter = null
      }

      // Responsible provinces — available for all users
      if (!arraysEqual(responsibleProvinces.slice().sort(), (userData?.responsibleProvinces || []).slice().sort())) {
        updateData.responsibleProvinces = responsibleProvinces
      }

      if (Object.keys(updateData).length > 0) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
          updateData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }

      toast.success('User updated successfully')
      router.push(`/dashboard/users/${userId}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user')
    } finally {
      setIsSaving(false)
    }
  }

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((val, idx) => val === sortedB[idx])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading user data...</p>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white mb-2">User Not Found</h2>
          <button
            onClick={() => router.push('/dashboard/users')}
            className="px-4 py-2 hover:brightness-110 text-white rounded-lg transition-colors"
            style={{ backgroundColor: themeHighlight }}
          >
            Back to Users
          </button>
        </div>
      </div>
    )
  }

  const originalRoles = Array.isArray(userData.roles) ? userData.roles : []
  const rolesChanged = !arraysEqual(selectedRoles, originalRoles)
  const departmentChanged = department !== (userData.department || '')
  const technicianChanged = isTechnician !== (!!userData.technicianType || originalRoles.includes('TECHNICIAN'))
  const technicianTypeChanged = technicianType !== (userData.technicianType || '')
  const serviceCenterChanged = serviceCenter !== (userData.serviceCenter || '')
  const responsibleProvincesChanged = !arraysEqual(
    responsibleProvinces.slice().sort(),
    (userData.responsibleProvinces || []).slice().sort()
  )
  const hasChanges = rolesChanged || departmentChanged || technicianChanged ||
    technicianTypeChanged || serviceCenterChanged || responsibleProvincesChanged

  const provinces = allProvinces

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Back Button */}
      <BackButton href={`/dashboard/users/${userId}`} label="กลับไปหน้ารายละเอียด" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Edit User Roles</h1>
        <p className="text-gray-400 mt-1">Manage roles and permissions for this user</p>
      </div>

      {/* User Info Card (Read-only) */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-400" />
          User Information
        </h3>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
            {userData.firstName?.[0]}{userData.lastName?.[0]}
          </div>
          <div>
            <h4 className="text-xl font-semibold text-white">
              {userData.firstName} {userData.lastName}
            </h4>
            <p className="text-gray-400">@{userData.username}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-gray-300">{userData.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
            <Phone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-gray-300">{userData.phone || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Selection */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Select Roles
          </h3>
          <p className="text-gray-400 text-sm mb-2">
            Select one or more roles for this user. Users can have multiple roles with combined permissions.
          </p>
          <p className="text-blue-400 text-sm mb-4">
            Selected: {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roles.map((role) => {
              const isSelected = selectedRoles.includes(role.value)
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'border-2 border-slate-500'
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-white font-medium">{role.label}</p>
                    <p className="text-sm text-gray-400">{role.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Roles Summary */}
        {selectedRoles.length > 0 && (
          <div className="glass-card p-4 rounded-2xl">
            <p className="text-sm text-gray-400 mb-2">Current selection:</p>
            <div className="flex flex-wrap gap-2">
              {selectedRoles.map(roleValue => {
                const role = roles.find(r => r.value === roleValue)
                return (
                  <span
                    key={roleValue}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium border border-blue-500/30"
                  >
                    {role?.label || roleValue}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-400" />
            Additional Information
          </h3>
          <div className="space-y-4">
            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g., IT Department, Operations"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={100}
              />
            </div>

            {/* Technician / Non-Technician Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                User Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsTechnician(false)
                    setTechnicianType('')
                    setServiceCenter('')
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    !isTechnician
                      ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <p className="text-white font-medium">Non-Technician</p>
                  <p className="text-sm text-gray-400">Office staff, Admin, etc.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTechnician(true)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isTechnician
                      ? 'bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/30'
                      : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <p className="text-white font-medium">Technician</p>
                  <p className="text-sm text-gray-400">Field technician</p>
                </button>
              </div>
            </div>

            {/* Technician Options */}
            {isTechnician && (
              <>
                {/* Technician Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-cyan-400" />
                    Technician Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isCheckingTypeChange}
                      onClick={() => handleTechnicianTypeChange('INSOURCE')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        technicianType === 'INSOURCE'
                          ? 'bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/30'
                          : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-white font-medium">In-house</p>
                      <p className="text-sm text-gray-400">Internal employee</p>
                    </button>
                    <button
                      type="button"
                      disabled={isCheckingTypeChange}
                      onClick={() => handleTechnicianTypeChange('OUTSOURCE')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        technicianType === 'OUTSOURCE'
                          ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30'
                          : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-white font-medium">Outsource</p>
                      <p className="text-sm text-gray-400">External contractor</p>
                    </button>
                  </div>
                </div>

                {/* Service Center */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-400" />
                    Service Center
                  </label>
                  <input
                    type="text"
                    value={serviceCenter}
                    onChange={(e) => setServiceCenter(e.target.value)}
                    placeholder="ระบุชื่อ Service Center"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Responsible Provinces */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-400" />
            จังหวัดที่รับผิดชอบ
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            {isTechnician && technicianType === 'OUTSOURCE'
              ? 'กำหนดจังหวัดที่รับงาน — หากไม่เลือก จะมองเห็นงานทุกจังหวัดใน Marketplace'
              : 'กำหนดจังหวัดที่รับผิดชอบ — ใช้สำหรับกรองข้อมูลตามพื้นที่รับผิดชอบ'}
          </p>

          {provinces.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">ไม่มีข้อมูลจังหวัด (โหลดข้อมูล Stores ไม่สำเร็จ)</p>
          ) : (
            <>
              {/* Live search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={provinceSearch}
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  placeholder="ค้นหาจังหวัด..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
                {provinceSearch && (
                  <button
                    type="button"
                    onClick={() => setProvinceSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {(() => {
                const filtered = provinces.filter(p =>
                  !provinceSearch || p.toLowerCase().includes(provinceSearch.toLowerCase())
                )
                return filtered.length === 0 ? (
                  <p className="text-sm text-gray-500 py-3 text-center">ไม่พบจังหวัด "{provinceSearch}"</p>
                ) : (
                  <div className="border border-slate-600 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    {filtered.map((province) => (
                      <label
                        key={province}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/40 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={responsibleProvinces.includes(province)}
                          onChange={(e) => {
                            setResponsibleProvinces(prev =>
                              e.target.checked
                                ? [...prev, province]
                                : prev.filter(p => p !== province)
                            )
                          }}
                          className="w-4 h-4 rounded accent-orange-500"
                        />
                        <span className="text-sm text-white">{province}</span>
                      </label>
                    ))}
                  </div>
                )
              })()}
              <div className="mt-2 flex items-center justify-between min-h-[20px]">
                {responsibleProvinces.length > 0 ? (
                  <>
                    <p className="text-xs text-orange-400">เลือกแล้ว {responsibleProvinces.length} จังหวัด</p>
                    <button
                      type="button"
                      onClick={() => setResponsibleProvinces([])}
                      className="text-xs text-gray-500 hover:text-gray-300 underline"
                    >
                      ล้างทั้งหมด
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">ยังไม่ได้เลือกจังหวัด</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/users/${userId}`)}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 px-6 py-2 hover:brightness-110 text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: themeHighlight }}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* Technician Type Change Confirmation Modal */}
      {showTypeChangeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Confirm Type Change</h3>
                <p className="text-gray-400 text-sm">
                  {userData?.technicianType === 'OUTSOURCE' ? 'Outsource → In-house' : 'In-house → Outsource'}
                </p>
              </div>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              Changing the technician type will affect how this user accesses the system going forward.
              Historical data (past jobs, performance records) will <span className="text-white font-medium">not be affected</span>.
            </p>

            {typeChangeCheck && (typeChangeCheck.activeOutsourceJobs > 0 || typeChangeCheck.pendingBids > 0 || typeChangeCheck.activeIncidents > 0) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 space-y-2">
                <p className="text-yellow-400 text-sm font-medium">Active work that may be affected:</p>
                {typeChangeCheck.activeOutsourceJobs > 0 && (
                  <p className="text-yellow-300 text-sm">• {typeChangeCheck.activeOutsourceJobs} active outsource job{typeChangeCheck.activeOutsourceJobs !== 1 ? 's' : ''} in progress</p>
                )}
                {typeChangeCheck.pendingBids > 0 && (
                  <p className="text-yellow-300 text-sm">• {typeChangeCheck.pendingBids} pending bid{typeChangeCheck.pendingBids !== 1 ? 's' : ''} awaiting decision</p>
                )}
                {typeChangeCheck.activeIncidents > 0 && (
                  <p className="text-yellow-300 text-sm">• {typeChangeCheck.activeIncidents} active incident{typeChangeCheck.activeIncidents !== 1 ? 's' : ''} currently assigned</p>
                )}
                <p className="text-gray-400 text-xs mt-1">These jobs will still be accessible and must be completed normally.</p>
              </div>
            )}

            {typeChangeCheck && typeChangeCheck.activeOutsourceJobs === 0 && typeChangeCheck.pendingBids === 0 && typeChangeCheck.activeIncidents === 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
                <p className="text-green-400 text-sm">No active jobs or incidents — safe to change type.</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelTypeChange}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmTypeChange}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors text-sm"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
