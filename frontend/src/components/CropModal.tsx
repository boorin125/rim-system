'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, Check } from 'lucide-react'

interface Props {
  imageSrc: string
  onConfirm: (croppedBlob: Blob) => void
  onCancel: () => void
}

function centerInitialCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, width / height, width, height),
    width,
    height,
  )
}

async function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(crop.width * scaleX)
  canvas.height = Math.round(crop.height * scaleY)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, canvas.width, canvas.height,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { blob ? resolve(blob) : reject(new Error('Canvas empty')) },
      'image/jpeg', 0.95,
    )
  })
}

export default function CropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [confirming, setConfirming] = useState(false)

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerInitialCrop(width, height))
  }, [])

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return
    setConfirming(true)
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop)
      onConfirm(blob)
    } catch {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <X className="w-4 h-4" />
          ยกเลิก
        </button>
        <p className="text-white text-sm font-medium">Crop</p>
        <button
          onClick={handleConfirm}
          disabled={confirming || !completedCrop}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {confirming ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          ตกลง
        </button>
      </div>

      {/* Crop area */}
      <div className="flex-1 flex items-center justify-center overflow-auto bg-black p-2">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          minWidth={20}
          minHeight={20}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="crop"
            onLoad={onImageLoad}
            style={{ maxWidth: '100%', maxHeight: 'calc(100dvh - 120px)', objectFit: 'contain' }}
          />
        </ReactCrop>
      </div>

      <p className="flex-shrink-0 text-center text-xs text-gray-500 py-2 bg-slate-900">
        ลากขอบกรอบเพื่อปรับพื้นที่
      </p>
    </div>
  )
}
