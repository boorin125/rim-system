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

interface LicenseCache {
  hasLicense: boolean
  isValid: boolean
  isExpired: boolean
  isTrialFull: boolean
  isTrialGrace: boolean
  isTrialExpired: boolean
  daysRemaining: number | null
  licenseType: string | null
  organizationName: string | null
  expiresAt: string | null
  trialDaysRemaining: number | null
  cachedAt: number
}

const CACHE_KEY = 'licenseCache'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function readCache(): LicenseCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: LicenseCache = JSON.parse(raw)
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeCache(state: Omit<LicenseCache, 'cachedAt'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...state, cachedAt: Date.now() }))
  } catch { /* ignore quota errors */ }
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
  // Initialise from localStorage cache to avoid flash on hard refresh
  const cached = readCache()

  const [loading, setLoading] = useState(!cached)          // false if cache hit
  const [isValid, setIsValid] = useState(cached?.isValid ?? false)
  const [isExpired, setIsExpired] = useState(cached?.isExpired ?? false)
  const [hasLicense, setHasLicense] = useState(cached?.hasLicense ?? false)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(cached?.daysRemaining ?? null)
  const [licenseType, setLicenseType] = useState<string | null>(cached?.licenseType ?? null)
  const [organizationName, setOrganizationName] = useState<string | null>(cached?.organizationName ?? null)
  const [expiresAt, setExpiresAt] = useState<string | null>(cached?.expiresAt ?? null)
  const [isTrialFull, setIsTrialFull] = useState(cached?.isTrialFull ?? false)
  const [isTrialGrace, setIsTrialGrace] = useState(cached?.isTrialGrace ?? false)
  const [isTrialExpired, setIsTrialExpired] = useState(cached?.isTrialExpired ?? false)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(cached?.trialDaysRemaining ?? null)

  const fetchLicense = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/license/current`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      })
      const data = res.data

      const trialPhase = data.trialPhase ?? null
      const isTrial = data.license?.licenseType === 'TRIAL' || trialPhase !== null

      const nextHasLicense = !!data.hasLicense
      const nextIsValid = !!data.valid
      const nextDaysRemaining = data.daysRemaining ?? null
      const nextLicenseType = data.license?.licenseType ?? null
      const nextOrgName = data.license?.organizationName ?? null
      const nextExpiresAt = data.license?.expiresAt ?? null
      const nextIsTrialFull = trialPhase === 'FULL'
      const nextIsTrialGrace = trialPhase === 'GRACE'
      const nextIsTrialExpired = trialPhase === 'EXPIRED'
      const nextTrialDaysRemaining = isTrial ? (data.trialDaysRemaining ?? null) : null
      const blockingReason = ['EXPIRED', 'TRIAL_EXPIRED', 'GRACE_PERIOD']
      const nextIsExpired = !data.valid && !!data.hasLicense && blockingReason.includes(data.reason)

      setHasLicense(nextHasLicense)
      setIsValid(nextIsValid)
      setDaysRemaining(nextDaysRemaining)
      setLicenseType(nextLicenseType)
      setOrganizationName(nextOrgName)
      setExpiresAt(nextExpiresAt)
      setIsTrialFull(nextIsTrialFull)
      setIsTrialGrace(nextIsTrialGrace)
      setIsTrialExpired(nextIsTrialExpired)
      setTrialDaysRemaining(nextTrialDaysRemaining)
      setIsExpired(nextIsExpired)

      // Persist to localStorage so next hard-refresh skips the loading flash
      writeCache({
        hasLicense: nextHasLicense,
        isValid: nextIsValid,
        isExpired: nextIsExpired,
        isTrialFull: nextIsTrialFull,
        isTrialGrace: nextIsTrialGrace,
        isTrialExpired: nextIsTrialExpired,
        daysRemaining: nextDaysRemaining,
        licenseType: nextLicenseType,
        organizationName: nextOrgName,
        expiresAt: nextExpiresAt,
        trialDaysRemaining: nextTrialDaysRemaining,
      })
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
