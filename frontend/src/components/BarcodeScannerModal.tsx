'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Keyboard } from 'lucide-react'

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

  useEffect(() => {
    if (!isOpen) return
    setStatus('starting')
    setManualValue('')
    setShowManual(false)
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
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix', 'upc_a', 'upc_e'],
      })

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
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
            stopScanner()
            onDetect(barcodes[0].rawValue)
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
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white text-sm">{label || 'สแกน Barcode / QR Code'}</span>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Camera view */}
        {!showManual && (
          <div className="relative bg-black aspect-[4/3] w-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Scanning overlay */}
            {status === 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-48 h-48">
                  <div className="absolute inset-0 border-2 border-blue-400/70 rounded-lg" />
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br" />
                  {/* Scanning line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-blue-400/80 animate-scan-line" />
                </div>
                <p className="absolute bottom-4 text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
                  จ่อกล้องไปที่ Barcode หรือ QR Code
                </p>
              </div>
            )}

            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">กำลังเปิดกล้อง...</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <div className="text-center text-white px-4">
                  <Camera className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-sm">ไม่สามารถเปิดกล้องได้</p>
                  <p className="text-xs text-gray-400 mt-1">กรุณาอนุญาตการใช้งานกล้อง</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual input toggle */}
        <div className="px-4 py-3 space-y-3">
          {!showManual ? (
            <button
              onClick={() => setShowManual(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors"
            >
              <Keyboard className="w-4 h-4" />
              พิมพ์เองแทน
            </button>
          ) : (
            <div className="space-y-2">
              {status === 'unsupported' && (
                <p className="text-xs text-yellow-400 text-center">
                  เบราว์เซอร์นี้ไม่รองรับการสแกน — กรุณาพิมพ์เอง
                </p>
              )}
              <input
                type="text"
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="พิมพ์ Serial Number..."
                autoFocus
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                {status !== 'unsupported' && (
                  <button
                    onClick={() => { setShowManual(false); startScanner() }}
                    className="flex-1 py-2 text-sm border border-slate-600 text-gray-300 rounded-lg hover:border-blue-500 hover:text-blue-400 transition-colors"
                  >
                    กลับไปสแกน
                  </button>
                )}
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualValue.trim()}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
