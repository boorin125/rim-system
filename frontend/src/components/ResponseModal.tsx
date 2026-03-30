// frontend/src/components/ResponseModal.tsx
// Modal for technician to submit response (ETA & message) before going onsite

import { useState, useEffect } from 'react'
import {
  X,
  Send,
  Clock,
  MessageSquare,
  AlertCircle,
  Loader2,
  CalendarDays,
  CheckCircle,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

interface ResponseModalProps {
  isOpen: boolean
  onClose: () => void
  incidentId: string
  ticketNumber: string
  onSuccess: () => void
}

export default function ResponseModal({
  isOpen,
  onClose,
  incidentId,
  ticketNumber,
  onSuccess,
}: ResponseModalProps) {
  const [estimatedDate, setEstimatedDate] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [responseMessage, setResponseMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Set default date/time to current + 1 hour
  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      now.setHours(now.getHours() + 1)
      now.setMinutes(0)

      const dateStr = now.toISOString().split('T')[0]
      const timeStr = now.toTimeString().slice(0, 5)

      setEstimatedDate(dateStr)
      setEstimatedTime(timeStr)
      setResponseMessage('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = async () => {
    // Validation
    if (!estimatedDate || !estimatedTime) {
      setError('กรุณาระบุวันและเวลาที่คาดว่าจะถึง')
      return
    }

    if (!responseMessage || responseMessage.trim().length < 5) {
      setError('กรุณากรอกข้อความอย่างน้อย 5 ตัวอักษร')
      return
    }

    // Combine date and time to ISO string
    const estimatedArrivalTime = new Date(`${estimatedDate}T${estimatedTime}:00`)

    // Validate that ETA is in the future
    if (estimatedArrivalTime <= new Date()) {
      setError('เวลาที่คาดว่าจะถึงต้องเป็นอนาคต')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/response`,
        {
          estimatedArrivalTime: estimatedArrivalTime.toISOString(),
          responseMessage: responseMessage.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      toast.success('แจ้งกำหนดการเข้าซ่อมสำเร็จ')
      onSuccess()
      onClose()
    } catch (err: any) {
      const message = err.response?.data?.message || 'ไม่สามารถแจ้งกำหนดการได้'
      // ถ้าเป็น error "ได้ตอบรับไปแล้ว" แปลว่า response สำเร็จแล้ว → ปิด modal และ refresh
      if (err.response?.status === 400 && message.includes('ตอบรับ')) {
        toast.success('ได้แจ้งกำหนดการเข้าซ่อมนี้ไปแล้ว')
        onSuccess()
        onClose()
      } else {
        setError(message)
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  if (!isOpen) return null

  // Format preview of ETA
  const etaPreview = estimatedDate && estimatedTime
    ? new Date(`${estimatedDate}T${estimatedTime}:00`).toLocaleString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="glass-card border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/50 bg-slate-800/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Response</h2>
              <p className="text-xs text-gray-400">แจ้งกำหนดการเข้าซ่อม {ticketNumber}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Info Banner */}
          <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-200">
                <p className="font-medium">แจ้งก่อนเดินทาง</p>
                <p className="text-xs text-purple-300/80 mt-1">
                  ระบบจะส่ง Email แจ้งเวลาที่คาดว่าจะถึงให้กับทีมงาน และบันทึกข้อมูลสำหรับประเมินผลงาน
                </p>
              </div>
            </div>
          </div>

          {/* ETA Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
              <CalendarDays className="w-4 h-4 text-purple-400" />
              เวลาที่คาดว่าจะถึงสาขา <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  value={estimatedDate}
                  onChange={(e) => setEstimatedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={estimatedTime.split(':')[0] || ''}
                  onChange={(e) => setEstimatedTime(`${e.target.value}:${estimatedTime.split(':')[1] || '00'}`)}
                  className="flex-1 px-3 py-3 bg-slate-800/80 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none text-center"
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-white font-bold text-lg">:</span>
                <select
                  value={estimatedTime.split(':')[1] || '00'}
                  onChange={(e) => setEstimatedTime(`${estimatedTime.split(':')[0] || '00'}:${e.target.value}`)}
                  className="flex-1 px-3 py-3 bg-slate-800/80 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none text-center"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400 ml-1">น.</span>
              </div>
            </div>
            {etaPreview && (
              <div className="mt-2 flex items-center gap-2 text-sm text-purple-300">
                <Clock className="w-4 h-4" />
                <span>{etaPreview}</span>
              </div>
            )}
          </div>

          {/* Message Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              ข้อความ <span className="text-red-400">*</span>
            </label>
            <textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="เช่น กำลังเดินทาง, ติดต่อสาขาแล้ว, รอรับอะไหล่..."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
            <div className="mt-1 text-right text-xs text-gray-500">
              {responseMessage.length}/1000
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 sm:p-5 border-t border-slate-700/50 bg-slate-800/30">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 text-gray-300 hover:bg-slate-700/50 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !estimatedDate || !estimatedTime || responseMessage.length < 5}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                แจ้งกำหนดการเข้าซ่อม
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
