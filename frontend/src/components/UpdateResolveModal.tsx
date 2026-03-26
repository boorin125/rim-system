// frontend/src/components/UpdateResolveModal.tsx

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, AlertCircle, Edit3, Camera, Mic, MicOff } from 'lucide-react';
import SparePartForm, { SparePart } from './SparePartForm';
import { compressImages, validateImageFile } from '@/utils/imageUtils';
import { getPhotoUrl } from '@/utils/photoUtils';

interface UpdateResolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  storeId?: number;
  currentData: {
    resolutionNote: string;
    usedSpareParts: boolean;
    spareParts?: Array<{
      id?: number;
      repairType?: string;
      deviceName: string;
      oldSerialNo: string;
      newSerialNo: string;
      newBrand?: string;
      newModel?: string;
      oldEquipmentId?: number;
      newEquipmentId?: number;
      componentName?: string;
      oldComponentSerial?: string;
      newComponentSerial?: string;
      parentEquipmentId?: number;
      notes?: string;
    }>;
    afterPhotos?: string[];
    signedReportPhotos?: string[];
  };
  onUpdate: (data: UpdateResolveData) => Promise<void>;
}

export interface UpdateResolveData {
  resolutionNote?: string;
  usedSpareParts?: boolean;
  spareParts?: Array<{
    repairType: 'EQUIPMENT_REPLACEMENT' | 'COMPONENT_REPLACEMENT';
    oldDeviceName: string;
    oldSerialNo: string;
    newDeviceName: string;
    newSerialNo: string;
    newBrand?: string;
    newModel?: string;
    replacementType: 'PERMANENT' | 'TEMPORARY';
    oldEquipmentId?: number;
    newEquipmentId?: number;
    componentName?: string;
    oldComponentSerial?: string;
    newComponentSerial?: string;
    parentEquipmentId?: number;
    notes?: string;
  }>;
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

export default function UpdateResolveModal({
  isOpen,
  onClose,
  incidentId,
  storeId,
  currentData,
  onUpdate,
}: UpdateResolveModalProps) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [usedSpareParts, setUsedSpareParts] = useState(false);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Signed SR photos
  const [existingSignedSrPhotos, setExistingSignedSrPhotos] = useState<string[]>([]);
  const [newSignedSrPhotos, setNewSignedSrPhotos] = useState<File[]>([]);
  const [newSignedSrPhotoUrls, setNewSignedSrPhotoUrls] = useState<string[]>([]);
  const signedSrInputRef = useRef<HTMLInputElement>(null);
  const cameraAfterRef = useRef<HTMLInputElement>(null);
  const cameraSrRef = useRef<HTMLInputElement>(null);
  const galleryAfterRef = useRef<HTMLInputElement>(null);

  // Voice to Text states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const MAX_PHOTOS = 20;

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

  // ✅ Helper function to parse deviceName
  const parseDeviceName = (deviceName: string) => {
    // Check if deviceName contains " → " separator
    if (deviceName.includes(' → ')) {
      const parts = deviceName.split(' → ');
      return {
        oldDeviceName: parts[0]?.trim() || '',
        newDeviceName: parts[1]?.trim() || '',
      };
    }
    // Fallback if no separator
    return {
      oldDeviceName: deviceName,
      newDeviceName: deviceName,
    };
  };

  // ✅ Helper function to parse notes for replacementType
  const parseReplacementType = (notes?: string): 'PERMANENT' | 'TEMPORARY' => {
    if (!notes) return 'PERMANENT';
    
    if (notes.includes('Type: PERMANENT') || notes.includes('PERMANENT')) {
      return 'PERMANENT';
    }
    if (notes.includes('Type: TEMPORARY') || notes.includes('TEMPORARY')) {
      return 'TEMPORARY';
    }
    
    return 'PERMANENT'; // Default
  };

