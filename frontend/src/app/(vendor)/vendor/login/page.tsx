'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'

export default function VendorLoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secret.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/vendor/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vendor-secret': secret.trim(),
        },
      })

      if (res.ok) {
        sessionStorage.setItem('vendor_secret', secret.trim())
        router.push('/vendor/licenses')
      } else {
        setError('Vendor Secret ไม่ถูกต้อง')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อ Server ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600/20 border border-purple-500/30 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">RIM Vendor Portal</h1>
          <p className="text-gray-400 text-sm mt-1">License Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Vendor Secret Key</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="กรอก Vendor Secret"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !secret.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-4">
          สำหรับผู้พัฒนาระบบเท่านั้น
        </p>
      </div>
    </div>
  )
}
