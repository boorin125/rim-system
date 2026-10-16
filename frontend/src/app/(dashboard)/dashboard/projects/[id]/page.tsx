'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Plus, Calendar,
  Trash2, CheckCircle2, X, Save, AlertTriangle, MoreVertical,
  ChevronDown, ChevronUp, Copy, CheckSquare, Square, Search,
  PauseCircle, PlayCircle, ExternalLink, Phone, MapPin, Pencil, DoorOpen, Footprints,
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import { canPerformAction, getUserRoles } from '@/config/permissions'
import { formatStore } from '@/utils/formatStore'
import { useConfirm } from '@/components/ConfirmDialog'

const TASK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:        { label: 'รอมอบหมาย',    color: 'text-gray-400 bg-gray-800/60' },
  SCHEDULED:      { label: 'นัดหมายแล้ว',  color: 'text-blue-400 bg-blue-900/40' },
  IN_PROGRESS:    { label: 'กำลังทำงาน',   color: 'text-yellow-400 bg-yellow-900/40' },
  PENDING_VERIFY: { label: 'รอตรวจสอบ',    color: 'text-purple-400 bg-purple-900/40' },
  COMPLETED:      { label: 'เสร็จสมบูรณ์', color: 'text-green-400 bg-green-900/40' },
  RESCHEDULED:    { label: 'เลื่อนนัด',    color: 'text-orange-400 bg-orange-900/40' },
  ACCEPTED:       { label: 'ยอมรับแล้ว',   color: 'text-cyan-400 bg-cyan-900/40' },
  FAILED:         { label: 'ล้มเหลว',       color: 'text-red-400 bg-red-900/40' },
  REVISIT:        { label: 'Revisit',       color: 'text-pink-400 bg-pink-900/40' },
  ROLLBACK:       { label: 'Rollback',      color: 'text-amber-400 bg-amber-900/40' },
}

const PROJECT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Draft',     color: 'text-gray-400' },
  ACTIVE:    { label: 'Active',    color: 'text-green-400' },
  PAUSED:    { label: 'Paused',    color: 'text-yellow-400' },
  COMPLETED: { label: 'Completed', color: 'text-blue-400' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400' },
}

const DONE_STATUSES = ['COMPLETED', 'PENDING_VERIFY', 'ACCEPTED']

function isOverdue(task: any) {
  if (!task.scheduledDate) return false
  if (DONE_STATUSES.includes(task.status)) return false
  return new Date(task.scheduledDate) < new Date()
}

function getStoreIndicator(tasks: any[]): 'green' | 'red' | 'yellow' | null {
  if (!tasks || tasks.length === 0) return null
  const activeTasks = tasks.filter(t => !DONE_STATUSES.includes(t.status))
  if (activeTasks.length === 0) return 'green'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

  const normalize = (d: string) => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime() }

  if (activeTasks.some(t => t.scheduledDate && normalize(t.scheduledDate) === today.getTime())) return 'red'
  if (activeTasks.some(t => t.scheduledDate && normalize(t.scheduledDate) === tomorrow.getTime())) return 'yellow'
  return null
}

function storeProgress(tasks: any[]) {
  if (!tasks || tasks.length === 0) return { done: 0, total: 0, pct: 0 }
  const done = tasks.filter(t => DONE_STATUSES.includes(t.status)).length
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
}

function getStoreStatus(tasks: any[]): 'CLOSED' | 'ON_PROCESS' | 'PENDING' | 'EMPTY' {
  if (!tasks || tasks.length === 0) return 'EMPTY'
  const active = tasks.filter(t => !DONE_STATUSES.includes(t.status))
  if (active.length === 0) return 'CLOSED'
  if (active.some(t => isOverdue(t))) return 'PENDING'
  return 'ON_PROCESS'
}

