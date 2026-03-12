'use client'

/**
 * TimeInput — 24-hour HH:MM picker
 * Single <input type="text"> with click-to-select-segment + arrow key increment/decrement
 */

import React, { useRef, useState, useEffect, KeyboardEvent } from 'react'

interface TimeInputProps {
  value: string // "HH:MM"
  onChange: (value: string) => void
  className?: string
  required?: boolean
  disabled?: boolean
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const pad2 = (n: number) => n.toString().padStart(2, '0')

const fmt = (v: string): string => {
  const [h = '0', m = '0'] = (v || '00:00').split(':')
  return `${pad2(clamp(parseInt(h) || 0, 0, 23))}:${pad2(clamp(parseInt(m) || 0, 0, 59))}`
}

export function TimeInput({ value, onChange, className = '', disabled, required }: TimeInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [display, setDisplay] = useState(() => fmt(value))
  const bufRef = useRef('')  // typing buffer without state (avoids closure stale-state issues)

  // Sync display when parent value changes
  useEffect(() => {
    const next = fmt(value)
    setDisplay(next)
  }, [value])

  const getH = () => parseInt(display.slice(0, 2)) || 0
  const getM = () => parseInt(display.slice(3, 5)) || 0

  const emit = (h: number, m: number) => {
    const d = `${pad2(clamp(h, 0, 23))}:${pad2(clamp(m, 0, 59))}`
    setDisplay(d)
    onChange(d)
    return d
  }

  // Select the H segment (0-2) or M segment (3-5) after next paint
  const selH = () => setTimeout(() => ref.current?.setSelectionRange(0, 2), 0)
  const selM = () => setTimeout(() => ref.current?.setSelectionRange(3, 5), 0)

  const curSeg = (): 'h' | 'm' => {
    const pos = ref.current?.selectionStart ?? 0
    return pos <= 2 ? 'h' : 'm'
  }

  const handleFocus = () => {
    bufRef.current = ''
    selH()
  }

  const handleBlur = () => {
    bufRef.current = ''
    const normalised = fmt(display)
    setDisplay(normalised)
    onChange(normalised)
  }

  const handleClick = () => {
    const pos = ref.current?.selectionStart ?? 0
    if (pos <= 2) selH()
    else selM()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const seg = curSeg()

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        bufRef.current = ''
        if (seg === 'h') { emit((getH() + 1) % 24, getM()); selH() }
        else { emit(getH(), (getM() + 1) % 60); selM() }
        break

      case 'ArrowDown':
        e.preventDefault()
        bufRef.current = ''
        if (seg === 'h') { emit((getH() + 23) % 24, getM()); selH() }
        else { emit(getH(), (getM() + 59) % 60); selM() }
        break

      case 'ArrowLeft':
        e.preventDefault()
        bufRef.current = ''
        selH()
        break

      case 'ArrowRight':
      case ':':
        e.preventDefault()
        bufRef.current = ''
        selM()
        break

      case 'Tab':
        if (!e.shiftKey && seg === 'h') { e.preventDefault(); bufRef.current = ''; selM() }
        else if (e.shiftKey && seg === 'm') { e.preventDefault(); bufRef.current = ''; selH() }
        else bufRef.current = ''
        break

      case 'Backspace':
      case 'Delete':
        e.preventDefault()
        bufRef.current = ''
        if (seg === 'h') { emit(0, getM()); selH() }
        else { emit(getH(), 0); selM() }
        break

      default:
        if (/^\d$/.test(e.key)) {
          e.preventDefault()
          const d = parseInt(e.key)
          if (seg === 'h') {
            if (!bufRef.current) {
              // First digit of hours
              const partial = `${pad2(d)}:${display.slice(3, 5)}`
              setDisplay(partial)
              if (d > 2) {
                // 3-9 can't be first digit of a 2-digit 24h hour → finalise
                emit(d, getM())
                bufRef.current = ''
                selM()
              } else {
                bufRef.current = e.key
                selH()
              }
            } else {
              const h = parseInt(bufRef.current + e.key)
              emit(h <= 23 ? h : d, getM())
              bufRef.current = ''
              selM()
            }
          } else {
            if (!bufRef.current) {
              // First digit of minutes
              const partial = `${display.slice(0, 2)}:${pad2(d)}`
              setDisplay(partial)
              if (d > 5) {
                // 6-9 can't be first digit of a 2-digit minute → finalise
                emit(getH(), d)
                bufRef.current = ''
                selM()
              } else {
                bufRef.current = e.key
                selM()
              }
            } else {
              const m = parseInt(bufRef.current + e.key)
              emit(getH(), m <= 59 ? m : d)
              bufRef.current = ''
              selM()
            }
          }
        } else {
          // Block any other key
          e.preventDefault()
        }
    }
  }

  // No-op onChange (all changes go through keyDown)
  const handleChange = () => {}

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      required={required}
      spellCheck={false}
      autoComplete="off"
      style={{ caretColor: 'transparent' }}
      className={className}
    />
  )
}
