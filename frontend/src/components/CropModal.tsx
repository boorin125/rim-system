'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, Check, RotateCcw, RotateCw } from 'lucide-react'
import { createPortal } from 'react-dom'

interface Props {
  imageSrc: string
  onConfirm: (croppedBlob: Blob) => void
  onCancel: () => void
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function rotateSrc(src: string, angleDeg: number): Promise<string> {
  const img = await loadImage(src)
  const rad = (angleDeg * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const w = Math.round(img.width * cos + img.height * sin)
  const h = Math.round(img.width * sin + img.height * cos)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.translate(w / 2, h / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  return new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(URL.createObjectURL(b)) : rej(new Error('canvas empty'))),
      'image/jpeg', 0.95,
    )
  })
}

async function cropToBlob(src: string, crop: PixelCrop, scaleX: number, scaleY: number): Promise<Blob> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(crop.width * scaleX)
  canvas.height = Math.round(crop.height * scaleY)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    img,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, canvas.width, canvas.height,
  )
  return new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('canvas empty'))),
      'image/jpeg', 0.95,
    )
  })
}

export default function CropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const [displaySrc, setDisplaySrc] = useState(imageSrc)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [rotating, setRotating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const blobUrlsRef = useRef<string[]>([])

  useEffect(() => {
    const urls = blobUrlsRef.current
    return () => { urls.forEach(URL.revokeObjectURL) }
  }, [])

  const onImageLoad = useCallback(() => {
    setCrop({ unit: '%', x: 5, y: 5, width: 90, height: 90 })
  }, [])

  const handleRotate = async (angle: number) => {
    setRotating(true)
    try {
      const newSrc = await rotateSrc(displaySrc, angle)
      blobUrlsRef.current.push(newSrc)
      setDisplaySrc(newSrc)
      setCrop({ unit: '%', x: 5, y: 5, width: 90, height: 90 })
      setCompletedCrop(undefined)
    } finally {
      setRotating(false)
    }
  }

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return
    setConfirming(true)
    try {
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      const blob = await cropToBlob(displaySrc, completedCrop, scaleX, scaleY)
      onConfirm(blob)
    } catch {
      setConfirming(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-center px-4 py-3 bg-slate-900 border-b border-slate-700">
        <p className="text-white text-sm font-medium">Crop</p>
      </div>

      {/* Crop area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
        >
          <img
            ref={imgRef}
            src={displaySrc}
            onLoad={onImageLoad}
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 140px)', display: 'block' }}
            alt="crop"
          />
        </ReactCrop>
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-t border-slate-700">
        {/* Rotate */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRotate(-90)}
            disabled={rotating}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-white text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs">-90°</span>
          </button>
          <button
            onClick={() => handleRotate(90)}
            disabled={rotating}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-white text-sm transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-xs">+90°</span>
          </button>
        </div>

        {/* Cancel + Confirm */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || !completedCrop}
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
      </div>
    </div>,
    document.body,
  )
}
