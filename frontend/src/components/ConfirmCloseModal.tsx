// frontend/src/components/ConfirmCloseModal.tsx

import { useState } from 'react';
import { X, CheckCircle, AlertCircle, Clock, User, FileText, Image, ExternalLink, Pen } from 'lucide-react';
import { getPhotoUrl } from '@/utils/photoUtils';
import PhotoViewerModal from './PhotoViewerModal';

interface ConfirmCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: {
    id: string;
    title: string;
    ticketNumber: string;
    technician?: {
      name: string;
      email: string;
    };
    resolutionNote: string;
    usedSpareParts: boolean;
    spareParts?: Array<{
      deviceName: string;
      oldSerialNo: string;
      newSerialNo: string;
      notes?: string;
    }>;
    beforePhotos?: string[];
    afterPhotos?: string[];
    signedReportPhotos?: string[];
    serviceReportToken?: string;
    customerSignedAt?: string;
    resolvedAt?: string;
  };
  onConfirm: () => Promise<void>;
}

export default function ConfirmCloseModal({
  isOpen,
  onClose,
  incident,
  onConfirm,
}: ConfirmCloseModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  // Photo viewer state
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [photoViewerTitle, setPhotoViewerTitle] = useState('');

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
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm closure');
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 pt-20 sm:pt-4">
      <div className="glass-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[calc(100vh-88px)] sm:max-h-[90vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/30">
          <div>
            <h2 className="text-2xl font-bold text-white">Confirm Incident Closure</h2>
            <p className="text-sm text-gray-300 mt-1">
              Review resolution and confirm to close incident
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
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
              <p className="text-sm text-gray-200 whitespace-pre-wrap">
                {incident.resolutionNote}
              </p>
            </div>
          </div>

          {/* Spare Parts */}
          {incident.usedSpareParts && incident.spareParts && incident.spareParts.length > 0 && (
            <div>
              <h3 className="font-semibold text-white mb-3">Spare Parts Used</h3>
              <div className="space-y-3">
                {incident.spareParts.map((part, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">
                        {part.deviceName}
                      </h4>
                      <span className="text-xs text-gray-400">Part #{index + 1}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400 mb-1">Old Serial No.</p>
                        <p className="text-white font-mono">{part.oldSerialNo}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">New Serial No.</p>
                        <p className="text-white font-mono">{part.newSerialNo}</p>
                      </div>
                    </div>
                    {part.notes && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <p className="text-xs text-gray-400">Notes:</p>
                        <p className="text-sm text-gray-200">{part.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Before Photos */}
            {incident.beforePhotos && incident.beforePhotos.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-3">
                  Before Photos ({incident.beforePhotos.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {incident.beforePhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-slate-700/50"
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`Before ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openPhotoViewer(incident.beforePhotos!, index, 'Before Photos')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* After Photos */}
            {incident.afterPhotos && incident.afterPhotos.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-3">
                  After Photos ({incident.afterPhotos.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {incident.afterPhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-slate-700/50"
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`After ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openPhotoViewer(incident.afterPhotos!, index, 'After Photos')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Service Report Section */}
          {(incident.signedReportPhotos?.length || incident.serviceReportToken) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Service Report</h3>
              </div>
              <div className="space-y-3">

                {/* Online Service Report */}
                {incident.serviceReportToken && (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    incident.customerSignedAt
                      ? 'bg-green-900/20 border-green-700/40'
                      : 'bg-amber-900/20 border-amber-700/40'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Pen className={`w-4 h-4 flex-shrink-0 ${incident.customerSignedAt ? 'text-green-400' : 'text-amber-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${incident.customerSignedAt ? 'text-green-300' : 'text-amber-300'}`}>
                          Service Report Online
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {incident.customerSignedAt
                            ? `ลูกค้าเซ็นแล้ว — ${new Date(incident.customerSignedAt).toLocaleString('th-TH')}`
                            : 'ส่งลิงก์แล้ว แต่ลูกค้ายังไม่ได้เซ็น'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {incident.customerSignedAt && <CheckCircle className="w-4 h-4 text-green-400" />}
                      <a
                        href={`/service-report/${incident.serviceReportToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        ดู SR
                      </a>
                    </div>
                  </div>
                )}

                {/* Signed Report Photos */}
                {incident.signedReportPhotos && incident.signedReportPhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-4 h-4 text-amber-400" />
                      <p className="text-sm font-medium text-amber-300">
                        รูปใบงานที่เซ็นแล้ว ({incident.signedReportPhotos.length} รูป)
                      </p>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {incident.signedReportPhotos.map((photo, index) => (
                        <div
                          key={index}
                          className="aspect-square rounded-lg overflow-hidden border border-amber-600/30 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openPhotoViewer(incident.signedReportPhotos!, index, 'Signed Service Report')}
                        >
                          <img
                            src={getPhotoUrl(photo)}
                            alt={`Signed SR ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No proof warning */}
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
                <p className="text-sm text-green-200">
                  {new Date(incident.resolvedAt).toLocaleString()}
                </p>
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
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-700/50 bg-slate-800/30">
          <p className="text-sm text-gray-300">
            Confirm that the work has been completed satisfactorily
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm & Close Incident
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Photo Viewer Modal */}
      <PhotoViewerModal
        isOpen={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
        photos={photoViewerPhotos}
        initialIndex={photoViewerIndex}
        title={photoViewerTitle}
      />
    </div>
  );
}
