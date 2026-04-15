'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, Download } from 'lucide-react'
import axios from 'axios'
import { generateInventoryListPDF, InventoryListData } from '@/utils/inventoryListPdf'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

interface EquipmentItem {
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
}

interface InventoryPublicData {
  id: number
  incidentId: string
  performedAt?: string
  technicianName?: string
  technicianSignature?: string
  storeSignature?: string
  storeSignerName?: string
  storeSignedAt?: string
  store: {
    storeCode: string
    name: string
    address?: string
    province?: string
  }
  equipmentRecords: EquipmentItem[]
  incident?: {
    ticketNumber: string
  }
}

export default function InventoryListPage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<InventoryPublicData | null>(null)
  const [orgLogo, setOrgLogo] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!token) return
    const base = API_URL.replace('/api', '')

    Promise.all([
      axios.get(`${base}/api/public/pm/report/${token}`),
      axios.get(`${base}/api/settings/organization`).catch(() => ({ data: null })),
    ]).then(([pmRes, orgRes]) => {
      const pm = pmRes.data
      // Map technician name
      const techName = pm.technician
        ? `${pm.technician.firstName} ${pm.technician.lastName}`
        : undefined
      setData({ ...pm, technicianName: techName })

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
      setError(e.response?.data?.message || 'ไม่พบเอกสาร หรือลิงก์ไม่ถูกต้อง')
    }).finally(() => setIsLoading(false))
  }, [token])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-xl p-8 text-center shadow max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error || 'ไม่พบเอกสาร'}</p>
      </div>
    </div>
  )

  const techName = data.technicianName

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const pdfData: InventoryListData = {
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
        equipment: data.equipmentRecords.map((rec, idx) => ({
          no: idx + 1,
          name: rec.equipment.name,
          category: rec.equipment.category,
          serialNumber: rec.updatedSerial || rec.equipment.serialNumber,
          brand: rec.updatedBrand || rec.equipment.brand,
          model: rec.updatedModel || rec.equipment.model,
          condition: rec.condition,
          comment: rec.comment,
          photo: rec.beforePhotos?.[0],
        })),
      }
      await generateInventoryListPDF(pdfData)
    } catch {
      alert('ดาวน์โหลด PDF ไม่สำเร็จ')
    } finally {
      setDownloading(false)
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (d?: string) => {
    if (!d) return ''
    const dt = new Date(d)
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`
  }
  const fmtDateTime = (d?: string) => {
    if (!d) return '-'
    const dt = new Date(d)
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl p-6 text-gray-800 print:shadow-none print:rounded-none">

        {/* Header */}
        <div className="flex items-end justify-between border-b-4 border-purple-600 pb-4 mb-6">
          <div className="flex items-end gap-3">
            {orgLogo && (
              <img src={orgLogo} alt="logo" className="h-12 object-contain shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-700 leading-tight">Inventory List</p>
              <p className="font-bold text-base text-gray-900 leading-tight">
                {data.store.storeCode} {data.store.name}
              </p>
              {data.store.address && (
                <p className="text-xs text-gray-400 mt-0.5">{data.store.address}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 self-end pb-0.5 ml-4">
            <p className="text-sm font-semibold text-gray-900">{data.incident?.ticketNumber || ''}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Last Update : {fmtDateTime(data.performedAt)}
            </p>
          </div>
        </div>

        {/* Equipment Table */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-purple-100">
              <th className="px-2 py-2 text-purple-800 text-center font-semibold border border-purple-200 w-6">#</th>
              <th className="px-2 py-2 text-purple-800 text-left font-semibold border border-purple-200">ชื่ออุปกรณ์</th>
              <th className="px-2 py-2 text-purple-800 text-left font-semibold border border-purple-200">Brand/Model</th>
              <th className="px-2 py-2 text-purple-800 text-left font-semibold border border-purple-200">Serial No.</th>
              <th className="px-2 py-2 text-purple-800 text-center font-semibold border border-purple-200">รูปอุปกรณ์</th>
              <th className="px-2 py-2 text-purple-800 text-center font-semibold border border-purple-200 w-16">Recheck</th>
            </tr>
          </thead>
          <tbody>
            {data.equipmentRecords.map((rec, idx) => {
              const eq = rec.equipment
              const brand = rec.updatedBrand || eq.brand
              const model = rec.updatedModel || eq.model
              const serial = rec.updatedSerial || eq.serialNumber
              const photo = rec.beforePhotos?.[0]
              return (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                  <td className="px-2 py-2 border border-gray-200 text-center text-gray-500 align-middle">{idx + 1}</td>
                  <td className="px-2 py-2 border border-gray-200 align-middle">
                    <div className="font-medium">{eq.name}</div>
                    <div className="text-gray-400 text-[10px]">{eq.category}</div>
                  </td>
                  <td className="px-2 py-2 border border-gray-200 text-gray-600 align-middle">
                    {[brand, model].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-2 py-2 border border-gray-200 text-gray-600 align-middle">{serial || '-'}</td>
                  <td className="px-1 py-1 border border-gray-200 text-center align-middle">
                    {photo ? (
                      <img src={photo} alt="" className="w-20 h-20 object-cover rounded border border-gray-200 mx-auto" />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center rounded border border-red-200 bg-red-50 mx-auto">
                        <p className="text-xs font-medium text-red-400">No Photo</p>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 border border-gray-200 align-middle" />
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Signature Section */}
        <div className="mt-8 border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-4 py-2 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600">ลายเซ็น / Signatures</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            {/* Technician */}
            <div className="px-6 py-5 text-center">
              <p className="text-xs text-gray-400 mb-3">ลายเซ็นช่างเทคนิค / Technician</p>
              <div className="h-14 flex items-end justify-center mb-3">
                {data.technicianSignature && (
                  <img src={data.technicianSignature} alt="Technician signature" className="h-12 object-contain" />
                )}
              </div>
              <div className="border-b-2 border-gray-400 w-44 mx-auto mb-1" />
              <p className="text-sm font-medium text-gray-700">({data.technicianName || '\u00A0'.repeat(20)})</p>
              <p className="text-gray-400 text-xs mt-1">{fmtDate(data.performedAt) || '\u00A0'}</p>
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
                <p className="text-sm font-medium text-gray-700">({data.storeSignerName})</p>
              ) : (
                <div className="w-44 mx-auto flex items-center text-sm font-medium text-gray-700">
                  <span>(</span><span className="flex-1" /><span>)</span>
                </div>
              )}
              <p className="text-gray-400 text-xs mt-1">{fmtDate(data.storeSignedAt) || '\u00A0'}</p>
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
  )
}
