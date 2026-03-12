// components/PendingReassignments.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { formatDateTime } from '@/utils/dateUtils'

interface ReassignmentRequest {
  id: number
  reason: string
  reassignedAt: string
  incident: {
    id: string
    ticketNumber: string
    title: string
    priority: string
    status: string
    store: {
      id: number
      storeCode: string
      name: string
    }
  }
  fromTechnician: {
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

interface RespondModalProps {
  request: ReassignmentRequest | null
  action: 'accept' | 'reject' | null
  onClose: () => void
  onConfirm: (responseNote?: string) => void
  isSubmitting: boolean
}

function RespondModal({ request, action, onClose, onConfirm, isSubmitting }: RespondModalProps) {
  const [responseNote, setResponseNote] = useState('')

  if (!request || !action) return null

  const isReject = action === 'reject'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 rounded-2xl max-w-md w-full animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-full ${isReject ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
            {isReject ? (
              <XCircle className="w-6 h-6 text-red-400" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isReject ? 'Reject Reassignment' : 'Accept Reassignment'}
            </h3>
            <p className="text-sm text-gray-400">{request.incident.ticketNumber}</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
          <p className="text-white font-medium mb-1">{request.incident.title}</p>
          <p className="text-sm text-gray-400">
            From: {request.fromTechnician.firstName} {request.fromTechnician.lastName}
          </p>
        </div>

        {isReject && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Rejection <span className="text-red-400">*</span>
            </label>
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder="Enter reason (minimum 10 characters)..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              required
              minLength={10}
            />
            <p className="text-xs text-gray-500 mt-1">{responseNote.length}/10 minimum</p>
          </div>
        )}

        {!isReject && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-300">
              You will become the new assignee for this incident.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(isReject ? responseNote : undefined)}
            disabled={isSubmitting || (isReject && responseNote.length < 10)}
            className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="spinner-sm"></div>
                Processing...
              </>
            ) : (
              <>
                {isReject ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {isReject ? 'Reject' : 'Accept'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PendingReassignments() {
  const [requests, setRequests] = useState<ReassignmentRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<ReassignmentRequest | null>(null)
  const [action, setAction] = useState<'accept' | 'reject' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchPendingReassignments()
  }, [])

  const fetchPendingReassignments = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/reassignments/my-pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setRequests(response.data || [])
    } catch (error) {
      console.error('Failed to fetch pending reassignments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRespond = async (responseNote?: string) => {
    if (!selectedRequest || !action) return

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem('token')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/reassignments/${selectedRequest.id}/respond`,
        {
          status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
          responseNote,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      toast.success(
        action === 'accept'
          ? 'Reassignment accepted! You are now assigned to this incident.'
          : 'Reassignment rejected.'
      )

      // Refresh list
      await fetchPendingReassignments()

      // Close modal
      setSelectedRequest(null)
      setAction(null)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to respond to reassignment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'text-red-400 bg-red-500/20',
      HIGH: 'text-orange-400 bg-orange-500/20',
      MEDIUM: 'text-yellow-400 bg-yellow-500/20',
      LOW: 'text-green-400 bg-green-500/20',
    }
    return colors[priority] || colors.MEDIUM
  }

  if (isLoading) {
    return (
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center justify-center h-32">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (requests.length === 0) {
    return null // Don't show anything if no pending requests
  }

  return (
    <>
      <div className="glass-card p-6 rounded-2xl border border-orange-500/30 bg-orange-500/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <UserPlus className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Pending Reassignment Requests
              </h3>
              <p className="text-sm text-gray-400">
                {requests.length} request{requests.length > 1 ? 's' : ''} waiting for your response
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/dashboard/incidents/${request.incident.id}`}
                      className="text-white font-medium hover:text-orange-400 transition-colors"
                    >
                      {request.incident.ticketNumber}
                    </Link>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(request.incident.priority)}`}>
                      {request.incident.priority}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm truncate mb-2">
                    {request.incident.title}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {request.incident.store.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(request.reassignedAt)}
                    </span>
                  </div>
                  <div className="mt-2 p-2 bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-500">From:</span>{' '}
                      {request.fromTechnician.firstName} {request.fromTechnician.lastName}
                    </p>
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-500">Reason:</span> {request.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedRequest(request)
                      setAction('reject')
                    }}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRequest(request)
                      setAction('accept')
                    }}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                    title="Accept"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Respond Modal */}
      <RespondModal
        request={selectedRequest}
        action={action}
        onClose={() => {
          setSelectedRequest(null)
          setAction(null)
        }}
        onConfirm={handleRespond}
        isSubmitting={isSubmitting}
      />
    </>
  )
}
