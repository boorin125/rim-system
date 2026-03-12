// app/incident/[token]/page.tsx - Public Read-Only Incident View (No Login Required)
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  FileText,
  MapPin,
  User,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  Camera,
  Wrench,
  Loader2,
  AlertCircle,
  ExternalLink,
  X,
} from 'lucide-react'
import axios from 'axios'
import { getPhotoUrl } from '@/utils/photoUtils'

interface PublicIncident {
  organizationName?: string
  ticketNumber: string
  title: string
  description?: string
  status: string
  priority: string
  category?: string
  subCategory?: string
  store?: {
    storeCode: string
    name: string
    address?: string
    province?: string
  }
  technician?: { name: string }
  resolvedBy?: { name: string }
  confirmedBy?: { name: string }
  resolutionNote?: string
  usedSpareParts: boolean
  spareParts: {
    deviceName: string
    oldSerialNo: string
    newSerialNo: string
    repairType: string
  }[]
  beforePhotos?: string[]
  afterPhotos?: string[]
  createdAt: string
  resolvedAt?: string
  confirmedAt?: string
  checkInAt?: string
  rating?: {
    rating: number
    comment?: string
    qualityRating?: number
    professionalismRating?: number
    politenessRating?: number
    createdAt: string
  }
  isRated: boolean
  serviceReportToken?: string | null
}

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400',
  HIGH: 'bg-orange-500/20 text-orange-400',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400',
  LOW: 'bg-blue-500/20 text-blue-400',
}

const statusColors: Record<string, string> = {
  CLOSED: 'bg-green-500/20 text-green-400',
  RESOLVED: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400',
  ASSIGNED: 'bg-purple-500/20 text-purple-400',
  OPEN: 'bg-gray-500/20 text-gray-400',
}