  // ✅ Helper function to extract notes without type
  const extractNotes = (notes?: string): string => {
    if (!notes) return '';
    
    // Remove "Type: PERMANENT | " or "Type: TEMPORARY | "
    return notes
      .replace(/Type: (PERMANENT|TEMPORARY)\s*\|\s*/i, '')
      .trim();
  };

  // Initialize form with current data
  useEffect(() => {
    if (isOpen) {
      setResolutionNote(currentData.resolutionNote || '');
      setUsedSpareParts(currentData.usedSpareParts || false);
      
      // ✅ Convert spare parts to NEW format
      if (currentData.spareParts && currentData.spareParts.length > 0) {
        const formattedParts: SparePart[] = currentData.spareParts.map((part, index) => {
          const { oldDeviceName, newDeviceName } = parseDeviceName(part.deviceName);
          const replacementType = parseReplacementType(part.notes);
          const cleanNotes = extractNotes(part.notes);

          // Use repairType from DB if available
          const isComponentReplacement = part.repairType === 'COMPONENT_REPLACEMENT';

          return {
            id: part.id ? `existing-${part.id}` : `spare-${Date.now()}-${index}`,
            repairType: isComponentReplacement ? 'COMPONENT_REPLACEMENT' : 'EQUIPMENT_REPLACEMENT',
            selectedDeviceId: part.oldEquipmentId || undefined,
            oldDeviceName,
            oldSerialNo: part.oldSerialNo,
            oldEquipmentId: part.oldEquipmentId || undefined,
            newDeviceName,
            newSerialNo: part.newSerialNo,
            newBrand: part.newBrand || undefined,
            newModel: part.newModel || undefined,
            newEquipmentId: part.newEquipmentId || undefined,
            replacementType,
            componentName: part.componentName || undefined,
            oldComponentSerial: part.oldComponentSerial || undefined,
            newComponentSerial: part.newComponentSerial || undefined,
            parentEquipmentId: part.parentEquipmentId || undefined,
            notes: cleanNotes || undefined,
          };
        });
        setSpareParts(formattedParts);
      } else {
        setSpareParts([]);
      }

      setExistingPhotos(currentData.afterPhotos || []);
      setNewPhotos([]);
      setNewPhotoUrls([]);
      setExistingSignedSrPhotos(currentData.signedReportPhotos || []);
      setNewSignedSrPhotos([]);
      setNewSignedSrPhotoUrls([]);
      setError('');
    }
  }, [isOpen, currentData]);

  const totalPhotos = existingPhotos.length + newPhotos.length;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError('');

    if (totalPhotos + files.length > MAX_PHOTOS) {
      setError(`สามารถอัพโหลดรูปได้สูงสุด ${MAX_PHOTOS} รูป`);
      return;
    }

    for (const file of files) {
      const validation = validateImageFile(file, 10);
      if (!validation.valid) {
        setError(validation.error || 'ไฟล์ไม่ถูกต้อง');
        return;
      }
    }

    try {
      const compressed = await compressImages(files, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
      });

      const urls = compressed.map((file) => URL.createObjectURL(file));

