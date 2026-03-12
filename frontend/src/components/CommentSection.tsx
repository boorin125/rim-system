// frontend/src/components/CommentSection.tsx

'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, Edit2, Trash2, Lock, User, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatDateTime } from '@/utils/dateUtils';

interface Comment {
  id: number;
  content: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
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

export default function CommentSection({ incidentId, currentUser }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchComments();
  }, [incidentId]);

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/comments`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setComments(response.data);
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
        {
          content: newComment.trim(),
          isInternal,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success('Comment added successfully');
      setNewComment('');
      setIsInternal(false);
      await fetchComments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (commentId: number) => {
    if (!editContent.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/comments/${commentId}`,
        { content: editContent.trim() },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success('Comment updated successfully');
      setEditingId(null);
      setEditContent('');
      await fetchComments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update comment');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/comments/${commentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success('Comment deleted successfully');
      await fetchComments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete comment');
    }
  };

  const canEditComment = (comment: Comment) => {
    return comment.user.id === currentUser?.id;
  };

  const canDeleteComment = (comment: Comment) => {
    return (
      comment.user.id === currentUser?.id ||
      currentUser?.role === 'HELP_DESK' ||
      currentUser?.role === 'IT_MANAGER'
    );
  };

  const isStaffUser = () => {
    return currentUser?.role !== 'END_USER';
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Comments ({comments.length})
        </h2>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No comments yet</p>
            <p className="text-sm text-gray-500 mt-1">Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg border ${
                comment.isInternal
                  ? 'bg-orange-900/10 border-orange-700/30'
                  : 'bg-slate-800/30 border-slate-700/50'
              }`}
            >
              {/* Comment Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {comment.user.firstName} {comment.user.lastName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(comment.createdAt)}
                      {comment.updatedAt !== comment.createdAt && ' (edited)'}
                    </p>
                  </div>
                  {comment.isInternal && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-900/30 border border-orange-700/50 rounded text-xs text-orange-300">
                      <Lock className="w-3 h-3" />
                      <span>Internal</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {canEditComment(comment) && editingId !== comment.id && (
                    <button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditContent(comment.content);
                      }}
                      className="p-1 hover:bg-slate-700/50 rounded text-gray-400 hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDeleteComment(comment) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 hover:bg-slate-700/50 rounded text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Content */}
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(comment.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent('');
                      }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-200 text-sm whitespace-pre-wrap">{comment.content}</p>
              )}
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
            {/* Internal Comment Toggle - Only for staff */}
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
