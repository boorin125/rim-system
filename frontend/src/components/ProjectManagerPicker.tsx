'use client'

// Project Manager picker — a project can have several managers (chips + search dropdown)

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { getPhotoUrl } from '@/utils/photoUtils'

export interface PickerUser {
  id: number
  firstName?: string
  lastName?: string
  username?: string
  avatarPath?: string | null
}

function Avatar({ u, size }: { u: PickerUser; size: string }) {
  return u.avatarPath ? (
    <img src={getPhotoUrl(u.avatarPath)} className={`${size} rounded-full object-cover shrink-0`} alt="" />
  ) : (
    <div className={`${size} rounded-full bg-slate-600 flex items-center justify-center text-[10px] text-gray-200 shrink-0 font-medium`}>
      {u.firstName?.charAt(0) ?? '?'}
    </div>
  )
}

export default function ProjectManagerPicker({
  users,
  value,
  onChange,
}: {
  users: PickerUser[]
  value: PickerUser[]
  onChange: (next: PickerUser[]) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedIds = new Set(value.map(u => u.id))
  const q = search.toLowerCase()
  const options = users.filter(u =>
    !selectedIds.has(u.id) &&
    (`${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)),
  )

  return (
    <div ref={ref} className="relative space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map(u => (
            <span key={u.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-slate-700/60 border border-slate-600 rounded-full">
              <Avatar u={u} size="w-5 h-5" />
              <span className="text-xs text-white">{u.firstName} {u.lastName}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter(v => v.id !== u.id))}
                className="text-gray-400 hover:text-white transition-colors"
                title="เอาออก"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={value.length ? 'เพิ่ม Project Manager อีกคน...' : 'ค้นหาชื่อ User...'}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">ไม่พบ User</div>
          ) : (
            options.slice(0, 30).map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => { onChange([...value, u]); setSearch(''); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/70 transition-colors text-left"
              >
                <Avatar u={u} size="w-7 h-7" />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
