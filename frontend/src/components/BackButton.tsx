// components/BackButton.tsx - Reusable Back Button Component
'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  href?: string     // when provided, navigates to this URL instead of router.back()
  label?: string    // kept for API compatibility
  className?: string
}

export default function BackButton({ href, className = '' }: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      className={`
        inline-flex items-center justify-center p-3
        bg-slate-700/50 hover:bg-slate-600/70
        text-gray-200 hover:text-white
        border border-slate-600/50 hover:border-slate-500/50
        rounded-xl transition-all duration-200
        shadow-lg hover:shadow-xl
        ${className}
      `}
      title="กลับไปก่อนหน้า"
    >
      <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
    </button>
  )
}
