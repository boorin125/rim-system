// components/ReassignmentHistory.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import axios from 'axios'
import { formatDateTime } from '@/utils/dateUtils'

interface Reassignment {
  id: number
  reason: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  responseNote?: string
  reassignedAt: string
  respondedAt?: string
  fromTechnician: {
    id: number
    firstName: string
    lastName: string
    email: string
  }
  toTechnician: {
    id: number
    firstName: string
    lastName: string
    email: string
  }
  reassignedBy: {
    id: number
    firstName: string
    lastName: string
  }
}

interface ReassignmentHistoryProps {
  incidentId: string
}

export default function ReassignmentHistory({ incidentId }: ReassignmentHistoryProps) {
  const [reassignments, setReassignments] = useState<Reassignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    fetchReassignments()
  }, [incidentId])

  const fetchReassignments = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/reassignments/incidents/${incidentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setReassignments(response.data || [])
    } catch (error) {
      console.error('Failed to fetch reassignment history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: React.ReactNode; className: string; text: string }> = {
      PENDING: {
        icon: <Clock className="w-3 h-3" />,
        className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        text: 'Pending',
      },
      ACCEPTED: {
        icon: <CheckCircle className="w-3 h-3" />,
        className: 'bg-green-500/20 text-green-400 border-green-500/30',
        text: 'Accepted',
      },
      REJECTED: {
        icon: <XCircle className="w-3 h-3" />,
        className: 'bg-red-500/20 text-red-400 border-red-500/30',
        text: 'Rejected',
      },
    }
    return badges[status] || badges.PENDING
  }

  if (isLoading) {
    return null
  }

  if (reassignments.length === 0) {
    return null // Don't show if no history
  }

  return (
    <div className="glass-card p-6 rounded-2xl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <UserPlus className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">
              Reassignment History
            </h3>
            <p className="text-sm text-gray-400">
              {reassignments.length} reassignment{reassignments.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {reassignments.map((reassignment, index) => {
            const statusBadge = getStatusBadge(reassignment.status)
            return (
              <div
                key={reassignment.id}
                className="relative pl-8 pb-4 last:pb-0"
              >
                {/* Timeline line */}
                {index < reassignments.length - 1 && (
                  <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-700" />
                )}

                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border ${statusBadge.className}`}
                >
                  {statusBadge.icon}
                </div>

                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${statusBadge.className}`}
                    >
                      {statusBadge.icon}
                      {statusBadge.text}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(reassignment.reassignedAt)}
                    </span>
                  </div>

                  {/* Transfer Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-gray-500">From</p>
                      <p className="text-sm text-white">
                        {reassignment.fromTechnician.firstName}{' '}
                        {reassignment.fromTechnician.lastName}
                      </p>
                    </div>
                    <div className="text-gray-600">→</div>
                    <div className="flex-1 p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-gray-500">To</p>
                      <p className="text-sm text-white">
                        {reassignment.toTechnician.firstName}{' '}
                        {reassignment.toTechnician.lastName}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">Reason</p>
                    <p className="text-sm text-gray-300">{reassignment.reason}</p>
                  </div>

                  {/* Response Note (if rejected) */}
                  {reassignment.status === 'REJECTED' && reassignment.responseNote && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-300">{reassignment.responseNote}</p>
                    </div>
                  )}

                  {/* Response Time */}
                  {reassignment.respondedAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Responded: {formatDateTime(reassignment.respondedAt)}
                    </p>
                  )}

                  {/* Reassigned By */}
                  <p className="text-xs text-gray-500 mt-1">
                    Requested by: {reassignment.reassignedBy.firstName}{' '}
                    {reassignment.reassignedBy.lastName}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
