'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, ScanLine, Type, X, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  onResult: (value: string) => void
  disabled?: boolean
}

type Mode = null | 'menu' | 'barcode' | 'ocr-loading' | 'ocr-result'

// Extract serial number candidates from OCR text
function extractCandidates(raw: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  // Lines that contain 5–25 consecutive alphanumeric chars
  raw.split(/[\n\r]+/).forEach(line => {
    const matches = line.match(/[A-Z0-9]{5,25}/gi) ?? []
    matches.forEach(m => {
      const v = m.toUpperCase()
      if (!seen.has(v)) { seen.add(v); results.push(v) }
    })
  })
  // Sort by length desc — longer codes are more likely to be serial numbers
  return results.sort((a, b) => b.length - a.length).slice(0, 5)
}

export default function SerialScannerButton({ onResult, disabled }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [ocrEdit, setOcrEdit] = useState('')
  const [error, setError] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const close = useCallback(() => {
    stopCamera()
    setMode(null)
    setCandidates([])
    setOcrEdit('')
    setError('')
  }, [stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Barcode scanner ────────────────────────────────────────────────────────
  const startBarcode = useCallback(async () => {
    setMode('barcode')
    setError('')
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        reader.decodeFromVideoElement(videoRef.current, (result, err, controls) => {
          if (!controlsRef.current && controls) controlsRef.current = controls
          if (result) {
            const val = result.getText().toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (val) { onResult(val); close() }
          }
          // suppress "not found" errors — they fire every frame with no barcode in view
          if (err && err.name !== 'NotFoundException') {
            setError('สแกนไม่สำเร็จ — ลองใหม่')
          }
        })
      }
    } catch {
      setError('ไม่สามารถเปิดกล้องได้ — ตรวจสอบสิทธิ์การใช้งาน')
    }
  }, [onResult, close])

  // ── OCR ───────────────────────────────────────────────────────────────────
  const handleOcrFile = useCallback(async (file: File) => {
    setMode('ocr-loading')
    setError('')
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      const found = extractCandidates(text)
      setCandidates(found)
      setOcrEdit(found[0] ?? '')
      setMode('ocr-result')
    } catch {
      setError('OCR ไม่สำเร็จ — กรุณาพิมพ์เอง')
      setMode(null)
    }
  }, [])

  const confirmOcr = () => {
    const val = ocrEdit.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (val) onResult(val)
    close()
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setMode('menu')}
        title="สแกน Barcode / Photo to Text"
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-400 disabled:opacity-30 transition-colors"
      >
        <Camera className="w-3.5 h-3.5" />
      </button>

      {/* ── Menu ─────────────────────────────────────────────────────────────── */}
      {mode === 'menu' && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
          onClick={close}
        >
          <div
            className="w-full max-w-sm bg-slate-800 rounded-t-2xl p-5 space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs text-gray-400 text-center mb-3">เลือกวิธีกรอก Serial No.</p>

            <button
              onClick={startBarcode}
              className="w-full flex items-center gap-3 p-3.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
            >
              <ScanLine className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Scan Barcode</p>
                <p className="text-xs text-gray-400">สแกน barcode/QR ผ่านกล้องแบบ real-time</p>
              </div>
            </button>

            <button
              onClick={() => { setMode(null); fileInputRef.current?.click() }}
              className="w-full flex items-center gap-3 p-3.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
            >
              <Type className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Photo to Text</p>
                <p className="text-xs text-gray-400">ถ่ายรูปป้าย → Tesseract OCR → แปลงเป็นตัวอักษร</p>
              </div>
            </button>

            <button onClick={close} className="w-full p-2 text-gray-500 text-sm hover:text-gray-300">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* ── Barcode scanner ──────────────────────────────────────────────────── */}
      {mode === 'barcode' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between p-4 pt-safe">
            <p className="text-white font-medium">Scan Barcode</p>
            <button onClick={close}>
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4/5 max-w-xs border-2 border-blue-400 rounded-xl overflow-hidden relative">
                <div className="h-40" />
                <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center">
                  <div className="w-full h-0.5 bg-blue-400/70 animate-pulse" />
                </div>
              </div>
            </div>
            {error && (
              <div className="absolute bottom-6 left-4 right-4 bg-red-500/90 text-white text-sm p-3 rounded-xl text-center">
                {error}
              </div>
            )}
          </div>

          <p className="text-center text-gray-400 text-xs p-4 pb-safe">
            จัดให้ barcode อยู่ในกรอบ — ระบบจะ detect อัตโนมัติ
          </p>
        </div>
      )}

      {/* ── OCR Loading ───────────────────────────────────────────────────────── */}
      {mode === 'ocr-loading' && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center">
          <div className="bg-slate-800 rounded-2xl p-8 text-center space-y-4 mx-4">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
            <p className="text-white font-medium">กำลังอ่านตัวอักษร...</p>
            <p className="text-gray-400 text-xs">Tesseract OCR กำลังประมวลผล<br/>อาจใช้เวลา 5-15 วินาที</p>
          </div>
        </div>
      )}

      {/* ── OCR Result ───────────────────────────────────────────────────────── */}
      {mode === 'ocr-result' && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white font-medium">ผลลัพธ์ OCR</p>
              <button onClick={close}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Candidate chips */}
            {candidates.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">พบหลายค่า — แตะเพื่อเลือก:</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidates.map(c => (
                    <button
                      key={c}
                      onClick={() => setOcrEdit(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                        ocrEdit === c
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-slate-700 border-slate-600 text-gray-300 hover:border-slate-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editable result */}
            <div className="space-y-1">
              <p className="text-xs text-gray-400">แก้ไขได้ก่อนยืนยัน:</p>
              <input
                type="text"
                value={ocrEdit}
                onChange={e => setOcrEdit(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                placeholder="SERIAL NO."
                autoFocus
              />
              {candidates.length === 0 && (
                <p className="text-xs text-amber-400">OCR ไม่พบตัวเลข/อักษร — พิมพ์เองแทน</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={confirmOcr}
                disabled={!ocrEdit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                ใช้ค่านี้
              </button>
              <button
                onClick={close}
                className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 text-gray-300 rounded-xl text-sm transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for OCR photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleOcrFile(e.target.files[0]) }}
      />
    </>
  )
}
