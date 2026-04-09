'use client'

import { useRef, useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { PmReportData, generatePmReportPDF } from '@/utils/pmReportPdf'
import { InventoryListData, generateInventoryListPDF } from '@/utils/inventoryListPdf'

// ─── Shared helpers ──────────────────────────────────────────────────────────

const conditionLabel: Record<string, string> = {
  GOOD: 'ปกติ', NEEDS_REPAIR: 'ต้องซ่อม', REPLACED: 'เปลี่ยนใหม่',
}
const conditionStyle: Record<string, React.CSSProperties> = {
  GOOD:         { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' },
  NEEDS_REPAIR: { background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' },
  REPLACED:     { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
}

function ModalWrapper({
  title,
  onClose,
  onSavePdf,
  saving,
  children,
}: {
  title: string
  onClose: () => void
  onSavePdf: () => void
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex flex-col overflow-hidden"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-900/95 border-b border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white font-semibold text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSavePdf}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Save PDF
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Document — scrollable area; click backdrop (outside card) closes modal */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-3xl mx-auto p-3 sm:p-4 pb-8" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── PM Report Modal ─────────────────────────────────────────────────────────

export function PmReportModal({
  data,
  saving,
  onClose,
  onSavePdf,
}: {
  data: PmReportData
  saving: boolean
  onClose: () => void
  onSavePdf: () => void
}) {
  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '-'

  return (
    <ModalWrapper title="PM Report" onClose={onClose} onSavePdf={onSavePdf} saving={saving}>
      <div className="bg-white rounded-xl shadow-2xl p-6 text-gray-800 font-sans">
        {/* Header */}
        <div className="flex items-end justify-between border-b-2 border-purple-600 pb-4 mb-6">
          <div className="flex items-end gap-3">
            {data.organizationLogo && (
              <img src={data.organizationLogo} alt="logo" className="h-10 sm:h-16 object-contain shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm sm:text-lg text-gray-700 leading-tight">Preventive Maintenance Report</p>
              <p className="font-bold text-sm sm:text-base text-gray-900 leading-tight truncate">
                {data.store.storeCode} {data.store.name}
              </p>
              {data.store.address && (
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">{data.store.address}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 self-end pb-0.5 ml-2">
            <p className="text-xs sm:text-sm font-semibold text-gray-900">{data.ticketNumber}</p>
          </div>
        </div>

        {/* Equipment Records */}
        <div className="space-y-6">
          {data.equipmentRecords.map((rec, idx) => {
            const brand = rec.updatedBrand || rec.brand
            const model = rec.updatedModel || rec.model
            const serial = rec.updatedSerial || rec.serialNumber
            const brandModel = `${brand || '-'} ${model || '-'}`
            return (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Equipment header */}
              <div className="flex items-center justify-between bg-purple-50 px-4 py-2.5 gap-3">
                <div className="min-w-0">
                  <span className="font-semibold text-gray-900 text-sm">
                    {idx + 1}. {rec.name}
                    <span className="font-normal text-gray-600"> : {brandModel}</span>
                  </span>
                  {serial && (
                    <span className="text-xs text-gray-500 ml-2">S/N : {serial}</span>
                  )}
                </div>
                <div className="shrink-0">
                  {rec.condition && (
                    <span style={{ ...conditionStyle[rec.condition], padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                      {conditionLabel[rec.condition]}
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
                {/* Photos */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">ก่อน PM</p>
                    {rec.beforePhotos.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {rec.beforePhotos.slice(0, 4).map((p, i) => (
                          <img key={i} src={p} alt="" className="w-24 h-24 object-cover rounded border border-gray-200" />
                        ))}
                        {rec.beforePhotos.length > 4 && <span className="text-xs text-gray-400 self-center">+{rec.beforePhotos.length - 4}</span>}
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center rounded border border-red-200 bg-red-50">
                        <p className="text-xs font-medium text-red-500">No Photo</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">หลัง PM</p>
                    {rec.afterPhotos.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {rec.afterPhotos.slice(0, 4).map((p, i) => (
                          <img key={i} src={p} alt="" className="w-24 h-24 object-cover rounded border border-gray-200" />
                        ))}
                        {rec.afterPhotos.length > 4 && <span className="text-xs text-gray-400 self-center">+{rec.afterPhotos.length - 4}</span>}
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
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            {/* Technician */}
            <div className="p-5 text-center">
              <p className="text-xs text-gray-400 mb-4">ลายเซ็นช่างเทคนิค / Technician</p>
              <div className="h-16 flex items-end justify-center mb-3">
                {data.technicianSignature && (
                  <img src={data.technicianSignature} alt="Technician signature" className="h-14 object-contain" />
                )}
              </div>
              <div className="border-b-2 border-gray-400 w-40 mx-auto mb-1" />
              <p className="text-sm font-medium text-gray-700 inline-block">
                ({data.technicianName || '\u00A0'.repeat(20)})
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {data.performedAt
                  ? (() => { const d = new Date(data.performedAt); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}` })()
                  : '\u00A0'}
              </p>
            </div>
            {/* Store Staff */}
            <div className="p-5 text-center">
              <p className="text-xs text-gray-400 mb-4">ลายเซ็นเจ้าหน้าที่สาขา / Store Staff</p>
              <div className="h-16 flex items-end justify-center mb-3">
                {data.storeSignature && (
                  <img src={data.storeSignature} alt="Store signature" className="h-14 object-contain" />
                )}
              </div>
              <div className="border-b-2 border-gray-400 w-40 mx-auto mb-1" />
              <p className="text-sm font-medium text-gray-700 inline-block">
                ({data.storeSignerName || '\u00A0'.repeat(20)})
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {data.storeSignedAt
                  ? (() => { const d = new Date(data.storeSignedAt); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}` })()
                  : '\u00A0'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          Created automated by {data.organizationName || 'RIM System'}
        </div>
      </div>
    </ModalWrapper>
  )
}

// ─── Inventory List Modal ─────────────────────────────────────────────────────

// Natural render width of the Inventory List document (px)
const INVENTORY_NATURAL_WIDTH = 640

export function InventoryListModal({
  data,
  saving,
  onClose,
  onSavePdf,
}: {
  data: InventoryListData
  saving: boolean
  onClose: () => void
  onSavePdf: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const available = el.clientWidth
      setScale(available < INVENTORY_NATURAL_WIDTH ? available / INVENTORY_NATURAL_WIDTH : 1)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '-'

  const headerBg = data.themeColor || '#581c87'

  return (
    <ModalWrapper title="Inventory List" onClose={onClose} onSavePdf={onSavePdf} saving={saving}>
      {/* Outer wrapper — measures available width */}
      <div ref={wrapRef} className="w-full overflow-hidden">
        {/* Scalable document */}
        <div
          style={
            scale < 1
              ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%` }
              : undefined
          }
        >
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden text-gray-800 font-sans">
            {/* Colored header */}
            <div style={{ background: headerBg }} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {data.organizationLogo && (
                  <img src={data.organizationLogo} alt="logo" className="h-9 object-contain" />
                )}
                <div>
                  <p className="font-bold text-white text-sm">{data.organizationName || 'Inventory List'}</p>
                  <p className="text-white/70 text-xs">Preventive Maintenance — Inventory List</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-semibold text-sm">{data.ticketNumber}</p>
                <p className="text-white/70 text-xs mt-0.5">{dateStr}</p>
              </div>
            </div>

            <div className="px-4 py-4">
              {/* Store info */}
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium text-gray-700">{data.store.storeCode} {data.store.name}</span>
                {data.store.address && <span className="ml-2 text-gray-400">{data.store.address}</span>}
              </p>

              {/* Table */}
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr style={{ background: headerBg }}>
                    <th className="px-2 py-1.5 text-white text-center font-semibold border border-white/20 w-6">#</th>
                    <th className="px-2 py-1.5 text-white text-left font-semibold border border-white/20">ชื่ออุปกรณ์</th>
                    <th className="px-2 py-1.5 text-white text-left font-semibold border border-white/20">Brand/Model</th>
                    <th className="px-2 py-1.5 text-white text-left font-semibold border border-white/20">Serial No.</th>
                    <th className="px-2 py-1.5 text-white text-center font-semibold border border-white/20">รูป</th>
                    <th className="px-2 py-1.5 text-white text-center font-semibold border border-white/20">Status</th>
                    <th className="px-2 py-1.5 text-white text-left font-semibold border border-white/20">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.equipment.map((eq, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">{eq.no}</td>
                      <td className="px-2 py-1.5 border border-gray-200 font-medium">
                        <div>{eq.name}</div>
                        <div className="text-gray-400 text-[10px]">{eq.category}</div>
                      </td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">
                        {[eq.brand, eq.model].filter(Boolean).join(' / ') || '-'}
                      </td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">{eq.serialNumber || '-'}</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center">
                        {eq.photo ? (
                          <img src={eq.photo} alt="" className="w-10 h-10 object-cover rounded border border-gray-200 mx-auto" />
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center">
                        {eq.condition ? (
                          <span style={{ ...conditionStyle[eq.condition], padding: '2px 6px', borderRadius: 99, fontSize: 9, fontWeight: 600 }}>
                            {conditionLabel[eq.condition]}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-500">{eq.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signature area */}
              <div className="mt-8 grid grid-cols-2 gap-10">
                <div className="text-center">
                  <div className="border-b border-gray-300 mb-1 h-10" />
                  <p className="text-xs text-gray-500">ลายเซ็นช่างเทคนิค</p>
                </div>
                <div className="text-center">
                  <div className="border-b border-gray-300 mb-1 h-10" />
                  <p className="text-xs text-gray-500">ลายเซ็นผู้รับเอกสาร</p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-200 text-[10px] text-gray-400 text-center">
                สร้างโดยระบบ RIM — {new Date().toLocaleDateString('th-TH')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  )
}
