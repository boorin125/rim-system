// app/inventory-sign/[token]/page.tsx — Public Inventory List Signing Page
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Send,
  X,
  Trash2,
  Maximize2,
  PenLine,
} from 'lucide-react'
import axios from 'axios'
import SignaturePad from 'signature_pad'
import { getPhotoUrl } from '@/utils/photoUtils'

interface PmEquipmentItem {
  equipment: {
    name: string
    category: string
    serialNumber: string
    brand?: string
    model?: string
  }
  condition?: string
  comment?: string
  updatedBrand?: string
  updatedModel?: string
  updatedSerial?: string
  beforePhotos: string[]
}

interface PmPublicData {
  id: number
  store: {
    storeCode: string
    name: string
    province?: string
    address?: string
  }
  performedAt?: string
  storeSignedAt?: string
  storeSignerName?: string
  equipmentRecords: PmEquipmentItem[]
}

const conditionTh: Record<string, string> = {
  GOOD: 'ปกติ',
  NEEDS_REPAIR: 'ต้องซ่อม',
  REPLACED: 'เปลี่ยนใหม่',
}
const conditionColor: Record<string, string> = {
  GOOD: 'text-green-400 bg-green-500/10 border-green-500/30',
  NEEDS_REPAIR: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  REPLACED: 'text-red-400 bg-red-500/10 border-red-500/30',
}

