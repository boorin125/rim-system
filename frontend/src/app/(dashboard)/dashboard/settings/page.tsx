// app/(dashboard)/dashboard/settings/page.tsx - Settings with Tabs: Organization, Email, SLA, Backup, Info
'use client'

import { useState, useEffect, useRef } from 'react'
import { useTabState } from '@/hooks/useTabState'
import { TimeInput } from '@/components/TimeInput'
import {
  Settings,
  Mail,
  Clock,
  Database,
  Info,
  Save,
  Loader2,
  AlertCircle,
  Server,
  Send,
  Users,
  Download,
  Upload,
  Shield,
  Code,
  Phone,
  Globe,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  HardDrive,
  Plus,
  Trash2,
  Building2,
  ImageIcon,
  Tags,
  Briefcase,
  ChevronRight,
  TicketIcon,
  Palette,
  FileText,
  ShieldCheck,
  Zap,
  PackageOpen,
  History,
  RotateCcw,
  CircleDot,
  Key,
  AlertTriangle,
  LogOut,
  Smartphone,
  QrCode,
  Copy,
  FolderOpen,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useThemeHighlight } from '@/hooks/useThemeHighlight'
import LicenseActivateModal from '@/components/LicenseActivateModal'
import LicenseManagementModal from '@/components/LicenseManagementModal'

// Tab types
type TabType = 'organization' | 'incident' | 'email' | 'sla' | 'service-report' | 'backup' | 'info' | 'theme' | 'mobile-app'

// Organization Settings Interface
interface OrganizationSettings {
  organizationName: string
  incidentPrefix: string
  logoPath: string
  organizationAddress: string
}

// Email Settings Interface
interface EmailSettings {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpSecure: boolean
  fromEmail: string
  fromName: string
  closeNotificationTo: string
  closeNotificationCc: string
  ccStoreEmail: boolean
}

// SLA Config Interface
interface SLAConfig {
  id: number
  priority: string
  name: string
  displayName: string
  responseTime: number
  resolutionTime: number
  responseTimeMinutes: number
  resolutionTimeMinutes: number
  // Provincial times (optional - falls back to default if not set)
  responseTimeProvincial?: number
  resolutionTimeProvincial?: number
  color: string
  isActive: boolean
  warningThreshold: number
}

// Backup Interface
interface BackupInfo {
  id: number
  filename: string
  size: string
  createdAt: string
  type: 'auto' | 'manual'
}

// Backup Schedule Interface
interface BackupSchedule {
  id: number
  name: string
  description?: string
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  timeOfDay: string
  dayOfWeek?: number
  dayOfMonth?: number
  isActive: boolean
  retentionDays: number
  maxBackups: number
  storageType: 'LOCAL' | 'EXTERNAL'
  externalPath?: string
  lastRunAt?: string
  nextRunAt?: string
}

// Service Report Settings Interface
interface ServiceReportSettings {
  providerName: string
  providerAddress: string
  providerPhone: string
  providerEmail: string
  providerTaxId: string
  providerLogo: string
  templateStyle: 'classic' | 'modern'
  srThemeBgStart: string
  srThemeBgEnd: string
}

// System Info Interface
interface SystemInfo {
  version: string
  buildDate: string
  developer: string
  website: string
  email: string
  phones: { number: string; name: string }[]
}

interface LicenseInfo {
  hasLicense: boolean
  valid?: boolean
  reason?: string
  machineId?: string
  daysRemaining?: number
  license?: {
    id: number
    licenseKey: string
    licenseType: string
    organizationName: string
    status: string
    expiresAt: string
    maxUsers: number
    maxStores: number
    maxIncidentsMonth: number | null
  }
}

