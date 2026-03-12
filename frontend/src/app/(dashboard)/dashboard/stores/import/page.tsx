// app/(dashboard)/dashboard/stores/import/page.tsx - Store Import Page with Preview + Update
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  ArrowRight,
  RefreshCw,
  Plus,
  Edit3,
  Minus,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import { hasMenuAccess } from '@/config/permissions'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

// Preview Result Interface
interface PreviewResult {
  newItems: Array<{
    row: number
    storeCode: string
    name: string
    company: string
    province?: string
  }>
  updateItems: Array<{
    row: number
    storeCode: string
    storeName: string
    storeId: number
    currentData: Record<string, any>
    newData: Record<string, any>
    changes: Array<{ field: string; oldValue: any; newValue: any }>
  }>
  unchangedItems: Array<{
    row: number
    storeCode: string
    name: string
  }>
  errors: Array<{ row: number; error: string }>
}

// Import Result Interface
interface ImportResult {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: Array<{ row: number; code?: string; error: string }>
}

type Step = 'upload' | 'preview' | 'result'

export default function StoreImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importMode, setImportMode] = useState<'create_only' | 'update_or_create'>('update_or_create')
  const themeHighlight = useThemeHighlight()
  const [expandedUpdates, setExpandedUpdates] = useState<Set<number>>(new Set())

  // Permission check - SUPER_ADMIN only
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      if (!hasMenuAccess(user, '/dashboard/stores/import')) {
        toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')
        router.push('/dashboard/stores')
      }
    }
  }, [router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)')
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('ขนาดไฟล์ต้องไม่เกิน 10MB')
        return
      }

      setFile(selectedFile)
      setPreviewResult(null)
      setImportResult(null)
      setStep('upload')
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/template`,
        {
          responseType: 'blob',
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'store_import_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('ดาวน์โหลด Template สำเร็จ')
    } catch (error: any) {
      toast.error('ไม่สามารถดาวน์โหลด Template ได้')
      console.error(error)
    }
  }

  const handlePreview = async () => {
    if (!file) {
      toast.error('กรุณาเลือกไฟล์ก่อน')
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/import/preview`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setPreviewResult(response.data)
      setStep('preview')
      toast.success('วิเคราะห์ไฟล์สำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถวิเคราะห์ไฟล์ได้')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('กรุณาเลือกไฟล์ก่อน')
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', importMode)

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/import`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setImportResult(response.data)
      setStep('result')

      if (response.data.failed === 0) {
        toast.success(
          `นำเข้าสำเร็จ! สร้างใหม่ ${response.data.created} รายการ, อัพเดต ${response.data.updated} รายการ`
        )
      } else {
        toast(
          `นำเข้าบางส่วน: สำเร็จ ${response.data.created + response.data.updated} รายการ, ล้มเหลว ${response.data.failed} รายการ`,
          { icon: '⚠️' }
        )
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'การนำเข้าล้มเหลว')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreviewResult(null)
    setImportResult(null)
    setStep('upload')
    setImportMode('update_or_create')
    setExpandedUpdates(new Set())
  }

  const toggleUpdateExpand = (row: number) => {
    const newExpanded = new Set(expandedUpdates)
    if (newExpanded.has(row)) {
      newExpanded.delete(row)
    } else {
      newExpanded.add(row)
    }
    setExpandedUpdates(newExpanded)
  }

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]
      if (!validTypes.includes(droppedFile.type)) {
        toast.error('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)')
        return
      }

      // Validate file size (max 10MB)
      if (droppedFile.size > 10 * 1024 * 1024) {
        toast.error('ขนาดไฟล์ต้องไม่เกิน 10MB')
        return
      }

      setFile(droppedFile)
      setPreviewResult(null)
      setImportResult(null)
      setStep('upload')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Back Button */}
      <BackButton href="/dashboard/stores" label="กลับไปหน้า Stores" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">นำเข้าข้อมูลสาขา</h1>
        <p className="text-gray-400 mt-1">
          อัปโหลดไฟล์ Excel เพื่อนำเข้าหรืออัพเดตข้อมูลสาขา
        </p>
      </div>

      {/* Progress Steps */}
      <div className="glass-card p-4 rounded-2xl">
        <div className="flex items-center justify-center gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              step === 'upload' ? 'text-white' : 'bg-gray-700/50 text-gray-400'
            }`}
            style={step === 'upload' ? { backgroundColor: themeHighlight } : undefined}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">1. อัปโหลดไฟล์</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              step === 'preview' ? 'text-white' : 'bg-gray-700/50 text-gray-400'
            }`}
            style={step === 'preview' ? { backgroundColor: themeHighlight } : undefined}
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">2. ตรวจสอบ</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              step === 'result' ? 'text-white' : 'bg-gray-700/50 text-gray-400'
            }`}
            style={step === 'result' ? { backgroundColor: themeHighlight } : undefined}
          >
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">3. ผลลัพธ์</span>
          </div>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <>
          {/* Instructions */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400" />
              คำแนะนำการนำเข้า
            </h2>
            <div className="space-y-3 text-gray-300">
              <ol className="list-decimal list-inside space-y-2">
                <li>ดาวน์โหลด Template Excel โดยคลิกปุ่มด้านล่าง</li>
                <li>กรอกข้อมูลสาขาตามรูปแบบใน Template</li>
                <li>
                  ฟิลด์ที่จำเป็น:{' '}
                  <span className="text-blue-400 font-semibold">
                    รหัสสาขา (Store Code), ชื่อสาขา, บริษัท
                  </span>
                </li>
                <li>
                  <span className="text-yellow-400">Store Code</span> เป็นตัวระบุ
                  - หากรหัสซ้ำกับที่มีอยู่จะเป็นการอัพเดตข้อมูล
                </li>
                <li>อัปโหลดไฟล์และตรวจสอบก่อนยืนยันการนำเข้า</li>
              </ol>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-5 h-5" />
                ดาวน์โหลด Template
              </button>
            </div>
          </div>

          {/* Upload Section */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              อัปโหลดไฟล์
            </h2>

            {/* File Input */}
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="file-upload"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileSpreadsheet className="w-16 h-16 mb-4 text-gray-400" />
                    {file ? (
                      <>
                        <p className="mb-2 text-sm text-green-400 font-semibold">
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          ไฟล์ที่เลือก: {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          ขนาด: {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 text-sm text-gray-400">
                          <span className="font-semibold">คลิกเพื่ออัปโหลด</span>{' '}
                          หรือลากไฟล์มาวาง
                        </p>
                        <p className="text-xs text-gray-500">
                          ไฟล์ Excel เท่านั้น (.xlsx, .xls) - สูงสุด 10MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isLoading}
                  />
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreview}
                  disabled={!file || isLoading}
                  className="flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: themeHighlight }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      กำลังวิเคราะห์...
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      ตรวจสอบข้อมูล
                    </>
                  )}
                </button>
                {file && !isLoading && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    รีเซ็ต
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && previewResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* New Items */}
            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">สาขาใหม่</p>
                  <p className="text-2xl font-bold text-green-400">
                    {previewResult.newItems.length}
                  </p>
                </div>
                <Plus className="w-8 h-8 text-green-400" />
              </div>
            </div>

            {/* Update Items */}
            <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">อัพเดต</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {previewResult.updateItems.length}
                  </p>
                </div>
                <Edit3 className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            {/* Unchanged Items */}
            <div className="p-4 bg-gray-500/20 border border-gray-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">ไม่เปลี่ยนแปลง</p>
                  <p className="text-2xl font-bold text-gray-400">
                    {previewResult.unchangedItems.length}
                  </p>
                </div>
                <Minus className="w-8 h-8 text-gray-400" />
              </div>
            </div>

            {/* Errors */}
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">ข้อผิดพลาด</p>
                  <p className="text-2xl font-bold text-red-400">
                    {previewResult.errors.length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* New Items List */}
          {previewResult.newItems.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-400" />
                สาขาใหม่ที่จะสร้าง ({previewResult.newItems.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {previewResult.newItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-green-600/30 text-green-300 rounded">
                        แถว {item.row}
                      </span>
                      <span className="text-sm font-medium text-white">
                        {item.storeCode}
                      </span>
                      <span className="text-sm text-gray-400">-</span>
                      <span className="text-sm text-gray-300">{item.name}</span>
                      <span className="text-sm text-gray-500">({item.company})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Update Items List with Diff */}
          {previewResult.updateItems.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                สาขาที่จะอัพเดต ({previewResult.updateItems.length})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {previewResult.updateItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleUpdateExpand(item.row)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded">
                          แถว {item.row}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {item.storeCode}
                        </span>
                        <span className="text-sm text-gray-400">-</span>
                        <span className="text-sm text-gray-300">
                          {item.storeName}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-orange-600/30 text-orange-300 rounded">
                          {item.changes.length} การเปลี่ยนแปลง
                        </span>
                      </div>
                      <button className="text-gray-400 hover:text-white">
                        {expandedUpdates.has(item.row) ? '▼' : '▶'}
                      </button>
                    </div>

                    {/* Changes Detail */}
                    {expandedUpdates.has(item.row) && (
                      <div className="mt-3 pt-3 border-t border-blue-500/20 space-y-2">
                        {item.changes.map((change, changeIndex) => (
                          <div
                            key={changeIndex}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="text-gray-400 w-32 flex-shrink-0">
                              {change.field}:
                            </span>
                            <span className="text-red-400 line-through">
                              {change.oldValue}
                            </span>
                            <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-green-400">{change.newValue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors List */}
          {previewResult.errors.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                ข้อผิดพลาด ({previewResult.errors.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {previewResult.errors.map((err, index) => (
                  <div
                    key={index}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-red-400">
                          แถว {err.row}:
                        </span>
                        <span className="text-sm text-gray-300 ml-2">
                          {err.error}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Mode Selection */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              ตัวเลือกการนำเข้า
            </h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700/70">
                <input
                  type="radio"
                  name="importMode"
                  value="update_or_create"
                  checked={importMode === 'update_or_create'}
                  onChange={() => setImportMode('update_or_create')}
                  className="mt-1"
                />
                <div>
                  <p className="text-white font-medium">
                    สร้างใหม่และอัพเดต (แนะนำ)
                  </p>
                  <p className="text-sm text-gray-400">
                    สาขาใหม่จะถูกสร้าง และสาขาที่มีอยู่จะถูกอัพเดตตามข้อมูลในไฟล์
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700/70">
                <input
                  type="radio"
                  name="importMode"
                  value="create_only"
                  checked={importMode === 'create_only'}
                  onChange={() => setImportMode('create_only')}
                  className="mt-1"
                />
                <div>
                  <p className="text-white font-medium">สร้างใหม่เท่านั้น</p>
                  <p className="text-sm text-gray-400">
                    เฉพาะสาขาใหม่เท่านั้นที่จะถูกสร้าง สาขาที่มีอยู่แล้วจะถูกข้าม
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={
                isLoading ||
                (previewResult.newItems.length === 0 &&
                  previewResult.updateItems.length === 0)
              }
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  ยืนยันการนำเข้า
                </>
              )}
            </button>
            <button
              onClick={() => setStep('upload')}
              disabled={isLoading}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              กลับ
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 'result' && importResult && (
        <div className="space-y-6">
          {/* Result Summary */}
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              ผลการนำเข้า
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">สร้างใหม่</p>
                    <p className="text-2xl font-bold text-green-400">
                      {importResult.created}
                    </p>
                  </div>
                  <Plus className="w-8 h-8 text-green-400" />
                </div>
              </div>

              <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">อัพเดต</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {importResult.updated}
                    </p>
                  </div>
                  <RefreshCw className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">ข้าม</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {importResult.skipped}
                    </p>
                  </div>
                  <Minus className="w-8 h-8 text-yellow-400" />
                </div>
              </div>

              <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">ล้มเหลว</p>
                    <p className="text-2xl font-bold text-red-400">
                      {importResult.failed}
                    </p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors && importResult.errors.length > 0 && (
              <div>
                <h3 className="text-md font-semibold text-white mb-3">
                  รายละเอียดข้อผิดพลาด:
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {importResult.errors.map((err, index) => (
                    <div
                      key={index}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-red-400 font-semibold">
                            แถว {err.row}
                            {err.code && ` - รหัสสาขา: ${err.code}`}
                          </p>
                          <p className="text-sm text-gray-300 mt-1">
                            {err.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-gray-700/50 flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/stores')}
                className="px-6 py-2 text-white rounded-lg transition-colors hover:brightness-110"
                style={{ backgroundColor: themeHighlight }}
              >
                ดูรายการสาขา
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                นำเข้าเพิ่มเติม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
