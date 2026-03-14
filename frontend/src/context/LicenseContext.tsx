'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import axios from 'axios'

interface LicenseState {
  loading: boolean
  isValid: boolean
  isExpired: boolean
  hasLicense: boolean
  daysRemaining: number | null
  licenseType: string | null
  organizationName: string | null
  expiresAt: string | null
  // Trial-specific
  isTrialFull: boolean       // Day 1–7: full access, banner only
  isTrialGrace: boolean      // Day 8–30: Level 1 features blocked
  isTrialExpired: boolean    // Day 31+: trial fully over
  trialDaysRemaining: number | null
  refresh: () => void
}

const LicenseContext = createContext<LicenseState>({
  loading: true,
  isValid: false,
  isExpired: false,
  hasLicense: false,
  daysRemaining: null,
  licenseType: null,
  organizationName: null,
  expiresAt: null,
  isTrialFull: false,
  isTrialGrace: false,
  isTrialExpired: false,
  trialDaysRemaining: null,
  refresh: () => {},
})

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [hasLicense, setHasLicense] = useState(false)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [licenseType, setLicenseType] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isTrialFull, setIsTrialFull] = useState(false)
  const [isTrialGrace, setIsTrialGrace] = useState(false)
  const [isTrialExpired, setIsTrialExpired] = useState(false)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null)

  const fetchLicense = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/license/current`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      })
      const data = res.data

      const trialPhase = data.trialPhase ?? null
      const isTrial = data.license?.licenseType === 'TRIAL' || trialPhase !== null

      setHasLicense(!!data.hasLicense)
      setIsValid(!!data.valid)
      setDaysRemaining(data.daysRemaining ?? null)
      setLicenseType(data.license?.licenseType ?? null)
      setOrganizationName(data.license?.organizationName ?? null)
      setExpiresAt(data.license?.expiresAt ?? null)

      // Trial states
      setIsTrialFull(trialPhase === 'FULL')
      setIsTrialGrace(trialPhase === 'GRACE')
      setIsTrialExpired(trialPhase === 'EXPIRED')
      setTrialDaysRemaining(isTrial ? (data.trialDaysRemaining ?? null) : null)

      // isExpired: true when license/trial is blocking (grace, expired, trial_expired)
      const blockingReason = ['EXPIRED', 'TRIAL_EXPIRED', 'GRACE_PERIOD']
      setIsExpired(
        !data.valid && !!data.hasLicense && blockingReason.includes(data.reason)
      )
    } catch {
      // If API is unreachable, don't block — treat as valid
      setIsValid(true)
      setHasLicense(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLicense()
    // Re-check every 5 minutes
    const interval = setInterval(fetchLicense, 5 * 60 * 1000)
    // Re-fetch when user comes back to the tab (important for mobile)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchLicense()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchLicense])

  return (
    <LicenseContext.Provider value={{
      loading, isValid, isExpired, hasLicense,
      daysRemaining, licenseType, organizationName, expiresAt,
      isTrialFull, isTrialGrace, isTrialExpired, trialDaysRemaining,
      refresh: fetchLicense,
    }}>
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  return useContext(LicenseContext)
}
