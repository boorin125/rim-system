import jsPDF from 'jspdf'
import { applyPdfWatermark } from './pdfWatermark'

export interface InventoryListEquipment {
  no: number
  name: string
  category: string
  serialNumber: string
  brand?: string
  model?: string
  condition?: string   // GOOD | NEEDS_REPAIR | REPLACED
  comment?: string
  photo?: string       // Base64 — first after-PM photo
}

export interface InventoryListData {
  ticketNumber: string
  store: {
    storeCode: string
    name: string
    province?: string
    address?: string
  }
  performedAt?: string
  technicianName?: string
  technicianSignature?: string  // base64 data URL
  organizationName?: string
  organizationLogo?: string     // Base64 data URL
  themeColor?: string
  storeSignature?: string
  storeSignerName?: string
  storeSignedAt?: string
  equipment: InventoryListEquipment[]
}

const conditionTh: Record<string, string> = {
  GOOD: 'ปกติ',
  NEEDS_REPAIR: 'ต้องซ่อม',
  REPLACED: 'เปลี่ยนใหม่',
}

async function loadSarabunFont(doc: jsPDF): Promise<string> {
  const font = 'Sarabun'
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const [regRes, boldRes] = await Promise.all([
      fetch(`${origin}/fonts/Sarabun-Regular.ttf`),
      fetch(`${origin}/fonts/Sarabun-Bold.ttf`),
    ])
    const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()])
    const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    doc.addFileToVFS('Sarabun-Regular.ttf', toB64(regBuf))
    doc.addFont('Sarabun-Regular.ttf', font, 'normal')
    doc.addFileToVFS('Sarabun-Bold.ttf', toB64(boldBuf))
    doc.addFont('Sarabun-Bold.ttf', font, 'bold')
    doc.setFont(font)
  } catch {}
  return font
}


