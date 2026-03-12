// frontend/src/components/TechConfirmModal.tsx

import { X, CheckCircle, FileText, Image, Edit3, AlertTriangle } from 'lucide-react';

interface TechConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: {
    id: string;
    ticketNumber: string;
    title: string;
    signedReportPhotos?: string[];
    customerSignedAt?: string;
    serviceReportToken?: string;
  };
  onConfirm: () => Promise<void>;
  isConfirming: boolean;
}

export default function TechConfirmModal({
  isOpen,
  onClose,
  incident,
  onConfirm,
  isConfirming,
}: TechConfirmModalProps) {
  if (!isOpen) return null;

  const signedPhotosCount = incident.signedReportPhotos?.length || 0;
  const hasCustomerSignature = !!incident.customerSignedAt;
  const hasOnlineSR = !!incident.serviceReportToken;
  const pendingOnlineSignature = hasOnlineSR && !hasCustomerSignature;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">ยืนยันปิดงาน</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {incident.ticketNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-400">เรื่อง</p>
            <p className="text-white font-medium mt-0.5">{incident.title}</p>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">ตรวจสอบก่อนยืนยัน:</p>

            {/* Signed Report Photos */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              signedPhotosCount > 0
                ? 'bg-green-900/20 border-green-700/50'
                : 'bg-gray-700/30 border-gray-600/50'
            }`}>
              <Image className={`w-5 h-5 flex-shrink-0 ${
                signedPhotosCount > 0 ? 'text-green-400' : 'text-gray-500'
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  signedPhotosCount > 0 ? 'text-green-300' : 'text-gray-400'
                }`}>
                  รูปใบงาน (Signed Report Photos)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {signedPhotosCount > 0
                    ? `อัปโหลดแล้ว ${signedPhotosCount} รูป`
                    : 'ยังไม่ได้อัปโหลด (ไม่บังคับ)'}
                </p>
              </div>
              {signedPhotosCount > 0 && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
            </div>

            {/* Customer Signature */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              hasCustomerSignature
                ? 'bg-green-900/20 border-green-700/50'
                : pendingOnlineSignature
                  ? 'bg-amber-900/20 border-amber-500/50'
                  : 'bg-gray-700/30 border-gray-600/50'
            }`}>
              <Edit3 className={`w-5 h-5 flex-shrink-0 ${
                hasCustomerSignature
                  ? 'text-green-400'
                  : pendingOnlineSignature
                    ? 'text-amber-400'
                    : 'text-gray-500'
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  hasCustomerSignature
                    ? 'text-green-300'
                    : pendingOnlineSignature
                      ? 'text-amber-300'
                      : 'text-gray-400'
                }`}>
                  ลายเซ็นลูกค้า (Customer Signature)
                </p>
                <p className={`text-xs mt-0.5 ${pendingOnlineSignature ? 'text-amber-400/80' : 'text-gray-500'}`}>
                  {hasCustomerSignature
                    ? 'ลูกค้าเซ็นแล้ว'
                    : pendingOnlineSignature
                      ? 'ส่ง Service Report Online แล้ว แต่ลูกค้ายังไม่ได้เซ็น'
                      : 'ยังไม่ได้เซ็น (ไม่บังคับ)'}
                </p>
              </div>
              {hasCustomerSignature && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
              {pendingOnlineSignature && (
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200">
              เมื่อยืนยันแล้ว Helpdesk จะได้รับแจ้งเพื่อตรวจสอบและปิดงาน
              หากต้องการแก้ไข Resolution หลังยืนยัน จะต้องยืนยันใหม่อีกครั้ง
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition font-medium"
          >
            {isConfirming ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังยืนยัน...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>ยืนยันปิดงาน</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
