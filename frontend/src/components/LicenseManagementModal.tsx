'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  X, Shield, Plus, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle,
  Clock, Users, Building2, Calendar, MoreVertical, AlertTriangle, ChevronDown, ChevronUp,
  Server, Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface License {
  id: number
  licenseKey: string
  licenseType: string
  organizationName: string
  contactEmail: string
  contactPhone?: string
  maxUsers: number
  maxStores: number
  maxIncidentsMonth: number | null
  status: string
  machineId?: string
  machineIds?: string[]
  activatedAt?: string
  expiresAt: string
  activationCount: number
  maxActivations: number
  notes?: string
  createdAt: string
  activationLogs?: ActivationLog[]
}

interface ActivationLog {
  id: number
  action: string
  machineId?: string
  ipAddress?: string
  success: boolean
  errorMessage?: string
  createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  TRIAL: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  BASIC: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  PROFESSIONAL: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  ENTERPRISE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  UNLIMITED: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ACTIVE: { label: 'Active', color: 'text-green-400', icon: CheckCircle },
  INACTIVE: { label: 'Inactive', color: 'text-gray-400', icon: Clock },
  EXPIRED: { label: 'Expired', color: 'text-red-400', icon: XCircle },
  SUSPENDED: { label: 'Suspended', color: 'text-orange-400', icon: AlertCircle },
  REVOKED: { label: 'Revoked', color: 'text-red-500', icon: XCircle },
}

