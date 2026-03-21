import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Trash2, Camera, Mic, MicOff, FileText, CheckCircle, FlipHorizontal2 } from 'lucide-react';
import SparePartForm from './SparePartForm';

interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (data: ResolveIncidentData) => Promise<void>;
  incidentId: string;
  storeId?: number;
  incidentEquipmentIds?: number[];
  onlineSRToken?: string;
  onlineSRSigned?: boolean;
}

// ✅ SparePart พร้อม equipmentId เพื่อเชื่อมโยงกับ Equipment ในระบบ
export interface SparePart {
  id: string;
  // Repair Type - ประเภทการซ่อม
  repairType: 'EQUIPMENT_REPLACEMENT' | 'COMPONENT_REPLACEMENT';

  // === EQUIPMENT_REPLACEMENT Fields ===
  oldDeviceName: string;
  oldSerialNo: string;
  oldEquipmentId?: number;  // ✅ Equipment ID ที่ถูกถอดออก
  newDeviceName: string;
  newSerialNo: string;
  newBrand?: string;
  newModel?: string;
  newEquipmentId?: number;  // ✅ Equipment ID ที่ใส่เข้าไป
  replacementType: 'PERMANENT' | 'TEMPORARY';

  // === COMPONENT_REPLACEMENT Fields ===
  componentName?: string;       // ชื่อชิ้นส่วน เช่น "Battery", "Power Supply"
  oldComponentSerial?: string;  // Serial เดิมของชิ้นส่วน
  newComponentSerial?: string;  // Serial ใหม่ของชิ้นส่วน
  parentEquipmentId?: number;   // อุปกรณ์หลักที่ชิ้นส่วนอยู่ใน
  parentEquipmentName?: string; // ชื่ออุปกรณ์หลัก

  notes?: string;
}

export interface ResolveIncidentData {
  resolutionNote: string;
  usedSpareParts: boolean;
  spareParts?: SparePart[];
  afterPhotos?: string[];
  signedReportPhotos?: string[];
}

