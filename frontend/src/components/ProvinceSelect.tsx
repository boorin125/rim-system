'use client'

// Province picker — only the 77 canonical provinces can be chosen (value = UPPERCASE English name).
// A legacy value that isn't in the list is still shown (marked) so the form doesn't silently lose it.
import { PROVINCE_OPTIONS, findProvince } from '@/data/thai-provinces'

interface ProvinceSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
  name?: string
}

const BASE_CLASS =
  'w-full bg-slate-800 border border-slate-600 [&>option]:bg-slate-800 [&>option]:text-white rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors'

export default function ProvinceSelect({
  value,
  onChange,
  required,
  disabled,
  placeholder = '— เลือกจังหวัด —',
  className = 'px-4 py-3',
  id,
  name,
}: ProvinceSelectProps) {
  // Show a recognisable legacy spelling as its canonical option
  const canonical = findProvince(value)?.en
  const selected = canonical ?? value ?? ''
  const isUnknown = !!value && !canonical

  return (
    <select
      id={id}
      name={name}
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className={`${BASE_CLASS} ${className} ${isUnknown ? 'border-yellow-500/70' : ''}`}
    >
      <option value="">{placeholder}</option>
      {isUnknown && (
        <option value={value} disabled>
          {value} (ไม่ตรงรายการ — กรุณาเลือกใหม่)
        </option>
      )}
      {PROVINCE_OPTIONS.map((p) => (
        <option key={p.en} value={p.en}>
          {p.en} · {p.th}
        </option>
      ))}
    </select>
  )
}
