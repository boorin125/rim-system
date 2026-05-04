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
  ImagePlus,
  ZoomIn,
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
  Upload,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Presentation,
  File,
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
  content?: string | null
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
  filePath?: string | null
  fileType?: string | null   // PDF | IMAGE | WORD | POWERPOINT
  fileSize?: number | null
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
  attachments: string[]
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

function getFileTypeInfo(fileType: string | null | undefined) {
  switch (fileType) {
    case 'PDF':         return { label: 'PDF',        color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30',    Icon: FileText }
    case 'IMAGE':       return { label: 'รูปภาพ',     color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30',  Icon: ImageIcon }
    case 'WORD':        return { label: 'Word',        color: 'text-sky-400',    bg: 'bg-sky-500/15 border-sky-500/30',    Icon: FileText }
    case 'POWERPOINT':  return { label: 'PowerPoint',  color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30', Icon: File }
    default:            return { label: 'ไฟล์',        color: 'text-gray-400',   bg: 'bg-gray-500/15 border-gray-500/30',  Icon: File }
  }
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [showUploadModal, setShowUploadModal] = useState(false)
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
    attachments: [] as string[],  // base64 images
  })
  const [isSaving, setIsSaving] = useState(false)

  // Upload modal state
  const [uploadData, setUploadData] = useState({
    title: '',
    categoryId: 0,
    keywords: '',
    visibleToRoles: [] as string[],
    isPublished: false,
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)
  const [maCategories, setMaCategories] = useState<string[]>([])

  // Feedback state
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Lightbox for images in detail view
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  // File viewer modal
  const [showFileViewerModal, setShowFileViewerModal] = useState(false)
  const [fileViewerArticle, setFileViewerArticle] = useState<Article | null>(null)

  // Change Request states
  const [editReason, setEditReason] = useState('')
  const [showDeleteReqModal, setShowDeleteReqModal] = useState(false)
  const [deleteReqArticle, setDeleteReqArticle] = useState<Article | null>(null)
  const [deleteReqReason, setDeleteReqReason] = useState('')
  const [isSubmittingReq, setIsSubmittingReq] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [showPendingPanel, setShowPendingPanel] = useState(false)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const buildFileUrl = (filePath: string) =>
    `${(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api$/, '')}/uploads/${filePath}`

  const openFileViewer = (article: Article) => {
    setFileViewerArticle(article)
    setShowFileViewerModal(true)
  }

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

  // Fetch pending change requests (IT Manager only)
  const fetchPendingRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/change-requests?status=PENDING`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setPendingRequests(res.data)
    } catch {}
  }, [])

  // Fetch MA job type categories for upload modal live search
  const fetchMaCategories = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const jobTypesRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/job-types/all`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const maJobType = jobTypesRes.data.find(
        (jt: any) => jt.name?.toLowerCase().includes('ma') || jt.name?.toLowerCase().includes('maintenance')
      )
      if (!maJobType) return
      const catRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories?jobTypeId=${maJobType.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const catList: any[] = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data ?? []
      setMaCategories(catList.map((c: any) => c.name).filter(Boolean))
    } catch (err) {
      console.error('Error fetching MA categories:', err)
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
      const userRoles: string[] = (currentUser as any)?.roles || ((currentUser as any)?.role ? [(currentUser as any).role] : [])
      const itMgr = userRoles.some(r => ['IT_MANAGER', 'SUPER_ADMIN'].includes(r))
      Promise.all([
        fetchCategories(),
        fetchArticles(),
        fetchPopularArticles(),
        fetchStats(),
        ...(itMgr ? [fetchPendingRequests()] : []),
      ]).finally(() => setIsLoading(false))
    }
  }, [currentUser, fetchCategories, fetchArticles, fetchPopularArticles, fetchStats, fetchPendingRequests])

  // Refetch articles when filters change
  useEffect(() => {
    if (!isLoading) {
      fetchArticles()
    }
  }, [pagination.page, selectedCategory, searchTerm, showDrafts, roleFilter])

  // View article detail
  const viewArticle = async (article: Article) => {
    if (article.fileType && article.filePath) {
      openFileViewer(article)
      return
    }
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
    // Editing requires a reason
    if (editingArticle && !editReason.trim()) {
      toast.error('กรุณาระบุเหตุผล / จุดที่แก้ไข')
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
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${editingArticle.id}/change-request`,
          { type: 'EDIT', reason: editReason.trim(), proposedData: payload },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.data.applied) {
          toast.success('อัพเดทบทความสำเร็จ')
        } else {
          toast.success('ส่งคำขอแก้ไขแล้ว รอ IT Manager อนุมัติ')
        }
        fetchPendingRequests()
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
      setEditReason('')
      fetchArticles()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsSaving(false)
    }
  }

  // Open delete request modal
  const handleDeleteArticle = (article: Article) => {
    setDeleteReqArticle(article)
    setDeleteReqReason('')
    setShowDeleteReqModal(true)
  }

  // Submit delete change request
  const handleSubmitDeleteRequest = async () => {
    if (!deleteReqArticle) return
    if (!deleteReqReason.trim()) { toast.error('กรุณาระบุเหตุผล'); return }
    setIsSubmittingReq(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/articles/${deleteReqArticle.id}/change-request`,
        { type: 'DELETE', reason: deleteReqReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.applied) {
        toast.success('ลบบทความสำเร็จ')
        fetchArticles()
        fetchStats()
      } else {
        toast.success('ส่งคำขอลบแล้ว รอ IT Manager อนุมัติ')
      }
      setShowDeleteReqModal(false)
      setDeleteReqArticle(null)
      fetchPendingRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setIsSubmittingReq(false)
    }
  }

  // Approve change request
  const handleApproveRequest = async (id: number) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/change-requests/${id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('อนุมัติแล้ว')
      fetchPendingRequests()
      fetchArticles()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    }
  }

  // Reject change request
  const handleRejectRequest = async (id: number, note: string) => {
    if (!note.trim()) { toast.error('กรุณาระบุเหตุผลการปฏิเสธ'); return }
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/change-requests/${id}/reject`,
        { reviewNote: note.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('ปฏิเสธคำขอแล้ว')
      setReviewingId(null)
      setReviewNote('')
      fetchPendingRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    }
  }

  // Upload document
  const handleUploadDocument = async () => {
    if (!uploadFile) { toast.error('กรุณาเลือกไฟล์'); return }
    if (!uploadData.title.trim()) { toast.error('กรุณาระบุชื่อเอกสาร'); return }
    if (!categorySearch.trim()) { toast.error('กรุณาระบุหมวดหมู่'); return }

    setIsUploading(true)
    try {
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('title', uploadData.title.trim())
      form.append('categoryName', categorySearch.trim())
      form.append('keywords', uploadData.keywords)
      form.append('isPublished', String(uploadData.isPublished))
      uploadData.visibleToRoles.forEach(r => form.append('visibleToRoles', r))

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/kb/upload`,
        form,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      )
      toast.success('อัพโหลดเอกสารสำเร็จ')
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadData({ title: '', categoryId: 0, keywords: '', visibleToRoles: [], isPublished: false })
      setCategorySearch('')
      setShowCatSuggestions(false)
      setMaCategories([])
      fetchArticles()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'อัพโหลดไม่สำเร็จ')
    } finally {
      setIsUploading(false)
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
      attachments: [],
    })
  }

  // Open edit modal
  const openEditModal = (article: Article) => {
    setEditingArticle(article)
    setEditReason('')
    setFormData({
      categoryId: article.category.id,
      title: article.title,
      summary: article.summary || '',
      content: article.content || '',
      keywords: article.keywords.join(', '),
      isPublic: article.isPublic,
      isPublished: article.isPublished,
      visibleToRoles: article.visibleToRoles || [],
      attachments: article.attachments || [],
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
  const _userRoles: string[] = (currentUser as any)?.roles || ((currentUser as any)?.role ? [(currentUser as any).role] : [])
  const isItManager = _userRoles.some(r => ['IT_MANAGER', 'SUPER_ADMIN'].includes(r))

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
              onClick={() => { setShowUploadModal(true); fetchMaCategories() }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors hover:brightness-110"
              style={{ backgroundColor: themeHighlight }}
            >
              <Upload className="w-5 h-5" />
              <span>อัพโหลดเอกสาร</span>
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

      {/* Pending Change Requests Panel (IT Manager only) */}
      {isItManager && pendingRequests.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden border border-amber-500/30">
          <button
            onClick={() => setShowPendingPanel(v => !v)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-white">คำขอรออนุมัติ</p>
                <p className="text-xs text-gray-400">{pendingRequests.length} รายการรอการตรวจสอบ</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showPendingPanel ? 'rotate-90' : ''}`} />
          </button>

          {showPendingPanel && (
            <div className="border-t border-slate-700/50 divide-y divide-slate-700/50">
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          req.type === 'DELETE' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {req.type === 'DELETE' ? 'ขอลบ' : 'ขอแก้ไข'}
                        </span>
                        <span className="text-sm font-medium text-white truncate">{req.article?.title}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        โดย {req.requester?.firstName} {req.requester?.lastName} — <span className="text-amber-400/80">{req.reason}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => { setReviewingId(req.id); setReviewNote('') }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                  {reviewingId === req.id && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="เหตุผลที่ปฏิเสธ..."
                        className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={() => handleRejectRequest(req.id, reviewNote)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors"
                      >
                        ยืนยัน
                      </button>
                      <button
                        onClick={() => setReviewingId(null)}
                        className="px-3 py-1.5 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
              <div className="divide-y divide-slate-700/50">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => article.fileType ? openFileViewer(article) : viewArticle(article)}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-slate-700/30 transition-colors group cursor-pointer"
                  >
                    {/* Left: title + subtitle */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{article.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {article.fileType ? formatFileSize(article.fileSize) : (article.summary || '')}
                      </p>
                    </div>

                    {/* Right: badges + buttons + date */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Category + type badges */}
                      <span className="hidden sm:inline px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                        {article.category.name}
                      </span>
                      {article.fileType && (() => {
                        const { label, color, bg, Icon } = getFileTypeInfo(article.fileType)
                        return (
                          <span className={`hidden sm:flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs ${color} ${bg}`}>
                            <Icon className="w-3 h-3" />
                            {label}
                          </span>
                        )
                      })()}
                      {!article.isPublished && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                          Draft
                        </span>
                      )}

                      {/* Action buttons */}
                      {article.fileType ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openFileViewer(article) }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-xs"
                          >
                            <Eye className="w-3 h-3" />
                            เปิดดู
                          </button>
                          <a
                            href={article.filePath ? buildFileUrl(article.filePath) : '#'}
                            download
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors text-xs"
                          >
                            <Download className="w-3 h-3" />
                            ดาวน์โหลด
                          </a>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); viewArticle(article) }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-xs"
                        >
                          <Eye className="w-3 h-3" />
                          อ่าน
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTogglePublish(article) }}
                          className={`hidden sm:block px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            article.isPublished
                              ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400 hover:bg-green-500/20 hover:text-green-400'
                          }`}
                          title={article.isPublished ? 'คลิกเพื่อยกเลิกเผยแพร่' : 'คลิกเพื่อเผยแพร่'}
                        >
                          {article.isPublished ? 'เผยแพร่แล้ว' : 'Draft'}
                        </button>
                      )}

                      {/* Date */}
                      <span className="hidden md:flex items-center gap-1 text-xs text-gray-500 w-24 justify-end">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {formatDate(article.publishedAt || article.createdAt)}
                      </span>

                      {/* Edit / Delete icons */}
                      {(canEdit || canDelete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(article) }}
                              className="p-1 text-gray-400 hover:text-blue-400"
                              title="ขอแก้ไข"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteArticle(article) }}
                              className="p-1 text-gray-400 hover:text-red-400"
                              title="ขอลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
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

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">อัพโหลดเอกสาร</h2>
              </div>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null) }}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) {
                    setUploadFile(f)
                    if (!uploadData.title) setUploadData(prev => ({ ...prev, title: f.name.replace(/\.[^/.]+$/, '') }))
                  }
                }}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-blue-500 bg-blue-500/10' : uploadFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.ppt,.pptx"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setUploadFile(f)
                      if (!uploadData.title) setUploadData(prev => ({ ...prev, title: f.name.replace(/\.[^/.]+$/, '') }))
                    }
                  }}
                />
                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2">
                    {(() => {
                      const t = uploadFile.type
                      const ft = t.includes('pdf') ? 'PDF' : t.includes('image') ? 'IMAGE' : t.includes('word') || t.includes('document') ? 'WORD' : t.includes('presentation') || t.includes('powerpoint') ? 'POWERPOINT' : null
                      const { Icon, color } = getFileTypeInfo(ft)
                      return <Icon className={`w-10 h-10 ${color}`} />
                    })()}
                    <p className="text-white font-medium">{uploadFile.name}</p>
                    <p className="text-gray-400 text-sm">{formatFileSize(uploadFile.size)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null) }}
                      className="text-xs text-red-400 hover:text-red-300 mt-1"
                    >
                      เปลี่ยนไฟล์
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <Upload className="w-10 h-10 text-gray-500" />
                    <p className="text-gray-300 font-medium">ลากไฟล์มาวางที่นี่ หรือคลิกเลือกไฟล์</p>
                    <p className="text-gray-500 text-sm">PDF, JPG, PNG, DOCX, PPTX — สูงสุด 20MB</p>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ชื่อเอกสาร <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) => setUploadData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="ชื่อเอกสาร"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category — live search from MA categories */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  หมวดหมู่ <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => {
                    setCategorySearch(e.target.value)
                    setShowCatSuggestions(true)
                  }}
                  onFocus={() => setShowCatSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
                  placeholder="พิมพ์หมวดหมู่..."
                  className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${categorySearch.trim() ? 'border-blue-500' : 'border-slate-600'}`}
                />
                {showCatSuggestions && maCategories.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {(categorySearch
                      ? maCategories.filter(n => n.toLowerCase().includes(categorySearch.toLowerCase()))
                      : maCategories
                    ).map(name => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={() => {
                          setCategorySearch(name)
                          setShowCatSuggestions(false)
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-700 text-white text-sm first:rounded-t-xl last:rounded-b-xl transition-colors"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Keywords</label>
                <input
                  type="text"
                  value={uploadData.keywords}
                  onChange={(e) => setUploadData(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="คั่นด้วย comma เช่น: printer, คู่มือ, setup"
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
                        checked={uploadData.visibleToRoles.includes(role)}
                        onChange={(e) => setUploadData(prev => ({
                          ...prev,
                          visibleToRoles: e.target.checked
                            ? [...prev.visibleToRoles, role]
                            : prev.visibleToRoles.filter(r => r !== role),
                        }))}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500"
                      />
                      <span className="text-xs text-gray-300">{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Publish */}
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadData.isPublished}
                  onChange={(e) => setUploadData(prev => ({ ...prev, isPublished: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                />
                <span className="text-sm">เผยแพร่ทันที</span>
              </label>
            </div>

            <div className="p-6 border-t border-slate-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null) }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={isUploading || !uploadFile}
                className="flex items-center gap-2 px-6 py-2 text-white rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: themeHighlight }}
              >
                {isUploading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>กำลังอัพโหลด...</span></>
                ) : (
                  <><Upload className="w-5 h-5" /><span>อัพโหลด</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* Image Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-gray-400" />
                    รูปภาพประกอบ
                    <span className="text-xs text-gray-500">({formData.attachments.length}/10)</span>
                  </label>
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    formData.attachments.length >= 10
                      ? 'bg-gray-700/30 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  }`}>
                    <ImagePlus className="w-4 h-4" />
                    เพิ่มรูป
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={formData.attachments.length >= 10}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        const remaining = 10 - formData.attachments.length
                        const resizeImage = (file: File): Promise<string> =>
                          new Promise((resolve) => {
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              const img = new Image()
                              img.onload = () => {
                                const MAX = 1280
                                let { width, height } = img
                                if (width > MAX || height > MAX) {
                                  if (width > height) {
                                    height = Math.round((height * MAX) / width)
                                    width = MAX
                                  } else {
                                    width = Math.round((width * MAX) / height)
                                    height = MAX
                                  }
                                }
                                const canvas = document.createElement('canvas')
                                canvas.width = width
                                canvas.height = height
                                canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
                                resolve(canvas.toDataURL('image/jpeg', 0.85))
                              }
                              img.src = ev.target?.result as string
                            }
                            reader.readAsDataURL(file)
                          })

                        Promise.all(files.slice(0, remaining).map(resizeImage)).then((resized) => {
                          setFormData(prev => ({
                            ...prev,
                            attachments: [...prev.attachments, ...resized],
                          }))
                        })
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {formData.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`attachment-${idx}`}
                          className="w-20 h-20 object-cover rounded-lg border border-slate-600 cursor-pointer hover:brightness-90 transition"
                          onClick={() => setLightboxImg(img)}
                        />
                        <button
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            attachments: prev.attachments.filter((_, i) => i !== idx),
                          }))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          onClick={() => setLightboxImg(img)}
                        >
                          <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">ยังไม่มีรูปภาพประกอบ — คลิก "เพิ่มรูป" เพื่ออัพโหลด (สูงสุด 10 รูป)</p>
                )}
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

            {/* Reason field — required when editing */}
            {editingArticle && (
              <div className="px-6 pb-4 border-t border-slate-700/50 pt-4 bg-amber-500/5">
                <label className="block text-sm font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  เหตุผล / จุดที่แก้ไข <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="ระบุสิ่งที่แก้ไขและเหตุผล เช่น อัพเดตขั้นตอนตามเวอร์ชันใหม่, แก้ข้อมูลผิด"
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 border border-amber-500/40 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isItManager ? 'IT Manager: การเปลี่ยนแปลงจะมีผลทันที' : 'การแก้ไขจะส่งให้ IT Manager อนุมัติก่อน'}
                </p>
              </div>
            )}

            <div className="p-6 border-t border-slate-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingArticle(null)
                  resetForm()
                  setEditReason('')
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
                    <span>{editingArticle ? 'ส่งคำขอแก้ไข' : 'สร้างบทความ'}</span>
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

              {/* Attached Images */}
              {selectedArticle.attachments && selectedArticle.attachments.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-gray-400" />
                    รูปภาพประกอบ
                    <span className="text-xs text-gray-500 font-normal">({selectedArticle.attachments.length} รูป)</span>
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedArticle.attachments.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setLightboxImg(img)}
                        className="relative group w-28 h-28 rounded-xl overflow-hidden border border-slate-600 hover:border-blue-500/50 transition-colors"
                      >
                        <img src={img} alt={`img-${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

      {/* File Viewer Modal */}
      {showFileViewerModal && fileViewerArticle && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {fileViewerArticle.fileType && (() => {
                  const { Icon, color, label, bg } = getFileTypeInfo(fileViewerArticle.fileType)
                  return (
                    <span className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-xs ${color} ${bg}`}>
                      <Icon className="w-3 h-3" />
                      {label}
                    </span>
                  )
                })()}
                <h3 className="text-white font-semibold truncate">{fileViewerArticle.title}</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {fileViewerArticle.filePath && (
                  <a
                    href={buildFileUrl(fileViewerArticle.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    เปิดในแท็บใหม่
                  </a>
                )}
                {fileViewerArticle.filePath && (
                  <a
                    href={buildFileUrl(fileViewerArticle.filePath)}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    ดาวน์โหลด
                  </a>
                )}
                <button
                  onClick={() => setShowFileViewerModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 overflow-hidden p-4 min-h-0">
              {fileViewerArticle.fileType === 'PDF' && fileViewerArticle.filePath ? (
                <iframe
                  src={buildFileUrl(fileViewerArticle.filePath)}
                  className="w-full h-full rounded-lg border border-slate-700/50"
                  style={{ minHeight: '60vh' }}
                  title={fileViewerArticle.title}
                />
              ) : fileViewerArticle.fileType === 'IMAGE' && fileViewerArticle.filePath ? (
                <div className="flex items-center justify-center h-full" style={{ minHeight: '60vh' }}>
                  <img
                    src={buildFileUrl(fileViewerArticle.filePath)}
                    alt={fileViewerArticle.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-5" style={{ minHeight: '60vh' }}>
                  {fileViewerArticle.fileType && (() => {
                    const { Icon, color } = getFileTypeInfo(fileViewerArticle.fileType)
                    return <Icon className={`w-16 h-16 ${color}`} />
                  })()}
                  <div className="text-center">
                    <p className="text-gray-300 font-medium mb-1">ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้</p>
                    <p className="text-sm text-gray-500">กรุณาดาวน์โหลดเพื่อเปิดในโปรแกรมที่รองรับ</p>
                  </div>
                  {fileViewerArticle.filePath && (
                    <a
                      href={buildFileUrl(fileViewerArticle.filePath)}
                      download
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm"
                    >
                      <Download className="w-5 h-5" />
                      ดาวน์โหลดไฟล์
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Change Request Confirmation Modal */}
      {showDeleteReqModal && deleteReqArticle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">ขอลบบทความ</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300">
                บทความ: <span className="font-medium text-white">"{deleteReqArticle.title}"</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  เหตุผลที่ลบ <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={deleteReqReason}
                  onChange={(e) => setDeleteReqReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่ต้องการลบบทความนี้"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <p className="text-xs text-gray-500">
                {isItManager ? 'IT Manager: บทความจะถูกลบทันทีหลังยืนยัน' : 'คำขอจะถูกส่งให้ IT Manager อนุมัติก่อน'}
              </p>
            </div>
            <div className="p-6 border-t border-slate-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDeleteReqModal(false); setDeleteReqArticle(null) }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmitDeleteRequest}
                disabled={isSubmittingReq || !deleteReqReason.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmittingReq ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {isItManager ? 'ลบเลย' : 'ส่งคำขอลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 cursor-zoom-out"
          onClick={() => setLightboxImg(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={() => setLightboxImg(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImg}
            alt="preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