export default function InventorySignPage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<PmPublicData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigned, setIsSigned] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Inline canvas — custom drawing (no SignaturePad) so getBoundingClientRect() is always fresh per event
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inlineCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const inlineIsDrawingRef = useRef(false)
  const inlineHasDrawingRef = useRef(false)

  // Fullscreen signature
  const fsCanvasRef = useRef<HTMLCanvasElement>(null)
  const fsSignaturePadRef = useRef<SignaturePad | null>(null)
  const [isFullscreenSign, setIsFullscreenSign] = useState(false)
  const [fsSignatureDataUrl, setFsSignatureDataUrl] = useState<string | null>(null)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/public/pm/inventory-sign/${token}`,
        )
        setData(res.data)
        if (res.data.storeSignedAt) setIsSigned(true)
      } catch (e: any) {
        setError(e?.response?.data?.message || 'ไม่พบเอกสาร หรือลิงก์หมดอายุแล้ว')
      } finally {
        setIsLoading(false)
      }
    }
    if (token) fetchData()
  }, [token])

  // Portrait detection for hint
  useEffect(() => {
    const check = () => setIsMobilePortrait(window.innerHeight > window.innerWidth)
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // Countdown + auto-close after signing
  useEffect(() => {
    if (!isSigned) return
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          window.history.back()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isSigned])

  // Init inline canvas
  const initInlineCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || isSigned) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width || canvas.offsetWidth
    const h = rect.height || canvas.offsetHeight
    if (!w || !h) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(w * ratio)
    canvas.height = Math.round(h * ratio)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgb(255,255,255)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e40af'
    ctx.fillStyle = '#1e40af'
    ctx.lineWidth = 2.5 * ratio
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    inlineCtxRef.current = ctx
    inlineHasDrawingRef.current = false
  }, [isSigned])

  useEffect(() => {
    if (data && !isSigned) {
      const t = setTimeout(initInlineCanvas, 300)
      return () => clearTimeout(t)
    }
  }, [data, isSigned, initInlineCanvas])

  // Reinit canvas after visual viewport changes (keyboard open/close)
  useEffect(() => {
    if (!data || isSigned) return
    const reinitIfEmpty = () => {
      if (!inlineHasDrawingRef.current) initInlineCanvas()
    }
    window.visualViewport?.addEventListener('resize', reinitIfEmpty)
    return () => window.visualViewport?.removeEventListener('resize', reinitIfEmpty)
  }, [data, isSigned, initInlineCanvas])

  // Canvas point — reads getBoundingClientRect() at event time (always accurate)
  const getCanvasPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleCanvasPtrDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = inlineCtxRef.current
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    inlineIsDrawingRef.current = true
    inlineHasDrawingRef.current = true
    const pt = getCanvasPt(e)
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
  }

  const handleCanvasPtrMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = inlineCtxRef.current
    if (!inlineIsDrawingRef.current || !ctx) return
    const pt = getCanvasPt(e)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
  }

  const handleCanvasPtrUp = () => {
    inlineIsDrawingRef.current = false
    inlineCtxRef.current?.beginPath()
  }

  // Inline clear
  const handleClearSignature = () => {
    const canvas = canvasRef.current
    const ctx = inlineCtxRef.current
    if (canvas && ctx) {
      ctx.fillStyle = 'rgb(255,255,255)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#1e40af'
      ctx.fillStyle = '#1e40af'
      inlineHasDrawingRef.current = false
    }
    setFsSignatureDataUrl(null)
  }

  // ─── Fullscreen signature ─────────────────────────────────────────────────

  const initFsCanvas = () => {
    if (fsCanvasRef.current) {
      const canvas = fsCanvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const w = window.innerWidth
      const h = window.innerHeight - 140
      canvas.width = w * ratio
      canvas.height = h * ratio
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      fsSignaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 200)',
        minWidth: 1.5,
        maxWidth: 3,
      })
    }
  }

  const openFullscreenSign = async () => {
    setIsFullscreenSign(true)
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape')
      }
    } catch (_) {
      // Not supported — fallback to portrait fullscreen
    }
    setTimeout(initFsCanvas, 100)
  }

  const closeFullscreenSign = async () => {
    fsSignaturePadRef.current?.off()
    fsSignaturePadRef.current = null
    setIsFullscreenSign(false)
    try {
      if ((screen.orientation as any).unlock) (screen.orientation as any).unlock()
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch (_) {}
  }

  const confirmFullscreenSign = () => {
    if (fsSignaturePadRef.current && !fsSignaturePadRef.current.isEmpty()) {
      setFsSignatureDataUrl(fsSignaturePadRef.current.toDataURL('image/png'))
    }
    closeFullscreenSign()
  }

  const clearFullscreenSign = () => {
    fsSignaturePadRef.current?.clear()
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      alert('กรุณาระบุชื่อผู้เซ็น')
      return
    }
    const signatureData =
      fsSignatureDataUrl ||
      (inlineHasDrawingRef.current
        ? canvasRef.current?.toDataURL('image/png') ?? null
        : null)
    if (!signatureData) {
      alert('กรุณาเซ็นลายมือชื่อก่อนยืนยัน')
      return
    }
    try {
      setIsSubmitting(true)
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/public/pm/inventory-sign/${token}/sign`,
        { signature: signatureData, signerName: signerName.trim() },
      )
      setIsSigned(true)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-semibold text-lg mb-2">ไม่สามารถเปิดเอกสารได้</h2>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-'

  // ─── Already Signed ───────────────────────────────────────────────────────
  if (isSigned) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2">บันทึกลายเซ็นแล้ว</h2>
          <p className="text-gray-300 text-sm mb-1">
            {data.store.storeCode} {data.store.name}
          </p>
          {data.storeSignerName && (
            <p className="text-gray-400 text-sm">ผู้เซ็น: {data.storeSignerName}</p>
          )}
          {data.storeSignedAt && (
            <p className="text-gray-400 text-xs mt-1">
              {new Date(data.storeSignedAt).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          {countdown > 0 && (
            <p className="text-gray-500 text-xs mt-4">
              กลับอัตโนมัติใน {countdown} วินาที...
            </p>
          )}
        </div>
      </div>
    )
  }

  // ─── Fullscreen Signature Overlay ─────────────────────────────────────────
  const fullscreenSignatureOverlay = isFullscreenSign && (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
      {isMobilePortrait && (
        <div className="bg-blue-50 text-blue-600 text-xs text-center py-2 border-b border-blue-100">
          💡 หมุนมือถือเป็นแนวนอนเพื่อพื้นที่เซ็นที่กว้างขึ้น
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-300">
        <button
          onClick={closeFullscreenSign}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 transition text-sm"
        >
          <X className="w-5 h-5" />
          <span>ยกเลิก</span>
        </button>
        <h3 className="text-sm font-bold text-gray-700">ลายเซ็นผู้รับเอกสาร</h3>
        <button
          onClick={clearFullscreenSign}
          className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:text-red-700 transition text-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>ล้าง</span>
        </button>
      </div>
      <div className="flex-1 relative">
        <canvas
          ref={fsCanvasRef}
          className="absolute inset-0 w-full h-full touch-none"
        />
      </div>
      <div className="px-4 py-3 bg-gray-100 border-t border-gray-300">
        <button
          onClick={confirmFullscreenSign}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          <span>ยืนยันลายเซ็น</span>
        </button>
      </div>
    </div>
  )

  // ─── Main Page ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {fullscreenSignatureOverlay}

      {/* Header */}
      <div className="bg-purple-900 px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-purple-300" />
            <div>
              <h1 className="text-white font-bold text-lg">Inventory List</h1>
              <p className="text-purple-300 text-sm">
                {data.store.storeCode} {data.store.name}
              </p>
            </div>
          </div>
          <p className="text-purple-200 text-xs mt-2">วันที่ PM: {dateStr}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Signature Section */}
        <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800">
            <h2 className="text-white text-sm font-semibold">ลงนามรับทราบ</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              เจ้าหน้าที่สาขาลงนามเพื่อรับทราบการตรวจสอบอุปกรณ์
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* Signer Name */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">ชื่อผู้ลงนาม</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>

            {/* Signature Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-gray-300">ลายเซ็น</label>
                <button
                  onClick={handleClearSignature}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                  ล้าง
                </button>
              </div>

              {/* Show fullscreen signature preview OR inline pad */}
              {fsSignatureDataUrl ? (
                <div className="relative">
                  <img
                    src={fsSignatureDataUrl}
                    alt="ลายเซ็น"
                    className="w-full rounded-xl border-2 border-purple-500 bg-white object-contain"
                    style={{ height: '120px' }}
                  />
                  <button
                    onClick={openFullscreenSign}
                    className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/40 rounded-lg text-white text-xs"
                  >
                    <PenLine className="w-3 h-3" />
                    เซ็นใหม่
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Fullscreen sign button */}
                  <button
                    onClick={openFullscreenSign}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600/20 hover:bg-purple-600/30 border-2 border-dashed border-purple-500/50 rounded-xl text-purple-300 text-sm font-medium transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                    เปิดหน้าจอเซ็นเต็มจอ (แนะนำ)
                  </button>
                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-xs text-gray-500">หรือเซ็นที่นี่</span>
                    <div className="flex-1 h-px bg-gray-700" />
                  </div>
                  {/* Inline pad */}
                  <div className="bg-white rounded-xl overflow-hidden border-2 border-gray-600">
                    <canvas
                      ref={canvasRef}
                      onPointerDown={handleCanvasPtrDown}
                      onPointerMove={handleCanvasPtrMove}
                      onPointerUp={handleCanvasPtrUp}
                      style={{ width: '100%', height: '160px', touchAction: 'none', cursor: 'crosshair' }}
                      className="block"
                    />
                  </div>
                  <p className="text-gray-500 text-xs text-center">เซ็นลายมือชื่อในกรอบด้านบน</p>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับทราบ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
