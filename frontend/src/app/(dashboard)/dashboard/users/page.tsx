// app/(dashboard)/dashboard/users/page.tsx - User Management
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Users,
  Mail,
  Phone,
  Shield,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Lock,
  Clock,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface User {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  department?: string
  roles: string[]
  status: string
  lastLogin?: string
  createdAt: string
}

export default function UsersPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  const itemsPerPage = 12

  const roles = [
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
    { value: 'IT_MANAGER', label: 'IT Manager' },
    { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
    { value: 'HELP_DESK', label: 'Help Desk' },
    { value: 'SUPERVISOR', label: 'Supervisor' },
    { value: 'TECHNICIAN', label: 'Technician' },
    { value: 'END_USER', label: 'End User' },
    { value: 'READ_ONLY', label: 'Read Only' },
  ]

  const statuses = [
    { value: 'PENDING', label: 'Pending Approval' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'LOCKED', label: 'Locked' },
  ]

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    filterUsersData()
  }, [users, searchTerm, filterRole, filterStatus])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setUsers(response.data || [])
    } catch (error: any) {
      toast.error('Failed to load users')
      console.error(error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsersData = () => {
    if (!Array.isArray(users)) return
    let filtered = [...users]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Role filter - check if user has this role in their roles array
    if (filterRole !== 'ALL') {
      filtered = filtered.filter((user) => user.roles?.includes(filterRole))
    }

    // Status filter
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter((user) => user.status === filterStatus)
    }

    setFilteredUsers(filtered)
    setCurrentPage(1)
  }

  const getRoleBadge = (role: string) => {
    const badges: Record<string, string> = {
      SUPER_ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
      IT_MANAGER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      FINANCE_ADMIN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      HELP_DESK: 'bg-green-500/20 text-green-400 border-green-500/30',
      SUPERVISOR: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      TECHNICIAN: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      END_USER: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      READ_ONLY: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    }
    return badges[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const getRoleLabel = (role: string) => {
    const found = roles.find(r => r.value === role)
    return found ? found.label : role
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
      INACTIVE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      SUSPENDED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      LOCKED: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return badges[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const getStatusLabel = (status: string) => {
    const found = statuses.find(s => s.value === status)
    return found ? found.label : status
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 mt-1">
            Manage user roles and access permissions
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{users.length}</p>
              <p className="text-sm text-gray-400">Total Users</p>
            </div>
          </div>
        </div>
        <div
          className={`glass-card p-4 rounded-xl cursor-pointer transition-all ${filterStatus === 'PENDING' ? 'ring-2 ring-orange-500' : 'hover:ring-1 hover:ring-orange-500/50'}`}
          onClick={() => setFilterStatus(filterStatus === 'PENDING' ? 'ALL' : 'PENDING')}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.status === 'PENDING').length}
              </p>
              <p className="text-sm text-gray-400">Pending Approval</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.status === 'ACTIVE').length}
              </p>
              <p className="text-sm text-gray-400">Active Users</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <UserX className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.status === 'SUSPENDED' || u.status === 'INACTIVE').length}
              </p>
              <p className="text-sm text-gray-400">Disabled Users</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.status === 'LOCKED').length}
              </p>
              <p className="text-sm text-gray-400">Locked Accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-6 rounded-2xl sticky top-0 z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="ALL">All Roles</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
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
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-400">
            Showing {filteredUsers.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredUsers.length)} of{' '}
            {filteredUsers.length} users
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/80 border-b border-slate-600">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  User
                </th>
                <th className="hidden sm:table-cell px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Role
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Status
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user, index) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/dashboard/users/${user.id}`)}
                  className={`
                    border-b border-slate-700/30 cursor-pointer transition-all duration-200
                    ${index % 2 === 0
                      ? 'bg-slate-800/30 hover:bg-slate-700/50'
                      : 'bg-slate-700/50 hover:bg-slate-600/60'
                    }
                  `}
                >
                  <td className="px-3 md:px-6 py-3 md:py-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shrink-0">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[140px]">{user.email || `@${user.username}`}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                          {user.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4">
                    <div className="flex flex-wrap gap-1">
                      {(user.roles || []).slice(0, 2).map((role, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${getRoleBadge(role)}`}
                        >
                          <Shield className="w-3 h-3" />
                          {getRoleLabel(role)}
                        </span>
                      ))}
                      {(user.roles || []).length > 2 && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-600/50 text-gray-300 border border-slate-500">
                          +{user.roles.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300">
                      {user.department || '-'}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusBadge(user.status)}`}
                    >
                      {getStatusLabel(user.status)}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300">
                      {formatDate(user.lastLogin)}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-300">
                      {formatDate(user.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {currentUsers.length === 0 && (
        <div className="glass-card p-12 rounded-2xl text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-xl font-semibold text-white mb-2">No users found</h3>
          <p className="text-gray-400">
            {searchTerm || filterRole !== 'ALL' || filterStatus !== 'ALL'
              ? 'Try adjusting your filters'
              : 'Users will appear here after they register'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of{' '}
            {filteredUsers.length} users
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
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page
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
    </div>
  )
}
