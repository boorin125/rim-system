// utils/lineMessageParser.ts - Parse LINE messages into structured incident data

export interface ParsedLineMessage {
  storeCode: string | null
  storeName: string | null
  title: string | null
  priority: string | null
  slaLevel: number | null
  date: string | null       // YYYY-MM-DD
  time: string | null       // HH:MM
  rawText: string
}

const SLA_TO_PRIORITY: Record<number, string> = {
  1: 'CRITICAL',
  2: 'HIGH',
  3: 'MEDIUM',
  4: 'LOW',
}

/**
 * Parse a LINE message into structured incident data.
 *
 * Expected patterns (flexible):
 *   - Store: "3183 Big C Saraburi" (4-digit code + store name)
 *   - Symptom: "อาการ : PC Printer - HP 501 ..."
 *   - SLA: "sla : 1"
 *   - Time opened: "เปิดงาน : 21:16"
 *   - Date: "วันที่ 5/02/2026"
 */
export function parseLineMessage(text: string): ParsedLineMessage {
  const result: ParsedLineMessage = {
    storeCode: null,
    storeName: null,
    title: null,
    priority: null,
    slaLevel: null,
    date: null,
    time: null,
    rawText: text.trim(),
  }

  if (!text || !text.trim()) return result

  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // --- Store Code & Name ---
  // Look for a line starting with 4+ digit store code
  for (const line of lines) {
    const storeMatch = line.match(/^(\d{3,6})\s+(.+)/)
    if (storeMatch) {
      result.storeCode = storeMatch[1]
      result.storeName = storeMatch[2].trim()
      break
    }
  }

  // --- Title (อาการ) ---
  const titleMatch = text.match(/อาการ\s*[:：]\s*(.+)/i)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }

  // --- SLA → Priority ---
  const slaMatch = text.match(/sla\s*[:：]\s*(\d+)/i)
  if (slaMatch) {
    const slaNum = parseInt(slaMatch[1], 10)
    result.slaLevel = slaNum
    result.priority = SLA_TO_PRIORITY[slaNum] || null
  }

  // --- Time (เปิดงาน) ---
  const timeMatch = text.match(/เปิดงาน\s*[:：]\s*(\d{1,2})[:.：](\d{2})/i)
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0')
    const minutes = timeMatch[2]
    result.time = `${hours}:${minutes}`
  }

  // --- Date (วันที่) ---
  const dateMatch = text.match(/วันที่\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i)
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0')
    const month = dateMatch[2].padStart(2, '0')
    let year = dateMatch[3]

    // Handle 2-digit year
    if (year.length === 2) {
      const num = parseInt(year, 10)
      year = (num > 50 ? 1900 + num : 2000 + num).toString()
    }

    // Handle Buddhist year (พ.ศ.) - years > 2500
    const yearNum = parseInt(year, 10)
    if (yearNum > 2500) {
      year = (yearNum - 543).toString()
    }

    result.date = `${year}-${month}-${day}`
  }

  return result
}

/**
 * Priority display info for UI
 */
export const PRIORITY_DISPLAY: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-400' },
  HIGH: { label: 'High', color: 'text-orange-400' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-400' },
  LOW: { label: 'Low', color: 'text-green-400' },
}
