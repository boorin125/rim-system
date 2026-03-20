// app/(dashboard)/dashboard/users/[id]/page.tsx - User Detail
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  User,
  Mail,
  Phone,
  Shield,
  Clock,
  Calendar,
  Edit,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Building,
  Wrench,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface UserDetail {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  department?: string
  address?: string
  technicianType?: 'INSOURCE' | 'OUTSOURCE'
  serviceCenter?: string
  responsibleProvinces?: string[]
  roles: string[]
  status: string
  twoFactorEnabled: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
  _count?: {
    incidentsCreated: number
    incidentsAssigned: number
  }
}


export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const themeHighlight = useThemeHighlight()

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

  const statuses: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Active', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    INACTIVE: { label: 'Inactive', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    SUSPENDED: { label: 'Suspended', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    LOCKED: { label: 'Locked', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  }

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setCurrentUser(JSON.parse(userStr))
    }
    fetchUserData()
  }, [userId])

  const fetchUserData = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const userResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setUser(userResponse.data)
    } catch (error: any) {
      toast.error('Failed to load user data')
      console.error(error)
      if (error.response?.status === 404) {
        router.push('/dashboard/users')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/update-status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(newStatus === 'ACTIVE' ? 'User enabled successfully' : 'User disabled successfully')
      fetchUserData()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update status')
    }
  }

  const handleUnlockAccount = async () => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/unlock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Account unlocked successfully')
      fetchUserData()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to unlock account')
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Support both single role and multi-roles
  const userRoles = Array.isArray(currentUser?.roles) ? currentUser.roles : [currentUser?.role]
  const canManageUsers = userRoles.some((r: string) => ['SUPER_ADMIN', 'IT_MANAGER'].includes(r))

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white mb-2">User Not Found</h2>
          <p className="text-gray-400 mb-4">The requested user does not exist.</p>
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

  // Get user roles array with fallback
  const userRolesList = user.roles || []
  const status = statuses[user.status] || { label: user.status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <BackButton href="/dashboard/users" label="กลับไปหน้า Users" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">User Details</h1>
        <p className="text-gray-400 mt-1">View and manage user information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {user.firstName} {user.lastName}
                  </h2>
                  <span className={`flex-shrink-0 px-3 py-1 rounded-lg text-sm font-semibold border ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-gray-400 mb-4">@{user.username}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {userRolesList.map((r) => {
                    const roleInfo = roles[r] || { label: r, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
                    return (
                      <span
                        key={r}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${roleInfo.color}`}
                      >
                        <Shield className="w-4 h-4" />
                        {roleInfo.label}
                      </span>
                    )
                  })}
                  {user.twoFactorEnabled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                      <Lock className="w-4 h-4" />
                      2FA Enabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl min-w-0">
                <div className="p-3 bg-blue-500/20 rounded-lg flex-shrink-0">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="text-white break-all">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Phone className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Phone</p>
                  <p className="text-white">{user.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Building className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Department</p>
                  <p className="text-white">{user.department || '-'}</p>
                </div>
              </div>
              {/* Service Center - แสดงเฉพาะ Technician */}
              {user.roles?.includes('TECHNICIAN') && (
                <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
                  <div className="p-3 bg-cyan-500/20 rounded-lg">
                    <Wrench className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Service Center</p>
                    <p className="text-white">{user.serviceCenter || '-'}</p>
                  </div>
                </div>
              )}
              {/* Address */}
              <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-xl md:col-span-2">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Address</p>
                  <p className="text-white whitespace-pre-line">{user.address || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Responsible Provinces */}
          {user.responsibleProvinces && user.responsibleProvinces.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-400" />
                จังหวัดที่รับผิดชอบ
                <span className="ml-auto text-sm font-normal text-gray-400">
                  {user.responsibleProvinces.length} จังหวัด
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.responsibleProvinces.sort().map((province) => (
                  <span
                    key={province}
                    className="px-3 py-1.5 bg-orange-500/10 text-orange-300 border border-orange-500/30 rounded-lg text-sm"
                  >
                    {province}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Last Login</p>
                  <p className="text-white">{formatDate(user.lastLogin)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
                <div className="p-3 bg-cyan-500/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Account Created</p>
                  <p className="text-white">{formatDate(user.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <Edit className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Last Updated</p>
                  <p className="text-white">{formatDate(user.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          {canManageUsers && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {/* Edit User — always first */}
                <button
                  onClick={() => router.push(`/dashboard/users/${userId}/edit`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 hover:brightness-110 text-white rounded-xl transition-colors"
                  style={{ backgroundColor: themeHighlight }}
                >
                  <Edit className="w-5 h-5" />
                  Edit User
                </button>

                {/* Approve User - for PENDING status */}
                {user.status === 'PENDING' && (
                  <button
                    onClick={() => handleUpdateStatus('ACTIVE')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Approve User
                  </button>
                )}
                {user.status === 'LOCKED' && (
                  <button
                    onClick={handleUnlockAccount}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
                  >
                    <Unlock className="w-5 h-5" />
                    Unlock Account
                  </button>
                )}
                {(user.status === 'SUSPENDED' || user.status === 'INACTIVE') && (
                  <button
                    onClick={() => {
                      if (confirm(`ต้องการเปิดใช้งาน Account ของ "${user.firstName} ${user.lastName}" หรือไม่?`))
                        handleUpdateStatus('ACTIVE')
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
                  >
                    <UserCheck className="w-5 h-5" />
                    Enable User
                  </button>
                )}

                {/* Disable User — last, grey */}
                {user.status === 'ACTIVE' && user.id !== currentUser?.id && (
                  <button
                    onClick={() => {
                      if (confirm(`ต้องการปิดใช้งาน Account ของ "${user.firstName} ${user.lastName}" หรือไม่?`))
                        handleUpdateStatus('INACTIVE')
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-gray-300 rounded-xl transition-colors"
                  >
                    <UserX className="w-5 h-5" />
                    Disable User
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
