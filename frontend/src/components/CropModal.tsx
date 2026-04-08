'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check, RotateCcw, RotateCw } from 'lucide-react'
import { createPortal } from 'react-dom'

interface Props {
  imageSrc: string
  onConfirm: (croppedBlob: Blob) => void
  onCancel: () => void
}

interface Area { x: number; y: number; width: number; height: number }

async function getCroppedBlob(imageSrc: string, pixelCrop: Area, rotation: number): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = imageSrc
  })

  const rad = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const rotW = Math.round(image.width * cos + image.height * sin)
  const rotH = Math.round(image.width * sin + image.height * cos)

  // Step 1: rotate the full image
  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = rotW
  rotCanvas.height = rotH
  const rotCtx = rotCanvas.getContext('2d')!
  rotCtx.translate(rotW / 2, rotH / 2)
  rotCtx.rotate(rad)
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2)

  // Step 2: crop from rotated canvas
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = pixelCrop.width
  cropCanvas.height = pixelCrop.height
  const cropCtx = cropCanvas.getContext('2d')!
  cropCtx.drawImage(
    rotCanvas,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => { blob ? resolve(blob) : reject(new Error('Canvas empty')) },
      'image/jpeg', 0.95,
    )
  })
}

export default function CropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [confirming, setConfirming] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setConfirming(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation)
      onConfirm(blob)
    } catch {
      setConfirming(false)
    }
  }

  const rotateLeft  = () => setRotation((r) => r - 90)
  const rotateRight = () => setRotation((r) => r + 90)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Top bar — ยกเลิก + title */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <X className="w-4 h-4" />
          ยกเลิก
        </button>
        <p className="text-white text-sm font-medium">Crop</p>
        {/* Spacer to center title */}
        <div className="w-20" />
      </div>

      {/* Crop canvas */}
      <div className="flex-1 relative">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{ containerStyle: { background: '#000' } }}
        />
      </div>

      {/* Bottom bar — rotate + ตกลง */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-t border-slate-700">
        {/* Rotate buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={rotateLeft}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs">-90°</span>
          </button>
          <button
            onClick={rotateRight}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white text-sm transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-xs">+90°</span>
          </button>
          {rotation !== 0 && (
            <button
              onClick={() => setRotation(0)}
              className="px-2 py-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              รีเซ็ต
            </button>
          )}
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={confirming || !croppedAreaPixels}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {confirming ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          ตกลง
        </button>
      </div>
    </div>,
    document.body,
  )
}