export default function PublicIncidentPage() {
  const params = useParams()
  const token = params.token as string

  const [incident, setIncident] = useState<PublicIncident | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const fetchIncident = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/public/incidents/${token}`
        )
        setIncident(res.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'ไม่พบข้อมูล Incident')
      } finally {
        setIsLoading(false)
      }
    }

    fetchIncident()
  }, [token])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading incident...</p>
        </div>
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center glass-card p-8 rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Incident Not Found</h2>
          <p className="text-gray-400">{error || 'ไม่พบข้อมูล Incident'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="fixed inset-0 bg-pattern"></div>

      <div className="relative z-10 max-w-3xl mx-auto p-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Incident Details</h1>
          <p className="text-gray-400 mt-2">{incident.organizationName ? `${incident.organizationName} Incident Management` : 'Incident Management'}</p>
        </div>

        {/* Main Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Status Bar */}
          <div className="p-6 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">{incident.ticketNumber}</h2>
              <p className="text-gray-400 text-sm mt-1">{incident.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[incident.status] || 'bg-gray-500/20 text-gray-400'}`}>
                {incident.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[incident.priority] || 'bg-gray-500/20 text-gray-400'}`}>
                {incident.priority}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Description */}
            {incident.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Description
                </h3>
                <p className="text-gray-300 whitespace-pre-wrap">{incident.description}</p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Store */}
              {incident.store && (
                <InfoCard
                  icon={MapPin}
                  label="Store"
                  value={`${incident.store.storeCode} - ${incident.store.name}`}
                  sub={incident.store.province || undefined}
                />
              )}

              {/* Category */}
              {incident.category && (
                <InfoCard
                  icon={FileText}
                  label="Category"
                  value={incident.category}
                  sub={incident.subCategory || undefined}
                />
              )}

              {/* Technician */}
              {incident.technician && (
                <InfoCard
                  icon={User}
                  label="Technician"
                  value={incident.technician.name}
                />
              )}

              {/* Resolved By */}
              {incident.resolvedBy && (
                <InfoCard
                  icon={CheckCircle}
                  label="Resolved By"
                  value={incident.resolvedBy.name}
                />
              )}

              {/* Timeline */}
              <InfoCard
                icon={Calendar}
                label="Created"
                value={formatDate(incident.createdAt)}
              />

              {incident.checkInAt && (
                <InfoCard
                  icon={Clock}
                  label="Check-In"
                  value={formatDate(incident.checkInAt)}
                />
              )}

              {incident.resolvedAt && (
                <InfoCard
                  icon={CheckCircle}
                  label="Resolved"
                  value={formatDate(incident.resolvedAt)}
                />
              )}

              {incident.confirmedAt && (
                <InfoCard
                  icon={CheckCircle}
                  label="Confirmed Closed"
                  value={formatDate(incident.confirmedAt)}
                />
              )}
            </div>

            {/* Resolution Note */}
            {incident.resolutionNote && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Resolution Note
                </h3>
                <div className="bg-slate-800/50 p-4 rounded-xl text-gray-300 whitespace-pre-wrap">
                  {incident.resolutionNote}
                </div>
              </div>
            )}

            {/* Spare Parts */}
            {incident.usedSpareParts && incident.spareParts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Spare Parts Used
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left py-2 px-3 text-gray-400">#</th>
                        <th className="text-left py-2 px-3 text-gray-400">Old Equipment</th>
                        <th className="text-left py-2 px-3 text-gray-400">Old Serial No.</th>
                        <th className="text-center py-2 px-3 text-gray-400 w-8"></th>
                        <th className="text-left py-2 px-3 text-gray-400">New Equipment</th>
                        <th className="text-left py-2 px-3 text-gray-400">New Serial No.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incident.spareParts.map((sp, idx) => {
                        const names = sp.deviceName?.includes(' → ')
                          ? sp.deviceName.split(' → ')
                          : [sp.deviceName, sp.deviceName]
                        return (
                          <tr key={idx} className="border-b border-slate-700/30">
                            <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                            <td className="py-2 px-3 text-gray-300">{(names[0] || '').trim()}</td>
                            <td className="py-2 px-3 text-gray-400 font-mono text-xs">{sp.oldSerialNo}</td>
                            <td className="py-2 px-3 text-center text-green-400">→</td>
                            <td className="py-2 px-3 text-white font-medium">{(names[1] || names[0] || '').trim()}</td>
                            <td className="py-2 px-3 text-green-400 font-mono text-xs">{sp.newSerialNo}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Photos */}
            {(incident.beforePhotos?.length || incident.afterPhotos?.length) ? (
              <div className="space-y-6">
                {incident.beforePhotos && incident.beforePhotos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Before Photos
                    </h3>
                    <div className="grid grid-cols-5 gap-2">
                      {incident.beforePhotos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={getPhotoUrl(photo)}
                          alt={`Before ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-slate-700/50 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxPhoto(getPhotoUrl(photo))}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {incident.afterPhotos && incident.afterPhotos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> After Photos
                    </h3>
                    <div className="grid grid-cols-5 gap-2">
                      {incident.afterPhotos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={getPhotoUrl(photo)}
                          alt={`After ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-slate-700/50 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxPhoto(getPhotoUrl(photo))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Rating */}
            {incident.isRated && incident.rating && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
                <h3 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Customer Rating
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= incident.rating!.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-600'
                      }`}
                    />
                  ))}
                  <span className="text-white font-semibold ml-2">{incident.rating.rating}/5</span>
                </div>
                {incident.rating.comment && (
                  <p className="text-gray-300 text-sm mt-2">{incident.rating.comment}</p>
                )}
              </div>
            )}

            {/* Rate button if not rated */}
            {!incident.isRated && (
              <div className="text-center pt-4">
                <a
                  href={`/rate/${token}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                >
                  <Star className="w-5 h-5" />
                  Rate This Service
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Service Report Link */}
            {incident.serviceReportToken && (
              <div className="text-center pt-4">
                <a
                  href={`/service-report/${incident.serviceReportToken}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  Service Report / เอกสารปิดงาน
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>{incident.organizationName ? `${incident.organizationName} Incident Management System` : 'Incident Management System'}</p>
        </div>

        {/* Photo Lightbox */}
        {lightboxPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              onClick={() => setLightboxPhoto(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={lightboxPhoto}
              alt="Enlarged photo"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-slate-800/50 p-3 rounded-xl">
      <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-white text-sm font-medium">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}
