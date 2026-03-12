'use client'

import { Lock, PhoneCall, Clock } from 'lucide-react'

interface LicenseLockProps {
  featureName: string
  reason?: 'expired' | 'no_license' | 'grace' | 'trial_expired'
  daysRemaining?: number | null
}

/**
 * Full-page overlay shown when a feature is locked due to expired/missing license.
 * Place inside the page component, rendered conditionally when isExpired/!isValid.
 */
export default function LicenseLock({ featureName, reason = 'expired', daysRemaining }: LicenseLockProps) {
  const isGrace = reason === 'grace'
  const isTrialExpired = reason === 'trial_expired'

  const getMessage = () => {
    switch (reason) {
      case 'grace':
        return `อยู่ในช่วง Grace Period ของการทดลองใช้งาน ฟีเจอร์นี้ถูกปิดชั่วคราว${daysRemaining != null ? ` (เหลือ ${daysRemaining} วัน)` : ''}`
      case 'trial_expired':
        return 'ระยะทดลองใช้งาน 30 วันสิ้นสุดแล้ว กรุณา Activate License เพื่อใช้งานต่อ'
      case 'expired':
        return 'License ของระบบหมดอายุแล้ว ฟีเจอร์นี้ถูกปิดชั่วคราว'
      default:
        return 'ระบบยังไม่ได้ Activate License ฟีเจอร์นี้ยังไม่พร้อมใช้งาน'
    }
  }

  const getSubMessage = () => {
    if (isGrace) return 'Activate License เพื่อปลดล็อกฟีเจอร์ทั้งหมด'
    if (isTrialExpired) return 'ติดต่อผู้ให้บริการเพื่อซื้อ License'
    return 'กรุณาติดต่อผู้ให้บริการเพื่อต่ออายุหรือ Activate License'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className={`p-5 rounded-full mb-5 border ${isGrace ? 'bg-orange-500/10 border-orange-500/30' : 'bg-slate-700/40 border-slate-600'}`}>
        {isGrace ? (
          <Clock className="w-10 h-10 text-orange-400" />
        ) : (
          <Lock className="w-10 h-10 text-amber-400" />
        )}
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">
        {featureName} ไม่พร้อมใช้งาน
      </h2>
      <p className="text-gray-400 max-w-sm mb-1">
        {getMessage()}
      </p>
      <p className="text-gray-500 text-sm mb-6">
        {getSubMessage()}
      </p>
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${isGrace ? 'bg-orange-500/10 border border-orange-500/30 text-orange-300' : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'}`}>
        <PhoneCall className="w-4 h-4 flex-shrink-0" />
        ติดต่อผู้ให้บริการ: Settings → License → Activate License
      </div>
    </div>
  )
}
