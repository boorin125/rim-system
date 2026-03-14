'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Plus, RefreshCw, LogOut, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, AlertTriangle, Copy, Check,
  RotateCcw, Ban, Trash2, ArrowUpRight, Package
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

const TYPE_COLORS: Record<string, string> = {
  TRIAL: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  BASIC: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PROFESSIONAL: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ENTERPRISE: 'bg-green-500/20 text-green-400 border-green-500/30',
  UNLIMITED: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  INACTIVE: { color: 'text-gray-400', icon: <Clock className="w-3.5 h-3.5" />, label: 'ยังไม่ใช้งาน' },
  ACTIVE: { color: 'text-green-400', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'ใช้งานอยู่' },
  EXPIRED: { color: 'text-red-400', icon: <XCircle className="w-3.5 h-3.5" />, label: 'หมดอายุ' },
  SUSPENDED: { color: 'text-orange-400', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'ระงับชั่วคราว' },
  REVOKED: { color: 'text-red-500', icon: <Ban className="w-3.5 h-3.5" />, label: 'ยกเลิกแล้ว' },
}

interface License {
  id: number
  licenseKey: string
  licenseType: string
  organizationName: string
  contactEmail: string
  contactPhone?: string
  maxUsers: number
  maxStores: number
  maxIncidentsMonth?: number
  status: string
  issuedAt: string
  activatedAt?: string
  expiresAt: string
  activationCount: number
  maxActivations: number
  machineId?: string
  notes?: string
}

function useVendorAuth() {
  const router = useRouter()
  const getSecret = () => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem('vendor_secret') || ''
  }
  const logout = () => {
    sessionStorage.removeItem('vendor_secret')
    router.push('/vendor/login')
  }
  return { getSecret, logout }
}

function vendorFetch(url: string, secret: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-secret': secret,
      ...(options.headers || {}),
    },
  })
}

