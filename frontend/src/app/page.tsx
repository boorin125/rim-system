// app/page.tsx - Root Page (Redirect to Login)
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in (จะเพิ่ม auth check ภายหลัง)
    const token = localStorage.getItem('token')
    
    if (token) {
      // Redirect to dashboard if logged in
      router.push('/dashboard')
    } else {
      // Redirect to login if not logged in
      router.push('/login')
    }
  }, [router])

  // Loading screen while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4"></div>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}