// Declare SpeechRecognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const ResolveIncidentModal: React.FC<ResolveIncidentModalProps> = ({
  isOpen,
  onClose,
  onResolve,
  incidentId,
  storeId,
  incidentEquipmentIds,
  onlineSRToken,
  onlineSRSigned,
}) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [usedSpareParts, setUsedSpareParts] = useState(false);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Signed SR photos
  const [signedSrPhotos, setSignedSrPhotos] = useState<File[]>([]);
  const [signedSrPreviewUrls, setSignedSrPreviewUrls] = useState<string[]>([]);
  // Voice to Text states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const srGalleryInputRef = useRef<HTMLInputElement>(null);
  const srCameraInputRef = useRef<HTMLInputElement>(null);
  const [srCameraFacing, setSrCameraFacing] = useState<'environment' | 'user'>('environment');

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'th-TH'; // Thai language
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setResolutionNote(prev => prev + finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          
          if (event.error === 'no-speech') {
            setError('ไม่พบเสียงพูด กรุณาลองอีกครั้ง');
          } else if (event.error === 'not-allowed') {
            setError('กรุณาอนุญาตการเข้าถึงไมโครโฟน');
          } else {
            setError('เกิดข้อผิดพลาดในการรับรู้เสียง');
          }
          
          setTimeout(() => setError(''), 3000);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Toggle voice recording
  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError('');
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setError('ไม่สามารถเริ่มการรับรู้เสียงได้');
      }
    }
  };

  // Validate form
  const validateForm = () => {
    if (!resolutionNote.trim()) {
      return 'กรุณากรอก Resolution Note';
    }
    if (resolutionNote.trim().length < 10) {
      return 'Resolution Note ต้องมีอย่างน้อย 10 ตัวอักษร';
    }
    if (usedSpareParts && spareParts.length === 0) {
      return 'กรุณาเพิ่มรายการ Spare Parts อย่างน้อย 1 รายการ';
    }
    // Validate each spare part
    if (usedSpareParts) {
      for (let i = 0; i < spareParts.length; i++) {
        const part = spareParts[i];
        if (part.repairType === 'COMPONENT_REPLACEMENT') {
          if (!part.componentName?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุชื่อชิ้นส่วน`;
          if (!part.oldComponentSerial?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุ Serial เดิม`;
          if (!part.newComponentSerial?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุ Serial ใหม่`;
        } else {
          if (!part.oldDeviceName?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุชื่ออุปกรณ์เดิม`;
          if (!part.oldSerialNo?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุ Serial No. เดิม`;
          // Accept newDeviceName derived from newBrand+newModel (same logic as submission)
          const effectiveNewName = [part.newBrand, part.newModel].filter(Boolean).join(' ') || part.newDeviceName;
          if (!effectiveNewName?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุชื่ออุปกรณ์ใหม่`;
          if (!part.newSerialNo?.trim()) return `อะไหล่ #${i + 1}: กรุณาระบุ Serial No. ใหม่`;
          if (!part.replacementType) return `อะไหล่ #${i + 1}: กรุณาเลือกประเภทการเปลี่ยน (ถาวร/ชั่วคราว)`;
        }
      }
    }
    return null;
  };

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (afterPhotos.length + files.length > 20) {
      setError('สามารถอัพโหลดรูปได้สูงสุด 20 รูป');
      return;
    }

    // Create preview URLs
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    
    setAfterPhotos(prev => [...prev, ...files]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    setError('');
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle signed SR photo upload
  const handleSignedSrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (signedSrPhotos.length + files.length > 5) {
      setError('อัปโหลดรูป SR ที่เซ็นแล้วได้สูงสุด 5 รูป');
      return;
    }
    const newUrls = files.map(file => URL.createObjectURL(file));
    setSignedSrPhotos(prev => [...prev, ...files]);
    setSignedSrPreviewUrls(prev => [...prev, ...newUrls]);
    setError('');
    if (srGalleryInputRef.current) srGalleryInputRef.current.value = '';
    if (srCameraInputRef.current) srCameraInputRef.current.value = '';
  };

  const handleRemoveSignedSrPhoto = (index: number) => {
    URL.revokeObjectURL(signedSrPreviewUrls[index]);
    setSignedSrPhotos(prev => prev.filter((_, i) => i !== index));
    setSignedSrPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Remove photo
  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setAfterPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async () => {
    // Stop recording if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Convert photos to base64
      let base64Photos: string[] | undefined;
      if (afterPhotos.length > 0) {
        base64Photos = await Promise.all(
          afterPhotos.map((file) => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );
      }

      // ✅ Prepare spare parts data - ลบ id ออก, ส่งเฉพาะ fields ที่เกี่ยวข้องกับ repairType
      let sparePartsData: any[] | undefined;
      if (usedSpareParts && spareParts.length > 0) {
        sparePartsData = spareParts.map((part) => {
          if (part.repairType === 'COMPONENT_REPLACEMENT') {
            return {
              repairType: part.repairType,
              componentName: part.componentName,
              oldComponentSerial: part.oldComponentSerial,
              newComponentSerial: part.newComponentSerial,
              parentEquipmentId: part.parentEquipmentId || undefined,
              notes: part.notes || undefined,
            };
          }
          // EQUIPMENT_REPLACEMENT
          // Compose newDeviceName from brand + model for backend compatibility
          const newDeviceName = [part.newBrand, part.newModel].filter(Boolean).join(' ') || part.newDeviceName;
          return {
            repairType: part.repairType,
            oldDeviceName: part.oldDeviceName,
            oldSerialNo: part.oldSerialNo,
            oldEquipmentId: part.oldEquipmentId || undefined,
            newDeviceName,
            newSerialNo: part.newSerialNo,
            newBrand: part.newBrand || undefined,
            newModel: part.newModel || undefined,
            newEquipmentId: part.newEquipmentId || undefined,
            replacementType: part.replacementType,
            notes: part.notes || undefined,
          };
        });
      }

      // Convert signed SR photos to base64
      let base64SignedSrPhotos: string[] | undefined;
      if (signedSrPhotos.length > 0) {
        base64SignedSrPhotos = await Promise.all(
          signedSrPhotos.map((file) => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );
      }

      // Submit
      await onResolve({
        resolutionNote: resolutionNote.trim(),
        usedSpareParts,
        spareParts: sparePartsData as any,
        afterPhotos: base64Photos,
        signedReportPhotos: base64SignedSrPhotos,
      });

      // Clean up
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      signedSrPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resolve incident';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup on close
  const handleClose = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card border border-slate-700/50 rounded-xl w-full max-w-4xl max-h-[calc(100vh-88px)] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/30">
          <h2 className="text-2xl font-bold text-white">Resolve Incident</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-red-400">ไม่สามารถดำเนินการได้</p>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              SECTION 1: After Photos (ด้านบน)
              ======================================== */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">
              After Photos (หลังซ่อม)
              <span className="text-gray-400 ml-2">สูงสุด 20 รูป</span>
            </label>
            
            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            <input key={`after-${cameraFacing}`} ref={cameraInputRef} type="file" accept="image/*" capture={cameraFacing} onChange={handlePhotoUpload} className="hidden" />

            {/* Upload Area */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTimeout(() => cameraInputRef.current?.click(), 0)}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 bg-blue-600/20 border-2 border-blue-500/50 rounded-xl hover:bg-blue-600/30 transition-all">
                  <Camera className="w-6 h-6 text-blue-400" />
                  <span className="text-xs font-medium text-blue-300">ถ่ายรูป</span>
                  <span className="text-[10px] text-blue-400/70">{cameraFacing === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'}</span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 bg-slate-800/40 border-2 border-slate-600/50 rounded-xl hover:bg-slate-700/40 transition-all">
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">เลือกจากคลัง</span>
                  <span className="text-[10px] text-gray-500">Gallery</span>
                </button>
              </div>
              <button type="button" onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700/30 rounded-lg transition-colors">
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                สลับเป็น{cameraFacing === 'environment' ? 'กล้องหน้า' : 'กล้องหลัง'}
              </button>
            </div>

            {/* Photo Previews */}
            {previewUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {previewUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative group border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30 aspect-square"
                  >
                    <img
                      src={url}
                      alt={`After photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Photo Count */}
            {afterPhotos.length > 0 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  อัพโหลดแล้ว {afterPhotos.length} / 20 รูป
                </span>
                {afterPhotos.length >= 20 && (
                  <span className="text-yellow-400">ครบจำนวนสูงสุดแล้ว</span>
                )}
              </div>
            )}
          </div>

          {/* ========================================
              SECTION 2: Resolution Note with Voice to Text
              ======================================== */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-200">
                Resolution Note <span className="text-red-400">*</span>
              </label>
              
              {/* Voice to Text Button */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  disabled={isSubmitting}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                  }`}
                  title={isListening ? 'หยุดบันทึกเสียง' : 'เริ่มบันทึกเสียง'}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span className="text-sm">หยุด</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span className="text-sm">พูด</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Listening Indicator */}
            {isListening && (
              <div className="mb-2 p-2 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-400">กำลังฟังเสียงพูด...</span>
              </div>
            )}

            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              placeholder="อธิบายรายละเอียดการแก้ไข... (อย่างน้อย 10 ตัวอักษร) หรือกดปุ่มไมค์เพื่อพูด"
            />
            
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {resolutionNote.length} ตัวอักษร {resolutionNote.length < 10 && `(ต้องการอีก ${10 - resolutionNote.length} ตัวอักษร)`}
              </p>
              
              {speechSupported && !isListening && (
                <p className="text-xs text-gray-500">
                  💡 กดปุ่มไมค์เพื่อใช้เสียงพูด
                </p>
              )}
            </div>
          </div>

          {/* ========================================
              SECTION 3: Spare Parts
              ======================================== */}
          <div>
            <label className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                checked={usedSpareParts}
                onChange={(e) => setUsedSpareParts(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700/50 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
              />
              <span className="text-gray-200 font-medium">
                ใช้ Spare Parts (อะไหล่)
              </span>
            </label>

            {usedSpareParts && (
              <SparePartForm
                spareParts={spareParts}
                onChange={setSpareParts}
                storeId={storeId}
                incidentEquipmentIds={incidentEquipmentIds}
              />
            )}
          </div>

          {/* ========================================
              SECTION 4: Service Report
              ======================================== */}

          {/* Online SR Status Banner */}
          {onlineSRToken && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
              onlineSRSigned
                ? 'border-teal-600/50 bg-teal-900/10'
                : 'border-slate-600/50 bg-slate-800/30'
            }`}>
              <div className={`p-2 rounded-full ${onlineSRSigned ? 'bg-teal-700/20' : 'bg-slate-700/30'}`}>
                <FileText className={`w-5 h-5 ${onlineSRSigned ? 'text-teal-400' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${onlineSRSigned ? 'text-teal-300' : 'text-gray-300'}`}>
                  Service Report Online
                </p>
                {onlineSRSigned ? (
                  <p className="text-xs text-teal-400 mt-0.5">✓ ลูกค้าเซ็น Service Report Online แล้ว</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">ยังไม่มีการเซ็นลายเซ็นใน Service Report Online</p>
                )}
              </div>
              {onlineSRSigned && <CheckCircle className="w-5 h-5 text-teal-400 shrink-0" />}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">
              รูป Service Report ที่เซ็นแล้ว{onlineSRToken ? ' (กรณีใช้ SR แบบกระดาษ)' : ''} (ไม่บังคับ)
              <span className="text-gray-400 ml-2">สูงสุด 5 รูป</span>
            </label>

            {/* Hidden inputs for SR */}
            <input ref={srGalleryInputRef} type="file" accept="image/*" multiple onChange={handleSignedSrUpload} className="hidden" />
            <input key={`sr-${srCameraFacing}`} ref={srCameraInputRef} type="file" accept="image/*" capture={srCameraFacing} onChange={handleSignedSrUpload} className="hidden" />

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTimeout(() => srCameraInputRef.current?.click(), 0)}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 bg-amber-600/10 border-2 border-amber-600/30 rounded-xl hover:bg-amber-600/20 transition-all">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">ถ่ายรูป</span>
                  <span className="text-[10px] text-amber-400/70">{srCameraFacing === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'}</span>
                </button>
                <button type="button" onClick={() => srGalleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 bg-slate-800/40 border-2 border-slate-600/50 rounded-xl hover:bg-slate-700/40 transition-all">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">เลือกจากคลัง</span>
                  <span className="text-[10px] text-gray-500">Gallery</span>
                </button>
              </div>
              <button type="button" onClick={() => setSrCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700/30 rounded-lg transition-colors">
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                สลับเป็น{srCameraFacing === 'environment' ? 'กล้องหน้า' : 'กล้องหลัง'}
              </button>
            </div>

            {signedSrPreviewUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {signedSrPreviewUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative group border border-amber-600/30 rounded-lg overflow-hidden bg-slate-800/30 aspect-square"
                  >
                    <img
                      src={url}
                      alt={`Signed SR ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveSignedSrPhoto(index)}
                        className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {signedSrPhotos.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                อัพโหลดแล้ว {signedSrPhotos.length} / 5 รูป
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700/50 bg-slate-800/30">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <span>Submit Resolution</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResolveIncidentModal;
