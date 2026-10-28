// app/(auth)/login/page.tsx - Login Page
'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Phone, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { hasMenuAccess, menuPermissions } from '@/config/permissions'
import GoogleIcon from '@/components/GoogleIcon'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface Branding {
  organizationName: string
  logoPath: string
  theme: { bgStart: string; bgEnd: string }
  googleEnabled?: boolean
}

// Result of the Google sign-in round trip (backend auth/google/callback → /login?google=…)
const GOOGLE_MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  pending: { text: 'ส่งคำขอใช้งานด้วยบัญชี Google แล้ว — รอ IT Manager อนุมัติก่อนเข้าใช้งาน', ok: true },
  inactive: { text: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
  locked: { text: 'บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง' },
  cancelled: { text: 'ยกเลิกการเข้าสู่ระบบด้วย Google' },
  retry: { text: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' },
  error: { text: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' },
  not_configured: { text: 'Server นี้ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Google' },
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
  const [brandingLoaded, setBrandingLoaded] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  // The three cards are stacked (absolute) for the flip — the stage takes the height of the card on show
  // only, so the hidden (taller) register card no longer makes the login / forgot screens scroll
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const forgotRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState<number | undefined>(undefined)
  useEffect(() => {
    const el = (showForgot ? forgotRef : isFlipped ? backRef : frontRef).current
    if (!el) return
    const update = () => setCardH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isFlipped, showForgot])

  useEffect(() => {
    fetch(`${API_URL}/system/version`)
      .then((r) => r.json())
      .then((data) => { if (data?.version) setAppVersion(data.version) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // Check if first-time setup is needed
    fetch(`${API_URL}/setup/status`)
      .then((r) => r.json())
      .then((data) => { if (data?.needsSetup) router.replace('/setup') })
      .catch(() => {})

    fetch(`${API_URL}/settings/public/branding`)
      .then((r) => r.json())
      .then((data) => { if (data?.theme) setBranding(data) })
      .catch(() => {})
      .finally(() => setBrandingLoaded(true))
  }, [router])

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
    : { background: `linear-gradient(135deg, ${hexToLightTint(branding.theme.bgEnd, 0.08)}, ${hexToLightTint(branding.theme.bgEnd, 0.14)})` }

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
  // In light mode, use lighter button (55% lightness instead of 42%)
  const btnStyle = { backgroundColor: 'var(--theme-highlight)' }
  const [showPassword, setShowPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
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

  // Back from Google: ?gcode=… (one-time, ~1 min) → tokens; ?google=… → explain what happened
  const [googleBusy, setGoogleBusy] = useState(false)
  const googleHandled = useRef(false)
  useEffect(() => {
    if (googleHandled.current) return
    const gcode = searchParams.get('gcode')
    const result = searchParams.get('google')
    if (!gcode && !result) return
    googleHandled.current = true
    // drop the code / result from the address bar (and history)
    window.history.replaceState(null, '', '/login')
    if (gcode) {
      setGoogleBusy(true)
      axios.post(`${API_URL}/auth/google/exchange`, { code: gcode })
        .then((res) => completeLogin(res.data))
        .catch((err) => {
          toast.error(err.response?.data?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
          setGoogleBusy(false)
        })
      return
    }
    // The installed app on Android can get Google's answer twice — the other one may have signed in already
    if (result === 'retry' && localStorage.getItem('token')) {
      router.replace('/dashboard')
      return
    }
    const msg = GOOGLE_MESSAGES[result!] || GOOGLE_MESSAGES.error
    if (msg.ok) toast.success(msg.text, { duration: 6000 })
    else toast.error(msg.text, { duration: 6000 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const startGoogle = () => {
    setGoogleBusy(true)
    window.location.href = `${API_URL}/auth/google/start`
  }

  // Store the session (password or Google sign-in) and go to the page asked for
  const completeLogin = (data: any) => {
    // Save tokens — clear old sessionExpiresAt first so stale expiry
    // from a previous session never triggers an immediate logout
    localStorage.setItem('token', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.removeItem('sessionExpiresAt')
    if (data.sessionExpiresAt) {
      localStorage.setItem('sessionExpiresAt', data.sessionExpiresAt)
    }

    toast.success('เข้าสู่ระบบสำเร็จ!')

    // Validate nextUrl against user's role — if it's a known restricted page the user
    // can't access (e.g. IT_MANAGER landing on /dashboard/settings), fall back to /dashboard
    const pathOnly = nextUrl.split('?')[0]
    const isKnownMenu = pathOnly in menuPermissions
    const canAccess = !isKnownMenu || hasMenuAccess(data.user, pathOnly)
    router.push(canAccess ? nextUrl : '/dashboard')
  }

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
      completeLogin(response.data)
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

    if (!agreedToTerms) {
      toast.error('กรุณายอมรับข้อตกลงการใช้งานก่อนสมัครสมาชิก')
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
        setAgreedToTerms(false)
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
      const msg = error.response?.data?.message
      if (error.response?.status === 500 && msg) {
        toast.error(msg)
      } else {
        toast.success('หากอีเมลนี้มีในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล')
        setTimeout(() => {
          setShowForgot(false)
          setForgotEmail('')
        }, 2000)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // Full screen, no page scroll: the form area only scrolls when it can't fit (on-screen keyboard, tiny phones)
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={bgStyle}>
      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowTermsModal(false)} />
          <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">ข้อตกลงการใช้งาน</h2>
              </div>
              <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 text-sm text-gray-300 space-y-4 leading-relaxed">
              <p className="text-gray-400 text-xs">มีผลบังคับใช้ตั้งแต่วันที่สมัครใช้งาน</p>

              <section>
                <h3 className="text-white font-semibold mb-1">1. การยอมรับข้อตกลง</h3>
                <p>การสมัครและใช้งานระบบ Rubjobb Incident Management (RIM) ถือว่าผู้ใช้งานได้อ่าน เข้าใจ และยอมรับข้อตกลงการใช้งานฉบับนี้ทุกประการ หากไม่ยอมรับข้อตกลงนี้ กรุณางดใช้งานระบบ</p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-1">2. ขอบเขตการใช้งาน</h3>
                <p>ระบบนี้จัดทำขึ้นเพื่อการบริหารจัดการงานแจ้งซ่อมและติดตามสถานะงานภายในองค์กรเท่านั้น ผู้ใช้งานต้องไม่นำระบบไปใช้ในทางที่ผิดกฎหมาย หรือก่อให้เกิดความเสียหายต่อองค์กรและบุคคลอื่น</p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-1">3. ข้อมูลส่วนบุคคล</h3>
                <p>ระบบจะเก็บรวบรวมข้อมูลส่วนบุคคล ได้แก่ ชื่อ-นามสกุล อีเมล เบอร์โทรศัพท์ และข้อมูลที่เกี่ยวข้องกับการปฏิบัติงาน เพื่อวัตถุประสงค์ในการบริหารจัดการงานภายในองค์กรเท่านั้น โดยจะไม่มีการเปิดเผยข้อมูลแก่บุคคลภายนอกโดยไม่ได้รับอนุญาต</p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-1">4. ความรับผิดชอบของผู้ใช้งาน</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>รักษาข้อมูล Username และ Password ไว้เป็นความลับ</li>
                  <li>ไม่อนุญาตให้บุคคลอื่นใช้บัญชีของตน</li>
                  <li>รายงานข้อมูลและสถานะงานตามความเป็นจริง</li>
                  <li>แจ้งผู้ดูแลระบบทันทีหากพบความผิดปกติหรือการละเมิดความปลอดภัย</li>
                </ul>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-1">5. การระงับบัญชี</h3>
                <p>ผู้ดูแลระบบสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้งานที่ฝ่าฝืนข้อตกลงนี้ หรือกระทำการที่เป็นภัยต่อระบบและองค์กร โดยไม่จำเป็นต้องแจ้งให้ทราบล่วงหน้า</p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-1">6. การเปลี่ยนแปลงข้อตกลง</h3>
                <p>องค์กรขอสงวนสิทธิ์ในการปรับปรุงข้อตกลงการใช้งานนี้ได้ตามความเหมาะสม การใช้งานระบบต่อเนื่องหลังจากมีการเปลี่ยนแปลงถือว่าผู้ใช้งานยอมรับข้อตกลงฉบับใหม่แล้ว</p>
              </section>
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => { setAgreedToTerms(true); setShowTermsModal(false) }}
                style={btnStyle}
                className="flex-1 py-2.5 text-white font-medium rounded-lg hover:opacity-90 transition"
              >
                ยอมรับข้อตกลง
              </button>
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2.5 text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition font-medium"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Pattern */}
      <div className="fixed inset-0 bg-pattern pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex px-4 py-3 sm:py-6">
      <div className="w-full max-w-md m-auto animate-fade-in">

        {/* Logo & Header */}
        {/* Register is the tallest card — on phones it gets a smaller logo and no title line */}
        <div className="text-center mb-2 sm:mb-3">
          <div className={`mb-1 sm:mb-2 ${isFlipped ? 'h-10' : 'h-14'} sm:h-20 flex items-center justify-center`}>
            <img
              src={logoUrl || '/logo.png'}
              alt="Organization Logo"
              className={`${isFlipped ? 'h-10' : 'h-14'} sm:h-20 w-auto mx-auto object-contain rounded-xl transition-opacity duration-300 ${brandingLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
          <p className={`${isFlipped ? 'hidden sm:block' : ''} text-base sm:text-lg font-light ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{appTitle}</p>
        </div>

        {/* Flip Container — as tall as the card on show; hidden cards are clipped */}
        <div
          className={`flip-container overflow-hidden transition-[height] duration-300 ${isFlipped ? 'flipped' : ''} ${
            showForgot ? 'show-forgot' : ''
          }`}
          style={{ height: cardH }}
        >
          <div className="flipper">

            {/* FRONT: Login Form */}
            <div className="flip-front" ref={frontRef}>
              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-3 sm:mb-4">
                  <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1 sm:mb-2">
                    เข้าสู่ระบบ
                  </h2>
                  <p className="text-gray-400 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    ยินดีต้อนรับกลับ กรุณากรอกข้อมูลเพื่อเข้าใช้งาน
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        autoComplete="off"
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full pl-10 pr-12 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
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
                      className={`text-sm transition duration-200 ${isDark ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={btnStyle}
                    className="w-full py-2.5 sm:py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'เข้าสู่ระบบ'
                    )}
                  </button>

                  {/* Google — signs in, links an existing account with the same email, or requests a new one */}
                  {branding.googleEnabled && (
                    <button
                      type="button"
                      onClick={startGoogle}
                      disabled={googleBusy}
                      className="w-full py-2.5 sm:py-3 px-4 flex items-center justify-center gap-2.5 rounded-lg bg-white text-slate-700 font-medium hover:bg-slate-100 transition duration-200 disabled:opacity-60"
                    >
                      {googleBusy
                        ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        : <GoogleIcon />}
                      เข้าสู่ระบบด้วย Google
                    </button>
                  )}

                  {/* Register Link */}
                  <div className={`text-center pt-3 sm:pt-4 border-t ${isDark ? 'border-gray-700/50' : 'border-slate-300/70'}`}>
                    <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>
                      ยังไม่มีบัญชี?{' '}
                      <button
                        type="button"
                        onClick={() => setIsFlipped(true)}
                        className={`font-medium transition duration-200 ${isDark ? 'text-white hover:text-white/70' : 'hover:opacity-70'}`}
                        style={isDark ? {} : { color: btnStyle.backgroundColor }}
                      >
                        สมัครสมาชิก
                      </button>
                    </p>
                  </div>


                </form>
              </div>
            </div>

            {/* BACK: Register Form */}
            <div className="flip-back" ref={backRef}>
              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-3 sm:mb-4">
                  {/* Google sits on the title row — the register card has to fit one phone screen */}
                  <div className="flex items-center justify-between gap-2 mb-1 sm:mb-2">
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">
                      สมัครสมาชิก
                    </h2>
                    {branding.googleEnabled && (
                      <button
                        type="button"
                        onClick={startGoogle}
                        disabled={googleBusy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-100 transition disabled:opacity-60 shrink-0"
                      >
                        <GoogleIcon className="w-4 h-4" /> สมัครด้วย Google
                      </button>
                    )}
                  </div>
                  <p className="hidden sm:block text-gray-400 text-sm">
                    สร้างบัญชีใหม่เพื่อเข้าใช้งานระบบ
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-2.5 sm:space-y-4">
                  {/* Name Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full px-4 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full px-4 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        autoComplete="off"
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      />
                    </div>
                  </div>

                  {/* Password + confirm side by side (keeps the register card one screen tall on phones) */}
                  <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full pl-10 pr-12 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
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
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full pl-10 pr-12 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
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
                  </div>

                  {/* Terms of Service Checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="agreeTerms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 accent-blue-500 cursor-pointer flex-shrink-0"
                    />
                    <label htmlFor="agreeTerms" className="text-sm text-gray-400 leading-snug cursor-pointer select-none">
                      ฉันได้อ่านและยอมรับ{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium"
                      >
                        ข้อตกลงการใช้งาน
                      </button>
                      {' '}ของระบบ
                    </label>
                  </div>

                  {/* Register Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !agreedToTerms}
                    style={agreedToTerms ? btnStyle : {}}
                    className="w-full py-2.5 sm:py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'สมัครสมาชิก'
                    )}
                  </button>

                  {/* Back to Login */}
                  <div className={`text-center pt-3 sm:pt-4 border-t ${isDark ? 'border-gray-700/50' : 'border-slate-300/70'}`}>
                    <p className={isDark ? 'text-gray-400' : 'text-slate-500'}>
                      มีบัญชีอยู่แล้ว?{' '}
                      <button
                        type="button"
                        onClick={() => setIsFlipped(false)}
                        className={`font-medium transition duration-200 ${isDark ? 'text-white hover:text-white/70' : 'hover:opacity-70'}`}
                        style={isDark ? {} : { color: btnStyle.backgroundColor }}
                      >
                        เข้าสู่ระบบ
                      </button>
                    </p>
                  </div>
                </form>
              </div>
            </div>

            {/* FORGOT: Forgot Password Form */}
            <div className="flip-forgot" ref={forgotRef}>
              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <div className="mb-3 sm:mb-4">
                  <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1 sm:mb-2">
                    ลืมรหัสผ่าน
                  </h2>
                  <p className="text-gray-400 text-sm">
                    กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-3 sm:space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 sm:mb-2">
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
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    style={btnStyle}
                    className="w-full py-2.5 sm:py-3 px-4 text-white font-medium rounded-lg hover:opacity-90 transition duration-200"
                  >
                    ส่งลิงก์รีเซ็ตรหัสผ่าน
                  </button>

                  {/* Back to Login */}
                  <div className={`text-center pt-3 sm:pt-4 border-t ${isDark ? 'border-gray-700/50' : 'border-slate-300/70'}`}>
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className={`font-medium transition duration-200 ${isDark ? 'text-white hover:text-white/70' : 'hover:opacity-70'}`}
                      style={isDark ? {} : { color: btnStyle.backgroundColor }}
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

      {/* Version */}
      <p
        className={`relative z-10 shrink-0 text-center text-[11px] pt-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {appVersion ? `Version ${appVersion}` : ' '}
      </p>
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
