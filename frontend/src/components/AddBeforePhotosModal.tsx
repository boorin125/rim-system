// components/AddBeforePhotosModal.tsx
'use client'

import { useState, useRef } from 'react'
import { X, Camera, Plus, Trash2, Upload } from 'lucide-react'

interface AddBeforePhotosModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (photos: string[]) => Promise<void>
  currentPhotoCount: number
  maxPhotos?: number
}

export default function AddBeforePhotosModal({
  isOpen,
  onClose,
  onSubmit,
  currentPhotoCount,
  maxPhotos = 5,
}: AddBeforePhotosModalProps) {
  const [photos, setPhotos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const remainingSlots = maxPhotos - currentPhotoCount
  const canAddMore = photos.length < remainingSlots

  // Compress image
  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img

          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(compressedDataUrl)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newPhotos: string[] = []
    const availableSlots = remainingSlots - photos.length

    for (let i = 0; i < Math.min(files.length, availableSlots); i++) {
      try {
        const compressed = await compressImage(files[i])
        newPhotos.push(compressed)
      } catch (error) {
        console.error('Failed to compress image:', error)
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (photos.length === 0) return

    setIsSubmitting(true)
    try {
      await onSubmit(photos)
      setPhotos([])
      onClose()
    } catch (error) {
      console.error('Failed to add photos:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setPhotos([])
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 rounded-2xl max-w-lg w-full animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">เพิ่มรูปก่อนทำ</h2>
            <p className="text-sm text-gray-400 mt-1">
              มีรูปอยู่แล้ว {currentPhotoCount} รูป (เพิ่มได้อีก {remainingSlots} รูป)
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Photo Preview */}
        {photos.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3">
              รูปที่เลือก ({photos.length} รูป)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Photo Button */}
        {canAddMore && (
          <div className="mb-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="w-full py-4 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-500 hover:bg-slate-800/50 transition-all flex flex-col items-center gap-2"
            >
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Camera className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-gray-300">
                {photos.length === 0 ? 'เลือกรูปภาพ' : 'เพิ่มรูปภาพ'}
              </span>
              <span className="text-xs text-gray-500">
                เพิ่มได้อีก {remainingSlots - photos.length} รูป
              </span>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={photos.length === 0 || isSubmitting}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังอัปโหลด...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>เพิ่มรูป ({photos.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