// ─── Mobile App Tab ───────────────────────────────────────────────────────────
function MobileAppTab() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Auto-detect server URL from current window
    if (typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? `${window.location.origin}/api`
      const base = apiUrl.replace('/api', '').replace(/\/$/, '')
      setServerUrl(base)
      const qrPayload = JSON.stringify({ rimServer: base })
      QRCode.toDataURL(qrPayload, { width: 280, margin: 2, color: { dark: '#f1f5f9', light: '#1e293b' } })
        .then(setQrDataUrl)
    }
  }, [])

  function copyUrl() {
    navigator.clipboard.writeText(serverUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Smartphone className="w-5 h-5 text-cyan-400" />
        <h2 className="text-xl font-semibold text-white">Mobile App — RIM System</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code */}
        <div className="p-6 bg-slate-700/30 rounded-xl border border-slate-600/30 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 self-start">
            <QrCode className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-300">QR Code สำหรับ Connect</span>
          </div>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Server QR Code" className="rounded-xl mb-4" style={{ width: 200, height: 200 }} />
          ) : (
            <div className="w-[200px] h-[200px] bg-slate-800 rounded-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          )}
          <p className="text-xs text-slate-400 text-center mt-2">
            ให้ช่างสแกน QR Code นี้เพื่อเชื่อมต่อ App กับ Server
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
            <p className="text-sm font-semibold text-slate-300 mb-2">Server URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-800 rounded-lg px-3 py-2 text-indigo-300 break-all">
                {serverUrl || 'กำลังโหลด...'}
              </code>
              <button
                onClick={copyUrl}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                title="คัดลอก URL"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
            <p className="text-sm font-semibold text-slate-300 mb-3">วิธีติดตั้ง App</p>
            <ol className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">1.</span>
                <span>ดาวน์โหลด <strong className="text-white">RIM System</strong> จาก Google Play Store</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">2.</span>
                <span>เปิด App → กดปุ่ม <strong className="text-white">สแกน QR Code</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">3.</span>
                <span>สแกน QR Code ด้านซ้าย หรือกรอก Server URL ด้วยตนเอง</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">4.</span>
                <span>Login ด้วย Email/Password บัญชี RIM System ปกติ</span>
              </li>
            </ol>
          </div>

          <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <p className="text-xs text-amber-300 flex gap-2">
              <span>⚠️</span>
              <span>App รองรับเฉพาะบัญชีที่มี Role: <strong>Technician, Supervisor, Helpdesk, IT Manager</strong> เท่านั้น</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const themeHighlight = useThemeHighlight()
  const [activeTab, setActiveTab] = useTabState<TabType>('organization')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)

  // Organization Settings State
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>({
    organizationName: '',
    incidentPrefix: 'INC',
    logoPath: '',
    organizationAddress: '',
  })
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Email Settings State
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: true,
    fromEmail: '',
    fromName: 'RIM System',
    closeNotificationTo: '',
    closeNotificationCc: '',
    ccStoreEmail: false,
  })

  // CC Emails State (for dynamic list)
  const [ccEmails, setCcEmails] = useState<string[]>([''])

  // SLA Config State
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([])
  const [editingSlaId, setEditingSlaId] = useState<number | null>(null)
  const [slaFormData, setSlaFormData] = useState({
    displayName: '',
    responseTimeMinutes: 0,
    resolutionTimeMinutes: 0,
    responseTimeProvincial: 0,
    resolutionTimeProvincial: 0,
    warningThreshold: 80
  })

  // Backup State
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  // Restore from file state
  const restoreFileRef = useRef<HTMLInputElement>(null)
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null)
  const [restoreFileName, setRestoreFileName] = useState('')
  const [showRestoreFileModal, setShowRestoreFileModal] = useState(false)
  const [restoreFilePassword, setRestoreFilePassword] = useState('')
  const [restoreFileNeedsPassword, setRestoreFileNeedsPassword] = useState(false)
  const [isRestoringFile, setIsRestoringFile] = useState(false)
  // which groups are IN the backup file (parsed from metadata.tables)
  const [restoreAvailableGroups, setRestoreAvailableGroups] = useState<string[]>([])
  // which groups the user wants to restore (default = all available)
  const [restoreSelectedGroups, setRestoreSelectedGroups] = useState<string[]>([])

  // Create backup with password state
  const [showBackupPasswordModal, setShowBackupPasswordModal] = useState(false)
  const [backupPassword, setBackupPassword] = useState('')
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState('')

  // Backup group selection (all checked by default = Full backup)
  const BACKUP_GROUPS = [
    { id: 'config',    label: 'ตั้งค่าระบบ',              description: 'SLA, หมวดหมู่, Job Type, License, ตั้งค่าองค์กร', tables: ['system_configs', 'sla_configs', 'incident_categories', 'job_types', 'licenses'] },
    { id: 'users',     label: 'ผู้ใช้งาน',                description: 'บัญชีผู้ใช้และสิทธิ์การเข้าถึง', tables: ['users', 'user_role_assignments'] },
    { id: 'stores',    label: 'ร้านค้า & อุปกรณ์',        description: 'ข้อมูลร้านค้า อุปกรณ์ และประวัติ', tables: ['stores', 'equipment', 'equipment_logs'] },
    { id: 'incidents', label: 'งาน Incident',              description: 'Incident ทั้งหมด ความคิดเห็น อะไหล่ ประวัติ SLA Defense', tables: ['incidents', 'incident_assignees', 'incident_reassignments', 'incident_ratings', 'sla_defenses', 'comments', 'spare_parts', 'incident_history', 'notifications'] },
    { id: 'outsource', label: 'Outsource',                 description: 'งาน Outsource และการเสนอราคา', tables: ['outsource_jobs', 'outsource_bids'] },
    { id: 'pm',        label: 'Preventive Maintenance',    description: 'บันทึก PM อุปกรณ์', tables: ['pm_records', 'pm_equipment_records'] },
    { id: 'knowledge', label: 'Knowledge Base',            description: 'บทความและหมวดหมู่ความรู้', tables: ['knowledge_categories', 'knowledge_articles'] },
  ]
  const ALL_GROUP_IDS = BACKUP_GROUPS.map(g => g.id)
  const [selectedBackupGroups, setSelectedBackupGroups] = useState<string[]>(ALL_GROUP_IDS)

  // Auto Backup Schedule State
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    name: 'Daily Backup',
    frequency: 'DAILY' as 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
    timeOfDay: '00:00',
    dayOfWeek: 0,
    dayOfMonth: 1,
    retentionDays: 30,
    maxBackups: 10,
    isActive: true,
    storageType: 'LOCAL' as 'LOCAL' | 'EXTERNAL',
    externalPath: '',
    schedulePassword: '',
    schedulePasswordConfirm: '',
  })
  // Custom name for manual backup
  const [backupCustomName, setBackupCustomName] = useState('')

  // Service Warranty Settings State
  const [warrantyDays, setWarrantyDays] = useState<number>(30)
  const [isSavingWarranty, setIsSavingWarranty] = useState(false)

  // Auto Assign Onsite Setting State
  const [autoAssignOnsite, setAutoAssignOnsite] = useState(false)
  const [isSavingAutoAssign, setIsSavingAutoAssign] = useState(false)

  // Service Report Settings State
  const [srSettings, setSrSettings] = useState<ServiceReportSettings>({
    providerName: '',
    providerAddress: '',
    providerPhone: '',
    providerEmail: '',
    providerTaxId: '',
    providerLogo: '',
    templateStyle: 'classic',
    srThemeBgStart: '',
    srThemeBgEnd: '',
  })
  const [isUploadingSrLogo, setIsUploadingSrLogo] = useState(false)
  const srLogoInputRef = useRef<HTMLInputElement>(null)

  // Theme State
  const themePresets = [
    { name: 'Slate', bgStart: '#0f172a', bgEnd: '#1e293b' },
    { name: 'Navy', bgStart: '#0a1628', bgEnd: '#1a2744' },
    { name: 'Emerald', bgStart: '#052e16', bgEnd: '#14532d' },
    { name: 'Purple', bgStart: '#1a0533', bgEnd: '#2e1065' },
    { name: 'Rose', bgStart: '#2a0a18', bgEnd: '#4c0519' },
    { name: 'Orange', bgStart: '#431407', bgEnd: '#9a3412' },
    { name: 'Gold', bgStart: '#1c1500', bgEnd: '#3d2900' },
    { name: 'Charcoal', bgStart: '#111111', bgEnd: '#1f1f1f' },
    { name: 'Ocean', bgStart: '#0c1929', bgEnd: '#164e63' },
    { name: 'Midnight', bgStart: '#020617', bgEnd: '#0f172a' },
  ]
  const srThemePresets = [
    ...themePresets,
    { name: 'Gold Bright', bgStart: '#78350f', bgEnd: '#d97706' },
  ]

  // Adjust hex color brightness: factor 0=darkest, 50=original, 100=lightest
  const adjustHex = (hex: string, factor: number): string => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    if (factor === 50) return hex
    const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)))
    if (factor < 50) {
      const t = factor / 50
      return `#${clamp(r * t).toString(16).padStart(2, '0')}${clamp(g * t).toString(16).padStart(2, '0')}${clamp(b * t).toString(16).padStart(2, '0')}`
    }
    const t = (factor - 50) / 50
    return `#${clamp(r + (255 - r) * t).toString(16).padStart(2, '0')}${clamp(g + (255 - g) * t).toString(16).padStart(2, '0')}${clamp(b + (255 - b) * t).toString(16).padStart(2, '0')}`
  }

  const [selectedTheme, setSelectedTheme] = useState({ bgStart: '#0f172a', bgEnd: '#1e293b' })
  const [savedTheme, setSavedTheme] = useState({ bgStart: '#0f172a', bgEnd: '#1e293b' })
  const [basePreset, setBasePreset] = useState<{ bgStart: string; bgEnd: string } | null>(null)
  const [themeBrightness, setThemeBrightness] = useState(50)

  // System Info State
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    version: '1.0.0',
    buildDate: '2024-01-15',
    developer: 'Rubjobb Development Team',
    website: 'https://rub-jobb.com',
    email: 'support@rub-jobb.com',
    phones: [
      { number: '061-228-2879', name: 'คุณเหมียว' },
      { number: '081-822-6788', name: 'คุณบอย' },
    ],
  })

  // License State
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [deactivateKey, setDeactivateKey] = useState('')
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      // Support both single role and multi-role
      const roles = user.roles || (user.role ? [user.role] : [])
      setUserRoles(roles)
    }
    fetchData()
  }, [])

  const [showPatchModal, setShowPatchModal] = useState(false)

  const openPatchModal = () => {
    setShowPatchModal(true)
    fetchVersionData()
  }

  const fetchLicense = async () => {
    setLicenseLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/license/current`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setLicenseInfo(res.data)
    } catch {
      setLicenseInfo({ hasLicense: false })
    } finally {
      setLicenseLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!licenseInfo?.license?.licenseKey) return
    if (deactivateKey !== licenseInfo.license.licenseKey) {
      toast.error('License Key ไม่ถูกต้อง')
      return
    }
    setDeactivating(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/deactivate`, {
        licenseKey: deactivateKey,
      }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('Deactivate License สำเร็จ — พร้อม Activate ที่ Server ใหม่')
      setShowDeactivateConfirm(false)
      setDeactivateKey('')
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setDeactivating(false)
    }
  }

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch Organization Settings
      try {
        const orgRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/organization`,
          { headers }
        )
        if (orgRes.data) {
          setOrgSettings(orgRes.data)
        }
      } catch {
        // Use defaults if not found
      }

      // Fetch Email Settings
      try {
        const emailRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/email`,
          { headers }
        )
        if (emailRes.data) {
          setEmailSettings(emailRes.data)
          // Parse CC emails into array
          if (emailRes.data.closeNotificationCc) {
            const emails = emailRes.data.closeNotificationCc
              .split(',')
              .map((e: string) => e.trim())
              .filter((e: string) => e.length > 0)
            setCcEmails(emails.length > 0 ? emails : [''])
          } else {
            setCcEmails([''])
          }
        }
      } catch {
        // Use defaults if not found
      }

      // Fetch SLA Configs
      try {
        const slaRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/sla?includeInactive=true`,
          { headers }
        )
        // Map API response to our interface
        const mappedConfigs = (slaRes.data || []).map((sla: any) => ({
          id: sla.id,
          priority: sla.priority,
          name: sla.name,
          displayName: sla.displayName || sla.name,
          responseTime: sla.responseTimeMinutes / 60,
          resolutionTime: sla.resolutionTimeMinutes / 60,
          responseTimeMinutes: sla.responseTimeMinutes,
          resolutionTimeMinutes: sla.resolutionTimeMinutes,
          // Provincial times (fall back to default if not set)
          responseTimeProvincial: sla.responseTimeProvincial || Math.round(sla.responseTimeMinutes * 1.5),
          resolutionTimeProvincial: sla.resolutionTimeProvincial || Math.round(sla.resolutionTimeMinutes * 1.5),
          color: sla.color || '#6B7280',
          isActive: sla.isActive,
          warningThreshold: sla.warningThreshold || 80
        }))
        setSlaConfigs(mappedConfigs)
      } catch {
        // Use defaults with provincial times (1.5x multiplier)
        setSlaConfigs([
          { id: 1, priority: 'CRITICAL', name: 'Critical', displayName: 'Critical', responseTime: 0.25, resolutionTime: 4, responseTimeMinutes: 15, resolutionTimeMinutes: 240, responseTimeProvincial: 30, resolutionTimeProvincial: 360, color: '#EF4444', isActive: true, warningThreshold: 70 },
          { id: 2, priority: 'HIGH', name: 'High', displayName: 'High', responseTime: 0.5, resolutionTime: 8, responseTimeMinutes: 30, resolutionTimeMinutes: 480, responseTimeProvincial: 45, resolutionTimeProvincial: 720, color: '#F97316', isActive: true, warningThreshold: 75 },
          { id: 3, priority: 'MEDIUM', name: 'Medium', displayName: 'Medium', responseTime: 1, resolutionTime: 24, responseTimeMinutes: 60, resolutionTimeMinutes: 1440, responseTimeProvincial: 90, resolutionTimeProvincial: 2160, color: '#EAB308', isActive: true, warningThreshold: 80 },
          { id: 4, priority: 'LOW', name: 'Low', displayName: 'Low', responseTime: 2, resolutionTime: 72, responseTimeMinutes: 120, resolutionTimeMinutes: 4320, responseTimeProvincial: 180, resolutionTimeProvincial: 5760, color: '#22C55E', isActive: true, warningThreshold: 85 },
        ])
      }

      // Fetch Backups
      try {
        const backupRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/backups`,
          { headers }
        )
        setBackups(backupRes.data || [])
      } catch {
        setBackups([])
      }

      // Fetch Backup Schedules
      try {
        const scheduleRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/schedules`,
          { headers }
        )
        const schedules = scheduleRes.data || []
        if (schedules.length > 0) {
          const firstSchedule = schedules[0]
          setSchedule(firstSchedule)
          setScheduleForm({
            name: firstSchedule.name || 'Daily Backup',
            frequency: firstSchedule.frequency || 'DAILY',
            timeOfDay: firstSchedule.timeOfDay || '00:00',
            dayOfWeek: firstSchedule.dayOfWeek ?? 0,
            dayOfMonth: firstSchedule.dayOfMonth ?? 1,
            retentionDays: firstSchedule.retentionDays ?? 30,
            maxBackups: firstSchedule.maxBackups ?? 10,
            isActive: firstSchedule.isActive ?? true,
            storageType: firstSchedule.storageType || 'LOCAL',
            externalPath: firstSchedule.externalPath || '',
            schedulePassword: '',
            schedulePasswordConfirm: '',
          })
        }
      } catch {
        // No schedules yet
        setSchedule(null)
      }

      // Fetch Service Report Settings
      try {
        const srRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/service-report`,
          { headers }
        )
        if (srRes.data) {
          setSrSettings(srRes.data)
        }
      } catch {
        // Use defaults
      }

      // Fetch Theme Settings
      try {
        const themeRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/theme`,
          { headers }
        )
        if (themeRes.data) {
          setSelectedTheme({ bgStart: themeRes.data.bgStart, bgEnd: themeRes.data.bgEnd })
          setSavedTheme({ bgStart: themeRes.data.bgStart, bgEnd: themeRes.data.bgEnd })
        }
      } catch {
        // Use defaults
      }

      // Fetch Incident Settings (Service Warranty)
      try {
        const incidentRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/incident`,
          { headers }
        )
        if (incidentRes.data?.serviceWarrantyDays !== undefined) {
          setWarrantyDays(incidentRes.data.serviceWarrantyDays)
        }
        if (incidentRes.data?.autoAssignOnsite !== undefined) {
          setAutoAssignOnsite(incidentRes.data.autoAssignOnsite)
        }
      } catch {
        // Use defaults
      }

      // Fetch System Info
      try {
        const infoRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/system-info`,
          { headers }
        )
        if (infoRes.data) {
          setSystemInfo(prev => ({ ...prev, ...infoRes.data }))
        }
      } catch {
        // Use defaults
      }

      // Fetch current app version — must run AFTER system-info to avoid being overwritten
      try {
        const verRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/version`, { headers })
        if (verRes.data?.version) {
          setSystemInfo(prev => ({ ...prev, version: verRes.data.version }))
        }
      } catch {
        // Keep whatever version was set by system-info
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setIsLoading(false)
    }

    // Fetch license separately (no auth required for current license)
    fetchLicense()
  }

  const canManage = userRoles.includes('SUPER_ADMIN') || userRoles.includes('IT_MANAGER')

  // ========================================
  // ORGANIZATION SETTINGS HANDLERS
  // ========================================

  const handleSaveOrgSettings = async () => {
    // Validate prefix
    if (orgSettings.incidentPrefix && !/^[A-Za-z]{1,3}$/.test(orgSettings.incidentPrefix)) {
      toast.error('Incident prefix must be 1-3 letters')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/organization`,
        {
          organizationName: orgSettings.organizationName,
          incidentPrefix: orgSettings.incidentPrefix.toUpperCase(),
          organizationAddress: orgSettings.organizationAddress,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setOrgSettings(prev => ({
        ...prev,
        incidentPrefix: prev.incidentPrefix.toUpperCase()
      }))
      toast.success('Organization settings saved successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save organization settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveWarrantySettings = async () => {
    if (warrantyDays < 0) {
      toast.error('Service warranty days must be 0 or more')
      return
    }
    setIsSavingWarranty(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/incident`,
        { serviceWarrantyDays: warrantyDays },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Incident settings saved successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save incident settings')
    } finally {
      setIsSavingWarranty(false)
    }
  }

  const handleToggleAutoAssign = async (value: boolean) => {
    setAutoAssignOnsite(value)
    setIsSavingAutoAssign(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/incident`,
        { autoAssignOnsite: value },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(value ? 'เปิดใช้งาน Auto Assign แล้ว' : 'ปิดใช้งาน Auto Assign แล้ว')
    } catch (error: any) {
      setAutoAssignOnsite(!value) // revert on error
      toast.error(error.response?.data?.message || 'Failed to save setting')
    } finally {
      setIsSavingAutoAssign(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.match(/^image\/(png|jpeg|jpg|gif|svg\+xml)$/)) {
      toast.error('Only image files are allowed (PNG, JPG, GIF, SVG)')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file must be less than 5MB')
      return
    }

    setIsUploadingLogo(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('logo', file)

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/organization/logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setOrgSettings(prev => ({
        ...prev,
        logoPath: res.data.logoPath,
      }))
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      // Reset input
      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }
    }
  }

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the logo?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/organization/logo`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setOrgSettings(prev => ({
        ...prev,
        logoPath: '',
      }))
      toast.success('Logo deleted successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete logo')
    }
  }

  // ========================================
  // SERVICE REPORT SETTINGS HANDLERS
  // ========================================

  const isSuperAdmin = userRoles.includes('SUPER_ADMIN')

  const handleSaveServiceReportSettings = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/service-report`,
        {
          providerName: srSettings.providerName,
          providerAddress: srSettings.providerAddress,
          providerPhone: srSettings.providerPhone,
          providerEmail: srSettings.providerEmail,
          providerTaxId: srSettings.providerTaxId,
          templateStyle: srSettings.templateStyle,
          srThemeBgStart: srSettings.srThemeBgStart,
          srThemeBgEnd: srSettings.srThemeBgEnd,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('บันทึกการตั้งค่า Service Report สำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถบันทึกได้')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSrLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.match(/^image\/(png|jpeg|jpg|gif|svg\+xml)$/)) {
      toast.error('รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, GIF, SVG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ต้องมีขนาดไม่เกิน 5MB')
      return
    }

    setIsUploadingSrLogo(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('logo', file)

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/service-report/logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setSrSettings(prev => ({ ...prev, providerLogo: res.data.logoPath }))
      toast.success('อัปโหลดโลโก้สำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถอัปโหลดได้')
    } finally {
      setIsUploadingSrLogo(false)
      if (srLogoInputRef.current) srLogoInputRef.current.value = ''
    }
  }

  const handleDeleteSrLogo = async () => {
    if (!confirm('ต้องการลบโลโก้ Service Report หรือไม่?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/service-report/logo`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSrSettings(prev => ({ ...prev, providerLogo: '' }))
      toast.success('ลบโลโก้สำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ไม่สามารถลบโลโก้ได้')
    }
  }

  // ========================================
  // EMAIL SETTINGS HANDLERS
  // ========================================

  const handleSaveEmailSettings = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      // Join CC emails array into comma-separated string
      const ccEmailsString = ccEmails
        .map(e => e.trim())
        .filter(e => e.length > 0)
        .join(', ')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/email`,
        { ...emailSettings, closeNotificationCc: ccEmailsString },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Email settings saved successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save email settings')
    } finally {
      setIsSaving(false)
    }
  }

  // CC Email handlers
  const handleAddCcEmail = () => {
    setCcEmails([...ccEmails, ''])
  }

  const handleRemoveCcEmail = (index: number) => {
    if (ccEmails.length > 1) {
      setCcEmails(ccEmails.filter((_, i) => i !== index))
    } else {
      setCcEmails([''])
    }
  }

  const handleCcEmailChange = (index: number, value: string) => {
    const newCcEmails = [...ccEmails]
    newCcEmails[index] = value
    setCcEmails(newCcEmails)
  }

  const handleTestEmail = async () => {
    try {
      const token = localStorage.getItem('token')
      // Join CC emails array into comma-separated string
      const ccEmailsString = ccEmails
        .map(e => e.trim())
        .filter(e => e.length > 0)
        .join(', ')

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/email/test`,
        {
          to: emailSettings.closeNotificationTo || emailSettings.fromEmail,
          cc: ccEmailsString || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Test email sent successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send test email')
    }
  }

  // ========================================
  // SLA CONFIG HANDLERS
  // ========================================

  const handleUpdateSlaConfig = async (id: number) => {
    if (!slaFormData.displayName.trim()) {
      toast.error('Please enter display name')
      return
    }
    if (slaFormData.responseTimeMinutes < 1) {
      toast.error('Bangkok/Metro response time must be at least 1 minute')
      return
    }
    if (slaFormData.resolutionTimeMinutes < 1) {
      toast.error('Bangkok/Metro resolution time must be at least 1 minute')
      return
    }
    if (slaFormData.responseTimeProvincial < 1) {
      toast.error('Provincial response time must be at least 1 minute')
      return
    }
    if (slaFormData.resolutionTimeProvincial < 1) {
      toast.error('Provincial resolution time must be at least 1 minute')
      return
    }

    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/sla/${id}`,
        {
          displayName: slaFormData.displayName,
          responseTimeMinutes: slaFormData.responseTimeMinutes,
          resolutionTimeMinutes: slaFormData.resolutionTimeMinutes,
          responseTimeProvincial: slaFormData.responseTimeProvincial,
          resolutionTimeProvincial: slaFormData.resolutionTimeProvincial,
          warningThreshold: slaFormData.warningThreshold
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSlaConfigs(prev => prev.map(sla =>
        sla.id === id ? {
          ...sla,
          displayName: slaFormData.displayName,
          responseTimeMinutes: slaFormData.responseTimeMinutes,
          resolutionTimeMinutes: slaFormData.resolutionTimeMinutes,
          responseTimeProvincial: slaFormData.responseTimeProvincial,
          resolutionTimeProvincial: slaFormData.resolutionTimeProvincial,
          responseTime: slaFormData.responseTimeMinutes / 60,
          resolutionTime: slaFormData.resolutionTimeMinutes / 60,
          warningThreshold: slaFormData.warningThreshold
        } : sla
      ))
      setEditingSlaId(null)
      toast.success('SLA configuration updated')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update SLA')
    }
  }

  const startEditingSla = (sla: SLAConfig) => {
    setEditingSlaId(sla.id)
    setSlaFormData({
      displayName: sla.displayName || sla.name,
      responseTimeMinutes: sla.responseTimeMinutes || sla.responseTime * 60,
      resolutionTimeMinutes: sla.resolutionTimeMinutes || sla.resolutionTime * 60,
      responseTimeProvincial: sla.responseTimeProvincial || Math.round((sla.responseTimeMinutes || sla.responseTime * 60) * 1.5),
      resolutionTimeProvincial: sla.resolutionTimeProvincial || Math.round((sla.resolutionTimeMinutes || sla.resolutionTime * 60) * 1.5),
      warningThreshold: sla.warningThreshold || 80
    })
  }

  const cancelEditingSla = () => {
    setEditingSlaId(null)
    setSlaFormData({
      displayName: '',
      responseTimeMinutes: 0,
      resolutionTimeMinutes: 0,
      responseTimeProvincial: 0,
      resolutionTimeProvincial: 0,
      warningThreshold: 80
    })
  }

  // Helper function to format minutes to readable string
  const formatMinutesToDisplay = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours < 24) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`
    }
    return `${days}d`
  }

  // ========================================
  // BACKUP HANDLERS
  // ========================================

  const handleCreateBackup = async (password?: string) => {
    if (selectedBackupGroups.length === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 หัวข้อ')
      return
    }
    setIsCreatingBackup(true)
    try {
      const token = localStorage.getItem('token')
      const isAll = selectedBackupGroups.length === BACKUP_GROUPS.length
      const payload: any = {}
      if (password) payload.password = password
      if (backupCustomName.trim()) payload.customName = backupCustomName.trim()
      if (isAll) {
        payload.scope = 'ALL'
      } else {
        payload.scope = 'SELECTIVE'
        payload.scopeDetails = BACKUP_GROUPS
          .filter(g => selectedBackupGroups.includes(g.id))
          .flatMap(g => g.tables)
      }
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/backups`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('สร้าง Backup สำเร็จ')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create backup')
    } finally {
      setIsCreatingBackup(false)
      setShowBackupPasswordModal(false)
      setBackupPassword('')
      setBackupPasswordConfirm('')
      setBackupCustomName('')
      setSelectedBackupGroups(ALL_GROUP_IDS)
    }
  }

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      try {
        const parsed = JSON.parse(content)
        setRestoreFileContent(content)
        setRestoreFileNeedsPassword(!!parsed?.metadata?.passwordHash)
        setRestoreFilePassword('')

        // Determine which backup groups are present in this file
        const tablesInFile: string[] = parsed?.metadata?.tables || Object.keys(parsed?.data || {})
        const availableGroups = BACKUP_GROUPS
          .filter(g => g.tables.some((t: string) => tablesInFile.includes(t)))
          .map(g => g.id)
        setRestoreAvailableGroups(availableGroups)
        setRestoreSelectedGroups(availableGroups) // default: restore all available

        setShowRestoreFileModal(true)
      } catch {
        toast.error('Invalid backup file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleRestoreFromFile = async () => {
    if (!restoreFileContent) return

    // License check
    if (!licenseInfo?.hasLicense || !licenseInfo?.valid) {
      toast.error('ต้อง Activate License ก่อนจึงจะใช้ฟีเจอร์ Restore ได้')
      return
    }

    setIsRestoringFile(true)
    try {
      const token = localStorage.getItem('token')
      // Compute selected tables from selected groups
      const selectedTables = BACKUP_GROUPS
        .filter(g => restoreSelectedGroups.includes(g.id))
        .flatMap(g => g.tables)

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/restore-file`,
        {
          content: restoreFileContent,
          password: restoreFilePassword || undefined,
          selectedTables: selectedTables.length > 0 ? selectedTables : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = res.data
      if (data.errors && Object.keys(data.errors).length > 0) {
        const errorSummary = Object.entries(data.errors)
          .map(([table, msg]) => `${table}: ${msg}`)
          .join('\n')
        toast.success(`Restore บางส่วนสำเร็จ: ${data.message}`)
        console.error('Restore errors by table:', data.errors)
        alert(`Restore สำเร็จบางส่วน\n\nข้อผิดพลาด:\n${errorSummary}`)
      } else {
        toast.success(`Restore สำเร็จ: ${data.message}`)
      }
      setShowRestoreFileModal(false)
      setRestoreFileContent(null)
      setRestoreFilePassword('')
      setTimeout(() => window.location.reload(), 1000)
    } catch (error: any) {
      const msg = error.response?.data?.message
      if (msg === 'PASSWORD_REQUIRED') toast.error('Backup นี้มีการป้องกัน Password')
      else if (msg === 'INVALID_PASSWORD') toast.error('Password ไม่ถูกต้อง')
      else toast.error(msg || 'Restore ล้มเหลว')
    } finally {
      setIsRestoringFile(false)
    }
  }

  const handleDownloadBackup = async (backup: BackupInfo) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/${backup.id}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', backup.filename)
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Backup downloaded')
    } catch (error: any) {
      toast.error('Failed to download backup')
    }
  }

  const handleRestoreBackup = async (backup: BackupInfo) => {
    if (!confirm(`Are you sure you want to restore from "${backup.filename}"? This will overwrite current data.`)) {
      return
    }

    setIsRestoring(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/${backup.id}/restore`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Backup restored successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to restore backup')
    } finally {
      setIsRestoring(false)
    }
  }

  const handleDeleteBackup = async (backup: BackupInfo) => {
    if (!confirm(`Delete backup "${backup.filename}"?`)) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/${backup.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Backup deleted')
      fetchData()
    } catch (error: any) {
      toast.error('Failed to delete backup')
    }
  }

  // ========================================
  // AUTO BACKUP SCHEDULE HANDLERS
  // ========================================

  const handleSaveSchedule = async () => {
    if (scheduleForm.schedulePassword && scheduleForm.schedulePassword !== scheduleForm.schedulePasswordConfirm) {
      toast.error('Password ไม่ตรงกัน')
      return
    }
    setIsSavingSchedule(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      // Build payload: exclude confirm field, only send schedulePassword if non-empty
      const { schedulePasswordConfirm, schedulePassword, ...rest } = scheduleForm
      const payload: any = { ...rest }
      if (schedulePassword) payload.schedulePassword = schedulePassword

      if (schedule) {
        const res = await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/schedules/${schedule.id}`,
          payload,
          { headers }
        )
        setSchedule(res.data)
      } else {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/schedules`,
          payload,
          { headers }
        )
        setSchedule(res.data)
      }

      setIsEditingSchedule(false)
      toast.success('บันทึก Auto Backup Schedule สำเร็จ')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save schedule')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const handleToggleSchedule = async () => {
    if (!schedule) return

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/settings/backups/schedules/${schedule.id}/toggle`,
        { isActive: !schedule.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSchedule({ ...schedule, isActive: !schedule.isActive })
      setScheduleForm({ ...scheduleForm, isActive: !schedule.isActive })
      toast.success(schedule.isActive ? 'Auto backup disabled' : 'Auto backup enabled')
    } catch (error: any) {
      toast.error('Failed to toggle schedule')
    }
  }

  const startEditingSchedule = () => {
    if (schedule) {
      setScheduleForm({
        name: schedule.name || 'Daily Backup',
        frequency: schedule.frequency || 'DAILY',
        timeOfDay: schedule.timeOfDay || '00:00',
        dayOfWeek: schedule.dayOfWeek ?? 0,
        dayOfMonth: schedule.dayOfMonth ?? 1,
        retentionDays: schedule.retentionDays ?? 30,
        maxBackups: schedule.maxBackups ?? 10,
        isActive: schedule.isActive ?? true,
        storageType: schedule.storageType || 'LOCAL',
        externalPath: schedule.externalPath || '',
        schedulePassword: '',
        schedulePasswordConfirm: '',
      })
    }
    setIsEditingSchedule(true)
  }

  const cancelEditingSchedule = () => {
    setIsEditingSchedule(false)
    if (schedule) {
      setScheduleForm({
        name: schedule.name || 'Daily Backup',
        frequency: schedule.frequency || 'DAILY',
        timeOfDay: schedule.timeOfDay || '00:00',
        dayOfWeek: schedule.dayOfWeek ?? 0,
        dayOfMonth: schedule.dayOfMonth ?? 1,
        retentionDays: schedule.retentionDays ?? 30,
        maxBackups: schedule.maxBackups ?? 10,
        isActive: schedule.isActive ?? true,
        storageType: schedule.storageType || 'LOCAL',
        externalPath: schedule.externalPath || '',
        schedulePassword: '',
        schedulePasswordConfirm: '',
      })
    }
  }

  // Format schedule frequency for display
  const formatScheduleFrequency = (s: BackupSchedule | null) => {
    if (!s) return 'Not configured'

    const time = s.timeOfDay || '00:00'
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    switch (s.frequency) {
      case 'HOURLY':
        return 'Every hour'
      case 'DAILY':
        return `Daily at ${time}`
      case 'WEEKLY':
        return `Weekly on ${days[s.dayOfWeek || 0]} at ${time}`
      case 'MONTHLY':
        return `Monthly on day ${s.dayOfMonth || 1} at ${time}`
      default:
        return `${s.frequency} at ${time}`
    }
  }

  // ========================================
  // VERSION MANAGEMENT STATE & HANDLERS
  // ========================================

  const [versionCurrent, setVersionCurrent] = useState<any>(null)
  const [versionHistory, setVersionHistory] = useState<any[]>([])
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionInstalling, setVersionInstalling] = useState(false)
  const [versionRollingBack, setVersionRollingBack] = useState<string | null>(null)
  const [selectedPatch, setSelectedPatch] = useState<File | null>(null)
  const [patchPreview, setPatchPreview] = useState<any | null>(null)
  const [patchValidating, setPatchValidating] = useState(false)
  const [releaseNotesModal, setReleaseNotesModal] = useState<any | null>(null)

  // Install progress
  const [installJobId, setInstallJobId] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState<{
    step: number; total: number; pct: number; message: string;
    status: 'running' | 'done' | 'error'; result?: any; error?: string;
  } | null>(null)
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchVersionData = async () => {
    if (!isSuperAdmin) return
    setVersionLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const [curRes, histRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/version`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/version/history`, { headers }),
      ])
      setVersionCurrent(curRes.data)
      setVersionHistory(histRes.data || [])
    } catch {
      toast.error('Failed to load version info')
    } finally {
      setVersionLoading(false)
    }
  }

  const handlePatchFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedPatch(file)
    setPatchPreview(null)
    setPatchValidating(true)
    try {
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('patch', file)
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/version/validate`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      })
      setPatchPreview(res.data.manifest)
      toast.success('Patch file is valid')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Patch validation failed')
      setSelectedPatch(null)
    } finally {
      setPatchValidating(false)
    }
  }

  const handleInstallPatch = async () => {
    if (!selectedPatch || !patchPreview) return
    if (!confirm(`Install version ${patchPreview.version}? A snapshot will be created before installation.`)) return

    setVersionInstalling(true)
    setInstallProgress({ step: 0, total: 5, pct: 0, message: 'Starting installation…', status: 'running' })

    try {
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('patch', selectedPatch)

      // POST install → returns { jobId }
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/version/install`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      })
      const jobId: string = res.data.jobId
      setInstallJobId(jobId)

      // Poll progress every 500ms
      installPollRef.current = setInterval(async () => {
        try {
          const statusRes = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/version/install-status/${jobId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          const job = statusRes.data
          setInstallProgress({
            step: job.step,
            total: job.total,
            pct: job.pct,
            message: job.message,
            status: job.status,
            result: job.result,
            error: job.error,
          })

          if (job.status === 'done') {
            clearInterval(installPollRef.current!)
            installPollRef.current = null
            setVersionInstalling(false)
            setSelectedPatch(null)
            setPatchPreview(null)
            await fetchVersionData()
          } else if (job.status === 'error') {
            clearInterval(installPollRef.current!)
            installPollRef.current = null
            setVersionInstalling(false)
            toast.error(job.error || 'Installation failed')
          }
        } catch {
          // ignore poll errors
        }
      }, 500)
    } catch (err: any) {
      setVersionInstalling(false)
      setInstallProgress(null)
      toast.error(err.response?.data?.message || 'Failed to start installation')
    }
  }

  const handleCloseInstallProgress = () => {
    if (installProgress?.status === 'running') return // cannot close while running
    setInstallProgress(null)
    setInstallJobId(null)
  }

  const handleRollback = async (targetVersion: string) => {
    if (!confirm(`Rollback to version ${targetVersion}? Current code will be replaced from snapshot.`)) return
    setVersionRollingBack(targetVersion)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/version/rollback/${targetVersion}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success(`Rolled back to version ${targetVersion}`)
      await fetchVersionData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Rollback failed')
    } finally {
      setVersionRollingBack(null)
    }
  }

  // ========================================
  // RENDER HELPERS
  // ========================================

  const tabs = [
    { id: 'organization' as TabType, label: 'Organization', icon: Building2 },
    { id: 'incident' as TabType, label: 'Incident', icon: TicketIcon },
    { id: 'email' as TabType, label: 'Email', icon: Mail },
    { id: 'sla' as TabType, label: 'SLA', icon: Clock },
    ...(isSuperAdmin ? [{ id: 'service-report' as TabType, label: 'Service Report', icon: FileText }] : []),
    { id: 'backup' as TabType, label: 'Backup / Restore', icon: Database },
    { id: 'theme' as TabType, label: 'Theme', icon: Palette },
    { id: 'mobile-app' as TabType, label: 'Mobile App', icon: Smartphone },
    { id: 'info' as TabType, label: 'Info', icon: Info },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-blue-600/20 rounded-xl">
          <Settings className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">System configuration and preferences</p>
        </div>
      </div>

      {/* Tabs — horizontal scroll on all screen sizes */}
      <div className="border-b border-slate-700 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 inline mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6 rounded-2xl">
        {/* Organization Tab */}
        {activeTab === 'organization' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Building2 className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-semibold text-white">Organization Settings</h2>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Configure your organization name and branding. The incident prefix will be used for all new incident ticket numbers.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Basic Info */}
              <div className="space-y-6">
                {/* Organization Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Organization / Customer Name
                  </label>
                  <input
                    type="text"
                    value={orgSettings.organizationName}
                    onChange={(e) => setOrgSettings({ ...orgSettings, organizationName: e.target.value })}
                    disabled={!canManage}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="e.g., Watsons Thailand"
                  />
                  <p className="text-xs text-gray-500 mt-1">This name will be displayed throughout the system</p>
                </div>

                {/* Incident Prefix */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Incident Number Prefix
                  </label>
                  <input
                    type="text"
                    value={orgSettings.incidentPrefix}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
                      setOrgSettings({ ...orgSettings, incidentPrefix: value })
                    }}
                    disabled={!canManage}
                    maxLength={3}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-mono text-lg tracking-wider"
                    placeholder="INC"
                  />
                  <p className="text-xs text-gray-500 mt-1">1-3 uppercase letters (e.g., WAT for Watsons, INC for default)</p>
                </div>

                {/* Preview */}
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Incident Number Preview:</p>
                  <p className="text-xl font-mono text-white">
                    {orgSettings.incidentPrefix || 'INC'}
                    {new Date().getFullYear().toString().slice(-2)}
                    {(new Date().getMonth() + 1).toString().padStart(2, '0')}
                    0001
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Format: [PREFIX][YY][MM][XXXX]
                  </p>
                </div>
              </div>

              {/* Right Column - Logo */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Organization Logo
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    Upload a logo to replace the default RIM System logo. Recommended size: 200x50 pixels.
                  </p>

                  {/* Current Logo Preview */}
                  <div className="p-6 bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-xl text-center">
                    {orgSettings.logoPath ? (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <img
                            src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${orgSettings.logoPath}`}
                            alt="Organization Logo"
                            className="max-h-20 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/logo-placeholder.png'
                            }}
                          />
                        </div>
                        <p className="text-sm text-gray-400">Current Logo</p>
                        {canManage && (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => logoInputRef.current?.click()}
                              className="px-3 py-1.5 hover:brightness-110 text-white text-sm rounded-lg transition"
                              style={{ backgroundColor: themeHighlight }}
                            >
                              Change Logo
                            </button>
                            <button
                              onClick={handleDeleteLogo}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
                        <p className="text-gray-400">No logo uploaded</p>
                        {canManage && (
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
                          >
                            {isUploadingLogo ? (
                              <>
                                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 inline mr-2" />
                                Upload Logo
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />

                  <p className="text-xs text-gray-500 mt-2">
                    Supported formats: PNG, JPG, GIF, SVG (max 5MB)
                  </p>
                </div>
              </div>
            </div>


            {/* Save Button */}
            {canManage && (
              <div className="flex justify-end pt-6 border-t border-slate-700">
                <button
                  onClick={handleSaveOrgSettings}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-6 py-2 hover:brightness-110 text-white rounded-lg transition disabled:opacity-50"
                  style={{ backgroundColor: themeHighlight }}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save Settings</span>
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-400 font-medium">About Organization Settings</p>
                  <p className="text-sm text-gray-300">
                    <strong>Organization Name:</strong> Identifies the customer/company using this system.<br />
                    <strong>Incident Prefix:</strong> The 1-3 letter code at the beginning of all incident numbers. Changing this only affects new incidents.<br />
                    <strong>Logo:</strong> Custom logo will replace the default RIM System logo in the sidebar and reports.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Incident Tab */}
        {activeTab === 'incident' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <TicketIcon className="w-5 h-5 text-orange-400" />
              <h2 className="text-xl font-semibold text-white">Incident Settings</h2>
            </div>

            <p className="text-sm text-gray-400 mb-3 md:mb-6">
              จัดการการตั้งค่าที่เกี่ยวข้องกับ Incident รวมถึง Categories และ Job Types
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
              {/* Job Types Card — first */}
              <Link
                href="/dashboard/settings/job-types"
                className="block p-4 md:p-6 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600 hover:border-orange-500/50 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <div className="p-2 md:p-3 bg-orange-600/20 rounded-xl">
                      <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-white group-hover:text-orange-400 transition">
                        Job Types
                      </h3>
                      <p className="text-sm text-gray-400">
                        จัดการประเภทงาน MA, Adhoc, Project และกำหนด SLA Default
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>

              {/* Categories Card — second */}
              <Link
                href="/dashboard/settings/categories"
                className="block p-4 md:p-6 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600 hover:border-blue-500/50 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <div className="p-2 md:p-3 bg-blue-600/20 rounded-xl">
                      <Tags className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-white group-hover:text-blue-400 transition">
                        Incident Categories
                      </h3>
                      <p className="text-sm text-gray-400">
                        จัดการประเภทย่อยของงาน เช่น POS, Network, Hardware
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            </div>

            {/* Service Warranty Settings */}
            <div className="p-4 md:p-6 bg-slate-700/30 border border-slate-600 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-600/20 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Service Warranty</h3>
                  <p className="text-xs text-gray-400">กำหนดจำนวนวันรับประกันหลังปิดงาน</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 sm:max-w-xs">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    จำนวนวันรับประกัน (Service Warranty Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={!canManage}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="30"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ตั้งค่าเป็น 0 เพื่อปิดการใช้งาน Service Warranty
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={handleSaveWarrantySettings}
                    disabled={isSavingWarranty}
                    className="w-full sm:w-auto px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingWarranty ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />บันทึก...</>
                    ) : (
                      <><Save className="w-4 h-4" />บันทึก</>
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                เมื่อสร้าง Incident ใหม่สำหรับอุปกรณ์และสาขาเดิม ระบบจะตรวจสอบว่ามีงานที่ปิดไปภายใน {warrantyDays} วันหรือไม่
                หากมีจะแสดงการแจ้งเตือนให้เลือก Reopen งานเดิม
              </p>
            </div>

            {/* Auto Assign Onsite Setting */}
            <div className="p-4 md:p-6 bg-slate-700/30 border border-slate-600 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Zap className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Auto Assign Onsite</h3>
                    <p className="text-xs text-gray-400">จ่ายงาน Onsite อัตโนมัติเมื่อมีช่างเทคนิคดูแลจังหวัดนั้นเพียงคนเดียว</p>
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => !isSavingAutoAssign && handleToggleAutoAssign(!autoAssignOnsite)}
                    disabled={isSavingAutoAssign}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      autoAssignOnsite ? 'bg-purple-600' : 'bg-slate-600'
                    }`}
                    role="switch"
                    aria-checked={autoAssignOnsite}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                        autoAssignOnsite ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
                {!canManage && (
                  <span className={`text-sm font-medium ${autoAssignOnsite ? 'text-purple-400' : 'text-gray-500'}`}>
                    {autoAssignOnsite ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                )}
              </div>
              <div className="mt-4 sm:ml-14 space-y-1 text-sm text-gray-400">
                <p>• เมื่อ Helpdesk กด <span className="text-white">Request Onsite</span> ระบบจะตรวจสอบว่ามีช่างเทคนิค INSOURCE ที่รับผิดชอบจังหวัดนั้นกี่คน</p>
                <p>• ถ้ามี <span className="text-green-400 font-medium">1 คน</span> → จ่ายงานให้ช่างคนนั้นอัตโนมัติ</p>
                <p>• ถ้ามี <span className="text-yellow-400 font-medium">มากกว่า 1 คน หรือ 0 คน</span> → แจ้ง Supervisor ตามกระบวนการปกติ</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mt-4 md:mt-6">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-400 font-medium">เกี่ยวกับ Incident Settings</p>
                  <p className="text-sm text-gray-300">
                    <strong>Categories:</strong> ประเภทของปัญหาที่เกิดขึ้น เช่น POS, Network, Hardware, Software เป็นต้น<br />
                    <strong>Job Types:</strong> ประเภทของงาน ได้แก่ MA (งานตามสัญญา), Adhoc (งานเฉพาะกิจ), Project (งานโปรเจค)<br /><br />
                    หากยังไม่มีข้อมูล สามารถเข้าไปกดปุ่ม &quot;สร้างค่าเริ่มต้น&quot; ในแต่ละหน้าได้เลย
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <Server className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">SMTP Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
              {/* SMTP Host */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={emailSettings.smtpHost}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                  disabled={!canManage}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="smtp.example.com"
                />
              </div>

              {/* SMTP Port */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={emailSettings.smtpPort}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: parseInt(e.target.value) || 587 })}
                  disabled={!canManage}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="587"
                />
              </div>

              {/* SMTP User */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={emailSettings.smtpUser}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                  disabled={!canManage}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="username@example.com"
                />
              </div>

              {/* SMTP Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SMTP Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={emailSettings.smtpPassword}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                    disabled={!canManage}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* From Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  From Email
                </label>
                <input
                  type="email"
                  value={emailSettings.fromEmail}
                  onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                  disabled={!canManage}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="noreply@example.com"
                />
              </div>

              {/* From Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  From Name
                </label>
                <input
                  type="text"
                  value={emailSettings.fromName}
                  onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                  disabled={!canManage}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="RIM System"
                />
              </div>

              {/* SSL/TLS */}
              <div className="md:col-span-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailSettings.smtpSecure}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpSecure: e.target.checked })}
                    disabled={!canManage}
                    className="w-5 h-5 rounded border-gray-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-gray-300">Use SSL/TLS</span>
                </label>
              </div>
            </div>

            {/* Close Notification Section */}
            <div className="border-t border-slate-700 pt-4 mt-4 md:pt-6 md:mt-6">
              <div className="flex items-center space-x-3 mb-3 md:mb-6">
                <Send className="w-5 h-5 text-green-400" />
                <h2 className="text-xl font-semibold text-white">Close Notification Recipients</h2>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Configure email recipients for automatic notifications when incidents are closed.
              </p>

              <div className="space-y-4 md:space-y-6">
                {/* To */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    To (Primary Recipients)
                  </label>
                  <input
                    type="text"
                    value={emailSettings.closeNotificationTo}
                    onChange={(e) => setEmailSettings({ ...emailSettings, closeNotificationTo: e.target.value })}
                    disabled={!canManage}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="manager@example.com, admin@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple emails with commas</p>
                </div>

                {/* CC - Dynamic List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      CC (Carbon Copy)
                    </label>
                    {canManage && (
                      <button
                        type="button"
                        onClick={handleAddCcEmail}
                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Add Email
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {ccEmails.map((email, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleCcEmailChange(index, e.target.value)}
                          disabled={!canManage}
                          className="flex-1 px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          placeholder="email@example.com"
                        />
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCcEmail(index)}
                            className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition"
                            title="Remove email"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Add multiple CC recipients using the &quot;Add Email&quot; button</p>
                </div>

                {/* CC Store Email Toggle */}
                <div className="mt-4 p-4 bg-slate-700/30 border border-slate-600 rounded-xl">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-amber-400" />
                      <div>
                        <span className="text-sm font-medium text-white">สำเนาร้านค้า (CC Store Email)</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          เมื่อเปิดใช้งาน Email จากการ Response และ Close Incident จะ CC ไปยัง Email ของร้านค้าที่เกี่ยวข้องด้วย
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={emailSettings.ccStoreEmail}
                        onChange={(e) => setEmailSettings({ ...emailSettings, ccStoreEmail: e.target.checked })}
                        disabled={!canManage}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 peer-disabled:opacity-50"></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {canManage && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 md:pt-6 border-t border-slate-700">
                <button
                  onClick={handleTestEmail}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Test Email</span>
                </button>
                <button
                  onClick={handleSaveEmailSettings}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 px-6 py-2 hover:brightness-110 text-white rounded-lg transition disabled:opacity-50"
                  style={{ backgroundColor: themeHighlight }}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save Settings</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Service Report Tab - SUPER_ADMIN only */}
        {activeTab === 'service-report' && isSuperAdmin && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <FileText className="w-5 h-5 text-teal-400" />
              <h2 className="text-xl font-semibold text-white">Service Report Settings</h2>
            </div>

            <p className="text-sm text-gray-400 mb-3 md:mb-6">
              ตั้งค่าข้อมูลบริษัทผู้ให้บริการ และโลโก้ที่จะแสดงในหัวเอกสาร Service Report (เอกสารปิดงาน)
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              {/* Left Column - Provider Info */}
              <div className="space-y-4 md:space-y-5">
                {/* Provider Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ชื่อบริษัทผู้ให้บริการ
                  </label>
                  <input
                    type="text"
                    value={srSettings.providerName}
                    onChange={(e) => setSrSettings({ ...srSettings, providerName: e.target.value })}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g., บริษัท ไอที โซลูชั่น จำกัด"
                  />
                </div>

                {/* Provider Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ที่อยู่ผู้ให้บริการ
                  </label>
                  <textarea
                    value={srSettings.providerAddress}
                    onChange={(e) => setSrSettings({ ...srSettings, providerAddress: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                  />
                </div>

                {/* Phone + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="text"
                      value={srSettings.providerPhone}
                      onChange={(e) => setSrSettings({ ...srSettings, providerPhone: e.target.value })}
                      className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="02-xxx-xxxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      อีเมล
                    </label>
                    <input
                      type="email"
                      value={srSettings.providerEmail}
                      onChange={(e) => setSrSettings({ ...srSettings, providerEmail: e.target.value })}
                      className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="contact@company.com"
                    />
                  </div>
                </div>

                {/* Tax ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    เลขประจำตัวผู้เสียภาษี / ทะเบียนนิติบุคคล
                  </label>
                  <input
                    type="text"
                    value={srSettings.providerTaxId}
                    onChange={(e) => setSrSettings({ ...srSettings, providerTaxId: e.target.value })}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    placeholder="0-xxxx-xxxxx-xx-x"
                  />
                </div>
              </div>

              {/* Right Column - Logo */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    โลโก้ Header Service Report
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    โลโก้จะแสดงในส่วนหัวของเอกสาร Service Report และ PDF ขนาดแนะนำ: 200x60 pixels
                  </p>

                  <div className="p-6 bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-xl text-center">
                    {srSettings.providerLogo ? (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <img
                            src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${srSettings.providerLogo}`}
                            alt="Service Report Logo"
                            className="max-h-20 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/logo-placeholder.png'
                            }}
                          />
                        </div>
                        <p className="text-sm text-gray-400">โลโก้ปัจจุบัน</p>
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => srLogoInputRef.current?.click()}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition"
                          >
                            เปลี่ยนโลโก้
                          </button>
                          <button
                            onClick={handleDeleteSrLogo}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <ImageIcon className="w-12 h-12 text-gray-600 mx-auto" />
                        <p className="text-gray-400">ยังไม่ได้อัปโหลดโลโก้</p>
                        <button
                          onClick={() => srLogoInputRef.current?.click()}
                          disabled={isUploadingSrLogo}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition disabled:opacity-50"
                        >
                          {isUploadingSrLogo ? (
                            <>
                              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                              กำลังอัปโหลด...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 inline mr-2" />
                              อัปโหลดโลโก้
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={srLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml"
                    onChange={handleSrLogoUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    รองรับ: PNG, JPG, GIF, SVG (ขนาดไม่เกิน 5MB)
                  </p>
                </div>

                {/* Preview Card - Logo Left + Company Info Right (matching PDF format) */}
                <div className="p-4 bg-white rounded-xl">
                  <p className="text-xs text-gray-400 mb-3 font-medium">ตัวอย่าง Header Service Report:</p>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left - Logo only */}
                      <div className="flex-shrink-0">
                        {srSettings.providerLogo ? (
                          <img
                            src={`${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${srSettings.providerLogo}`}
                            alt="Logo"
                            className="h-14 object-contain"
                          />
                        ) : (
                          <div className="w-20 h-14 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-xs">LOGO</span>
                          </div>
                        )}
                      </div>
                      {/* Right - Company Info (matching PDF layout) */}
                      <div className="text-right flex-1">
                        <p className="text-base font-bold text-gray-800">{srSettings.providerName || 'ชื่อบริษัท'}</p>
                        <p className="text-xs text-gray-500 whitespace-pre-line mt-0.5">{srSettings.providerAddress || 'ที่อยู่บริษัท'}</p>
                        {(srSettings.providerPhone || srSettings.providerEmail) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {srSettings.providerPhone && `Tel: ${srSettings.providerPhone}`}
                            {srSettings.providerPhone && srSettings.providerEmail && '  '}
                            {srSettings.providerEmail && `Email: ${srSettings.providerEmail}`}
                          </p>
                        )}
                        {srSettings.providerTaxId && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            เลขประจำตัวผู้เสียภาษี: {srSettings.providerTaxId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-300 text-center">
                      <p className="text-sm font-bold text-gray-800">SERVICE REPORT / ใบรายงานบริการ</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Style Selector */}
            <div className="pt-6 border-t border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-2">รูปแบบ Service Report</h3>
              <p className="text-sm text-gray-400 mb-4">เลือกรูปแบบเอกสาร Service Report ที่ต้องการใช้งาน (ข้อมูลเหมือนกัน ต่างกันแค่ดีไซน์)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Classic */}
                <button
                  type="button"
                  onClick={() => setSrSettings({ ...srSettings, templateStyle: 'classic' })}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    srSettings.templateStyle === 'classic'
                      ? 'border-teal-500 bg-teal-500/10 ring-1 ring-teal-500/50'
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                  }`}
                >
                  {srSettings.templateStyle === 'classic' && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                  <div className="mb-3">
                    {/* Classic Preview Mini */}
                    <div className="w-full h-32 bg-white rounded-lg overflow-hidden border border-gray-200 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="w-10 h-5 bg-gray-200 rounded" />
                        <div className="space-y-0.5 text-right">
                          <div className="w-20 h-2 bg-gray-300 rounded ml-auto" />
                          <div className="w-16 h-1.5 bg-gray-200 rounded ml-auto" />
                        </div>
                      </div>
                      <div className="h-px bg-black mb-1" />
                      <div className="h-4 bg-gray-700 rounded-sm mb-1 flex items-center justify-center">
                        <span className="text-white text-[5px] font-bold">SERVICE REPORT</span>
                      </div>
                      <div className="grid grid-cols-4 gap-px mb-1">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className={`h-2 rounded-sm ${i % 2 === 0 ? 'bg-gray-200' : 'bg-gray-100'}`} />
                        ))}
                      </div>
                      <div className="space-y-0.5">
                        <div className="h-2 bg-gray-200 rounded-sm" />
                        <div className="h-6 bg-gray-50 rounded-sm border border-gray-200" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 3px, #e5e7eb 3px, #e5e7eb 3.5px)' }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-white font-semibold">Classic</p>
                  <p className="text-xs text-gray-400 mt-1">รูปแบบตารางดั้งเดิม เรียบง่าย เป็นทางการ มีเส้นบรรทัด</p>
                </button>

                {/* Modern */}
                <button
                  type="button"
                  onClick={() => setSrSettings({ ...srSettings, templateStyle: 'modern' })}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    srSettings.templateStyle === 'modern'
                      ? 'border-teal-500 bg-teal-500/10 ring-1 ring-teal-500/50'
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                  }`}
                >
                  {srSettings.templateStyle === 'modern' && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                  <div className="mb-3">
                    {/* Modern Preview Mini */}
                    <div className="w-full h-32 bg-white rounded-lg overflow-hidden border border-gray-200">
                      <div className="h-6 bg-gradient-to-r from-slate-700 to-teal-600 flex items-center px-2 gap-1">
                        <div className="w-5 h-3 bg-white/30 rounded" />
                        <div className="flex-1" />
                        <div className="space-y-0.5 text-right">
                          <div className="w-14 h-1.5 bg-white/60 rounded" />
                          <div className="w-10 h-1 bg-white/40 rounded" />
                        </div>
                      </div>
                      <div className="px-2 py-1">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="h-3 flex-1 bg-teal-600 rounded-md flex items-center px-1">
                            <span className="text-white text-[4px] font-bold">SERVICE REPORT</span>
                          </div>
                          <div className="px-1 py-0.5 bg-teal-100 rounded text-[4px] text-teal-700 font-mono">INC-001</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-1">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-4 bg-gray-50 rounded-md border border-gray-100 p-0.5">
                              <div className="w-6 h-1 bg-gray-300 rounded mb-0.5" />
                              <div className="w-10 h-1 bg-gray-200 rounded" />
                            </div>
                          ))}
                        </div>
                        <div className="h-8 bg-gray-50 rounded-md border border-gray-100" />
                      </div>
                    </div>
                  </div>
                  <p className="text-white font-semibold">Modern</p>
                  <p className="text-xs text-gray-400 mt-1">ดีไซน์ทันสมัย gradient header, card layout, สีสันสวยงาม</p>
                </button>
              </div>
            </div>

            {/* SR Theme Color Picker */}
            <div className="pt-6 border-t border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-2">Service Report Theme</h3>
              <p className="text-sm text-gray-400 mb-4">
                เลือกสี Theme ที่จะใช้ใน Service Report (เว็บและ PDF) แยกจากสี Theme หลักของระบบ
              </p>

              {/* Preview */}
              <div className="p-3 bg-slate-700/30 rounded-xl mb-4">
                <p className="text-xs text-gray-400 mb-2">ตัวอย่าง</p>
                <div
                  className="h-14 rounded-lg border border-slate-600/50 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${
                      srSettings.srThemeBgStart || selectedTheme.bgStart
                    } 0%, ${
                      srSettings.srThemeBgEnd || selectedTheme.bgEnd
                    } 100%)`,
                  }}
                >
                  <span className="text-white/80 text-xs font-medium">
                    {!srSettings.srThemeBgStart ? 'ใช้สี Theme หลัก' : 'สี Service Report'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {/* Use Main Theme option */}
                <button
                  type="button"
                  onClick={() => setSrSettings({ ...srSettings, srThemeBgStart: '', srThemeBgEnd: '' })}
                  className={`relative p-1 rounded-xl transition-all ${
                    !srSettings.srThemeBgStart
                      ? 'ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-800'
                      : 'hover:ring-1 hover:ring-slate-500'
                  }`}
                >
                  <div
                    className="h-14 rounded-lg flex items-end justify-center pb-2 border-2 border-dashed border-slate-500"
                    style={{
                      background: `linear-gradient(135deg, ${selectedTheme.bgStart} 0%, ${selectedTheme.bgEnd} 100%)`,
                    }}
                  >
                    <span className="text-white/80 text-[10px] font-medium">ใช้สี Theme หลัก</span>
                  </div>
                  {!srSettings.srThemeBgStart && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>

                {/* Theme presets */}
                {srThemePresets.map((preset) => {
                  const isSelected = srSettings.srThemeBgStart === preset.bgStart && srSettings.srThemeBgEnd === preset.bgEnd
                  return (
                    <button
                      key={`sr-${preset.name}-${preset.bgStart}`}
                      type="button"
                      onClick={() => setSrSettings({ ...srSettings, srThemeBgStart: preset.bgStart, srThemeBgEnd: preset.bgEnd })}
                      className={`relative p-1 rounded-xl transition-all ${
                        isSelected
                          ? 'ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-800'
                          : 'hover:ring-1 hover:ring-slate-500'
                      }`}
                    >
                      <div
                        className="h-14 rounded-lg flex items-end justify-center pb-2"
                        style={{
                          background: `linear-gradient(135deg, ${preset.bgStart} 0%, ${preset.bgEnd} 100%)`,
                        }}
                      >
                        <span className="text-white/80 text-[10px] font-medium">{preset.name}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-slate-700">
              <button
                onClick={handleSaveServiceReportSettings}
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-teal-400 font-medium">เกี่ยวกับ Service Report Settings</p>
                  <p className="text-sm text-gray-300">
                    <strong>ชื่อบริษัทผู้ให้บริการ:</strong> ชื่อบริษัทที่ให้บริการ IT Support จะแสดงในหัวเอกสาร<br />
                    <strong>โลโก้:</strong> โลโก้จะแสดงที่มุมบนซ้ายของเอกสาร Service Report และ PDF<br />
                    <strong>ข้อมูลติดต่อ:</strong> เบอร์โทร อีเมล และเลขผู้เสียภาษี จะแสดงในหัวเอกสาร<br />
                    การตั้งค่านี้ใช้ได้เฉพาะ Super Admin เท่านั้น
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLA Tab */}
        {activeTab === 'sla' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-orange-400" />
                <h2 className="text-xl font-semibold text-white">SLA Configuration</h2>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Configure Service Level Agreement response and resolution times for each priority level.
              Times are configured separately for Bangkok/Metropolitan area and Provincial areas.
            </p>

            <div className="space-y-4">
              {slaConfigs.map((sla) => (
                <div
                  key={sla.id}
                  className={`p-4 bg-slate-700/30 rounded-xl ${
                    editingSlaId === sla.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {editingSlaId === sla.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: sla.color }}
                          />
                          <span className="text-sm text-gray-400 font-medium">{sla.priority}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={cancelEditingSla}
                            className="p-2 text-gray-400 hover:text-white transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateSlaConfig(sla.id)}
                            className="p-2 text-green-400 hover:text-green-300 transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Display Name & Warning Threshold */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                          <input
                            type="text"
                            value={slaFormData.displayName}
                            onChange={(e) => setSlaFormData(prev => ({ ...prev, displayName: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Display Name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Warning Threshold (%)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={slaFormData.warningThreshold}
                            onChange={(e) => setSlaFormData(prev => ({ ...prev, warningThreshold: parseInt(e.target.value) || 80 }))}
                            className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Regional SLA Times */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Bangkok/Metro Column */}
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <h4 className="text-sm font-medium text-blue-400 mb-3">🏙️ กรุงเทพฯ / ปริมณฑล</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Response Time (minutes)</label>
                              <input
                                type="number"
                                min="1"
                                value={slaFormData.responseTimeMinutes}
                                onChange={(e) => setSlaFormData(prev => ({ ...prev, responseTimeMinutes: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-500">= {formatMinutesToDisplay(slaFormData.responseTimeMinutes)}</span>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Resolution Time (minutes)</label>
                              <input
                                type="number"
                                min="1"
                                value={slaFormData.resolutionTimeMinutes}
                                onChange={(e) => setSlaFormData(prev => ({ ...prev, resolutionTimeMinutes: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-500">= {formatMinutesToDisplay(slaFormData.resolutionTimeMinutes)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Provincial Column */}
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <h4 className="text-sm font-medium text-green-400 mb-3">🌴 ต่างจังหวัด</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Response Time (minutes)</label>
                              <input
                                type="number"
                                min="1"
                                value={slaFormData.responseTimeProvincial}
                                onChange={(e) => setSlaFormData(prev => ({ ...prev, responseTimeProvincial: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-500">= {formatMinutesToDisplay(slaFormData.responseTimeProvincial)}</span>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Resolution Time (minutes)</label>
                              <input
                                type="number"
                                min="1"
                                value={slaFormData.resolutionTimeProvincial}
                                onChange={(e) => setSlaFormData(prev => ({ ...prev, resolutionTimeProvincial: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-500">= {formatMinutesToDisplay(slaFormData.resolutionTimeProvincial)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: sla.color }}
                          />
                          <div>
                            <span className="font-medium text-white">{sla.displayName || sla.name}</span>
                            <span className="text-sm text-gray-400 ml-2">({sla.priority})</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-400">
                            <span className="text-yellow-400">{sla.warningThreshold}%</span> warning
                          </div>
                          {canManage && (
                            <button
                              onClick={() => startEditingSla(sla)}
                              className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Regional Times Display */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {/* Bangkok/Metro */}
                        <div className="text-sm space-y-0.5">
                          <span className="text-blue-400 font-medium">🏙️ กทม./ปริมณฑล</span>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-gray-400">
                            <span>Response: <span className="text-white">{formatMinutesToDisplay(sla.responseTimeMinutes)}</span></span>
                            <span>Resolution: <span className="text-white">{formatMinutesToDisplay(sla.resolutionTimeMinutes)}</span></span>
                          </div>
                        </div>
                        {/* Provincial */}
                        <div className="text-sm space-y-0.5">
                          <span className="text-green-400 font-medium">🌴 ต่างจังหวัด</span>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-gray-400">
                            <span>Response: <span className="text-white">{formatMinutesToDisplay(sla.responseTimeProvincial || 0)}</span></span>
                            <span>Resolution: <span className="text-white">{formatMinutesToDisplay(sla.resolutionTimeProvincial || 0)}</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mt-6">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-400 font-medium">SLA Time Guide</p>
                  <p className="text-sm text-gray-300">
                    <strong>Response Time:</strong> Maximum time to acknowledge and start working on an incident.<br />
                    <strong>Resolution Time:</strong> Maximum time to fully resolve the incident.<br />
                    <strong>Warning Threshold:</strong> Percentage at which the SLA status changes to &quot;Warning&quot;.<br /><br />
                    <strong>🏙️ กรุงเทพฯ/ปริมณฑล:</strong> SLA times for Bangkok and metropolitan area stores.<br />
                    <strong>🌴 ต่างจังหวัด:</strong> SLA times for provincial area stores (typically longer due to travel/logistics).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div className="space-y-4 md:space-y-6">
            {licenseInfo?.license?.licenseType === 'TRIAL' && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm">
                <Lock className="w-5 h-5 flex-shrink-0" />
                <span>ฟีเจอร์ <strong>Backup & Restore</strong> ไม่รองรับใน Trial License — กรุณา Activate License เพื่อใช้งาน</span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-6">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Backup & Restore</h2>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Restore from File */}
                  <input
                    ref={restoreFileRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleSelectRestoreFile}
                  />
                  <button
                    onClick={() => restoreFileRef.current?.click()}
                    disabled={licenseInfo?.license?.licenseType === 'TRIAL'}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                    <span>Restore</span>
                  </button>
                  {/* Create Backup */}
                  <button
                    onClick={() => setShowBackupPasswordModal(true)}
                    disabled={isCreatingBackup || licenseInfo?.license?.licenseType === 'TRIAL'}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {isCreatingBackup ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <Database className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>Create Backup</span>
                  </button>
                </div>
              )}
            </div>

            {/* Auto Backup Configuration */}
            <div className="p-4 bg-slate-700/30 rounded-xl mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <RefreshCw className={`w-5 h-5 ${schedule?.isActive ? 'text-green-400' : 'text-gray-400'}`} />
                  <span className="font-medium text-white">Auto Backup</span>
                  {schedule && (
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      schedule.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {schedule.isActive ? 'Active' : 'Disabled'}
                    </span>
                  )}
                </div>
                {canManage && !isEditingSchedule && (
                  <div className="flex items-center space-x-2">
                    {schedule && (
                      <button
                        onClick={handleToggleSchedule}
                        className={`px-3 py-1.5 rounded-lg text-sm transition ${
                          schedule.isActive
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        {schedule.isActive ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    <button
                      onClick={startEditingSchedule}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {isEditingSchedule ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Frequency */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                      <select
                        value={scheduleForm.frequency}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="HOURLY">Every Hour</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>

                    {/* Time of Day (not for hourly) */}
                    {scheduleForm.frequency !== 'HOURLY' && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Time</label>
                        <TimeInput
                          value={scheduleForm.timeOfDay}
                          onChange={(v) => setScheduleForm({ ...scheduleForm, timeOfDay: v })}
                          className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg focus-within:ring-2 focus-within:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Day of Week (for weekly) */}
                    {scheduleForm.frequency === 'WEEKLY' && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Day of Week</label>
                        <select
                          value={scheduleForm.dayOfWeek}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                    )}

                    {/* Day of Month (for monthly) */}
                    {scheduleForm.frequency === 'MONTHLY' && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Day of Month</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={scheduleForm.dayOfMonth}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfMonth: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Retention Days */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Keep backups for (days)</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={scheduleForm.retentionDays}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, retentionDays: parseInt(e.target.value) || 30 })}
                        className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Max Backups */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Max backup files</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={scheduleForm.maxBackups}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, maxBackups: parseInt(e.target.value) || 10 })}
                        className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Storage Type */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Storage Location</label>
                      <select
                        value={scheduleForm.storageType}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, storageType: e.target.value as 'LOCAL' | 'EXTERNAL' })}
                        className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="LOCAL">Local (./backups)</option>
                        <option value="EXTERNAL">External Path</option>
                      </select>
                    </div>

                    {/* External Path (only when EXTERNAL is selected) */}
                    {scheduleForm.storageType === 'EXTERNAL' && (
                      <div className="lg:col-span-2">
                        <label className="block text-sm text-gray-400 mb-1">External Path</label>
                        <input
                          type="text"
                          value={scheduleForm.externalPath}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, externalPath: e.target.value })}
                          placeholder="D:\Backups or \\server\backups"
                          className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter full path to external storage (network drive, USB, etc.)</p>
                      </div>
                    )}
                  </div>

                  {/* Password for scheduled backups */}
                  <div className="mt-4 pt-4 border-t border-slate-600/50">
                    <p className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                      <span>🔒</span> Password สำหรับ Backup อัตโนมัติ (ไม่บังคับ)
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Password</label>
                        <input
                          type="password"
                          value={scheduleForm.schedulePassword}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, schedulePassword: e.target.value })}
                          placeholder="เว้นว่างถ้าไม่ต้องการ Password"
                          className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">ยืนยัน Password</label>
                        <input
                          type="password"
                          value={scheduleForm.schedulePasswordConfirm}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, schedulePasswordConfirm: e.target.value })}
                          placeholder="ยืนยัน Password"
                          className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    {scheduleForm.schedulePassword && scheduleForm.schedulePasswordConfirm && scheduleForm.schedulePassword !== scheduleForm.schedulePasswordConfirm && (
                      <p className="text-xs text-red-400 mt-1">Password ไม่ตรงกัน</p>
                    )}
                    {scheduleForm.schedulePassword && !scheduleForm.schedulePasswordConfirm && (
                      <p className="text-xs text-yellow-400 mt-1">กรุณายืนยัน Password</p>
                    )}
                  </div>

                  {/* Save/Cancel Buttons */}
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={cancelEditingSchedule}
                      className="px-4 py-2 text-gray-400 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSchedule}
                      disabled={isSavingSchedule || (!!scheduleForm.schedulePassword && scheduleForm.schedulePassword !== scheduleForm.schedulePasswordConfirm)}
                      className="flex items-center space-x-2 px-4 py-2 hover:brightness-110 text-white rounded-lg transition disabled:opacity-50"
                      style={{ backgroundColor: themeHighlight }}
                    >
                      {isSavingSchedule ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Save Schedule</span>
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Schedule</p>
                      <p className="text-white">{formatScheduleFrequency(schedule)}</p>
                    </div>
                    {schedule && (
                      <>
                        <div>
                          <p className="text-sm text-gray-400">Retention</p>
                          <p className="text-white">{schedule.retentionDays} days / max {schedule.maxBackups} files</p>
                        </div>
                        {schedule.nextRunAt && (
                          <div>
                            <p className="text-sm text-gray-400">Next Run</p>
                            <p className="text-white">{new Date(schedule.nextRunAt).toLocaleString('th-TH')}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {/* Storage Location */}
                  {schedule && (
                    <div className="pt-2 border-t border-slate-600">
                      <p className="text-sm text-gray-400">Storage Location</p>
                      <p className="text-white">
                        {schedule.storageType === 'EXTERNAL' && schedule.externalPath
                          ? `External: ${schedule.externalPath}`
                          : 'Local (./backups)'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-700/30 rounded-xl">
                <div className="flex items-center space-x-3 mb-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-white">Total Backups</span>
                </div>
                <p className="text-sm text-gray-400">{backups.length} files</p>
              </div>
              {schedule?.lastRunAt && (
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center space-x-3 mb-2">
                    <Clock className="w-5 h-5 text-green-400" />
                    <span className="font-medium text-white">Last Auto Backup</span>
                  </div>
                  <p className="text-sm text-gray-400">{new Date(schedule.lastRunAt).toLocaleString('th-TH')}</p>
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold text-white mb-4">Backup History</h3>

            {backups.length === 0 ? (
              <div className="text-center py-12 bg-slate-700/20 rounded-xl">
                <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No backups found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-700/30 rounded-xl"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${backup.type === 'auto' ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                        {backup.type === 'auto' ? (
                          <RefreshCw className="w-5 h-5 text-green-400" />
                        ) : (
                          <Database className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white text-sm break-all leading-snug">{backup.filename}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                          <span>{backup.size}</span>
                          <span>{new Date(backup.createdAt).toLocaleString('th-TH')}</span>
                          <span className={`px-2 py-0.5 rounded ${
                            backup.type === 'auto' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {backup.type === 'auto' ? 'Auto' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 self-end sm:self-auto flex-shrink-0">
                        <button
                          onClick={() => handleDownloadBackup(backup)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(backup)}
                          disabled={isRestoring}
                          className="p-2 text-orange-400 hover:bg-orange-500/20 rounded-lg transition disabled:opacity-50"
                          title="Restore"
                        >
                          <Upload className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                          title="Delete"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium">Warning</p>
                  <p className="text-sm text-gray-300">
                    Restoring a backup will overwrite all current data. Make sure to create a backup of current state before restoring.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Restore from File Modal ── */}
        {showRestoreFileModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-600 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <FolderOpen className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">Restore from File</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                ไฟล์: <span className="text-white font-medium">{restoreFileName}</span>
              </p>

              {/* Partial backup warning */}
              {restoreAvailableGroups.length > 0 && restoreAvailableGroups.length < BACKUP_GROUPS.length && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-lg mb-4">
                  <p className="text-sm text-amber-300 font-medium mb-1">Backup บางส่วน</p>
                  <p className="text-xs text-gray-400">
                    ไฟล์นี้มีข้อมูลเพียง {restoreAvailableGroups.length} จาก {BACKUP_GROUPS.length} หัวข้อ
                    — ข้อมูลที่ไม่มีในไฟล์จะไม่ถูกแตะต้อง
                  </p>
                </div>
              )}

              {/* Group selector */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">เลือกหัวข้อที่ต้องการ Restore</label>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => setRestoreSelectedGroups(restoreAvailableGroups)} className="text-emerald-400 hover:text-emerald-300">เลือกทั้งหมด</button>
                    <button onClick={() => setRestoreSelectedGroups([])} className="text-gray-500 hover:text-gray-300">ล้าง</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {BACKUP_GROUPS.map(group => {
                    const available = restoreAvailableGroups.includes(group.id)
                    const checked = restoreSelectedGroups.includes(group.id)
                    return (
                      <label
                        key={group.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                          !available
                            ? 'bg-slate-700/10 border-slate-700/30 opacity-40 cursor-not-allowed'
                            : checked
                              ? 'bg-emerald-500/10 border-emerald-500/40'
                              : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!available}
                          onChange={(e) => {
                            if (!available) return
                            if (e.target.checked) setRestoreSelectedGroups(prev => [...prev, group.id])
                            else setRestoreSelectedGroups(prev => prev.filter(id => id !== group.id))
                          }}
                          className="accent-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">{group.label}</p>
                          <p className="text-xs text-gray-500">{group.description}</p>
                        </div>
                        {!available && <span className="text-xs text-gray-600 shrink-0">ไม่มีในไฟล์</span>}
                      </label>
                    )
                  })}
                </div>
                {restoreSelectedGroups.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">กรุณาเลือกอย่างน้อย 1 หัวข้อ</p>
                )}
              </div>

              {/* Password */}
              {restoreFileNeedsPassword && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Password
                  </label>
                  <input
                    type="password"
                    value={restoreFilePassword}
                    onChange={(e) => setRestoreFilePassword(e.target.value)}
                    placeholder="ใส่ Password ของ Backup"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-5">
                <p className="text-xs text-yellow-300">ข้อมูลใหม่จาก Backup จะถูกเพิ่มเข้าระบบ — ข้อมูลที่มีอยู่แล้วจะถูกข้ามไป</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRestoreFileModal(false); setRestoreFileContent(null); setRestoreFilePassword(''); setRestoreSelectedGroups([]); setRestoreAvailableGroups([]) }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >ยกเลิก</button>
                <button
                  onClick={handleRestoreFromFile}
                  disabled={isRestoringFile || restoreSelectedGroups.length === 0 || (restoreFileNeedsPassword && !restoreFilePassword)}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRestoringFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Restore
                  {restoreSelectedGroups.length > 0 && restoreSelectedGroups.length < restoreAvailableGroups.length && (
                    <span className="text-xs opacity-70">({restoreSelectedGroups.length}/{restoreAvailableGroups.length})</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Backup Modal ── */}
        {showBackupPasswordModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-600 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-5">
                <Database className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">สร้าง Backup</h3>
              </div>

              <div className="space-y-4">
                {/* Custom name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ชื่อ Backup <span className="text-gray-500">(ไม่บังคับ)</span></label>
                  <input
                    type="text"
                    value={backupCustomName}
                    onChange={(e) => setBackupCustomName(e.target.value)}
                    placeholder="เช่น Before-Migration, v2.0-release"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Scope selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">ข้อมูลที่ต้องการ Backup</label>
                    <div className="flex gap-3 text-xs">
                      <button
                        onClick={() => setSelectedBackupGroups(ALL_GROUP_IDS)}
                        className="text-purple-400 hover:text-purple-300 transition"
                      >เลือกทั้งหมด</button>
                      <button
                        onClick={() => setSelectedBackupGroups([])}
                        className="text-gray-500 hover:text-gray-300 transition"
                      >ล้างทั้งหมด</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {BACKUP_GROUPS.map(group => {
                      const checked = selectedBackupGroups.includes(group.id)
                      return (
                        <label
                          key={group.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                            checked
                              ? 'bg-purple-500/10 border-purple-500/40'
                              : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBackupGroups(prev => [...prev, group.id])
                              } else {
                                setSelectedBackupGroups(prev => prev.filter(id => id !== group.id))
                              }
                            }}
                            className="mt-0.5 accent-purple-500"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{group.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {selectedBackupGroups.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">กรุณาเลือกอย่างน้อย 1 หัวข้อ</p>
                  )}
                  {selectedBackupGroups.length === BACKUP_GROUPS.length && (
                    <p className="text-xs text-green-400 mt-1">Full Backup — ครอบคลุมทุกตาราง</p>
                  )}
                </div>

                {/* Password */}
                <div className="pt-2 border-t border-slate-600/50">
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Password <span className="text-gray-500">(ไม่บังคับ)</span>
                  </label>
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="เว้นว่างถ้าไม่ต้องการ Password"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                  />
                  <input
                    type="password"
                    value={backupPasswordConfirm}
                    onChange={(e) => setBackupPasswordConfirm(e.target.value)}
                    placeholder="ยืนยัน Password"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {backupPassword && backupPasswordConfirm && backupPassword !== backupPasswordConfirm && (
                    <p className="text-xs text-red-400 mt-1">Password ไม่ตรงกัน</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => {
                    setShowBackupPasswordModal(false)
                    setBackupPassword('')
                    setBackupPasswordConfirm('')
                    setBackupCustomName('')
                    setSelectedBackupGroups(ALL_GROUP_IDS)
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >ยกเลิก</button>
                <button
                  onClick={() => handleCreateBackup(backupPassword || undefined)}
                  disabled={isCreatingBackup || selectedBackupGroups.length === 0 || (!!backupPassword && backupPassword !== backupPasswordConfirm)}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  สร้าง Backup
                  {selectedBackupGroups.length < BACKUP_GROUPS.length && selectedBackupGroups.length > 0 && (
                    <span className="text-xs opacity-70">({selectedBackupGroups.length}/{BACKUP_GROUPS.length})</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Theme Tab */}
        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Palette className="w-5 h-5 text-pink-400" />
              <h2 className="text-xl font-semibold text-white">Theme Settings</h2>
            </div>

            {/* Preview */}
            <div className="p-4 bg-slate-700/30 rounded-xl">
              <p className="text-sm text-gray-400 mb-3">Preview</p>
              <div
                className="h-24 rounded-xl border border-slate-600/50 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${selectedTheme.bgStart} 0%, ${selectedTheme.bgEnd} 100%)` }}
              >
                <div className="px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
                  <span className="text-white/90 text-sm font-medium">RIM System Preview</span>
                </div>
              </div>

              {/* Brightness Slider — shown when a preset is selected */}
              {basePreset && (
                <div className="mt-4 pt-4 border-t border-slate-600/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-300 font-medium">ความสว่าง</p>
                    <span className="text-xs text-gray-400">
                      {themeBrightness < 50 ? `เข้มขึ้น ${50 - themeBrightness}%` : themeBrightness > 50 ? `อ่อนลง ${themeBrightness - 50}%` : 'ค่าเริ่มต้น'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">เข้ม</span>
                    <input
                      type="range" min={10} max={90} value={themeBrightness}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        setThemeBrightness(val)
                        setSelectedTheme({ bgStart: adjustHex(basePreset.bgStart, val), bgEnd: adjustHex(basePreset.bgEnd, val) })
                      }}
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-xs text-gray-500">อ่อน</span>
                    <button
                      onClick={() => { setThemeBrightness(50); setSelectedTheme({ bgStart: basePreset.bgStart, bgEnd: basePreset.bgEnd }) }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition whitespace-nowrap"
                    >Reset</button>
                  </div>
                </div>
              )}
            </div>

            {/* Preset Grid */}
            <div>
              <p className="text-sm text-gray-400 mb-3">เลือก Theme</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {themePresets.map((preset) => {
                  const isBaseSelected = basePreset?.bgStart === preset.bgStart && basePreset?.bgEnd === preset.bgEnd
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setBasePreset({ bgStart: preset.bgStart, bgEnd: preset.bgEnd })
                        setThemeBrightness(50)
                        setSelectedTheme({ bgStart: preset.bgStart, bgEnd: preset.bgEnd })
                      }}
                      className={`relative p-1 rounded-xl transition-all ${
                        isBaseSelected
                          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-800'
                          : 'hover:ring-1 hover:ring-slate-500'
                      }`}
                    >
                      <div
                        className="h-20 rounded-lg flex items-end justify-center pb-2"
                        style={{ background: `linear-gradient(135deg, ${preset.bgStart} 0%, ${preset.bgEnd} 100%)` }}
                      >
                        <span className="text-white/80 text-xs font-medium">{preset.name}</span>
                      </div>
                      {isBaseSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Save Button */}
            {canManage && (
              <div className="flex justify-end pt-4 border-t border-slate-700">
                <button
                  onClick={async () => {
                    try {
                      setIsSaving(true)
                      const token = localStorage.getItem('token')
                      await axios.post(
                        `${process.env.NEXT_PUBLIC_API_URL}/settings/theme`,
                        selectedTheme,
                        { headers: { Authorization: `Bearer ${token}` } }
                      )
                      setSavedTheme(selectedTheme)
                      localStorage.setItem('themeStyle', JSON.stringify(selectedTheme))
                      window.dispatchEvent(new CustomEvent('themeUpdated', { detail: selectedTheme }))
                      toast.success('บันทึก Theme สำเร็จ')
                    } catch {
                      toast.error('ไม่สามารถบันทึก Theme ได้')
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                  disabled={isSaving || (selectedTheme.bgStart === savedTheme.bgStart && selectedTheme.bgEnd === savedTheme.bgEnd)}
                  className="flex items-center space-x-2 px-6 py-2.5 hover:brightness-110 disabled:bg-slate-700 disabled:text-gray-500 rounded-xl font-medium transition"
                  style={{ backgroundColor: themeHighlight, color: 'white' }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'white' }} /> : <Save className="w-4 h-4" style={{ color: 'white' }} />}
                  <span style={{ color: 'white' }}>บันทึก Theme</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info Tab */}
        {activeTab === 'mobile-app' && (
          <MobileAppTab />
        )}

        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <Info className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">System Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Software Info */}
              <div className="p-6 bg-slate-700/30 rounded-xl">
                <div className="flex items-center space-x-3 mb-4">
                  <Code className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Software</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Version</span>
                    <span className="text-white font-mono">{systemInfo.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Build Date</span>
                    <span className="text-white">{systemInfo.buildDate}</span>
                  </div>
                </div>
              </div>

              {/* License Info */}
              <div className={`p-6 rounded-xl border ${
                !licenseInfo?.hasLicense || !licenseInfo?.valid
                  ? 'bg-red-500/5 border-red-500/30'
                  : licenseInfo.daysRemaining !== undefined && licenseInfo.daysRemaining < 30
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-slate-700/30 border-slate-700'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Shield className={`w-5 h-5 ${
                      licenseInfo?.valid ? 'text-green-400' : 'text-red-400'
                    }`} />
                    <h3 className="text-lg font-semibold text-white">License</h3>
                  </div>
                  {licenseLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                </div>

                {!licenseInfo || licenseLoading ? (
                  <div className="text-gray-400 text-sm">กำลังโหลด...</div>
                ) : !licenseInfo.hasLicense || !licenseInfo.valid ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {!licenseInfo.hasLicense ? 'ยังไม่มี License' :
                         licenseInfo.reason === 'EXPIRED' ? 'License หมดอายุแล้ว' :
                         licenseInfo.reason === 'SUSPENDED' ? 'License ถูกระงับ' : 'License ไม่ถูกต้อง'}
                      </span>
                    </div>
                    {licenseInfo.machineId && (
                      <div className="text-xs text-gray-400">
                        Machine ID: <span className="font-mono text-gray-300">{licenseInfo.machineId}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setShowActivateModal(true)}
                      className="w-full mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Key className="w-4 h-4" /> Activate License
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Status</span>
                      <span className="flex items-center gap-1.5 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Active
                        <span className="text-xs px-1.5 py-0.5 bg-green-500/10 border border-green-500/30 rounded text-green-400 ml-1">
                          {licenseInfo.license?.licenseType}
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Licensed To</span>
                      <span className="text-white text-sm">{licenseInfo.license?.organizationName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Expires</span>
                      <span className={`text-sm ${(licenseInfo.daysRemaining ?? 999) < 30 ? 'text-amber-400' : 'text-white'}`}>
                        {licenseInfo.license?.expiresAt
                          ? new Date(licenseInfo.license.expiresAt).toLocaleDateString('th-TH')
                          : '-'}
                        {licenseInfo.daysRemaining !== undefined && (
                          <span className="text-xs text-gray-400 ml-1.5">({licenseInfo.daysRemaining} วัน)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Limits</span>
                      <span className="text-gray-300 text-sm">
                        {licenseInfo.license?.maxUsers} users / {licenseInfo.license?.maxStores} stores
                      </span>
                    </div>
                    {(licenseInfo.daysRemaining ?? 999) < 30 && (
                      <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        License ใกล้หมดอายุ กรุณาต่ออายุ
                      </div>
                    )}
                    {isSuperAdmin && licenseInfo.license?.licenseType !== 'TRIAL' && (
                      <button
                        onClick={() => setShowDeactivateConfirm(true)}
                        className="w-full mt-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Deactivate License
                      </button>
                    )}
                    {isSuperAdmin && licenseInfo.license?.licenseType === 'TRIAL' && (
                      <button
                        onClick={() => setShowActivateModal(true)}
                        className="w-full mt-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <Key className="w-4 h-4" /> Activate License
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Developer Info */}
              <div className="p-6 bg-slate-700/30 rounded-xl md:col-span-2">
                <div className="flex items-center space-x-3 mb-4">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Developer</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-white">{systemInfo.developer}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a href={systemInfo.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        {systemInfo.website}
                      </a>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${systemInfo.email}`} className="text-blue-400 hover:underline">
                        {systemInfo.email}
                      </a>
                    </div>
                    {systemInfo.phones.map((p) => (
                      <div key={p.number} className="flex items-center space-x-3">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-white">{p.number}</span>
                        <span className="text-gray-400 text-sm">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Copyright */}
            <div className="pt-6 border-t border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">RIM System - Retail IT Management</p>
                <p className="text-gray-500 text-xs mt-1">
                  Copyright 2024 {systemInfo.developer}. All rights reserved.
                </p>
              </div>
              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  {process.env.NEXT_PUBLIC_VENDOR_MODE === 'true' && (
                    <button
                      onClick={() => setShowManageModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 hover:border-blue-400/50 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Manage Licenses
                    </button>
                  )}
                  <button
                    onClick={openPatchModal}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 hover:border-purple-400/50 rounded-xl text-sm font-medium transition-colors"
                  >
                    <PackageOpen className="w-4 h-4" />
                    Patch Update
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── License Activate Modal ── */}
        {showActivateModal && (
          <LicenseActivateModal
            onClose={() => setShowActivateModal(false)}
            onActivated={() => { setTimeout(() => window.location.reload(), 1000) }}
          />
        )}

        {/* ── License Management Modal (SUPER_ADMIN only) ── */}
        {showManageModal && isSuperAdmin && (
          <LicenseManagementModal onClose={() => setShowManageModal(false)} />
        )}

        {/* ── Deactivate Confirm Modal ── */}
        {showDeactivateConfirm && licenseInfo?.license && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeactivateConfirm(false)} />
            <div className="relative w-full max-w-md glass-card rounded-2xl border border-red-500/30 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-white font-semibold">Deactivate License</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    หลังจาก Deactivate ระบบนี้จะกลับไปใช้ Trial จนกว่าจะ Activate ใหม่
                  </p>
                </div>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
                ใช้เมื่อต้องการย้าย License ไปติดตั้งที่ Server ใหม่เท่านั้น
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  ยืนยันโดยกรอก License Key: <span className="font-mono text-gray-300">{licenseInfo.license.licenseKey}</span>
                </label>
                <input
                  type="text"
                  value={deactivateKey}
                  onChange={(e) => setDeactivateKey(e.target.value.toUpperCase())}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-red-500"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeactivateConfirm(false); setDeactivateKey('') }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 text-gray-300 rounded-xl text-sm hover:bg-slate-600 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating || deactivateKey !== licenseInfo.license.licenseKey}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  ยืนยัน Deactivate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Patch Update Modal (SUPER_ADMIN only) ── */}
        {showPatchModal && isSuperAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPatchModal(false)} />
            <div className="relative w-full max-w-2xl glass-card rounded-2xl border border-purple-500/30 flex flex-col max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <PackageOpen className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-white text-lg">Patch Update</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={fetchVersionData} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors" title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${versionLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => setShowPatchModal(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {versionLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-purple-400 animate-spin mr-3" />
                <span className="text-gray-400">Loading version info...</span>
              </div>
            ) : (
              <>
                {/* Current Version Card */}
                <div className="glass-card p-6 rounded-2xl border border-purple-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CircleDot className="w-5 h-5 text-green-400" />
                      Current Version
                    </h3>
                    <button
                      onClick={fetchVersionData}
                      className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {versionCurrent ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Version</p>
                        <p className="text-2xl font-bold text-purple-400 font-mono">{versionCurrent.version}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Status</p>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400">
                          Active
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Installed</p>
                        <p className="text-sm text-white">
                          {versionCurrent.appliedAt
                            ? new Date(versionCurrent.appliedAt).toLocaleDateString('th-TH')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">By</p>
                        <p className="text-sm text-white">
                          {versionCurrent.appliedBy
                            ? `${versionCurrent.appliedBy.firstName} ${versionCurrent.appliedBy.lastName}`
                            : '-'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">No version info</p>
                  )}
                </div>

                {/* Install Update */}
                <div className="glass-card p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    Install Update
                  </h3>

                  <div className="space-y-4">
                    {/* File picker */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Select .rim-patch file</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-lg text-white text-sm cursor-pointer transition-colors">
                          <PackageOpen className="w-4 h-4" />
                          {selectedPatch ? selectedPatch.name : 'Choose file...'}
                          <input
                            type="file"
                            accept=".rim-patch"
                            className="hidden"
                            onChange={handlePatchFileSelect}
                            disabled={patchValidating || versionInstalling}
                          />
                        </label>
                        {patchValidating && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                      </div>
                    </div>

                    {/* Patch preview */}
                    {patchPreview && !installProgress && (
                      <div className="p-4 bg-slate-800/60 rounded-xl border border-blue-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">
                            v{patchPreview.fromVersion} → v{patchPreview.version}
                          </span>
                          <span className="text-xs text-gray-400">{patchPreview.releaseDate}</span>
                        </div>
                        {patchPreview.changes && patchPreview.changes.length > 0 && (
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {patchPreview.changes.map((c: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded font-medium ${
                                  c.type === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                                  c.type === 'fix' ? 'bg-red-500/20 text-red-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {c.type}
                                </span>
                                <span className="text-gray-300">{c.desc}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={handleInstallPatch}
                          disabled={versionInstalling}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                        >
                          <Zap className="w-4 h-4" /> Install v{patchPreview.version}
                        </button>
                      </div>
                    )}

                    {/* ── Install Progress UI ── */}
                    {installProgress && (
                      <div className={`p-5 rounded-xl border space-y-4 ${
                        installProgress.status === 'done'  ? 'bg-green-500/10 border-green-500/30' :
                        installProgress.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                        'bg-purple-500/10 border-purple-500/30'
                      }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-2">
                            {installProgress.status === 'running' && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
                            {installProgress.status === 'done'    && <CheckCircle className="w-4 h-4 text-green-400" />}
                            {installProgress.status === 'error'   && <AlertTriangle className="w-4 h-4 text-red-400" />}
                            {installProgress.status === 'running' ? 'Installing…' :
                             installProgress.status === 'done'    ? 'Installation Complete' :
                             'Installation Failed'}
                          </span>
                          <span className={`text-2xl font-bold font-mono tabular-nums ${
                            installProgress.status === 'done'  ? 'text-green-400' :
                            installProgress.status === 'error' ? 'text-red-400' :
                            'text-purple-300'
                          }`}>
                            {installProgress.pct}%
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              installProgress.status === 'done'  ? 'bg-green-500' :
                              installProgress.status === 'error' ? 'bg-red-500' :
                              'bg-purple-500'
                            } ${installProgress.status === 'running' ? 'relative overflow-hidden' : ''}`}
                            style={{ width: `${installProgress.pct}%` }}
                          >
                            {installProgress.status === 'running' && (
                              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            )}
                          </div>
                        </div>

                        {/* Step counter */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{installProgress.message}</span>
                          {installProgress.total > 0 && (
                            <span className="text-gray-500 text-xs">
                              Step {installProgress.step}/{installProgress.total}
                            </span>
                          )}
                        </div>

                        {/* Step dots */}
                        {installProgress.total > 0 && (
                          <div className="flex items-center gap-1.5">
                            {Array.from({ length: installProgress.total }).map((_, i) => (
                              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                i < installProgress.step
                                  ? installProgress.status === 'error' && i === installProgress.step - 1
                                    ? 'bg-red-500'
                                    : 'bg-purple-500'
                                  : 'bg-slate-600'
                              }`} />
                            ))}
                          </div>
                        )}

                        {/* Success banner */}
                        {installProgress.status === 'done' && (
                          <div className="pt-2 space-y-3">
                            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-center">
                              <p className="text-green-300 font-semibold text-sm">
                                ✅ Version {installProgress.result?.version} installed successfully!
                              </p>
                              {installProgress.result?.appliedAt && (
                                <p className="text-green-400/70 text-xs mt-1">
                                  {new Date(installProgress.result.appliedAt).toLocaleString('th-TH')}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={handleCloseInstallProgress}
                              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                            >
                              Close
                            </button>
                          </div>
                        )}

                        {/* Error detail */}
                        {installProgress.status === 'error' && (
                          <div className="pt-2 space-y-3">
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2">
                              <p className="text-red-300 text-sm font-medium">❌ {installProgress.error}</p>
                              {installProgress.error?.includes('restored automatically') ? (
                                <p className="text-green-400 text-xs flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Code เดิมถูก restore กลับอัตโนมัติแล้ว — ระบบพร้อมใช้งาน
                                </p>
                              ) : installProgress.error?.includes('Auto-rollback failed') ? (
                                <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-300 text-xs">
                                  ⚠️ Auto-rollback ล้มเหลว — กรุณา restore snapshot ด้วยตนเองจาก:<br />
                                  <code className="font-mono text-yellow-200 break-all">
                                    {installProgress.result?.snapshotPath}
                                  </code>
                                </div>
                              ) : (
                                <p className="text-gray-400 text-xs">
                                  ✅ ไม่มีการแก้ไข code — ระบบยังอยู่ในสถานะเดิม
                                </p>
                              )}
                            </div>
                            <button
                              onClick={handleCloseInstallProgress}
                              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Version History */}
                <div className="glass-card p-6 rounded-2xl">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    Version History
                  </h3>

                  {versionHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-6">No version history yet</p>
                  ) : (
                    <div className="space-y-2">
                      {versionHistory.map((v) => (
                        <div
                          key={v.id}
                          className={`flex items-center justify-between p-4 rounded-xl border ${
                            v.status === 'CURRENT'
                              ? 'bg-purple-500/10 border-purple-500/30'
                              : 'bg-slate-800/40 border-slate-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {v.status === 'CURRENT' ? (
                              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                            ) : (
                              <CircleDot className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-white">v{v.version}</span>
                                {v.status === 'CURRENT' && (
                                  <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {v.appliedAt ? new Date(v.appliedAt).toLocaleString('th-TH') : '-'}
                                {v.appliedBy && ` · by ${v.appliedBy.firstName} ${v.appliedBy.lastName}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.releaseNotes && (
                              <button
                                onClick={() => setReleaseNotesModal(v)}
                                className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg transition-colors"
                              >
                                Release Notes
                              </button>
                            )}
                            {v.status !== 'CURRENT' && (
                              <button
                                onClick={() => handleRollback(v.version)}
                                disabled={versionRollingBack === v.version}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {versionRollingBack === v.version ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                Rollback
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
              </div>{/* end scroll area */}
            </div>{/* end modal card */}
          </div>
        )}

        {/* Release Notes Modal (z-[60] to be above Patch modal) */}
        {releaseNotesModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReleaseNotesModal(null)} />
            <div className="relative w-full max-w-lg glass-card rounded-2xl border border-slate-600 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <PackageOpen className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-white">Release Notes — v{releaseNotesModal.version}</span>
                </div>
                <button onClick={() => setReleaseNotesModal(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {releaseNotesModal.changes && releaseNotesModal.changes.length > 0 && (
                  <div className="space-y-2">
                    {releaseNotesModal.changes.map((c: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded font-medium ${
                          c.type === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                          c.type === 'fix' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {c.type}
                        </span>
                        <span className="text-gray-300">{c.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
                {releaseNotesModal.releaseNotes && (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans mt-3 pt-3 border-t border-slate-700">
                    {releaseNotesModal.releaseNotes}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Only Warning */}
      {!canManage && (
        <div className="flex items-start space-x-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">View Only</p>
            <p className="text-sm text-gray-400">
              Only Super Admin can manage system settings.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
