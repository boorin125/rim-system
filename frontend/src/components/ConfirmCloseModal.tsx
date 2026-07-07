// frontend/src/components/ConfirmCloseModal.tsx

import { useState } from 'react';
import { X, CheckCircle, AlertCircle, Clock, User, FileText, Image, ExternalLink, Pen, ArrowRightLeft, Cpu, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { getPhotoUrl } from '@/utils/photoUtils';
import PhotoViewerModal from './PhotoViewerModal';
import SparePartForm, { SparePart as SparePartFormType } from './SparePartForm';

// DB spare part shape (from API)
interface DBSparePart {
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
  newBrand?: string;
  newModel?: string;
}

function dbToFormPart(p: DBSparePart): SparePartFormType {
  const id = Math.random().toString(36).substr(2, 9);
  if (p.repairType === 'COMPONENT_REPLACEMENT') {
    return {
      id, repairType: 'COMPONENT_REPLACEMENT',
      oldDeviceName: '', oldSerialNo: '', newDeviceName: '', newSerialNo: '',
      replacementType: 'PERMANENT',
      componentName: p.componentName || '',
      oldComponentSerial: p.oldComponentSerial || '',
      newComponentSerial: p.newComponentSerial || '',
      parentEquipmentName: p.parentEquipmentName || '',
    };
  }
  const oldDeviceName = p.equipmentName || p.oldDeviceName ||
    (p.deviceName?.includes(' → ') ? p.deviceName.split(' → ')[0]?.trim() : p.deviceName) || '';
  const newDeviceName = p.newBrandModel || p.newDeviceName ||
    (p.deviceName?.includes(' → ') ? p.deviceName.split(' → ')[1]?.trim() : '') || '';
  return {
    id, repairType: 'EQUIPMENT_REPLACEMENT',
    oldDeviceName, oldSerialNo: p.oldSerialNo || '',
    newDeviceName, newSerialNo: p.newSerialNo || '',
    newBrand: p.newBrand, newModel: p.newModel,
    replacementType: 'PERMANENT',
  };
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
    spareParts?: DBSparePart[];
    beforePhotos?: string[];
    afterPhotos?: string[];
    signedReportPhotos?: string[];
    serviceReportToken?: string;
    customerSignedAt?: string;
    resolvedAt?: string;
    storeId?: number;
    incidentEquipmentIds?: number[];
  };
  onConfirm: (sparePartsUpdate?: { usedSpareParts: boolean; spareParts: any[] }) => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
}

export default function ConfirmCloseModal({ isOpen, onClose, incident, onConfirm, onReject }: ConfirmCloseModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  // Reject mode
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Photo viewer
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [photoViewerTitle, setPhotoViewerTitle] = useState('');

  // Spare parts editing — uses SparePartForm's SparePart type
  const [editingSpareParts, setEditingSpareParts] = useState(false);
  const [usedSpareParts, setUsedSpareParts] = useState(incident.usedSpareParts);
  const [spareParts, setSpareParts] = useState<SparePartFormType[]>(
    incident.spareParts?.map(dbToFormPart) ?? []
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
      let sparePartsUpdate: { usedSpareParts: boolean; spareParts: any[] } | undefined;
      if (editingSpareParts) {
        const dtoSpareParts = spareParts.map(p => {
          if (p.repairType === 'COMPONENT_REPLACEMENT') {
            return {
              repairType: p.repairType,
              componentName: p.componentName,
              oldComponentSerial: p.oldComponentSerial,
              newComponentSerial: p.newComponentSerial,
            };
          }
          return {
            repairType: 'EQUIPMENT_REPLACEMENT',
            oldDeviceName: p.oldDeviceName || '',
            oldSerialNo: p.oldSerialNo || '',
            newDeviceName: p.newDeviceName || '',
            newSerialNo: p.newSerialNo || '',
            newBrand: p.newBrand,
            newModel: p.newModel,
          };
        });
        sparePartsUpdate = { usedSpareParts, spareParts: dtoSpareParts };
      }
      await onConfirm(sparePartsUpdate);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm closure');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) return;
    setIsSubmittingReject(true);
    setError('');
    try {
      await onReject!(rejectReason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reject');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  if (!isOpen) return null;

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
                    setSpareParts(incident.spareParts?.map(dbToFormPart) ?? []);
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
                  <SparePartForm
                    spareParts={spareParts}
                    onChange={setSpareParts}
                    storeId={incident.storeId}
                    incidentEquipmentIds={incident.incidentEquipmentIds}
                  />
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
        <div className="border-t border-slate-700/50 bg-slate-800/30 flex-shrink-0">
          {/* Reject reason input — shown when isRejecting */}
          {isRejecting && (
            <div className="px-5 pt-4 pb-2">
              <label className="block text-sm font-medium text-red-300 mb-2">
                สาเหตุที่ปฏิเสธ <span className="text-red-400">*</span>
                <span className="text-xs text-gray-400 font-normal ml-2">(แจ้งช่างว่าต้องแก้ไขอะไร)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="เช่น ข้อมูลสแปร์พาร์ทไม่ครบถ้วน กรุณาระบุ Serial Number ใหม่ให้ถูกต้อง..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-700/70 border border-red-700/50 focus:border-red-500 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
              />
              {rejectReason.trim().length > 0 && rejectReason.trim().length < 5 && (
                <p className="text-xs text-red-400 mt-1">กรุณาระบุอย่างน้อย 5 ตัวอักษร</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            {editingSpareParts && !isRejecting && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Spare Parts จะถูกอัพเดตพร้อมกับการปิดงาน
              </p>
            )}
            <div className="flex gap-3 ml-auto">
              {isRejecting ? (
                <>
                  <button onClick={() => { setIsRejecting(false); setRejectReason(''); setError(''); }}
                    disabled={isSubmittingReject}
                    className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleReject}
                    disabled={isSubmittingReject || rejectReason.trim().length < 5}
                    className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                    {isSubmittingReject ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังส่ง...</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> ยืนยันปฏิเสธ</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={onClose} disabled={isConfirming}
                    className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50">
                    Cancel
                  </button>
                  {onReject && (
                    <button onClick={() => { setIsRejecting(true); setError(''); }}
                      disabled={isConfirming}
                      className="px-5 py-2 bg-red-900/40 hover:bg-red-800/50 border border-red-700/50 text-red-300 hover:text-red-200 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  )}
                  <button onClick={handleConfirm} disabled={isConfirming}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                    {isConfirming ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirming...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> Confirm & Close Incident</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <PhotoViewerModal isOpen={showPhotoViewer} onClose={() => setShowPhotoViewer(false)} photos={photoViewerPhotos} initialIndex={photoViewerIndex} title={photoViewerTitle} />
    </div>
  );
}