// Task type: Opening = store opening day (the store turns ACTIVE automatically on that date)
function TaskTypeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1.5">ประเภทงาน</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
      >
        <option value="GENERAL">งานทั่วไป</option>
        <option value="OPENING">Opening — วันเปิดร้าน</option>
      </select>
      {value === 'OPENING' && (
        <p className="text-xs text-sky-400 mt-1.5">
          ต้องระบุวันนัด — สาขาที่ &quot;กำลังเปิดร้าน&quot; จะเปลี่ยนเป็น Active อัตโนมัติในวันนัด (1 สาขามีงาน Opening ได้ 1 งาน)
        </p>
      )}
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const themeHighlight = useThemeHighlight()
  const { confirm: confirmDialog, dialog: confirmDialogEl } = useConfirm()

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.className !== 'light'
    }
    return true
  })

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.className !== 'light')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const [project, setProject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Add store modal
  const [showAddStore, setShowAddStore] = useState(false)
  const [allStores, setAllStores] = useState<any[]>([])
  const [storeSearch, setStoreSearch] = useState('')
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<number>>(new Set())
  const [addingStore, setAddingStore] = useState(false)

  // New store (status OPENING) created from this project
  const EMPTY_NEW_STORE = { storeCode: '', name: '', company: '', province: '', address: '', phone: '' }
  const [showNewStore, setShowNewStore] = useState(false)
  const [newStoreForm, setNewStoreForm] = useState(EMPTY_NEW_STORE)
  const [creatingStore, setCreatingStore] = useState(false)

  // Add task modal
  const [showAddTask, setShowAddTask] = useState<{ projectStoreId: number; storeId: number } | null>(null)
  const [taskForm, setTaskForm] = useState({ title: '', taskType: 'GENERAL', assignedToId: '', scheduledDate: '', notes: '' })
  const [techUsers, setTechUsers] = useState<any[]>([])
  const [addingTask, setAddingTask] = useState(false)

  // Edit task modal (PM/Helpdesk)
  const [editTask, setEditTask] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title: '', taskType: 'GENERAL', assignedToId: '', scheduledDate: '', notes: '', reason: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Store filter
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CLOSED' | 'ON_PROCESS' | 'PENDING'>('ALL')

  // Store 3-dot menu
  const [storeMenuId, setStoreMenuId] = useState<number | null>(null)
  const [storeMenuPos, setStoreMenuPos] = useState<{ top: number; right: number } | null>(null)
  const storeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!storeMenuId) return
    const handler = (e: MouseEvent) => {
      if (storeMenuRef.current && !storeMenuRef.current.contains(e.target as Node)) {
        setStoreMenuId(null)
        setStoreMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [storeMenuId])

  // Collapse / expand per store
  const [collapsedStores, setCollapsedStores] = useState<Set<number>>(new Set())

  // Duplicate Tasks modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [dupSelectedTaskIds, setDupSelectedTaskIds] = useState<Set<number>>(new Set())
  const [dupSelectedStoreIds, setDupSelectedStoreIds] = useState<Set<number>>(new Set())
  const [dupStoreSearch, setDupStoreSearch] = useState('')
  const [duplicating, setDuplicating] = useState(false)
  const [dupResult, setDupResult] = useState<{ created: number; skippedCount: number; skipped: any[] } | null>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setCurrentUser(JSON.parse(userStr))
  }, [])

  const fetchProject = useCallback(async () => {
    const token = localStorage.getItem('token')
    setIsLoading(true)
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setProject(res.data)
      setCollapsedStores(new Set((res.data.projectStores || []).map((ps: any) => ps.id)))
    } catch {
      toast.error('โหลดข้อมูล Project ไม่สำเร็จ')
      router.push('/dashboard/projects')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { fetchProject() }, [fetchProject])

  const fetchTechUsers = async () => {
    const token = localStorage.getItem('token')
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { role: 'TECHNICIAN', status: 'ACTIVE' },
      })
      setTechUsers(res.data.data || res.data || [])
    } catch {}
  }

  const openAddStore = async () => {
    const token = localStorage.getItem('token')
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/stores`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5000 },
      })
      setAllStores(res.data.data || res.data || [])
    } catch {}
    setSelectedStoreIds(new Set())
    setStoreSearch('')
    setShowAddStore(true)
  }

  const toggleSelectStore = (storeId: number) => {
    setSelectedStoreIds(prev => {
      const next = new Set(prev)
      if (next.has(storeId)) next.delete(storeId)
      else next.add(storeId)
      return next
    })
  }

  const handleAddStore = async () => {
    if (selectedStoreIds.size === 0) return
    const token = localStorage.getItem('token')
    setAddingStore(true)
    let added = 0
    try {
      for (const storeId of Array.from(selectedStoreIds)) {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/stores`,
          { storeId },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        added++
      }
      toast.success(`เพิ่ม ${added} สาขาสำเร็จ`)
      setShowAddStore(false)
      setSelectedStoreIds(new Set())
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เพิ่มสาขาไม่สำเร็จ')
    } finally {
      setAddingStore(false)
    }
  }

  const openNewStore = () => {
    // Pre-fill company with the one most stores use
    const counts: Record<string, number> = {}
    for (const s of allStores) if (s.company) counts[s.company] = (counts[s.company] || 0) + 1
    const company = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    setNewStoreForm({ ...EMPTY_NEW_STORE, company })
    setShowAddStore(false)
    setShowNewStore(true)
  }

  const handleCreateStore = async () => {
    const f = newStoreForm
    if (!f.storeCode.trim() || !f.name.trim() || !f.company.trim()) {
      toast.error('กรุณากรอกรหัสสาขา ชื่อสาขา และบริษัท')
      return
    }
    const token = localStorage.getItem('token')
    setCreatingStore(true)
    try {
      const payload: any = { storeCode: f.storeCode.trim(), name: f.name.trim(), company: f.company.trim() }
      if (f.province.trim()) payload.province = f.province.trim()
      if (f.address.trim()) payload.address = f.address.trim()
      if (f.phone.trim()) payload.phone = f.phone.trim()
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/stores/new`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('สร้างสาขาใหม่แล้ว (กำลังเปิดร้าน) — เพิ่มงาน Opening เพื่อกำหนดวันเปิดร้าน')
      setShowNewStore(false)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'สร้างสาขาไม่สำเร็จ')
    } finally {
      setCreatingStore(false)
    }
  }

  const handleActivateStore = async (storeId: number) => {
    const ok = await confirmDialog({
      title: 'เปิดร้านตอนนี้ (Active)?',
      message: 'สาขาจะเปลี่ยนเป็น Active ทันทีโดยไม่รอวันนัด Opening และเปิด Incident ได้',
      confirmLabel: 'เปิดร้าน',
      cancelLabel: 'ยกเลิก',
      variant: 'warning',
    })
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      await axios.patch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/stores/${storeId}/activate`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('สาขาเปลี่ยนเป็น Active แล้ว')
      setStoreMenuId(null)
      setStoreMenuPos(null)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เปิดร้านไม่สำเร็จ')
    }
  }

  const handleRemoveStore = async (storeId: number) => {
    const ok = await confirmDialog({
      title: 'นำสาขาออกจากโปรเจกต์',
      message: 'Task ทั้งหมดในสาขานี้จะถูกลบออกด้วย ดำเนินการต่อ?',
      confirmLabel: 'นำออก',
      cancelLabel: 'ยกเลิก',
      variant: 'danger',
    })
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/stores/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('นำสาขาออกสำเร็จ')
      setStoreMenuId(null)
      setStoreMenuPos(null)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'นำสาขาออกไม่สำเร็จ')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    const ok = await confirmDialog({
      title: 'ลบ Task นี้?',
      message: 'ข้อมูล Task รวมถึงรูป อุปกรณ์ และ Checklist จะถูกลบถาวร',
      confirmLabel: 'ลบ',
      cancelLabel: 'ยกเลิก',
      variant: 'danger',
    })
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('ลบ Task สำเร็จ')
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ลบ Task ไม่สำเร็จ')
    }
  }

  const handleToggleStorePause = async (storeId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'PAUSED' ? 'ACTIVE' : 'PAUSED'
    const token = localStorage.getItem('token')
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/stores/${storeId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success(newStatus === 'PAUSED' ? 'หยุดสาขาชั่วคราวแล้ว' : 'เปิดใช้งานสาขาแล้ว')
      setStoreMenuId(null)
      setStoreMenuPos(null)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  const openAddTask = async (projectStoreId: number, storeId: number) => {
    await fetchTechUsers()
    setTaskForm({ title: '', taskType: 'GENERAL', assignedToId: '', scheduledDate: '', notes: '' })
    setShowAddTask({ projectStoreId, storeId })
  }

  const handleAddTask = async () => {
    if (!showAddTask) return
    if (taskForm.taskType === 'OPENING' && !taskForm.scheduledDate) {
      toast.error('งาน Opening ต้องระบุวันนัด (วันเปิดร้าน)')
      return
    }
    const token = localStorage.getItem('token')
    setAddingTask(true)
    try {
      const payload: any = { taskType: taskForm.taskType }
      if (taskForm.title.trim()) payload.title = taskForm.title.trim()
      if (taskForm.assignedToId) payload.assignedToId = parseInt(taskForm.assignedToId)
      if (taskForm.scheduledDate) payload.scheduledDate = taskForm.scheduledDate
      if (taskForm.notes.trim()) payload.notes = taskForm.notes.trim()

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/stores/${showAddTask.storeId}/tasks`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('เพิ่ม Task สำเร็จ')
      setShowAddTask(null)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เพิ่ม Task ไม่สำเร็จ')
    } finally {
      setAddingTask(false)
    }
  }

  const openEditTask = async (task: any) => {
    await fetchTechUsers()
    setEditForm({
      title: task.title || '',
      taskType: task.taskType || 'GENERAL',
      assignedToId: task.assignedToId ? String(task.assignedToId) : '',
      scheduledDate: task.scheduledDate ? task.scheduledDate.slice(0, 10) : '',
      notes: task.notes || '',
      reason: '',
    })
    setEditTask(task)
  }

  const handleSaveEdit = async () => {
    if (!editTask) return
    const token = localStorage.getItem('token')
    const originalDate = editTask.scheduledDate ? editTask.scheduledDate.slice(0, 10) : ''
    const dateChanged = editForm.scheduledDate !== originalDate

    if (dateChanged && !editForm.reason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่เปลี่ยนวันนัดหมาย')
      return
    }

    setSavingEdit(true)
    try {
      // Update title / technician / notes
      const payload: any = {
        title: editForm.title.trim() || null,
        notes: editForm.notes.trim() || null,
      }
      if (editForm.taskType !== (editTask.taskType || 'GENERAL')) {
        payload.taskType = editForm.taskType
        // backend requires a date for Opening — send it with the type change
        if (editForm.taskType === 'OPENING' && editForm.scheduledDate) payload.scheduledDate = editForm.scheduledDate
      }
      if (editForm.assignedToId) payload.assignedToId = parseInt(editForm.assignedToId)
      else payload.assignedToId = null
      if (!dateChanged && editForm.scheduledDate) payload.scheduledDate = editForm.scheduledDate

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${editTask.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      // If date changed, call reschedule (logs + sets RESCHEDULED status)
      if (dateChanged && editForm.scheduledDate) {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/tasks/${editTask.id}/reschedule`,
          { scheduledDate: editForm.scheduledDate, reason: editForm.reason.trim() },
          { headers: { Authorization: `Bearer ${token}` } },
        )
      }

      toast.success('บันทึกการแก้ไขสำเร็จ')
      setEditTask(null)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleCollapse = (psId: number) => {
    if (collapsedStores.has(psId)) {
      // Expanding: collapse all others (accordion)
      const allOtherIds = new Set<number>(
        (project?.projectStores || []).map((ps: any) => ps.id).filter((id: number) => id !== psId)
      )
      setCollapsedStores(allOtherIds)
    } else {
      // Collapsing this one
      setCollapsedStores(prev => new Set([...prev, psId]))
    }
  }

  const toggleDupTask = (taskId: number) => {
    setDupSelectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const toggleDupStore = (storeId: number) => {
    setDupSelectedStoreIds(prev => {
      const next = new Set(prev)
      if (next.has(storeId)) next.delete(storeId)
      else next.add(storeId)
      return next
    })
  }

  const openDuplicateModal = () => {
    setDupSelectedTaskIds(new Set())
    setDupSelectedStoreIds(new Set())
    setDupStoreSearch('')
    setDupResult(null)
    setShowDuplicateModal(true)
  }

  const handleDuplicate = async () => {
    if (dupSelectedTaskIds.size === 0 || dupSelectedStoreIds.size === 0) return
    const token = localStorage.getItem('token')
    setDuplicating(true)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}/duplicate-tasks`,
        { taskIds: Array.from(dupSelectedTaskIds), targetStoreIds: Array.from(dupSelectedStoreIds) },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setDupResult(res.data)
      fetchProject()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Duplicate ไม่สำเร็จ')
    } finally {
      setDuplicating(false)
    }
  }

  const formatDate = (d?: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const _projectRoles = currentUser ? getUserRoles(currentUser) : []
  const isTechnicianUser = _projectRoles.includes('TECHNICIAN') && !_projectRoles.some(r => ['SUPERVISOR', 'IT_MANAGER', 'HELP_DESK', 'SUPER_ADMIN'].includes(r))
  const canManage = !!currentUser && (
    canPerformAction(currentUser, '/dashboard/projects', 'create') ||
    _projectRoles.includes('SUPERVISOR')
  )
  // Creating a new (OPENING) store: Admin / IT Manager / Help Desk only (matches backend)
  const canCreateStore = !!currentUser && canPerformAction(currentUser, '/dashboard/projects', 'create')

  const filteredStores = allStores.filter(s => {
    const existing = project?.projectStores?.some((ps: any) => ps.storeId === s.id)
    if (existing) return false
    if (!storeSearch.trim()) return true
    const q = storeSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.storeCode.toLowerCase().includes(q) || (s.province || '').toLowerCase().includes(q)
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-700 rounded w-48 animate-pulse" />
        <div className="glass-card rounded-xl p-6 animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-2/3" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!project) return null

  const statusInfo = PROJECT_STATUS_LABELS[project.status] || { label: project.status, color: 'text-gray-400' }

  // For technician: keep only their own tasks per store, then hide stores with no matching tasks
  const userProjectStores = (project.projectStores || []).map((ps: any) => {
    if (!isTechnicianUser) return ps
    const myTasks = (ps.tasks || []).filter((t: any) => t.assignedToId === currentUser?.id)
    return { ...ps, tasks: myTasks }
  }).filter((ps: any) => !isTechnicianUser || ps.tasks.length > 0)

  const activeProjectStores = userProjectStores.filter((ps: any) => ps.status !== 'PAUSED')
  const totalStores = activeProjectStores.length
  const storeStatuses = activeProjectStores.map((ps: any) => getStoreStatus(ps.tasks || []))
  const onProcessCount = storeStatuses.filter((s: string) => s === 'ON_PROCESS').length
  const pendingCount = storeStatuses.filter((s: string) => s === 'PENDING').length
  const closedCount = storeStatuses.filter((s: string) => s === 'CLOSED').length

  const filteredProjectStores = userProjectStores.filter((ps: any) => {
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase()
      if (!ps.store.name.toLowerCase().includes(q) && !ps.store.storeCode.toLowerCase().includes(q)) return false
    }
    if (filterStatus !== 'ALL') {
      if (getStoreStatus(ps.tasks || []) !== filterStatus) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/projects" className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{project.name}</h1>
            <span className={`text-sm font-medium ${statusInfo.color}`}>({statusInfo.label})</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {project.description && <p className="text-gray-400 text-sm truncate">{project.description}</p>}
            <span className="text-gray-600 text-xs hidden sm:inline">|</span>
            <p className="text-gray-500 text-xs">
              PM: <span className="text-gray-400">
                {project.projectManager
                  ? `${project.projectManager.firstName} ${project.projectManager.lastName}`
                  : `${project.createdBy?.firstName || ''} ${project.createdBy?.lastName || ''}`}
              </span>
              {project.startDate && <span className="ml-3">{formatDate(project.startDate)} – {formatDate(project.endDate)}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'สาขาทั้งหมด', value: totalStores, color: 'text-blue-400',   dot: 'bg-blue-400',   cardBg: 'bg-blue-500/10 border border-blue-500/25' },
          { label: 'On Process',   value: onProcessCount, color: 'text-yellow-400', dot: 'bg-yellow-400', cardBg: 'bg-yellow-500/10 border border-yellow-500/25' },
          { label: 'Pending',      value: pendingCount,   color: 'text-red-400',    dot: 'bg-red-400',    cardBg: 'bg-red-500/10 border border-red-500/25' },
          { label: 'Closed',       value: closedCount,    color: 'text-green-400',  dot: 'bg-green-400',  cardBg: 'bg-green-500/10 border border-green-500/25' },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl p-4 text-center ${card.cardBg}`}>
            <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${card.dot}`} />
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-xl p-3 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสาขา หรือรหัสสาขา..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'ON_PROCESS', 'PENDING', 'CLOSED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterStatus === s ? 'text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/50'
              }`}
              style={filterStatus === s ? { backgroundColor: themeHighlight } : undefined}
            >
              {s === 'ALL' ? 'ทั้งหมด' : s === 'ON_PROCESS' ? 'On Process' : s === 'PENDING' ? 'Pending' : 'Closed'}
            </button>
          ))}
        </div>
      </div>

      {/* Stores Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: themeHighlight }} />
            สาขาในโปรเจกต์
          </h2>
          {canManage && (
            <div className="flex items-center gap-2">
              {(project.projectStores?.some((ps: any) => ps.tasks?.length > 0)) && (
                <button
                  onClick={openDuplicateModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-600 text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate Tasks
                </button>
              )}
              <button
                onClick={openAddStore}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-colors"
                style={{ backgroundColor: themeHighlight }}
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มสาขา
              </button>
            </div>
          )}
        </div>

        {filteredProjectStores.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Building2 className="w-10 h-10 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">
              {filterSearch || filterStatus !== 'ALL' ? 'ไม่พบสาขาที่ตรงกับการค้นหา' : 'ยังไม่มีสาขาในโปรเจกต์นี้'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjectStores.map((ps: any, idx: number) => {
              const indicator = getStoreIndicator(ps.tasks || [])
              const { done, total, pct } = storeProgress(ps.tasks || [])
              const borderClass = indicator === 'green' ? 'border-l-4 border-l-green-500'
                : indicator === 'red' ? 'border-l-4 border-l-red-500'
                : indicator === 'yellow' ? 'border-l-4 border-l-yellow-400'
                : ''
              const isCollapsed = collapsedStores.has(ps.id)
              const altBg = idx % 2 !== 0 ? 'bg-slate-700/20' : ''
              return (
              <div key={ps.id} className={`glass-card rounded-xl overflow-hidden ${borderClass} ${altBg} ${ps.status === 'PAUSED' ? 'opacity-60' : ''}`}>
                {/* Compact single-row header — click to expand/collapse */}
                <div
                  className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-slate-700/20 transition-colors"
                  onClick={() => toggleCollapse(ps.id)}
                >
                  {/* Store info + inline progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{formatStore(ps.store)}</span>
                      {ps.status === 'PAUSED' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-900/40 text-yellow-400">
                          <PauseCircle className="w-2.5 h-2.5" /> หยุดชั่วคราว
                        </span>
                      )}
                      {ps.store.storeStatus === 'OPENING' && (() => {
                        const openingTask = (ps.tasks || []).find((t: any) => t.taskType === 'OPENING')
                        return (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-900/40 text-sky-400"
                            title="สาขาจะเปลี่ยนเป็น Active อัตโนมัติในวันนัดของงาน Opening"
                          >
                            <DoorOpen className="w-2.5 h-2.5" />
                            กำลังเปิดร้าน{openingTask?.scheduledDate ? ` · ${formatDate(openingTask.scheduledDate)}` : ' · ยังไม่มีงาน Opening'}
                          </span>
                        )
                      })()}
                      {ps.visits?.total > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/60 text-gray-300"
                          title={`เข้างานจาก Project Task ${ps.visits.tasks} ครั้ง · จาก Incident ที่ทำงานให้สาขานี้ ${ps.visits.incidents} ครั้ง`}
                        >
                          <Footprints className="w-2.5 h-2.5" /> เข้างาน {ps.visits.total} ครั้ง
                        </span>
                      )}

                      {/* Inline mini progress bar */}
                      {total > 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-medium tabular-nums ${pct === 100 ? 'text-green-400' : 'text-gray-500'}`}>
                            {done}/{total}
                          </span>
                        </div>
                      )}

                      {/* Color badges */}
                      {indicator === 'green' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-900/40 text-green-400">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Closed
                        </span>
                      )}
                      {indicator === 'red' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-900/40 text-red-400">
                          <AlertTriangle className="w-2.5 h-2.5" /> วันนี้
                        </span>
                      )}
                      {indicator === 'yellow' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-900/40 text-yellow-400">
                          <Calendar className="w-2.5 h-2.5" /> พรุ่งนี้
                        </span>
                      )}
                    </div>
                    {(ps.store.address || ps.store.province || ps.store.phone || ps.store.googleMapLink) && (
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                        {(ps.store.address || ps.store.province) && (
                          <span className="text-gray-500 text-[11px] leading-none">
                            {[ps.store.address, ps.store.province].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {ps.store.phone && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(ps.store.phone); toast.success('คัดลอกเบอร์โทรแล้ว') }}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors leading-none"
                          >
                            <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                            {ps.store.phone}
                            <Copy className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                          </button>
                        )}
                        {ps.store.googleMapLink && (
                          <a
                            href={ps.store.googleMapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors leading-none"
                          >
                            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                            Google Maps
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canManage && ps.status !== 'PAUSED' && (
                      <button
                        onClick={() => openAddTask(ps.id, ps.storeId)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white hover:opacity-90 transition-colors"
                        style={{ backgroundColor: themeHighlight }}
                      >
                        <Plus className="w-3 h-3" /> Task
                      </button>
                    )}
                    {/* 3-dot menu */}
                    {canManage && (
                      <button
                        onClick={(e) => {
                          if (storeMenuId === ps.id) {
                            setStoreMenuId(null)
                            setStoreMenuPos(null)
                          } else {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setStoreMenuId(ps.id)
                            setStoreMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          }
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Task table */}
                {!isCollapsed && ps.tasks?.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm border-t border-slate-700/40">ยังไม่มี Task</div>
                )}
                {!isCollapsed && ps.tasks?.length > 0 && (
                  <div className="overflow-x-auto">
                  <div className="min-w-[650px]">
                    {/* Table Header */}
                    <div
                      className="grid grid-cols-[120px_140px_1fr_130px_160px] gap-2 px-4 py-2 bg-slate-800/60 border-b border-slate-700/40 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: isDark ? '#ffffff' : '#1e293b' }}
                    >
                      <span>สถานะ</span>
                      <span className="font-mono">Ticket No.</span>
                      <span>ชื่อ Task</span>
                      <span>วันนัดหมาย</span>
                      <span>ช่าง</span>
                    </div>
                    {/* Task rows — sorted by scheduledDate asc (nulls last by id) */}
                    <div className="divide-y divide-slate-700/30">
                      {[...ps.tasks].sort((a: any, b: any) => {
                        if (!a.scheduledDate && !b.scheduledDate) return a.id - b.id
                        if (!a.scheduledDate) return 1
                        if (!b.scheduledDate) return -1
                        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
                      }).map((task: any) => {
                        const { label, color } = TASK_STATUS_LABELS[task.status] || { label: task.status, color: 'text-gray-400 bg-gray-800/60' }
                        const overdue = isOverdue(task)
                        return (
                          <div key={task.id} className="group relative">
                            <Link
                              href={`/dashboard/projects/task/${task.id}`}
                              className="grid grid-cols-[120px_140px_1fr_130px_160px] gap-2 px-4 py-3 items-center hover:bg-slate-700/30 transition-colors"
                            >
                              {/* สถานะ */}
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium text-center w-fit ${color}`}>
                                {label}
                              </span>

                              {/* Ticket No. */}
                              <span className="font-mono text-[11px] text-gray-400 tracking-wider truncate">
                                {task.ticketNo || '-'}
                              </span>

                              {/* Task Name */}
                              <span className="text-sm text-white truncate font-medium flex items-center gap-1.5 min-w-0">
                                {task.taskType === 'OPENING' && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-900/40 text-sky-400 flex-shrink-0">
                                    <DoorOpen className="w-2.5 h-2.5" /> Opening
                                  </span>
                                )}
                                <span className="truncate">
                                  {task.title || <span className="text-gray-500 italic text-xs">ไม่มีชื่อ Task</span>}
                                </span>
                              </span>

                              {/* วันนัดหมาย */}
                              <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-gray-400'}`}>
                                {overdue && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                                <Calendar className={`w-3 h-3 flex-shrink-0 ${overdue ? 'text-red-400' : 'text-gray-500'}`} />
                                {task.scheduledDate ? formatDate(task.scheduledDate) : '-'}
                              </span>

                              {/* ช่าง */}
                              <span className="text-xs text-gray-400 truncate">
                                {task.assignedTo
                                  ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                                  : <span className="italic text-gray-600">ไม่มอบหมาย</span>}
                              </span>
                            </Link>

                            {/* Action buttons — PM/Helpdesk/Supervisor only */}
                            {canManage && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditTask(task) }}
                                  className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors"
                                  title="แก้ไข Task"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTask(task.id) }}
                                  className="p-1.5 rounded bg-slate-700/80 hover:bg-red-900/60 text-gray-400 hover:text-red-400 transition-colors"
                                  title="ลบ Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  </div>
                )}

                {/* Incidents opened (at any store) to work for this project store */}
                {!isCollapsed && ps.supportIncidents?.length > 0 && (
                  <div className="border-t border-slate-700/40 px-4 py-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-400">Incident ที่ทำงานให้สาขานี้</p>
                    {ps.supportIncidents.map((inc: any) => (
                      <Link
                        key={inc.id}
                        href={`/dashboard/incidents/${inc.id}`}
                        className="flex items-center gap-2 text-xs hover:bg-slate-700/30 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <span className="font-mono text-orange-300 flex-shrink-0">{inc.ticketNumber}</span>
                        <span className="text-gray-300 truncate flex-1">{inc.title}</span>
                        <span className="text-gray-500 flex-shrink-0 hidden sm:inline">ที่ {formatStore({ storeCode: inc.storeCode, name: inc.storeName })}</span>
                        <span className="text-gray-500 flex-shrink-0">{inc.status}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        )}
      </div>

      {/* ── Add Store Modal ── */}
      {showAddStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '85vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div>
                <h3 className="text-white font-semibold text-lg">เพิ่มสาขาในโปรเจกต์</h3>
                <p className="text-xs text-gray-400 mt-0.5">เลือกได้หลายสาขาพร้อมกัน</p>
              </div>
              <div className="flex items-center gap-2">
                {canCreateStore && <button
                  onClick={openNewStore}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-sky-700/60 text-sky-300 hover:bg-sky-900/30 transition-colors"
                  title="สาขาใหม่ที่ยังไม่เปิด — สถานะกำลังเปิดร้าน"
                >
                  <DoorOpen className="w-3.5 h-3.5" /> สร้างร้านใหม่
                </button>}
                <button onClick={() => setShowAddStore(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Search + Select All */}
            <div className="px-5 pt-4 pb-2 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาสาขา, รหัส หรือจังหวัด..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              {filteredStores.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{filteredStores.length} สาขา</span>
                  <button
                    onClick={() => {
                      if (selectedStoreIds.size === filteredStores.length) {
                        setSelectedStoreIds(new Set())
                      } else {
                        setSelectedStoreIds(new Set(filteredStores.map((s: any) => s.id)))
                      }
                    }}
                    className="text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ color: themeHighlight }}
                  >
                    {selectedStoreIds.size === filteredStores.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>
              )}
            </div>

            {/* Store List */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1">
              {filteredStores.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-gray-500 text-sm">ไม่พบสาขา</p>
                  {canCreateStore && (
                    <button
                      onClick={openNewStore}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-colors"
                      style={{ backgroundColor: themeHighlight }}
                    >
                      <Plus className="w-3.5 h-3.5" /> สร้างร้านใหม่ (กำลังเปิดร้าน)
                    </button>
                  )}
                </div>
              ) : filteredStores.map((s: any) => {
                const selected = selectedStoreIds.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSelectStore(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                      selected ? 'bg-slate-700/60 text-white' : 'text-gray-300 hover:bg-slate-700/40'
                    }`}
                  >
                    {selected
                      ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: themeHighlight }} />
                      : <Square className="w-4 h-4 flex-shrink-0 text-gray-600" />
                    }
                    <span className="flex-1 min-w-0">
                      <span>{formatStore(s)}</span>
                      {s.province && <span className="text-gray-500 text-xs ml-1.5">— {s.province}</span>}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-700/50 flex gap-2">
              <button
                onClick={handleAddStore}
                disabled={selectedStoreIds.size === 0 || addingStore}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: themeHighlight }}
              >
                {addingStore
                  ? 'กำลังเพิ่ม...'
                  : selectedStoreIds.size > 0
                    ? `เพิ่ม ${selectedStoreIds.size} สาขา`
                    : 'เพิ่มสาขา'
                }
              </button>
              <button
                onClick={() => setShowAddStore(false)}
                className="flex-1 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Task Modal ── */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg">เพิ่ม Task</h3>
              <button onClick={() => setShowAddTask(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">ชื่อ Task</label>
              <input type="text" value={taskForm.title} onChange={(e) => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="เช่น ติดตั้ง Barcode Scanner..." className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <TaskTypeField value={taskForm.taskType} onChange={(v) => setTaskForm(f => ({ ...f, taskType: v }))} />

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">มอบหมายช่าง</label>
              <select value={taskForm.assignedToId} onChange={(e) => setTaskForm(f => ({ ...f, assignedToId: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="">-- ยังไม่มอบหมาย --</option>
                {techUsers.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">วันนัดหมาย</label>
              <input type="date" value={taskForm.scheduledDate} onChange={(e) => setTaskForm(f => ({ ...f, scheduledDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">หมายเหตุ</label>
              <textarea value={taskForm.notes} onChange={(e) => setTaskForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder="หมายเหตุเพิ่มเติม..." className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAddTask} disabled={addingTask}
                className="flex-1 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: themeHighlight }}>
                {addingTask ? 'กำลังบันทึก...' : 'เพิ่ม Task'}
              </button>
              <button onClick={() => setShowAddTask(null)} className="flex-1 py-2 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50 transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal (PM/Helpdesk) ── */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">แก้ไข Task</h3>
                {editTask.ticketNo && <p className="text-xs font-mono text-gray-400 mt-0.5">{editTask.ticketNo}</p>}
              </div>
              <button onClick={() => setEditTask(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">ชื่อ Task</label>
              <input type="text" value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <TaskTypeField value={editForm.taskType} onChange={(v) => setEditForm(f => ({ ...f, taskType: v }))} />
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">มอบหมายช่าง</label>
              <select value={editForm.assignedToId} onChange={(e) => setEditForm(f => ({ ...f, assignedToId: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="">-- ไม่มอบหมาย --</option>
                {techUsers.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">วันนัดหมาย</label>
              <input type="date" value={editForm.scheduledDate} onChange={(e) => setEditForm(f => ({ ...f, scheduledDate: e.target.value, reason: '' }))}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            {/* Reason field — appears when date is changed */}
            {editForm.scheduledDate !== (editTask?.scheduledDate ? editTask.scheduledDate.slice(0, 10) : '') && (
              <div className="rounded-lg border border-orange-800/50 bg-orange-900/15 p-3 space-y-2">
                <label className="block text-sm text-orange-400 font-medium">
                  เหตุผลที่เปลี่ยนวันนัดหมาย <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  placeholder="เช่น ลูกค้าขอเลื่อน, ช่างติดงานด่วน..."
                  className="w-full px-3 py-2 bg-slate-800/60 border border-orange-800/40 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">หมายเหตุ</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveEdit}
                disabled={
                  savingEdit ||
                  (editForm.scheduledDate !== (editTask?.scheduledDate ? editTask.scheduledDate.slice(0, 10) : '') && !editForm.reason.trim())
                }
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: themeHighlight }}>
                <Save className="w-3.5 h-3.5" />
                {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setEditTask(null)} className="flex-1 py-2 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50 transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicate Tasks Modal ── */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ padding: '72px 16px 16px' }}>
          <div className="glass-card rounded-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '100%' }}>
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div>
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <Copy className="w-5 h-5" style={{ color: themeHighlight }} /> Duplicate Tasks
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">เลือก Task และสาขาปลายทาง — วันที่และช่างต้องเลือกใหม่หลัง Duplicate</p>
              </div>
              <button onClick={() => setShowDuplicateModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {dupResult ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium text-lg">Duplicate เสร็จสิ้น</p>
                    <p className="text-gray-400 text-sm">
                      สร้างแล้ว <span className="text-green-400 font-bold">{dupResult.created}</span> Tasks
                      {dupResult.skippedCount > 0 && (
                        <> · ข้าม <span className="text-yellow-400 font-bold">{dupResult.skippedCount}</span> Tasks (ชื่อซ้ำ)</>
                      )}
                    </p>
                  </div>
                </div>
                {dupResult.skipped.length > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                    <p className="text-yellow-400 text-xs font-medium mb-2">Tasks ที่ถูกข้าม (ชื่อซ้ำในสาขาปลายทาง):</p>
                    {dupResult.skipped.map((s, i) => (
                      <p key={i} className="text-yellow-300/80 text-xs">• "{s.title}" → {s.storeName}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="w-full py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                  style={{ backgroundColor: themeHighlight }}
                >
                  ปิด
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Section 1: Select Tasks — deduplicated by title */}
                  {(() => {
                    const uniqueTasks: { id: number; title: string | null; ticketNo: string | null }[] = []
                    const seenTitles = new Set<string>()
                    for (const ps of project.projectStores || []) {
                      for (const t of ps.tasks || []) {
                        const key = t.title || ''
                        if (!seenTitles.has(key)) {
                          seenTitles.add(key)
                          uniqueTasks.push({ id: t.id, title: t.title, ticketNo: t.ticketNo })
                        }
                      }
                    }
                    const allUniqueIds = uniqueTasks.map(t => t.id)
                    const allSelected = allUniqueIds.length > 0 && allUniqueIds.every(tid => dupSelectedTaskIds.has(tid))
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-gray-300">
                            เลือก Task ที่ต้องการ Duplicate
                            {dupSelectedTaskIds.size > 0 && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: themeHighlight }}>
                                {dupSelectedTaskIds.size}
                              </span>
                            )}
                          </p>
                          <button
                            onClick={() => setDupSelectedTaskIds(allSelected ? new Set() : new Set(allUniqueIds))}
                            className="text-xs font-medium hover:opacity-80 transition-opacity"
                            style={{ color: themeHighlight }}
                          >
                            {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                          </button>
                        </div>
                        <div className="space-y-1">
                          {uniqueTasks.map((task) => {
                            const selected = dupSelectedTaskIds.has(task.id)
                            return (
                              <button
                                key={task.id}
                                onClick={() => toggleDupTask(task.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                  selected ? 'bg-slate-700/60 text-white' : 'text-gray-400 hover:bg-slate-700/30 hover:text-gray-300'
                                }`}
                              >
                                {selected
                                  ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: themeHighlight }} />
                                  : <Square className="w-4 h-4 flex-shrink-0 text-gray-600" />
                                }
                                <span className="truncate">{task.title || <span className="italic text-gray-600">ไม่มีชื่อ Task</span>}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Section 2: Select Destination Stores */}
                  <div>
                    {(() => {
                      // Build map of taskId → title for selected tasks
                      const taskIdToTitle = new Map<number, string>()
                      for (const ps of project.projectStores || []) {
                        for (const t of ps.tasks || []) {
                          taskIdToTitle.set(t.id, t.title || '')
                        }
                      }
                      const selectedTitles = new Set([...dupSelectedTaskIds].map(id => taskIdToTitle.get(id) || ''))

                      const filteredDupStores = (project.projectStores || []).filter((ps: any) => {
                        // Hide stores that already have ALL selected task titles
                        if (selectedTitles.size > 0) {
                          const storeTitles = new Set((ps.tasks || []).map((t: any) => t.title || ''))
                          const alreadyHasAll = [...selectedTitles].every(title => storeTitles.has(title))
                          if (alreadyHasAll) return false
                        }
                        if (!dupStoreSearch.trim()) return true
                        const q = dupStoreSearch.toLowerCase()
                        return ps.store.name.toLowerCase().includes(q) || ps.store.storeCode.toLowerCase().includes(q) || (ps.store.province || '').toLowerCase().includes(q)
                      })
                      const filteredIds = filteredDupStores.map((ps: any) => ps.storeId)
                      const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((sid: number) => dupSelectedStoreIds.has(sid))
                      return (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-300">
                              เลือกสาขาปลายทาง
                              {dupSelectedStoreIds.size > 0 && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: themeHighlight }}>
                                  {dupSelectedStoreIds.size}
                                </span>
                              )}
                            </p>
                            <button
                              onClick={() => {
                                if (allFilteredSelected) {
                                  setDupSelectedStoreIds(prev => {
                                    const next = new Set(prev)
                                    filteredIds.forEach((sid: number) => next.delete(sid))
                                    return next
                                  })
                                } else {
                                  setDupSelectedStoreIds(prev => new Set([...prev, ...filteredIds]))
                                }
                              }}
                              className="text-xs font-medium hover:opacity-80 transition-opacity"
                              style={{ color: themeHighlight }}
                            >
                              {allFilteredSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                            </button>
                          </div>
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="ค้นหาสาขาปลายทาง..."
                              value={dupStoreSearch}
                              onChange={(e) => setDupStoreSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {filteredDupStores.length === 0 ? (
                              <p className="text-gray-500 text-sm col-span-2 py-3 text-center">
                                {selectedTitles.size > 0 ? 'ทุกสาขามี Task นี้อยู่แล้ว' : 'ไม่พบสาขาที่ตรงกัน'}
                              </p>
                            ) : filteredDupStores.map((ps: any) => {
                              const selected = dupSelectedStoreIds.has(ps.storeId)
                              return (
                                <button
                                  key={ps.id}
                                  onClick={() => toggleDupStore(ps.storeId)}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                    selected ? 'bg-slate-700/60 text-white' : 'text-gray-400 hover:bg-slate-700/30 hover:text-gray-300'
                                  }`}
                                >
                                  {selected
                                    ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: themeHighlight }} />
                                    : <Square className="w-4 h-4 flex-shrink-0 text-gray-600" />
                                  }
                                  <span className="truncate">{formatStore(ps.store)}</span>
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                <div className="flex gap-2 p-5 border-t border-slate-700/50">
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating || dupSelectedTaskIds.size === 0 || dupSelectedStoreIds.size === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: themeHighlight }}
                  >
                    <Copy className="w-4 h-4" />
                    {duplicating
                      ? 'กำลัง Duplicate...'
                      : `Duplicate ${dupSelectedTaskIds.size} Tasks → ${dupSelectedStoreIds.size} สาขา`}
                  </button>
                  <button
                    onClick={() => setShowDuplicateModal(false)}
                    className="flex-1 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── New Store Modal (OPENING) ── */}
      {showNewStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <DoorOpen className="w-5 h-5 text-sky-400" /> สร้างร้านใหม่
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  สถานะ &quot;กำลังเปิดร้าน&quot; — เปิด Incident ไม่ได้จนกว่าจะ Active (อัตโนมัติตามวันนัดงาน Opening หรือกดเปิดเอง)
                </p>
              </div>
              <button onClick={() => setShowNewStore(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {([
              { key: 'storeCode', label: 'รหัสสาขา', required: true, placeholder: 'เช่น 711' },
              { key: 'name', label: 'ชื่อสาขา', required: true, placeholder: 'เช่น Central World' },
              { key: 'company', label: 'บริษัท', required: true, placeholder: 'เช่น WATSONS' },
              { key: 'province', label: 'จังหวัด', required: false, placeholder: 'เช่น BANGKOK' },
              { key: 'address', label: 'ที่อยู่', required: false, placeholder: '' },
              { key: 'phone', label: 'เบอร์โทร', required: false, placeholder: '' },
            ] as const).map(({ key, label, required, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-gray-300 mb-1.5">
                  {label} {required && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="text"
                  value={newStoreForm[key]}
                  onChange={(e) => setNewStoreForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
            <p className="text-xs text-gray-500">ข้อมูลอื่น (IP, SLA Region, ฯลฯ) แก้ไขภายหลังได้ที่หน้า Stores</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreateStore}
                disabled={creatingStore}
                className="flex-1 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: themeHighlight }}
              >
                {creatingStore ? 'กำลังสร้าง...' : 'สร้างและเพิ่มในโปรเจกต์'}
              </button>
              <button onClick={() => setShowNewStore(false)} className="flex-1 py-2 rounded-lg text-gray-400 hover:text-white text-sm hover:bg-slate-700/50 transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Store 3-dot dropdown (fixed — renders above all cards) ── */}
      {storeMenuId !== null && storeMenuPos && (() => {
        const menuPs = (project?.projectStores || []).find((ps: any) => ps.id === storeMenuId)
        if (!menuPs) return null
        return (
          <div
            ref={storeMenuRef}
            style={{ position: 'fixed', top: storeMenuPos.top, right: storeMenuPos.right, zIndex: 9999 }}
            className="w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={() => { setStoreMenuId(null); setStoreMenuPos(null); router.push(`/dashboard/stores/${menuPs.storeId}/edit`) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" /> แก้ไขข้อมูลสาขา
            </button>
            {menuPs.store?.storeStatus === 'OPENING' && (
              <button
                onClick={() => handleActivateStore(menuPs.storeId)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-sky-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
              >
                <DoorOpen className="w-3.5 h-3.5 text-sky-400" /> เปิดร้านตอนนี้ (Active)
              </button>
            )}
            <button
              onClick={() => handleToggleStorePause(menuPs.storeId, menuPs.status || 'ACTIVE')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
            >
              {menuPs.status === 'PAUSED'
                ? <><PlayCircle className="w-3.5 h-3.5 text-green-400" /> เปิดใช้งาน</>
                : <><PauseCircle className="w-3.5 h-3.5 text-yellow-400" /> ยกเลิก</>
              }
            </button>
            <button
              onClick={() => handleRemoveStore(menuPs.storeId)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/30 transition-colors text-left border-t border-slate-700"
            >
              <Trash2 className="w-3.5 h-3.5" /> นำออกจากโปรเจกต์
            </button>
          </div>
        )
      })()}

      {confirmDialogEl}
    </div>
  )
}
