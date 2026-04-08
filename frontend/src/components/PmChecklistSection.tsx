'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  CheckCircle2,
  Clock,
  Camera,
  ImageIcon,
  Upload,
  FileText,
  Link2,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  AlertTriangle,
  CheckSquare,
  Download,
} from 'lucide-react'
import { generatePmReportPDF } from '@/utils/pmReportPdf'
import { generateInventoryListPDF } from '@/utils/inventoryListPdf'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Equipment {
  id: number
  name: string
  category: string
  brand?: string
  model?: string
  serialNumber: string
  status: string
}

interface PmEquipmentRecord {
  id: number
  equipmentId: number
  beforePhotos: string[]
  afterPhotos: string[]
  comment?: string
  condition?: string
  updatedBrand?: string
  updatedModel?: string
  updatedSerial?: string
  equipment: Equipment
}

interface PmRecord {
  id: number
  incidentId: string
  storeId: number
  performedAt?: string
  inventoryListToken?: string
  inventoryListTokenExpiresAt?: string
  storeSignature?: string
  storeSignerName?: string
  storeSignedAt?: string
  signedInventoryPhoto?: string
  equipmentRecords: PmEquipmentRecord[]
  store: {
    id: number
    storeCode: string
    name: string
    province?: string
    address?: string
  }
}

