// app/service-report/[token]/page.tsx - Public Service Report (Form-style layout)
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  Send,
  FileText,
  Maximize2,
  X,
} from 'lucide-react'
import axios from 'axios'
import SignaturePad from 'signature_pad'
import QRCodeDisplay from '@/components/QRCodeDisplay'
import { generateServiceReportPDF, ServiceReportData } from '@/utils/serviceReportPdf'
import { getPhotoUrl } from '@/utils/photoUtils'

interface ServiceReport {
  organizationName: string
  organizationLogo: string
  organizationAddress: string
  providerName: string
  providerAddress: string
  providerPhone: string
  providerEmail: string
  providerTaxId: string
  providerLogo: string
  ticketNumber: string
  title: string
  description?: string
  category?: string
  priority: string
  status: string
  store?: {
    storeCode: string
    name: string
    company?: string
    address?: string
    province?: string
    phone?: string
    email?: string
  }
  technician?: { name: string; phone?: string }
  technicians?: { name: string; phone?: string }[]
  checkedInTechnicians?: { name: string; phone?: string }[]
  resolvedBy?: { name: string; signaturePath?: string | null }
  confirmedBy?: { name: string }
  resolutionNote?: string
  usedSpareParts: boolean
  spareParts: {
    deviceName: string
    oldSerialNo: string
    newSerialNo: string
    repairType: string
    equipmentName?: string
    oldBrandModel?: string
    newBrandModel?: string
    componentName?: string
    oldComponentSerial?: string
    newComponentSerial?: string
    parentEquipmentName?: string | null
  }[]
  beforePhotos?: string[]
  afterPhotos?: string[]
  signedReportPhotos?: string[]
  createdAt: string
  checkInAt?: string
  resolvedAt?: string
  confirmedAt?: string
  isSigned: boolean
  customerSignature?: string | null
  customerSignatureName?: string | null
  customerSignedAt?: string | null
  isExpired: boolean
  templateStyle?: string
  themeColors?: { bgStart: string; bgEnd: string }
}

