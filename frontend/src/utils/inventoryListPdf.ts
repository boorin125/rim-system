import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  themeColor?: string           // Hex e.g. '#581c87' — used for header background
  storeSignature?: string       // base64 — from Digital Sign
  storeSignerName?: string
  storeSignedAt?: string
  equipment: InventoryListEquipment[]
}

const conditionTh: Record<string, string> = {
  GOOD: 'ปกติ',
  NEEDS_REPAIR: 'ต้องซ่อม',
  REPLACED: 'เปลี่ยนใหม่',
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return [isNaN(r) ? 88 : r, isNaN(g) ? 28 : g, isNaN(b) ? 135 : b]
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
    const toB64 = (buf: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(buf)))
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
  const contentW = pageW - marginL - marginR
  let y = 10

  const dateStr = data.performedAt
    ? new Date(data.performedAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  const headerColor: [number, number, number] = data.themeColor
    ? hexToRgb(data.themeColor)
    : [88, 28, 135]

  // ─── Page Header ──────────────────────────────────────────────────────────
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
  doc.rect(0, 0, pageW, 22, 'F')

  // Logo (top-left of header)
  if (data.organizationLogo) {
    try {
      const fmt = data.organizationLogo.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(data.organizationLogo, fmt, marginL, 3, 16, 16, undefined, 'FAST')
    } catch {}
  }

  doc.setFont(font, 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('INVENTORY LIST', pageW / 2, 9, { align: 'center' })

  doc.setFont(font, 'normal')
  doc.setFontSize(8)
  doc.text(`Store ${data.store.storeCode} ${data.store.name}`, pageW / 2, 14, { align: 'center' })
  doc.text(`วันที่ PM: ${dateStr}   |   Ticket: ${data.ticketNumber}`, pageW / 2, 19, { align: 'center' })

  y = 28

  // ─── Store Info ───────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  const storeInfoParts = [
    data.store.province ? `จังหวัด: ${data.store.province}` : '',
    data.store.address ? `ที่อยู่: ${data.store.address}` : '',
  ].filter(Boolean)
  if (storeInfoParts.length > 0) {
    doc.text(storeInfoParts.join('   '), marginL, y)
    y += 5
  }
  y += 2

  // ─── Equipment Table ──────────────────────────────────────────────────────
  const ROW_H = 18 // row height to fit small photo

  // Table header
  const cols = [
    { label: 'ลำดับ', w: 10, align: 'center' as const },
    { label: 'ชื่ออุปกรณ์', w: 38, align: 'left' as const },
    { label: 'Brand / Model', w: 30, align: 'left' as const },
    { label: 'Serial No.', w: 28, align: 'left' as const },
    { label: 'รูปอุปกรณ์', w: 22, align: 'center' as const },
    { label: 'Status', w: 18, align: 'center' as const },
    { label: 'Note', w: contentW - 10 - 38 - 30 - 28 - 22 - 18, align: 'left' as const },
  ]
  let x = marginL

  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
  doc.rect(marginL, y, contentW, 7, 'F')
  doc.setFont(font, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  for (const col of cols) {
    const tx = col.align === 'center' ? x + col.w / 2 : x + 1
    doc.text(col.label, tx, y + 4.5, { align: col.align })
    x += col.w
  }
  y += 7

  // Table rows
  for (let i = 0; i < data.equipment.length; i++) {
    const eq = data.equipment[i]

    // Check new page
    if (y + ROW_H > pageH - 50) {
      doc.addPage()
      y = 14
      // Redraw header
      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
      doc.rect(marginL, y, contentW, 7, 'F')
      doc.setFont(font, 'bold')
      doc.setFontSize(7)
      doc.setTextColor(255, 255, 255)
      let xh = marginL
      for (const col of cols) {
        const tx = col.align === 'center' ? xh + col.w / 2 : xh + 1
        doc.text(col.label, tx, y + 4.5, { align: col.align })
        xh += col.w
      }
      y += 7
    }

    // Row background
    if (i % 2 === 0) {
      doc.setFillColor(250, 245, 255)
    } else {
      doc.setFillColor(255, 255, 255)
    }
    doc.rect(marginL, y, contentW, ROW_H, 'F')

    // Draw cell content
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
    doc.text(eq.name.slice(0, 22), cx + 1, y + 5)
    doc.setFont(font, 'normal')
    doc.setFontSize(6)
    doc.setTextColor(120, 80, 180)
    doc.text(eq.category, cx + 1, y + 10)
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)
    cx += cols[1].w

    // Brand / Model
    const bm = [eq.brand, eq.model].filter(Boolean).join(' / ')
    doc.text(bm.slice(0, 18), cx + 1, midY)
    cx += cols[2].w

    // Serial
    doc.text(eq.serialNumber.slice(0, 18), cx + 1, midY)
    cx += cols[3].w

    // Photo (first after-PM photo)
    if (eq.photo) {
      try {
        doc.addImage(eq.photo, 'JPEG', cx + 1, y + 1, cols[4].w - 2, ROW_H - 2, undefined, 'FAST')
      } catch {}
    } else {
      doc.setFontSize(5.5)
      doc.setTextColor(180, 180, 180)
      doc.text('ไม่มีรูป', cx + cols[4].w / 2, midY, { align: 'center' })
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(7)
    }
    cx += cols[4].w

    // Status (Condition)
    const cond = eq.condition ? (conditionTh[eq.condition] ?? eq.condition) : '-'
    const condColor =
      eq.condition === 'GOOD'
        ? [34, 197, 94]
        : eq.condition === 'NEEDS_REPAIR'
        ? [234, 179, 8]
        : eq.condition === 'REPLACED'
        ? [239, 68, 68]
        : [120, 120, 120]
    doc.setTextColor(condColor[0], condColor[1], condColor[2])
    doc.text(cond, cx + cols[5].w / 2, midY, { align: 'center' })
    doc.setTextColor(40, 40, 40)
    cx += cols[5].w

    // Note (Comment)
    if (eq.comment) {
      const lines = doc.splitTextToSize(eq.comment, cols[6].w - 2)
      doc.setFontSize(6.5)
      doc.text(lines.slice(0, 2), cx + 1, y + 5)
      doc.setFontSize(7)
    }

    // Row border
    doc.setDrawColor(210, 195, 235)
    doc.rect(marginL, y, contentW, ROW_H)

    y += ROW_H
  }

  // Bottom border
  doc.setDrawColor(headerColor[0], headerColor[1], headerColor[2])
  doc.setLineWidth(0.4)
  doc.line(marginL, y, marginL + contentW, y)
  doc.setLineWidth(0.2)

  y += 10

  // ─── Signature Section ────────────────────────────────────────────────────
  if (y + 40 > pageH - 10) {
    doc.addPage()
    y = 14
  }

  const sigW = contentW / 2 - 5

  // Signature box labels
  doc.setFont(font, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('ผู้ตรวจสอบ (ช่างเทคนิค)', marginL + sigW / 2, y, { align: 'center' })
  doc.text('ผู้รับทราบ (เจ้าหน้าที่สาขา)', marginL + sigW + 10 + sigW / 2, y, { align: 'center' })
  y += 4

  // Technician box
  doc.setDrawColor(140, 140, 140)
  doc.setFillColor(255, 255, 255)
  doc.rect(marginL, y, sigW, 28, 'FD')

  // Store staff box
  doc.rect(marginL + sigW + 10, y, sigW, 28, 'FD')

  // Labels inside boxes — order: ลายเซ็น → ชื่อ → วันที่
  doc.setFont(font, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)

  // Technician box
  doc.text('ลายเซ็น: ________________', marginL + 3, y + 10)
  doc.text('ชื่อ: ____________________', marginL + 3, y + 18)
  doc.text(`วันที่: ${dateStr}`, marginL + 3, y + 25)

  // Store staff box
  doc.text('ลายเซ็น / ประทับตรา: ____', marginL + sigW + 13, y + 10)
  doc.text('ชื่อ: ____________________', marginL + sigW + 13, y + 18)
  doc.text('วันที่: __________________', marginL + sigW + 13, y + 25)

  // Technician name pre-fill (under the signature line)
  if (data.technicianName) {
    doc.setFont(font, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(40, 40, 40)
    doc.text(data.technicianName, marginL + 3, y + 5)
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
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
