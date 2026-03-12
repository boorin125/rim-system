'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { X, Key, Copy, Check, AlertTriangle, CheckCircle, Loader2, Shield, Server } from 'lucide-react'
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
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null)
  const [machineId, setMachineId] = useState('')
  const [copied, setCopied] = useState(false)
  const [keyParts, setKeyParts] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<'ALREADY_USED' | 'INVALID' | 'EXPIRED' | null>(null)
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

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

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId)
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
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      // Handle paste into first box — spread across all 4
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
        const parts = [
          cleaned.slice(0, 4),
          cleaned.slice(4, 8),
          cleaned.slice(8, 12),
          cleaned.slice(12, 16),
        ]
        setKeyParts(parts)
        setError(null)
        inputRefs[3].current?.focus()
      })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card rounded-2xl border border-blue-500/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white text-lg">Activate License</span>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
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
            {/* Machine info row */}
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

          {/* VM Warning */}
          {machineInfo?.isVirtualMachine && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-amber-300 font-semibold mb-1">ตรวจพบ Virtual Machine ({machineInfo.vmType})</p>
                  <p className="text-gray-400">
                    Machine ID นี้ผูกกับ VM นี้ ไม่ใช่ Physical Host หากต้องการรันหลาย VM บน Host เดียวกัน
                    ต้องใช้ <span className="text-white font-medium">Volume License</span> (หลาย Machine Slots)
                    ติดต่อผู้ให้บริการเพื่อรับ Volume License Key
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

          {/* Error States */}
          {error === 'ALREADY_USED' && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-amber-300 font-semibold mb-1">License Key ถูกใช้งานครบจำนวนเครื่องแล้ว</p>
                  <p className="text-gray-400 mb-2">มีสองสาเหตุที่เป็นไปได้:</p>
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
                      <p className="text-xs">ต้องอัพเกรดเป็น <span className="text-amber-300 font-medium">Volume License</span> ที่รองรับหลายเครื่อง ติดต่อผู้ให้บริการ</p>
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

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-xl transition-colors text-sm"
            >
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
        </div>
      </div>
    </div>
  )
}
