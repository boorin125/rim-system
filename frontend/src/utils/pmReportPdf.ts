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
  technicianName?: string          // display name (Thai preferred)
  technicianSignature?: string     // base64 data URL
  organizationName?: string
  organizationLogo?: string
  storeSignature?: string    // Base64 — from Digital Sign
  storeSignerName?: string
  storeSignedAt?: string
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

/** Center-crop a base64 image to a square using canvas (object-fit: cover equivalent) */
async function cropToSquare(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(base64); return }
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(base64)
    img.src = base64
  })
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

    // Photos — square crop, before on left, after on right
    const photoSize = 50   // square: 50×50 mm each; two photos = 50+6+50 = 106 mm (within 182 mm)
    const hasB = eq.beforePhotos.length > 0
    const hasA = eq.afterPhotos.length > 0

    if (hasB || hasA) {
      if (y + photoSize + 8 > pageH - 14) {
        doc.addPage()
        y = 14
      }

      doc.setFontSize(7)
      doc.setTextColor(80, 80, 200)
      doc.text('ก่อน PM', marginL, y + 3)
      doc.setTextColor(30, 120, 30)
      doc.text('หลัง PM', marginL + photoSize + 6, y + 3)
      y += 4

      // Square placeholders
      doc.setDrawColor(180, 180, 180)
      doc.rect(marginL, y, photoSize, photoSize)
      doc.rect(marginL + photoSize + 6, y, photoSize, photoSize)

      if (hasB) {
        try {
          const cropped = await cropToSquare(eq.beforePhotos[0])
          doc.addImage(cropped, 'JPEG', marginL, y, photoSize, photoSize, undefined, 'FAST')
        } catch {}
      } else {
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('ไม่มีรูป', marginL + photoSize / 2, y + photoSize / 2, { align: 'center' })
      }

      if (hasA) {
        try {
          const cropped = await cropToSquare(eq.afterPhotos[0])
          doc.addImage(cropped, 'JPEG', marginL + photoSize + 6, y, photoSize, photoSize, undefined, 'FAST')
        } catch {}
      } else {
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('ไม่มีรูป', marginL + photoSize + 6 + photoSize / 2, y + photoSize / 2, { align: 'center' })
      }

      y += photoSize + 4
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
