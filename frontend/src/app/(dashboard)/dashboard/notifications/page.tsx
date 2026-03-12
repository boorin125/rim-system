// app/(dashboard)/dashboard/notifications/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { formatDateTime, formatRelativeTime } from '@/utils/dateUtils'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
  incident?: {
    id: string
    ticketNumber: string
    title: string
    status: string
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setNotifications(response.data)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      toast.error('ไม่สามารถโหลด Notifications ได้')
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notificationId: number) => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      )
    } catch (error) {
      console.error('Failed to mark as read:', error)
      toast.error('ไม่สามารถทำเครื่องหมายว่าอ่านแล้ว')
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token')
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications/mark-all-read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      toast.success('ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      toast.error('ไม่สามารถทำเครื่องหมายว่าอ่านทั้งหมด')
    }
  }

  const deleteNotification = async (notificationId: number) => {
    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications/${notificationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      toast.success('ลบ Notification แล้ว')
    } catch (error) {
      console.error('Failed to delete notification:', error)
      toast.error('ไม่สามารถลบ Notification')
    }
  }

  const getNotificationIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      INCIDENT_CREATED: '🆕',
      INCIDENT_ASSIGNED: '👤',
      INCIDENT_REASSIGNED: '🔁',
      INCIDENT_CHECKED_IN: '📸',
      INCIDENT_RESOLVED: '✅',
      INCIDENT_CONFIRMED: '✔️',
      INCIDENT_REOPENED: '🔓',
      INCIDENT_CANCELLED: '❌',
      COMMENT_ADDED: '💬',
      STATUS_CHANGED: '🔄',
      SYSTEM_ALERT: '⚠️',
      SLA_WARNING: '⏰',
      SLA_BREACH: '🚨',
    }
    return icons[type] || '📢'
  }

  const getNotificationTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      INCIDENT_CREATED: 'สร้าง Incident',
      INCIDENT_ASSIGNED: 'มอบหมายงาน',
      INCIDENT_REASSIGNED: 'เปลี่ยน Technician',
      INCIDENT_CHECKED_IN: 'Check-in',
      INCIDENT_RESOLVED: 'แก้ไขเสร็จ',
      INCIDENT_CONFIRMED: 'ยืนยันแล้ว',
      INCIDENT_REOPENED: 'เปิดใหม่',
      INCIDENT_CANCELLED: 'ยกเลิก',
      COMMENT_ADDED: 'เพิ่ม Comment',
      STATUS_CHANGED: 'เปลี่ยนสถานะ',
      SYSTEM_ALERT: 'แจ้งเตือนระบบ',
      SLA_WARNING: 'เตือน SLA',
      SLA_BREACH: 'SLA เกินกำหนด',
    }
    return labels[type] || type
  }

  const formatTimeAgo = (dateString: string) => {
    return formatRelativeTime(dateString)
  }

  // Filter and search notifications
  const filteredNotifications = notifications.filter((n) => {
    // Filter by read status
    if (filter === 'unread' && n.isRead) return false
    if (filter === 'read' && !n.isRead) return false

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query) ||
        n.incident?.ticketNumber?.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage)
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-blue-400" />
            Notifications
          </h1>
          <p className="text-gray-400 mt-1">
            {unreadCount > 0
              ? `คุณมี ${unreadCount} รายการที่ยังไม่ได้อ่าน`
              : 'ไม่มีรายการที่ยังไม่ได้อ่าน'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-2 text-white rounded-lg transition-colors flex items-center gap-2 hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              <CheckCheck className="w-4 h-4" />
              อ่านทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="ค้นหา Notification..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <button
              onClick={() => {
                setFilter('all')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
              style={filter === 'all' ? { backgroundColor: themeHighlight } : undefined}
            >
              ทั้งหมด ({notifications.length})
            </button>
            <button
              onClick={() => {
                setFilter('unread')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-lg transition-colors ${
                filter === 'unread'
                  ? 'text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
              style={filter === 'unread' ? { backgroundColor: themeHighlight } : undefined}
            >
              ยังไม่อ่าน ({unreadCount})
            </button>
            <button
              onClick={() => {
                setFilter('read')
                setCurrentPage(1)
              }}
              className={`px-3 py-2 rounded-lg transition-colors ${
                filter === 'read'
                  ? 'text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
              style={filter === 'read' ? { backgroundColor: themeHighlight } : undefined}
            >
              อ่านแล้ว ({notifications.length - unreadCount})
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Bell className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">ไม่มี Notification</p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 text-blue-400 hover:text-blue-300"
              >
                แสดงทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {paginatedNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative p-4 hover:bg-slate-700/30 transition-colors ${
                  !notification.isRead ? 'bg-blue-900/10' : ''
                }`}
              >
                {/* Unread indicator */}
                {!notification.isRead && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                )}

                <div className="flex items-start gap-4 ml-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-2xl bg-slate-700/50 rounded-xl">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-xs bg-slate-700 text-gray-300 rounded">
                            {getNotificationTypeLabel(notification.type)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-white mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-300 mb-2">
                          {notification.message}
                        </p>
                        {notification.link ? (
                          <Link
                            href={notification.link}
                            onClick={() => {
                              if (!notification.isRead) {
                                markAsRead(notification.id)
                              }
                            }}
                            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            ดูรายละเอียด →
                          </Link>
                        ) : notification.incident ? (
                          <Link
                            href={`/dashboard/incidents/${notification.incident.id}`}
                            onClick={() => {
                              if (!notification.isRead) {
                                markAsRead(notification.id)
                              }
                            }}
                            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            ดู Incident: {notification.incident.ticketNumber}
                          </Link>
                        ) : null}
                        {notification.title === 'มีคำขอลบสาขารออนุมัติ' && (
                          <Link
                            href="/dashboard/stores/delete-requests"
                            onClick={() => {
                              if (!notification.isRead) {
                                markAsRead(notification.id)
                              }
                            }}
                            className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:underline"
                          >
                            ดูคำขอลบสาขา &rarr;
                          </Link>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                            title="ทำเครื่องหมายว่าอ่านแล้ว"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-700">
            <p className="text-sm text-gray-400">
              แสดง {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredNotifications.length)} จาก{' '}
              {filteredNotifications.length} รายการ
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-gray-300">
                หน้า {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
