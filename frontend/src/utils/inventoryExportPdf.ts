// frontend/src/utils/inventoryExportPdf.ts
// Inventory Export PDF — white header, professional table layout

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InventoryExportEquipment {
  name: string
  serialNumber?: string | null
  category?: string | null
  brand?: string | null
  model?: string | null
  status: string
  purchaseDate?: string | null
  warrantyExpiry?: string | null
  imagePath?: string | null
}

export interface InventoryExportData {
  store: {
    storeCode: string
    name: string
    province?: string | null
    address?: string | null
  }
  equipment: InventoryExportEquipment[]
  orgLogo?: string | null      // base64 data URL
  orgName?: string | null
  systemName?: string | null   // e.g. "Watsons Incident Management"
}

// ─── Constants ───────────────────────────────────────────────────────────────
const COL_HEAD:  [number, number, number] = [90, 100, 115]  // slate grey
const TEXT_DARK: [number, number, number] = [30, 41, 59]
const TEXT_MID:  [number, number, number] = [71, 85, 105]
const TEXT_MUTED:[number, number, number] = [148, 163, 184]
const ACCENT:    [number, number, number] = [162, 128, 66]  // warm brass / gold
const ROW_ALT:   [number, number, number] = [248, 248, 250]
const GRID:      [number, number, number] = [218, 224, 234]

function formatDate(d?: string | null): string {
  if (!d) return '-'
  try {
    const dt = new Date(d)
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yyyy = dt.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return '-'
  }
}

function todayShort(): string {
  const dt = new Date()
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yyyy = dt.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

async function loadSarabunFont(doc: jsPDF): Promise<string> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const [regRes, boldRes] = await Promise.all([
      fetch(`${origin}/fonts/Sarabun-Regular.ttf`),
      fetch(`${origin}/fonts/Sarabun-Bold.ttf`),
    ])
    if (!regRes.ok || !boldRes.ok) return 'helvetica'
    const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()])
    const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    doc.addFileToVFS('Sarabun-Regular.ttf', b64(regBuf))
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
    doc.addFileToVFS('Sarabun-Bold.ttf', b64(boldBuf))
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold')
    doc.setFont('Sarabun', 'normal')
    return 'Sarabun'
  } catch {
    return 'helvetica'
  }
}

