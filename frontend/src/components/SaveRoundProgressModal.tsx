import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, MicOff, CheckCircle, ArrowRightLeft, Cpu, Plus } from 'lucide-react';
import SparePartEntryModal from './SparePartEntryModal';
import { SparePart } from './SparePartForm';
import axios from 'axios';

interface SaveRoundProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  incidentId: string;
  roundNumber: number;
  storeId?: number;
  incidentEquipmentIds?: number[];
  initialNote?: string;
  initialSpareParts?: SparePart[];
}

// Declare SpeechRecognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const SaveRoundProgressModal: React.FC<SaveRoundProgressModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  incidentId,
  roundNumber,
  storeId,
  incidentEquipmentIds,
  initialNote = '',
  initialSpareParts = [],
}) => {
  const [resolutionNote, setResolutionNote] = useState(initialNote);
  const [usedSpareParts, setUsedSpareParts] = useState(initialSpareParts.length > 0);
  const [spareParts, setSpareParts] = useState<SparePart[]>(initialSpareParts);
  const [sparePartEntryOpen, setSparePartEntryOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setResolutionNote(initialNote);
    setSpareParts(initialSpareParts);
    setUsedSpareParts(initialSpareParts.length > 0);
    setError('');
  }, [isOpen, initialNote, initialSpareParts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        setSpeechSupported(true);
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'th-TH';
        recognition.onresult = (event: any) => {
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
          }
          if (final) setResolutionNote((prev) => prev + final);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { try { recognitionRef.current.start(); setIsListening(true); } catch {} }
  };

  const handleSubmit = async () => {
    if (!resolutionNote.trim() && !usedSpareParts) {
      setError('กรุณาบันทึกรายละเอียดหรือระบุ Spare Parts');
      return;
    }
    if (usedSpareParts && spareParts.length === 0) {
      setError('กรุณาเพิ่ม Spare Parts อย่างน้อย 1 รายการ');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/save-round-progress`,
        { resolutionNote: resolutionNote.trim(), usedSpareParts, spareParts: usedSpareParts ? spareParts : [] },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPart = (part: SparePart) => {
    if (editingPart) {
      setSpareParts((prev) => prev.map((p) => (p.id === editingPart.id ? part : p)));
    } else {
      setSpareParts((prev) => [...prev, part]);
    }
    setEditingPart(null);
    setSparePartEntryOpen(false);
  };

  const handleEditPart = (part: SparePart) => {
    setEditingPart(part);
    setSparePartEntryOpen(true);
  };

  const handleDeletePart = (id: string) => {
    setSpareParts((prev) => prev.filter((p) => p.id !== id));
  };

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-card rounded-2xl w-full max-w-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            บันทึกความคืบหน้า (รอบที่ {roundNumber})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div ref={contentRef} className="overflow-y-auto p-5 space-y-4 flex-1">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>
          )}

          {/* Resolution Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">รายละเอียดที่ทำไปแล้ว / ปัญหาที่พบ</label>
              {speechSupported && (
                <button onClick={toggleVoice} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${isListening ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                  {isListening ? <><MicOff className="w-3 h-3" /><span>หยุดฟัง</span></> : <><Mic className="w-3 h-3" /><span>พูด</span></>}
                </button>
              )}
            </div>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={4}
              placeholder="บันทึกสิ่งที่ทำไปแล้ว อะไหล่ที่ใช้ไป ปัญหาที่พบ หรือสิ่งที่ต้องดำเนินการต่อในรอบต่อไป..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Spare Parts Toggle */}
          <div>
            <button
              onClick={() => { setUsedSpareParts(!usedSpareParts); if (usedSpareParts) setSpareParts([]); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${usedSpareParts ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {usedSpareParts ? 'มีการเปลี่ยน Spare Parts ✓' : 'มีการเปลี่ยน Spare Parts?'}
            </button>
          </div>

          {/* Spare Parts List */}
          {usedSpareParts && (
            <div className="space-y-2">
              {spareParts.map((part, idx) => (
                <div key={part.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {part.repairType === 'COMPONENT_REPLACEMENT'
                        ? <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        : <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      <span className="text-xs font-medium text-gray-300">รายการที่ {idx + 1}</span>
                    </div>
                    {part.repairType === 'COMPONENT_REPLACEMENT' ? (
                      <p className="text-xs text-gray-400 truncate">{part.componentName} | {part.oldComponentSerial} → {part.newComponentSerial}</p>
                    ) : (
                      <p className="text-xs text-gray-400 truncate">{part.oldDeviceName || part.oldSerialNo} → {part.newDeviceName || part.newSerialNo}</p>
                    )}
                    {part.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{part.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEditPart(part)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-500/10">แก้ไข</button>
                    <button onClick={() => handleDeletePart(part.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10">ลบ</button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setEditingPart(null); setSparePartEntryOpen(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-blue-500/30 rounded-xl text-sm text-blue-400 hover:bg-blue-500/10 transition"
              >
                <Plus className="w-4 h-4" />เพิ่ม Spare Part
              </button>
            </div>
          )}

          <p className="text-xs text-yellow-400/70 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            ⚠️ หลังบันทึก: ปุ่มปิดงานจะถูกซ่อน จนกว่า Supervisor จะกด "เริ่มรอบซ่อมใหม่"
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition border border-white/10">
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกความคืบหน้า'}
          </button>
        </div>
      </div>

      {/* Spare Part Entry Modal */}
      {sparePartEntryOpen && (
        <SparePartEntryModal
          isOpen={sparePartEntryOpen}
          onClose={() => { setSparePartEntryOpen(false); setEditingPart(null); }}
          onAdd={handleAddPart}
          initialPart={editingPart || undefined}
          storeId={storeId}
          incidentEquipmentIds={incidentEquipmentIds}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
};

export default SaveRoundProgressModal;
