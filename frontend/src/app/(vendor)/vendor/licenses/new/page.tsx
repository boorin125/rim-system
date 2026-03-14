'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Copy, Check, Calculator, Tag, Users, Store } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

const TYPE_DEFAULTS: Record<string, { maxUsers: number; maxStores: number; days: number; pricePerDay: number }> = {
  TRIAL:        { maxUsers: 5,     maxStores: 10,    days: 30,   pricePerDay: 0 },
  BASIC:        { maxUsers: 30,    maxStores: 100,   days: 365,  pricePerDay: 50 },
  PROFESSIONAL: { maxUsers: 100,   maxStores: 300,   days: 365,  pricePerDay: 200 },
  ENTERPRISE:   { maxUsers: 500,   maxStores: 1000,  days: 365,  pricePerDay: 600 },
  UNLIMITED:    { maxUsers: 99999, maxStores: 99999, days: 3650, pricePerDay: 1200 },
}

// Volume discount tiers
const VOLUME_TIERS = [
  { min: 1,  max: 1,  discount: 0,    label: '—' },
  { min: 2,  max: 3,  discount: 0.05, label: '5%' },
  { min: 4,  max: 5,  discount: 0.10, label: '10%' },
  { min: 6,  max: 10, discount: 0.15, label: '15%' },
  { min: 11, max: Infinity, discount: 0.20, label: '20%' },
]

// Time-based discount presets
const TIME_PRESETS = [
  { label: '30 วัน',  days: 30,   discount: 0,    discountLabel: '—' },
  { label: '3 เดือน', days: 90,   discount: 0.05, discountLabel: '5%' },
  { label: '6 เดือน', days: 180,  discount: 0.10, discountLabel: '10%' },
  { label: '1 ปี',    days: 365,  discount: 0.15, discountLabel: '15%' },
  { label: '2 ปี',    days: 730,  discount: 0.20, discountLabel: '20%' },
  { label: '5 ปี',    days: 1825, discount: 0.30, discountLabel: '30%' },
]

function getVolumeDiscount(machines: number) {
  return VOLUME_TIERS.find(t => machines >= t.min && machines <= t.max) ?? VOLUME_TIERS[0]
}