function hLine(doc: jsPDF, x: number, y: number, w: number, color: [number, number, number], lw = 0.3) {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(lw)
  doc.line(x, y, x + w, y)
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function generateInventoryExportPDF(data: InventoryExportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const font = await loadSarabunFont(doc)

  const pageW  = doc.internal.pageSize.getWidth()   // 210
  const pageH  = doc.internal.pageSize.getHeight()  // 297
  const margin = 12
  const cW     = pageW - margin * 2                 // 186

  const systemLabel = data.systemName || (data.orgName ? `${data.orgName} Incident Management` : 'Incident Management')
  const storeStr    = `${data.store.storeCode} ${data.store.name}`
  const printDate   = todayShort()

  // ═══════════════════════════════════════════════════════════════════
  //  HEADER — white background
  // ═══════════════════════════════════════════════════════════════════
  const logoW   = 22
  const logoH   = 22
  const headerH = 36

  // Logo (left)
  let logoEndX = margin
  if (data.orgLogo) {
    try {
      const fmt = data.orgLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(data.orgLogo, fmt, margin, 9, logoW, logoH)
      logoEndX = margin + logoW + 5
    } catch { /* skip */ }
  }

  // Title
  doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  doc.text('EQUIPMENT INVENTORY', logoEndX, 14.5)

  // Subtitle
  doc.setFont(font, 'normal'); doc.setFontSize(9.5); doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2])
  doc.text('รายการอุปกรณ์ประจำสาขา', logoEndX, 20)

  // Store ID + Name below subtitle
  doc.setFont(font, 'bold'); doc.setFontSize(9); doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
  doc.text(storeStr, logoEndX, 25.5)

  // Province below store name
  if (data.store.province) {
    doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2])
    doc.text(data.store.province, logoEndX, 30.5)
  }

  // Accent divider
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.rect(margin, headerH, cW, 0.8, 'F')

  const tableStartY = headerH + 4

  // ═══════════════════════════════════════════════════════════════════
  //  PRE-FETCH EQUIPMENT IMAGES
  // ═══════════════════════════════════════════════════════════════════
  const apiBase = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')
    : ''

  const sortedEquipment = [...data.equipment].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'th', { sensitivity: 'base' })
  )

  const imageCache: Record<number, { dataUrl: string; format: string } | null> = {}
  await Promise.all(
    sortedEquipment.map(async (eq, i) => {
      if (!eq.imagePath) { imageCache[i] = null; return }
      try {
        const res = await fetch(`${apiBase}${eq.imagePath}`)
        if (!res.ok) { imageCache[i] = null; return }
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
        imageCache[i] = { dataUrl, format }
      } catch {
        imageCache[i] = null
      }
    })
  )

  // ═══════════════════════════════════════════════════════════════════
  //  DATA TABLE — cols: #(10)+Name(40)+Cat(22)+Brand/Model(32)+Serial(32)+Warranty(22)+Picture(28)=186
  // ═══════════════════════════════════════════════════════════════════
  const IMG_COL_H = 20  // row height when image present (mm)
  const rows = sortedEquipment.map((eq, i) => [
    String(i + 1),
    eq.name || '-',
    eq.category || '-',
    [eq.brand, eq.model].filter(Boolean).join(' ') || '-',
    eq.serialNumber || '-',
    formatDate(eq.warrantyExpiry),
    imageCache[i] ? ' ' : '-',   // placeholder; image drawn in didDrawCell
  ])

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Equipment Name', 'Category', 'Brand / Model', 'Serial No.', 'Warranty', 'Picture']],
    body: rows,
    theme: 'plain',
    styles: {
      font,
      fontSize: 7,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
      textColor: TEXT_DARK,
      lineColor: GRID,
      lineWidth: 0.2,
      overflow: 'ellipsize',
      minCellHeight: 7,
    },
    headStyles: {
      fillColor: COL_HEAD,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 9,
      lineWidth: 0,
      overflow: 'ellipsize',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: TEXT_MUTED },
      1: { cellWidth: 40 },
      2: { cellWidth: 22, textColor: TEXT_MID },
      3: { cellWidth: 32, textColor: TEXT_MID },
      4: { cellWidth: 32, fontSize: 6.5 },
      5: { cellWidth: 22, halign: 'center', textColor: TEXT_MID, fontSize: 6.5 },
      6: { cellWidth: 28, halign: 'center' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (h) => {
      // Make rows with images taller
      if (h.section === 'body' && h.column.index === 6 && imageCache[h.row.index]) {
        h.cell.styles.minCellHeight = IMG_COL_H
      }
      if (h.section === 'body' && h.column.index === 5 && h.cell.raw === '-') {
        h.cell.styles.textColor = TEXT_MUTED
      }
    },
    didDrawCell: (h) => {
      if (h.section === 'body') {
        hLine(doc, h.cell.x, h.cell.y + h.cell.height, h.cell.width, GRID, 0.15)
        // Draw equipment image in last column
        if (h.column.index === 6) {
          const img = imageCache[h.row.index]
          if (img) {
            const pad = 2
            const imgH = h.cell.height - pad * 2
            const imgW = h.cell.width - pad * 2
            try {
              doc.addImage(img.dataUrl, img.format, h.cell.x + pad, h.cell.y + pad, imgW, imgH)
            } catch { /* skip broken image */ }
          }
        }
      }
    },
    didDrawPage: (h) => {
      if (h.pageNumber > 1) {
        doc.setFillColor(255, 255, 255)
        doc.rect(0, 0, pageW, 14, 'F')
        doc.setFont(font, 'bold'); doc.setFontSize(9); doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
        doc.text('EQUIPMENT INVENTORY', margin, 9)
        doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2])
        doc.text(`${storeStr}${data.store.province ? ' · ' + data.store.province : ''}`, margin + 56, 9)
        doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2])
        doc.rect(margin, 12, cW, 0.6, 'F')
      }
    },
  })

  // ═══════════════════════════════════════════════════════════════════
  //  TOTAL ROW (last page only, right-aligned)
  // ═══════════════════════════════════════════════════════════════════
  const finalY = (doc as any).lastAutoTable.finalY
  const totalY = finalY + 5

  if (totalY < pageH - 55) {
    doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2])
    doc.text(`รวมทั้งหมด  ${data.equipment.length}  รายการ`, pageW - margin, totalY, { align: 'right' })
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STORE MANAGER SIGNATURE (bottom-right, no card)
  // ═══════════════════════════════════════════════════════════════════
  const sigRX2    = pageW - margin           // 198  right edge
  const sigRX1    = sigRX2 - 82             // 116  left edge of block
  const sigBaseY  = pageH - 30             // baseline above footer

  doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2])

  // Row 1: ลงชื่อ ___ ผู้ตรวจสอบ  — text close to line, shorter line
  const prefixW  = 16                      // tight gap after "ลงชื่อ"
  const suffixW  = 14                      // tight gap before "ผู้ตรวจสอบ"
  const lineX1   = sigRX1 + prefixW        // 132
  const lineX2   = sigRX2 - suffixW        // 184  → sig line = 52mm
  const sigLineY = sigBaseY

  doc.text('ลงชื่อ', lineX1 - 1, sigLineY, { align: 'right' })
  doc.setDrawColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
  doc.setLineWidth(0.2)
  ;(doc as any).setLineDashPattern([], 0)
  doc.line(lineX1 + 1, sigLineY, lineX2 - 1, sigLineY)
  doc.text('ผู้ตรวจสอบ', lineX2 + 1, sigLineY)

  // Row 2: ( ........... ) — wider than sig line, balanced
  const nameY   = sigLineY + 8
  const nameCx  = (sigRX1 + sigRX2) / 2
  doc.text('(...................................................................)', nameCx, nameY, { align: 'center' })

  // Row 3: วันที่
  const dateY = nameY + 8
  doc.text('วันที่............./............./.............', nameCx, dateY, { align: 'center' })

  // ═══════════════════════════════════════════════════════════════════
  //  STAMP WATERMARK (last page, bottom-left)
  // ═══════════════════════════════════════════════════════════════════
  doc.setFont(font, 'normal'); doc.setFontSize(11); doc.setTextColor(228, 230, 235)
  doc.text('ประทับตราร้านค้า', margin + 38, pageH - 28, { align: 'center' })

  // ═══════════════════════════════════════════════════════════════════
  //  PAGE FOOTER
  // ═══════════════════════════════════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    const fy = pageH - 7
    hLine(doc, margin, fy - 3, cW, GRID, 0.25)
    doc.setFont(font, 'normal'); doc.setFontSize(6.5); doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2])
    doc.text(systemLabel, margin, fy)
    doc.text(`หน้า ${p} / ${totalPages}`, pageW / 2, fy, { align: 'center' })
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SAVE
  // ═══════════════════════════════════════════════════════════════════
  const safeStore = `${data.store.storeCode}-${data.store.name}`.replace(/\s+/g, '_')
  const dateStr = new Date().toISOString().split('T')[0]
  doc.save(`inventory-${safeStore}-${dateStr}.pdf`)
}
