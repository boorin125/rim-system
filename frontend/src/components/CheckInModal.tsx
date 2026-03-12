// frontend/src/components/CheckInModal.tsx - UPDATED with GPS & Better Compression

import { useState, useEffect, useRef } from 'react';
import { X, Upload, ImageIcon, Trash2, AlertCircle, Camera, Info, MapPin, Navigation, Plus, RefreshCw } from 'lucide-react';
import { compressImages, validateImageFile, formatFileSize } from '@/utils/imageUtils';

interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  onCheckIn: (beforePhotos: string[], gpsLocation?: GPSLocation) => Promise<void>;
}

export default function CheckInModal({
  isOpen,
  onClose,
  incidentId,
  onCheckIn,
}: CheckInModalProps) {
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');

  // GPS States
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'success' | 'denied' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string>('');
  const gpsRequestedRef = useRef(false);

  const MAX_PHOTOS = 5;
  const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total limit
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate total size of all photos
  const getTotalSize = () => {
    return beforePhotos.reduce((sum, file) => sum + file.size, 0);
  };

  // Request GPS location
  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('GPS ไม่รองรับบนอุปกรณ์นี้');
      return;
    }

    setGpsStatus('requesting');
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: GPSLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setGpsLocation(location);
        setGpsStatus('success');
      },
      (error) => {
        console.error('GPS Error:', error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsStatus('denied');
            setGpsError('กรุณาอนุญาตการเข้าถึงตำแหน่ง GPS ในการตั้งค่าเบราว์เซอร์');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsStatus('error');
            setGpsError('ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่');
            break;
          case error.TIMEOUT:
            setGpsStatus('error');
            setGpsError('หมดเวลาในการขอตำแหน่ง กรุณาลองใหม่');
            break;
          default:
            setGpsStatus('error');
            setGpsError('เกิดข้อผิดพลาดในการขอตำแหน่ง GPS');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Request GPS immediately when modal opens
  useEffect(() => {
    if (isOpen) {
      gpsRequestedRef.current = false;
      setGpsLocation(null);
      setGpsStatus('idle');
      setGpsError('');
      // Auto-request GPS on open
      setTimeout(() => {
        requestGPSLocation();
      }, 300);
    }
  }, [isOpen]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Block upload if GPS not granted
    if (gpsStatus !== 'success') {
      setError('กรุณาอนุญาติ GPS ก่อนดำเนินการ');
      if (e.target) e.target.value = '';
      return;
    }

    setError('');

    // Check total count
    if (beforePhotos.length + files.length > MAX_PHOTOS) {
      setError(`สามารถอัปโหลดได้สูงสุด ${MAX_PHOTOS} รูป`);
      return;
    }

    // Validate each file
    for (const file of files) {
      const validation = validateImageFile(file, 10);
      if (!validation.valid) {
        setError(validation.error || 'ไฟล์ไม่ถูกต้อง');
        return;
      }
    }

    try {
      // Compress with better settings
      const compressed = await compressImages(files, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.75,
      });

      // Check total size after compression
      const currentSize = getTotalSize();
      const newSize = compressed.reduce((sum, file) => sum + file.size, 0);

      if (currentSize + newSize > MAX_TOTAL_SIZE) {
        setError(`ขนาดรวมเกิน ${formatFileSize(MAX_TOTAL_SIZE)} กรุณาใช้รูปที่น้อยกว่าหรือเล็กกว่า`);
        return;
      }

      // Create preview URLs
      const urls = compressed.map((file) => URL.createObjectURL(file));

      setBeforePhotos((prev) => [...prev, ...compressed]);
      setPreviewUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      setError('ไม่สามารถประมวลผลรูปภาพได้');
      console.error(err);
    }

    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    // Revoke URL to free memory
    URL.revokeObjectURL(previewUrls[index]);

    setBeforePhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMorePhotos = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (beforePhotos.length === 0) {
      setError('กรุณาอัปโหลดอย่างน้อย 1 รูปก่อน Check In');
      return;
    }

    // Check total size before upload
    const totalSize = getTotalSize();
    if (totalSize > MAX_TOTAL_SIZE) {
      setError(`ขนาดรวม (${formatFileSize(totalSize)}) เกินขีดจำกัด (${formatFileSize(MAX_TOTAL_SIZE)})`);
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Convert to base64
      const base64Photos = await Promise.all(
        beforePhotos.map((file) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      // Pass GPS location if available
      await onCheckIn(base64Photos, gpsLocation || undefined);

      // Clean up
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      onClose();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถ Check In ได้');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Clean up URLs
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setBeforePhotos([]);
    setPreviewUrls([]);
    setError('');
    setGpsLocation(null);
    setGpsStatus('idle');
    setGpsError('');
    gpsRequestedRef.current = false;
    onClose();
  };

  if (!isOpen) return null;

  const totalSize = getTotalSize();
  const totalSizePercent = (totalSize / MAX_TOTAL_SIZE) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/30">
          <div>
            <h2 className="text-2xl font-bold text-white">Check In</h2>
            <p className="text-sm text-gray-300 mt-1">
              อัปโหลดรูปก่อนเริ่มงานเพื่อเริ่มทำงาน
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">ไม่สามารถดำเนินการได้</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* GPS Status */}
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            gpsStatus === 'success'
              ? 'bg-green-900/20 border-green-700/50'
              : gpsStatus === 'denied' || gpsStatus === 'error'
              ? 'bg-yellow-900/20 border-yellow-700/50'
              : 'bg-slate-800/30 border-slate-700/50'
          }`}>
            <div className="flex items-center gap-3">
              {gpsStatus === 'requesting' ? (
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              ) : gpsStatus === 'success' ? (
                <MapPin className="w-5 h-5 text-green-400" />
              ) : gpsStatus === 'denied' || gpsStatus === 'error' ? (
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              ) : (
                <Navigation className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {gpsStatus === 'idle' && 'GPS จะถูกขอเมื่อเพิ่มรูปแรก'}
                  {gpsStatus === 'requesting' && 'กำลังขอตำแหน่ง GPS...'}
                  {gpsStatus === 'success' && 'บันทึกตำแหน่งแล้ว'}
                  {(gpsStatus === 'denied' || gpsStatus === 'error') && 'ไม่สามารถระบุตำแหน่งได้'}
                </p>
                {gpsStatus === 'success' && gpsLocation && (
                  <p className="text-xs text-gray-400 mt-1">
                    {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                    <span className="text-gray-500"> (ความแม่นยำ {Math.round(gpsLocation.accuracy)} เมตร)</span>
                  </p>
                )}
                {gpsError && (
                  <p className="text-xs text-yellow-300 mt-1">{gpsError}</p>
                )}
              </div>
            </div>
            {(gpsStatus === 'denied' || gpsStatus === 'error') && (
              <button
                onClick={requestGPSLocation}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                ลองใหม่
              </button>
            )}
          </div>

          {/* Total Size Indicator */}
          {beforePhotos.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">
                  ขนาดรวม: <span className="font-semibold text-white">{formatFileSize(totalSize)}</span>
                  <span className="text-gray-400"> / {formatFileSize(MAX_TOTAL_SIZE)}</span>
                </span>
              </div>
              {/* Size Progress Bar */}
              <div className="w-32 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    totalSizePercent > 90 ? 'bg-red-500' :
                    totalSizePercent > 70 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(totalSizePercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-200">
                รูปก่อนทำงาน ({beforePhotos.length}/{MAX_PHOTOS})
              </label>
              {beforePhotos.length > 0 && beforePhotos.length < MAX_PHOTOS && (
                <button
                  onClick={handleAddMorePhotos}
                  disabled={isUploading}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มรูป
                </button>
              )}
            </div>

            {/* Hidden file input for "Add More" button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />

            {beforePhotos.length < MAX_PHOTOS && beforePhotos.length === 0 && (
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-slate-600/50 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-slate-800/30 transition-all cursor-pointer group">
                  <div className="relative">
                    <Upload className="w-12 h-12 text-gray-400 group-hover:text-blue-400 mx-auto mb-3 transition-colors" />
                    <Camera className="w-6 h-6 text-blue-400 absolute top-0 right-1/2 translate-x-8 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm font-medium text-gray-200 mb-1">
                    คลิกเพื่ออัปโหลดรูป
                  </p>
                  <p className="text-xs text-gray-400">
                    PNG, JPG, WebP • สูงสุด 10MB ต่อรูป
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    เหลืออีก {MAX_PHOTOS - beforePhotos.length} รูป
                  </p>
                  <p className="text-xs text-blue-400 mt-2">
                    รูปจะถูกบีบอัดเป็น 1600x1600 @ 75%
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Photo Previews */}
          {beforePhotos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-200">
                รูปที่อัปโหลด
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {beforePhotos.map((file, index) => (
                  <div
                    key={index}
                    className="relative group aspect-square rounded-lg overflow-hidden border-2 border-slate-700/50 bg-slate-800/30"
                  >
                    <img
                      src={previewUrls[index]}
                      alt={`รูปก่อนทำงาน ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Delete Button - Always visible on mobile */}
                    <button
                      onClick={() => handleRemovePhoto(index)}
                      disabled={isUploading}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 opacity-80 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* File Info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-300">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Add More Button Card */}
                {beforePhotos.length < MAX_PHOTOS && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-slate-600/50 bg-slate-800/20 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-800/40 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      disabled={isUploading}
                      className="hidden"
                    />
                    <Plus className="w-8 h-8 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-400">เพิ่มรูป</p>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <ImageIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-medium mb-1">เคล็ดลับการถ่ายรูป:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>ถ่ายรูปชัด สว่าง ของอุปกรณ์</li>
                <li>ถ่ายรูปปัญหาหรือจุดที่ต้องทำงาน</li>
                <li>ถ่าย Serial Number หรือป้ายชื่อถ้ามี</li>
                <li>รูปจะถูกบีบอัดอัตโนมัติเพื่อลดเวลาอัปโหลด</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-700/50 bg-slate-800/30">
          <p className="text-sm text-gray-300">
            Check In จะเริ่มนับเวลาทำงาน
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading || beforePhotos.length === 0 || gpsStatus !== 'success'}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลัง Check In...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Check In & เริ่มงาน
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
