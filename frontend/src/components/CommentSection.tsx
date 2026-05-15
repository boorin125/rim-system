// frontend/src/components/CommentSection.tsx

'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, Lock } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getUserRoles } from '@/config/permissions';

interface Comment {
  id: number;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  };
}

interface CommentSectionProps {
  incidentId: string;
  currentUser: any;
}

function formatCommentDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${year} ${hh}:${mm}`
}

export default function CommentSection({ incidentId, currentUser }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [incidentId]);

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Sort newest first
      const sorted = [...response.data].sort(
        (a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setComments(sorted);
    } catch (error: any) {
      console.error('Failed to fetch comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/comments`,
        { content: newComment.trim(), isInternal },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Comment added');
      setNewComment('');
      setIsInternal(false);
      await fetchComments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStaffUser = () => {
    const roles = getUserRoles(currentUser);
    return !roles.every(r => r === 'END_USER' || r === 'READ_ONLY');
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
    <div className="glass-card p-6 rounded-2xl space-y-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-400" />
        Comments ({comments.length})
      </h2>

      {/* Comments List */}
      <div className="space-y-2">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No comments yet</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`px-4 py-3 rounded-lg border flex items-start gap-3 flex-wrap ${
                comment.isInternal
                  ? 'bg-orange-900/10 border-orange-700/30'
                  : 'bg-slate-800/30 border-slate-700/50'
              }`}
            >
              <span className="text-gray-400 text-sm whitespace-nowrap font-mono shrink-0">
                {formatCommentDate(comment.createdAt)}
              </span>
              {comment.isInternal && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-900/30 border border-orange-700/50 rounded text-xs text-orange-300 shrink-0">
                  <Lock className="w-3 h-3" />
                  Internal
                </span>
              )}
              <span className="text-white text-sm flex-1">
                &ldquo;{comment.content}&rdquo;
              </span>
              <span className="text-gray-400 text-sm whitespace-nowrap shrink-0">
                By {comment.user.firstName} {comment.user.lastName}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="border-t border-slate-700/50 pt-6">
        <div className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={isSubmitting}
            placeholder="Write a comment..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
          <div className="flex items-center justify-between">
            {isStaffUser() && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-orange-600 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Internal note (staff only)
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Post Comment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
