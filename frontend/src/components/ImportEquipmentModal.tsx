// frontend/src/components/ImportEquipmentModal.tsx
// Modal for importing/exporting equipment inventory by store with preview support

import { useState, useRef, useEffect } from 'react'
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Building2,
  FileDown,
  FileUp,
  RefreshCw,
  Plus,
  Edit3,
  Minus,
  Eye,
  ArrowRight,
  Search,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { generateInventoryExportPDF } from '@/utils/inventoryExportPdf'

interface Store {
  id: number
  storeCode: string
  name: string
  province?: string
}

interface ImportEquipmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  stores?: Store[]
  userRoles?: string[]
  /** @deprecated use userRoles instead */
  userRole?: string
}

interface BulkImportResult {
  created: number
  failed: number
  errors: Array<{ row: number; error: string }>
  storesSummary: Record<string, number>
}

interface PreviewResult {
  storeCode: string
  storeName: string
  newItems: Array<{
    row: number
    name: string
    serialNumber: string
    category: string
    brand: string
    model: string
  }>
  updateItems: Array<{
    row: number
    serialNumber: string
    currentData: any
    newData: any
    changes: string[]
  }>
  unchangedItems: Array<{
    row: number
    serialNumber: string
    name: string
  }>
  errors: Array<{ row: number; error: string }>
}

interface ImportResult {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: Array<{ row: number; error: string }>
  storeCode?: string
}