export default function VendorLicensesPage() {
  const router = useRouter()
  const { getSecret, logout } = useVendorAuth()
  const [licenses, setLicenses] = useState<License[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [renewId, setRenewId] = useState<number | null>(null)
  const [renewDate, setRenewDate] = useState('')
  const limit = 15

  const fetchLicenses = useCallback(async () => {
    const secret = getSecret()
    if (!secret) { router.push('/vendor/login'); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (filterStatus) params.set('status', filterStatus)
      if (filterType) params.set('licenseType', filterType)
      const res = await vendorFetch(`${API_URL}/vendor/licenses?${params}`, secret)
      if (res.status === 403) { logout(); return }
      const data = await res.json()
      setLicenses(data.data || data.licenses || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterType])

  useEffect(() => { fetchLicenses() }, [fetchLicenses])

  const copyKey = (key: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(key)
    } else {
      const el = document.createElement('textarea')
      el.value = key
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const doAction = async (id: number, action: string, body?: object) => {
    const secret = getSecret()
    setActionLoading(id)
    try {
      await vendorFetch(`${API_URL}/vendor/licenses/${id}/${action}`, secret, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      await fetchLicenses()
    } finally {
      setActionLoading(null)
    }
  }

  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white">RIM Vendor Portal</span>
            <span className="text-gray-500 text-sm ml-2">{total} licenses</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLicenses} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/vendor/patches')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm rounded-lg transition-colors border border-slate-600"
            >
              <Package className="w-4 h-4" />
              Patches
            </button>
            <button
              onClick={() => router.push('/vendor/licenses/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              สร้าง License
            </button>
            <button onClick={logout} className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500">
            <option value="">สถานะทั้งหมด</option>
            <option value="INACTIVE">ยังไม่ใช้งาน</option>
            <option value="ACTIVE">ใช้งานอยู่</option>
            <option value="EXPIRED">หมดอายุ</option>
            <option value="SUSPENDED">ระงับชั่วคราว</option>
            <option value="REVOKED">ยกเลิกแล้ว</option>
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500">
            <option value="">ประเภททั้งหมด</option>
            <option value="TRIAL">Trial</option>
            <option value="BASIC">Basic</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="UNLIMITED">Unlimited</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-700/50 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              กำลังโหลด...
            </div>
          ) : licenses.length === 0 ? (
            <div className="text-center py-16 text-gray-500">ไม่พบ License</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3">License Key</th>
                  <th className="text-left px-4 py-3">องค์กร</th>
                  <th className="text-left px-4 py-3">ประเภท</th>
                  <th className="text-left px-4 py-3">สถานะ</th>
                  <th className="text-left px-4 py-3">หมดอายุ</th>
                  <th className="text-left px-4 py-3">เครื่อง</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => {
                  const days = daysUntil(lic.expiresAt)
                  const isExpanded = expandedId === lic.id
                  const status = STATUS_CONFIG[lic.status] || STATUS_CONFIG.INACTIVE
                  return (
                    <>
                      <tr key={lic.id} className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors">
                        {/* Key */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="text-purple-300 text-sm font-mono">{lic.licenseKey}</code>
                            <button onClick={() => copyKey(lic.licenseKey)} className="text-gray-600 hover:text-gray-300 transition-colors">
                              {copiedKey === lic.licenseKey ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        {/* Org */}
                        <td className="px-4 py-3">
                          <div className="text-white text-sm">{lic.organizationName}</div>
                          <div className="text-gray-500 text-xs">{lic.contactEmail}</div>
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[lic.licenseType] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                            {lic.licenseType}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 text-sm ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </div>
                        </td>
                        {/* Expiry */}
                        <td className="px-4 py-3">
                          <div className={`text-sm ${days < 0 ? 'text-red-400' : days < 30 ? 'text-amber-400' : 'text-gray-300'}`}>
                            {formatDate(lic.expiresAt)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {days < 0 ? `หมดแล้ว ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}
                          </div>
                        </td>
                        {/* Machines */}
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {lic.activationCount}/{lic.maxActivations}
                        </td>
                        {/* Expand */}
                        <td className="px-4 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : lic.id)}
                            className="text-gray-500 hover:text-gray-300 transition-colors">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr key={`${lic.id}-expanded`} className="bg-gray-800/30 border-b border-gray-700/30">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                              <div>
                                <span className="text-gray-500">Users:</span>
                                <span className="text-white ml-2">{lic.maxUsers.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Stores:</span>
                                <span className="text-white ml-2">{lic.maxStores.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Incidents/เดือน:</span>
                                <span className="text-white ml-2">{lic.maxIncidentsMonth ?? 'ไม่จำกัด'}</span>
                              </div>
                              {lic.machineId && (
                                <div>
                                  <span className="text-gray-500">Machine ID:</span>
                                  <code className="text-gray-300 text-xs ml-2">{lic.machineId}</code>
                                </div>
                              )}
                              {lic.notes && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">หมายเหตุ:</span>
                                  <span className="text-gray-300 ml-2">{lic.notes}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            {lic.status === 'REVOKED' ? (
                              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span className="text-red-400 text-sm font-medium">License ถูกยกเลิกถาวรแล้ว — ไม่สามารถดำเนินการใดๆ ได้</span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {/* Renew */}
                                {renewId === lic.id ? (
                                  <div className="flex items-center gap-2">
                                    <input type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)}
                                      className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-purple-500" />
                                    <button
                                      onClick={async () => {
                                        if (!renewDate) return
                                        await doAction(lic.id, 'renew', { newExpiresAt: new Date(renewDate).toISOString() })
                                        setRenewId(null)
                                        setRenewDate('')
                                      }}
                                      disabled={!renewDate || actionLoading === lic.id}
                                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
                                    >
                                      ยืนยัน
                                    </button>
                                    <button onClick={() => { setRenewId(null); setRenewDate('') }}
                                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors">
                                      ยกเลิก
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setRenewId(lic.id); setRenewDate('') }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-sm rounded-lg transition-colors">
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                    ต่ออายุ
                                  </button>
                                )}

                                {/* Force Transfer */}
                                {lic.activationCount > 0 && (
                                  <button
                                    onClick={() => doAction(lic.id, 'force-transfer')}
                                    disabled={actionLoading === lic.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-sm rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Force Transfer
                                  </button>
                                )}

                                {/* Suspend */}
                                {lic.status !== 'SUSPENDED' && (
                                  <button
                                    onClick={() => confirm('ระงับ License นี้?') && doAction(lic.id, 'suspend')}
                                    disabled={actionLoading === lic.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 text-sm rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    ระงับ
                                  </button>
                                )}

                                {/* Revoke */}
                                <button
                                  onClick={() => confirm('ยกเลิก License นี้ถาวร? ไม่สามารถย้อนกลับได้') && doAction(lic.id, 'revoke')}
                                  disabled={actionLoading === lic.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Revoke
                                </button>

                                {actionLoading === lic.id && (
                                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    กำลังดำเนินการ...
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>แสดง {(page - 1) * limit + 1}–{Math.min(page * limit, total)} จาก {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg transition-colors">
                ก่อนหน้า
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg transition-colors">
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