export async function generateInventoryListPDF(data: InventoryListData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const font = await loadSarabunFont(doc)

  const pageW = 210
  const pageH = 297
  const marginL = 10
  const marginR = 10
  const contentW = pageW - marginL - marginR  // 190 mm
  let y = marginL

  // ── Date strings ──────────────────────────────────────────────────────────
  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Header (same style as PM Report PDF) ─────────────────────────────────
  const logoMaxH = 18
  const logoMaxW = 45
  let textX = marginL

  if (data.organizationLogo) {
    try {
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
    } catch {}
  }

  // Left text block
  doc.setFont(font, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(55, 65, 81)
  doc.text('Inventory List', textX, y + 6)

  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)
  doc.text(`${data.store.storeCode} ${data.store.name}`, textX, y + 12)

  if (data.store.address) {
    doc.setFont(font, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    const addrLine = doc.splitTextToSize(data.store.address, pageW - marginR - textX - 50)
    doc.text(addrLine[0], textX, y + 17)
  }

  // Right text block
  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)
  doc.text(data.ticketNumber, pageW - marginR, y + 6, { align: 'right' })

  doc.setFont(font, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(107, 114, 128)
  doc.text(`วันที่ PM: ${dateStr}`, pageW - marginR, y + 12, { align: 'right' })

  // Purple underline
  y += 22
  doc.setDrawColor(147, 51, 234)
  doc.setLineWidth(1.2)
  doc.line(marginL, y, pageW - marginR, y)
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  y += 8

  // ── Table ─────────────────────────────────────────────────────────────────
  // ROW_H=26: 10 rows fill a full page on pages 2+ (y=21+260=281 < 292 ✓)
  const ROWS_PER_PAGE = 10
  const ROW_H = 26

  const cols = [
    { label: 'ลำดับ',        w: 10, align: 'center' as const },
    { label: 'ชื่ออุปกรณ์',   w: 40, align: 'left'   as const },
    { label: 'Brand / Model', w: 32, align: 'left'   as const },
    { label: 'Serial No.',    w: 28, align: 'left'   as const },
    { label: 'รูปอุปกรณ์',   w: 22, align: 'center' as const },
    { label: 'Recheck',       w: contentW - 10 - 40 - 32 - 28 - 22, align: 'left' as const },
    // Recheck = 190 - 132 = 58 mm
  ]

  const drawTableHeader = (yh: number) => {
    doc.setFillColor(233, 213, 255)  // purple-200 — matches PM Report equipment bar
    doc.rect(marginL, yh, contentW, 7, 'F')
    doc.setFont(font, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(60, 10, 90)
    let xh = marginL
    for (const col of cols) {
      const tx = col.align === 'center' ? xh + col.w / 2 : xh + 1.5
      doc.text(col.label, tx, yh + 4.5, { align: col.align })
      xh += col.w
    }
  }

  drawTableHeader(y)
  y += 7

  let pageItemCount = 0

  for (let i = 0; i < data.equipment.length; i++) {
    const eq = data.equipment[i]

    // Break after ROWS_PER_PAGE items per page
    if (pageItemCount === ROWS_PER_PAGE) {
      doc.addPage()
      y = 14
      drawTableHeader(y)
      y += 7
      pageItemCount = 0
    }

    // Row background: alternating purple-50 / white
    if (i % 2 === 0) {
      doc.setFillColor(250, 245, 255)
    } else {
      doc.setFillColor(255, 255, 255)
    }
    doc.rect(marginL, y, contentW, ROW_H, 'F')

    doc.setFont(font, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)

    let cx = marginL
    const midY = y + ROW_H / 2 + 1.5

    // No.
    doc.text(String(eq.no), cx + cols[0].w / 2, midY, { align: 'center' })
    cx += cols[0].w

    // Name + category
    doc.setFont(font, 'bold')
    doc.setFontSize(7)
    doc.text(eq.name.slice(0, 22), cx + 1.5, y + 7)
    doc.setFont(font, 'normal')
    doc.setFontSize(6)
    doc.setTextColor(120, 80, 180)
    doc.text(eq.category, cx + 1.5, y + 13)
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)
    cx += cols[1].w

    // Brand / Model
    const bm = [eq.brand, eq.model].filter(Boolean).join(' / ')
    const bmLines = doc.splitTextToSize(bm, cols[2].w - 3)
    doc.text(bmLines.slice(0, 2), cx + 1.5, y + 7)
    cx += cols[2].w

    // Serial No.
    const snLines = doc.splitTextToSize(eq.serialNumber, cols[3].w - 3)
    doc.text(snLines.slice(0, 2), cx + 1.5, y + 7)
    cx += cols[3].w

    // Photo (after-PM)
    if (eq.photo) {
      try {
        doc.addImage(eq.photo, 'JPEG', cx + 1, y + 1, cols[4].w - 2, ROW_H - 2, undefined, 'FAST')
      } catch {}
    } else {
      doc.setFontSize(5.5)
      doc.setTextColor(180, 180, 180)
      doc.text('ไม่มีรูป', cx + cols[4].w / 2, midY, { align: 'center' })
      doc.setFontSize(7)
      doc.setTextColor(40, 40, 40)
    }
    cx += cols[4].w

    // Recheck
    if (eq.comment) {
      const noteLines = doc.splitTextToSize(eq.comment, cols[5].w - 3)
      doc.setFontSize(6.5)
      doc.setTextColor(40, 40, 40)
      doc.text(noteLines.slice(0, 3), cx + 1.5, y + 7)
      doc.setFontSize(7)
    }

    // Row border
    doc.setDrawColor(210, 195, 235)
    doc.setLineWidth(0.2)
    doc.rect(marginL, y, contentW, ROW_H)

    y += ROW_H
    pageItemCount++
  }

  // Bottom table line
  doc.setDrawColor(147, 51, 234)
  doc.setLineWidth(0.5)
  doc.line(marginL, y, marginL + contentW, y)
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  y += 8

  // ── Signature Section — always pinned to bottom of last page ─────────────
  const sigBlockH = 55  // 7 (header bar) + 44 (boxes) + 4 (gap)
  const sigFixedY = pageH - 10 - sigBlockH  // ~232 mm

  if (y + 8 > sigFixedY) {
    // Rows overflow into signature area → push to new page
    doc.addPage()
  }
  y = sigFixedY

  // Section header bar
  doc.setFillColor(237, 233, 254)  // purple-100
  doc.rect(marginL, y, contentW, 7, 'F')
  doc.setFont(font, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(88, 28, 135)
  doc.text('ลายเซ็น / Signatures', marginL + 3, y + 5)
  y += 7  // move past header bar

  const colW = contentW / 2
  const sigImgH = 20
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
      const sigDims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.width, h: img.height })
        img.onerror = () => resolve({ w: 0, h: 0 })
        img.src = data.storeSignature!
      })
      if (sigDims.w > 0) {
        const ratio = sigDims.w / sigDims.h
        const sw = Math.min(sigImgH * ratio, colW - 20)
        const sh = sw / ratio
        const sx = rightX + (colW - sw) / 2
        const fmt = data.storeSignature.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(data.storeSignature, fmt, sx, boxTop + 8, sw, Math.min(sh, sigImgH), undefined, 'FAST')
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

  // ── Page footer (page number) ──────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal')
    doc.setFontSize(6)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `Inventory List — Store ${data.store.storeCode} ${data.store.name} — ${dateStr}   |   หน้า ${p}/${totalPages}`,
      pageW / 2,
      pageH - 5,
      { align: 'center' },
    )
  }

  applyPdfWatermark(doc, { orgName: data.store.name, ticketNumber: data.ticketNumber })
  doc.save(`Inventory-List-${data.store.storeCode}-${data.ticketNumber}.pdf`)
}
