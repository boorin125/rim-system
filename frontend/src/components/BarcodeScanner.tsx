'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X, SwitchCamera } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [camIndex, setCamIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices().then((devices) => {
      setCameras(devices)
      // default to back camera if available
      const backIdx = devices.findIndex((d) => /back|rear|environment/i.test(d.label))
      if (backIdx !== -1) setCamIndex(backIdx)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (cameras.length === 0) return
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    const deviceId = cameras[camIndex]?.deviceId
    reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
      if (result && !scanned) {
        setScanned(true)
        onScan(result.getText())
      }
      if (err && err.name !== 'NotFoundException') {
        // ignore not-found frames — normal during scanning
      }
    }).catch((e) => {
      setError('ไม่สามารถเปิดกล้องได้: ' + (e?.message || 'ตรวจสอบสิทธิ์กล้อง'))
    })

    return () => {
      BrowserMultiFormatReader.releaseAllStreams()
    }
  }, [cameras, camIndex])

  const switchCamera = () => {
    BrowserMultiFormatReader.releaseAllStreams()
    setScanned(false)
    setCamIndex((i) => (i + 1) % cameras.length)
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black/95 flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4 z-10">
        <p className="text-white font-semibold">สแกน Barcode / QR Code</p>
        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-center px-8 space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm">
            ปิด
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-sm">
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            style={{ aspectRatio: '1/1', objectFit: 'cover' }}
          />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 relative">
              {/* Corner markers */}
              {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4',
                'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4']
                .map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-white rounded-sm ${cls}`} />
                ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-400 text-sm mt-6 text-center px-8">
        วาง Barcode หรือ QR Code ให้อยู่ในกรอบ
      </p>
    </div>
  )
}
