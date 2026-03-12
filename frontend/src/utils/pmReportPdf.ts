import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyPdfWatermark } from './pdfWatermark'

export interface PmReportEquipment {
  name: string
  category: string
  serialNumber: string
  brand?: string
  model?: string
  condition?: string       // GOOD | NEEDS_REPAIR | REPLACED
  comment?: string
  beforePhotos: string[]   // Base64
  afterPhotos: string[]    // Base64
  updatedBrand?: string
  updatedModel?: string
  updatedSerial?: string
}

export interface PmReportData {
  ticketNumber: string
  store: {
    storeCode: string
    name: string
    province?: string
    address?: string
  }
  performedAt?: string
  technicianName?: string
  organizationName?: string
  organizationLogo?: string
  equipmentRecords: PmReportEquipment[]
}

const conditionTh: Record<string, string> = {
  GOOD: 'ปกติ',
  NEEDS_REPAIR: 'ต้องซ่อม',
  REPLACED: 'เปลี่ยนใหม่',
}

/** Load Sarabun font and register in jsPDF */
async function loadSarabunFont(doc: jsPDF): Promise<string> {
  const font = 'Sarabun'
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const [regRes, boldRes] = await Promise.all([
      fetch(`${origin}/fonts/Sarabun-Regular.ttf`),
      fetch(`${origin}/fonts/Sarabun-Bold.ttf`),
    ])
    const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()])
    const toB64 = (buf: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(buf)))
    doc.addFileToVFS('Sarabun-Regular.ttf', toB64(regBuf))
    doc.addFont('Sarabun-Regular.ttf', font, 'normal')
    doc.addFileToVFS('Sarabun-Bold.ttf', toB64(boldBuf))
    doc.addFont('Sarabun-Bold.ttf', font, 'bold')
    doc.setFont(font)
  } catch {
    // Fallback to default font
  }
  return font
}

/** Resize and add an image; returns the image height used */
function addPhoto(
  doc: jsPDF,
  base64: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): number {
  try {
    const img = new Image()
    img.src = base64
    // Use fixed dimensions — actual ratio kept by jsPDF
    const w = maxW
    const h = maxH
    doc.addImage(base64, 'JPEG', x, y, w, h, undefined, 'FAST')
    return h
  } catch {
    return 0
  }
}

export async function generatePmReportPDF(data: PmReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const font = await loadSarabunFont(doc)

  const pageW = 210
  const pageH = 297
  const marginL = 14
  const marginR = 14
  const contentW = pageW - marginL - marginR
  let y = 14

  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-'

  // ─── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(88, 28, 135) // purple-900
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setFont(font, 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('PM REPORT', marginL, 12)

  doc.setFont(font, 'normal')
  doc.setFontSize(8)
  doc.text(data.organizationName ?? 'RIM System', marginL, 19)
  doc.text(`วันที่ PM: ${dateStr}`, marginL, 24)

  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.text(data.ticketNumber, pageW - marginR, 12, { align: 'right' })
  doc.setFont(font, 'normal')
  doc.setFontSize(8)
  doc.text(`ช่างเทคนิค: ${data.technicianName ?? '-'}`, pageW - marginR, 19, { align: 'right' })

  y = 36

  // ─── Store Info ───────────────────────────────────────────────────────────
  doc.setFillColor(245, 243, 255) // purple-50
  doc.roundedRect(marginL, y, contentW, 22, 2, 2, 'F')
  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(88, 28, 135)
  doc.text(`Store ${data.store.storeCode} ${data.store.name}`, marginL + 4, y + 7)
  doc.setFont(font, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  if (data.store.province) doc.text(`จังหวัด: ${data.store.province}`, marginL + 4, y + 13)
  if (data.store.address) doc.text(`ที่อยู่: ${data.store.address}`, marginL + 4, y + 18)

  y += 28

  // ─── Equipment Records ────────────────────────────────────────────────────
  for (let i = 0; i < data.equipmentRecords.length; i++) {
    const eq = data.equipmentRecords[i]

    // Check if we need a new page
    if (y + 60 > pageH - 14) {
      doc.addPage()
      y = 14
    }

    // Equipment header bar
    doc.setFillColor(233, 213, 255) // purple-200
    doc.rect(marginL, y, contentW, 7, 'F')
    doc.setFont(font, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(60, 10, 90)
    doc.text(`${i + 1}. ${eq.name}`, marginL + 2, y + 5)

    const condText = eq.condition ? `[${conditionTh[eq.condition] ?? eq.condition}]` : ''
    doc.setFont(font, 'normal')
    doc.setFontSize(8)
    doc.text(condText, pageW - marginR, y + 5, { align: 'right' })

    y += 9

    // Equipment details row
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(7.5)
    const details = [
      `Category: ${eq.category}`,
      `S/N: ${eq.serialNumber}`,
      eq.brand ? `Brand: ${eq.updatedBrand || eq.brand}` : '',
      eq.model ? `Model: ${eq.updatedModel || eq.model}` : '',
    ]
      .filter(Boolean)
      .join('   ')
    doc.text(details, marginL, y + 4)
    y += 6

    // Comment
    if (eq.comment) {
      doc.setFont(font, 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(90, 90, 90)
      const lines = doc.splitTextToSize(`หมายเหตุ: ${eq.comment}`, contentW)
      doc.text(lines, marginL, y + 4)
      y += lines.length * 4 + 2
    }

    // Photos — before on left, after on right
    const photoW = (contentW - 6) / 2
    const photoH = 45
    const hasB = eq.beforePhotos.length > 0
    const hasA = eq.afterPhotos.length > 0

    if (hasB || hasA) {
      if (y + photoH + 8 > pageH - 14) {
        doc.addPage()
        y = 14
      }

      doc.setFontSize(7)
      doc.setTextColor(80, 80, 200)
      doc.text('ก่อน PM', marginL, y + 3)
      doc.setTextColor(30, 120, 30)
      doc.text('หลัง PM', marginL + photoW + 6, y + 3)
      y += 4

      // Photo placeholders
      doc.setDrawColor(180, 180, 180)
      doc.rect(marginL, y, photoW, photoH)
      doc.rect(marginL + photoW + 6, y, photoW, photoH)

      if (hasB) {
        try {
          doc.addImage(eq.beforePhotos[0], 'JPEG', marginL, y, photoW, photoH, undefined, 'FAST')
        } catch {}
      } else {
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('ไม่มีรูป', marginL + photoW / 2, y + photoH / 2, { align: 'center' })
      }

      if (hasA) {
        try {
          doc.addImage(eq.afterPhotos[0], 'JPEG', marginL + photoW + 6, y, photoW, photoH, undefined, 'FAST')
        } catch {}
      } else {
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('ไม่มีรูป', marginL + photoW + 6 + photoW / 2, y + photoH / 2, { align: 'center' })
      }

      y += photoH + 4
    }

    y += 4 // gap between equipment
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal')
    doc.setFontSize(6)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `PM Report — ${data.store.storeCode} ${data.store.name} — ${dateStr}   |   หน้า ${p}/${totalPages}`,
      pageW / 2,
      pageH - 5,
      { align: 'center' },
    )
  }

  applyPdfWatermark(doc, { orgName: data.store.name, ticketNumber: data.ticketNumber })
  doc.save(`PM-Report-${data.store.storeCode}-${data.ticketNumber}.pdf`)
}
