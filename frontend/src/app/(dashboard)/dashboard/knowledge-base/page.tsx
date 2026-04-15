// app/(dashboard)/dashboard/knowledge-base/page.tsx - Knowledge Base
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Search,
  Plus,
  ChevronRight,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  User,
  Users,
  FolderOpen,
  FileText,
  Star,
  Filter,
  X,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Send,
  Check,
  AlertCircle,
} from 'lucide-react'

const ROLE_FILTER_TABS = [
  { value: 'ALL',        label: 'ทุก Role',    badge: 'bg-purple-500/20 text-purple-300',  badgeLabel: 'All'        },
  { value: 'HELP_DESK',  label: 'Helpdesk',    badge: 'bg-orange-500/20 text-orange-300',  badgeLabel: 'HD'         },
  { value: 'TECHNICIAN', label: 'Technician',  badge: 'bg-blue-500/20 text-blue-300',      badgeLabel: 'Tech'       },
  { value: 'SUPERVISOR', label: 'Supervisor',  badge: 'bg-green-500/20 text-green-300',    badgeLabel: 'Sup'        },
  { value: 'IT_MANAGER', label: 'IT Manager',  badge: 'bg-red-500/20 text-red-300',        badgeLabel: 'ITM'        },
]
import axios from 'axios'
import toast from 'react-hot-toast'
import { canPerformAction, getAccessLevel, getUserRoles } from '@/config/permissions'

function useThemeHighlight() {
  const [color, setColor] = useState('#3b82f6')
  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight').trim()
      if (v) setColor(v)
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])
  return color
}

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  parentId?: number
  isActive: boolean
  sortOrder: number
  _count: {
    articles: number
    children: number
  }
  children?: Category[]
}

interface Article {
  id: number
  title: string
  slug: string
  summary?: string
  content: string
  keywords: string[]
  isPublic: boolean
  isPublished: boolean
  publishedAt?: string
  visibleToRoles: string[]
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  version: number
  createdAt: string
  updatedAt: string
  category: {
    id: number
    name: string
    slug: string
  }
  author: {
    id: number
    firstName: string
    lastName: string
  }
  lastEditedBy?: {
    id: number
    firstName: string
    lastName: string
  }
  relatedArticles?: {
    id: number
    title: string
    slug: string
    summary?: string
  }[]
  feedbacks?: {
    id: number
    isHelpful: boolean
    comment?: string
    user: {
      id: number
      firstName: string
      lastName: string
    }
    createdAt: string
  }[]
  _count?: {
    feedbacks: number
    usageHistory: number
  }
}

interface KBStats {
  totalCategories: number
  totalArticles: number
  publishedArticles: number
  draftArticles: number
  totalViews: number
  totalHelpful: number
  totalUsages: number
  topArticles: Article[]
  topCategories: Category[]
}

