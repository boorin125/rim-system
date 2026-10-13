// frontend/src/components/MultiSearchSelect.tsx
// Searchable multi-select dropdown (checkboxes). Empty selection = "All".

'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  options: string[]
  placeholder: string            // shown when nothing is selected, e.g. "All Category"
  className?: string
  buttonClassName?: string       // override trigger styling to match the page
}

export default function MultiSearchSelect({ value, onChange, options, placeholder, className = '', buttonClassName }: Props) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  const selectAllShown = () => onChange(Array.from(new Set([...value, ...filtered])))

  const label =
    value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} รายการที่เลือก`

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setIsOpen((o) => !o); setSearch('') }}
        title={value.length > 1 ? value.join(', ') : undefined}
        className={
          buttonClassName ??
          'w-full flex items-center justify-between px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left'
        }
      >
        <span className={`truncate ${value.length > 0 ? 'text-white' : 'text-gray-400 text-sm'}`}>{label}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value.length > 0 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange([]) }}
              className="p-0.5 hover:bg-slate-600 rounded"
              title="ล้างตัวกรอง"
            >
              <X className="w-3 h-3 text-gray-400" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 text-xs">
            <button type="button" onClick={selectAllShown} className="text-blue-400 hover:text-blue-300">
              เลือกทั้งหมด{search ? 'ที่แสดง' : ''}
            </button>
            <button type="button" onClick={() => onChange([])} className="text-gray-400 hover:text-white">
              ล้าง ({placeholder})
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((opt) => {
              const checked = value.includes(opt)
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-700 transition-colors"
                >
                  <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={checked ? 'text-white font-medium' : 'text-gray-300'}>{opt}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="px-4 py-2 text-sm text-gray-500">No results</div>}
          </div>
        </div>
      )}
    </div>
  )
}
