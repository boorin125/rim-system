'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { X, Key, Copy, Check, AlertTriangle, CheckCircle, Loader2, Shield, Server, Gift } from 'lucide-react'
import toast from 'react-hot-toast'

interface MachineInfo {
  machineId: string
  isVirtualMachine: boolean
  vmType: string | null
  platform: string
  hostname: string
}

interface LicenseActivateModalProps {
  onClose: () => void
  onActivated: () => void
}

export default function LicenseActivateModal({ onClose, onActivated }: LicenseActivateModalProps) {
  const [tab, setTab] = useState<'key' | 'trial'>('trial')
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null)
  const [machineId, setMachineId] = useState('')
  const [copied, setCopied] = useState(false)

  // Key tab state
  const [keyParts, setKeyParts] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<'ALREADY_USED' | 'INVALID' | 'EXPIRED' | null>(null)
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  // Trial tab state
  const [trialOrg, setTrialOrg] = useState('')
  const [trialEmail, setTrialEmail] = useState('')
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialError, setTrialError] = useState('')

  useEffect(() => {
    fetchMachineId()
  }, [])

  const fetchMachineId = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/license/machine-info`)
      setMachineInfo(res.data)
      setMachineId(res.data.machineId)
    } catch {
      setMachineId('Unable to retrieve Machine ID')
    }
  }

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
    }
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return Promise.resolve()
  }

  const copyMachineId = () => {
    copyToClipboard(machineId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleKeyInput = (index: number, value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    const next = [...keyParts]
    next[index] = clean
    setKeyParts(next)
    setError(null)
    if (clean.length === 4 && index < 3) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && keyParts[index] === '' && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length >= 4) {
      const parts = [
        cleaned.slice(0, 4),
        cleaned.slice(4, 8),
        cleaned.slice(8, 12),
        cleaned.slice(12, 16),
      ]
      setKeyParts(parts)
      setError(null)
      inputRefs[3].current?.focus()
    }
  }

  const licenseKey = keyParts.join('-')
  const isKeyComplete = keyParts.every((p) => p.length === 4)

  const handleActivate = async () => {
    if (!isKeyComplete) return
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/activate`, {
        licenseKey,
        machineId,
      })
      if (res.data.success) {
        toast.success('License activated successfully')
        onActivated()
        onClose()
      }
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || ''
      if (msg.includes('activation limit') || msg.includes('Maximum activations') || msg.includes('different machine') || msg.includes('already activated')) {
        setError('ALREADY_USED')
      } else if (msg.includes('expired')) {
        setError('EXPIRED')
      } else {
        setError('INVALID')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRequestTrial = async () => {
    if (!trialOrg.trim() || !trialEmail.trim()) {
      setTrialError('กรุณากรอกชื่อบริษัทและ Email')
      return
    }
    setTrialLoading(true)
    setTrialError('')
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/license/request-trial`, {
        organizationName: trialOrg.trim(),
        contactEmail: trialEmail.trim(),
      })
      toast.success('ได้รับ Trial License แล้ว! ระบบพร้อมใช้งาน')
      onActivated()
      onClose()
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      setTrialError(msg)
    } finally {
      setTrialLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card rounded-2xl border border-blue-500/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white text-lg">Activate License</span>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab('trial')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              tab === 'trial' ? 'text-green-400 border-b-2 border-green-400 bg-green-500/5' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Gift className="w-4 h-4" /> ขอ Trial License (ฟรี 30 วัน)
          </button>
          <button
            onClick={() => setTab('key')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              tab === 'key' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" /> มี License Key
          </button>
        </div>

        <div className="p-6 space-y-5">
          {tab === 'trial' ? (
            <>
              {/* Trial form */}
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <div className="flex items-start gap-2 mb-3">
                  <Gift className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-300">
                    ทดลองใช้ฟรี 30 วัน — <span className="text-white font-medium">5 users / 10 stores</span>
                    <br />
                    <span className="text-xs text-gray-500">ไม่ต้องใช้บัตรเครดิต ต่ออายุได้ที่ support@rub-jobb.com</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">ชื่อบริษัท / Organization *</label>
                <input
                  type="text"
                  value={trialOrg}
                  onChange={(e) => { setTrialOrg(e.target.value); setTrialError('') }}
                  placeholder="บริษัท ABC จำกัด"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Email สำหรับรับ License *</label>
                <input
                  type="email"
                  value={trialEmail}
                  onChange={(e) => { setTrialEmail(e.target.value); setTrialError('') }}
                  placeholder="admin@company.com"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              {trialError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{trialError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl transition-colors text-sm">
                  ยกเลิก
                </button>
                <button
                  onClick={handleRequestTrial}
                  disabled={trialLoading}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  {trialLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> กำลังขอ Trial...</>
                  ) : (
                    <><Gift className="w-4 h-4" /> รับ Trial License</>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Machine ID */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Machine ID (ส่งให้ผู้ให้บริการเพื่อรับ License Key)</label>
                <div className="flex items-center gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-600">
                  <span className="text-white font-mono text-sm flex-1 break-all">{machineId || '...'}</span>
                  <button
                    onClick={copyMachineId}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                    title="Copy Machine ID"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {machineInfo && (
                  <div className="flex items-center gap-2 mt-2">
                    <Server className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{machineInfo.platform} · {machineInfo.hostname}</span>
                    {machineInfo.isVirtualMachine && (
                      <span className="ml-auto text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> VM: {machineInfo.vmType}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {machineInfo?.isVirtualMachine && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="text-amber-300 font-semibold mb-1">ตรวจพบ Virtual Machine ({machineInfo.vmType})</p>
                      <p className="text-gray-400">
                        Machine ID นี้ผูกกับ VM นี้ ไม่ใช่ Physical Host หากต้องการรันหลาย VM บน Host เดียวกัน
                        ต้องใช้ <span className="text-white font-medium">Volume License</span> ติดต่อผู้ให้บริการ
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* License Key Input */}
              <div>
                <label className="text-sm text-gray-400 mb-3 block">License Key</label>
                <div className="flex items-center gap-2 justify-center">
                  {keyParts.map((part, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        ref={inputRefs[i]}
                        type="text"
                        value={part}
                        onChange={(e) => handleKeyInput(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        maxLength={4}
                        className="w-16 text-center font-mono text-lg tracking-widest bg-slate-800 border border-slate-600 rounded-xl py-3 text-white focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="XXXX"
                      />
                      {i < 3 && <span className="text-gray-500 font-bold">-</span>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">รูปแบบ: XXXX-XXXX-XXXX-XXXX (วาง Ctrl+V ได้เลย)</p>
              </div>

              {error === 'ALREADY_USED' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-amber-300 font-semibold mb-1">License Key ถูกใช้งานครบจำนวนเครื่องแล้ว</p>
                      <div className="space-y-2 text-gray-400">
                        <div>
                          <p className="text-white text-xs font-medium mb-0.5">กรณี 1 — ต้องการย้าย Server</p>
                          <ol className="space-y-0.5 list-decimal list-inside text-xs">
                            <li>เข้า Server เก่า → Settings → License → กด "ถอน License"</li>
                            <li>กลับมา Activate ที่ Server ใหม่</li>
                          </ol>
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium mb-0.5">กรณี 2 — ต้องการใช้หลาย VM / Server</p>
                          <p className="text-xs">ต้องอัพเกรดเป็น <span className="text-amber-300 font-medium">Volume License</span> ติดต่อผู้ให้บริการ</p>
                        </div>
                      </div>
                      <p className="text-gray-500 mt-2 text-xs">หากเข้า Server เก่าไม่ได้ → ติดต่อผู้ให้บริการเพื่อ Force Transfer</p>
                    </div>
                  </div>
                </div>
              )}
              {error === 'EXPIRED' && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-300 font-semibold">License Key นี้หมดอายุแล้ว</p>
                    <p className="text-gray-400 mt-1">กรุณาติดต่อผู้ให้บริการเพื่อต่ออายุ License</p>
                  </div>
                </div>
              )}
              {error === 'INVALID' && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">License Key ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl transition-colors text-sm">
                  ยกเลิก
                </button>
                <button
                  onClick={handleActivate}
                  disabled={!isKeyComplete || loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Activating...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Activate</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
