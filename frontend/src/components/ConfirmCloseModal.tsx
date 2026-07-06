// frontend/src/components/ConfirmCloseModal.tsx

import { useState } from 'react';
import { X, CheckCircle, AlertCircle, Clock, User, FileText, Image, ExternalLink, Pen, ArrowRightLeft, Cpu, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getPhotoUrl } from '@/utils/photoUtils';
import PhotoViewerModal from './PhotoViewerModal';

interface SparePart {
  repairType?: string;
  deviceName?: string;
  equipmentName?: string;
  oldBrandModel?: string;
  newBrandModel?: string;
  oldSerialNo?: string;
  newSerialNo?: string;
  parentEquipmentName?: string;
  componentName?: string;
  oldComponentSerial?: string;
  newComponentSerial?: string;
  oldDeviceName?: string;
  newDeviceName?: string;
  _isNew?: boolean; // UI only — true = added by Helpdesk in edit mode (old fields editable)
}

interface ConfirmCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: {
    id: string;
    title: string;
    ticketNumber: string;
    technician?: { name: string; email: string };
    resolutionNote: string;
    usedSpareParts: boolean;
    spareParts?: SparePart[];
    beforePhotos?: string[];
    afterPhotos?: string[];
    signedReportPhotos?: string[];
    serviceReportToken?: string;
    customerSignedAt?: string;
    resolvedAt?: string;
  };
  onConfirm: (sparePartsUpdate?: { usedSpareParts: boolean; spareParts: SparePart[] }) => Promise<void>;
}

const emptyEquipmentPart = (): SparePart => ({
  repairType: 'EQUIPMENT_REPLACEMENT',
  oldBrandModel: '',
  oldSerialNo: '',
  newBrandModel: '',
  newSerialNo: '',
  _isNew: true,
})

const emptyComponentPart = (): SparePart => ({
  repairType: 'COMPONENT_REPLACEMENT',
  parentEquipmentName: '',
  componentName: '',
  oldComponentSerial: '',
  newComponentSerial: '',
  _isNew: true,
})

