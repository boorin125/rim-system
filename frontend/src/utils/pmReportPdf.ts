import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyPdfWatermark } from './pdfWatermark'

async function loadImageAsDataURL(url: string): Promise<string | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`
    const res = await fetch(fullUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

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
  storeSignature?: string    // Base64 or relative path — from Digital Sign
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

  // Short date string for footer
  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '-'

  // Last Update date string: DD/M/YYYY HH:MM (matches online format)
  const lastUpdateStr = data.performedAt
    ? (() => {
        const d = new Date(data.performedAt)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `Last Update : ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      })()
    : 'Last Update : -'

  // ─── Header (matches PM Report Online style) ──────────────────────────────
  // Left: Logo + "Preventive Maintenance Report" + store name + address
  // Right: ticket number + last update date
  // Bottom: thick purple underline

  const logoMaxH = 18   // mm
  const logoMaxW = 45   // mm
  let textX = marginL   // shifts right if logo is present

  if (data.organizationLogo) {
    try {
      // Detect dimensions to preserve aspect ratio
      const logoDims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.width, h: img.height })
        img.onerror = () => resolve({ w: 0, h: 0 })
        img.src = data.organizationLogo!
      })
      if (logoDims.w > 0 && logoDims.h > 0) {
        const ratio = logoDims.w / logoDims.h
        const lh = Math.min(logoMaxH, logoMaxW / ratio)
        const lw = lh * ratio
        const fmt = data.organizationLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(data.organizationLogo, fmt, marginL, y, lw, lh, undefined, 'FAST')
        textX = marginL + lw + 3
      }
    } catch { /* skip logo on error */ }
  }

  // Left text block
  doc.setFont(font, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(55, 65, 81)   // gray-700
  doc.text('Preventive Maintenance Report', textX, y + 6)

  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)   // gray-900
  doc.text(`${data.store.storeCode} ${data.store.name}`, textX, y + 12)

  if (data.store.address) {
    doc.setFont(font, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128) // gray-500
    const addrLine = doc.splitTextToSize(data.store.address, pageW - marginR - textX - 50)
    doc.text(addrLine[0], textX, y + 17) // single line only
  }

  // Right text block
  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)
  doc.text(data.ticketNumber, pageW - marginR, y + 6, { align: 'right' })

  doc.setFont(font, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(107, 114, 128)
  doc.text(lastUpdateStr, pageW - marginR, y + 12, { align: 'right' })

  // Purple underline
  y += 22
  doc.setDrawColor(147, 51, 234)  // purple-600
  doc.setLineWidth(1.2)
  doc.line(marginL, y, pageW - marginR, y)
  doc.setDrawColor(180, 180, 180) // reset draw color
  doc.setLineWidth(0.2)

  y += 8  // gap after header

  // ─── Equipment Records ────────────────────────────────────────────────────
  // Layout target: page 1 (starts at y≈44) → 2 items; subsequent pages (y=14) → 3 items
  // With photoSize=60: item height ≈ 9(header)+6(details)+4(label)+60(photo)+4(gap)+4(space) = 87 mm
  // Page 1 available ≈ 283-44 = 239 mm → fits 2×87=174 mm ✓ (even 2 with some space)
  // Other pages available ≈ 283-14 = 269 mm → fits 3×87=261 mm ✓
  const photoSize = 60
  const itemMinHeight = 9 + 6 + 4 + photoSize + 8  // 87 mm — used for pre-item page-break check

  for (let i = 0; i < data.equipmentRecords.length; i++) {
    const eq = data.equipmentRecords[i]

    // Pre-item page break — check full item height before drawing anything
    if (y + itemMinHeight > pageH - 14) {
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

    // Photos — square crop, each centered within its half of the content width
    // Left half: marginL → marginL+halfW  |  Right half: marginL+halfW → marginL+contentW
    const halfW = contentW / 2
    const p1x = marginL + (halfW - photoSize) / 2          // centered in left half
    const p2x = marginL + halfW + (halfW - photoSize) / 2  // centered in right half
    const p1cx = marginL + halfW / 2                        // label center of left half
    const p2cx = marginL + halfW + halfW / 2                // label center of right half

    const hasB = eq.beforePhotos.length > 0
    const hasA = eq.afterPhotos.length > 0

    if (hasB || hasA) {
      doc.setFontSize(7)
      doc.setTextColor(80, 80, 200)
      doc.text('ก่อน PM', p1cx, y + 3, { align: 'center' })
      doc.setTextColor(30, 120, 30)
      doc.text('หลัง PM', p2cx, y + 3, { align: 'center' })
      y += 4

      // Square placeholders
      doc.setDrawColor(180, 180, 180)
      doc.rect(p1x, y, photoSize, photoSize)
      doc.rect(p2x, y, photoSize, photoSize)

      if (hasB) {
        try {
          const cropped = await cropToSquare(eq.beforePhotos[0])
          doc.addImage(cropped, 'JPEG', p1x, y, photoSize, photoSize, undefined, 'FAST')
        } catch {}
      } else {
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('ไม่มีรูป', p1cx, y + photoSize / 2, { align: 'center' })
      }

      if (hasA) {
        try {
          const cropped = await cropToSquare(eq.afterPhotos[0])
          doc.addImage(cropped, 'JPEG', p2x, y, photoSize, photoSize, undefined, 'FAST')
        } catch {}
      } else {
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('ไม่มีรูป', p2cx, y + photoSize / 2, { align: 'center' })
      }

      y += photoSize + 4
    }

    y += 4 // gap between equipment
  }

  // ─── Signature Section — always pinned to bottom of last page ───────────
  const sigBlockH = 55
  const sigFixedY = pageH - 10 - sigBlockH  // ~232 mm from top

  if (y + 6 > sigFixedY) {
    // Equipment runs past signature area → push to a new page
    doc.addPage()
  }
  y = sigFixedY

  // Section header bar
  doc.setFillColor(237, 233, 254) // purple-100
  doc.rect(marginL, y, contentW, 7, 'F')
  doc.setFont(font, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(88, 28, 135)
  doc.text('ลายเซ็น / Signatures', marginL + 3, y + 5)
  y += 7  // move past header bar

  const colW = contentW / 2
  const sigImgH = 20   // max height for signature image
  const boxH = 44      // height of each signature box
  const boxTop = y

  // Bordered signature boxes (Service Report style)
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.rect(marginL, boxTop, colW, boxH)
  doc.rect(marginL + colW, boxTop, colW, boxH)

  // Inner signature lines
  const lineY = boxTop + 8 + sigImgH + 2  // boxTop + 30
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(marginL + 8, lineY, marginL + colW - 8, lineY)
  doc.line(marginL + colW + 8, lineY, marginL + colW * 2 - 8, lineY)

  // ── Technician column (left) ──
  doc.setFont(font, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  doc.text('ลายเซ็นช่างเทคนิค / Technician', marginL + colW / 2, boxTop + 4.5, { align: 'center' })

  if (data.technicianSignature) {
    try {
      const sigDims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.width, h: img.height })
        img.onerror = () => resolve({ w: 0, h: 0 })
        img.src = data.technicianSignature!
      })
      if (sigDims.w > 0) {
        const ratio = sigDims.w / sigDims.h
        const sh = Math.min(sigImgH, 50 * ratio > 50 ? sigImgH : sigImgH)
        const sw = Math.min(sh * ratio, colW - 20)
        const sx = marginL + (colW - sw) / 2
        const fmt = data.technicianSignature.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(data.technicianSignature, fmt, sx, boxTop + 8, sw, Math.min(sh, sigImgH), undefined, 'FAST')
      }
    } catch {}
  }

  doc.setFont(font, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(50, 50, 50)
  doc.text(`(${data.technicianName || '                    '})`, marginL + colW / 2, lineY + 4, { align: 'center' })
  doc.setFont(font, 'normal')
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  if (data.performedAt) {
    const d = new Date(data.performedAt)
    doc.text(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, marginL + colW / 2, lineY + 8, { align: 'center' })
  }

  // ── Store Staff column (right) ──
  const rightX = marginL + colW
  doc.setFont(font, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  doc.text('ลายเซ็นเจ้าหน้าที่สาขา / Store Staff', rightX + colW / 2, boxTop + 4.5, { align: 'center' })

  if (data.storeSignature) {
    try {
      const apiBase = (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') || ''
      const sigSrc = data.storeSignature.startsWith('data:')
        ? data.storeSignature
        : await loadImageAsDataURL(`${apiBase.replace('/api', '')}/uploads/${data.storeSignature}`)
      if (sigSrc) {
        const sigDims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ w: img.width, h: img.height })
          img.onerror = () => resolve({ w: 0, h: 0 })
          img.src = sigSrc
        })
        if (sigDims.w > 0) {
          const ratio = sigDims.w / sigDims.h
          const sw = Math.min(sigImgH * ratio, colW - 20)
          const sh = sw / ratio
          const sx = rightX + (colW - sw) / 2
          const fmt = sigSrc.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(sigSrc, fmt, sx, boxTop + 8, sw, Math.min(sh, sigImgH), undefined, 'FAST')
        }
      }
    } catch {}
  }

  doc.setFont(font, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(50, 50, 50)
  doc.text(`(${data.storeSignerName || '                    '})`, rightX + colW / 2, lineY + 4, { align: 'center' })
  doc.setFont(font, 'normal')
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  if (data.storeSignedAt) {
    const d = new Date(data.storeSignedAt)
    doc.text(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, rightX + colW / 2, lineY + 8, { align: 'center' })
  }

  doc.setLineWidth(0.2)

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
