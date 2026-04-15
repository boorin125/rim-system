'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, Download } from 'lucide-react'
import axios from 'axios'
import { generatePmReportPDF, PmReportData } from '@/utils/pmReportPdf'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

interface EquipmentRecord {
  equipment: {
    name: string
    category: string
    brand?: string
    model?: string
    serialNumber: string
  }
  condition?: string
  comment?: string
  updatedBrand?: string
  updatedModel?: string
  updatedSerial?: string
  beforePhotos: string[]
  afterPhotos: string[]
}

interface PmReportPublicData {
  id: number
  performedAt?: string
  technicianSignature?: string
  storeSignature?: string
  storeSignerName?: string
  storeSignedAt?: string
  store: {
    storeCode: string
    name: string
    address?: string
  }
  technician?: { firstName: string; lastName: string }
  equipmentRecords: EquipmentRecord[]
  incident?: {
    ticketNumber: string
    title: string
  }
}

const conditionLabel: Record<string, string> = {
  GOOD: 'ปกติ', NEEDS_REPAIR: 'ต้องซ่อม', REPLACED: 'เปลี่ยนใหม่',
}
const conditionStyle: Record<string, React.CSSProperties> = {
  GOOD:         { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' },
  NEEDS_REPAIR: { background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' },
  REPLACED:     { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
}

export default function PmReportPage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<PmReportPublicData | null>(null)
  const [orgLogo, setOrgLogo] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!token) return
    const base = API_URL.replace('/api', '')

    Promise.all([
      axios.get(`${base}/api/public/pm/report/${token}`),
      axios.get(`${base}/api/settings/organization`).catch(() => ({ data: null })),
    ]).then(([pmRes, orgRes]) => {
      setData(pmRes.data)
      if (orgRes.data?.logoPath) {
        fetch(`${base}/${orgRes.data.logoPath}`)
          .then(r => r.blob())
          .then(blob => {
            const reader = new FileReader()
            reader.onload = e => setOrgLogo(e.target?.result as string)
            reader.readAsDataURL(blob)
          }).catch(() => {})
      }
      if (orgRes.data?.name) setOrgName(orgRes.data.name)
    }).catch(e => {
      setError(e.response?.data?.message || 'ไม่พบรายงาน หรือลิงก์ไม่ถูกต้อง')
    }).finally(() => setIsLoading(false))
  }, [token])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-black/80">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-xl p-8 text-center shadow max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error || 'ไม่พบรายงาน'}</p>
      </div>
    </div>
  )

  const techName = data.technician
    ? `${data.technician.firstName} ${data.technician.lastName}`
    : undefined

  const handleDownloadPdf = async () => {
    if (!data) return
    setDownloading(true)
    try {
      const pdfData: PmReportData = {
        ticketNumber: data.incident?.ticketNumber || '',
        store: data.store,
        performedAt: data.performedAt,
        technicianName: techName,
        technicianSignature: data.technicianSignature,
        storeSignature: data.storeSignature,
        storeSignerName: data.storeSignerName,
        storeSignedAt: data.storeSignedAt,
        organizationName: orgName || undefined,
        organizationLogo: orgLogo || undefined,
        equipmentRecords: data.equipmentRecords.map(rec => ({
          name: rec.equipment.name,
          category: rec.equipment.category,
          serialNumber: rec.equipment.serialNumber,
          brand: rec.equipment.brand,
          model: rec.equipment.model,
          condition: rec.condition,
          comment: rec.comment,
          beforePhotos: rec.beforePhotos || [],
          afterPhotos: rec.afterPhotos || [],
          updatedBrand: rec.updatedBrand,
          updatedModel: rec.updatedModel,
          updatedSerial: rec.updatedSerial,
        })),
      }
      await generatePmReportPDF(pdfData)
    } catch {
      alert('ดาวน์โหลด PDF ไม่สำเร็จ')
    } finally {
      setDownloading(false)
    }
  }

  const fmtDate = (d?: string) => {
    if (!d) return '\u00A0'
    const dt = new Date(d)
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`
  }

  const fmtDateTime = (d?: string) => {
    if (!d) return 'Last Update :'
    const dt = new Date(d)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `Last Update : ${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  }

  return (
    <div className="min-h-screen bg-slate-900 py-4 px-3 sm:py-6 sm:px-4">
      {/* Toolbar */}
      <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between px-1">
        <span className="text-white font-semibold text-sm">PM Report</span>
      </div>

      {/* Document */}
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-white rounded-xl shadow-2xl p-6 text-gray-800 font-sans">

          {/* Header */}
          <div className="flex items-end justify-between border-b-4 border-purple-600 pb-4 mb-6">
            <div className="flex items-end gap-3">
              {orgLogo && (
                <img src={orgLogo} alt="logo" className="h-10 sm:h-16 object-contain shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-[10px] sm:text-lg text-gray-700 leading-tight">Preventive Maintenance Report</p>
                <p className="font-bold text-xs sm:text-base text-gray-900 leading-tight truncate">
                  {data.store.storeCode} {data.store.name}
                </p>
                {data.store.address && (
                  <p className="text-[9px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">{data.store.address}</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 self-end pb-0.5 ml-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-900">{data.incident?.ticketNumber || ''}</p>
              <p className="text-[9px] sm:text-xs text-gray-400 mt-0.5">{fmtDateTime(data.performedAt)}</p>
            </div>
          </div>

          {/* Equipment Records */}
          <div className="space-y-6">
            {data.equipmentRecords.map((rec, idx) => {
              const eq = rec.equipment
              const brand = rec.updatedBrand || eq.brand
              const model = rec.updatedModel || eq.model
              const serial = rec.updatedSerial || eq.serialNumber
              const brandModel = `${brand || '-'} ${model || '-'}`
              const cond = rec.condition || ''

              return (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Equipment header */}
                  <div className="flex items-center justify-between bg-purple-50 px-4 py-2.5 gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900 text-sm">
                        {idx + 1}. {eq.name}
                        <span className="font-normal text-gray-600"> : {brandModel}</span>
                      </span>
                      {serial && (
                        <span className="text-xs text-gray-500 ml-2">S/N : {serial}</span>
                      )}
                    </div>
                    <div className="shrink-0">
                      {cond && (
                        <span style={{ ...conditionStyle[cond], padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                          {conditionLabel[cond]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Equipment body */}
                  <div className="px-4 py-3 space-y-2 text-sm">
                    {rec.comment && (
                      <p className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
                        <span className="font-medium">หมายเหตุ:</span> {rec.comment}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      {/* Before photos */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">ก่อน PM</p>
                        {rec.beforePhotos?.length > 0 ? (
                          <div className="flex gap-1.5 flex-wrap">
                            {rec.beforePhotos.slice(0, 4).map((p, i) => (
                              <img key={i} src={p} alt="" onClick={() => setLightboxSrc(p)}
                                className="w-24 h-24 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                            ))}
                            {rec.beforePhotos.length > 4 && (
                              <span className="text-xs text-gray-400 self-center">+{rec.beforePhotos.length - 4}</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-24 flex items-center justify-center rounded border border-red-200 bg-red-50">
                            <p className="text-xs font-medium text-red-500">No Photo</p>
                          </div>
                        )}
                      </div>
                      {/* After photos */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">หลัง PM</p>
                        {rec.afterPhotos?.length > 0 ? (
                          <div className="flex gap-1.5 flex-wrap">
                            {rec.afterPhotos.slice(0, 4).map((p, i) => (
                              <img key={i} src={p} alt="" onClick={() => setLightboxSrc(p)}
                                className="w-24 h-24 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                            ))}
                            {rec.afterPhotos.length > 4 && (
                              <span className="text-xs text-gray-400 self-center">+{rec.afterPhotos.length - 4}</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-24 flex items-center justify-center rounded border border-red-200 bg-red-50">
                            <p className="text-xs font-medium text-red-500">No Photo</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Signature Section */}
          <div className="mt-8 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-purple-50 px-4 py-2 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-600">ลายเซ็น / Signatures</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-gray-200 sm:divide-y-0 sm:divide-x">
              {/* Technician */}
              <div className="px-6 py-5 text-center">
                <p className="text-xs text-gray-400 mb-3">ลายเซ็นช่างเทคนิค / Technician</p>
                <div className="h-14 flex items-end justify-center mb-3">
                  {data.technicianSignature && (
                    <img src={data.technicianSignature} alt="Technician signature" className="h-12 object-contain" />
                  )}
                </div>
                <div className="border-b-2 border-gray-400 w-44 mx-auto mb-1" />
                <p className="text-sm font-medium text-gray-700 inline-block">
                  ({techName || '\u00A0'.repeat(20)})
                </p>
                <p className="text-gray-400 text-xs mt-1">{fmtDate(data.performedAt)}</p>
              </div>
              {/* Store Staff */}
              <div className="px-6 py-5 text-center">
                <p className="text-xs text-gray-400 mb-3">ลายเซ็นเจ้าหน้าที่สาขา / Store Staff</p>
                <div className="h-14 flex items-end justify-center mb-3">
                  {data.storeSignature && (
                    <img src={data.storeSignature} alt="Store signature" className="h-12 object-contain" />
                  )}
                </div>
                <div className="border-b-2 border-gray-400 w-44 mx-auto mb-1" />
                {data.storeSignerName ? (
                  <p className="text-sm font-medium text-gray-700 inline-block">({data.storeSignerName})</p>
                ) : (
                  <div className="w-44 mx-auto flex items-center text-sm font-medium text-gray-700">
                    <span>(</span><span className="flex-1" /><span>)</span>
                  </div>
                )}
                <p className="text-gray-400 text-xs mt-1">{fmtDate(data.storeSignedAt)}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? 'กำลังสร้าง PDF...' : 'Download PDF'}
            </button>
            <p className="text-xs text-gray-400">
              Created automated by {orgName ? `${orgName} Incident Management` : 'RIM System'}
            </p>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="photo" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  )
}
