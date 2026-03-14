'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Copy, Check } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

const TYPE_DEFAULTS: Record<string, { maxUsers: number; maxStores: number; days: number }> = {
  TRIAL: { maxUsers: 5, maxStores: 10, days: 30 },
  BASIC: { maxUsers: 30, maxStores: 100, days: 365 },
  PROFESSIONAL: { maxUsers: 100, maxStores: 300, days: 365 },
  ENTERPRISE: { maxUsers: 500, maxStores: 1000, days: 365 },
  UNLIMITED: { maxUsers: 99999, maxStores: 99999, days: 3650 },
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
    maxUsers: 500,
    maxStores: 500,
    maxIncidentsMonth: '',
    maxActivations: 1,
    expiresAt: getDefaultExpiry(365),
    notes: '',
  })

  const setField = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  const handleTypeChange = (type: string) => {
    const def = TYPE_DEFAULTS[type]
    setForm(f => ({
      ...f,
      licenseType: type,
      maxUsers: def.maxUsers,
      maxStores: def.maxStores,
      expiresAt: getDefaultExpiry(def.days),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const secret = sessionStorage.getItem('vendor_secret') || ''
    if (!secret) { router.push('/vendor/login'); return }

    setLoading(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        licenseType: form.licenseType,
        organizationName: form.organizationName,
        contactEmail: form.contactEmail,
        maxUsers: Number(form.maxUsers),
        maxStores: Number(form.maxStores),
        maxActivations: Number(form.maxActivations),
        expiresAt: new Date(form.expiresAt).toISOString(),
      }
      if (form.contactPhone) payload.contactPhone = form.contactPhone
      if (form.maxIncidentsMonth) payload.maxIncidentsMonth = Number(form.maxIncidentsMonth)
      if (form.notes) payload.notes = form.notes

      const res = await fetch(`${API_URL}/vendor/licenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-vendor-secret': secret },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.message || 'เกิดข้อผิดพลาด')
        return
      }

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
    navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Success screen
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
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors mb-3 ${
                copied ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}>
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

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 space-y-5">
          {/* License Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">ประเภท License</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.keys(TYPE_DEFAULTS).map(type => (
                <button key={type} type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                    form.licenseType === type
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}>
                  {type}
                </button>
              ))}
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

          {/* Limits */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Max Users</label>
              <input type="number" min="1" value={form.maxUsers} onChange={e => setField('maxUsers', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Max Stores</label>
              <input type="number" min="1" value={form.maxStores} onChange={e => setField('maxStores', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Max เครื่อง</label>
              <input type="number" min="1" max="100" value={form.maxActivations} onChange={e => setField('maxActivations', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500" />
            </div>
          </div>

          {/* Expiry + Quick presets */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">วันหมดอายุ</label>
            <div className="flex gap-2 mb-2">
              {[{ label: '3 เดือน', days: 90 }, { label: '6 เดือน', days: 180 }, { label: '1 ปี', days: 365 }, { label: '2 ปี', days: 730 }, { label: '3 ปี', days: 1095 }, { label: '10 ปี', days: 3650 }].map(p => (
                <button key={p.days} type="button"
                  onClick={() => setField('expiresAt', getDefaultExpiry(p.days))}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors">
                  {p.label}
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
      </div>
    </div>
  )
}
