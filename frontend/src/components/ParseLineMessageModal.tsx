// components/ParseLineMessageModal.tsx - Parse LINE message to auto-fill incident form
'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Search,
  CheckCircle,
  AlertTriangle,
  ClipboardPaste,
  ArrowRight,
  Store,
  FileText,
  AlertCircle as AlertIcon,
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react'
import { parseLineMessage, PRIORITY_DISPLAY, type ParsedLineMessage } from '@/utils/lineMessageParser'

interface StoreItem {
  id: number
  name: string
  storeCode: string
  province?: string
}

interface ParseLineMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (parsed: ParsedLineMessage, matchedStore: StoreItem | null) => void
  stores: StoreItem[]
}

export default function ParseLineMessageModal({
  isOpen,
  onClose,
  onApply,
  stores,
}: ParseLineMessageModalProps) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedLineMessage | null>(null)
  const [matchedStore, setMatchedStore] = useState<StoreItem | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleParse = () => {
    if (!text.trim()) return

    const result = parseLineMessage(text)
    setParsed(result)

    // Match store
    if (result.storeCode) {
      const found = stores.find(s => s.storeCode === result.storeCode)
      setMatchedStore(found || null)
    } else {
      setMatchedStore(null)
    }
  }

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      if (clipText) {
        setText(clipText)
        // Auto-parse after paste
        const result = parseLineMessage(clipText)
        setParsed(result)
        if (result.storeCode) {
          const found = stores.find(s => s.storeCode === result.storeCode)
          setMatchedStore(found || null)
        } else {
          setMatchedStore(null)
        }
      }
    } catch {
      // Clipboard API not available, user will paste manually
    }
  }

  const handleApply = () => {
    if (parsed) {
      onApply(parsed, matchedStore)
      handleClose()
    }
  }

  const handleClose = () => {
    setText('')
    setParsed(null)
    setMatchedStore(null)
    onClose()
  }

  // Auto-parse when text changes (debounced feel with onChange)
  const handleTextChange = (value: string) => {
    setText(value)
    // Clear previous parse if text changes
    if (parsed) {
      setParsed(null)
      setMatchedStore(null)
    }
  }

  if (!isOpen) return null

  const hasAnyResult = parsed && (
    parsed.storeCode || parsed.title || parsed.priority || parsed.date || parsed.time
  )

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00')
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
      <div className="glass-card border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Parse LINE Message</h2>
              <p className="text-xs text-gray-400">วางข้อความแล้วระบบจะแยกข้อมูลให้อัตโนมัติ</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">ข้อความจาก LINE</label>
              <button
                onClick={handlePaste}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-lg transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                วาง
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={"วางข้อความที่ได้รับจาก LINE ที่นี่...\n\nตัวอย่าง:\nแจ้งงานครับ\n3183 Big C Saraburi\nอาการ : PC Printer - HP 501 มีกระดาษติด\nsla : 1\nเปิดงาน : 21:16\nวันที่ 5/02/2026"}
              className="w-full h-40 sm:h-48 px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none text-sm leading-relaxed"
            />
          </div>

          {/* Parse Button */}
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" />
            แยกข้อมูล
          </button>

          {/* Parse Results */}
          {parsed && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="h-px flex-1 bg-slate-700"></div>
                <span>ผลลัพธ์</span>
                <div className="h-px flex-1 bg-slate-700"></div>
              </div>

              {/* Store */}
              <ResultRow
                icon={<Store className="w-4 h-4" />}
                label="สาขา"
                found={!!parsed.storeCode}
                value={
                  parsed.storeCode
                    ? matchedStore
                      ? `${matchedStore.storeCode} - ${matchedStore.name}${matchedStore.province ? ` (${matchedStore.province})` : ''}`
                      : `${parsed.storeCode} ${parsed.storeName || ''}`
                    : null
                }
                warning={parsed.storeCode && !matchedStore ? `ไม่พบสาขา "${parsed.storeCode}" ในระบบ` : undefined}
              />

              {/* Title */}
              <ResultRow
                icon={<FileText className="w-4 h-4" />}
                label="อาการ/หัวข้อ"
                found={!!parsed.title}
                value={parsed.title}
              />

              {/* Priority */}
              <ResultRow
                icon={<AlertIcon className="w-4 h-4" />}
                label="ความสำคัญ"
                found={!!parsed.priority}
                value={
                  parsed.priority
                    ? `${PRIORITY_DISPLAY[parsed.priority]?.label || parsed.priority} (SLA ${parsed.slaLevel})`
                    : null
                }
                valueClassName={parsed.priority ? PRIORITY_DISPLAY[parsed.priority]?.color : undefined}
              />

              {/* Date & Time */}
              <ResultRow
                icon={<Calendar className="w-4 h-4" />}
                label="วันที่"
                found={!!parsed.date}
                value={parsed.date ? formatDate(parsed.date) : null}
              />

              <ResultRow
                icon={<Clock className="w-4 h-4" />}
                label="เวลาเปิดงาน"
                found={!!parsed.time}
                value={parsed.time ? `${parsed.time} น.` : null}
              />

              {!hasAnyResult && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-center">
                  <p className="text-sm text-yellow-300">ไม่สามารถแยกข้อมูลได้ กรุณาตรวจสอบรูปแบบข้อความ</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 sm:p-5 border-t border-slate-700/50 bg-slate-800/30">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 text-gray-300 hover:bg-slate-700/50 rounded-xl font-medium transition-colors"
          >
            ยกเลิก
          </button>
          {parsed && hasAnyResult && (
            <button
              onClick={handleApply}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              นำไปกรอกฟอร์ม
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Helper Sub-component ---

function ResultRow({
  icon,
  label,
  found,
  value,
  warning,
  valueClassName,
}: {
  icon: React.ReactNode
  label: string
  found: boolean
  value: string | null
  warning?: string
  valueClassName?: string
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${
      found ? 'bg-green-900/10 border border-green-700/30' : 'bg-slate-800/50 border border-slate-700/30'
    }`}>
      <div className={`mt-0.5 ${found ? 'text-green-400' : 'text-gray-500'}`}>
        {found ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        {found && value ? (
          <p className={`text-sm font-medium truncate ${valueClassName || 'text-white'}`}>{value}</p>
        ) : (
          <p className="text-xs text-yellow-400/80">{warning || 'ไม่พบ - กรุณากรอกเอง'}</p>
        )}
      </div>
      <div className={`mt-0.5 ${found ? 'text-green-400' : 'text-gray-600'}`}>
        {icon}
      </div>
    </div>
  )
}
