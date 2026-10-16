'use client'

// "ดู Inventory" on the Store page — Inventory List of the store's latest CLOSED PM job
import { useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ClipboardList, Info } from 'lucide-react'
import { InventoryListModal } from '@/components/PmDocumentModal'
import { generateInventoryListPDF, InventoryListData } from '@/utils/inventoryListPdf'
import { getPhotoUrl } from '@/utils/photoUtils'

const toDataUrl = async (url: string): Promise<string | undefined> => {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export default function StoreInventoryButton({ storeId }: { storeId: number }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InventoryListData | null>(null)
  const [noPm, setNoPm] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleOpen = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const [pmRes, orgRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/pm/store/${storeId}/latest-inventory`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/settings/organization`, { headers }).catch(() => ({ data: null })),
      ])
      const pm = pmRes.data
      if (!pm || !pm.id) {
        setNoPm(true)
        return
      }

      const base = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')
      const tech = pm.technician
      const [orgLogo, techSignature] = await Promise.all([
        orgRes.data?.logoPath ? toDataUrl(`${base}${orgRes.data.logoPath}`) : Promise.resolve(undefined),
        tech?.signaturePath ? toDataUrl(getPhotoUrl(tech.signaturePath)) : Promise.resolve(undefined),
      ])
      let themeColor: string | undefined
      try {
        themeColor = JSON.parse(localStorage.getItem('themeStyle') || '{}').bgStart
      } catch {}

      setData({
        ticketNumber: pm.incident?.ticketNumber || '',
        store: pm.store,
        performedAt: pm.performedAt,
        organizationLogo: orgLogo,
        organizationName: orgRes.data?.organizationName,
        themeColor,
        technicianName: tech ? `${tech.firstName ?? ''} ${tech.lastName ?? ''}`.trim() : undefined,
        technicianSignature: techSignature,
        storeSignature: pm.storeSignature,
        storeSignerName: pm.storeSignerName,
        storeSignedAt: pm.storeSignedAt,
        equipment: [...pm.equipmentRecords]
          .sort((a: any, b: any) => (a.equipment.name || '').localeCompare(b.equipment.name || '', 'th'))
          .map((r: any, idx: number) => ({
            no: idx + 1,
            name: r.equipment.name,
            category: r.equipment.category,
            serialNumber: r.updatedSerial || r.equipment.serialNumber,
            brand: r.updatedBrand || r.equipment.brand,
            model: r.updatedModel || r.equipment.model,
            condition: r.condition ?? undefined,
            comment: r.comment ?? undefined,
            photo: r.afterPhotos?.[0] ?? r.beforePhotos?.[0],
          })),
      })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'โหลด Inventory ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!data) return
    try {
      setDownloading(true)
      await generateInventoryListPDF(data)
    } catch {
      toast.error('ดาวน์โหลด PDF ไม่สำเร็จ')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin" />
        ) : (
          <ClipboardList className="w-4 h-4" />
        )}
        ดู Inventory
      </button>

      {data && typeof document !== 'undefined' && createPortal(
        // z-[9999] wrapper keeps the document above the dashboard header
        <div className="relative z-[9999]">
          <InventoryListModal
            data={data}
            saving={downloading}
            onClose={() => setData(null)}
            onSavePdf={handleDownload}
          />
        </div>,
        document.body,
      )}

      {/* No closed PM yet — themed notice (portal: parent cards use backdrop-filter) */}
      {noPm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setNoPm(false)}>
          <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Info className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">ดู Inventory</h3>
                <p className="text-sm text-gray-400">Inventory จากงาน PM ล่าสุดที่ปิดงานแล้ว</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6">ร้านยังไม่มีประวัติการทำ PM</p>
            <div className="flex justify-end">
              <button
                onClick={() => setNoPm(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