interface Props {
  incidentId: string
  ticketNumber: string    // Actual ticket number e.g. INC-2025-001
  canEdit: boolean        // TECHNICIAN / SUPERVISOR / etc.
  onPmSubmitted?: () => void
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const conditionLabel: Record<string, string> = {
  GOOD: 'ปกติ',
  NEEDS_REPAIR: 'ต้องซ่อม',
  REPLACED: 'เปลี่ยนใหม่',
}

const conditionColor: Record<string, string> = {
  GOOD: 'text-green-400 border-green-500 bg-green-500/10',
  NEEDS_REPAIR: 'text-yellow-400 border-yellow-500 bg-yellow-500/10',
  REPLACED: 'text-red-400 border-red-500 bg-red-500/10',
}

// ─── Equipment Record Card ────────────────────────────────────────────────────

function EquipmentCard({
  record,
  canEdit,
  onUpdated,
}: {
  record: PmEquipmentRecord
  canEdit: boolean
  onUpdated: (updated: PmEquipmentRecord) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [local, setLocal] = useState({
    comment: record.comment ?? '',
    condition: record.condition ?? '',
    updatedBrand: record.updatedBrand ?? '',
    updatedModel: record.updatedModel ?? '',
    updatedSerial: record.updatedSerial ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingBefore, setUploadingBefore] = useState(false)
  const [uploadingAfter, setUploadingAfter] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const isComplete =
    record.beforePhotos.length > 0 &&
    record.afterPhotos.length > 0 &&
    !!local.condition

  // Auto-save text fields with debounce
  const saveTextFields = useCallback(
    async (data: typeof local) => {
      if (!canEdit) return
      try {
        setSaving(true)
        const token = localStorage.getItem('token')
        const res = await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/pm/equipment-record/${record.id}`,
          {
            comment: data.comment || undefined,
            condition: data.condition || undefined,
            updatedBrand: data.updatedBrand || undefined,
            updatedModel: data.updatedModel || undefined,
            updatedSerial: data.updatedSerial || undefined,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        onUpdated(res.data)
      } catch {
        // silent
      } finally {
        setSaving(false)
      }
    },
    [record.id, canEdit, onUpdated],
  )

  const handleFieldChange = (field: keyof typeof local, value: string) => {
    const next = { ...local, [field]: value }
    setLocal(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveTextFields(next), 1500)
  }

  const handleConditionChange = (value: string) => {
    const next = { ...local, condition: value }
    setLocal(next)
    // condition: save immediately
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveTextFields(next), 300)
  }

  const uploadPhotos = async (files: FileList, type: 'before' | 'after') => {
    if (!canEdit) return
    const setter = type === 'before' ? setUploadingBefore : setUploadingAfter
    try {
      setter(true)
      const token = localStorage.getItem('token')
      const base64s = await Promise.all(Array.from(files).map(fileToBase64))
      const res = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/pm/equipment-record/${record.id}`,
        type === 'before' ? { beforePhotos: base64s } : { afterPhotos: base64s },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      onUpdated(res.data)
      toast.success(`อัพโหลดรูป${type === 'before' ? 'ก่อน' : 'หลัง'} PM สำเร็จ`)
    } catch {
      toast.error('อัพโหลดรูปไม่สำเร็จ')
    } finally {
      setter(false)
    }
  }

  const removePhoto = async (type: 'before' | 'after', index: number) => {
    if (!canEdit) return
    try {
      const token = localStorage.getItem('token')
      const currentPhotos = type === 'before' ? record.beforePhotos : record.afterPhotos
      // We send the updated list (minus the removed photo) — backend replaces for this special case
      // For simplicity: send an empty array with a note field to signal replacement
      // Actually since our API appends, we need a different approach here.
      // We'll skip remove functionality — photos are additive.
      toast('ไม่สามารถลบรูปที่ upload แล้ว')
    } catch {}
  }

  return (
    <div
      className={`border rounded-xl transition-colors ${
        isComplete
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-slate-600/50 bg-slate-800/30'
      }`}
    >
      {/* Card Header */}
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
            isComplete ? 'bg-green-500 text-white' : 'border-2 border-gray-500'
          }`}>
            {isComplete && <CheckCircle2 className="w-3 h-3" />}
          </div>
          <div>
            <p className="text-white font-medium text-sm">{record.equipment.name}</p>
            <p className="text-xs text-gray-400">{record.equipment.category} — S/N: {record.equipment.serialNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {local.condition && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${conditionColor[local.condition] ?? ''}`}>
              {conditionLabel[local.condition]}
            </span>
          )}
          <span className="text-xs text-gray-500">
            ก่อน {record.beforePhotos.length}รูป / หลัง {record.afterPhotos.length}รูป
          </span>
          {saving && <Save className="w-3 h-3 text-blue-400 animate-pulse" />}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Card Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          {/* Photos Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Before Photos */}
            <PhotoUploadBlock
              label="รูปก่อน PM"
              photos={record.beforePhotos}
              uploading={uploadingBefore}
              canEdit={canEdit}
              onUpload={(files) => uploadPhotos(files, 'before')}
              accentColor="blue"
            />
            {/* After Photos */}
            <PhotoUploadBlock
              label="รูปหลัง PM"
              photos={record.afterPhotos}
              uploading={uploadingAfter}
              canEdit={canEdit}
              onUpload={(files) => uploadPhotos(files, 'after')}
              accentColor="green"
            />
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">สภาพอุปกรณ์</label>
            <div className="flex gap-2">
              {(['GOOD', 'NEEDS_REPAIR', 'REPLACED'] as const).map((c) => (
                <button
                  key={c}
                  disabled={!canEdit}
                  onClick={() => handleConditionChange(c)}
                  className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                    local.condition === c
                      ? conditionColor[c]
                      : 'border-slate-600 text-gray-400 hover:border-slate-500'
                  }`}
                >
                  {conditionLabel[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Comment / ปัญหาที่พบ</label>
            <textarea
              value={local.comment}
              onChange={(e) => handleFieldChange('comment', e.target.value)}
              disabled={!canEdit}
              rows={2}
              placeholder="ระบุปัญหาหรือข้อสังเกต..."
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60 resize-none"
            />
          </div>

          {/* Update Brand / Model / Serial */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">อัพเดตข้อมูลอุปกรณ์ (ถ้ามีการเปลี่ยนแปลง)</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Brand (เดิม: {record.equipment.brand || '-'})</p>
                <input
                  value={local.updatedBrand}
                  onChange={(e) => handleFieldChange('updatedBrand', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Brand ใหม่"
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Model (เดิม: {record.equipment.model || '-'})</p>
                <input
                  value={local.updatedModel}
                  onChange={(e) => handleFieldChange('updatedModel', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Model ใหม่"
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Serial (เดิม: {record.equipment.serialNumber})</p>
                <input
                  value={local.updatedSerial}
                  onChange={(e) => handleFieldChange('updatedSerial', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Serial ใหม่"
                  className="w-full px-2 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Photo Upload Block ───────────────────────────────────────────────────────

function PhotoUploadBlock({
  label,
  photos,
  uploading,
  canEdit,
  onUpload,
  accentColor,
}: {
  label: string
  photos: string[]
  uploading: boolean
  canEdit: boolean
  onUpload: (files: FileList) => void
  accentColor: 'blue' | 'green'
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const accent = accentColor === 'blue' ? 'border-blue-500/40 text-blue-400' : 'border-green-500/40 text-green-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-400">{label}</label>
        <span className={`text-xs ${photos.length > 0 ? (accentColor === 'green' ? 'text-green-400' : 'text-blue-400') : 'text-gray-500'}`}>
          {photos.length} รูป
        </span>
      </div>
      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {photos.slice(-4).map((src, i) => (
            <img key={i} src={src} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-600" />
          ))}
          {photos.length > 4 && (
            <div className="w-12 h-12 flex items-center justify-center bg-slate-700 rounded-lg text-xs text-gray-400">
              +{photos.length - 4}
            </div>
          )}
        </div>
      )}
      {canEdit && (
        <>
          {/* Camera input — opens device camera directly */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files && onUpload(e.target.files)}
          />
          {/* Gallery input — opens file picker / photo library */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && onUpload(e.target.files)}
          />
          {uploading ? (
            <div className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed text-xs ${accent}`}>
              <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              กำลังอัพโหลด...
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-dashed text-xs transition-colors ${accent}`}
              >
                <Camera className="w-4 h-4" />
                <span>ถ่ายรูป</span>
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-dashed text-xs transition-colors ${accent}`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>คลังรูป</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main PmChecklistSection ──────────────────────────────────────────────────

export default function PmChecklistSection({ incidentId, ticketNumber, canEdit, onPmSubmitted }: Props) {
  const [pmRecord, setPmRecord] = useState<PmRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [signLink, setSignLink] = useState<string | null>(null)
  const [uploadingSignedPaper, setUploadingSignedPaper] = useState(false)
  const [downloadingPmReport, setDownloadingPmReport] = useState(false)
  const [downloadingInventory, setDownloadingInventory] = useState(false)
  const [orgLogo, setOrgLogo] = useState<string | undefined>(undefined)
  const [themeColor, setThemeColor] = useState<string | undefined>(undefined)
  const signedPaperRef = useRef<HTMLInputElement>(null)

  const fetchPmRecord = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/pm/incident/${incidentId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setPmRecord(res.data)
      if (res.data.inventoryListToken) {
        setSignLink(`${window.location.origin}/inventory-sign/${res.data.inventoryListToken}`)
      }
    } catch {
      toast.error('โหลดข้อมูล PM ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPmRecord() }, [incidentId])

  // Fetch org logo + theme color for PDF generation
  useEffect(() => {
    const token = localStorage.getItem('token')

    // Get theme color from localStorage cache (already populated by dashboard layout)
    const cachedTheme = localStorage.getItem('themeStyle')
    if (cachedTheme) {
      try {
        const { bgStart } = JSON.parse(cachedTheme)
        if (bgStart) setThemeColor(bgStart)
      } catch {}
    }

    // Fetch org logo and convert to base64 data URL
    const fetchOrgLogo = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/organization`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (res.data?.logoPath) {
          const base = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')
          const logoUrl = `${base}${res.data.logoPath}`
          try {
            const imgRes = await fetch(logoUrl)
            if (imgRes.ok) {
              const blob = await imgRes.blob()
              const b64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
              })
              setOrgLogo(b64)
            }
          } catch {}
        }
      } catch {}
    }
    fetchOrgLogo()
  }, [])

  const handleEquipmentUpdated = (updated: PmEquipmentRecord) => {
    setPmRecord((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        equipmentRecords: prev.equipmentRecords.map((r) =>
          r.id === updated.id ? updated : r,
        ),
      }
    })
  }

  const completedCount = pmRecord?.equipmentRecords.filter(
    (r) => r.beforePhotos.length > 0 && r.afterPhotos.length > 0,
  ).length ?? 0
  const totalCount = pmRecord?.equipmentRecords.length ?? 0
  const allComplete = completedCount === totalCount && totalCount > 0

  const handleSubmitPm = async () => {
    if (!pmRecord) return
    try {
      setSubmitting(true)
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/pm/incident/${incidentId}/submit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('Submit PM สำเร็จ! ข้อมูล Inventory อัพเดตแล้ว')
      await fetchPmRecord()
      onPmSubmitted?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Submit PM ไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateSignLink = async () => {
    try {
      setGeneratingToken(true)
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/pm/incident/${incidentId}/inventory-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const link = `${window.location.origin}/inventory-sign/${res.data.token}`
      setSignLink(link)
      await navigator.clipboard.writeText(link)
      toast.success('สร้างลิงก์สำเร็จ! คัดลอกลิงก์แล้ว')
    } catch {
      toast.error('สร้างลิงก์ไม่สำเร็จ')
    } finally {
      setGeneratingToken(false)
    }
  }

  const handleUploadSignedPaper = async (files: FileList) => {
    if (!files.length) return
    try {
      setUploadingSignedPaper(true)
      const token = localStorage.getItem('token')
      const base64 = await fileToBase64(files[0])
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/pm/incident/${incidentId}/upload-signed`,
        { photo: base64 },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('อัพโหลดเอกสารที่เซ็นแล้วสำเร็จ')
      fetchPmRecord()
    } catch {
      toast.error('อัพโหลดไม่สำเร็จ')
    } finally {
      setUploadingSignedPaper(false)
    }
  }

  const handleDownloadPmReport = async () => {
    if (!pmRecord) return
    try {
      setDownloadingPmReport(true)
      await generatePmReportPDF({
        ticketNumber: ticketNumber,
        store: pmRecord.store,
        performedAt: pmRecord.performedAt,
        equipmentRecords: pmRecord.equipmentRecords.map((r) => ({
          name: r.equipment.name,
          category: r.equipment.category,
          serialNumber: r.equipment.serialNumber,
          brand: r.equipment.brand,
          model: r.equipment.model,
          condition: r.condition ?? undefined,
          comment: r.comment ?? undefined,
          beforePhotos: r.beforePhotos,
          afterPhotos: r.afterPhotos,
          updatedBrand: r.updatedBrand ?? undefined,
          updatedModel: r.updatedModel ?? undefined,
          updatedSerial: r.updatedSerial ?? undefined,
        })),
      })
    } catch {
      toast.error('ดาวน์โหลด PDF ไม่สำเร็จ')
    } finally {
      setDownloadingPmReport(false)
    }
  }

  const handleDownloadInventoryList = async () => {
    if (!pmRecord) return
    try {
      setDownloadingInventory(true)
      await generateInventoryListPDF({
        ticketNumber: ticketNumber,
        store: pmRecord.store,
        performedAt: pmRecord.performedAt,
        organizationLogo: orgLogo,
        themeColor: themeColor,
        equipment: pmRecord.equipmentRecords.map((r, idx) => ({
          no: idx + 1,
          name: r.equipment.name,
          category: r.equipment.category,
          serialNumber: r.updatedSerial || r.equipment.serialNumber,
          brand: r.updatedBrand || r.equipment.brand,
          model: r.updatedModel || r.equipment.model,
          condition: r.condition ?? undefined,
          comment: r.comment ?? undefined,
          beforePhoto: r.beforePhotos[0],
        })),
      })
    } catch {
      toast.error('ดาวน์โหลด PDF ไม่สำเร็จ')
    } finally {
      setDownloadingInventory(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-2xl flex items-center justify-center gap-2 text-gray-400">
        <span className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
        โหลดข้อมูล PM Checklist...
      </div>
    )
  }

  if (!pmRecord) return null

  return (
    <div className="glass-card p-6 rounded-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-purple-400" />
            PM Checklist
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {pmRecord.store.storeCode} — {pmRecord.store.name}
            {pmRecord.store.province && ` (${pmRecord.store.province})`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{completedCount}<span className="text-gray-500 text-base">/{totalCount}</span></p>
          <p className="text-xs text-gray-400">อุปกรณ์ที่มีรูป</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-500"
          style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
        />
      </div>

      {/* PM Completed Badge */}
      {pmRecord.performedAt && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-400 text-sm font-medium">PM เสร็จสิ้นแล้ว</p>
            <p className="text-gray-400 text-xs">
              {new Date(pmRecord.performedAt).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Equipment Records */}
      <div className="space-y-2">
        {pmRecord.equipmentRecords.map((record) => (
          <EquipmentCard
            key={record.id}
            record={record}
            canEdit={canEdit && !pmRecord.performedAt}
            onUpdated={handleEquipmentUpdated}
          />
        ))}
      </div>

      {/* Submit PM Button */}
      {canEdit && !pmRecord.performedAt && (
        <button
          onClick={handleSubmitPm}
          disabled={submitting || !allComplete}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          {submitting ? 'กำลัง Submit PM...' : !allComplete ? `Submit PM (ต้องมีรูปครบ ${totalCount} อุปกรณ์)` : 'Submit PM'}
        </button>
      )}

      {/* ─── Document Actions ─── */}
      <div className="border-t border-slate-700/50 pt-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          เอกสาร PM
        </h3>

        {/* PDF Download buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadPmReport}
            disabled={downloadingPmReport}
            className="flex items-center justify-center gap-2 py-2.5 bg-purple-700/80 hover:bg-purple-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          >
            {downloadingPmReport ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PM Report PDF
          </button>
          <button
            onClick={handleDownloadInventoryList}
            disabled={downloadingInventory}
            className="flex items-center justify-center gap-2 py-2.5 bg-purple-600/80 hover:bg-purple-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          >
            {downloadingInventory ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Inventory List PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Online Sign Link */}
          <button
            onClick={handleGenerateSignLink}
            disabled={generatingToken || !pmRecord.performedAt}
            title={!pmRecord.performedAt ? 'Submit PM ก่อนจึงจะสร้างลิงก์ได้' : ''}
            className="flex items-center justify-center gap-2 py-2.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            {generatingToken ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {signLink ? 'สร้างลิงก์ใหม่' : 'ลิงก์เซ็น Online'}
          </button>

          {/* Upload Signed Paper */}
          <button
            onClick={() => signedPaperRef.current?.click()}
            disabled={uploadingSignedPaper}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          >
            {uploadingSignedPaper ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            อัพโหลดเซ็นกระดาษ
          </button>
          <input
            ref={signedPaperRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleUploadSignedPaper(e.target.files)}
          />
        </div>

        {/* Sign link display */}
        {signLink && (
          <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
            <Link2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <p className="text-xs text-indigo-300 truncate flex-1">{signLink}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(signLink); toast.success('คัดลอกแล้ว') }}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-slate-600 rounded"
            >
              Copy
            </button>
          </div>
        )}

        {/* Signed status */}
        {pmRecord.storeSignedAt && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <p className="text-xs text-green-300">
              เจ้าหน้าที่สาขาลงนามแล้ว ({pmRecord.storeSignerName}) —{' '}
              {new Date(pmRecord.storeSignedAt).toLocaleDateString('th-TH')}
            </p>
          </div>
        )}

        {/* Uploaded signed paper preview */}
        {pmRecord.signedInventoryPhoto && (
          <div>
            <p className="text-xs text-gray-400 mb-2">เอกสารที่เซ็นแล้ว (กระดาษ)</p>
            <img
              src={pmRecord.signedInventoryPhoto}
              alt="Signed inventory"
              className="max-h-40 rounded-lg border border-slate-600 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
