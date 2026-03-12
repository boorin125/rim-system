// frontend/src/components/IncidentTimeline.tsx

'use client';

import { useState, useEffect } from 'react';
import { Clock, User, Activity, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatDateTime } from '@/utils/dateUtils';

interface HistoryEntry {
  id: number;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  details?: string;
  createdAt: string;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface IncidentTimelineProps {
  incidentId: string;
}

export default function IncidentTimeline({ incidentId }: IncidentTimelineProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [incidentId]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setHistory(response.data);
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      toast.error('Failed to load timeline');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const icons: any = {
      CREATED: '🆕',
      UPDATED: '✏️',
      STATUS_CHANGED: '🔄',
      ASSIGNED: '👤',
      REASSIGNED: '🔁',
      CHECKED_IN: '📸',
      RESOLVED: '✅',
      RESOLUTION_UPDATED: '📝',
      TECH_CONFIRMED: '📋',
      CONFIRMED: '✔️',
      CLOSED: '🔒',
      REOPENED: '🔓',
      CANCELLED: '❌',
      COMMENTED: '💬',
      DELETED: '🗑️',
    };
    return icons[action] || '📋';
  };

  const getActionColor = (action: string) => {
    const colors: any = {
      CREATED: 'text-blue-400 bg-blue-900/20 border-blue-700/50',
      UPDATED: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
      STATUS_CHANGED: 'text-purple-400 bg-purple-900/20 border-purple-700/50',
      ASSIGNED: 'text-cyan-400 bg-cyan-900/20 border-cyan-700/50',
      REASSIGNED: 'text-orange-400 bg-orange-900/20 border-orange-700/50',
      CHECKED_IN: 'text-indigo-400 bg-indigo-900/20 border-indigo-700/50',
      RESOLVED: 'text-green-400 bg-green-900/20 border-green-700/50',
      RESOLUTION_UPDATED: 'text-lime-400 bg-lime-900/20 border-lime-700/50',
      TECH_CONFIRMED: 'text-teal-400 bg-teal-900/20 border-teal-700/50',
      CONFIRMED: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/50',
      CLOSED: 'text-slate-400 bg-slate-900/20 border-slate-700/50',
      REOPENED: 'text-amber-400 bg-amber-900/20 border-amber-700/50',
      CANCELLED: 'text-red-400 bg-red-900/20 border-red-700/50',
      COMMENTED: 'text-teal-400 bg-teal-900/20 border-teal-700/50',
      DELETED: 'text-gray-400 bg-gray-900/20 border-gray-700/50',
    };
    return colors[action] || 'text-gray-400 bg-gray-900/20 border-gray-700/50';
  };

  const formatAction = (action: string) => {
    const labels: any = {
      CREATED: 'Created',
      UPDATED: 'Updated',
      STATUS_CHANGED: 'Status Changed',
      ASSIGNED: 'Assigned',
      REASSIGNED: 'Reassigned',
      CHECKED_IN: 'Checked In',
      RESOLVED: 'Resolved',
      RESOLUTION_UPDATED: 'Resolution Updated',
      TECH_CONFIRMED: 'Tech Confirmed',
      CONFIRMED: 'Confirmed',
      CLOSED: 'Closed',
      REOPENED: 'Reopened',
      CANCELLED: 'Cancelled',
      COMMENTED: 'Commented',
      DELETED: 'Deleted',
    };
    return labels[action] || action;
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ');
  };