      setNewPhotos((prev) => [...prev, ...compressed]);
      setNewPhotoUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      setError('ไม่สามารถประมวลผลรูปภาพได้');
      console.error(err);
    }
  };

  const handleRemoveNewPhoto = (index: number) => {
    URL.revokeObjectURL(newPhotoUrls[index]);
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSignedSrPhotos = existingSignedSrPhotos.length + newSignedSrPhotos.length;

  const handleSignedSrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (totalSignedSrPhotos + files.length > 5) {
      setError('อัปโหลดรูป SR ที่เซ็นแล้วได้สูงสุด 5 รูป');
      return;
    }
    for (const file of files) {
      const validation = validateImageFile(file, 10);
      if (!validation.valid) { setError(validation.error || 'ไฟล์ไม่ถูกต้อง'); return; }
    }
    try {
      const compressed = await compressImages(files, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });
      const urls = compressed.map(f => URL.createObjectURL(f));
      setNewSignedSrPhotos(prev => [...prev, ...compressed]);
      setNewSignedSrPhotoUrls(prev => [...prev, ...urls]);
      setError('');
    } catch {
      setError('ไม่สามารถประมวลผลรูปภาพได้');
    }
    if (signedSrInputRef.current) signedSrInputRef.current.value = '';
    if (cameraSrRef.current) cameraSrRef.current.value = '';
  };

  const handleRemoveExistingSignedSr = (index: number) => {
    setExistingSignedSrPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewSignedSr = (index: number) => {
    URL.revokeObjectURL(newSignedSrPhotoUrls[index]);
    setNewSignedSrPhotos(prev => prev.filter((_, i) => i !== index));
    setNewSignedSrPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!resolutionNote.trim()) {
      return 'กรุณากรอก Resolution Note';
    }

    if (resolutionNote.trim().length < 10) {
      return 'Resolution Note ต้องมีอย่างน้อย 10 ตัวอักษร';
    }

    if (usedSpareParts) {
      if (spareParts.length === 0) {
        return 'กรุณาเพิ่มรายการ Spare Parts อย่างน้อย 1 รายการ หรือยกเลิกการเลือก "Used Spare Parts"';
      }

      for (let i = 0; i < spareParts.length; i++) {
        const part = spareParts[i];
        if (!part.oldDeviceName?.trim()) {
          return `Spare part #${i + 1}: Old Device Name is required`;
        }
        if (!part.oldSerialNo?.trim()) {
          return `Spare part #${i + 1}: Old Serial Number is required`;
        }
        if (!part.newDeviceName?.trim()) {
          return `Spare part #${i + 1}: New Device Name is required`;
        }
        if (!part.newSerialNo?.trim()) {
          return `Spare part #${i + 1}: New Serial Number is required`;
        }
        if (!part.replacementType) {
          return `Spare part #${i + 1}: Replacement Type is required`;
        }
      }
    }

    return null;
  };

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
      // Convert new photos to base64
      let newBase64Photos: string[] | undefined;
      if (newPhotos.length > 0) {
        newBase64Photos = await Promise.all(
          newPhotos.map((file) => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );
      }

      // Combine existing and new photos
      const allPhotos = [...existingPhotos, ...(newBase64Photos || [])];

      // ✅ Prepare spare parts in NEW format (ลบ id ออก)
      let sparePartsData: UpdateResolveData['spareParts'];
      if (usedSpareParts && spareParts.length > 0) {
        sparePartsData = spareParts.map((part) => ({
          repairType: part.repairType,
          // Equipment Replacement fields
          oldDeviceName: part.oldDeviceName,
          oldSerialNo: part.oldSerialNo,
          oldEquipmentId: part.oldEquipmentId,
          newDeviceName: part.newDeviceName,
          newSerialNo: part.newSerialNo,
          newBrand: part.newBrand || undefined,
          newModel: part.newModel || undefined,
          newEquipmentId: part.newEquipmentId,
          replacementType: part.replacementType,
          // Component Replacement fields
          componentName: part.componentName,
          oldComponentSerial: part.oldComponentSerial,
          newComponentSerial: part.newComponentSerial,
          parentEquipmentId: part.parentEquipmentId,
          notes: part.notes || undefined,
        }));
      }

      // Convert new signed SR photos to base64
      let newBase64SignedSr: string[] | undefined;
      if (newSignedSrPhotos.length > 0) {
        newBase64SignedSr = await Promise.all(
          newSignedSrPhotos.map((file) => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );
      }
      const allSignedSr = [...existingSignedSrPhotos, ...(newBase64SignedSr || [])];

      await onUpdate({
        resolutionNote: resolutionNote.trim(),
        usedSpareParts,
        spareParts: sparePartsData,
        afterPhotos: allPhotos.length > 0 ? allPhotos : undefined,
        signedReportPhotos: allSignedSr.length > 0 ? allSignedSr : undefined,
      });

      // Clean up
      newPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
      newSignedSrPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
      onClose();
    } catch (err: any) {
      // ✅ แสดง error message ที่ชัดเจน
      if (err.message?.includes('Only technician who resolved')) {
        setError('คุณไม่สามารถแก้ไข Resolution นี้ได้ เนื่องจากคุณไม่ใช่ช่างเทคนิคที่ทำการ Resolve incident นี้');
      } else {
        setError(err.message || 'ไม่สามารถอัพเดท resolution ได้');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Stop recording if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    newPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4 bg-black/50">
      {/* ✅ Dark theme glass-card */}
      <div className="glass-card border border-slate-700/50 rounded-xl w-full max-w-4xl max-h-[calc(100vh-88px)] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/30">
          <div>
            <h2 className="text-2xl font-bold text-white">Update Resolution</h2>
            <p className="text-sm text-gray-400 mt-1">
              แก้ไขรายละเอียด Resolution ก่อน Help Desk ยืนยัน
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* After Photos Section */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">
              After Photos (หลังซ่อม)
              <span className="text-gray-400 ml-2">
                {totalPhotos}/{MAX_PHOTOS} รูป
              </span>
            </label>

            {/* Existing Photos */}
            {existingPhotos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">รูปเดิม:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {existingPhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative group border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30 aspect-square"
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`Existing photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleRemoveExistingPhoto(index)}
                          disabled={isSubmitting}
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
              </div>
            )}

            {/* Upload New Photos */}
            {totalPhotos < MAX_PHOTOS && (
              <div>
                {newPhotos.length > 0 && (
                  <p className="text-xs text-gray-400 mb-2">รูปใหม่:</p>
                )}
                {/* Hidden inputs */}
                <input ref={galleryAfterRef} type="file" accept="image/*" multiple onChange={handleFileSelect} disabled={isSubmitting} className="hidden" />
                <input ref={cameraAfterRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} disabled={isSubmitting} className="hidden" />
                {/* Two buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => galleryAfterRef.current?.click()} disabled={isSubmitting}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-600/50 rounded-lg hover:border-blue-500/50 hover:bg-slate-700/20 transition-all disabled:opacity-50">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-sm text-gray-300">เลือกจากแกลเลอรี่</span>
                  </button>
                  <button type="button" onClick={() => cameraAfterRef.current?.click()} disabled={isSubmitting}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-blue-600/40 rounded-lg hover:border-blue-500/60 hover:bg-blue-900/10 transition-all disabled:opacity-50">
                    <Camera className="w-6 h-6 text-blue-400" />
                    <span className="text-sm text-blue-300">ถ่ายรูปด้วยกล้อง</span>
                  </button>
                </div>
              </div>
            )}

            {/* New Photos Preview */}
            {newPhotos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {newPhotos.map((file, index) => (
                  <div
                    key={index}
                    className="relative group border-2 border-blue-500/50 rounded-lg overflow-hidden bg-slate-800/30 aspect-square"
                  >
                    <img
                      src={newPhotoUrls[index]}
                      alt={`New photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium">
                      New
                    </span>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveNewPhoto(index)}
                        disabled={isSubmitting}
                        className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                      {existingPhotos.length + index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolution Note with Voice to Text */}
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
              disabled={isSubmitting}
              rows={6}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50 resize-none"
              placeholder="อธิบายรายละเอียดการแก้ไข... (อย่างน้อย 10 ตัวอักษร) หรือกดปุ่มไมค์เพื่อพูด"
            />
            
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {resolutionNote.length} ตัวอักษร{' '}
                {resolutionNote.length < 10 && `(ต้องการอีก ${10 - resolutionNote.length} ตัวอักษร)`}
              </p>
              
              {speechSupported && !isListening && (
                <p className="text-xs text-gray-500">
                  💡 กดปุ่มไมค์เพื่อใช้เสียงพูด
                </p>
              )}
            </div>
          </div>

          {/* Spare Parts Toggle */}
          <div>
            <label className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                checked={usedSpareParts}
                onChange={(e) => setUsedSpareParts(e.target.checked)}
                disabled={isSubmitting}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700/50 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer disabled:opacity-50"
              />
              <span className="text-gray-200 font-medium">ใช้ Spare Parts (อะไหล่)</span>
            </label>

            {usedSpareParts && (
              <SparePartForm
                spareParts={spareParts}
                onChange={setSpareParts}
                disabled={isSubmitting}
                storeId={storeId}
              />
            )}
          </div>

          {/* Signed Service Report Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              รูป Service Report ที่เซ็นแล้ว
              <span className="text-gray-400 ml-2">{totalSignedSrPhotos}/5 รูป</span>
            </label>
            <p className="text-xs text-amber-400/80 mb-3">⚠ ต้องอัปโหลดรูปนี้ หรือส่ง Service Report Online ให้ลูกค้าเซ็น ก่อนกดยืนยันปิดงาน</p>

            {/* Existing signed SR photos */}
            {existingSignedSrPhotos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">รูปเดิม:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {existingSignedSrPhotos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative group border border-amber-600/30 rounded-lg overflow-hidden bg-slate-800/30 aspect-square"
                    >
                      <img
                        src={getPhotoUrl(photo)}
                        alt={`Signed SR ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleRemoveExistingSignedSr(index)}
                          disabled={isSubmitting}
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
              </div>
            )}

            {/* Upload new signed SR photos */}
            {totalSignedSrPhotos < 5 && (
              <div>
                {newSignedSrPhotos.length > 0 && (
                  <p className="text-xs text-gray-400 mb-2">รูปใหม่:</p>
                )}
                {/* Hidden inputs */}
                <input ref={signedSrInputRef} type="file" accept="image/*" multiple onChange={handleSignedSrUpload} disabled={isSubmitting} className="hidden" />
                <input ref={cameraSrRef} type="file" accept="image/*" capture="environment" onChange={handleSignedSrUpload} disabled={isSubmitting} className="hidden" />
                {/* Two buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => signedSrInputRef.current?.click()} disabled={isSubmitting}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-amber-600/30 rounded-lg hover:border-amber-500/50 hover:bg-amber-900/10 transition-all disabled:opacity-50">
                    <Upload className="w-6 h-6 text-amber-400" />
                    <span className="text-sm text-amber-300">เลือกจากแกลเลอรี่</span>
                  </button>
                  <button type="button" onClick={() => cameraSrRef.current?.click()} disabled={isSubmitting}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-amber-600/40 rounded-lg hover:border-amber-500/60 hover:bg-amber-900/10 transition-all disabled:opacity-50">
                    <Camera className="w-6 h-6 text-amber-400" />
                    <span className="text-sm text-amber-300">ถ่ายรูปด้วยกล้อง</span>
                  </button>
                </div>
              </div>
            )}

            {/* New signed SR photos preview */}
            {newSignedSrPhotos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {newSignedSrPhotos.map((file, index) => (
                  <div
                    key={index}
                    className="relative group border-2 border-amber-500/50 rounded-lg overflow-hidden bg-slate-800/30 aspect-square"
                  >
                    <img
                      src={newSignedSrPhotoUrls[index]}
                      alt={`New Signed SR ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-1 bg-amber-600 text-white text-xs rounded font-medium">
                      New
                    </span>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveNewSignedSr(index)}
                        disabled={isSubmitting}
                        className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                      {existingSignedSrPhotos.length + index + 1}
                    </div>
                  </div>
                ))}
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
                <span>กำลังอัพเดท...</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                <span>Update Resolution</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