const LICENSE_TYPES = ['TRIAL', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE', 'UNLIMITED']
const TYPE_DEFAULTS: Record<string, { maxUsers: number; maxStores: number; durationDays: number }> = {
  TRIAL: { maxUsers: 5, maxStores: 3, durationDays: 14 },
  BASIC: { maxUsers: 10, maxStores: 10, durationDays: 365 },
  PROFESSIONAL: { maxUsers: 50, maxStores: 50, durationDays: 365 },
  ENTERPRISE: { maxUsers: 500, maxStores: 500, durationDays: 365 },
  UNLIMITED: { maxUsers: 99999, maxStores: 99999, durationDays: 3650 },
}

interface LicenseManagementModalProps {
  onClose: () => void
}

export default function LicenseManagementModal({ onClose }: LicenseManagementModalProps) {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actionMenuId, setActionMenuId] = useState<number | null>(null)

  // Create form
  const [createForm, setCreateForm] = useState({
    licenseType: 'PROFESSIONAL',
    organizationName: '',
    contactEmail: '',
    contactPhone: '',
    maxUsers: 50,
    maxStores: 50,
    maxActivations: 1,
    expiresAt: '',
    notes: '',
  })
  // Per-machine revoke
  const [revokeMachineTarget, setRevokeMachineTarget] = useState<{ license: License; machineId: string } | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [creating, setCreating] = useState(false)

  // Force transfer
  const [forceTransferTarget, setForceTransferTarget] = useState<License | null>(null)
  const [forceTransferNote, setForceTransferNote] = useState('')
  const [forceTransferring, setForceTransferring] = useState(false)

  // Renew
  const [renewTarget, setRenewTarget] = useState<License | null>(null)
  const [renewMonths, setRenewMonths] = useState(12)
  const [renewDays, setRenewDays] = useState(0)
  const [renewing, setRenewing] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-vendor-secret': process.env.NEXT_PUBLIC_VENDOR_SECRET || '',
  }

  useEffect(() => {
    fetchLicenses()
  }, [filterType, filterStatus])

  const fetchLicenses = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterType) params.licenseType = filterType
      if (filterStatus) params.status = filterStatus
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/license/list`, { headers, params })
      setLicenses(res.data.data || [])
    } catch {
      toast.error('Failed to load licenses')
    } finally {
      setLoading(false)
    }
  }

  const fetchLicenseDetail = async (id: number) => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/license/detail/${id}`, { headers })
      setLicenses((prev) => prev.map((l) => (l.id === id ? { ...l, activationLogs: res.data.activationLogs } : l)))
    } catch {}
  }

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      fetchLicenseDetail(id)
    }
  }

  const handleTypeChange = (type: string) => {
    const defaults = TYPE_DEFAULTS[type]
    const expiresAt = new Date(Date.now() + defaults.durationDays * 86400000).toISOString().split('T')[0]
    setCreateForm((f) => ({ ...f, licenseType: type, maxUsers: defaults.maxUsers, maxStores: defaults.maxStores, expiresAt }))
  }

  const handleCreate = async () => {
    if (!createForm.organizationName || !createForm.contactEmail || !createForm.expiresAt) {
      toast.error('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setCreating(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/create`, {
        ...createForm,
        maxActivations: createForm.maxActivations || 1,
        expiresAt: new Date(createForm.expiresAt).toISOString(),
      }, { headers })
      toast.success('License created successfully')
      setShowCreate(false)
      setCreateForm({ licenseType: 'PROFESSIONAL', organizationName: '', contactEmail: '', contactPhone: '', maxUsers: 50, maxStores: 50, maxActivations: 1, expiresAt: '', notes: '' })
      fetchLicenses()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create license')
    } finally {
      setCreating(false)
    }
  }

  const handleSuspend = async (license: License) => {
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/${license.id}/suspend`, { reason: 'Suspended by admin' }, { headers })
      toast.success('License suspended')
      fetchLicenses()
    } catch { toast.error('Failed') }
    setActionMenuId(null)
  }

  const handleRevoke = async (license: License) => {
    if (!confirm(`Revoke license for "${license.organizationName}"? This cannot be undone.`)) return
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/${license.id}/revoke`, { reason: 'Revoked by admin' }, { headers })
      toast.success('License revoked')
      fetchLicenses()
    } catch { toast.error('Failed') }
    setActionMenuId(null)
  }

  const handleDelete = async (license: License) => {
    if (!confirm(`Delete license for "${license.organizationName}"?`)) return
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/license/${license.id}`, { headers })
      toast.success('License deleted')
      fetchLicenses()
    } catch { toast.error('Failed') }
    setActionMenuId(null)
  }

  const handleForceTransfer = async () => {
    if (!forceTransferTarget) return
    setForceTransferring(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/${forceTransferTarget.id}/force-transfer`, { adminNote: forceTransferNote }, { headers })
      toast.success('Machine binding cleared — License ready for re-activation')
      setForceTransferTarget(null)
      setForceTransferNote('')
      fetchLicenses()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally {
      setForceTransferring(false)
    }
  }

  const handleRevokeMachine = async () => {
    if (!revokeMachineTarget) return
    setRevoking(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/${revokeMachineTarget.license.id}/force-transfer`, {
        revokeMachineId: revokeMachineTarget.machineId,
        adminNote: 'Single machine slot revoked via management panel',
      }, { headers })
      toast.success('Machine slot revoked')
      setRevokeMachineTarget(null)
      fetchLicenses()
      if (expandedId === revokeMachineTarget.license.id) fetchLicenseDetail(revokeMachineTarget.license.id)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally {
      setRevoking(false)
    }
  }

  // Calculate preview expiry: extend from whichever is later — current expiry or today
  const calcRenewExpiry = (license: License) => {
    const base = new Date(Math.max(new Date(license.expiresAt).getTime(), Date.now()))
    base.setMonth(base.getMonth() + renewMonths)
    base.setDate(base.getDate() + renewDays)
    return base
  }

  const handleRenew = async () => {
    if (!renewTarget || (renewMonths === 0 && renewDays === 0)) return
    setRenewing(true)
    const newExpiresAt = calcRenewExpiry(renewTarget)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/${renewTarget.id}/renew`, {
        newExpiresAt: newExpiresAt.toISOString(),
        notes: `Renewed +${renewMonths}m${renewDays > 0 ? ` ${renewDays}d` : ''}`,
      }, { headers })
      toast.success(`License renewed — หมดอายุ ${newExpiresAt.toLocaleDateString('th-TH')}`)
      setRenewTarget(null)
      setRenewMonths(12)
      setRenewDays(0)
      fetchLicenses()
    } catch { toast.error('Failed') }
    finally { setRenewing(false) }
  }

  const daysRemaining = (expiresAt: string) =>
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl glass-card rounded-2xl border border-purple-500/30 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white text-lg">Manage Licenses</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLicenses} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New License
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Create Form */}
          {showCreate && (
            <div className="p-5 bg-slate-800/60 rounded-xl border border-purple-500/20 space-y-4">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" /> Create New License
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">License Type *</label>
                  <select
                    value={createForm.licenseType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {LICENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Organization Name *</label>
                  <input
                    value={createForm.organizationName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, organizationName: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="บริษัท ABC จำกัด"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Contact Email *</label>
                  <input
                    type="email"
                    value={createForm.contactEmail}
                    onChange={(e) => setCreateForm((f) => ({ ...f, contactEmail: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="it@company.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Phone</label>
                  <input
                    value={createForm.contactPhone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="02-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Max Users</label>
                  <input
                    type="number"
                    value={createForm.maxUsers}
                    onChange={(e) => setCreateForm((f) => ({ ...f, maxUsers: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Max Stores</label>
                  <input
                    type="number"
                    value={createForm.maxStores}
                    onChange={(e) => setCreateForm((f) => ({ ...f, maxStores: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Expires At *</label>
                  <input
                    type="date"
                    value={createForm.expiresAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Max Machines (Volume)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={createForm.maxActivations}
                    onChange={(e) => setCreateForm((f) => ({ ...f, maxActivations: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  {createForm.maxActivations > 1 && (
                    <p className="text-xs text-amber-400 mt-1">Volume License — ใช้ได้ {createForm.maxActivations} เครื่อง</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                  <input
                    value={createForm.notes}
                    onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="หมายเหตุ..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm hover:bg-slate-600 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create License
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">All Types</option>
              {LICENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">All Status</option>
              {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>

          {/* License List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin mr-2" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : licenses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No licenses found</div>
          ) : (
            <div className="space-y-2">
              {licenses.map((license) => {
                const sc = STATUS_CONFIG[license.status] || STATUS_CONFIG.INACTIVE
                const StatusIcon = sc.icon
                const days = daysRemaining(license.isExpanded ? license.expiresAt : license.expiresAt)
                const isExpanded = expandedId === license.id

                return (
                  <div key={license.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    {/* Row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${TYPE_COLORS[license.licenseType] || 'text-gray-400 bg-slate-700 border-slate-600'}`}>
                            {license.licenseType}
                          </span>
                          <span className="text-white font-medium text-sm truncate">{license.organizationName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-mono text-gray-500">{license.licenseKey}</span>
                          <span className={`text-xs flex items-center gap-1 ${sc.color}`}>
                            <StatusIcon className="w-3 h-3" />{sc.label}
                          </span>
                          {license.status !== 'EXPIRED' && license.status !== 'REVOKED' && (
                            <span className={`text-xs ${days < 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                              {days > 0 ? `${days} วันเหลือ` : 'หมดอายุ'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Usage */}
                      <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{license.maxUsers}</span>
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{license.maxStores}</span>
                        {/* Machine slots */}
                        <span className={`flex items-center gap-1 ${license.activationCount >= license.maxActivations ? 'text-red-400' : license.activationCount > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          <Server className="w-3 h-3" />
                          {license.activationCount}/{license.maxActivations}
                          {license.maxActivations > 1 && <span className="text-amber-400 ml-0.5">V</span>}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(license.expiresAt).toLocaleDateString('th-TH')}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleExpand(license.id)}
                          className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === license.id ? null : license.id)}
                            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {actionMenuId === license.id && (
                            <div className="absolute right-0 top-8 z-10 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                              <button
                                onClick={() => { setRenewTarget(license); setRenewMonths(12); setRenewDays(0); setActionMenuId(null) }}
                                className="w-full px-4 py-2.5 text-left text-sm text-green-400 hover:bg-slate-700 transition-colors"
                              >
                                Renew License
                              </button>
                              {license.machineId && (
                                <button
                                  onClick={() => { setForceTransferTarget(license); setActionMenuId(null) }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-amber-400 hover:bg-slate-700 transition-colors"
                                >
                                  Force Transfer
                                </button>
                              )}
                              {license.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleSuspend(license)}
                                  className="w-full px-4 py-2.5 text-left text-sm text-orange-400 hover:bg-slate-700 transition-colors"
                                >
                                  Suspend
                                </button>
                              )}
                              <button
                                onClick={() => handleRevoke(license)}
                                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                              >
                                Revoke
                              </button>
                              <button
                                onClick={() => handleDelete(license)}
                                className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-slate-700 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-700 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-gray-400 text-xs">Contact Email</p>
                            <p className="text-white">{license.contactEmail}</p>
                          </div>
                          {license.contactPhone && (
                            <div>
                              <p className="text-gray-400 text-xs">Phone</p>
                              <p className="text-white">{license.contactPhone}</p>
                            </div>
                          )}
                          {license.notes && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-gray-400 text-xs">Notes</p>
                              <p className="text-gray-300 text-sm whitespace-pre-wrap">{license.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Bound Machines */}
                        <div>
                          <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                            <Server className="w-3 h-3" />
                            Bound Machines ({license.activationCount}/{license.maxActivations})
                            {license.maxActivations > 1 && <span className="ml-1 text-amber-400 text-xs">Volume License</span>}
                          </p>
                          {(license.machineIds && license.machineIds.length > 0) ? (
                            <div className="space-y-1">
                              {license.machineIds.map((mid, idx) => (
                                <div key={mid} className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg">
                                  <Server className="w-3 h-3 text-green-400 flex-shrink-0" />
                                  <span className="text-xs font-mono text-gray-300 flex-1 truncate">
                                    Machine {idx + 1}: {mid}
                                    {mid === license.machineId && <span className="ml-2 text-blue-400">(Primary)</span>}
                                  </span>
                                  <button
                                    onClick={() => setRevokeMachineTarget({ license, machineId: mid })}
                                    className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
                                  >
                                    Revoke
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : license.machineId ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg">
                              <Server className="w-3 h-3 text-green-400" />
                              <span className="text-xs font-mono text-gray-300 flex-1 truncate">{license.machineId}</span>
                              <button
                                onClick={() => setForceTransferTarget(license)}
                                className="text-xs text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded hover:bg-amber-500/10 transition-colors"
                              >
                                Transfer
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 italic">ยังไม่มีเครื่องที่ Activate</p>
                          )}
                        </div>

                        {/* Activation Logs */}
                        {license.activationLogs && license.activationLogs.length > 0 && (
                          <div>
                            <p className="text-gray-400 text-xs mb-2">Activation Log</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {license.activationLogs.map((log) => (
                                <div key={log.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-slate-700/40">
                                  {log.success
                                    ? <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                                    : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                  <span className={`font-medium ${log.success ? 'text-green-400' : 'text-red-400'}`}>{log.action}</span>
                                  {log.machineId && <span className="text-gray-500 font-mono truncate">{log.machineId.slice(0, 12)}...</span>}
                                  <span className="text-gray-500 ml-auto flex-shrink-0">
                                    {new Date(log.createdAt).toLocaleString('th-TH')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Force Transfer Confirm Modal */}
      {forceTransferTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setForceTransferTarget(null)} />
          <div className="relative w-full max-w-md glass-card rounded-2xl border border-amber-500/30 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold">Force Transfer License</h3>
                <p className="text-gray-400 text-sm mt-1">
                  License: <span className="text-white font-mono">{forceTransferTarget.licenseKey}</span>
                </p>
                <p className="text-gray-400 text-sm">
                  Org: <span className="text-white">{forceTransferTarget.organizationName}</span>
                </p>
                {forceTransferTarget.machineId && (
                  <p className="text-gray-400 text-sm">
                    Bound To: <span className="text-white font-mono">{forceTransferTarget.machineId.slice(0, 16)}...</span>
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              การกระทำนี้จะล้าง Machine Binding ทันที ทำให้ License สามารถ Activate ที่ Server ใหม่ได้
            </p>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">หมายเหตุ (ไม่บังคับ)</label>
              <input
                value={forceTransferNote}
                onChange={(e) => setForceTransferNote(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="เช่น Server เก่า Down ต้องย้าย DC"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setForceTransferTarget(null)} className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-xl text-sm hover:bg-slate-600 transition-colors">
                ยกเลิก
              </button>
              <button
                onClick={handleForceTransfer}
                disabled={forceTransferring}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {forceTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Force Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Single Machine Modal */}
      {revokeMachineTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRevokeMachineTarget(null)} />
          <div className="relative w-full max-w-md glass-card rounded-2xl border border-red-500/30 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Server className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold">Revoke Machine Slot</h3>
                <p className="text-gray-400 text-sm mt-1">
                  License: <span className="font-mono text-white">{revokeMachineTarget.license.licenseKey}</span>
                </p>
                <p className="text-gray-400 text-sm">
                  Machine: <span className="font-mono text-red-300 text-xs">{revokeMachineTarget.machineId}</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              เครื่องนี้จะถูกถอดออกจาก License ทันที ระบบบนเครื่องนั้นจะไม่สามารถใช้งานได้จนกว่าจะ Activate ใหม่
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRevokeMachineTarget(null)} className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-xl text-sm hover:bg-slate-600 transition-colors">
                ยกเลิก
              </button>
              <button
                onClick={handleRevokeMachine}
                disabled={revoking}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                Revoke Machine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRenewTarget(null)} />
          <div className="relative w-full max-w-sm glass-card rounded-2xl border border-green-500/30 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="text-white font-semibold">Renew License</h3>
            </div>

            {/* License info */}
            <div className="bg-slate-700/40 rounded-xl p-3 space-y-1 text-sm">
              <p className="text-white font-medium">{renewTarget.organizationName}</p>
              <p className="text-gray-400 font-mono text-xs">{renewTarget.licenseKey}</p>
              <p className="text-gray-400 text-xs">
                หมดอายุปัจจุบัน:{' '}
                <span className={new Date(renewTarget.expiresAt) < new Date() ? 'text-red-400' : 'text-gray-300'}>
                  {new Date(renewTarget.expiresAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </p>
            </div>

            {/* Quick presets */}
            <div>
              <p className="text-xs text-gray-400 mb-2">ต่ออายุด่วน</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: '3 เดือน', m: 3, d: 0 },
                  { label: '6 เดือน', m: 6, d: 0 },
                  { label: '1 ปี', m: 12, d: 0 },
                  { label: '2 ปี', m: 24, d: 0 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => { setRenewMonths(p.m); setRenewDays(p.d) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      renewMonths === p.m && renewDays === p.d
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'bg-slate-700 border-slate-600 text-gray-300 hover:border-green-500/50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">เดือน</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 text-center"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">วัน (เพิ่มเติม)</label>
                <input
                  type="number"
                  min={0}
                  max={364}
                  value={renewDays}
                  onChange={(e) => setRenewDays(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 text-center"
                />
              </div>
            </div>

            {/* Preview */}
            {(renewMonths > 0 || renewDays > 0) && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm">
                <p className="text-gray-400 text-xs mb-1">หมดอายุใหม่</p>
                <p className="text-green-300 font-semibold">
                  {calcRenewExpiry(renewTarget).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  ต่อจาก{new Date(renewTarget.expiresAt) < new Date() ? 'วันนี้' : 'วันหมดอายุเดิม'} +{renewMonths > 0 ? ` ${renewMonths} เดือน` : ''}{renewDays > 0 ? ` ${renewDays} วัน` : ''}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setRenewTarget(null)} className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-xl text-sm hover:bg-slate-600 transition-colors">
                ยกเลิก
              </button>
              <button
                onClick={handleRenew}
                disabled={renewing || (renewMonths === 0 && renewDays === 0)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Renew License
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