  // Format details - handle JSON objects for reassignment, assigned, etc.
  const formatDetails = (action: string, details: string | undefined): string | null => {
    if (!details) return null;

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(details);

      // Handle ASSIGNED action
      if (action === 'ASSIGNED') {
        // Check if details has assignee info
        if (parsed.assigneeId || parsed.assigneeName || parsed.technicianName) {
          const techName = parsed.assigneeName || parsed.technicianName || parsed.name || '';
          return techName ? `Assigned to: ${techName}\nสถานะ: รอดำเนินการ` : 'สถานะ: รอดำเนินการ';
        }
        // If details is just a name string in JSON
        if (typeof parsed === 'string') {
          return `Assigned to: ${parsed}\nสถานะ: รอดำเนินการ`;
        }
      }

      // Handle reassignment request
      if (parsed.reassignmentId !== undefined || parsed.toTechnicianId !== undefined) {
        const parts: string[] = [];
        if (parsed.reason) {
          parts.push(`เหตุผล: ${parsed.reason}`);
        }
        if (parsed.status) {
          const statusLabels: Record<string, string> = {
            PENDING: 'รอดำเนินการ',
            ACCEPTED: 'ยอมรับแล้ว',
            REJECTED: 'ปฏิเสธแล้ว',
            CANCELLED: 'ยกเลิกแล้ว',
          };
          parts.push(`สถานะ: ${statusLabels[parsed.status] || parsed.status}`);
        }
        return parts.length > 0 ? parts.join('\n') : 'ส่งคำขอโอนงานแล้ว';
      }

      // Handle other JSON objects - just show reason if exists
      if (parsed.reason) {
        return parsed.reason;
      }

      // Fallback: return original details if can't format
      return details;
    } catch {
      // Not JSON - handle plain text
      if (action === 'ASSIGNED' && details) {
        // Details format: "Assigned to FirstName LastName"
        const match = details.match(/Assigned to (.+)/i);
        if (match) {
          return `มอบหมายให้: ${match[1]}\nสถานะ: รอดำเนินการ`;
        }
        return `${details}\nสถานะ: รอดำเนินการ`;
      }

      // Handle REASSIGNED action
      if (action === 'REASSIGNED' && details) {
        // Details format: "Reassigned to FirstName LastName. Reason: xxx"
        const match = details.match(/Reassigned to ([^.]+)\.?\s*Reason:\s*(.+)/i);
        if (match) {
          return `เปลี่ยนให้: ${match[1].trim()}\nเหตุผล: ${match[2].trim()}\nสถานะ: รอดำเนินการ`;
        }
        // Fallback if pattern doesn't match
        return `${details}\nสถานะ: รอดำเนินการ`;
      }

      // Return as-is for other actions
      return details;
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">Timeline</h2>
        <span className="text-sm text-gray-400">({history.length} events)</span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No history available</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700/50" />

          {/* Timeline Entries */}
          <div className="space-y-6">
            {history.map((entry, index) => (
              <div key={entry.id} className="relative pl-16">
                {/* Timeline Dot */}
                <div
                  className={`absolute left-0 w-12 h-12 rounded-full border-2 ${getActionColor(
                    entry.action
                  )} flex items-center justify-center text-2xl backdrop-blur-sm`}
                >
                  {getActionIcon(entry.action)}
                </div>

                {/* Content Card */}
                <div
                  className={`p-4 rounded-lg border ${
                    index === 0
                      ? 'bg-blue-900/10 border-blue-700/30'
                      : 'bg-slate-800/30 border-slate-700/50'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3
                        className={`font-semibold ${
                          index === 0 ? 'text-blue-300' : 'text-white'
                        }`}
                      >
                        {formatAction(entry.action)}
                      </h3>
                      {entry.user && (
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-400">
                            by {entry.user.firstName} {entry.user.lastName}
                            <span className="ml-1 text-gray-500">({entry.user.role})</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Status Change */}
                  {entry.oldStatus && entry.newStatus && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-slate-700/50 text-gray-300 text-xs rounded">
                        {formatStatus(entry.oldStatus)}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="px-2 py-1 bg-blue-700/30 text-blue-300 text-xs rounded font-medium">
                        {formatStatus(entry.newStatus)}
                      </span>
                    </div>
                  )}

                  {/* Details */}
                  {entry.details && formatDetails(entry.action, entry.details) && (
                    <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">
                      {formatDetails(entry.action, entry.details)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
