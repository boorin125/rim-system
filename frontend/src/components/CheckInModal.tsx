// frontend/src/components/CheckInModal.tsx
'use client'

import { useState, useEffect, useRef } from 'react';
import { X, Upload, ImageIcon, Trash2, AlertCircle, Camera, Info, MapPin, Navigation, Plus, RefreshCw, FlipHorizontal2 } from 'lucide-react';
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

export default function CheckInModal({ isOpen, onClose, incidentId, onCheckIn }: CheckInModalProps) {
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');

  // GPS
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'success' | 'denied' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string>('');

  // Camera facing: environment = back, user = front
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 5;
  const MAX_TOTAL_SIZE = 10 * 1024 * 1024;

  const getTotalSize = () => beforePhotos.reduce((sum, f) => sum + f.size, 0);

  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('GPS ไม่รองรับบนอุปกรณ์นี้');
      return;
    }
    setGpsStatus('requesting');
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp });
        setGpsStatus('success');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) { setGpsStatus('denied'); setGpsError('กรุณาอนุญาตการเข้าถึงตำแหน่ง GPS ในการตั้งค่าเบราว์เซอร์'); }
        else { setGpsStatus('error'); setGpsError('ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่'); }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      setGpsLocation(null); setGpsStatus('idle'); setGpsError('');
      setTimeout(requestGPSLocation, 300);
    }
  }, [isOpen]);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (gpsStatus !== 'success') { setError('กรุณาอนุญาต GPS ก่อนดำเนินการ'); return; }
    setError('');
    if (beforePhotos.length + files.length > MAX_PHOTOS) { setError(`สามารถอัปโหลดได้สูงสุด ${MAX_PHOTOS} รูป`); return; }
    for (const file of files) {
      const v = validateImageFile(file, 10);
      if (!v.valid) { setError(v.error || 'ไฟล์ไม่ถูกต้อง'); return; }
    }
    try {
      const compressed = await compressImages(files, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 });
      const newSize = compressed.reduce((s, f) => s + f.size, 0);
      if (getTotalSize() + newSize > MAX_TOTAL_SIZE) { setError(`ขนาดรวมเกิน ${formatFileSize(MAX_TOTAL_SIZE)}`); return; }
      const urls = compressed.map((f) => URL.createObjectURL(f));
      setBeforePhotos((prev) => [...prev, ...compressed]);
      setPreviewUrls((prev) => [...prev, ...urls]);
    } catch { setError('ไม่สามารถประมวลผลรูปภาพได้'); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setBeforePhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenCamera = () => {
    // Re-render with latest cameraFacing before clicking
    setTimeout(() => cameraInputRef.current?.click(), 0);
  };

  const handleSubmit = async () => {
    if (beforePhotos.length === 0) { setError('กรุณาอัปโหลดอย่างน้อย 1 รูปก่อน Check In'); return; }
    if (getTotalSize() > MAX_TOTAL_SIZE) { setError('ขนาดรูปรวมเกินขีดจำกัด'); return; }
    setIsUploading(true); setError('');
    try {
      const base64Photos = await Promise.all(beforePhotos.map((file) =>
        new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); })
      ));
      await onCheckIn(base64Photos, gpsLocation || undefined);
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      onClose();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถ Check In ได้');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setBeforePhotos([]); setPreviewUrls([]); setError('');
    setGpsLocation(null); setGpsStatus('idle'); setGpsError('');
    onClose();
  };

  if (!isOpen) return null;

  const totalSize = getTotalSize();
  const totalSizePercent = (totalSize / MAX_TOTAL_SIZE) * 100;
  const canAddMore = beforePhotos.length < MAX_PHOTOS;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      {/* Sheet on mobile (bottom), centered dialog on sm+ */}
      <div className="glass-card border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-700/50 bg-slate-800/30 rounded-t-2xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Check In & เริ่มงาน</h2>
            <p className="text-xs text-gray-400 mt-0.5">อัปโหลดรูปก่อนซ่อมเพื่อเริ่มงาน</p>
          </div>
          <button onClick={handleClose} disabled={isUploading} className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 space-y-3">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* GPS Status — compact */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            gpsStatus === 'success' ? 'bg-green-900/20 border-green-700/50'
            : gpsStatus === 'denied' || gpsStatus === 'error' ? 'bg-yellow-900/20 border-yellow-700/50'
            : 'bg-slate-800/30 border-slate-700/50'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              {gpsStatus === 'requesting' ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                : gpsStatus === 'success' ? <MapPin className="w-4 h-4 text-green-400 shrink-0" />
                : gpsStatus === 'denied' || gpsStatus === 'error' ? <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                : <Navigation className="w-4 h-4 text-gray-400 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-white">
                  {gpsStatus === 'idle' && 'รอขอตำแหน่ง GPS'}
                  {gpsStatus === 'requesting' && 'กำลังขอ GPS...'}
                  {gpsStatus === 'success' && `GPS: ${gpsLocation?.latitude.toFixed(5)}, ${gpsLocation?.longitude.toFixed(5)}`}
                  {(gpsStatus === 'denied' || gpsStatus === 'error') && 'ไม่สามารถระบุตำแหน่งได้'}
                </p>
                {gpsError && <p className="text-xs text-yellow-300 truncate">{gpsError}</p>}
              </div>
            </div>
            {(gpsStatus === 'denied' || gpsStatus === 'error') && (
              <button onClick={requestGPSLocation} className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors shrink-0 ml-2">
                <RefreshCw className="w-3 h-3" /> ลองใหม่
              </button>
            )}
          </div>

          {/* Photo count + size */}
          {beforePhotos.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
              <span className="text-xs text-gray-300">รูป {beforePhotos.length}/{MAX_PHOTOS} • {formatFileSize(totalSize)}</span>
              <div className="w-24 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${totalSizePercent > 90 ? 'bg-red-500' : totalSizePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(totalSizePercent, 100)}%` }} />
              </div>
            </div>
          )}

          {/* Upload Area — hidden inputs */}
          <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} disabled={isUploading} className="hidden" />
          {/* Camera input — capture attribute switches based on cameraFacing */}
          <input
            key={cameraFacing}
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture={cameraFacing}
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />

          {/* Initial upload area (no photos yet) */}
          {beforePhotos.length === 0 && (
            <div className="space-y-2">
              {/* Camera buttons row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Take Photo button */}
                <button
                  onClick={handleOpenCamera}
                  disabled={isUploading}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 bg-blue-600/20 border-2 border-blue-500/50 rounded-xl hover:bg-blue-600/30 hover:border-blue-500 transition-all disabled:opacity-50"
                >
                  <Camera className="w-7 h-7 text-blue-400" />
                  <span className="text-xs font-medium text-blue-300">ถ่ายรูป</span>
                  <span className="text-[10px] text-blue-400/70">{cameraFacing === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'}</span>
                </button>

                {/* Gallery button */}
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 bg-slate-800/40 border-2 border-slate-600/50 rounded-xl hover:bg-slate-700/40 hover:border-slate-500 transition-all disabled:opacity-50"
                >
                  <Upload className="w-7 h-7 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">เลือกจากคลัง</span>
                  <span className="text-[10px] text-gray-500">Gallery</span>
                </button>
              </div>

              {/* Switch camera button */}
              <button
                onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700/30 rounded-lg transition-colors"
              >
                <FlipHorizontal2 className="w-4 h-4" />
                สลับเป็น{cameraFacing === 'environment' ? 'กล้องหน้า' : 'กล้องหลัง'}
              </button>

              <p className="text-center text-xs text-gray-500">เหลือ {MAX_PHOTOS} รูป • PNG, JPG, WebP</p>
            </div>
          )}

          {/* Photo grid */}
          {beforePhotos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-300 mb-2">รูปที่อัปโหลด ({beforePhotos.length}/{MAX_PHOTOS})</p>
              <div className="grid grid-cols-3 gap-2">
                {beforePhotos.map((file, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/30">
                    <img src={previewUrls[index]} alt={`รูป ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(index)}
                      disabled={isUploading}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1">
                      <p className="text-[10px] text-gray-300">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ))}

                {/* Add more card */}
                {canAddMore && (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-slate-600/50 bg-slate-800/20 flex flex-col items-center justify-center gap-1">
                    {/* Camera */}
                    <button onClick={handleOpenCamera} disabled={isUploading} className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-blue-600/20 transition-colors disabled:opacity-50">
                      <Camera className="w-5 h-5 text-blue-400" />
                      <span className="text-[10px] text-blue-400">ถ่าย</span>
                    </button>
                    {/* Gallery */}
                    <button onClick={() => galleryInputRef.current?.click()} disabled={isUploading} className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-slate-700/40 transition-colors disabled:opacity-50">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-[10px] text-gray-400">คลัง</span>
                    </button>
                    {/* Flip camera */}
                    <button onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                      {cameraFacing === 'environment' ? '↺ หน้า' : '↺ หลัง'}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick add row */}
              {canAddMore && (
                <div className="flex gap-2 mt-2">
                  <button onClick={handleOpenCamera} disabled={isUploading} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600/20 border border-blue-500/40 rounded-lg text-xs text-blue-300 hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                    <Camera className="w-3.5 h-3.5" /> ถ่ายรูป ({cameraFacing === 'environment' ? 'หลัง' : 'หน้า'})
                  </button>
                  <button onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')} className="px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700/60 transition-colors">
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => galleryInputRef.current?.click()} disabled={isUploading} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800/40 border border-slate-600/40 rounded-lg text-xs text-gray-300 hover:bg-slate-700/40 transition-colors disabled:opacity-50">
                    <Upload className="w-3.5 h-3.5" /> คลังรูป
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Compact tips */}
          <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <ImageIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200">ถ่ายให้เห็นปัญหาชัดเจน • ถ่าย Serial Number ถ้ามี • รูปจะถูกบีบอัดอัตโนมัติ</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-gray-400 hidden sm:block">Check In จะเริ่มนับเวลาทำงาน</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleClose} disabled={isUploading} className="flex-1 sm:flex-none px-4 py-2.5 text-sm text-gray-300 hover:bg-slate-700/50 rounded-xl font-medium transition-colors disabled:opacity-50">
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading || beforePhotos.length === 0 || gpsStatus !== 'success'}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลัง Check In...</>
              ) : (
                <><Camera className="w-4 h-4" /> Check In</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
