// components/AddBeforePhotosModal.tsx
'use client'

import { useState, useRef } from 'react'
import { X, Camera, Trash2, Upload, FlipHorizontal2 } from 'lucide-react'
import { compressImage, fileToBase64 } from '@/utils/imageUtils'

interface AddBeforePhotosModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (photos: string[]) => Promise<void>
  currentPhotoCount: number
  maxPhotos?: number
}

export default function AddBeforePhotosModal({
  isOpen, onClose, onSubmit, currentPhotoCount, maxPhotos = 5,
}: AddBeforePhotosModalProps) {
  const [photos, setPhotos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment')

  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const remainingSlots = maxPhotos - currentPhotoCount
  const canAddMore = photos.length < remainingSlots

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const availableSlots = remainingSlots - photos.length
    const newPhotos: string[] = []
    for (let i = 0; i < Math.min(files.length, availableSlots); i++) {
      try {
        const compressed = await compressImage(files[i], { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
        newPhotos.push(await fileToBase64(compressed))
      } catch {}
    }
    setPhotos((prev) => [...prev, ...newPhotos])
    if (e.target) e.target.value = ''
  }

  const handleOpenCamera = () => setTimeout(() => cameraInputRef.current?.click(), 0)

  const handleSubmit = async () => {
    if (photos.length === 0) return
    setIsSubmitting(true)
    try { await onSubmit(photos); setPhotos([]); onClose() }
    catch (error) { console.error('Failed to add photos:', error) }
    finally { setIsSubmitting(false) }
  }

  const handleClose = () => { if (!isSubmitting) { setPhotos([]); onClose() } }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="glass-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[88vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-base font-semibold text-white">เพิ่มรูปก่อนทำ</h2>
            <p className="text-xs text-gray-400 mt-0.5">มีอยู่แล้ว {currentPhotoCount} รูป • เพิ่มได้อีก {remainingSlots} รูป</p>
          </div>
          <button onClick={handleClose} disabled={isSubmitting} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 space-y-3">

          {/* Hidden inputs */}
          <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} disabled={isSubmitting} className="hidden" />
          <input key={cameraFacing} ref={cameraInputRef} type="file" accept="image/*" capture={cameraFacing} onChange={handleFileChange} disabled={isSubmitting} className="hidden" />

          {/* Upload buttons (when no photos yet) */}
          {photos.length === 0 && canAddMore && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleOpenCamera} disabled={isSubmitting}
                  className="flex flex-col items-center justify-center gap-1.5 py-5 bg-blue-600/20 border-2 border-blue-500/50 rounded-xl hover:bg-blue-600/30 transition-all disabled:opacity-50">
                  <Camera className="w-7 h-7 text-blue-400" />
                  <span className="text-xs font-medium text-blue-300">ถ่ายรูป</span>
                  <span className="text-[10px] text-blue-400/70">{cameraFacing === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'}</span>
                </button>
                <button onClick={() => galleryInputRef.current?.click()} disabled={isSubmitting}
                  className="flex flex-col items-center justify-center gap-1.5 py-5 bg-slate-800/40 border-2 border-slate-600/50 rounded-xl hover:bg-slate-700/40 transition-all disabled:opacity-50">
                  <Upload className="w-7 h-7 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">เลือกจากคลัง</span>
                  <span className="text-[10px] text-gray-500">Gallery</span>
                </button>
              </div>
              <button onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700/30 rounded-lg transition-colors">
                <FlipHorizontal2 className="w-4 h-4" />
                สลับเป็น{cameraFacing === 'environment' ? 'กล้องหน้า' : 'กล้องหลัง'}
              </button>
            </div>
          )}

          {/* Photo grid */}
          {photos.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">รูปที่เลือก ({photos.length} รูป)</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <button onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors">
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}

                {/* Add more card */}
                {canAddMore && (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-slate-600/50 bg-slate-800/20 flex flex-col items-center justify-center gap-1">
                    <button onClick={handleOpenCamera} disabled={isSubmitting}
                      className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-blue-600/20 transition-colors disabled:opacity-50">
                      <Camera className="w-5 h-5 text-blue-400" />
                      <span className="text-[10px] text-blue-400">ถ่าย</span>
                    </button>
                    <button onClick={() => galleryInputRef.current?.click()} disabled={isSubmitting}
                      className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-slate-700/40 transition-colors disabled:opacity-50">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-[10px] text-gray-400">คลัง</span>
                    </button>
                    <button onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                      {cameraFacing === 'environment' ? '↺ หน้า' : '↺ หลัง'}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick add row */}
              {canAddMore && (
                <div className="flex gap-2 mt-2">
                  <button onClick={handleOpenCamera} disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600/20 border border-blue-500/40 rounded-lg text-xs text-blue-300 hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                    <Camera className="w-3.5 h-3.5" /> ถ่ายรูป ({cameraFacing === 'environment' ? 'หลัง' : 'หน้า'})
                  </button>
                  <button onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                    className="px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-slate-700/60 transition-colors">
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => galleryInputRef.current?.click()} disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800/40 border border-slate-600/40 rounded-lg text-xs text-gray-300 hover:bg-slate-700/40 transition-colors disabled:opacity-50">
                    <Upload className="w-3.5 h-3.5" /> คลังรูป
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 sm:px-5 border-t border-slate-700/50">
          <button onClick={handleClose} disabled={isSubmitting}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            ยกเลิก
          </button>
          <button onClick={handleSubmit} disabled={photos.length === 0 || isSubmitting}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isSubmitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>กำลังอัปโหลด...</span></>
            ) : (
              <><Upload className="w-4 h-4" /><span>เพิ่มรูป {photos.length > 0 ? `(${photos.length})` : ''}</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