export default function ImportEquipmentModal({
  isOpen,
  onClose,
  onSuccess,
  stores = [],
  userRoles,
  userRole,
}: ImportEquipmentModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [storeSearchText, setStoreSearchText] = useState('')
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  const storeDropdownRef = useRef<HTMLDivElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null)
  const [importMode, setImportMode] = useState<'create_only' | 'update_or_create'>('create_only')
  const [importTab, setImportTab] = useState<'store' | 'bulk'>('store')
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
        setShowStoreDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allRoles = userRoles ?? (userRole ? [userRole] : [])
  const isSuperAdmin = allRoles.includes('SUPER_ADMIN')

  const selectedStore = stores.find((s) => s.id.toString() === selectedStoreId)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น')
        return
      }
      setFile(selectedFile)
      setResult(null)
      setPreview(null)

      // Auto preview
      await handlePreview(selectedFile)
    }
  }

  const handlePreview = async (fileToPreview: File) => {
    setIsPreviewing(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', fileToPreview)

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/import/preview`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setPreview(response.data)

      // Auto select update mode if there are updates
      if (response.data.updateItems?.length > 0) {
        setImportMode('update_or_create')
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'ไม่สามารถ Preview ได้'
      toast.error(message)
      console.error(error)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (!selectedStoreId) {
      toast.error('กรุณาเลือกสาขาก่อนดาวน์โหลด Template')
      return
    }

    setIsDownloadingTemplate(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/import/template?storeId=${selectedStoreId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `inventory-template-${selectedStore?.storeCode || 'store'}.xlsx`
      )
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('ดาวน์โหลด Template สำเร็จ')
    } catch (error) {
      toast.error('ไม่สามารถดาวน์โหลด Template ได้')
      console.error(error)
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const handleExportInventory = async () => {
    if (!selectedStoreId) {
      toast.error('กรุณาเลือกสาขาก่อน Export')
      return
    }

    setIsExporting(true)
    try {
      const token = localStorage.getItem('token')

      // Fetch equipment, org settings, and store details in parallel
      const [eqRes, orgRes, storeRes] = await Promise.all([
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/equipment?storeId=${selectedStoreId}&limit=1000`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/settings/organization`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/stores/${selectedStoreId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ])

      const equipment: any[] = eqRes.data?.data || eqRes.data || []
      const org = orgRes?.data || {}
      const storeDetail = storeRes?.data || {}

      // Load org logo as base64 if available
      let orgLogo: string | null = null
      if (org.logoPath) {
        try {
          const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')
          const imgRes = await fetch(`${apiBase}${org.logoPath}`)
          if (imgRes.ok) {
            const blob = await imgRes.blob()
            orgLogo = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          }
        } catch { /* skip logo */ }
      }

      const orgName = org.organizationName || org.name || null
      await generateInventoryExportPDF({
        store: {
          storeCode: selectedStore?.storeCode || '',
          name: selectedStore?.name || '',
          province: storeDetail.province || selectedStore?.province || null,
          address: storeDetail.address || null,
        },
        equipment,
        orgLogo,
        orgName,
        systemName: orgName ? `${orgName} Incident Management` : null,
      })

      toast.success('Export Inventory PDF สำเร็จ')
    } catch (error) {
      toast.error('ไม่สามารถ Export Inventory ได้')
      console.error(error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('กรุณาเลือกไฟล์ก่อน')
      return
    }

    setIsUploading(true)
    setResult(null)

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', importMode)

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/import/excel`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setResult(response.data)
      setPreview(null)

      const { created, updated, failed } = response.data
      if (created > 0 || updated > 0) {
        toast.success(
          `สำเร็จ: สร้างใหม่ ${created} รายการ, อัพเดต ${updated} รายการ`
        )
        if (failed === 0) {
          onSuccess()
        }
      }

      if (failed > 0) {
        toast.error(`มี ${failed} รายการที่ไม่สามารถนำเข้าได้`)
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'ไม่สามารถนำเข้าข้อมูลได้'
      toast.error(message)
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadBulkTemplate = async () => {
    setIsDownloadingTemplate(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/import/bulk-template`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'bulk-import-template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('ดาวน์โหลด Bulk Template สำเร็จ')
    } catch (error) {
      toast.error('ไม่สามารถดาวน์โหลด Bulk Template ได้')
      console.error(error)
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น')
        return
      }
      setBulkFile(selectedFile)
      setBulkResult(null)
    }
  }

  const handleBulkImport = async () => {
    if (!bulkFile) {
      toast.error('กรุณาเลือกไฟล์ก่อน')
      return
    }

    setIsUploading(true)
    setBulkResult(null)

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', bulkFile)

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/equipment/import/bulk`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setBulkResult(response.data)

      const { created, failed } = response.data
      if (created > 0) {
        toast.success(`นำเข้าสำเร็จ ${created} รายการ`)
        if (failed === 0) {
          onSuccess()
        }
      }
      if (failed > 0) {
        toast.error(`มี ${failed} รายการที่ไม่สามารถนำเข้าได้`)
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'ไม่สามารถนำเข้าข้อมูลได้'
      toast.error(message)
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleBulkDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!validTypes.includes(droppedFile.type)) {
        toast.error('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น')
        return
      }
      setBulkFile(droppedFile)
      setBulkResult(null)
    }
  }

  const handleClose = () => {
    setFile(null)
    setSelectedStoreId('')
    setStoreSearchText('')
    setShowStoreDropdown(false)
    setPreview(null)
    setResult(null)
    setBulkFile(null)
    setBulkResult(null)
    setImportMode('create_only')
    setImportTab('store')
    onClose()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!validTypes.includes(droppedFile.type)) {
        toast.error('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น')
        return
      }
      setFile(droppedFile)
      setResult(null)
      setPreview(null)
      await handlePreview(droppedFile)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Inventory Management</h2>
              <p className="text-sm text-gray-400">นำเข้า/ส่งออก รายการอุปกรณ์ประจำสาขา</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tab Switcher for SUPER_ADMIN */}
          {isSuperAdmin && (
            <div className="flex gap-2 bg-slate-800/50 rounded-xl p-1">
              <button
                onClick={() => { setImportTab('store'); setBulkFile(null); setBulkResult(null) }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  importTab === 'store'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Import รายสาขา
              </button>
              <button
                onClick={() => { setImportTab('bulk'); setFile(null); setPreview(null); setResult(null) }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  importTab === 'bulk'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Bulk Import (ทุกสาขา)
              </button>
            </div>
          )}

          {/* === BULK IMPORT TAB (SUPER_ADMIN only) === */}
          {isSuperAdmin && importTab === 'bulk' && (
            <>
              {/* Bulk Template Download */}
              <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-base font-semibold text-white mb-1">Bulk Import - นำเข้าข้อมูลทุกสาขาพร้อมกัน</p>
                    <p className="text-xs text-gray-400 mb-3">
                      ดาวน์โหลด Template ที่มีคอลัมน์ Store Code สำหรับระบุสาขาในแต่ละแถว
                    </p>
                    <button
                      onClick={handleDownloadBulkTemplate}
                      disabled={isDownloadingTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDownloadingTemplate ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Download Bulk Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Bulk File Upload */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileUp className="w-5 h-5 text-purple-400" />
                  <label className="text-base font-semibold text-white">อัปโหลดไฟล์ Bulk Import</label>
                </div>
                <div
                  onDragOver={handleBulkDragOver}
                  onDrop={handleBulkDrop}
                  onClick={() => bulkFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    bulkFile
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-slate-600 hover:border-purple-500/50 hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                  {bulkFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-purple-400" />
                      <div className="text-left">
                        <p className="text-white font-medium">{bulkFile.name}</p>
                        <p className="text-xs text-gray-400">{(bulkFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setBulkFile(null)
                          setBulkResult(null)
                        }}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-300 mb-1">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                      <p className="text-xs text-gray-500">รองรับไฟล์ .xlsx และ .xls (ไม่เกิน 10MB)</p>
                    </>
                  )}
                </div>
              </div>

              {/* Bulk Import Result */}
              {bulkResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-400">{bulkResult.created}</p>
                      <p className="text-sm text-green-300">สร้างสำเร็จ</p>
                    </div>
                    <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-center">
                      <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-400">{bulkResult.failed}</p>
                      <p className="text-sm text-red-300">ล้มเหลว</p>
                    </div>
                  </div>

                  {/* Stores Summary */}
                  {Object.keys(bulkResult.storesSummary).length > 0 && (
                    <div className="bg-blue-900/10 border border-blue-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-5 h-5 text-blue-400" />
                        <h4 className="font-medium text-blue-300">สรุปรายสาขา</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(bulkResult.storesSummary).map(([storeCode, count]) => (
                          <div key={storeCode} className="bg-blue-900/20 rounded-lg px-3 py-2 flex items-center justify-between">
                            <span className="text-sm text-white font-mono">{storeCode}</span>
                            <span className="text-sm font-bold text-blue-400">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {bulkResult.errors.length > 0 && (
                    <div className="bg-red-900/10 border border-red-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <h4 className="font-medium text-red-300">รายละเอียดข้อผิดพลาด ({bulkResult.errors.length})</h4>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {bulkResult.errors.map((err, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm bg-red-900/20 rounded p-2">
                            <span className="text-red-400 font-mono flex-shrink-0">Row {err.row}:</span>
                            <span className="text-red-200">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk Instructions */}
              {!bulkResult && (
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-purple-200">
                      <p className="font-medium mb-2">วิธีใช้ Bulk Import:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>กด Download Bulk Template</li>
                        <li>กรอก Store Code ในคอลัมน์ B ของแต่ละแถว</li>
                        <li>กรอกข้อมูลอุปกรณ์ (ลบแถวตัวอย่างออก)</li>
                        <li>อัปโหลดไฟล์แล้วกดยืนยันนำเข้า</li>
                      </ol>
                      <p className="mt-3 text-xs text-purple-300/80">
                        สามารถนำเข้าหลายสาขาพร้อมกันในไฟล์เดียว โดยระบุ Store Code ในแต่ละแถว
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* === PER-STORE IMPORT TAB (default) === */}
          {(!isSuperAdmin || importTab === 'store') && (
          <>
          {/* Store Selection */}
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Building2 className="w-6 h-6 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-base font-semibold text-white mb-1">เลือกสาขา</p>
                <p className="text-xs text-gray-400 mb-3">
                  เลือกสาขาเพื่อดาวน์โหลด Template หรือ Export รายการอุปกรณ์
                </p>
                <div className="relative" ref={storeDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="พิมพ์รหัสหรือชื่อสาขา..."
                      value={storeSearchText}
                      onChange={(e) => {
                        setStoreSearchText(e.target.value)
                        setShowStoreDropdown(true)
                        if (e.target.value === '') {
                          setSelectedStoreId('')
                        }
                      }}
                      onFocus={() => setShowStoreDropdown(true)}
                      className="w-full pl-9 pr-8 py-2.5 bg-slate-800/80 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {storeSearchText && (
                      <button
                        onClick={() => {
                          setStoreSearchText('')
                          setSelectedStoreId('')
                          setShowStoreDropdown(false)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {showStoreDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                      {stores
                        .filter((s) => {
                          const q = storeSearchText.toLowerCase()
                          return (
                            !q ||
                            s.storeCode?.toLowerCase().includes(q) ||
                            s.name?.toLowerCase().includes(q) ||
                            s.province?.toLowerCase().includes(q)
                          )
                        })
                        .slice(0, 50)
                        .map((store) => (
                          <div
                            key={store.id}
                            onMouseDown={() => {
                              setSelectedStoreId(String(store.id))
                              setStoreSearchText(`${store.storeCode} - ${store.name}`)
                              setShowStoreDropdown(false)
                            }}
                            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                              selectedStoreId === String(store.id)
                                ? 'bg-blue-600/30 text-blue-300'
                                : 'text-gray-300 hover:bg-slate-700'
                            }`}
                          >
                            <span className="font-mono text-xs text-gray-400 mr-2">{store.storeCode}</span>
                            <span>{store.name}</span>
                            {store.province && (
                              <span className="ml-1 text-xs text-gray-500">({store.province})</span>
                            )}
                          </div>
                        ))}
                      {stores.filter((s) => {
                        const q = storeSearchText.toLowerCase()
                        return !q || s.storeCode?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.province?.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">ไม่พบสาขา</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedStoreId && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={handleDownloadTemplate}
                      disabled={isDownloadingTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isDownloadingTemplate ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Download Template
                    </button>
                    <button
                      onClick={handleExportInventory}
                      disabled={isExporting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Export Inventory (PDF)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-slate-900 text-gray-400">หรือ</span>
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileUp className="w-5 h-5 text-purple-400" />
              <label className="text-base font-semibold text-white">นำเข้าไฟล์ Inventory</label>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              อัปโหลดไฟล์ Template ที่กรอกข้อมูลแล้ว (รองรับการอัพเดตข้อมูลที่มีอยู่)
            </p>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                file
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-slate-600 hover:border-purple-500/50 hover:bg-slate-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-400" />
                  <div className="text-left">
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearFile()
                    }}
                    className="p-1 hover:bg-red-500/20 rounded text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-300 mb-1">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
                  <p className="text-xs text-gray-500">รองรับไฟล์ .xlsx และ .xls (ไม่เกิน 5MB)</p>
                </>
              )}
            </div>
          </div>

          {/* Preview Loading */}
          {isPreviewing && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="ml-3 text-gray-300">กำลังวิเคราะห์ไฟล์...</span>
            </div>
          )}

          {/* Preview Results */}
          {preview && !result && (
            <div className="space-y-4">
              {/* Store Info */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-300">
                    สาขา: <span className="font-bold text-white">{preview.storeCode}</span> - {preview.storeName}
                  </span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 text-center">
                  <Plus className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-400">{preview.newItems.length}</p>
                  <p className="text-xs text-green-300">สร้างใหม่</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-center">
                  <Edit3 className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-yellow-400">{preview.updateItems.length}</p>
                  <p className="text-xs text-yellow-300">อัพเดต</p>
                </div>
                <div className="bg-gray-900/20 border border-gray-700/50 rounded-lg p-3 text-center">
                  <Minus className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-400">{preview.unchangedItems.length}</p>
                  <p className="text-xs text-gray-300">ไม่เปลี่ยน</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-center">
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-red-400">{preview.errors.length}</p>
                  <p className="text-xs text-red-300">ข้อผิดพลาด</p>
                </div>
              </div>

              {/* Update Items Detail */}
              {preview.updateItems.length > 0 && (
                <div className="bg-yellow-900/10 border border-yellow-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-5 h-5 text-yellow-400" />
                    <h4 className="font-medium text-yellow-300">รายการที่จะอัพเดต ({preview.updateItems.length})</h4>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {preview.updateItems.map((item, index) => (
                      <div key={index} className="bg-yellow-900/20 rounded p-3 text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-yellow-400">Row {item.row}</span>
                          <span className="text-white font-medium">{item.serialNumber}</span>
                        </div>
                        <div className="space-y-1">
                          {item.changes.map((field) => (
                            <div key={field} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-400 w-24">{field}:</span>
                              <span className="text-red-400 line-through">{item.currentData[field]}</span>
                              <ArrowRight className="w-3 h-3 text-gray-500" />
                              <span className="text-green-400">{item.newData[field]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Items */}
              {preview.newItems.length > 0 && (
                <div className="bg-green-900/10 border border-green-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="w-5 h-5 text-green-400" />
                    <h4 className="font-medium text-green-300">รายการใหม่ ({preview.newItems.length})</h4>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-green-700/30">
                          <th className="pb-2">Row</th>
                          <th className="pb-2">Serial</th>
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.newItems.slice(0, 10).map((item, index) => (
                          <tr key={index} className="text-gray-300 border-b border-green-700/20">
                            <td className="py-1">{item.row}</td>
                            <td className="py-1 font-mono text-green-400">{item.serialNumber}</td>
                            <td className="py-1">{item.name}</td>
                            <td className="py-1">{item.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.newItems.length > 10 && (
                      <p className="text-xs text-gray-500 mt-2">...และอีก {preview.newItems.length - 10} รายการ</p>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {preview.errors.length > 0 && (
                <div className="bg-red-900/10 border border-red-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h4 className="font-medium text-red-300">ข้อผิดพลาด ({preview.errors.length})</h4>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {preview.errors.map((err, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-red-400 font-mono flex-shrink-0">Row {err.row}:</span>
                        <span className="text-red-200">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Mode Selection */}
              {preview.updateItems.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-white mb-3">เลือกโหมดการนำเข้า:</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 cursor-pointer hover:bg-slate-700/50 transition-colors">
                      <input
                        type="radio"
                        name="importMode"
                        value="update_or_create"
                        checked={importMode === 'update_or_create'}
                        onChange={() => setImportMode('update_or_create')}
                        className="w-4 h-4 text-blue-500"
                      />
                      <div>
                        <p className="text-white font-medium">อัพเดตและสร้างใหม่</p>
                        <p className="text-xs text-gray-400">
                          อัพเดตข้อมูลที่มีอยู่ + สร้างรายการใหม่ (แนะนำ)
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 cursor-pointer hover:bg-slate-700/50 transition-colors">
                      <input
                        type="radio"
                        name="importMode"
                        value="create_only"
                        checked={importMode === 'create_only'}
                        onChange={() => setImportMode('create_only')}
                        className="w-4 h-4 text-blue-500"
                      />
                      <div>
                        <p className="text-white font-medium">สร้างใหม่เท่านั้น</p>
                        <p className="text-xs text-gray-400">
                          ข้ามรายการที่มีอยู่แล้ว สร้างเฉพาะรายการใหม่
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Result */}
          {result && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 text-center">
                <p className="text-sm text-blue-300">
                  สาขา: <span className="font-bold text-white">{result.storeCode}</span>
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-400">{result.created}</p>
                  <p className="text-sm text-green-300">สร้างใหม่</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 text-center">
                  <RefreshCw className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-400">{result.updated}</p>
                  <p className="text-sm text-yellow-300">อัพเดต</p>
                </div>
                <div className="bg-gray-900/20 border border-gray-700/50 rounded-lg p-4 text-center">
                  <Minus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                  <p className="text-sm text-gray-300">ข้าม</p>
                </div>
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                  <p className="text-sm text-red-300">ล้มเหลว</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-900/10 border border-red-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h4 className="font-medium text-red-300">รายละเอียดข้อผิดพลาด</h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {result.errors.map((err, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm bg-red-900/20 rounded p-2">
                        <span className="text-red-400 font-mono flex-shrink-0">Row {err.row}:</span>
                        <span className="text-red-200">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!preview && !result && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-200">
                  <p className="font-medium mb-2">วิธีใช้งาน:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>เลือกสาขาแล้วกด Download Template</li>
                    <li>กรอกข้อมูลอุปกรณ์ในไฟล์ (ลบแถวตัวอย่างออก)</li>
                    <li>อัปโหลดไฟล์ - ระบบจะ Preview ก่อนนำเข้า</li>
                    <li>ตรวจสอบและเลือกโหมด แล้วกดยืนยัน</li>
                  </ol>
                  <p className="mt-3 text-xs text-yellow-300/80">
                    สามารถอัพเดตข้อมูลที่มีอยู่โดยใช้ Serial Number เป็นตัวอ้างอิง
                  </p>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700/50 bg-slate-800/30">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {result || bulkResult ? 'ปิด' : 'ยกเลิก'}
          </button>
          {/* Per-store import button */}
          {preview && !result && (preview.newItems.length > 0 || preview.updateItems.length > 0) && (
            <button
              onClick={handleImport}
              disabled={isUploading}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  ยืนยันนำเข้า
                </>
              )}
            </button>
          )}
          {/* Bulk import button */}
          {isSuperAdmin && importTab === 'bulk' && bulkFile && !bulkResult && (
            <button
              onClick={handleBulkImport}
              disabled={isUploading}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  ยืนยัน Bulk Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
