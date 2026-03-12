// frontend/src/components/StoreAutocomplete.tsx
// Autocomplete component for store selection

import { formatStore } from '@/utils/formatStore'
import { useState, useEffect, useRef } from 'react'
import { Search, X, Building2, MapPin, ChevronDown } from 'lucide-react'

interface Store {
  id: number
  storeCode: string
  name: string
  province?: string
}

interface StoreAutocompleteProps {
  stores: Store[]
  value: string // storeId as string
  onChange: (storeId: string) => void
  error?: string
  placeholder?: string
  disabled?: boolean
}

export default function StoreAutocomplete({
  stores,
  value,
  onChange,
  error,
  placeholder = 'พิมพ์เพื่อค้นหาสาขา...',
  disabled = false,
}: StoreAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get selected store display text
  const selectedStore = stores.find((s) => s.id.toString() === value)
  const displayValue = selectedStore ? formatStore(selectedStore) : ''

  // Filter stores based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStores(stores.slice(0, 50)) // Show first 50 when no search
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = stores.filter(
      (store) =>
        store.storeCode.toLowerCase().includes(term) ||
        store.name.toLowerCase().includes(term) ||
        (store.province && store.province.toLowerCase().includes(term))
    )
    setFilteredStores(filtered.slice(0, 50)) // Limit to 50 results
  }, [searchTerm, stores])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true)
      setFilteredStores(stores.slice(0, 50))
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleSelectStore = (store: Store) => {
    onChange(store.id.toString())
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={value ? displayValue : placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-20 py-2 bg-slate-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-red-500' : 'border-slate-600'
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-white" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            disabled={disabled}
          >
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filteredStores.length === 0 ? (
            <div className="px-4 py-3 text-gray-400 text-sm text-center">
              ไม่พบสาขาที่ค้นหา
            </div>
          ) : (
            <ul className="py-1">
              {filteredStores.map((store) => (
                <li key={store.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectStore(store)}
                    className={`w-full px-4 py-2 text-left hover:bg-slate-700 transition-colors flex items-start gap-3 ${
                      store.id.toString() === value
                        ? 'bg-blue-600/20 border-l-2 border-blue-500'
                        : ''
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white truncate">{formatStore(store)}</span>
                      </div>
                      {store.province && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {store.province}
                        </div>
                      )}
                    </div>
                    {store.id.toString() === value && (
                      <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                        เลือกแล้ว
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filteredStores.length >= 50 && (
            <div className="px-4 py-2 text-xs text-gray-500 text-center border-t border-slate-700">
              แสดง 50 รายการแรก - พิมพ์เพื่อค้นหาเพิ่มเติม
            </div>
          )}
        </div>
      )}
    </div>
  )
}
