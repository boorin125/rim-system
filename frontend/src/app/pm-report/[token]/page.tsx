'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, Wrench, ClipboardList, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import axios from 'axios'

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

interface PmReportData {
  id: number
  incidentId: string
  performedAt?: string
  store: {
    storeCode: string
    name: string
    province?: string
    address?: string
  }
  technician?: {
    firstName: string
    lastName: string
  }
  equipmentRecords: EquipmentRecord[]
  incident?: {
    ticketNumber: string
    title: string
    resolutionNote?: string
    resolvedAt?: string
  }
}

const conditionLabel: Record<string, string> = {
  GOOD: 'ปกติ',
  NEEDS_REPAIR: 'ต้องซ่อม',
  REPLACED: 'เปลี่ยนใหม่',
}
const conditionColor: Record<string, string> = {
  GOOD: 'text-green-700 bg-green-100 border-green-300',
  NEEDS_REPAIR: 'text-yellow-700 bg-yellow-100 border-yellow-300',
  REPLACED: 'text-red-700 bg-red-100 border-red-300',
}

function formatDate(d?: string) {
  if (!d) return '-'
  const dt = new Date(d)
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
}

export default function PmReportPage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<PmReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    axios.get(`${API_URL.replace('/api', '')}/api/public/pm/report/${token}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'ไม่พบรายงาน หรือลิงก์ไม่ถูกต้อง'))
      .finally(() => setIsLoading(false))
  }, [token])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl p-8 text-center shadow border border-red-100 max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error || 'ไม่พบรายงาน'}</p>
      </div>
    </div>
  )

  const store = data.store
  const storeDisplay = `${store.storeCode} ${store.name}`
  const techName = data.technician ? `${data.technician.firstName} ${data.technician.lastName}` : '-'
  const goodCount = data.equipmentRecords.filter(r => r.condition === 'GOOD').length
  const repairCount = data.equipmentRecords.filter(r => r.condition === 'NEEDS_REPAIR').length
  const replacedCount = data.equipmentRecords.filter(r => r.condition === 'REPLACED').length

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-6 print:shadow-none print:border-0">
          <div className="bg-blue-700 text-white px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Wrench className="w-6 h-6" />
              <h1 className="text-xl font-bold">Preventive Maintenance Report</h1>
            </div>
            <p className="text-blue-200 text-sm">{data.incident?.ticketNumber || ''} · {storeDisplay}</p>
          </div>

          {/* Details table */}
          <div className="p-6">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Ticket No.', data.incident?.ticketNumber || '-'],
                  ['Title', data.incident?.title || '-'],
                  ['Store', storeDisplay],
                  ['Technician', techName],
                  ['PM Date', formatDate(data.performedAt)],
                  ['Resolved At', formatDate(data.incident?.resolvedAt)],
                  ['Equipment Checked', `${data.equipmentRecords.length} รายการ`],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 font-semibold text-gray-500 w-40">{label}</td>
                    <td className="py-2 text-gray-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary badges */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-6 flex flex-wrap gap-2 items-center print:shadow-none">
          <span className="text-sm font-semibold text-gray-500">สรุป:</span>
          {goodCount > 0 && (
            <span className="flex items-center gap-1 bg-green-100 text-green-700 border border-green-300 px-3 py-1 rounded-full text-sm font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ {goodCount} รายการ
            </span>
          )}
          {repairCount > 0 && (
            <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 border border-yellow-300 px-3 py-1 rounded-full text-sm font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> ต้องซ่อม {repairCount} รายการ
            </span>
          )}
          {replacedCount > 0 && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 border border-red-300 px-3 py-1 rounded-full text-sm font-semibold">
              <RefreshCw className="w-3.5 h-3.5" /> เปลี่ยนใหม่ {replacedCount} รายการ
            </span>
          )}
        </div>

        {/* Equipment records */}
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-6 print:shadow-none">
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-700" />
            <h2 className="font-semibold text-blue-700 text-sm">Equipment Records</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {data.equipmentRecords.map((rec, idx) => {
              const eq = rec.equipment
              const brand = rec.updatedBrand || eq.brand || '-'
              const model = rec.updatedModel || eq.model || '-'
              const serial = rec.updatedSerial || eq.serialNumber || '-'
              const cond = rec.condition || 'GOOD'

              return (
                <div key={idx} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-xs text-gray-400 mr-2">#{idx + 1}</span>
                      <span className="font-semibold text-gray-800">{eq.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{eq.category}</span>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${conditionColor[cond] || 'text-gray-600 bg-gray-100 border-gray-300'}`}>
                      {conditionLabel[cond] || cond}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mb-2">
                    {brand} {model !== '-' ? model : ''} · S/N: {serial}
                  </div>

                  {rec.comment && (
                    <div className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-1.5 mb-2">
                      หมายเหตุ: {rec.comment}
                    </div>
                  )}

                  {/* After Photos */}
                  {rec.afterPhotos?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">After Photos ({rec.afterPhotos.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rec.afterPhotos.map((src, pi) => (
                          <img
                            key={pi}
                            src={src}
                            alt={`after-${pi}`}
                            onClick={() => setLightboxSrc(src)}
                            className="w-16 h-16 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Resolution note */}
        {data.incident?.resolutionNote && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-5 mb-6 print:shadow-none">
            <p className="text-sm font-semibold text-gray-500 mb-1">Resolution Note</p>
            <p className="text-gray-800 text-sm">{data.incident.resolutionNote}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-6">
          Powered by RIM - Rubjobb Incident Management
        </p>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="photo" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  )
}