export default function ConfirmCloseModal({ isOpen, onClose, incident, onConfirm }: ConfirmCloseModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  // Photo viewer
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [photoViewerTitle, setPhotoViewerTitle] = useState('');

  // Spare parts editing
  const [editingSpareParts, setEditingSpareParts] = useState(false);
  const [usedSpareParts, setUsedSpareParts] = useState(incident.usedSpareParts);
  const [spareParts, setSpareParts] = useState<SparePart[]>(
    incident.spareParts?.map(p => ({ ...p })) ?? []
  );

  const openPhotoViewer = (photos: string[], index: number, title: string) => {
    setPhotoViewerPhotos(photos);
    setPhotoViewerIndex(index);
    setPhotoViewerTitle(title);
    setShowPhotoViewer(true);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError('');
    try {
      let sparePartsUpdate: { usedSpareParts: boolean; spareParts: SparePart[] } | undefined;
      if (editingSpareParts) {
        // Strip DB-only fields and map display fields to DTO fields
        const cleanParts: SparePart[] = spareParts.map(p => {
          if (p.repairType === 'COMPONENT_REPLACEMENT') {
            return {
              repairType: p.repairType,
              componentName: p.componentName,
              oldComponentSerial: p.oldComponentSerial,
              newComponentSerial: p.newComponentSerial,
            };
          }
          return {
            repairType: p.repairType || 'EQUIPMENT_REPLACEMENT',
            oldDeviceName: p.oldBrandModel || p.oldDeviceName || p.deviceName || p.equipmentName,
            oldSerialNo: p.oldSerialNo,
            newDeviceName: p.newBrandModel || p.newDeviceName,
            newSerialNo: p.newSerialNo,
          };
        });
        sparePartsUpdate = { usedSpareParts, spareParts: cleanParts };
      }
      await onConfirm(sparePartsUpdate);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm closure');
    } finally {
      setIsConfirming(false);
    }
  };

  const updatePart = (index: number, field: keyof SparePart, value: string) => {
    setSpareParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePart = (index: number) => {
    setSpareParts(prev => prev.filter((_, i) => i !== index));
  };

  const switchType = (index: number, newType: 'EQUIPMENT_REPLACEMENT' | 'COMPONENT_REPLACEMENT') => {
    setSpareParts(prev => prev.map((p, i) => {
      if (i !== index) return p;
      if (newType === 'COMPONENT_REPLACEMENT') {
        return { repairType: 'COMPONENT_REPLACEMENT', _isNew: p._isNew, parentEquipmentName: '', componentName: '', oldComponentSerial: '', newComponentSerial: '' };
      }
      return { repairType: 'EQUIPMENT_REPLACEMENT', _isNew: p._isNew, oldBrandModel: p._isNew ? '' : (p.oldBrandModel || p.equipmentName || ''), oldSerialNo: p._isNew ? '' : (p.oldSerialNo || ''), newBrandModel: '', newSerialNo: '' };
    }));
  };

  if (!isOpen) return null;

  const equipmentParts = spareParts.filter(p => p.repairType === 'EQUIPMENT_REPLACEMENT' || !p.repairType);
  const componentParts = spareParts.filter(p => p.repairType === 'COMPONENT_REPLACEMENT');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[200] p-3 sm:p-4 pt-16 sm:pt-20 overflow-y-auto">
      <div className="glass-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-80px)] sm:max-h-[calc(100vh-96px)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/30 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Confirm Incident Closure</h2>
            <p className="text-xs text-gray-400 mt-0.5">Review resolution and confirm to close incident</p>
          </div>
          <button onClick={onClose} disabled={isConfirming} className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Incident Info */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-300 mb-3">Incident Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-400 font-medium mb-1">Ticket Number</p>
                <p className="text-white font-mono">{incident.ticketNumber}</p>
              </div>
              <div>
                <p className="text-blue-400 font-medium mb-1">Title</p>
                <p className="text-white">{incident.title}</p>
              </div>
            </div>
          </div>

          {/* Technician Info */}
          {incident.technician && (
            <div className="flex items-start gap-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
              <User className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-200">Resolved by</p>
                <p className="text-sm text-white mt-1">{incident.technician.name}</p>
                <p className="text-xs text-gray-400">{incident.technician.email}</p>
              </div>
            </div>
          )}

          {/* Resolution Note */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-white">Resolution Note</h3>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{incident.resolutionNote}</p>
            </div>
          </div>

          {/* Spare Parts Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Spare Parts Used</h3>
              <button
                onClick={() => {
                  if (!editingSpareParts) {
                    // Initialise editable copy from current incident data
                    setUsedSpareParts(incident.usedSpareParts);
                    setSpareParts(incident.spareParts?.map(p => ({ ...p })) ?? []);
                  }
                  setEditingSpareParts(v => !v);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
              >
                {editingSpareParts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {editingSpareParts ? 'ยุบ' : 'แก้ไข Spare Parts'}
              </button>
            </div>

            {editingSpareParts ? (
              /* ── Edit Mode ── */
              <div className="space-y-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                {/* usedSpareParts toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">มีการใช้ Spare Parts</span>
                  <button
                    onClick={() => { setUsedSpareParts(v => !v); if (usedSpareParts) setSpareParts([]); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usedSpareParts ? 'bg-amber-500' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usedSpareParts ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {usedSpareParts && (
                  <>
                    {/* Flat list of all parts — each row has type toggle */}
                    <div className="space-y-2">
                      {spareParts.map((part, idx) => {
                        const isEquip = part.repairType === 'EQUIPMENT_REPLACEMENT' || !part.repairType;
                        const isNew = !!part._isNew;
                        return (
                          <div key={idx} className={`p-3 rounded-lg border ${isEquip ? 'bg-slate-800/40 border-green-700/20' : 'bg-slate-800/40 border-purple-700/20'}`}>
                            {/* Row header: type toggle + delete */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
                                <button onClick={() => switchType(idx, 'EQUIPMENT_REPLACEMENT')}
                                  className={`px-2.5 py-1 flex items-center gap-1 transition ${isEquip ? 'bg-green-500/20 text-green-300' : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'}`}>
                                  <ArrowRightLeft className="w-3 h-3" /> อุปกรณ์
                                </button>
                                <button onClick={() => switchType(idx, 'COMPONENT_REPLACEMENT')}
                                  className={`px-2.5 py-1 flex items-center gap-1 transition ${!isEquip ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'}`}>
                                  <Cpu className="w-3 h-3" /> ชิ้นส่วน
                                </button>
                              </div>
                              <button onClick={() => removePart(idx)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Fields based on type */}
                            {isEquip ? (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <input
                                    value={part.oldBrandModel || part.oldDeviceName || part.equipmentName || ''}
                                    onChange={isNew ? e => updatePart(idx, 'oldBrandModel', e.target.value) : undefined}
                                    readOnly={!isNew}
                                    placeholder="Brand/Model เดิม"
                                    className={`w-full px-2 py-1.5 text-xs border rounded-lg placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-transparent ${!isNew ? 'bg-slate-800/50 border-slate-700 text-gray-400 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-white focus:ring-green-500'}`}
                                  />
                                  <input
                                    value={part.oldSerialNo || ''}
                                    onChange={isNew ? e => updatePart(idx, 'oldSerialNo', e.target.value) : undefined}
                                    readOnly={!isNew}
                                    placeholder="Serial No. เดิม"
                                    className={`w-full px-2 py-1.5 text-xs border rounded-lg font-mono placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-transparent ${!isNew ? 'bg-slate-800/50 border-slate-700 text-gray-400 cursor-not-allowed' : 'bg-slate-700 border-slate-600 text-white focus:ring-green-500'}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <input
                                    value={part.newBrandModel || part.newDeviceName || ''}
                                    onChange={e => updatePart(idx, 'newBrandModel', e.target.value)}
                                    placeholder="Brand/Model ใหม่"
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-green-500 focus:border-transparent focus:outline-none"
                                  />
                                  <input
                                    value={part.newSerialNo || ''}
                                    onChange={e => updatePart(idx, 'newSerialNo', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                    placeholder="Serial No. ใหม่ (A-Z, 0-9)"
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white font-mono placeholder-gray-500 focus:ring-1 focus:ring-green-500 focus:border-transparent focus:outline-none"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <input
                                    value={part.parentEquipmentName || ''}
                                    onChange={e => updatePart(idx, 'parentEquipmentName', e.target.value)}
                                    placeholder="ชื่ออุปกรณ์หลัก"
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-transparent focus:outline-none"
                                  />
                                  <input
                                    value={part.componentName || ''}
                                    onChange={e => updatePart(idx, 'componentName', e.target.value)}
                                    placeholder="ชิ้นส่วนที่เปลี่ยน"
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-transparent focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <input
                                    value={part.oldComponentSerial || ''}
                                    onChange={e => updatePart(idx, 'oldComponentSerial', e.target.value)}
                                    placeholder="Serial เดิม"
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white font-mono placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-transparent focus:outline-none"
                                  />
                                  <input
                                    value={part.newComponentSerial || ''}
                                    onChange={e => updatePart(idx, 'newComponentSerial', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                    placeholder="Serial ใหม่ (A-Z, 0-9)"
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white font-mono placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-transparent focus:outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add buttons */}
                    <div className="flex gap-2">
                      <button onClick={() => setSpareParts(prev => [...prev, emptyEquipmentPart()])}
                        className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition">
                        <Plus className="w-3 h-3" /> เพิ่มอุปกรณ์
                      </button>
                      <button onClick={() => setSpareParts(prev => [...prev, emptyComponentPart()])}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition">
                        <Plus className="w-3 h-3" /> เพิ่มชิ้นส่วน
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ── View Mode ── */
              incident.usedSpareParts && incident.spareParts && incident.spareParts.length > 0 ? (
                <div className="space-y-4">
                  {incident.spareParts.some(p => p.repairType === 'EQUIPMENT_REPLACEMENT' || !p.repairType) && (
                    <div>
                      <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5" />รายการเปลี่ยนอุปกรณ์ / Device Used
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-green-700/30">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-green-900/20 text-gray-300 text-xs border-b border-green-700/30">
                              <th className="px-3 py-2.5 text-center w-8">#</th>
                              <th className="px-3 py-2.5 text-left">ชื่ออุปกรณ์</th>
                              <th className="px-3 py-2.5 text-left">Brand/Model เดิม</th>
                              <th className="px-3 py-2.5 text-left">Serial No. เดิม</th>
                              <th className="px-1 py-2.5 text-center w-6">→</th>
                              <th className="px-3 py-2.5 text-left">Brand/Model ใหม่</th>
                              <th className="px-3 py-2.5 text-left">Serial No. ใหม่</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incident.spareParts
                              .filter(p => p.repairType === 'EQUIPMENT_REPLACEMENT' || !p.repairType)
                              .map((part, index) => {
                                const deviceName = part.equipmentName || part.deviceName?.split(' → ')[0]?.trim() || '-'
                                const oldBrandModel = part.oldBrandModel || '-'
                                const legacyNewName = part.deviceName?.includes(' → ') ? part.deviceName.split(' → ')[1]?.trim() : ''
                                const newBrandModel = part.newBrandModel || legacyNewName || '-'
                                return (
                                  <tr key={index} className="border-t border-slate-700/40 hover:bg-slate-700/20">
                                    <td className="px-3 py-2.5 text-center">
                                      <span className="w-5 h-5 inline-flex items-center justify-center bg-green-500/20 text-green-400 text-xs font-bold rounded-full">{index + 1}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-200">{deviceName}</td>
                                    <td className="px-3 py-2.5 text-gray-400 text-xs">{oldBrandModel}</td>
                                    <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{part.oldSerialNo || '-'}</td>
                                    <td className="px-1 py-2.5 text-center text-green-400">→</td>
                                    <td className="px-3 py-2.5 text-white font-medium text-xs">{newBrandModel}</td>
                                    <td className="px-3 py-2.5 text-green-400 font-mono text-xs">{part.newSerialNo || '-'}</td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {incident.spareParts.some(p => p.repairType === 'COMPONENT_REPLACEMENT') && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />รายการเปลี่ยนชิ้นส่วน / Spare Part Used
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-purple-700/30">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-purple-900/20 text-gray-300 text-xs border-b border-purple-700/30">
                              <th className="px-3 py-2.5 text-center w-8">#</th>
                              <th className="px-3 py-2.5 text-left">ชื่ออุปกรณ์</th>
                              <th className="px-3 py-2.5 text-left">ชิ้นส่วนที่เปลี่ยน</th>
                              <th className="px-3 py-2.5 text-left">Serial No. เดิม → ใหม่</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incident.spareParts
                              .filter(p => p.repairType === 'COMPONENT_REPLACEMENT')
                              .map((part, index) => (
                                <tr key={index} className="border-t border-slate-700/40 hover:bg-slate-700/20">
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="w-5 h-5 inline-flex items-center justify-center bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full">{index + 1}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-gray-200">{part.parentEquipmentName || '-'}</td>
                                  <td className="px-3 py-2.5 text-gray-200">{part.componentName || '-'}</td>
                                  <td className="px-3 py-2.5 font-mono text-xs">
                                    <span className="text-gray-400">{part.oldComponentSerial || '-'}</span>
                                    <span className="text-purple-400 mx-1.5">→</span>
                                    <span className="text-green-400">{part.newComponentSerial || '-'}</span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">ไม่มีการใช้ Spare Parts</p>
              )
            )}
          </div>

          {/* Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {incident.beforePhotos && incident.beforePhotos.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-3">Before Photos ({incident.beforePhotos.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {incident.beforePhotos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden border-2 border-slate-700/50">
                      <img src={getPhotoUrl(photo)} alt={`Before ${index + 1}`} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openPhotoViewer(incident.beforePhotos!, index, 'Before Photos')} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {incident.afterPhotos && incident.afterPhotos.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-3">After Photos ({incident.afterPhotos.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {incident.afterPhotos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden border-2 border-slate-700/50">
                      <img src={getPhotoUrl(photo)} alt={`After ${index + 1}`} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openPhotoViewer(incident.afterPhotos!, index, 'After Photos')} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Service Report */}
          {(incident.signedReportPhotos?.length || incident.serviceReportToken) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Service Report</h3>
              </div>
              <div className="space-y-3">
                {incident.serviceReportToken && (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${incident.customerSignedAt ? 'bg-green-900/20 border-green-700/40' : 'bg-amber-900/20 border-amber-700/40'}`}>
                    <div className="flex items-center gap-3">
                      <Pen className={`w-4 h-4 flex-shrink-0 ${incident.customerSignedAt ? 'text-green-400' : 'text-amber-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${incident.customerSignedAt ? 'text-green-300' : 'text-amber-300'}`}>Service Report Online</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {incident.customerSignedAt ? `ลูกค้าเซ็นแล้ว — ${new Date(incident.customerSignedAt).toLocaleString('th-TH')}` : 'ส่งลิงก์แล้ว แต่ลูกค้ายังไม่ได้เซ็น'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {incident.customerSignedAt && <CheckCircle className="w-4 h-4 text-green-400" />}
                      <a href={`/service-report/${incident.serviceReportToken}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs rounded-lg transition-colors">
                        <ExternalLink className="w-3 h-3" /> ดู SR
                      </a>
                    </div>
                  </div>
                )}
                {incident.signedReportPhotos && incident.signedReportPhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-4 h-4 text-amber-400" />
                      <p className="text-sm font-medium text-amber-300">รูปใบงานที่เซ็นแล้ว ({incident.signedReportPhotos.length} รูป)</p>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {incident.signedReportPhotos.map((photo, index) => (
                        <div key={index} className="aspect-square rounded-lg overflow-hidden border border-amber-600/30 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openPhotoViewer(incident.signedReportPhotos!, index, 'Signed Service Report')}>
                          <img src={getPhotoUrl(photo)} alt={`Signed SR ${index + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!incident.signedReportPhotos?.length && !incident.customerSignedAt && incident.serviceReportToken && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">ลูกค้ายังไม่ได้เซ็นรับงาน และไม่มีรูปใบงานที่เซ็นแล้ว</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resolution Time */}
          {incident.resolvedAt && (
            <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
              <Clock className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-300">Resolved at</p>
                <p className="text-sm text-green-200">{new Date(incident.resolvedAt).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Review all details carefully before confirming</li>
                <li>Once confirmed, the incident will be marked as CLOSED</li>
                <li>The technician will no longer be able to edit the resolution</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-700/50 bg-slate-800/30 flex-shrink-0">
          {editingSpareParts && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Spare Parts จะถูกอัพเดตพร้อมกับการปิดงาน
            </p>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} disabled={isConfirming} className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={isConfirming}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
              {isConfirming ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirming...</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Confirm & Close Incident</>
              )}
            </button>
          </div>
        </div>
      </div>

      <PhotoViewerModal isOpen={showPhotoViewer} onClose={() => setShowPhotoViewer(false)} photos={photoViewerPhotos} initialIndex={photoViewerIndex} title={photoViewerTitle} />
    </div>
  );
}
