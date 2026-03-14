'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Upload, ArrowLeft, AlertTriangle, CheckCircle,
  Terminal, FileCode, Eye, EyeOff, Download, RefreshCw,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

const PATCH_TYPES = [
  { value: 'HOTFIX',      label: '🔴 Hotfix',      desc: 'แก้ไขบัค critical',              border: 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10',    active: 'border-red-500 bg-red-500/15 text-red-300' },
  { value: 'FEATURE',     label: '🟢 Feature',     desc: 'เพิ่ม Feature ใหม่',              border: 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10', active: 'border-green-500 bg-green-500/15 text-green-300' },
  { value: 'SECURITY',    label: '🔒 Security',    desc: 'แก้ไขช่องโหว่',                  border: 'border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10', active: 'border-yellow-500 bg-yellow-500/15 text-yellow-300' },
  { value: 'MAINTENANCE', label: '🔧 Maintenance', desc: 'Performance / Dependencies',     border: 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10',  active: 'border-blue-500 bg-blue-500/15 text-blue-300' },
]

const ALLOWED_EXTS = ['.zip', '.tar', '.gz', '.exe', '.sh', '.run', '.pkg', '.dmg']

function formatBytes(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

// ─── Shell Script Generator ────────────────────────────────────────────────
function generateUpdateScript(opts: {
  version: string
  patchType: string
  title: string
  changelog: string
  rimDir: string
  branch: string
  customPreCmds: string
  customPostCmds: string
}): string {
  const { version, patchType, title, changelog, rimDir, branch, customPreCmds, customPostCmds } = opts

  const changelogLines = changelog
    .split('\n')
    .filter(Boolean)
    .map((l) => `#   ${l.replace(/^[-*]\s*/, '• ')}`)
    .join('\n')

  const preCmds = customPreCmds.trim()
    ? customPreCmds
        .split('\n')
        .filter(Boolean)
        .map((c) => `  ${c.trim()}`)
        .join('\n')
    : ''

  const postCmds = customPostCmds.trim()
    ? customPostCmds
        .split('\n')
        .filter(Boolean)
        .map((c) => `  ${c.trim()}`)
        .join('\n')
    : ''

  const totalSteps = 6 + (preCmds ? 1 : 0) + (postCmds ? 1 : 0)
  let stepNum = 0
  const step = (desc: string) => {
    stepNum++
    return stepNum
  }
  // Pre-calculate step numbers
  const sPreCheck  = 1
  const sPreCmds   = preCmds  ? 2 : null
  const sPull      = preCmds  ? 3 : 2
  const sStop      = sPull + 1
  const sBuild     = sStop + 1
  const sStart     = sBuild + 1
  const sPostCmds  = postCmds ? sStart + 1 : null
  const sHealth    = postCmds ? sStart + 2 : sStart + 1
  const total      = sHealth

  return `#!/bin/bash
# ═══════════════════════════════════════════════════════════
#   RIM System Update Script
#   Version  : ${version}
#   Type     : ${patchType}
#   Title    : ${title}
#   Generated: $(date -d "today" 2>/dev/null || date)
# ─────────────────────────────────────────────────────────
#   Changelog:
${changelogLines}
# ═══════════════════════════════════════════════════════════
# Usage: bash update-${version}.sh
#        RIM_DIR=/custom/path bash update-${version}.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──────────────────────────────────────────────────
RIM_DIR="\${RIM_DIR:-${rimDir}}"
BRANCH="\${BRANCH:-${branch}}"
VERSION="${version}"
TOTAL_STEPS=${total}
LOG_FILE="\${RIM_DIR}/update-\${VERSION}.log"

# ── Colors ──────────────────────────────────────────────────
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
MAGENTA='\\033[0;35m'
BOLD='\\033[1m'
DIM='\\033[2m'
NC='\\033[0m'

# ── Helpers ──────────────────────────────────────────────────
progress() {
  local step=\$1
  local desc=\$2
  local pct=\$(( step * 100 / TOTAL_STEPS ))
  local filled=\$(( pct * 30 / 100 ))
  local empty=\$(( 30 - filled ))
  local bar=""
  for i in \$(seq 1 \$filled 2>/dev/null); do bar="\${bar}█"; done
  for i in \$(seq 1 \$empty  2>/dev/null); do bar="\${bar}░"; done
  echo ""
  echo -e "\${CYAN}[\${bar}]\${NC} \${BOLD}\${pct}%\${NC}  Step \${step}/\${TOTAL_STEPS} — \${desc}"
  echo "[\$(date '+%H:%M:%S')] Step \${step}/\${TOTAL_STEPS} (\${pct}%) — \${desc}" >> "\$LOG_FILE" 2>/dev/null || true
}

ok()   { echo -e "  \${GREEN}✔\${NC}  \$*"; }
info() { echo -e "  \${BLUE}ℹ\${NC}  \${DIM}\$*\${NC}"; }
warn() { echo -e "  \${YELLOW}⚠\${NC}  \$*"; }
fail() { echo -e "  \${RED}✘\${NC}  \$*"; }

handle_error() {
  echo ""
  echo -e "\${RED}╔══════════════════════════════════════════════╗\${NC}"
  echo -e "\${RED}║  ✘  Update Failed!                          ║\${NC}"
  echo -e "\${RED}║  Error at line \$1                           ║\${NC}"
  echo -e "\${RED}║  Check log: \${LOG_FILE}\${NC}"
  echo -e "\${RED}╚══════════════════════════════════════════════╝\${NC}"
  echo ""
  exit 1
}

trap 'handle_error \$LINENO' ERR

# ═══════════════════════════════════════════════════════════
echo ""
echo -e "\${MAGENTA}╔══════════════════════════════════════════════╗\${NC}"
echo -e "\${MAGENTA}║   📦  RIM System Updater v\${VERSION}          ║\${NC}"
echo -e "\${MAGENTA}║   \${DIM}${title}\${NC}\${MAGENTA}                ║\${NC}"
echo -e "\${MAGENTA}╚══════════════════════════════════════════════╝\${NC}"
echo ""
info "Project dir : \$RIM_DIR"
info "Branch      : \$BRANCH"
info "Log file    : \$LOG_FILE"
echo ""

# ── Step ${sPreCheck}: Prerequisites ───────────────────────────────────────────
progress ${sPreCheck} "Checking prerequisites..."

if [ ! -d "\$RIM_DIR" ]; then
  fail "Directory not found: \$RIM_DIR"
  echo "  Set RIM_DIR env variable to your installation path."
  exit 1
fi
ok "Project directory found"

for cmd in docker git; do
  if ! command -v \$cmd &>/dev/null; then
    fail "\$cmd is not installed"
    exit 1
  fi
  ok "\$cmd found: \$(command -v \$cmd)"
done

cd "\$RIM_DIR"
ok "Changed to \$RIM_DIR"
${preCmds ? `
# ── Step ${sPreCmds}: Pre-update commands ────────────────────────────────────
progress ${sPreCmds} "Running pre-update steps..."
${preCmds}
ok "Pre-update steps complete"
` : ''}
# ── Step ${sPull}: Pull latest code ────────────────────────────────────────
progress ${sPull} "Pulling latest code from git..."

git fetch origin
CURRENT_COMMIT=\$(git rev-parse HEAD)
git pull origin "\$BRANCH"
NEW_COMMIT=\$(git rev-parse HEAD)

if [ "\$CURRENT_COMMIT" = "\$NEW_COMMIT" ]; then
  warn "No new commits — code was already up to date"
else
  ok "Updated: \${CURRENT_COMMIT:0:7} → \${NEW_COMMIT:0:7}"
fi

# ── Step ${sStop}: Stop services ───────────────────────────────────────────
progress ${sStop} "Stopping services..."

docker compose down --remove-orphans 2>&1 | while read line; do info "\$line"; done
ok "Services stopped"

# ── Step ${sBuild}: Build new images ───────────────────────────────────────
progress ${sBuild} "Building Docker images (this may take a few minutes)..."

docker compose build --no-cache 2>&1 | while read line; do info "\$line"; done
ok "Build complete"

# ── Step ${sStart}: Start services ────────────────────────────────────────
progress ${sStart} "Starting services..."

docker compose up -d 2>&1 | while read line; do info "\$line"; done
ok "Services started"

sleep 3
${postCmds ? `
# ── Step ${sPostCmds}: Post-update commands ──────────────────────────────────
progress ${sPostCmds} "Running post-update steps..."
${postCmds}
ok "Post-update steps complete"
` : ''}
# ── Step ${sHealth}: Health check ─────────────────────────────────────────
progress ${sHealth} "Running health check..."

RUNNING=\$(docker compose ps --status running --quiet 2>/dev/null | wc -l || echo "0")
TOTAL_CONTAINERS=\$(docker compose ps --quiet 2>/dev/null | wc -l || echo "?")

if [ "\$RUNNING" -gt 0 ] 2>/dev/null; then
  ok "\$RUNNING/\$TOTAL_CONTAINERS containers running"
else
  warn "Could not verify container status — check manually with: docker compose ps"
fi

# ═══════════════════════════════════════════════════════════
echo ""
echo -e "\${GREEN}╔══════════════════════════════════════════════╗\${NC}"
echo -e "\${GREEN}║  ✅  Update Successful!                      ║\${NC}"
echo -e "\${GREEN}║                                              ║\${NC}"
echo -e "\${GREEN}║  Version : \${VERSION}                        ║\${NC}"
echo -e "\${GREEN}║  Updated : \$(date '+%d/%m/%Y %H:%M')          ║\${NC}"
echo -e "\${GREEN}╚══════════════════════════════════════════════╝\${NC}"
echo ""
echo -e "  \${DIM}Log saved to: \$LOG_FILE\${NC}"
echo ""

# Desktop notification (if available)
if command -v notify-send &>/dev/null 2>&1; then
  notify-send "RIM System Updated ✅" "Version \${VERSION} installed successfully" --icon=dialog-information 2>/dev/null || true
fi

# Completion beep
echo -e "\\a"

exit 0
`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VendorCreatePatchPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Shared fields
  const [version, setVersion] = useState('')
  const [patchType, setPatchType] = useState('HOTFIX')
  const [title, setTitle] = useState('')
  const [changelog, setChangelog] = useState('')

  // Mode
  const [mode, setMode] = useState<'generate' | 'upload'>('generate')

  // Script generator options
  const [rimDir, setRimDir] = useState('/opt/rim-system')
  const [branch, setBranch] = useState('main')
  const [customPreCmds, setCustomPreCmds] = useState('')
  const [customPostCmds, setCustomPostCmds] = useState('')
  const [scriptPreview, setScriptPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Upload
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Submit
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-regenerate preview when fields change (in generate mode)
  useEffect(() => {
    if (mode === 'generate' && version && title && changelog) {
      const script = generateUpdateScript({ version, patchType, title, changelog, rimDir, branch, customPreCmds, customPostCmds })
      setScriptPreview(script)
    }
  }, [mode, version, patchType, title, changelog, rimDir, branch, customPreCmds, customPostCmds])

  const getSecret = () => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem('vendor_secret') || ''
  }

  const handleFileSelect = (selected: File) => {
    const ext = '.' + selected.name.split('.').pop()!.toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`File type ${ext} not allowed. Allowed: ${ALLOWED_EXTS.join(', ')}`)
      return
    }
    setError('')
    setFile(selected)
  }

  const downloadScript = () => {
    if (!scriptPreview) return
    const blob = new Blob([scriptPreview], { type: 'text/x-shellscript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `update-${version || 'x.x.x'}.sh`
    a.click()
    URL.revokeObjectURL(url)
  }

  const useScriptAsFile = () => {
    if (!scriptPreview) return
    const blob = new Blob([scriptPreview], { type: 'text/x-shellscript' })
    const f = new File([blob], `update-${version}.sh`, { type: 'text/x-shellscript' })
    setFile(f)
    setMode('upload')
  }

  const validate = () => {
    if (!version.match(/^\d+\.\d+\.\d+/)) { setError('Version ต้องอยู่ในรูป 1.2.3'); return false }
    if (!title.trim()) { setError('กรุณาใส่ Title'); return false }
    if (!changelog.trim()) { setError('กรุณาใส่ Changelog'); return false }
    if (!file) { setError('กรุณาเลือกหรือ Generate ไฟล์ Script'); return false }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

    const secret = getSecret()
    if (!secret) { router.push('/vendor/login'); return }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file!)
      fd.append('version', version.trim())
      fd.append('patchType', patchType)
      fd.append('title', title.trim())
      fd.append('changelog', changelog.trim())

      const res = await fetch(`${API_URL}/vendor/patches`, {
        method: 'POST',
        headers: { 'x-vendor-secret': secret },
        body: fd,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.message || 'Upload failed')
        return
      }

      router.push('/vendor/patches')
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const canGenerate = version.match(/^\d+\.\d+\.\d+/) && title.trim() && changelog.trim()

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/vendor/patches')} className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Create Patch</h1>
              <p className="text-sm text-gray-400">สร้าง Update Script หรืออัพโหลดไฟล์</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Shared Info ── */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">ข้อมูล Patch</h2>

            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Version <span className="text-red-400">*</span>
                <span className="ml-2 text-gray-500 font-normal text-xs">semantic: 1.2.3</span>
              </label>
              <input type="text" value={version} onChange={(e) => setVersion(e.target.value)}
                placeholder="1.2.3"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-lg" />
            </div>

            {/* Patch Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Patch Type <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                {PATCH_TYPES.map((pt) => (
                  <button key={pt.value} type="button" onClick={() => setPatchType(pt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${patchType === pt.value ? pt.active : pt.border}`}>
                    <div className="font-semibold text-white text-sm">{pt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{pt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Title <span className="text-red-400">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fix crash on PM report generation"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>

            {/* Changelog */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Changelog <span className="text-red-400">*</span>
                <span className="ml-2 text-gray-500 font-normal text-xs">ขึ้นบรรทัดใหม่ต่อรายการ</span>
              </label>
              <textarea value={changelog} onChange={(e) => setChangelog(e.target.value)}
                placeholder={`- แก้ไขปัญหา X ที่ทำให้ระบบ crash\n- ปรับปรุง Performance ของ Report\n- เพิ่ม Feature Y`}
                rows={5}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm resize-none" />
            </div>
          </div>

          {/* ── Mode Selector ── */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode('generate')}
              className={`p-4 rounded-xl border text-left transition-all ${mode === 'generate' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-900 hover:border-slate-500'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Terminal className={`w-5 h-5 ${mode === 'generate' ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className="font-semibold text-white text-sm">Generate Script</span>
                {mode === 'generate' && <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Active</span>}
              </div>
              <p className="text-xs text-gray-400">สร้าง Shell Script อัตโนมัติ พร้อม Progress Bar</p>
            </button>
            <button type="button" onClick={() => setMode('upload')}
              className={`p-4 rounded-xl border text-left transition-all ${mode === 'upload' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 bg-slate-900 hover:border-slate-500'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Upload className={`w-5 h-5 ${mode === 'upload' ? 'text-purple-400' : 'text-gray-500'}`} />
                <span className="font-semibold text-white text-sm">Upload File</span>
                {mode === 'upload' && <span className="ml-auto text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Active</span>}
              </div>
              <p className="text-xs text-gray-400">อัพโหลดไฟล์ที่เตรียมไว้เอง (.sh .zip .exe)</p>
            </button>
          </div>

          {/* ── Generate Script Mode ── */}
          {mode === 'generate' && (
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Script Settings
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    RIM Directory
                    <span className="ml-1 text-gray-500 text-xs">บน server ลูกค้า</span>
                  </label>
                  <input type="text" value={rimDir} onChange={(e) => setRimDir(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Git Branch
                  </label>
                  <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pre-update Commands
                  <span className="ml-2 text-gray-500 font-normal text-xs">รันก่อน git pull (optional)</span>
                </label>
                <textarea value={customPreCmds} onChange={(e) => setCustomPreCmds(e.target.value)}
                  placeholder="cp .env .env.backup&#10;docker compose exec backend npm run db:backup"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Post-update Commands
                  <span className="ml-2 text-gray-500 font-normal text-xs">รันหลัง docker up (optional)</span>
                </label>
                <textarea value={customPostCmds} onChange={(e) => setCustomPostCmds(e.target.value)}
                  placeholder="docker compose exec backend npx prisma db push&#10;docker compose exec backend npm run seed"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600" />
              </div>

              {/* Script actions */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="button" onClick={() => setShowPreview((v) => !v)} disabled={!canGenerate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm border border-slate-600 disabled:opacity-40">
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'ซ่อน Preview' : 'Preview Script'}
                </button>
                <button type="button" onClick={downloadScript} disabled={!canGenerate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm border border-slate-600 disabled:opacity-40">
                  <Download className="w-4 h-4" />
                  Download .sh
                </button>
                <button type="button" onClick={useScriptAsFile} disabled={!canGenerate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg text-sm border border-green-600/30 disabled:opacity-40">
                  <CheckCircle className="w-4 h-4" />
                  ใช้ Script นี้เป็น Patch File
                </button>
                {!canGenerate && (
                  <span className="text-xs text-gray-500 italic">กรอก Version, Title, Changelog ก่อน</span>
                )}
              </div>

              {/* Script Preview */}
              {showPreview && scriptPreview && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <FileCode className="w-3.5 h-3.5" /> update-{version || 'x.x.x'}.sh
                    </span>
                    <span className="text-xs text-gray-500">{scriptPreview.split('\n').length} lines</span>
                  </div>
                  <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-green-300 font-mono overflow-auto max-h-96 leading-relaxed whitespace-pre">
                    {scriptPreview}
                  </pre>
                </div>
              )}

              {/* Progress preview info box */}
              {canGenerate && (
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-gray-400">
                  <p className="font-medium text-gray-300 mb-2">📺 ตัวอย่าง Progress ที่ลูกค้าจะเห็น:</p>
                  <pre className="font-mono leading-relaxed text-green-400/80 whitespace-pre">{`[██████████░░░░░░░░░░░░░░░░░░░░] 33%  Step 2/${4 + (customPreCmds ? 1 : 0) + (customPostCmds ? 1 : 0)} — Pulling latest code from git...
  ✔  Updated: a3f9b12 → d4e8c91

[████████████████████░░░░░░░░░░] 67%  Step 4/${4 + (customPreCmds ? 1 : 0) + (customPostCmds ? 1 : 0)} — Building Docker images...`}</pre>
                </div>
              )}
            </div>
          )}

          {/* ── Upload File Mode ── */}
          {mode === 'upload' && (
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Patch File
                <span className="text-gray-600 font-normal normal-case text-xs">{ALLOWED_EXTS.join(' · ')} · max 500 MB</span>
              </h2>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-blue-500 bg-blue-500/10'
                  : file ? 'border-green-500/50 bg-green-500/5'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'}`}>
                <input ref={fileRef} type="file" accept={ALLOWED_EXTS.join(',')}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
                {file ? (
                  <div>
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-green-300 font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400 mt-1">{formatBytes(file.size)}</p>
                    <p className="text-xs text-gray-500 mt-2">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">Drop file here or click to browse</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Current File Status ── */}
          {file && mode === 'generate' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-green-300 font-medium">Script ready:</span>
                <span className="text-gray-400 ml-2">{file.name} ({formatBytes(file.size)})</span>
              </div>
              <button type="button" onClick={() => setFile(null)} className="text-gray-500 hover:text-gray-300 text-xs">ลบ</button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300/80 space-y-1">
            <p className="font-medium text-blue-300">📋 หลังสร้าง Patch</p>
            <p>• Patch อยู่ในสถานะ <strong>Draft</strong> — ลูกค้ายังไม่เห็น</p>
            <p>• กด <strong>Publish</strong> เพื่อเผยแพร่ + ส่ง Email แจ้งลูกค้าทุกรายที่มี License ACTIVE</p>
            <p>• ลูกค้า download script แล้วรัน: <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono">bash update-{version || 'x.x.x'}.sh</code></p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => router.push('/vendor/patches')}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading…</>
              ) : (
                <><Package className="w-4 h-4" />Create Patch</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
