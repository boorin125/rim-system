'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Plus, RefreshCw, LogOut, Trash2, Download,
  Eye, EyeOff, CheckCircle, Clock, AlertTriangle, Shield,
  Wrench, Zap, ChevronDown, ChevronUp, Mail,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

const PATCH_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  HOTFIX:      { label: 'Hotfix',      color: 'bg-red-500/20 text-red-400 border-red-500/30',         icon: <AlertTriangle className="w-3 h-3" /> },
  FEATURE:     { label: 'Feature',     color: 'bg-green-500/20 text-green-400 border-green-500/30',   icon: <Zap className="w-3 h-3" /> },
  SECURITY:    { label: 'Security',    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Shield className="w-3 h-3" /> },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      icon: <Wrench className="w-3 h-3" /> },
}

interface Patch {
  id: number
  version: string
  patchType: string
  title: string
  changelog: string
  fileName: string
  fileSize: number
  isPublished: boolean
  publishedAt: string | null
  emailSentAt: string | null
  downloadCount: number
  createdAt: string
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
  const isFormData = options.body instanceof FormData
  return fetch(url, {
    ...options,
    headers: {
      'x-vendor-secret': secret,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  })
}

function formatBytes(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export default function VendorPatchesPage() {
  const router = useRouter()
  const { getSecret, logout } = useVendorAuth()
  const [patches, setPatches] = useState<Patch[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const limit = 20

  const fetchPatches = useCallback(async () => {
    const secret = getSecret()
    if (!secret) { router.push('/vendor/login'); return }
    setLoading(true)
    try {
      const res = await vendorFetch(
        `${API_URL}/vendor/patches?page=${page}&limit=${limit}`,
        secret,
      )
      if (res.status === 403) { logout(); return }
      const data = await res.json()
      setPatches(data.items || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchPatches() }, [fetchPatches])

  const doAction = async (id: number, action: string) => {
    const secret = getSecret()
    setActionLoading(id)
    try {
      const res = await vendorFetch(`${API_URL}/vendor/patches/${id}/${action}`, secret, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.message || `Failed to ${action}`)
        return
      }
      fetchPatches()
    } finally {
      setActionLoading(null)
    }
  }

  const doDelete = async (id: number) => {
    const secret = getSecret()
    setActionLoading(id)
    try {
      const res = await vendorFetch(`${API_URL}/vendor/patches/${id}`, secret, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Delete failed')
        return
      }
      setConfirmDelete(null)
      fetchPatches()
    } finally {
      setActionLoading(null)
    }
  }

  const downloadPatch = (id: number) => {
    const secret = getSecret()
    const a = document.createElement('a')
    a.href = `${API_URL}/vendor/patches/${id}/download`
    // Pass secret via header not possible for direct download; use backend token approach
    // For now open a fetch-based download
    fetch(a.href, { headers: { 'x-vendor-secret': secret } })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const patch = patches.find((p) => p.id === id)
        link.download = patch?.fileName || `patch-${id}.zip`
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => alert('Download failed'))
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Patch Management</h1>
              <p className="text-sm text-gray-400">{total} patches total</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/vendor/licenses')}
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg flex items-center gap-2 border border-slate-700"
            >
              <Shield className="w-4 h-4" />
              Licenses
            </button>
            <button
              onClick={fetchPatches}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/vendor/patches/new')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Upload Patch
            </button>
            <button
              onClick={logout}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-400 rounded-lg border border-slate-700"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Patch List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : patches.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No patches yet. Upload your first patch.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patches.map((patch) => {
              const typeConf = PATCH_TYPE_CONFIG[patch.patchType] || PATCH_TYPE_CONFIG.MAINTENANCE
              const isExpanded = expandedId === patch.id
              const isActing = actionLoading === patch.id

              return (
                <div
                  key={patch.id}
                  className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden"
                >
                  {/* Main row */}
                  <div className="p-4 flex items-start gap-4">
                    {/* Status indicator */}
                    <div className="mt-1">
                      {patch.isPublished ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-500" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-white font-mono">v{patch.version}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${typeConf.color}`}>
                          {typeConf.icon}
                          {typeConf.label}
                        </span>
                        {patch.isPublished && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                            <Eye className="w-3 h-3" />
                            Published
                          </span>
                        )}
                        {patch.emailSentAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            <Mail className="w-3 h-3" />
                            Email sent
                          </span>
                        )}
                      </div>
                      <p className="text-white font-medium mt-1">{patch.title}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{patch.fileName} ({formatBytes(patch.fileSize)})</span>
                        <span>{patch.downloadCount} downloads</span>
                        <span>Created {new Date(patch.createdAt).toLocaleDateString('th-TH')}</span>
                        {patch.publishedAt && (
                          <span>Published {new Date(patch.publishedAt).toLocaleDateString('th-TH')}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : patch.id)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => downloadPatch(patch.id)}
                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {patch.isPublished ? (
                        <button
                          onClick={() => doAction(patch.id, 'unpublish')}
                          disabled={isActing}
                          className="px-3 py-1.5 text-xs bg-gray-600/30 hover:bg-gray-600/50 text-gray-300 rounded-lg border border-gray-600/50 flex items-center gap-1 disabled:opacity-50"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => doAction(patch.id, 'publish')}
                          disabled={isActing}
                          className="px-3 py-1.5 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg border border-green-600/30 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isActing ? (
                            <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(patch.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded changelog */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 px-4 py-3 bg-slate-950/50">
                      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Changelog</p>
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {patch.changelog}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-800 rounded-lg text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-gray-400 text-sm">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-slate-800 rounded-lg text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Patch?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              This will permanently delete the patch file and record. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmDelete)}
                disabled={actionLoading === confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading === confirmDelete ? (
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
