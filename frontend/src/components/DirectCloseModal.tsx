// frontend/src/components/DirectCloseModal.tsx
// Helpdesk closes an incident directly (Phone / Remote Support) — no check-in.
// Optional photos + spare parts, same data a technician can submit on Resolve.

'use client'

import { useRef, useState } from 'react'
import { Phone, Monitor, Camera, Upload, Trash2, Plus, ArrowRightLeft, Cpu } from 'lucide-react'
import SparePartEntryModal from './SparePartEntryModal'
import { SparePart } from './SparePartForm'
import { compressImages, validateImageFile, filesToBase64 } from '@/utils/imageUtils'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

export interface DirectCloseData {
  resolutionType: 'PHONE_SUPPORT' | 'REMOTE_SUPPORT'
  resolutionNote: string
  afterPhotos?: string[]
  usedSpareParts?: boolean
  spareParts?: any[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  incident: { id: string; title: string; ticketNumber: string }
  storeId?: number
  incidentEquipmentIds?: number[]
  onConfirm: (data: DirectCloseData) => Promise<void> | void
}

const MAX_PHOTOS = 20

export default function DirectCloseModal({ isOpen, onClose, incident, storeId, incidentEquipmentIds, onConfirm }: Props) {
  const themeHighlight = useThemeHighlight()
  const [selectedType, setSelectedType] = useState<'PHONE_SUPPORT' | 'REMOTE_SUPPORT'>('PHONE_SUPPORT')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [usedSpareParts, setUsedSpareParts] = useState(false)
  const [spareParts, setSpareParts] = useState<SparePart[]>([])
  const [sparePartEntryOpen, setSparePartEntryOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<SparePart | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return
    setError('')
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`สามารถอัพโหลดรูปได้สูงสุด ${MAX_PHOTOS} รูป`)
      return
    }
    for (const file of files) {
      const v = validateImageFile(file, 10)
      if (!v.valid) { setError(v.error || 'ไฟล์ไม่ถูกต้อง'); return }
    }
    try {
      const compressed = await compressImages(files, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 })
      setPhotos(prev => [...prev, ...compressed])
      setPhotoUrls(prev => [...prev, ...compressed.map(f => URL.createObjectURL(f))])
    } catch {
      setError('ไม่สามารถประมวลผลรูปภาพได้')
    }
  }

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoUrls[idx])
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (usedSpareParts && spareParts.length === 0) {
      setError('กรุณาเพิ่มรายการ Spare Parts อย่างน้อย 1 รายการ')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const afterPhotos = photos.length > 0 ? await filesToBase64(photos) : undefined
      const sparePartsData = usedSpareParts && spareParts.length > 0
        ? spareParts.map((part) => {
            if (part.repairType === 'COMPONENT_REPLACEMENT') {
              return { repairType: part.repairType, componentName: part.componentName, oldComponentSerial: part.oldComponentSerial, newComponentSerial: part.newComponentSerial, parentEquipmentId: part.parentEquipmentId || undefined, notes: part.notes || undefined }
            }
            const newDeviceName = [part.newBrand, part.newModel].filter(Boolean).join(' ') || part.newDeviceName
            return { repairType: part.repairType, oldDeviceName: part.oldDeviceName, oldSerialNo: part.oldSerialNo, oldEquipmentId: part.oldEquipmentId || undefined, newDeviceName, newSerialNo: part.newSerialNo, newBrand: part.newBrand || undefined, newModel: part.newModel || undefined, newEquipmentId: part.newEquipmentId || undefined, replacementType: part.replacementType || undefined, notes: part.notes || undefined }
          })
        : undefined
      await onConfirm({
        resolutionType: selectedType,
        resolutionNote: note,
        afterPhotos,
        usedSpareParts: !!sparePartsData,
        spareParts: sparePartsData,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-700 w-full max-w-2xl sm:mx-4 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        <div className="p-6 border-b border-slate-700 shrink-0">
          <h3 className="text-lg font-semibold text-white">ปิดงานโดย Helpdesk</h3>
          <p className="text-gray-400 text-sm mt-1">{incident.ticketNumber} - {incident.title}</p>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/40 rounded-lg text-sm text-red-400">{error}</div>
          )}

          {/* Close method */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">เลือกวิธีปิดงาน</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedType('PHONE_SUPPORT')}
                className={`p-3 rounded-lg border-2 text-center transition ${
                  selectedType === 'PHONE_SUPPORT'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                    : 'border-slate-600 bg-slate-700/50 text-gray-400 hover:border-slate-500'
                }`}
              >
                <Phone className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Phone Support</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('REMOTE_SUPPORT')}
                className={`p-3 rounded-lg border-2 text-center transition ${
                  selectedType === 'REMOTE_SUPPORT'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                    : 'border-slate-600 bg-slate-700/50 text-gray-400 hover:border-slate-500'
                }`}
              >
                <Monitor className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Remote Support</span>
              </button>
            </div>
          </div>

          {/* Resolution note */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Resolution Note (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดการแก้ไข..."
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">รูปภาพ (Optional)</label>
              <span className="text-xs text-gray-500">{photos.length} / {MAX_PHOTOS} รูป</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={isSubmitting || photos.length >= MAX_PHOTOS} onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 text-sm border border-slate-600 bg-slate-700/50 text-gray-200 rounded-xl hover:bg-slate-700 transition disabled:opacity-50">
                <Camera className="w-4 h-4" /> ถ่ายรูป
              </button>
              <button type="button" disabled={isSubmitting || photos.length >= MAX_PHOTOS} onClick={() => galleryRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 text-sm border border-slate-600 bg-slate-700/50 text-gray-200 rounded-xl hover:bg-slate-700 transition disabled:opacity-50">
                <Upload className="w-4 h-4" /> เลือกจากคลัง
              </button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFiles} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
                {photoUrls.map((url, i) => (
                  <div key={url} className="relative aspect-square">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-slate-600" />
                    <button type="button" disabled={isSubmitting} onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-red-400 rounded-md hover:bg-black/80">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spare parts / equipment */}
          <div>
            <label className="flex items-center space-x-3 mb-3">
              <input
                type="checkbox"
                checked={usedSpareParts}
                onChange={(e) => setUsedSpareParts(e.target.checked)}
                disabled={isSubmitting}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700/50 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer disabled:opacity-50"
              />
              <span className="text-gray-200 font-medium">ใช้ Spare Parts (อะไหล่)</span>
            </label>
            {usedSpareParts && (
              <div className="space-y-3">
                {spareParts.map((p, i) => (
                  <div key={p.id}
                    onClick={() => { if (!isSubmitting) { setEditingPart(p); setSparePartEntryOpen(true) } }}
                    className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer hover:brightness-110 transition-all ${p.repairType === 'EQUIPMENT_REPLACEMENT' ? 'bg-blue-900/40 border-blue-700/50' : 'bg-purple-900/40 border-purple-700/50'}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 ${p.repairType === 'EQUIPMENT_REPLACEMENT' ? 'bg-blue-800/60' : 'bg-purple-800/60'}`}>
                      {p.repairType === 'EQUIPMENT_REPLACEMENT'
                        ? <ArrowRightLeft className="w-3.5 h-3.5 text-blue-300" />
                        : <Cpu className="w-3.5 h-3.5 text-purple-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold mb-0.5 ${p.repairType === 'EQUIPMENT_REPLACEMENT' ? 'text-blue-300' : 'text-purple-300'}`}>
                        #{i + 1} {p.repairType === 'EQUIPMENT_REPLACEMENT' ? 'เปลี่ยนอุปกรณ์' : 'เปลี่ยนชิ้นส่วน'}
                      </p>
                      {p.repairType === 'EQUIPMENT_REPLACEMENT' ? (
                        <p className="text-xs text-white truncate">
                          <span className="font-medium">{p.oldDeviceName || '—'}</span>
                          <span className="text-gray-400"> S/N:{p.oldSerialNo || '-'}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-green-400">{[p.newBrand, p.newModel].filter(Boolean).join(' ') || p.newDeviceName || '—'} S/N:{p.newSerialNo || '-'}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-white truncate">
                          <span className="font-medium">{p.parentEquipmentName || '—'}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-gray-400">{p.componentName || '-'} S/N:{p.oldComponentSerial || '-'}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-green-400">S/N:{p.newComponentSerial || '-'}</span>
                        </p>
                      )}
                    </div>
                    <button type="button" disabled={isSubmitting}
                      onClick={e => { e.stopPropagation(); setSpareParts(prev => prev.filter(x => x.id !== p.id)) }}
                      className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors shrink-0 disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" disabled={isSubmitting} onClick={() => { setEditingPart(null); setSparePartEntryOpen(true) }}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-xl hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                  <Plus className="w-4 h-4" /> เพิ่ม Spare Part
                </button>
                <SparePartEntryModal
                  isOpen={sparePartEntryOpen}
                  onClose={() => { setSparePartEntryOpen(false); setEditingPart(null) }}
                  onAdd={p => setSpareParts(prev => prev.some(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p])}
                  storeId={storeId}
                  incidentEquipmentIds={incidentEquipmentIds}
                  initialPart={editingPart ?? undefined}
                  usedEquipmentIds={spareParts.filter(p => p.repairType === 'EQUIPMENT_REPLACEMENT' && p.oldEquipmentId && p.id !== editingPart?.id).map(p => p.oldEquipmentId!)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end space-x-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-4 py-2 text-white rounded-lg transition ${
              selectedType === 'PHONE_SUPPORT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:brightness-110'
            } disabled:opacity-50`}
            style={selectedType !== 'PHONE_SUPPORT' ? { backgroundColor: themeHighlight } : undefined}
          >
            {isSubmitting ? 'กำลังปิดงาน...' : 'ยืนยันปิดงาน'}
          </button>
        </div>
      </div>
    </div>
  )
}