export default function ServiceReportPage() {
  const params = useParams()
  const token = params.token as string
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fsCanvasRef = useRef<HTMLCanvasElement>(null)
  const fsSignaturePadRef = useRef<SignaturePad | null>(null)

  const [report, setReport] = useState<ServiceReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isFullscreenSign, setIsFullscreenSign] = useState(false)
  const [fsSignatureDataUrl, setFsSignatureDataUrl] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [docScale, setDocScale] = useState(1)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)

  useEffect(() => {
    if (!token) return
    const fetchReport = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/public/service-report/${token}`
        )
        setReport(res.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'ไม่พบ Service Report')
      } finally {
        setIsLoading(false)
      }
    }
    fetchReport()
  }, [token])

  // Responsive document scale + portrait detection
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setDocScale(Math.min(1, w / 680))
      setIsMobilePortrait(w < 768 && window.innerHeight > w)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  const initSignaturePad = useCallback(() => {
    if (canvasRef.current && !report?.isSigned) {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (container) {
        canvas.width = container.offsetWidth
        canvas.height = 200
      }
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 200)',
      })
    }
  }, [report])

  useEffect(() => {
    if (report && !report.isSigned && !report.isExpired && report.status !== 'CLOSED') {
      const timer = setTimeout(initSignaturePad, 100)
      return () => clearTimeout(timer)
    }
  }, [report, initSignaturePad])

  const handleClear = () => {
    signaturePadRef.current?.clear()
    setFsSignatureDataUrl(null)
  }

  // Fullscreen signature handlers
  const initFsCanvas = () => {
    if (fsCanvasRef.current) {
      const canvas = fsCanvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const w = window.innerWidth
      const h = window.innerHeight - 140
      // Match drawing buffer to physical pixels so touch coords align
      canvas.width = w * ratio
      canvas.height = h * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
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
      // Not supported on this device/browser — fallback to portrait fullscreen
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

  const handleSign = async () => {
    // Use fullscreen signature if available, otherwise use small pad
    const signatureData = fsSignatureDataUrl
      || (signaturePadRef.current && !signaturePadRef.current.isEmpty()
        ? signaturePadRef.current.toDataURL('image/png')
        : null)

    if (!signatureData) {
      alert('กรุณาเซ็นลายเซ็นก่อน')
      return
    }
    if (!signerName.trim()) {
      alert('กรุณาระบุชื่อผู้เซ็น')
      return
    }

    try {
      setIsSubmitting(true)
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/public/service-report/${token}/sign`,
        { signature: signatureData, signerName: signerName.trim() }
      )
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/public/service-report/${token}`
      )
      setReport(res.data)
    } catch (err: any) {
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!report) return
    setIsGeneratingPdf(true)
    try {
      const pdfData: ServiceReportData = {
        ...report,
        reportUrl: window.location.href,
      }
      await generateServiceReportPDF(pdfData, {
        style: (report.templateStyle as 'classic' | 'modern') || 'classic',
        blankSignature: !report.isSigned,
      })
    } catch (err: any) {
      console.error('PDF generation failed:', err)
      alert(`เกิดข้อผิดพลาดในการสร้าง PDF\n${err?.message || String(err)}`)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const priorityToSLA = (priority: string) => {
    const map: Record<string, string> = {
      CRITICAL: 'SLA1',
      HIGH: 'SLA2',
      MEDIUM: 'SLA3',
      LOW: 'SLA4',
    }
    return map[priority] || priority
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Service Report...</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Service Report Not Found</h2>
          <p className="text-gray-400">{error || 'ไม่พบ Service Report'}</p>
        </div>
      </div>
    )
  }

  const storeDisplay = report.store
    ? `${report.store.storeCode} ${report.store.name}`
    : '-'
  const storeAddress = report.store
    ? [report.store.address, report.store.province].filter(Boolean).join(', ')
    : ''

  // Technician signature URL (from resolver)
  const techSignatureUrl = report.resolvedBy?.signaturePath
    ? getPhotoUrl(report.resolvedBy.signaturePath)
    : null

  // All assigned technician names (resolver first)
  const allTechNames = (() => {
    if (!report.technicians || report.technicians.length === 0) {
      return report.resolvedBy?.name || '-'
    }
    const resolverName = report.resolvedBy?.name
    if (!resolverName) return report.technicians.map(t => t.name).join(', ')
    const resolver = report.technicians.filter(t => t.name === resolverName)
    const others = report.technicians.filter(t => t.name !== resolverName)
    return [...resolver, ...others].map(t => t.name).join(', ')
  })()

  // Fullscreen signature overlay (shared by both templates)
  const fullscreenSignatureOverlay = isFullscreenSign && (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
      {/* iOS hint: show when still in portrait (orientation lock not supported) */}
      {isMobilePortrait && (
        <div className="bg-blue-50 text-blue-600 text-xs text-center py-2 border-b border-blue-100">
          💡 หมุนมือถือเป็นแนวนอนเพื่อพื้นที่เซ็นที่กว้างขึ้น
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-300">
        <button
          onClick={closeFullscreenSign}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 transition text-sm"
        >
          <X className="w-5 h-5" />
          <span>ยกเลิก</span>
        </button>
        <h3 className="text-sm font-bold text-gray-700">ลายเซ็นลูกค้า</h3>
        <button
          onClick={clearFullscreenSign}
          className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:text-red-700 transition text-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>ล้าง</span>
        </button>
      </div>
      {/* Canvas area */}
      <div className="flex-1 relative">
        <canvas
          ref={fsCanvasRef}
          className="absolute inset-0 w-full h-full touch-none"
        />
      </div>
      {/* Bottom bar */}
      <div className="px-4 py-3 bg-gray-100 border-t border-gray-300">
        <button
          onClick={confirmFullscreenSign}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          <span>ยืนยันลายเซ็น</span>
        </button>
      </div>
    </div>
  )

  // ==================== MODERN TEMPLATE ====================
  if (report.templateStyle === 'modern') {
    const rawPrimary = report.themeColors?.bgStart || '#0f172a'
    const rawAccent = report.themeColors?.bgEnd || '#1e293b'

    // HSL helper: adjust theme colors so they're always clearly recognizable
    const hexToHSL = (hex: string): [number, number, number] => {
      const c = hex.replace('#', '')
      const r = parseInt(c.substring(0, 2), 16) / 255
      const g = parseInt(c.substring(2, 4), 16) / 255
      const b = parseInt(c.substring(4, 6), 16) / 255
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      let h = 0, s = 0
      const l = (mx + mn) / 2
      if (mx !== mn) {
        const d = mx - mn
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
        if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        else if (mx === g) h = ((b - r) / d + 2) / 6
        else h = ((r - g) / d + 4) / 6
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
    }

    const [pH, pS, pL] = hexToHSL(rawPrimary)
    const [aH, aS, aL] = hexToHSL(rawAccent)
    // Keep gray themes gray (don't inject hue), boost saturation for colored themes
    const pSatDark = pS < 5 ? pS : Math.max(pS, 30)
    const pSatLight = pS < 5 ? pS : Math.max(pS, 35)
    const aSatDark = aS < 5 ? aS : Math.max(aS, 30)
    // Dark bar: lightness 15-40%
    const primaryColor = `hsl(${pH}, ${pSatDark}%, ${Math.max(15, Math.min(40, pL))}%)`
    // Light tint: lightness 95%
    const primaryLight = `hsl(${pH}, ${pSatLight}%, 95%)`
    // Accent: lightness 28-45% — slightly lighter than primary
    const accentColor = `hsl(${aH}, ${aSatDark}%, ${Math.max(28, Math.min(45, aL))}%)`

    return (
      <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="fixed inset-0 bg-pattern"></div>
        <div className="relative z-10 max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
          <div className="bg-white shadow-2xl rounded-2xl overflow-hidden mx-auto" style={{ width: 680, zoom: docScale, minHeight: '297mm' } as React.CSSProperties}>

            {/* Modern Header - White */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-shrink-0">
                  {(report.providerLogo || report.organizationLogo) ? (
                    <img
                      src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${report.providerLogo || report.organizationLogo}`}
                      alt="Logo"
                      className="h-16 object-contain"
                    />
                  ) : (
                    <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-bold text-gray-900">
                    {report.providerName || report.organizationName || 'Service Report'}
                  </h1>
                  {(report.providerAddress || report.organizationAddress) && (
                    <p className="text-gray-600 text-sm mt-1 whitespace-pre-line">
                      {report.providerAddress || report.organizationAddress}
                    </p>
                  )}
                  {(report.providerPhone || report.providerEmail) && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      {report.providerPhone && `Tel: ${report.providerPhone}`}
                      {report.providerPhone && report.providerEmail && '  '}
                      {report.providerEmail && `Email: ${report.providerEmail}`}
                    </p>
                  )}
                  {report.providerTaxId && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      เลขประจำตัวผู้เสียภาษี: {report.providerTaxId}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Title Bar with Ticket Badge */}
            <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: accentColor }}>
              <h2 className="text-white font-bold text-base tracking-wide">SERVICE REPORT / ใบรายงานบริการ</h2>
              <div className="flex items-center gap-2">
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-300">
                  ฉบับ COPY
                </span>
                <span className="text-white font-bold text-sm">{report.ticketNumber}</span>
              </div>
            </div>

            {/* Detail Cards Grid */}
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 mb-1">ชื่อลูกค้า / Customer Name</p>
                  <p className="text-sm font-medium text-gray-800">{report.store?.company || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 mb-1">เลขที่ร้านค้า สาขา / Store</p>
                  <p className="text-sm font-medium text-gray-800">{storeDisplay}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3.5">
                <p className="text-xs text-gray-500 mb-1">ที่อยู่ / Address</p>
                <p className="text-sm text-gray-800">{storeAddress || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 mb-1">เบอร์โทร / Phone</p>
                  <p className="text-sm font-medium text-gray-800">{report.store?.phone || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 mb-1">ช่างเทคนิค / Technician</p>
                  <p className="text-sm font-medium text-gray-800">
                    {report.technicians && report.technicians.length > 0
                      ? report.technicians.map(t => t.name).join(', ')
                      : report.technician?.name || report.resolvedBy?.name || '-'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 mb-1">วันเข้าปฏิบัติงาน / Started Date</p>
                  <p className="text-sm font-medium text-gray-800">{report.checkInAt ? formatDate(report.checkInAt) : '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 mb-1">วันเวลา แก้ไขเสร็จ / Time to Finish</p>
                  <p className="text-sm font-medium text-gray-800">{report.resolvedAt ? formatDate(report.resolvedAt) : '-'}</p>
                </div>
              </div>
            </div>

            {/* Problem Section */}
            <div className="px-6 mb-4">
              <div className="px-4 py-2.5 rounded-t-xl font-bold text-sm" style={{ backgroundColor: primaryLight, color: '#1a1a1a' }}>
                ปัญหา / อาการเสีย / Problem / Symptoms
              </div>
              <div className="bg-slate-50 rounded-b-xl p-5 min-h-[12rem]">
                <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{report.title || '-'}</p>
              </div>
            </div>

            {/* Resolution Section */}
            <div className="px-6 mb-4">
              <div className="px-4 py-2.5 rounded-t-xl font-bold text-sm" style={{ backgroundColor: primaryLight, color: '#1a1a1a' }}>
                วิธีการแก้ไขปัญหา / Work Performance
              </div>
              <div className="bg-slate-50 rounded-b-xl p-5 min-h-[12rem]">
                <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{report.resolutionNote || '-'}</p>
              </div>
            </div>

            {/* Spare Parts — Device Used + Spare Part Used */}
            {(() => {
              const equipParts = report.spareParts.filter(sp => sp.repairType !== 'COMPONENT_REPLACEMENT')
              const compParts = report.spareParts.filter(sp => sp.repairType === 'COMPONENT_REPLACEMENT')
              const hasEquip = equipParts.length > 0
              const hasComp = compParts.length > 0
              return (
                <>
                  {/* TABLE 1: Device Used */}
                  {(hasEquip || !hasComp) && (
                    <div className="px-6 mb-2">
                      <div className="px-4 py-2.5 rounded-t-xl font-bold text-sm" style={{ backgroundColor: primaryLight, color: '#1a1a1a' }}>
                        อุปกรณ์ที่เปลี่ยน / Device Used
                      </div>
                      <div className="bg-slate-50 rounded-b-xl p-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ backgroundColor: primaryLight }}>
                              <th className="px-3 py-2 text-center w-8 font-medium text-xs text-gray-700">#</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">Equipment</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">Old Brand/Model</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">Old Serial No.</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">New Brand/Model</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">New Serial No.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hasEquip ? (
                              equipParts.map((sp, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-3 py-2 text-center text-gray-500 border-b border-gray-200">{idx + 1}</td>
                                  <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{sp.deviceName || '-'}</td>
                                  <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{sp.oldBrandModel || '-'}</td>
                                  <td className="px-3 py-2 text-gray-800 font-mono text-xs border-b border-gray-200">{sp.oldSerialNo || '-'}</td>
                                  <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{sp.newBrandModel || '-'}</td>
                                  <td className="px-3 py-2 text-gray-800 font-mono text-xs border-b border-gray-200">{sp.newSerialNo || '-'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr className="bg-white">
                                <td className="px-3 py-2 text-center text-gray-400 border-b border-gray-200"></td>
                                <td className="px-3 py-2 text-gray-400 border-b border-gray-200" colSpan={5}>ไม่มีการใช้ Spare Part</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* TABLE 2: Spare Part Used */}
                  {hasComp && (
                    <div className="px-6 mb-2">
                      <div className="px-4 py-2.5 rounded-t-xl font-bold text-sm" style={{ backgroundColor: primaryLight, color: '#1a1a1a' }}>
                        ชิ้นส่วนที่เปลี่ยน / Spare Part Used
                      </div>
                      <div className="bg-slate-50 rounded-b-xl p-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ backgroundColor: primaryLight }}>
                              <th className="px-3 py-2 text-center w-8 font-medium text-xs text-gray-700">#</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">Equipment</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">Old Part</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">Old Serial No.</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">New Part</th>
                              <th className="px-3 py-2 text-left font-medium text-xs text-gray-700">New Serial No.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {compParts.map((sp, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-2 text-center text-gray-500 border-b border-gray-200">{idx + 1}</td>
                                <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{sp.parentEquipmentName || sp.deviceName || '-'}</td>
                                <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{sp.componentName || '-'}</td>
                                <td className="px-3 py-2 text-gray-800 font-mono text-xs border-b border-gray-200">{sp.oldComponentSerial || '-'}</td>
                                <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{sp.componentName || '-'}</td>
                                <td className="px-3 py-2 text-gray-800 font-mono text-xs border-b border-gray-200">{sp.newComponentSerial || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
            <div className="mb-2" />

            {/* Remark + Status Row */}
            <div className="px-6 mb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">หมายเหตุ / Remark</p>
                  <p className="text-sm text-gray-800">-</p>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">สถานะงานบริการ / Service Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${
                      report.status === 'CLOSED' || report.status === 'CONFIRMED' || report.status === 'RESOLVED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {report.status}
                    </span>
                    {report.isSigned && (
                      <span className="text-green-600 text-sm font-medium">&#10003; Signed</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="px-6 mb-4">
              <div className="px-4 py-2.5 rounded-t-xl font-bold text-sm text-center" style={{ backgroundColor: primaryLight, color: '#1a1a1a' }}>
                ลายเซ็น / Signatures
              </div>
              <div className="bg-slate-50 rounded-b-xl p-6">
                {report.isSigned ? (
                  <div className="grid grid-cols-2 gap-6">
                    {/* Customer Signature */}
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-3">ลายเซ็นลูกค้า / Customer</p>
                      {report.customerSignature && (
                        <img
                          src={report.customerSignature}
                          alt="Customer Signature"
                          className="h-20 mx-auto mb-2 bg-white rounded-lg shadow-sm p-1"
                        />
                      )}
                      <div className="border-b-2 border-gray-400 w-48 mx-auto mb-1"></div>
                      <p className="text-gray-800 text-sm font-medium">( {report.customerSignatureName || '-'} )</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {report.customerSignedAt && formatDate(report.customerSignedAt)}
                      </p>
                    </div>
                    {/* Technician/Service */}
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-3">ลายเซ็นผู้ให้บริการ / Service</p>
                      <div className="h-20 flex items-end justify-center mb-2">
                        {techSignatureUrl ? (
                          <img
                            src={techSignatureUrl}
                            alt="Service Provider Signature"
                            className="h-16 object-contain"
                          />
                        ) : (
                          <p className="text-sm text-gray-500">{report.resolvedBy?.name || '-'}</p>
                        )}
                      </div>
                      <div className="border-b-2 border-gray-400 w-48 mx-auto mb-1"></div>
                      <p className="text-gray-600 text-sm">( {allTechNames} )</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {report.resolvedAt && formatDate(report.resolvedAt)}
                      </p>
                    </div>
                  </div>
                ) : report.status === 'CLOSED' ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 font-semibold">Incident นี้ปิดแล้ว</p>
                    <p className="text-gray-400 text-sm mt-1">ไม่สามารถเซ็นลายเซ็นได้</p>
                  </div>
                ) : report.signedReportPhotos && report.signedReportPhotos.length > 0 ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-700 font-semibold">ไม่สามารถยืนยันลายเซ็นออนไลน์ได้</p>
                    <p className="text-gray-500 text-sm mt-1">ได้มีการส่ง Service Report แบบอัพโหลดรูปเซ็น ({report.signedReportPhotos.length} รูป) แล้ว</p>
                  </div>
                ) : report.isExpired ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-yellow-600 font-medium">ลิงก์หมดอายุแล้ว</p>
                    <p className="text-gray-400 text-sm mt-1">ไม่สามารถเซ็นลายเซ็นได้</p>
                  </div>
                ) : (
                  <div>
                    {fullscreenSignatureOverlay}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Customer Signature Pad */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2 text-center">ลายเซ็นลูกค้า / Customer</p>
                        <div className="relative">
                          {fsSignatureDataUrl ? (
                            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white" style={{ height: '200px' }}>
                              <img src={fsSignatureDataUrl} alt="ลายเซ็น" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div ref={containerRef} className="border border-gray-300 rounded-lg overflow-hidden">
                              <canvas
                                ref={canvasRef}
                                className="w-full touch-none"
                                style={{ height: '200px' }}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={openFullscreenSign}
                            className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white border border-gray-300 rounded-lg shadow-sm transition"
                            title="ขยายช่องเซ็นเต็มจอ"
                          >
                            <Maximize2 className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder="ชื่อผู้เซ็น *"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                          <button
                            type="button"
                            onClick={handleClear}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> ล้าง
                          </button>
                        </div>
                        <button
                          onClick={handleSign}
                          disabled={isSubmitting}
                          className="w-full mt-3 py-3 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ backgroundColor: accentColor }}
                        >
                          {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> กำลังบันทึก...</>
                          ) : (
                            <><Send className="w-5 h-5" /> ยืนยันลายเซ็น</>
                          )}
                        </button>
                      </div>
                      {/* Technician display */}
                      <div className="text-center flex flex-col items-center justify-center">
                        <p className="text-xs text-gray-500 mb-2">ลายเซ็นผู้ให้บริการ / Service</p>
                        <div className="border border-gray-300 rounded-lg bg-white w-full" style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '10px' }}>
                          {techSignatureUrl ? (
                            <img
                              src={techSignatureUrl}
                              alt="Service Provider Signature"
                              className="h-32 object-contain"
                            />
                          ) : (
                            <p className="text-sm text-gray-500">{report.resolvedBy?.name || '-'}</p>
                          )}
                        </div>
                        <div className="border-b-2 border-gray-400 w-48 mt-2 mb-1"></div>
                        <p className="text-gray-600 text-sm">( {allTechNames} )</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Signed Service Report Photos */}
            {report.signedReportPhotos && report.signedReportPhotos.length > 0 && (
              <div className="px-6 mb-4">
                <div className="text-white px-4 py-2.5 rounded-t-xl font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                  ภาพ Service Report ที่เซ็นแล้ว / Signed Service Report Photos
                </div>
                <div className="bg-slate-50 rounded-b-xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {report.signedReportPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        onClick={() => setLightboxPhoto(getPhotoUrl(photo))}
                        className="block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition cursor-pointer"
                      >
                        <img
                          src={getPhotoUrl(photo)}
                          alt={`Signed SR ${idx + 1}`}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Download & QR Section */}
            <div className="px-6 mb-4">
              <div className="bg-slate-50 rounded-xl p-5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-2 px-6 py-2.5 text-white font-semibold rounded-xl transition disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isGeneratingPdf ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Generating PDF...</>
                    ) : (
                      <><Download className="w-5 h-5" /> Download PDF (ฉบับ Copy)</>
                    )}
                  </button>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Scan to view digital copy</p>
                    <div className="bg-white p-1.5 border border-gray-200 rounded-lg inline-block">
                      <QRCodeDisplay url={typeof window !== 'undefined' ? window.location.href : ''} size={100} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Footer with accent line */}
            <div className="mx-6 mb-6 mt-4">
              <div className="h-0.5 rounded-full mb-3" style={{ background: `linear-gradient(to right, ${primaryColor}, ${accentColor})` }}></div>
              <p className="text-center text-gray-400 text-xs">
                {report.providerName || report.organizationName
                  ? `${report.providerName || report.organizationName} - Incident Management System`
                  : 'Incident Management System'}
              </p>
            </div>

          </div>
        </div>
      </div>
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition" onClick={() => setLightboxPhoto(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxPhoto} alt="Service Report Photo" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      </>
    )
  }

  // ==================== CLASSIC TEMPLATE ====================
  // Define theme color for classic template table headers
  const classicPrimaryColor = report.themeColors?.bgStart || '#1e40af'

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="fixed inset-0 bg-pattern"></div>

      <div className="relative z-10 max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
        {/* Form Document */}
        <div className="bg-white shadow-2xl mx-auto" style={{ width: 680, zoom: docScale, minHeight: '297mm' } as React.CSSProperties}>

          {/* Header: Logo + Company Info */}
          <div className="border-b-2 border-black p-5">
            <div className="flex items-start justify-between gap-4">
              {/* Left - Logo */}
              <div className="flex-shrink-0">
                {(report.providerLogo || report.organizationLogo) ? (
                  <img
                    src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${report.providerLogo || report.organizationLogo}`}
                    alt="Logo"
                    className="h-16 object-contain"
                  />
                ) : (
                  <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Right - Company Info */}
              <div className="text-right flex-1">
                <h1 className="text-lg font-bold text-black">
                  {report.providerName || report.organizationName || 'Service Report'}
                </h1>
                {(report.providerAddress || report.organizationAddress) && (
                  <p className="text-gray-600 text-xs mt-1 whitespace-pre-line">
                    {report.providerAddress || report.organizationAddress}
                  </p>
                )}
                {(report.providerPhone || report.providerEmail) && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {report.providerPhone && `Tel: ${report.providerPhone}`}
                    {report.providerPhone && report.providerEmail && '  '}
                    {report.providerEmail && `Email: ${report.providerEmail}`}
                  </p>
                )}
                {report.providerTaxId && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    เลขประจำตัวผู้เสียภาษี: {report.providerTaxId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Title Bar */}
          <div className="bg-gray-800 text-white text-center py-2 relative">
            <h2 className="text-base font-bold tracking-wider">SERVICE REPORT / ใบรายงานบริการ</h2>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-300">
              ฉบับ COPY
            </span>
          </div>

          {/* Section 1: Detail Info */}
          <div className="mt-4 mx-4">
          <table className="w-full border-collapse text-sm" style={{ borderColor: '#000' }}>
            <tbody>
              {/* Row 1: Ticket ID | วันเข้าปฏิบัติงาน */}
              <tr>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  Ticket ID / Job No.
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black font-medium w-[22%]">
                  {report.ticketNumber}
                </td>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  วันเข้าปฏิบัติงาน / Started Date
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black w-[22%]">
                  {report.checkInAt ? formatDate(report.checkInAt) : '-'}
                </td>
              </tr>

              {/* Row 2: ชื่อลูกค้า (Company) | เลขที่ร้านค้า สาขา */}
              <tr>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  ชื่อลูกค้า / Customer Name
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black w-[22%]">
                  {report.store?.company || '-'}
                </td>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  เลขที่ร้านค้า สาขา / Store ID Store Name
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black w-[22%]">
                  {storeDisplay}
                </td>
              </tr>

              {/* Row 3: ที่อยู่ - full width */}
              <tr>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  ที่อยู่ / Address
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black text-xs" colSpan={3}>
                  <div className="min-h-[2.5rem] whitespace-pre-wrap">{storeAddress || '-'}</div>
                </td>
              </tr>

              {/* Row 4: เบอร์โทร | อีเมล */}
              <tr>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  เบอร์โทร / Phone
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black w-[22%]">
                  {report.store?.phone || '-'}
                </td>
              </tr>

              {/* Row 5: ช่างเทคนิค | วันเวลาแก้ไขเสร็จ */}
              <tr>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  ช่างเทคนิค / Technician
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black w-[22%]">
                  {report.technicians && report.technicians.length > 0
                    ? report.technicians.map(t => t.name).join(', ')
                    : report.technician?.name || report.resolvedBy?.name || '-'}
                </td>
                <td className="border border-gray-400 bg-gray-200 px-3 py-1.5 font-bold text-gray-700 w-[28%]">
                  วันเวลา แก้ไขเสร็จ / Time to Finish
                </td>
                <td className="border border-gray-400 px-3 py-1.5 text-black w-[22%]">
                  {report.resolvedAt ? formatDate(report.resolvedAt) : '-'}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* Section 2: Problem / Resolution / Spare Parts / Remark / Status */}
          <div className="mt-4 mx-4">
          {/* Problem / Symptoms */}
          <div className="border border-gray-400">
            <div className="bg-gray-200 border-b border-gray-400 px-3 py-1.5">
              <span className="font-bold text-gray-700 text-sm">
                ปัญหา / อาการเสีย / Problem / Symptoms
              </span>
            </div>
            <div
              className="px-4 min-h-[15rem]"
              style={{
                backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1.49rem, #e5e7eb 1.49rem, #e5e7eb 1.5rem)',
                backgroundSize: '100% 1.5rem',
                paddingTop: '0.25rem',
              }}
            >
              <p className="text-black text-sm whitespace-pre-wrap leading-6" style={{ textIndent: '2rem' }}>{report.title || '-'}</p>
            </div>
          </div>

          {/* Work Performance / Resolution */}
          <div className="border-x border-b border-gray-400 -mt-px">
            <div className="bg-gray-200 border-b border-gray-400 px-3 py-1.5">
              <span className="font-bold text-gray-700 text-sm">
                วิธีการแก้ไขปัญหา / Work Performance
              </span>
            </div>
            <div
              className="px-4 min-h-[15rem]"
              style={{
                backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1.49rem, #e5e7eb 1.49rem, #e5e7eb 1.5rem)',
                backgroundSize: '100% 1.5rem',
                paddingTop: '0.25rem',
              }}
            >
              <p className="text-black text-sm whitespace-pre-wrap leading-6" style={{ textIndent: '2rem' }}>{report.resolutionNote || '-'}</p>
            </div>
          </div>

          </div>

          {/* Section 3: Spare Parts (separate box) — Device Used + Spare Part Used */}
          {(() => {
            const equipParts = report.spareParts.filter(sp => sp.repairType !== 'COMPONENT_REPLACEMENT')
            const compParts = report.spareParts.filter(sp => sp.repairType === 'COMPONENT_REPLACEMENT')
            const hasEquip = equipParts.length > 0
            const hasComp = compParts.length > 0
            return (
              <>
                {/* TABLE 1: Device Used */}
                {(hasEquip || !hasComp) && (
                  <div className="mt-4 mx-4">
                  <div className="border border-gray-400">
                    <div className="px-3 py-1.5" style={{ backgroundColor: classicPrimaryColor }}>
                      <span className="font-bold text-white text-sm">อุปกรณ์ที่เปลี่ยน / Device Used</span>
                    </div>
                    <div className="px-3 py-2">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-center w-8">#</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">Equipment</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">Old Brand/Model</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">Old Serial No.</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">New Brand/Model</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">New Serial No.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hasEquip ? (
                            equipParts.map((sp, idx) => (
                              <tr key={idx}>
                                <td className="border border-gray-400 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-black">{sp.deviceName || '-'}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-black">{sp.oldBrandModel || '-'}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-black font-mono text-xs">{sp.oldSerialNo || '-'}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-black">{sp.newBrandModel || '-'}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-black font-mono text-xs">{sp.newSerialNo || '-'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="border border-gray-400 px-2 py-1.5 text-center text-gray-400"></td>
                              <td className="border border-gray-400 px-2 py-1.5 text-gray-400" colSpan={5}>ไม่มีการใช้ Spare Part</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </div>
                )}
                {/* TABLE 2: Spare Part Used */}
                {hasComp && (
                  <div className="mt-2 mx-4">
                  <div className="border border-gray-400">
                    <div className="px-3 py-1.5" style={{ backgroundColor: classicPrimaryColor }}>
                      <span className="font-bold text-white text-sm">ชิ้นส่วนที่เปลี่ยน / Spare Part Used</span>
                    </div>
                    <div className="px-3 py-2">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-center w-8">#</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">Equipment</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">Old Part</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">Old Serial No.</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">New Part</th>
                            <th className="border border-gray-400 px-2 py-1.5 text-gray-700 text-left">New Serial No.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compParts.map((sp, idx) => (
                            <tr key={idx}>
                              <td className="border border-gray-400 px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
                              <td className="border border-gray-400 px-2 py-1.5 text-black">{sp.parentEquipmentName || sp.deviceName || '-'}</td>
                              <td className="border border-gray-400 px-2 py-1.5 text-black">{sp.componentName || '-'}</td>
                              <td className="border border-gray-400 px-2 py-1.5 text-black font-mono text-xs">{sp.oldComponentSerial || '-'}</td>
                              <td className="border border-gray-400 px-2 py-1.5 text-black">{sp.componentName || '-'}</td>
                              <td className="border border-gray-400 px-2 py-1.5 text-black font-mono text-xs">{sp.newComponentSerial || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </div>
                )}
              </>
            )
          })()}
          {/* หมายเหตุ (Remark) */}
          <div className="border-x border-b border-gray-400 -mt-px">
            <div className="flex items-start">
              <div className="bg-gray-200 border-r border-gray-400 px-3 py-1.5 font-bold text-gray-700 text-sm w-[28%]">
                หมายเหตุ / Remark
              </div>
              <div className="px-4 py-1.5 flex-1 min-h-[40px]">
                <p className="text-black text-sm">-</p>
              </div>
            </div>
          </div>

          {/* สถานะงานบริการ (Service Status) */}
          <div className="border-x border-b border-gray-400 -mt-px">
            <div className="flex items-center">
              <div className="bg-gray-200 border-r border-gray-400 px-3 py-1.5 font-bold text-gray-700 text-sm w-[28%]">
                สถานะงานบริการ / Service Status
              </div>
              <div className="px-4 py-1.5 flex-1">
                <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${
                  report.status === 'CLOSED' || report.status === 'CONFIRMED' || report.status === 'RESOLVED'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                }`}>
                  {report.status}
                </span>
                {report.isSigned && (
                  <span className="ml-2 text-green-600 text-sm font-medium">&#10003; Signed</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Signatures */}
          <div className="mt-4 mx-4">
          <div className="border border-gray-400">
            <div className="bg-gray-200 border-b border-gray-400 px-3 py-1.5 text-center">
              <span className="font-bold text-gray-700 text-sm">
                ลายเซ็น / Signatures
              </span>
            </div>

            {report.isSigned ? (
              <div className="grid grid-cols-2 divide-x divide-gray-400">
                {/* Customer Signature */}
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-3">ลายเซ็นลูกค้า / Customer</p>
                  {report.customerSignature && (
                    <img
                      src={report.customerSignature}
                      alt="Customer Signature"
                      className="h-20 mx-auto mb-2 bg-white"
                    />
                  )}
                  <div className="border-b border-black w-48 mx-auto mb-1"></div>
                  <p className="text-black text-sm font-medium">( {report.customerSignatureName || '-'} )</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {report.customerSignedAt && formatDate(report.customerSignedAt)}
                  </p>
                </div>
                {/* Technician/Service */}
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-3">ลายเซ็นผู้ให้บริการ / Service</p>
                  <div className="h-20 flex items-end justify-center mb-2">
                    {techSignatureUrl ? (
                      <img
                        src={techSignatureUrl}
                        alt="Service Provider Signature"
                        className="h-16 object-contain"
                      />
                    ) : (
                      <p className="text-sm text-gray-500">{report.resolvedBy?.name || '-'}</p>
                    )}
                  </div>
                  <div className="border-b border-black w-48 mx-auto mb-1"></div>
                  <p className="text-gray-600 text-sm">( {allTechNames} )</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {report.resolvedAt && formatDate(report.resolvedAt)}
                  </p>
                </div>
              </div>
            ) : report.status === 'CLOSED' ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-semibold">Incident นี้ปิดแล้ว</p>
                <p className="text-gray-400 text-sm mt-1">ไม่สามารถเซ็นลายเซ็นได้</p>
              </div>
            ) : report.signedReportPhotos && report.signedReportPhotos.length > 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-amber-700 font-semibold">ไม่สามารถยืนยันลายเซ็นออนไลน์ได้</p>
                <p className="text-gray-500 text-sm mt-1">ได้มีการส่ง Service Report แบบอัพโหลดรูปเซ็น ({report.signedReportPhotos.length} รูป) แล้ว</p>
              </div>
            ) : report.isExpired ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-yellow-600 font-medium">ลิงก์หมดอายุแล้ว</p>
                <p className="text-gray-400 text-sm mt-1">ไม่สามารถเซ็นลายเซ็นได้</p>
              </div>
            ) : (
              <div className="p-4">
                {fullscreenSignatureOverlay}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Signature Pad */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2 text-center">ลายเซ็นลูกค้า / Customer</p>
                    <div className="relative">
                      {fsSignatureDataUrl ? (
                        <div className="border border-gray-300 rounded overflow-hidden bg-white" style={{ height: '200px' }}>
                          <img src={fsSignatureDataUrl} alt="ลายเซ็น" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div ref={containerRef} className="border border-gray-300 rounded overflow-hidden">
                          <canvas
                            ref={canvasRef}
                            className="w-full touch-none"
                            style={{ height: '200px' }}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={openFullscreenSign}
                        className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white border border-gray-300 rounded shadow-sm transition"
                        title="ขยายช่องเซ็นเต็มจอ"
                      >
                        <Maximize2 className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="ชื่อผู้เซ็น *"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> ล้าง
                      </button>
                    </div>
                    <button
                      onClick={handleSign}
                      disabled={isSubmitting}
                      className="w-full mt-3 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> กำลังบันทึก...</>
                      ) : (
                        <><Send className="w-5 h-5" /> ยืนยันลายเซ็น</>
                      )}
                    </button>
                  </div>
                  {/* Technician display */}
                  <div className="text-center flex flex-col items-center justify-center">
                    <p className="text-xs text-gray-500 mb-2">ลายเซ็นผู้ให้บริการ / Service</p>
                    <div className="border border-gray-300 rounded bg-gray-50 w-full" style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '10px' }}>
                      {techSignatureUrl ? (
                        <img
                          src={techSignatureUrl}
                          alt="Service Provider Signature"
                          className="h-32 object-contain"
                        />
                      ) : (
                        <p className="text-sm text-gray-500">{report.resolvedBy?.name || '-'}</p>
                      )}
                    </div>
                    <div className="border-b border-black w-48 mt-2 mb-1"></div>
                    <p className="text-gray-600 text-sm">( {allTechNames} )</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Signed Service Report Photos */}
          {report.signedReportPhotos && report.signedReportPhotos.length > 0 && (
            <div className="border-x border-b border-gray-400 -mt-px">
              <div className="bg-gray-200 border-b border-gray-400 px-3 py-1.5">
                <span className="font-bold text-gray-700 text-sm">
                  ภาพ Service Report ที่เซ็นแล้ว / Signed Service Report Photos
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {report.signedReportPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setLightboxPhoto(getPhotoUrl(photo))}
                      className="block border border-gray-300 rounded overflow-hidden hover:shadow-md transition cursor-pointer"
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`Signed SR ${idx + 1}`}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Download & QR Section */}
          <div className="border-x border-b border-gray-400 -mt-px p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Generating PDF...</>
                ) : (
                  <><Download className="w-5 h-5" /> Download PDF (ฉบับ Copy)</>
                )}
              </button>

              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Scan to view digital copy</p>
                <div className="bg-white p-1.5 border border-gray-200 rounded inline-block">
                  <QRCodeDisplay url={typeof window !== 'undefined' ? window.location.href : ''} size={100} />
                </div>
              </div>
            </div>
          </div>

          </div>

          {/* Footer */}
          <div className="mx-4 mt-4 bg-gray-50 border border-gray-300 px-3 py-2 text-center mb-4">
            <p className="text-gray-400 text-xs">
              {report.providerName || report.organizationName
                ? `${report.providerName || report.organizationName} - Incident Management System`
                : 'Incident Management System'}
            </p>
          </div>

        </div>
      </div>
    </div>
    {lightboxPhoto && (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxPhoto(null)}>
        <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition" onClick={() => setLightboxPhoto(null)}>
          <X className="w-6 h-6" />
        </button>
        <img src={lightboxPhoto} alt="Service Report Photo" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
    </>
  )
}
