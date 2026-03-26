'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Keyboard, Zap } from 'lucide-react'

interface Props {
  isOpen: boolean
  onDetect: (value: string) => void
  onClose: () => void
  label?: string
}

export default function BarcodeScannerModal({ isOpen, onDetect, onClose, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectorRef = useRef<any>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error' | 'unsupported'>('starting')
  const [manualValue, setManualValue] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [lastDetected, setLastDetected] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setStatus('starting')
    setManualValue('')
    setShowManual(false)
    setLastDetected('')
    startScanner()
    return () => stopScanner()
  }, [isOpen])

  const startScanner = async () => {
    try {
      if (!('BarcodeDetector' in window)) {
        setStatus('unsupported')
        setShowManual(true)
        return
      }

      detectorRef.current = new (window as any).BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix', 'upc_a', 'upc_e', 'itf', 'pdf417'],
      })

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStatus('scanning')
        scan()
      }
    } catch {
      setStatus('error')
      setShowManual(true)
    }
  }

  const scan = () => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector) return

    const detect = async () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await detector.detect(video)
          if (barcodes.length > 0) {
            const value = barcodes[0].rawValue
            setLastDetected(value)
            stopScanner()
            onDetect(value)
            return
          }
        } catch {}
      }
      rafRef.current = requestAnimationFrame(detect)
    }
    rafRef.current = requestAnimationFrame(detect)
  }

  const stopScanner = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const handleClose = () => {
    stopScanner()
    onClose()
  }

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onDetect(manualValue.trim())
    }
  }

  if (!isOpen) return null

  return (
    /* Full-screen overlay on mobile, centered card on desktop */
    <div className="fixed inset-0 z-[70] bg-black flex flex-col sm:items-center sm:justify-center sm:bg-black/80">
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl bg-black">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/80 sm:bg-slate-900 border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white text-sm">{label || 'สแกน Barcode / QR Code'}</span>
          </div>
          <button
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        {/* Camera view — fills remaining height on mobile */}
        {!showManual && (
          <div className="relative flex-1 bg-black sm:aspect-video sm:flex-none">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Scanning overlay */}
            {status === 'scanning' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* Dark vignette outside the frame */}
                <div className="absolute inset-0 bg-black/40" />

                {/* Scan frame — 85% wide, proportional height */}
                <div className="relative z-10" style={{ width: '85%', aspectRatio: '3 / 1.4' }}>
                  {/* Clear window inside vignette */}
                  <div className="absolute inset-0 bg-transparent" />

                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-sm" />

                  {/* Scanning line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-blue-400/90 shadow-[0_0_8px_2px_rgba(96,165,250,0.6)] animate-scan-line" />
                </div>

                {/* Hint text */}
                <p className="relative z-10 mt-6 text-sm text-white/90 bg-black/60 px-4 py-1.5 rounded-full">
                  จ่อกล้องไปที่ Barcode หรือ QR Code
                </p>
              </div>
            )}

            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center text-white">
                  <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">กำลังเปิดกล้อง...</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="text-center text-white px-6">
                  <Camera className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-base font-medium">ไม่สามารถเปิดกล้องได้</p>
                  <p className="text-sm text-gray-400 mt-1">กรุณาอนุญาตการใช้งานกล้อง</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div className="px-4 py-4 space-y-3 bg-black/90 sm:bg-slate-900">
          {!showManual ? (
            <button
              onClick={() => { stopScanner(); setShowManual(true) }}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-300 hover:text-white border border-white/20 rounded-xl hover:border-white/40 transition-colors"
            >
              <Keyboard className="w-4 h-4" />
              พิมพ์เองแทน
            </button>
          ) : (
            <div className="space-y-3">
              {status === 'unsupported' && (
                <div className="flex items-center gap-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl">
                  <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                  <p className="text-xs text-yellow-300">
                    เบราว์เซอร์นี้ไม่รองรับการสแกน — กรุณาพิมพ์เอง
                  </p>
                </div>
              )}
              <input
                type="text"
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="พิมพ์ Serial Number..."
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                {status !== 'unsupported' && (
                  <button
                    onClick={() => { setShowManual(false); startScanner() }}
                    className="flex-1 py-3 text-sm border border-slate-600 text-gray-300 rounded-xl hover:border-blue-500 hover:text-blue-400 transition-colors"
                  >
                    กลับไปสแกน
                  </button>
                )}
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualValue.trim()}
                  className="flex-1 py-3 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
