// app/rate/[token]/page.tsx - Public Rating Page (No Login Required)
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Star,
  CheckCircle,
  AlertCircle,
  Building2,
  User,
  Calendar,
  Send,
  Loader2,
} from 'lucide-react'
import axios from 'axios'

interface IncidentInfo {
  ticketNumber: string
  title: string
  description?: string
  category?: string
  closedAt?: string
  store?: {
    id: number
    storeCode: string
    name: string
  }
  technician?: {
    firstName: string
    lastName: string
  }
}

interface ExistingRating {
  rating: number
  comment?: string
  createdAt: string
}

export default function PublicRatingPage() {
  const params = useParams()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [submissionExpired, setSubmissionExpired] = useState(false)
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(null)
  const [incident, setIncident] = useState<IncidentInfo | null>(null)

  // Rating Form State - Default 5 stars
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [qualityRating, setQualityRating] = useState(5)
  const [professionalismRating, setProfessionalismRating] = useState(5)
  const [politenessRating, setPolitenessRating] = useState(5)
  const [raterName, setRaterName] = useState('')
  const [raterEmail, setRaterEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Auto-calculate overall rating from detail ratings
  const recalcOverall = (q: number, p: number, pol: number) => {
    setRating(Math.round((q + p + pol) / 3))
  }

  const handleQualityChange = (v: number) => {
    setQualityRating(v)
    recalcOverall(v, professionalismRating, politenessRating)
  }
  const handleProfessionalismChange = (v: number) => {
    setProfessionalismRating(v)
    recalcOverall(qualityRating, v, politenessRating)
  }
  const handlePolitenessChange = (v: number) => {
    setPolitenessRating(v)
    recalcOverall(qualityRating, professionalismRating, v)
  }

  useEffect(() => {
    if (token) {
      fetchIncidentInfo()
    }
  }, [token])

  const fetchIncidentInfo = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/public/ratings/${token}`
      )

      if (response.data.alreadyRated) {
        setAlreadyRated(true)
        setExistingRating(response.data.rating)
        setIncident(response.data.incident)
      } else {
        setIncident(response.data.incident)
        if (response.data.submissionExpired) {
          setSubmissionExpired(true)
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      alert('กรุณาให้คะแนน')
      return
    }

    try {
      setIsSubmitting(true)

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/public/ratings/${token}`,
        {
          rating,
          comment: comment || undefined,
          qualityRating: qualityRating || undefined,
          professionalismRating: professionalismRating || undefined,
          politenessRating: politenessRating || undefined,
          raterName: raterName || undefined,
          raterEmail: raterEmail || undefined,
        }
      )

      setIsSubmitted(true)
    } catch (err: any) {
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Star Rating Component
  const StarRating = ({
    value,
    onChange,
    hoverValue,
    onHover,
    size = 'large',
  }: {
    value: number
    onChange: (v: number) => void
    hoverValue?: number
    onHover?: (v: number) => void
    size?: 'small' | 'large'
  }) => {
    const sizeClass = size === 'large' ? 'w-10 h-10' : 'w-6 h-6'

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => onHover?.(star)}
            onMouseLeave={() => onHover?.(0)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`${sizeClass} ${
                star <= (hoverValue || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">ไม่พบลิงก์</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  // Success State (After Submit)
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">ขอบคุณสำหรับการประเมิน!</h1>
          <p className="text-gray-400 mb-6">
            ความคิดเห็นของคุณจะช่วยให้เราปรับปรุงบริการให้ดียิ่งขึ้น
          </p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 ${
                  star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                }`}
              />
            ))}
          </div>
          {comment && (
            <p className="mt-4 text-gray-400 italic">"{comment}"</p>
          )}
        </div>
      </div>
    )
  }

  // Already Rated State
  if (alreadyRated && existingRating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">ขอบคุณที่ให้คะแนนแล้ว</h1>
          <p className="text-gray-400 mb-6">
            คุณได้ประเมิน {incident?.ticketNumber} เรียบร้อยแล้ว
          </p>
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 ${
                  star <= existingRating.rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-600'
                }`}
              />
            ))}
          </div>
          {existingRating.comment && (
            <p className="text-gray-400 italic">"{existingRating.comment}"</p>
          )}
          <p className="text-xs text-gray-500 mt-4">
            ประเมินเมื่อ{' '}
            {new Date(existingRating.createdAt).toLocaleDateString('th-TH', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>
    )
  }

  // Submission Expired State (3 days passed - view only)
  if (submissionExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">ระยะเวลาการประเมินหมดอายุ</h1>
          <p className="text-gray-400 mb-4">
            ลิงก์ประเมินสำหรับ {incident?.ticketNumber} ได้เกินกำหนด 3 วันแล้ว
          </p>
          <p className="text-gray-500 text-sm mb-6">
            ระบบจะให้คะแนนเต็ม 5 ดาวโดยอัตโนมัติ
          </p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="w-8 h-8 fill-yellow-400 text-yellow-400"
              />
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-4">
            คะแนนเต็มอัตโนมัติ (Default 5 Stars)
          </p>
        </div>
      </div>
    )
  }

  // Rating Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">ประเมินบริการ</h1>
          <p className="text-gray-400">
            กรุณาให้คะแนนการบริการของเรา
          </p>
        </div>

        {/* Incident Info Card */}
        <div className="glass-card p-6 rounded-2xl mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-1">หมายเลขงาน</p>
              <p className="text-lg font-semibold text-white mb-2">
                {incident?.ticketNumber}
              </p>
              <p className="text-white mb-3">{incident?.title}</p>
              <div className="space-y-1 text-sm text-gray-400">
                {incident?.store && (
                  <p className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {incident.store.name}
                  </p>
                )}
                {incident?.technician && (
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {incident.technician.firstName} {incident.technician.lastName}
                  </p>
                )}
                {incident?.closedAt && (
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(incident.closedAt).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rating Form */}
        <form onSubmit={handleSubmit} noValidate className="glass-card p-6 rounded-2xl">
          {/* Overall Rating */}
          <div className="text-center mb-8">
            <p className="text-gray-400 mb-4">คะแนนโดยรวม *</p>
            <div className="flex justify-center">
              <StarRating
                value={rating}
                onChange={setRating}
                hoverValue={hoverRating}
                onHover={setHoverRating}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {rating === 1 && 'ควรปรับปรุง'}
              {rating === 2 && 'พอใช้'}
              {rating === 3 && 'ปานกลาง'}
              {rating === 4 && 'ดี'}
              {rating === 5 && 'ยอดเยี่ยม'}
            </p>
          </div>

          {/* Detailed Ratings (Optional) */}
          <div className="mb-8">
            <p className="text-gray-400 text-sm mb-4">คะแนนรายละเอียด (ไม่บังคับ)</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">คุณภาพงาน</span>
                <StarRating
                  value={qualityRating}
                  onChange={handleQualityChange}
                  size="small"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">ความเป็นมืออาชีพ</span>
                <StarRating
                  value={professionalismRating}
                  onChange={handleProfessionalismChange}
                  size="small"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">ความสุภาพเรียบร้อย</span>
                <StarRating
                  value={politenessRating}
                  onChange={handlePolitenessChange}
                  size="small"
                />
              </div>
            </div>
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2">
              ความคิดเห็นเพิ่มเติม (ไม่บังคับ)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="บอกเล่าประสบการณ์ของคุณ..."
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              maxLength={1000}
            />
          </div>

          {/* Rater Info (Optional) */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                ชื่อ (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={raterName}
                onChange={(e) => setRaterName(e.target.value)}
                placeholder="ชื่อของคุณ"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                อีเมล (ไม่บังคับ)
              </label>
              <input
                type="email"
                value={raterEmail}
                onChange={(e) => setRaterEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                ส่งการประเมิน
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          ความคิดเห็นของคุณช่วยให้เราพัฒนาบริการให้ดียิ่งขึ้น ขอบคุณ!
        </p>
      </div>
    </div>
  )
}
