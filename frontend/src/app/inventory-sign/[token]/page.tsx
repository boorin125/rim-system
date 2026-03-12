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
} from 'lucide-react'
import axios from 'axios'
import SignaturePad from 'signature_pad'

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

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)

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

  // Init signature pad
  const initSignaturePad = useCallback(() => {
    if (canvasRef.current && !isSigned) {
      const canvas = canvasRef.current
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      signaturePadRef.current = new SignaturePad(canvas, {
        minWidth: 1,
        maxWidth: 3,
        penColor: '#1e40af',
        backgroundColor: 'rgb(255,255,255)',
      })
    }
  }, [isSigned])

  useEffect(() => {
    if (data && !isSigned) {
      const t = setTimeout(initSignaturePad, 100)
      return () => clearTimeout(t)
    }
  }, [data, isSigned, initSignaturePad])

  const handleClearSignature = () => {
    signaturePadRef.current?.clear()
  }

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      alert('กรุณาระบุชื่อผู้เซ็น')
      return
    }
    const signatureData =
      signaturePadRef.current && !signaturePadRef.current.isEmpty()
        ? signaturePadRef.current.toDataURL('image/png')
        : null
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
          <h2 className="text-white font-bold text-xl mb-2">ลงนามสำเร็จ</h2>
          <p className="text-gray-300 text-sm mb-1">
            {data.store.storeCode} — {data.store.name}
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
        </div>
      </div>
    )
  }

  // ─── Main Page ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="bg-purple-900 px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-purple-300" />
            <div>
              <h1 className="text-white font-bold text-lg">Inventory List</h1>
              <p className="text-purple-300 text-sm">
                {data.store.storeCode} — {data.store.name}
              </p>
            </div>
          </div>
          <p className="text-purple-200 text-xs mt-2">วันที่ PM: {dateStr}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Equipment List */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700">
          <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
            <h2 className="text-white text-sm font-semibold">รายการอุปกรณ์</h2>
            <span className="text-gray-400 text-xs">{data.equipmentRecords.length} รายการ</span>
          </div>
          <div className="divide-y divide-gray-800">
            {data.equipmentRecords.map((rec, idx) => (
              <div key={idx} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 text-xs font-mono">{idx + 1}.</span>
                      <p className="text-white text-sm font-medium truncate">{rec.equipment.name}</p>
                    </div>
                    <p className="text-gray-500 text-xs ml-4">
                      {rec.equipment.category} — S/N: {rec.updatedSerial || rec.equipment.serialNumber}
                    </p>
                    {(rec.updatedBrand || rec.equipment.brand) && (
                      <p className="text-gray-500 text-xs ml-4">
                        {[rec.updatedBrand || rec.equipment.brand, rec.updatedModel || rec.equipment.model]
                          .filter(Boolean)
                          .join(' / ')}
                      </p>
                    )}
                    {rec.comment && (
                      <p className="text-gray-400 text-xs ml-4 mt-1 italic">{rec.comment}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {rec.condition && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          conditionColor[rec.condition] ?? 'text-gray-400 border-gray-600'
                        }`}
                      >
                        {conditionTh[rec.condition] ?? rec.condition}
                      </span>
                    )}
                    {rec.beforePhotos?.[0] && (
                      <img
                        src={rec.beforePhotos[0]}
                        alt=""
                        className="w-12 h-12 object-cover rounded-lg border border-gray-600"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

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

            {/* Signature Pad */}
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
              <div className="bg-white rounded-xl overflow-hidden border-2 border-gray-600">
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '160px', touchAction: 'none' }}
                  className="block"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1 text-center">เซ็นลายมือชื่อในกรอบด้านบน</p>
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
