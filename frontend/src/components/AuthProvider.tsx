// components/AuthProvider.tsx - Setup axios interceptor for auto refresh token
'use client'

import { useEffect, useRef, useCallback } from 'react'
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useRouter, usePathname } from 'next/navigation'
import toast from 'react-hot-toast'

// Flag to prevent multiple refresh requests
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Public paths that don't require authentication
const publicPaths = [
  '/login', '/register', '/forgot-password', '/reset-password',
  '/rate/',           // Public rating page
  '/service-report/', // Public service report
  '/incident/',       // Public incident view
  '/inventory-sign/', // Public inventory sign
  '/pm-report/',      // Public PM report
]

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const interceptorsSet = useRef(false)
  const logoutShown = useRef(false)

  // Handle logout - clear storage and redirect
  const handleLogout = useCallback((reason?: string) => {
    // Prevent multiple logout toasts
    if (logoutShown.current) return
    logoutShown.current = true

    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('sessionExpiresAt')

    // Only redirect and show message if we're in browser and not already on public page
    if (typeof window !== 'undefined' && !publicPaths.some(p => window.location.pathname.includes(p))) {
      toast.error(reason || 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่')
      router.push('/login')
    }

    // Reset flag after a delay
    setTimeout(() => {
      logoutShown.current = false
    }, 3000)
  }, [router])

  useEffect(() => {
    // Only set up interceptors once
    if (interceptorsSet.current) return
    interceptorsSet.current = true

    // Request interceptor - add token to headers
    const requestInterceptor = axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token')
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor - handle 401 and refresh token
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          // Don't retry for login/register/refresh endpoints
          if (
            originalRequest.url?.includes('/auth/login') ||
            originalRequest.url?.includes('/auth/register') ||
            originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/forgot-password') ||
            originalRequest.url?.includes('/auth/reset-password')
          ) {
            return Promise.reject(error)
          }

          if (isRefreshing) {
            // Wait for the refresh to complete
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject })
            })
              .then((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`
                }
                return axios(originalRequest)
              })
              .catch((err) => Promise.reject(err))
          }

          originalRequest._retry = true
          isRefreshing = true

          const refreshToken = localStorage.getItem('refreshToken')

          if (!refreshToken) {
            // No refresh token, redirect to login
            isRefreshing = false
            handleLogout()
            return Promise.reject(error)
          }

          try {
            const response = await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
              { refreshToken },
              {
                // Don't use interceptor for this request
                headers: { 'Content-Type': 'application/json' }
              }
            )

            const { accessToken, refreshToken: newRefreshToken, sessionExpiresAt, user } = response.data

            // Save new tokens
            localStorage.setItem('token', accessToken)
            localStorage.setItem('refreshToken', newRefreshToken)
            localStorage.setItem('user', JSON.stringify(user))
            if (sessionExpiresAt) {
              localStorage.setItem('sessionExpiresAt', sessionExpiresAt)
            }

            // Update authorization header
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
            }

            processQueue(null, accessToken)

            return axios(originalRequest)
          } catch (refreshError: any) {
            processQueue(refreshError as AxiosError, null)
            const msg = refreshError?.response?.data?.message
            if (msg === 'SESSION_REVOKED') {
              handleLogout('มีการเข้าสู่ระบบจาก Device อื่น กรุณาเข้าสู่ระบบใหม่')
            } else {
              handleLogout()
            }
            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        }

        return Promise.reject(error)
      }
    )

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor)
      axios.interceptors.response.eject(responseInterceptor)
      interceptorsSet.current = false
    }
  }, [handleLogout])

  // Check token validity periodically
  useEffect(() => {
    // Skip for public pages
    if (publicPaths.some(p => pathname?.includes(p))) return

    const checkTokenValidity = () => {
      const token = localStorage.getItem('token')
      const refreshToken = localStorage.getItem('refreshToken')

      // If no tokens at all, redirect to login
      if (!token && !refreshToken) {
        handleLogout()
        return
      }

      // Check session expiry (refresh token expiry)
      const sessionExpiresAt = localStorage.getItem('sessionExpiresAt')
      if (sessionExpiresAt) {
        const expiresAt = new Date(sessionExpiresAt)
        const now = new Date()
        const msLeft = expiresAt.getTime() - now.getTime()
        const minLeft = msLeft / 60000

        if (msLeft <= 0) {
          // Session expired — force logout immediately, no warning
          handleLogout('Session หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่')
        }
      }
    }

    // Check immediately
    checkTokenValidity()

    // Check every minute
    const interval = setInterval(checkTokenValidity, 60000)

    return () => clearInterval(interval)
  }, [pathname, handleLogout])

  return <>{children}</>
}
