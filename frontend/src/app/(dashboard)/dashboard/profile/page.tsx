// app/(dashboard)/dashboard/profile/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useTabState } from '@/hooks/useTabState'
import {
  User,
  Mail,
  Phone,
  Shield,
  Clock,
  Calendar,
  Save,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  MapPin,
  Camera,
  Trash2,
  Loader2,
  FileText,
  Upload,
  X,
  CreditCard,
  Search,
} from 'lucide-react'
import { useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface UserProfile {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  department?: string
  address?: string
  avatarPath?: string
  bankBookPath?: string
  idCardPath?: string
  signaturePath?: string
  roles: string[]
  technicianType?: string
  responsibleProvinces?: string[]
  status: string
  twoFactorEnabled: boolean
  lastLogin?: string
  lastPasswordChange?: string
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const themeHighlight = useThemeHighlight()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [activeTab, setActiveTab] = useTabState<'profile' | 'security'>('profile')

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [address, setAddress] = useState('')

  // Responsible Provinces (Outsource only)
  const [responsibleProvinces, setResponsibleProvinces] = useState<string[]>([])
  const [allProvinces, setAllProvinces] = useState<string[]>([])
  const [provinceSearch, setProvinceSearch] = useState('')
  const [isSavingProvinces, setIsSavingProvinces] = useState(false)

  // Provider name for watermark
  const [providerName, setProviderName] = useState('')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null)
  const [docPreview, setDocPreview] = useState<{ type: string; url: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bankBookInputRef = useRef<HTMLInputElement>(null)
  const idCardInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const roles: Record<string, { label: string; color: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    IT_MANAGER: { label: 'IT Manager', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    FINANCE_ADMIN: { label: 'Finance Admin', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    HELP_DESK: { label: 'Help Desk', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    SUPERVISOR: { label: 'Supervisor', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    TECHNICIAN: { label: 'Technician', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    END_USER: { label: 'End User', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    READ_ONLY: { label: 'Read Only', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  }

  useEffect(() => {
    fetchProfile()
    fetchProvinces()
    fetchProviderName()
  }, [])

  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProfile(response.data)
      setFirstName(response.data.firstName || '')
      setLastName(response.data.lastName || '')
      setPhone(response.data.phone || '')
      setDepartment(response.data.department || '')
      setAddress(response.data.address || '')
      setResponsibleProvinces(response.data.responsibleProvinces || [])
    } catch (error) {
      toast.error('Failed to load profile')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProvinces = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/provinces`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAllProvinces(response.data || [])
    } catch {
      // silently fail — province list not critical
    }
  }

  const fetchProviderName = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/service-report`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProviderName(response.data?.providerName || '')
    } catch {
      // silently fail — watermark will use fallback text
    }
  }

  const handleSaveProvinces = async () => {
    try {
      setIsSavingProvinces(true)
      const token = localStorage.getItem('token')
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile`,
        { responsibleProvinces },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProfile((prev) => prev ? { ...prev, responsibleProvinces } : prev)
      toast.success('บันทึกจังหวัดที่รับผิดชอบสำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSavingProvinces(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      const token = localStorage.getItem('token')
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile`,
        { firstName, lastName, phone, department, address },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setProfile(response.data.user)

      // Update localStorage user data
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        user.firstName = firstName
        user.lastName = lastName
        user.phone = phone
        user.department = department
        user.address = address
        localStorage.setItem('user', JSON.stringify(user))
      }

      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    try {
      setIsChangingPassword(true)
      const token = localStorage.getItem('token')
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      fetchProfile() // Refresh to get updated lastPasswordChange
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB')
      return
    }

    try {
      setIsUploadingAvatar(true)
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile/avatar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      // Update profile with new avatar
      setProfile((prev) => prev ? { ...prev, avatarPath: res.data.avatarUrl } : prev)

      // Update localStorage
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        user.avatarPath = res.data.avatarUrl
        localStorage.setItem('user', JSON.stringify(user))
      }

      toast.success('Avatar updated successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAvatar = async () => {
    try {
      setIsUploadingAvatar(true)
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile/avatar`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setProfile((prev) => prev ? { ...prev, avatarPath: undefined } : prev)

      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        delete user.avatarPath
        localStorage.setItem('user', JSON.stringify(user))
      }

      toast.success('Avatar deleted successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'bank-book' | 'id-card') => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB')
      return
    }

    try {
      setIsUploadingDoc(docType)
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append(docType === 'bank-book' ? 'bankBook' : 'idCard', file)

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile/${docType}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      const key = docType === 'bank-book' ? 'bankBookPath' : 'idCardPath'
      const urlKey = docType === 'bank-book' ? 'bankBookUrl' : 'idCardUrl'
      setProfile((prev) => prev ? { ...prev, [key]: res.data[urlKey] } : prev)
      toast.success(res.data.message)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setIsUploadingDoc(null)
      if (docType === 'bank-book' && bankBookInputRef.current) bankBookInputRef.current.value = ''
      if (docType === 'id-card' && idCardInputRef.current) idCardInputRef.current.value = ''
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 2MB')
      return
    }

    try {
      setIsUploadingDoc('signature')
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('signature', file)

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile/signature`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setProfile((prev) => prev ? { ...prev, signaturePath: res.data.signatureUrl } : prev)
      toast.success(res.data.message)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setIsUploadingDoc(null)
      if (signatureInputRef.current) signatureInputRef.current.value = ''
    }
  }

  const handleDeleteSignature = async () => {
    try {
      setIsUploadingDoc('signature')
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/profile/signature`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setProfile((prev) => prev ? { ...prev, signaturePath: undefined } : prev)
      toast.success('ลบลายเซ็นสำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ลบไม่สำเร็จ')
    } finally {
      setIsUploadingDoc(null)
    }
  }

  const getDocUrl = (path?: string) => {
    if (!path) return null
    const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')
    return `${base}${path.startsWith('/uploads/') ? path : `/uploads/${path}`}`
  }

  const avatarUrl = profile?.avatarPath
    ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${profile.avatarPath.startsWith('/uploads/') ? profile.avatarPath : `/uploads/${profile.avatarPath}`}`
    : null

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const hasProfileChanges = profile && (
    firstName !== (profile.firstName || '') ||
    lastName !== (profile.lastName || '') ||
    phone !== (profile.phone || '') ||
    department !== (profile.department || '') ||
    address !== (profile.address || '')
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white mb-2">Profile Not Found</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-gray-400 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-6">
          {/* Avatar with upload overlay */}
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-600"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </div>
            )}
            {/* Upload overlay */}
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {isUploadingAvatar ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
                    title="Change avatar"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteAvatar}
                      className="p-1.5 rounded-full bg-red-500/40 hover:bg-red-500/60 text-white transition"
                      title="Remove avatar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-gray-400">@{profile.username}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {profile.roles.map((r) => {
                const roleInfo = roles[r] || { label: r, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
                return (
                  <span
                    key={r}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${roleInfo.color}`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {roleInfo.label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'profile'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <User className="w-4 h-4 inline mr-2" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'security'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Key className="w-4 h-4 inline mr-2" />
          Security
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Edit Profile Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSaveProfile} className="glass-card p-6 rounded-2xl space-y-6">
              <h3 className="text-lg font-semibold text-white">Edit Profile</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter department"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Enter your address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email (cannot be changed)
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username (cannot be changed)
                </label>
                <input
                  type="text"
                  value={profile.username}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-gray-400 cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving || !hasProfileChanges}
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

            {/* Responsible Provinces — Outsource only */}
            {profile.technicianType === 'OUTSOURCE' && (
              <div className="glass-card p-6 rounded-2xl space-y-4 mt-6">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-400" />
                    จังหวัดที่รับผิดชอบ
                    {responsibleProvinces.length > 0 && (
                      <span className="ml-auto text-sm font-normal text-gray-400">
                        เลือกแล้ว {responsibleProvinces.length} จังหวัด
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    กำหนดจังหวัดที่รับงาน — หากไม่เลือก จะมองเห็นงานทุกจังหวัดใน Marketplace
                  </p>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={provinceSearch}
                    onChange={(e) => setProvinceSearch(e.target.value)}
                    placeholder="ค้นหาจังหวัด..."
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  {provinceSearch && (
                    <button
                      type="button"
                      onClick={() => setProvinceSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Province checkboxes */}
                {(() => {
                  const filtered = allProvinces.filter(
                    (p) => !provinceSearch || p.toLowerCase().includes(provinceSearch.toLowerCase())
                  )
                  return filtered.length === 0 ? (
                    <p className="text-sm text-gray-500 py-3 text-center">
                      ไม่พบจังหวัด &quot;{provinceSearch}&quot;
                    </p>
                  ) : (
                    <div className="border border-slate-600 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                      {filtered.map((province) => (
                        <label
                          key={province}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={responsibleProvinces.includes(province)}
                            onChange={(e) =>
                              setResponsibleProvinces((prev) =>
                                e.target.checked
                                  ? [...prev, province]
                                  : prev.filter((p) => p !== province)
                              )
                            }
                            className="w-4 h-4 rounded accent-orange-500"
                          />
                          <span className="text-sm text-white">{province}</span>
                        </label>
                      ))}
                    </div>
                  )
                })()}

                <div className="flex items-center justify-between pt-1">
                  {responsibleProvinces.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setResponsibleProvinces([])}
                      className="text-sm text-gray-400 hover:text-red-400 transition"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveProvinces}
                    disabled={isSavingProvinces}
                    className="ml-auto flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {isSavingProvinces ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Documents Section */}
            <div className="glass-card p-6 rounded-2xl space-y-6 mt-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                เอกสาร
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bank Book */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">
                    <CreditCard className="w-4 h-4 inline mr-1" />
                    หน้าบัญชีธนาคาร
                  </label>
                  {getDocUrl(profile.bankBookPath) ? (
                    <div className="relative group">
                      <img
                        src={getDocUrl(profile.bankBookPath)!}
                        alt="Bank Book"
                        className="w-full h-40 object-cover rounded-xl border border-slate-600 cursor-pointer"
                        onClick={() => setDocPreview({ type: 'หน้าบัญชีธนาคาร', url: getDocUrl(profile.bankBookPath)! })}
                      />
                      <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => setDocPreview({ type: 'หน้าบัญชีธนาคาร', url: getDocUrl(profile.bankBookPath)! })}
                          className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-sm hover:bg-white/30 transition"
                        >
                          ดูรูป
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-gray-500">
                      <CreditCard className="w-8 h-8 mb-2" />
                      <p className="text-sm">ยังไม่ได้อัปโหลด</p>
                    </div>
                  )}
                  <button
                    onClick={() => bankBookInputRef.current?.click()}
                    disabled={isUploadingDoc === 'bank-book'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {isUploadingDoc === 'bank-book' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {profile.bankBookPath ? 'เปลี่ยนรูป' : 'อัปโหลด'}
                  </button>
                  <input
                    ref={bankBookInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={(e) => handleDocumentUpload(e, 'bank-book')}
                    className="hidden"
                  />
                </div>

                {/* ID Card */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">
                    <FileText className="w-4 h-4 inline mr-1" />
                    สำเนาบัตรประชาชน
                  </label>
                  {getDocUrl(profile.idCardPath) ? (
                    <div className="relative group">
                      <img
                        src={getDocUrl(profile.idCardPath)!}
                        alt="ID Card"
                        className="w-full h-40 object-cover rounded-xl border border-slate-600 cursor-pointer"
                        onClick={() => setDocPreview({ type: 'สำเนาบัตรประชาชน', url: getDocUrl(profile.idCardPath)! })}
                      />
                      <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => setDocPreview({ type: 'สำเนาบัตรประชาชน', url: getDocUrl(profile.idCardPath)! })}
                          className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-sm hover:bg-white/30 transition"
                        >
                          ดูรูป
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-gray-500">
                      <FileText className="w-8 h-8 mb-2" />
                      <p className="text-sm">ยังไม่ได้อัปโหลด</p>
                    </div>
                  )}
                  <button
                    onClick={() => idCardInputRef.current?.click()}
                    disabled={isUploadingDoc === 'id-card'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {isUploadingDoc === 'id-card' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {profile.idCardPath ? 'เปลี่ยนรูป' : 'อัปโหลด'}
                  </button>
                  <input
                    ref={idCardInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={(e) => handleDocumentUpload(e, 'id-card')}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Digital Signature */}
              <div className="col-span-full space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  <Upload className="w-4 h-4 inline mr-1" />
                  ลายเซ็นดิจิทัล (Digital Signature)
                </label>
                <p className="text-xs text-gray-400">
                  ลายเซ็นนี้จะถูกใช้แสดงใน Service Report ของงานที่คุณรับผิดชอบ
                </p>
                {getDocUrl(profile.signaturePath) ? (
                  <div className="relative group">
                    <img
                      src={getDocUrl(profile.signaturePath)!}
                      alt="Digital Signature"
                      className="w-full max-w-md h-32 object-contain rounded-xl border border-slate-600 bg-white p-2"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={handleDeleteSignature}
                        disabled={isUploadingDoc === 'signature'}
                        className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-white text-sm transition flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-md h-32 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-gray-500">
                    <Upload className="w-8 h-8 mb-2" />
                    <p className="text-sm">ยังไม่ได้อัปโหลดลายเซ็น</p>
                  </div>
                )}
                <button
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={isUploadingDoc === 'signature'}
                  className="max-w-md w-full flex items-center justify-center gap-2 px-4 py-2 hover:brightness-110 text-white rounded-lg text-sm transition disabled:opacity-50"
                  style={{ backgroundColor: themeHighlight }}
                >
                  {isUploadingDoc === 'signature' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {profile.signaturePath ? 'เปลี่ยนลายเซ็น' : 'อัปโหลดลายเซ็น'}
                </button>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">Account Info</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-gray-300 text-sm">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Login</p>
                    <p className="text-gray-300 text-sm">{formatDate(profile.lastLogin)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-xs text-gray-500">Member Since</p>
                    <p className="text-gray-300 text-sm">{formatDate(profile.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Responsible Provinces — sidebar summary */}
            {(profile.technicianType === 'OUTSOURCE' || (profile.responsibleProvinces && profile.responsibleProvinces.length > 0)) && (
              <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-400" />
                  จังหวัดที่รับผิดชอบ
                  <span className="ml-auto text-sm font-normal text-gray-400">
                    {responsibleProvinces.length} จังหวัด
                  </span>
                </h3>
                {responsibleProvinces.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {[...responsibleProvinces].sort().map((province) => (
                      <span
                        key={province}
                        className="px-3 py-1.5 bg-orange-500/10 text-orange-300 border border-orange-500/30 rounded-lg text-sm"
                      >
                        {province}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">ไม่ได้ระบุ — มองเห็นงานทุกจังหวัด</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal with Watermark */}
      {docPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setDocPreview(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{docPreview.type}</h3>
              <button
                onClick={() => setDocPreview(null)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={docPreview.url}
                alt={docPreview.type}
                className="w-full object-contain max-h-[70vh]"
              />
              {/* Watermark Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 10 }}>
                <div
                  className="text-red-500 font-bold text-lg text-center leading-snug"
                  style={{ userSelect: 'none', opacity: 0.5, textShadow: '0 1px 2px rgba(0,0,0,0.5)', transform: 'rotate(-30deg)' }}
                >
                  <div>ใช้เฉพาะรับเงินค่าจ้างงาน Onsite</div>
                  <div>{providerName ? `จาก '${providerName}' เท่านั้น` : 'เท่านั้น'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Change Password Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleChangePassword} className="glass-card p-6 rounded-2xl space-y-6">
              <h3 className="text-lg font-semibold text-white">Change Password</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    placeholder="Enter new password (min 8 characters)"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Must contain uppercase, lowercase, number and special character
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Passwords do not match
                  </p>
                )}
                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Passwords match
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 px-6 py-2 hover:brightness-110 text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: themeHighlight }}
                >
                  {isChangingPassword ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Security Info */}
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">Security Status</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Key className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Password Change</p>
                    <p className="text-gray-300 text-sm">{formatDate(profile.lastPasswordChange)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Shield className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-xs text-gray-500">Two-Factor Authentication</p>
                    <p className={`text-sm ${profile.twoFactorEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                      {profile.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-gray-500">Account Status</p>
                    <p className="text-green-400 text-sm">{profile.status}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
