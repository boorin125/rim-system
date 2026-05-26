'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Package, ArrowRightLeft, Cpu, Camera, Search, AlertCircle, Check } from 'lucide-react'
import axios from 'axios'
import BarcodeScannerModal from './BarcodeScannerModal'
import { SparePart } from './SparePartForm'

interface DeviceSuggestion {
  id: number
  name: string
  position?: string
  serialNumber: string
  model?: string
  brand?: string
  category?: string
  status?: string
  storeName?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdd: (part: SparePart) => void
  storeId?: number
  incidentEquipmentIds?: number[]
}

function makeEmptyPart(): SparePart {
  return {
    id: `spare-${Date.now()}`,
    repairType: 'EQUIPMENT_REPLACEMENT',
    oldDeviceName: '',
    oldSerialNo: '',
    newDeviceName: '',
    newSerialNo: '',
    newBrand: '',
    newModel: '',
    replacementType: '' as any,
    componentName: '',
    oldComponentSerial: '',
    newComponentSerial: '',
    parentEquipmentName: '',
    notes: '',
  }
}

export default function SparePartEntryModal({ isOpen, onClose, onAdd, storeId, incidentEquipmentIds }: Props) {
  const [part, setPart] = useState<SparePart>(makeEmptyPart)
  const [scanningFor, setScanningFor] = useState<'oldSerialNo' | 'newSerialNo' | 'oldComponentSerial' | 'newComponentSerial' | null>(null)
  const [storeEquipment, setStoreEquipment] = useState<DeviceSuggestion[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState<DeviceSuggestion[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([])
  const [showBrandDropdown, setShowBrandDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showParentDropdown, setShowParentDropdown] = useState(false)
  const brandRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  // Reset part when modal opens
  useEffect(() => {
    if (isOpen) {
      setPart(makeEmptyPart())
      setScanningFor(null)
      setShowBrandDropdown(false)
      setShowModelDropdown(false)
      setShowParentDropdown(false)
    }
  }, [isOpen])

  // Fetch store equipment
  useEffect(() => {
    if (!storeId || !isOpen) return
    const fetch = async () => {
      setLoadingEquipment(true)
      try {
        const token = localStorage.getItem('token')
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
          params: { storeId, status: 'ACTIVE', limit: 200 },
          headers: { Authorization: `Bearer ${token}` },
        })
        const list: DeviceSuggestion[] = (res.data?.data || []).map((d: any) => ({
          id: d.id, name: d.name, position: d.position,
          serialNumber: d.serialNumber, model: d.model, brand: d.brand,
          category: d.category, status: d.status,
          storeName: d.store?.name || d.store?.storeCode,
        }))
        setStoreEquipment(list)
        const filtered = incidentEquipmentIds?.length
          ? list.filter(d => incidentEquipmentIds.includes(d.id))
          : list
        setFilteredEquipment(filtered)
      } catch { /* ignore */ }
      finally { setLoadingEquipment(false) }
    }
    fetch()
  }, [storeId, isOpen])

  // Auto-fill when only 1 device
  useEffect(() => {
    if (filteredEquipment.length !== 1) return
    const d = filteredEquipment[0]
    const displayName = [d.position, d.brand, d.model].filter(Boolean).join(' ') || d.name
    if (part.repairType === 'EQUIPMENT_REPLACEMENT' && !part.selectedDeviceId) {
      setPart(p => ({ ...p, selectedDeviceId: d.id, oldDeviceName: displayName, oldSerialNo: d.serialNumber || '', oldEquipmentId: d.id, newDeviceName: p.newDeviceName || d.name }))
    } else if (part.repairType === 'COMPONENT_REPLACEMENT' && !part.parentEquipmentId) {
      setPart(p => ({ ...p, parentEquipmentName: displayName, parentEquipmentId: d.id }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEquipment, part.repairType])

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setShowBrandDropdown(false)
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelDropdown(false)
      if (parentRef.current && !parentRef.current.contains(e.target as Node)) setShowParentDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const up = (field: keyof SparePart, value: string) => setPart(p => ({ ...p, [field]: value }))

  const selectOldDevice = (d: DeviceSuggestion) => {
    const parts: string[] = []
    if (d.position) parts.push(d.position)
    if (d.brand) parts.push(d.brand)
    if (d.model) parts.push(d.model)
    if (parts.length === 0) parts.push(d.name)
    setPart(p => ({ ...p, selectedDeviceId: d.id, oldDeviceName: parts.join(' '), oldSerialNo: d.serialNumber || '', oldEquipmentId: d.id, newDeviceName: p.newDeviceName || d.name }))
  }

  const fetchBrands = async (query: string) => {
    try {
      const token = localStorage.getItem('token')
      const category = storeEquipment.find(d => d.id === part.selectedDeviceId)?.category
      const params: any = { limit: 500 }
      if (category) params.category = category
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, { params, headers: { Authorization: `Bearer ${token}` } })
      const all = [...new Set<string>((res.data?.data || []).map((e: any) => e.brand).filter(Boolean))].sort()
      setBrandSuggestions(query ? all.filter(b => b.toLowerCase().includes(query.toLowerCase())) : all)
      setShowBrandDropdown(true)
    } catch { setShowBrandDropdown(false) }
  }

  const fetchModels = async (query: string, brand: string) => {
    if (!brand && !query) { setShowModelDropdown(false); return }
    try {
      const token = localStorage.getItem('token')
      const category = storeEquipment.find(d => d.id === part.selectedDeviceId)?.category
      const params: any = { limit: 300 }
      if (category) params.category = category
      if (brand) params.brand = brand
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, { params, headers: { Authorization: `Bearer ${token}` } })
      const all = [...new Set<string>((res.data?.data || []).map((e: any) => e.model).filter(Boolean))].sort()
      setModelSuggestions(query ? all.filter(m => m.toLowerCase().includes(query.toLowerCase())) : all)
      setShowModelDropdown(true)
    } catch { setShowModelDropdown(false) }
  }

  const handleConfirm = () => {
    onAdd({ ...part, id: `spare-${Date.now()}` })
    onClose()
  }

  if (!isOpen || typeof document === 'undefined') return null

  // Resolved old device (from DB)
  const resolvedOldDev = part.oldEquipmentId
    ? storeEquipment.find(d => d.id === part.oldEquipmentId)
    : filteredEquipment.length === 1 ? filteredEquipment[0] : null

  return createPortal(
    <div className="fixed inset-0 z-[10001] bg-black/70 flex items-end sm:items-center justify-center sm:p-4">
      <div className="glass-card rounded-t-2xl sm:rounded-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh]">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">เพิ่ม Spare Part</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Repair Type */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
            <label className="block text-sm font-semibold text-gray-200 mb-3">
              ประเภทการซ่อม <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${part.repairType === 'EQUIPMENT_REPLACEMENT' ? 'border-blue-500 bg-blue-900/30' : 'border-slate-600/50 hover:bg-slate-700/30'}`}>
                <input type="radio" name="repairType" value="EQUIPMENT_REPLACEMENT" checked={part.repairType === 'EQUIPMENT_REPLACEMENT'}
                  onChange={e => setPart(p => ({ ...p, repairType: e.target.value as any, parentEquipmentId: undefined, parentEquipmentName: '' }))}
                  className="sr-only" />
                <ArrowRightLeft className={`w-5 h-5 ${part.repairType === 'EQUIPMENT_REPLACEMENT' ? 'text-blue-400' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-white">เปลี่ยนอุปกรณ์</p>
                  <p className="text-xs text-gray-400">เปลี่ยนอุปกรณ์ทั้งตัว</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${part.repairType === 'COMPONENT_REPLACEMENT' ? 'border-purple-500 bg-purple-900/30' : 'border-slate-600/50 hover:bg-slate-700/30'}`}>
                <input type="radio" name="repairType" value="COMPONENT_REPLACEMENT" checked={part.repairType === 'COMPONENT_REPLACEMENT'}
                  onChange={e => setPart(p => ({ ...p, repairType: e.target.value as any, selectedDeviceId: undefined, oldEquipmentId: undefined, newEquipmentId: undefined }))}
                  className="sr-only" />
                <Cpu className={`w-5 h-5 ${part.repairType === 'COMPONENT_REPLACEMENT' ? 'text-purple-400' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-white">เปลี่ยนชิ้นส่วน</p>
                  <p className="text-xs text-gray-400">เปลี่ยนชิ้นส่วนภายใน</p>
                </div>
              </label>
            </div>
          </div>

          {/* ── COMPONENT REPLACEMENT ── */}
          {part.repairType === 'COMPONENT_REPLACEMENT' && (
            <>
              {/* Parent Equipment */}
              <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />อุปกรณ์หลัก (Parent Equipment)
                </h5>
                {filteredEquipment.length === 1 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/30 border border-purple-600/40 rounded-lg">
                    <Package className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {part.parentEquipmentName || [filteredEquipment[0].position, filteredEquipment[0].brand, filteredEquipment[0].model].filter(Boolean).join(' ') || filteredEquipment[0].name}
                      </p>
                      <p className="text-xs text-purple-400 font-mono">S/N: {filteredEquipment[0].serialNumber}</p>
                    </div>
                    <span className="text-xs text-purple-400 shrink-0">Auto</span>
                  </div>
                ) : (
                  <div className="relative" ref={parentRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={part.parentEquipmentName || ''}
                        onChange={e => { setPart(p => ({ ...p, parentEquipmentName: e.target.value, parentEquipmentId: undefined })); setShowParentDropdown(true) }}
                        onFocus={() => setShowParentDropdown(true)}
                        placeholder="พิมพ์เพื่อค้นหาอุปกรณ์..."
                        className="w-full px-3 py-2 pr-8 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    {showParentDropdown && (() => {
                      const q = (part.parentEquipmentName || '').toLowerCase()
                      const filtered = filteredEquipment.filter(d =>
                        !q || d.name.toLowerCase().includes(q) || (d.brand || '').toLowerCase().includes(q) ||
                        (d.model || '').toLowerCase().includes(q) || (d.position || '').toLowerCase().includes(q)
                      )
                      return filtered.length > 0 ? (
                        <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {filtered.map(d => (
                            <button key={d.id} type="button"
                              onClick={() => {
                                const name = [d.position, d.brand, d.model].filter(Boolean).join(' ') || d.name
                                setPart(p => ({ ...p, parentEquipmentName: name, parentEquipmentId: d.id }))
                                setShowParentDropdown(false)
                              }}
                              className="w-full px-3 py-2.5 text-left hover:bg-slate-600 transition-colors border-b border-slate-600/50 last:border-0">
                              <p className="text-sm text-white font-medium">{d.name}{d.brand || d.model ? ` — ${[d.brand, d.model].filter(Boolean).join(' ')}` : ''}</p>
                              <p className="text-xs text-purple-400 font-mono">S/N: {d.serialNumber}</p>
                            </button>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>

              {/* Component Details */}
              <div className="bg-cyan-900/20 border border-cyan-700/50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />ชิ้นส่วนที่เปลี่ยน
                </h5>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-200 mb-1">ชื่อชิ้นส่วน <span className="text-red-400">*</span></label>
                    <input type="text" value={part.componentName || ''} onChange={e => up('componentName', e.target.value)}
                      placeholder="e.g., Battery, Power Supply, Hard Drive"
                      className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-200 mb-1">Serial เดิม <span className="text-red-400">*</span></label>
                      <div className="flex gap-2">
                        <input type="text" value={part.oldComponentSerial || ''} onChange={e => up('oldComponentSerial', e.target.value)}
                          placeholder="Serial ชิ้นส่วนเดิม"
                          className="flex-1 px-3 py-2 text-sm bg-red-900/20 border border-red-700/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                        <button type="button" onClick={() => setScanningFor('oldComponentSerial')}
                          className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors flex items-center justify-center">
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-200 mb-1">Serial ใหม่ <span className="text-red-400">*</span></label>
                      <div className="flex gap-2">
                        <input type="text" value={part.newComponentSerial || ''} onChange={e => up('newComponentSerial', e.target.value)}
                          placeholder="Serial ชิ้นส่วนใหม่"
                          className="flex-1 px-3 py-2 text-sm bg-green-900/20 border border-green-700/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                        <button type="button" onClick={() => setScanningFor('newComponentSerial')}
                          className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors flex items-center justify-center">
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── EQUIPMENT REPLACEMENT ── */}
          {part.repairType === 'EQUIPMENT_REPLACEMENT' && (
            <>
              {/* Device Selector */}
              {storeId && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                  <h5 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />เลือก Device ที่ต้องการเปลี่ยน
                  </h5>
                  {loadingEquipment ? (
                    <p className="text-xs text-yellow-300">กำลังโหลดข้อมูล...</p>
                  ) : filteredEquipment.length === 0 ? (
                    <p className="text-xs text-gray-400">ไม่พบ Equipment ในสาขานี้ — กรอกข้อมูลเองได้</p>
                  ) : filteredEquipment.length === 1 ? (
                    <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-600/40 rounded-lg">
                      <Package className="w-4 h-4 text-yellow-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {filteredEquipment[0].name}{filteredEquipment[0].brand || filteredEquipment[0].model ? ` — ${[filteredEquipment[0].brand, filteredEquipment[0].model].filter(Boolean).join(' ')}` : ''}
                        </p>
                        {filteredEquipment[0].serialNumber && <p className="text-xs text-yellow-300 font-mono">S/N: {filteredEquipment[0].serialNumber}</p>}
                      </div>
                    </div>
                  ) : (
                    <select value={part.selectedDeviceId || ''} onChange={e => {
                      const id = e.target.value ? Number(e.target.value) : undefined
                      if (!id) { setPart(p => ({ ...p, selectedDeviceId: undefined, oldDeviceName: '', oldSerialNo: '', oldEquipmentId: undefined })); return }
                      const d = storeEquipment.find(x => x.id === id)
                      if (!d) return
                      const parts: string[] = []
                      if (d.position) parts.push(d.position)
                      if (d.brand) parts.push(d.brand)
                      if (d.model) parts.push(d.model)
                      if (parts.length === 0) parts.push(d.name)
                      setPart(p => ({ ...p, selectedDeviceId: d.id, oldDeviceName: parts.join(' '), oldSerialNo: d.serialNumber || '', oldEquipmentId: d.id, newDeviceName: p.newDeviceName || d.name }))
                    }}
                      className="w-full px-3 py-2.5 text-sm bg-slate-700/50 border border-slate-600/50 text-white rounded-lg focus:ring-2 focus:ring-yellow-500 [&>option]:bg-slate-800 [&>option]:text-white">
                      <option value="">-- เลือก Device --</option>
                      {filteredEquipment.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.brand || d.model ? ` — ${[d.brand, d.model].filter(Boolean).join(' ')}` : ''}{d.serialNumber ? ` (S/N: ${d.serialNumber})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Old Device */}
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />Old Device (Removed)
                </h5>
                {resolvedOldDev ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-200 mb-1">ชื่ออุปกรณ์</label>
                      <div className="px-3 py-2 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm text-gray-300">{resolvedOldDev.name}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-200 mb-1">Brand</label>
                        <div className="px-3 py-2.5 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm text-white">{resolvedOldDev.brand || '-'}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-200 mb-1">Model</label>
                        <div className="px-3 py-2.5 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm text-white">{resolvedOldDev.model || '-'}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-200 mb-1">Serial No.</label>
                        <input type="text" value={part.oldSerialNo} onChange={e => up('oldSerialNo', e.target.value)}
                          placeholder={resolvedOldDev.serialNumber || 'Serial No.'}
                          className="w-full px-3 py-2.5 bg-slate-800/60 border border-red-700/40 rounded-lg text-sm font-mono text-red-200 focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-200 mb-1">Brand / Model <span className="text-red-400">*</span></label>
                      <input type="text" value={part.oldDeviceName} onChange={e => up('oldDeviceName', e.target.value)}
                        placeholder="e.g., HP RP2 / Epson TM-T82"
                        className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-200 mb-1">Serial No. <span className="text-red-400">*</span></label>
                      <div className="flex gap-2">
                        <input type="text" value={part.oldSerialNo} onChange={e => up('oldSerialNo', e.target.value)}
                          placeholder="Scan or enter serial"
                          className="flex-1 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                        <button type="button" onClick={() => setScanningFor('oldSerialNo')}
                          className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors flex items-center justify-center">
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* New Device */}
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />New Device (Installed)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div ref={brandRef} className="relative">
                    <label className="block text-xs font-medium text-gray-200 mb-1">Brand <span className="text-red-400">*</span></label>
                    <input type="text" value={part.newBrand || ''} autoComplete="off"
                      onChange={e => { up('newBrand', e.target.value); fetchBrands(e.target.value) }}
                      onFocus={() => fetchBrands(part.newBrand || '')}
                      placeholder="e.g., HP, Dell"
                      className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    {showBrandDropdown && brandSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {brandSuggestions.map(b => (
                          <li key={b} onMouseDown={e => { e.preventDefault(); up('newBrand', b); setShowBrandDropdown(false); fetchModels('', b) }}
                            className="px-3 py-2 text-sm text-white hover:bg-slate-700 cursor-pointer">{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div ref={modelRef} className="relative">
                    <label className="block text-xs font-medium text-gray-200 mb-1">Model <span className="text-red-400">*</span></label>
                    <input type="text" value={part.newModel || ''} autoComplete="off"
                      onChange={e => { up('newModel', e.target.value); fetchModels(e.target.value, part.newBrand || '') }}
                      onFocus={() => fetchModels(part.newModel || '', part.newBrand || '')}
                      placeholder="e.g., EloPOS X10"
                      className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    {showModelDropdown && modelSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {modelSuggestions.map(m => (
                          <li key={m} onMouseDown={e => { e.preventDefault(); up('newModel', m); setShowModelDropdown(false) }}
                            className="px-3 py-2 text-sm text-white hover:bg-slate-700 cursor-pointer">{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-200 mb-1">Serial No. <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <input type="text" value={part.newSerialNo} onChange={e => up('newSerialNo', e.target.value)}
                        placeholder="Scan or enter serial"
                        className="flex-1 px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                      <button type="button" onClick={() => setScanningFor('newSerialNo')}
                        className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors flex items-center justify-center">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Replacement Type */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <label className="block text-sm font-semibold text-blue-300 mb-3">Replacement Type <span className="text-red-400">*</span></label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border-2 border-slate-600/50 rounded-lg cursor-pointer hover:bg-blue-900/30 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/40">
                    <input type="radio" name="replacementType" value="PERMANENT" checked={part.replacementType === 'PERMANENT'} onChange={e => up('replacementType', e.target.value)}
                      className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-white">Permanent — เปลี่ยนถาวร</p>
                      <p className="text-xs text-gray-400 mt-0.5">Old device removed from inventory.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border-2 border-slate-600/50 rounded-lg cursor-pointer hover:bg-orange-900/30 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-900/40">
                    <input type="radio" name="replacementType" value="TEMPORARY" checked={part.replacementType === 'TEMPORARY'} onChange={e => up('replacementType', e.target.value)}
                      className="mt-0.5 w-4 h-4 text-orange-600 focus:ring-orange-500" />
                    <div>
                      <p className="text-sm font-semibold text-white">Temporary — วางสแปร์ชั่วคราว</p>
                      <p className="text-xs text-gray-400 mt-0.5">Must be returned later.</p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">หมายเหตุ (Optional)</label>
            <textarea value={part.notes || ''} onChange={e => up('notes', e.target.value)}
              placeholder="ข้อมูลเพิ่มเติม..." rows={2}
              className="w-full px-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 px-4 py-3 border-t border-white/10 bg-slate-800/30">
          <button onClick={onClose}
            className="flex-1 py-3 text-sm border border-slate-600 text-gray-300 rounded-xl hover:border-slate-400 hover:text-white transition-colors">
            ยกเลิก
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-3 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />เพิ่ม Spare Part
          </button>
        </div>
      </div>

      {/* Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={!!scanningFor}
        label="สแกน Serial Number"
        onDetect={value => { if (scanningFor) up(scanningFor, value); setScanningFor(null) }}
        onClose={() => setScanningFor(null)}
      />
    </div>,
    document.body
  )
}