function getTimeDiscount(days: number) {
  // Match closest preset (or nearest lower)
  const sorted = [...TIME_PRESETS].reverse()
  return sorted.find(p => days >= p.days) ?? TIME_PRESETS[0]
}

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function NewLicensePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const getDefaultExpiry = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  const [form, setForm] = useState({
    licenseType: 'ENTERPRISE',
    organizationName: '',
    contactEmail: '',
    contactPhone: '',
    maxActivations: 1,
    expiresAt: getDefaultExpiry(365),
    notes: '',
  })

  const setField = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  const handleTypeChange = (type: string) => {
    const def = TYPE_DEFAULTS[type]
    setForm(f => ({ ...f, licenseType: type, expiresAt: getDefaultExpiry(def.days) }))
  }

  // ── Calculator ─────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const def = TYPE_DEFAULTS[form.licenseType]
    const machines = Math.max(1, Number(form.maxActivations) || 1)
    const today = new Date(); today.setHours(0,0,0,0)
    const expiry = new Date(form.expiresAt); expiry.setHours(0,0,0,0)
    const days = Math.max(0, Math.round((expiry.getTime() - today.getTime()) / 86400000))
    const volumeTier = getVolumeDiscount(machines)
    const timeTier   = getTimeDiscount(days)
    const subtotal = def.pricePerDay * machines * days
    const totalDiscountRate = Math.min(volumeTier.discount + timeTier.discount, 0.45)
    const discountAmt = subtotal * totalDiscountRate
    const total = subtotal - discountAmt
    return { pricePerDay: def.pricePerDay, machines, days, volumeTier, timeTier, subtotal, discountAmt, totalDiscountRate, total }
  }, [form.licenseType, form.maxActivations, form.expiresAt])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const secret = sessionStorage.getItem('vendor_secret') || ''
    if (!secret) { router.push('/vendor/login'); return }

    const def = TYPE_DEFAULTS[form.licenseType]
    setLoading(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        licenseType: form.licenseType,
        organizationName: form.organizationName,
        contactEmail: form.contactEmail,
        maxUsers: def.maxUsers,
        maxStores: def.maxStores,
        maxActivations: Number(form.maxActivations),
        expiresAt: new Date(form.expiresAt).toISOString(),
      }
      if (form.contactPhone) payload.contactPhone = form.contactPhone
      if (form.notes) payload.notes = form.notes

      const res = await fetch(`${API_URL}/vendor/licenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vendor-secret': secret },
        body: JSON.stringify(payload),
      })

      if (!res.ok) { const err = await res.json(); setError(err.message || 'เกิดข้อผิดพลาด'); return }
      const data = await res.json()
      setCreatedKey(data.licenseKey)
    } catch {
      setError('ไม่สามารถเชื่อมต่อ Server ได้')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = () => {
    if (!createdKey) return
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(createdKey)
    } else {
      const el = document.createElement('textarea')
      el.value = createdKey
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Success screen ──────────────────────────────────────────────────
  if (createdKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-8">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">สร้าง License สำเร็จ</h2>
            <p className="text-gray-400 text-sm mb-6">คัดลอก License Key นี้ให้ลูกค้า</p>
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 mb-4">
              <code className="text-2xl font-mono text-purple-300 tracking-widest">{createdKey}</code>
            </div>
            <button onClick={copyKey}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors mb-3 ${copied ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
              {copied ? <><Check className="w-4 h-4" /> คัดลอกแล้ว!</> : <><Copy className="w-4 h-4" /> คัดลอก License Key</>}
            </button>
            <button onClick={() => router.push('/vendor/licenses')}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors">
              กลับไปรายการ
            </button>
          </div>
        </div>
      </div>
    )
  }

  const def = TYPE_DEFAULTS[form.licenseType]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white">สร้าง License ใหม่</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 space-y-5">

          {/* License Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">ประเภท License</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.keys(TYPE_DEFAULTS).map(type => (
                <button key={type} type="button" onClick={() => handleTypeChange(type)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                    form.licenseType === type
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}>
                  {type}
                </button>
              ))}
            </div>

            {/* Limits badge (read-only) */}
            <div className="flex gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Users:</span>
                <span className="text-white font-medium">{def.maxUsers === 99999 ? '∞' : def.maxUsers}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">Stores:</span>
                <span className="text-white font-medium">{def.maxStores === 99999 ? '∞' : def.maxStores}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400">ราคา/วัน:</span>
                <span className="text-purple-300 font-medium">
                  {def.pricePerDay === 0 ? 'ฟรี' : `฿${def.pricePerDay.toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">ชื่อองค์กร <span className="text-red-400">*</span></label>
              <input required value={form.organizationName} onChange={e => setField('organizationName', e.target.value)}
                placeholder="บริษัท ABC จำกัด"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email <span className="text-red-400">*</span></label>
              <input required type="email" value={form.contactEmail} onChange={e => setField('contactEmail', e.target.value)}
                placeholder="admin@company.com"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">เบอร์โทร</label>
              <input value={form.contactPhone} onChange={e => setField('contactPhone', e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
          </div>

          {/* Machines */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">จำนวนเครื่อง (Server)</label>
            <input type="number" min="1" max="100" value={form.maxActivations}
              onChange={e => setField('maxActivations', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500" />
            {/* Volume discount hint */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {VOLUME_TIERS.slice(1).map(t => (
                <span key={t.min}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    calc.volumeTier.min === t.min
                      ? 'bg-green-500/20 border-green-500/50 text-green-300'
                      : 'bg-gray-800 border-gray-600 text-gray-500'
                  }`}>
                  {t.min === 11 ? '11+' : `${t.min}–${t.max}`} เครื่อง: ลด {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">วันหมดอายุ</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {TIME_PRESETS.map(p => (
                <button key={p.days} type="button"
                  onClick={() => setField('expiresAt', getDefaultExpiry(p.days))}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                    calc.timeTier.days === p.days
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}>
                  {p.label}
                  {p.discount > 0 && (
                    <span className={`px-1 py-0.5 rounded text-xs ${calc.timeTier.days === p.days ? 'bg-purple-400/30 text-purple-100' : 'bg-green-500/20 text-green-400'}`}>
                      -{p.discountLabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <input type="date" value={form.expiresAt} onChange={e => setField('expiresAt', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">หมายเหตุ (Internal)</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
              rows={2} placeholder="หมายเหตุสำหรับ Developer..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors">
            {loading ? 'กำลังสร้าง...' : 'สร้าง License Key'}
          </button>
        </form>

        {/* ── Price Calculator ─────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">คำนวณราคา</h3>
          </div>

          {calc.pricePerDay === 0 ? (
            <p className="text-green-400 text-center py-4">TRIAL License — ไม่มีค่าใช้จ่าย</p>
          ) : (
            <div className="space-y-3">
              {/* Formula row */}
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-gray-400 text-xs mb-1">ราคา/วัน/เครื่อง</div>
                  <div className="text-white font-semibold">฿{calc.pricePerDay.toLocaleString()}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-gray-400 text-xs mb-1">จำนวนเครื่อง</div>
                  <div className="text-white font-semibold">{calc.machines}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-gray-400 text-xs mb-1">จำนวนวัน</div>
                  <div className="text-white font-semibold">{calc.days}</div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>ราคารวมก่อนส่วนลด</span>
                  <span className="text-white">฿{fmt(calc.subtotal)}</span>
                </div>
                {calc.timeTier.discount > 0 && (
                  <div className="flex justify-between text-blue-400">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      ส่วนลดระยะยาว ({calc.timeTier.label}) -{calc.timeTier.discountLabel}
                    </span>
                    <span>-฿{fmt(calc.subtotal * calc.timeTier.discount)}</span>
                  </div>
                )}
                {calc.volumeTier.discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      ส่วนลด Volume ({calc.machines} เครื่อง) -{calc.volumeTier.label}
                    </span>
                    <span>-฿{fmt(calc.subtotal * calc.volumeTier.discount)}</span>
                  </div>
                )}
                {calc.totalDiscountRate > 0 && (
                  <div className="flex justify-between text-amber-400 text-xs">
                    <span>รวมส่วนลดทั้งหมด</span>
                    <span>{(calc.totalDiscountRate * 100).toFixed(0)}%</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold">
                  <span className="text-white">ราคาสุทธิ</span>
                  <span className="text-purple-300 text-lg">฿{fmt(calc.total)}</span>
                </div>
              </div>

              {/* Discount tables */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="mb-1.5 text-gray-400">ส่วนลดระยะยาว:</p>
                  <div className="space-y-1">
                    {TIME_PRESETS.map(p => (
                      <div key={p.days}
                        className={`flex justify-between px-2 py-1 rounded-lg border ${
                          calc.timeTier.days === p.days
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                            : 'bg-gray-800 border-gray-700 text-gray-500'
                        }`}>
                        <span>{p.label}</span>
                        <span className="font-medium">{p.discount === 0 ? '—' : p.discountLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-gray-400">ส่วนลด Volume:</p>
                  <div className="space-y-1">
                    {VOLUME_TIERS.map(t => (
                      <div key={t.min}
                        className={`flex justify-between px-2 py-1 rounded-lg border ${
                          calc.volumeTier.min === t.min
                            ? 'bg-green-500/20 border-green-500/40 text-green-300'
                            : 'bg-gray-800 border-gray-700 text-gray-500'
                        }`}>
                        <span>{t.min === 1 ? '1 เครื่อง' : t.min === 11 ? '11+ เครื่อง' : `${t.min}–${t.max} เครื่อง`}</span>
                        <span className="font-medium">{t.discount === 0 ? '—' : t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