export default function KnowledgeBasePage() {
  const themeHighlight = useThemeHighlight()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Data states
  const [categories, setCategories] = useState<{ flat: Category[], tree: Category[] }>({ flat: [], tree: [] })
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [stats, setStats] = useState<KBStats | null>(null)
  const [popularArticles, setPopularArticles] = useState<Article[]>([])

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [showDrafts, setShowDrafts] = useState(false)
  const [roleFilter, setRoleFilter] = useState<string>('')  // '' = not yet initialized

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  })

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    categoryId: 0,
    title: '',
    summary: '',
    content: '',
    keywords: '',
    isPublic: true,
    isPublished: false,
    visibleToRoles: [] as string[],
  })
  const [isSaving, setIsSaving] = useState(false)

  // Feedback state
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCategories(res.data)
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [])

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    if (!roleFilter) return  // wait until roleFilter is initialized
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.set('page', String(pagination.page))
      params.set('limit', String(pagination.limit))
      if (selectedCategory) params.set('categoryId', String(selectedCategory))
      if (searchTerm) params.set('search', searchTerm)
      if (!showDrafts) params.set('isPublished', 'true')
      params.set('roleFilter', roleFilter)

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setArticles(res.data.data)
      setPagination(prev => ({
        ...prev,
        total: res.data.pagination.total,
        totalPages: res.data.pagination.totalPages,
      }))
    } catch (err) {
      console.error('Error fetching articles:', err)
    }
  }, [pagination.page, pagination.limit, selectedCategory, searchTerm, showDrafts, roleFilter])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const accessLevel = getAccessLevel(currentUser, '/dashboard/knowledge-base')

      if (accessLevel === 'full') {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/kb/stats`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setStats(res.data)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [currentUser])

  // Fetch popular articles
  const fetchPopularArticles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/popular?limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setPopularArticles(res.data)
    } catch (err) {
      console.error('Error fetching popular articles:', err)
    }
  }, [])

  // Initial load + Outsource guard
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      const isOutsource =
        getUserRoles(user).includes('TECHNICIAN') && user?.technicianType === 'OUTSOURCE'
      if (isOutsource) {
        router.replace('/dashboard')
        return
      }
      setCurrentUser(user)
      // Default role filter to the user's own role (if it's a known tab)
      const userRole: string = user?.role || ''
      const isKnownTab = ROLE_FILTER_TABS.some(t => t.value === userRole)
      setRoleFilter(isKnownTab ? userRole : 'ALL')
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      Promise.all([
        fetchCategories(),
        fetchArticles(),
        fetchPopularArticles(),
        fetchStats(),
      ]).finally(() => setIsLoading(false))
    }
  }, [currentUser, fetchCategories, fetchArticles, fetchPopularArticles, fetchStats])

  // Refetch articles when filters change
  useEffect(() => {
    if (!isLoading) {
      fetchArticles()
    }
  }, [pagination.page, selectedCategory, searchTerm, showDrafts, roleFilter])

  // View article detail
  const viewArticle = async (article: Article) => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${article.id}?incrementView=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedArticle(res.data)
      setShowDetailModal(true)
    } catch (err) {
      toast.error('ไม่สามารถโหลดบทความได้')
    }
  }

  // Create/Update article
  const handleSaveArticle = async () => {
    if (!formData.categoryId || !formData.title || !formData.content) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    if (formData.content.length < 50) {
      toast.error('เนื้อหาบทความต้องมีอย่างน้อย 50 ตัวอักษร')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...formData,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
      }

      if (editingArticle) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${editingArticle.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('อัพเดทบทความสำเร็จ')
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/kb/articles`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('สร้างบทความสำเร็จ')
      }

      setShowCreateModal(false)
      setEditingArticle(null)
      resetForm()
      fetchArticles()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete article
  const handleDeleteArticle = async (article: Article) => {
    if (!confirm(`ต้องการลบบทความ "${article.title}" ใช่หรือไม่?`)) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${article.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ลบบทความสำเร็จ')
      fetchArticles()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ไม่สามารถลบบทความได้')
    }
  }

  // Toggle publish
  const handleTogglePublish = async (article: Article) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${article.id}/publish`,
        { isPublished: !article.isPublished },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(article.isPublished ? 'ยกเลิกการเผยแพร่แล้ว' : 'เผยแพร่บทความแล้ว')
      fetchArticles()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    }
  }

  // Submit feedback
  const handleSubmitFeedback = async (isHelpful: boolean) => {
    if (!selectedArticle) return

    setSubmittingFeedback(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${selectedArticle.id}/feedback`,
        { isHelpful, comment: feedbackComment || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ขอบคุณสำหรับความคิดเห็น')
      setFeedbackComment('')

      // Refresh article
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${selectedArticle.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSelectedArticle(res.data)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      categoryId: 0,
      title: '',
      summary: '',
      content: '',
      keywords: '',
      isPublic: true,
      isPublished: false,
      visibleToRoles: [],
    })
  }

  // Open edit modal
  const openEditModal = (article: Article) => {
    setEditingArticle(article)
    setFormData({
      categoryId: article.category.id,
      title: article.title,
      summary: article.summary || '',
      content: article.content,
      keywords: article.keywords.join(', '),
      isPublic: article.isPublic,
      isPublished: article.isPublished,
      visibleToRoles: article.visibleToRoles || [],
    })
    setShowCreateModal(true)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Permissions
  const accessLevel = getAccessLevel(currentUser, '/dashboard/knowledge-base')
  const canCreate = canPerformAction(currentUser, '/dashboard/knowledge-base', 'create')
  const canEdit = canPerformAction(currentUser, '/dashboard/knowledge-base', 'edit')
  const canDelete = canPerformAction(currentUser, '/dashboard/knowledge-base', 'delete')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-400">Loading knowledge base...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          <p className="text-gray-400 mt-1">
            ค้นหาและเรียนรู้วิธีแก้ปัญหาจากบทความ
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showDrafts}
                onChange={(e) => {
                  setShowDrafts(e.target.checked)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
              />
              แสดง Drafts
            </label>
          )}
          {canCreate && (
            <button
              onClick={() => {
                resetForm()
                setEditingArticle(null)
                setShowCreateModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              <Plus className="w-5 h-5" />
              <span>สร้างบทความ</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats (for admins) */}
      {stats && accessLevel === 'full' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalCategories}</p>
                <p className="text-xs text-gray-400">หมวดหมู่</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.publishedArticles}</p>
                <p className="text-xs text-gray-400">บทความที่เผยแพร่</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Edit className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.draftArticles}</p>
                <p className="text-xs text-gray-400">Drafts</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Eye className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalViews.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Views</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <ThumbsUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalHelpful}</p>
                <p className="text-xs text-gray-400">Helpful</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Star className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalUsages}</p>
                <p className="text-xs text-gray-400">ถูกใช้งาน</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar - Categories & Popular */}
        <div className="md:col-span-1 space-y-6">
          {/* Search */}
          <div className="glass-card p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาบทความ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Role filter tabs */}
          <div className="glass-card p-4 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              คู่มือตาม Role
            </h3>
            <div className="space-y-1">
              {ROLE_FILTER_TABS.map((tab) => {
                const isActive = roleFilter === tab.value
                const isMyRole = currentUser?.role === tab.value
                return (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setRoleFilter(tab.value)
                      setPagination(prev => ({ ...prev, page: 1 }))
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      isActive ? 'text-white' : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                    style={isActive ? { backgroundColor: themeHighlight } : undefined}
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : tab.badge
                    }`}>
                      {tab.badgeLabel}
                    </span>
                    <span className="text-sm flex-1">{tab.label}</span>
                    {isMyRole && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        isActive
                          ? 'border-white/30 text-white/70'
                          : 'border-gray-600 text-gray-500'
                      }`}>
                        Role ของคุณ
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="glass-card p-4 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-400" />
              หมวดหมู่
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                  selectedCategory === null
                    ? 'text-white'
                    : 'text-gray-300 hover:bg-gray-700/50'
                }`}
                style={selectedCategory === null ? { backgroundColor: themeHighlight } : undefined}
              >
                <span>ทั้งหมด</span>
                <span className="text-sm text-gray-400">{pagination.total}</span>
              </button>
              {categories.flat.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                    selectedCategory === cat.id
                      ? 'text-white'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                  style={selectedCategory === cat.id ? { backgroundColor: themeHighlight } : undefined}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-sm text-gray-400">{cat._count.articles}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Popular Articles */}
          {popularArticles.length > 0 && (
            <div className="glass-card p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                บทความยอดนิยม
              </h3>
              <div className="space-y-2">
                {popularArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => viewArticle(article)}
                    className="w-full text-left p-2 rounded-lg hover:bg-gray-700/50 transition-colors group"
                  >
                    <p className="text-sm text-gray-300 group-hover:text-white truncate">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {article.helpfulCount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Articles List */}
        <div className="md:col-span-3">
          <div className="glass-card rounded-xl overflow-hidden">
            {/* Results header */}
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-gray-400">
                  พบ {pagination.total} บทความ
                  {selectedCategory && categories.flat.find(c => c.id === selectedCategory) && (
                    <span> ใน "{categories.flat.find(c => c.id === selectedCategory)?.name}"</span>
                  )}
                </p>
                {roleFilter && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    ROLE_FILTER_TABS.find(t => t.value === roleFilter)?.badge ?? 'bg-gray-700 text-gray-300'
                  }`}>
                    {ROLE_FILTER_TABS.find(t => t.value === roleFilter)?.label ?? roleFilter}
                  </span>
                )}
              </div>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            {/* Articles grid */}
            {articles.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">ไม่พบบทความ</p>
                {canCreate && (
                  <button
                    onClick={() => {
                      resetForm()
                      setShowCreateModal(true)
                    }}
                    className="mt-4 text-blue-400 hover:text-blue-300"
                  >
                    สร้างบทความใหม่
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-blue-500/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                        {article.category.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {!article.isPublished && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                            Draft
                          </span>
                        )}
                        {canEdit && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(article)
                              }}
                              className="p-1 text-gray-400 hover:text-white"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteArticle(article)
                                }}
                                className="p-1 text-gray-400 hover:text-red-400"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => viewArticle(article)}
                      className="text-left w-full"
                    >
                      <h3 className="text-white font-semibold mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      {article.summary && (
                        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                          {article.summary}
                        </p>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {article.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {article.helpfulCount}
                        </span>
                      </div>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(article.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
                <span className="text-sm text-gray-400">
                  หน้า {pagination.page} จาก {pagination.totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
                    disabled={pagination.page === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.totalPages }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Article Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editingArticle ? 'แก้ไขบทความ' : 'สร้างบทความใหม่'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingArticle(null)
                  resetForm()
                }}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  หมวดหมู่ <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData(prev => ({ ...prev, categoryId: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>เลือกหมวดหมู่</option>
                  {categories.flat.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  หัวข้อ <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="หัวข้อบทความ"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  สรุปย่อ
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="สรุปเนื้อหาโดยย่อ (แสดงในรายการบทความ)"
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  เนื้อหา <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="เนื้อหาบทความ (อย่างน้อย 50 ตัวอักษร)"
                  rows={10}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.content.length} / 50 ตัวอักษรขั้นต่ำ
                </p>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Keywords
                </label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="คั่นด้วยเครื่องหมาย comma เช่น: printer, กระดาษติด, error"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Visible To Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  จำกัดการมองเห็น (เว้นว่าง = ทุก Role เห็นได้)
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['END_USER', 'TECHNICIAN', 'SUPERVISOR', 'HELP_DESK', 'FINANCE_ADMIN', 'IT_MANAGER', 'SUPER_ADMIN'] as const).map(role => (
                    <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.visibleToRoles.includes(role)}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          visibleToRoles: e.target.checked
                            ? [...prev.visibleToRoles, role]
                            : prev.visibleToRoles.filter(r => r !== role),
                        }))}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-300">{role}</span>
                    </label>
                  ))}
                </div>
                {formData.visibleToRoles.length > 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    บทความนี้จะมองเห็นได้เฉพาะ: {formData.visibleToRoles.join(', ')} และ Role ที่สูงกว่า
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm">Public (ทุกคนเห็น)</span>
                </label>
                {canEdit && (
                  <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPublished}
                      onChange={(e) => setFormData(prev => ({ ...prev, isPublished: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm">เผยแพร่ทันที</span>
                  </label>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingArticle(null)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveArticle}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 text-white rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: themeHighlight }}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>{editingArticle ? 'บันทึก' : 'สร้างบทความ'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Detail Modal */}
      {showDetailModal && selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
                  {selectedArticle.category.name}
                </span>
                {!selectedArticle.isPublished && (
                  <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
                    Draft
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedArticle(null)
                  setFeedbackComment('')
                }}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <h1 className="text-2xl font-bold text-white mb-4">
                {selectedArticle.title}
              </h1>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {selectedArticle.author.firstName} {selectedArticle.author.lastName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(selectedArticle.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {selectedArticle.viewCount} views
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  {selectedArticle.helpfulCount} helpful
                </span>
              </div>

              {/* Keywords */}
              {selectedArticle.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedArticle.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-700/50 text-gray-400 text-xs rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="prose prose-invert max-w-none">
                <div className="bg-slate-900/50 p-6 rounded-xl text-gray-300 whitespace-pre-wrap">
                  {selectedArticle.content}
                </div>
              </div>

              {/* Related Articles */}
              {selectedArticle.relatedArticles && selectedArticle.relatedArticles.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-white mb-4">บทความที่เกี่ยวข้อง</h3>
                  <div className="space-y-2">
                    {selectedArticle.relatedArticles.map((related) => (
                      <button
                        key={related.id}
                        onClick={() => viewArticle(related as Article)}
                        className="w-full text-left p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                      >
                        <p className="text-white font-medium">{related.title}</p>
                        {related.summary && (
                          <p className="text-sm text-gray-400 mt-1">{related.summary}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Section */}
              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">บทความนี้มีประโยชน์หรือไม่?</h3>
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => handleSubmitFeedback(true)}
                    disabled={submittingFeedback}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ThumbsUp className="w-5 h-5" />
                    <span>มีประโยชน์</span>
                  </button>
                  <button
                    onClick={() => handleSubmitFeedback(false)}
                    disabled={submittingFeedback}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ThumbsDown className="w-5 h-5" />
                    <span>ไม่มีประโยชน์</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="แสดงความคิดเห็น (ไม่บังคับ)"
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-700/50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Version {selectedArticle.version}
                {selectedArticle.lastEditedBy && (
                  <span> | แก้ไขล่าสุดโดย {selectedArticle.lastEditedBy.firstName}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {canEdit && (
                  <>
                    <button
                      onClick={() => handleTogglePublish(selectedArticle)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedArticle.isPublished
                          ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
                          : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                      }`}
                    >
                      {selectedArticle.isPublished ? 'ยกเลิกเผยแพร่' : 'เผยแพร่'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailModal(false)
                        openEditModal(selectedArticle)
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors hover:brightness-110"
                      style={{ backgroundColor: themeHighlight }}
                    >
                      <Edit className="w-4 h-4" />
                      <span>แก้ไข</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
