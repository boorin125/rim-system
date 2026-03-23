// app/(auth)/login/page.tsx - Login Page
'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface Branding {
  organizationName: string
  logoPath: string
  theme: { bgStart: string; bgEnd: string }
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/dashboard'
  const [isFlipped, setIsFlipped] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [isDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('colorTheme') || 'dark') === 'dark'
    }
    return true
  })
  const [branding, setBranding] = useState<Branding>({
    organizationName: '',
    logoPath: '',
    theme: { bgStart: '#0f172a', bgEnd: '#1e293b' },
  })

  useEffect(() => {
    fetch(`${API_URL}/settings/public/branding`)
      .then((r) => r.json())
      .then((data) => { if (data?.theme) setBranding(data) })
      .catch(() => {})
  }, [])

  // Derive display values
  const appTitle = branding.organizationName
    ? `${branding.organizationName} Incident Management`
    : 'Rubjobb Incident Management'
  const logoUrl = branding.logoPath ? `${API_URL.replace('/api', '')}${branding.logoPath}` : ''

  // Mix hex color with white at given intensity (0-1)
  const hexToLightTint = (hex: string, intensity: number): string => {
    const c = hex.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return `rgb(${Math.round(255-(255-r)*intensity)},${Math.round(255-(255-g)*intensity)},${Math.round(255-(255-b)*intensity)})`
  }

  // Background gradient using theme colors (lighter in light mode)
  const bgStyle = isDark
    ? { background: `linear-gradient(135deg, ${branding.theme.bgStart}, ${branding.theme.bgEnd})` }
    : { background: `linear-gradient(135deg, ${hexToLightTint(branding.theme.bgEnd, 0.28)}, ${hexToLightTint(branding.theme.bgEnd, 0.38)})` }

  // Derive highlight color same as sidebar active menu (hex → HSL @ 42% lightness)
  const getHighlightColor = (hex: string) => {
    const c = hex.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16) / 255
    const g = parseInt(c.substring(2, 4), 16) / 255
    const b = parseInt(c.substring(4, 6), 16) / 255
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (mx + mn) / 2
    if (mx !== mn) {
      const d = mx - mn
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (mx === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    return `hsl(${Math.round(h * 360)}, ${Math.max(Math.round(s * 100), 30)}%, 42%)`
  }
  const highlightColor = getHighlightColor(branding.theme.bgEnd)
  const btnStyle = { backgroundColor: highlightColor }
  const [showPassword, setShowPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isSubmitting = useRef(false)

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })

  // Register form state
  const [registerData, setRegisterData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'END_USER',
  })

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('')

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting.current) return
    isSubmitting.current = true
    setIsLoading(true)

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        loginData
      )

      // Save tokens
      localStorage.setItem('token', response.data.accessToken)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      if (response.data.sessionExpiresAt) {
        localStorage.setItem('sessionExpiresAt', response.data.sessionExpiresAt)
      }

      toast.success('เข้าสู่ระบบสำเร็จ!')

      // Keep button disabled until redirect completes
      router.push(nextUrl)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ')
      setIsLoading(false)
      isSubmitting.current = false
    }
  }

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate passwords match
    if (registerData.password !== registerData.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน')
      return
    }

    // Validate password strength
    if (registerData.password.length < 8) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }

    setIsLoading(true)

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
          email: registerData.email,
          password: registerData.password,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          phone: registerData.phone,
        }
      )

      toast.success('ลงทะเบียนสำเร็จ! รอการอนุมัติจาก IT Manager', {
        duration: 5000,
      })

      // Switch back to login
      setTimeout(() => {
        setIsFlipped(false)
        setRegisterData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          phone: '',
          role: 'END_USER',
        })
      }, 2000)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ลงทะเบียนไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
        email: forgotEmail,
      })

      toast.success('หากอีเมลนี้มีในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล')

      setTimeout(() => {
        setShowForgot(false)
        setForgotEmail('')
      }, 2000)
    } catch (error: any) {
      // Always show success to prevent email enumeration
      toast.success('หากอีเมลนี้มีในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล')

      setTimeout(() => {
        setShowForgot(false)
        setForgotEmail('')
      }, 2000)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 pt-8 pb-4 overflow-y-auto" style={bgStyle}>
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-pattern"></div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        
        {/* Logo & Header */}
        <div className="text-center mb-3">
          <div className="mb-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Organization Logo"
                className="h-16 w-auto mx-auto object-contain"
              />
            ) : (
              <>
                <h1 className="logo-rim">RIM</h1>
                <p className="logo-system">System</p>
              </>
            )}
          </div>
          <p className={`text-lg font-light ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{appTitle}</p>
        </div>

        {/* Flip Container */}
        <div
          className={`flip-container ${isFlipped ? 'flipped' : ''} ${
            showForgot ? 'show-forgot' : ''
          }`}
        >
          <div className="flipper">
            
            {/* FRONT: Login Form */}
            <div className="flip-front">
              <div className="glass-card rounded-2xl p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    เข้าสู่ระบบ
                  </h2>
                  <p className="text-gray-400 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    ยินดีต้อนรับกลับ กรุณากรอกข้อมูลเพื่อเข้าใช้งาน
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      อีเมล
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={loginData.email}
                        onChange={(e) =>
                          setLoginData({ ...loginData, email: e.target.value })
                        }
                        placeholder="your.email@example.com"
                        autoComplete="email"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      รหัสผ่าน
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginData.password}
                        onChange={(e) =>
                          setLoginData({ ...loginData, password: e.target.value })
                        }
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-12 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-sm text-white/80 hover:text-white transition duration-200"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={btnStyle}
                    className="w-full py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'เข้าสู่ระบบ'
                    )}
                  </button>

                  {/* Register Link */}
                  <div className="text-center pt-4 border-t border-gray-700/50">
                    <p className="text-gray-400">
                      ยังไม่มีบัญชี?{' '}
                      <button
                        type="button"
                        onClick={() => setIsFlipped(true)}
                        className="font-medium text-white hover:text-white/70 transition duration-200"
                      >
                        สมัครสมาชิก
                      </button>
                    </p>
                  </div>


                </form>
              </div>
            </div>

            {/* BACK: Register Form */}
            <div className="flip-back">
              <div className="glass-card rounded-2xl p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    สมัครสมาชิก
                  </h2>
                  <p className="text-gray-400">
                    สร้างบัญชีใหม่เพื่อเข้าใช้งานระบบ
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Name Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        ชื่อ
                      </label>
                      <input
                        type="text"
                        value={registerData.firstName}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            firstName: e.target.value,
                          })
                        }
                        placeholder="ชื่อ"
                        autoComplete="given-name"
                        className="w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        นามสกุล
                      </label>
                      <input
                        type="text"
                        value={registerData.lastName}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            lastName: e.target.value,
                          })
                        }
                        placeholder="นามสกุล"
                        autoComplete="family-name"
                        className="w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      อีเมล
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={registerData.email}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            email: e.target.value,
                          })
                        }
                        placeholder="your.email@example.com"
                        autoComplete="email"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      เบอร์โทรศัพท์
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={registerData.phone}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            phone: e.target.value,
                          })
                        }
                        placeholder="081-234-5678"
                        autoComplete="tel"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      รหัสผ่าน
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={registerData.password}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            password: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-12 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      ยืนยันรหัสผ่าน
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={registerData.confirmPassword}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            confirmPassword: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-12 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Register Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={btnStyle}
                    className="w-full py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'สมัครสมาชิก'
                    )}
                  </button>

                  {/* Back to Login */}
                  <div className="text-center pt-4 border-t border-gray-700/50">
                    <p className="text-gray-400">
                      มีบัญชีอยู่แล้ว?{' '}
                      <button
                        type="button"
                        onClick={() => setIsFlipped(false)}
                        className="font-medium text-white hover:text-white/70 transition duration-200"
                      >
                        เข้าสู่ระบบ
                      </button>
                    </p>
                  </div>
                </form>
              </div>
            </div>

            {/* FORGOT: Forgot Password Form */}
            <div className="flip-forgot">
              <div className="glass-card rounded-2xl p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    ลืมรหัสผ่าน
                  </h2>
                  <p className="text-gray-400">
                    กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      อีเมล
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    style={btnStyle}
                    className="w-full py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition duration-200"
                  >
                    ส่งลิงก์รีเซ็ตรหัสผ่าน
                  </button>

                  {/* Back to Login */}
                  <div className="text-center pt-4 border-t border-gray-700/50">
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className="font-medium text-white hover:text-white/70 transition duration-200"
                    >
                      ← กลับสู่หน้าเข้าสู่ระบบ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
