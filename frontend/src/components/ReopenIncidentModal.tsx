// frontend/src/components/ReopenIncidentModal.tsx

import { useState, useEffect } from 'react';
import { X, RotateCcw, AlertCircle, User, Clock, FileText, MessageSquare } from 'lucide-react';

interface ReopenIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: {
    id: string;
    title: string;
    ticketNumber: string;
    resolvedBy?: {
      name: string;
      email: string;
    };
    confirmedBy?: {
      name: string;
      email: string;
    };
    resolutionNote?: string;
    closedAt?: string;
    reopenCount?: number;
  };
  technicians: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  onReopen: (data: { reason: string; assignTo?: number }) => Promise<void>;
}

export default function ReopenIncidentModal({
  isOpen,
  onClose,
  incident,
  technicians,
  onReopen,
}: ReopenIncidentModalProps) {
  const [reason, setReason] = useState('');
  const [assignTo, setAssignTo] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setAssignTo(undefined);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for reopening');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onReopen({
        reason: reason.trim(),
        assignTo,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 pt-20 sm:pt-4">
      <div className="glass-card border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-88px)] sm:max-h-[90vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/30">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-orange-400" />
              Reopen Incident
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Reopen a closed incident and assign to technician
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Incident Info */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-300 mb-3">Incident Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-400 font-medium mb-1">Ticket Number</p>
                <p className="text-white font-mono">{incident.ticketNumber}</p>
              </div>
              <div>
                <p className="text-blue-400 font-medium mb-1">Title</p>
                <p className="text-white">{incident.title}</p>
              </div>
            </div>

            {/* Reopen Count */}
            {incident.reopenCount !== undefined && incident.reopenCount > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-700/50">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-orange-400" />
                  <p className="text-sm text-orange-300">
                    This incident has been reopened{' '}
                    <span className="font-semibold">{incident.reopenCount}</span>{' '}
                    time(s) before
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Previous Resolution Info */}
          {incident.resolutionNote && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-white">Previous Resolution</h3>
              </div>
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                  {incident.resolutionNote}
                </p>
                {incident.resolvedBy && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-400">
                      Resolved by: <span className="text-gray-300">{incident.resolvedBy.name}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Closed Info */}
          {incident.closedAt && (
            <div className="flex items-start gap-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-200">Closed at</p>
                <p className="text-sm text-gray-300 mt-1">
                  {new Date(incident.closedAt).toLocaleString()}
                </p>
                {incident.confirmedBy && (
                  <p className="text-xs text-gray-400 mt-1">
                    by {incident.confirmedBy.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Reopen Reason */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-2">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              Reason for Reopening <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="Explain why this incident needs to be reopened... (min. 10 characters)"
              rows={4}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                Minimum 10 characters required
              </p>
              <p
                className={`text-xs font-medium ${
                  reason.length >= 10 ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                {reason.length} / 10
              </p>
            </div>
          </div>

          {/* Assign Technician */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-2">
              <User className="w-4 h-4 text-blue-400" />
              Assign to Technician (Optional)
            </label>
            <select
              value={assignTo || ''}
              onChange={(e) => setAssignTo(e.target.value ? Number(e.target.value) : undefined)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Keep current assignment</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name} ({tech.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              Leave empty to keep the current technician assigned
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-orange-900/20 border border-orange-700/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-200">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Incident status will change to IN_PROGRESS</li>
                <li>The assigned technician will need to work on it again</li>
                <li>Reopen count will be incremented</li>
                <li>This action will be tracked in incident history</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-700/50 bg-slate-800/30">
          <p className="text-sm text-gray-300">
            Status will change to <span className="font-semibold text-orange-400">IN_PROGRESS</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-300 hover:bg-slate-700/50 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || reason.trim().length < 10}
              className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reopening...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reopen Incident
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
