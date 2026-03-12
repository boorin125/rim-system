import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { applyPdfWatermark } from './pdfWatermark'

export interface ServiceReportData {
  organizationName: string
  organizationLogo: string
  organizationAddress: string
  providerName?: string
  providerAddress?: string
  providerPhone?: string
  providerEmail?: string
  providerTaxId?: string
  providerLogo?: string
  ticketNumber: string
  title: string
  description?: string
  category?: string
  priority: string
  status: string
  store?: {
    storeCode: string
    name: string
    company?: string
    address?: string
    province?: string
    phone?: string
    email?: string
  }
  technician?: { name: string; phone?: string }
  technicians?: { name: string; phone?: string }[]
  checkedInTechnicians?: { name: string; phone?: string }[]
  resolvedBy?: { name: string; signaturePath?: string | null }
  resolutionNote?: string
  usedSpareParts: boolean
  spareParts: {
    deviceName: string
    oldSerialNo: string
    newSerialNo: string
    repairType: string
    equipmentName?: string
    oldBrandModel?: string
    newBrandModel?: string
  }[]
  createdAt: string
  checkInAt?: string
  resolvedAt?: string
  confirmedAt?: string
  customerSignature?: string | null
  customerSignatureName?: string | null
  customerSignedAt?: string | null
  comment?: string
  reportUrl: string
  themeColors?: { bgStart: string; bgEnd: string }
}

interface PdfOptions {
  blankSignature?: boolean
  returnBlob?: boolean
  style?: 'classic' | 'modern'
}

/** Convert Blob to base64 data URL using FileReader (more reliable than manual conversion) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Load image from URL and convert to data URL */
async function loadImageAsDataURL(url: string): Promise<string | null> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const fullUrl = url.startsWith('http') ? url : `${origin}${url}`
    const response = await fetch(fullUrl)
    if (!response.ok) return null
    const blob = await response.blob()
    return await blobToBase64(blob)
  } catch (error) {
    console.error('Failed to load image:', error)
    return null
  }
}

async function loadThaiFont(doc: jsPDF): Promise<boolean> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const [regularRes, boldRes] = await Promise.all([
      fetch(`${origin}/fonts/Sarabun-Regular.ttf`),
      fetch(`${origin}/fonts/Sarabun-Bold.ttf`),
    ])

    if (!regularRes.ok || !boldRes.ok) {
      console.error('Font fetch failed:', regularRes.status, boldRes.status)
      return false
    }

    const [regularBlob, boldBlob] = await Promise.all([
      regularRes.blob(),
      boldRes.blob(),
    ])

    // Use FileReader for reliable base64 conversion
    const [regularDataUrl, boldDataUrl] = await Promise.all([
      blobToBase64(regularBlob),
      blobToBase64(boldBlob),
    ])

    // Extract raw base64 (remove "data:...;base64," prefix)
    const regularB64 = regularDataUrl.split(',')[1]
    const boldB64 = boldDataUrl.split(',')[1]

    if (!regularB64 || !boldB64) {
      console.error('Font base64 extraction failed')
      return false
    }

    doc.addFileToVFS('Sarabun-Regular.ttf', regularB64)
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
    doc.addFileToVFS('Sarabun-Bold.ttf', boldB64)
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold')
    doc.setFont('Sarabun')
    return true
  } catch (e) {
    console.error('Thai font loading failed:', e)
    return false
  }
}

async function fetchImageAsBase64(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) {
      console.error('Image fetch failed:', res.status, url)
      return null
    }
    const blob = await res.blob()
    const dataUrl = await blobToBase64(blob)
    const ct = blob.type || ''
    const format = (ct.includes('jpeg') || ct.includes('jpg')) ? 'JPEG' : 'PNG'
    return { dataUrl, format }
  } catch (e) {
    console.error('Image fetch error:', e)
    return null
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Helper: get common provider info with fallbacks */
function getProviderInfo(data: ServiceReportData) {
  return {
    headerLogo: data.providerLogo || data.organizationLogo,
    headerName: data.providerName || data.organizationName || 'Service Report',
    headerAddress: data.providerAddress || data.organizationAddress,
    headerPhone: data.providerPhone || '',
    headerEmail: data.providerEmail || '',
    headerTaxId: data.providerTaxId || '',
  }
}

function hexToHSL(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (mx + mn) / 2
  if (mx !== mn) {
    const d = mx - mn
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (mx === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
  }
  return [f(0), f(8), f(4)]
}

/** Helper: add COPY watermark to all pages */
function addCopyWatermark(doc: jsPDF, font: string) {
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    ;(doc as any).saveGraphicsState()
    const pW = doc.internal.pageSize.getWidth()
    const pH = doc.internal.pageSize.getHeight()
    doc.setFont(font, 'bold')
    doc.setFontSize(80)
    doc.setTextColor(200, 200, 200)
    // @ts-ignore - GState is available in jsPDF
    ;(doc as any).setGState(new (doc as any).GState({ opacity: 0.3 }))
    // Centered horizontally; shifted down so watermark starts at the Problem section area
    doc.text('COPY', pW / 2, pH / 2 + 22, { align: 'center', angle: 45 })
    ;(doc as any).restoreGraphicsState()
  }
}

/** Helper: add footer text */
function addFooter(doc: jsPDF, font: string, data: ServiceReportData) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont(font, 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(180, 180, 180)
  const footerText = data.providerName || data.organizationName
    ? `${data.providerName || data.organizationName} - Incident Management System`
    : 'Incident Management System'
  doc.text(footerText, pageWidth / 2, pageHeight - 6, { align: 'center' })
}

/** Helper: draw signatures section (customer left | service middle | QR right, same row) */
async function drawSignatures(
  doc: jsPDF, font: string, data: ServiceReportData, blankSignature: boolean,
  startY: number, margin: number, contentWidth: number, reportUrl: string
): Promise<number> {
  const sigH = 30
  // 3-column layout: two sig boxes + QR box
  const sigW = Math.round(contentWidth * 0.375)   // ~71mm each
  const qrW = contentWidth - sigW * 2              // ~48mm for QR
  const leftX = margin
  const midX = margin + sigW
  const qrX = margin + sigW * 2
  const boxTop = startY

  const leftCX = leftX + sigW / 2
  const midCX = midX + sigW / 2
  const qrCX = qrX + qrW / 2

  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.rect(leftX, boxTop, sigW, sigH)
  doc.rect(midX, boxTop, sigW, sigH)
  doc.rect(qrX, boxTop, qrW, sigH)

  // -- Customer (left) --
  doc.setFont(font, 'normal'); doc.setFontSize(6.5); doc.setTextColor(120, 120, 120)
  doc.text('ลายเซ็นลูกค้า / Customer', leftCX, boxTop + 3.5, { align: 'center' })

  if (!blankSignature && data.customerSignature) {
    try { doc.addImage(data.customerSignature, 'PNG', leftCX - 18, boxTop + 4.5, 36, 11) } catch { /* skip */ }
  }

  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3)
  doc.line(leftCX - 22, boxTop + 18, leftCX + 22, boxTop + 18)

  if (!blankSignature && data.customerSignatureName) {
    doc.setFont(font, 'bold'); doc.setFontSize(7); doc.setTextColor(0, 0, 0)
    doc.text(`( ${data.customerSignatureName} )`, leftCX, boxTop + 21.5, { align: 'center' })
  }
  if (!blankSignature && data.customerSignedAt) {
    doc.setFont(font, 'normal'); doc.setFontSize(6); doc.setTextColor(120, 120, 120)
    doc.text(formatDate(data.customerSignedAt), leftCX, boxTop + 25, { align: 'center' })
  }

  // -- Service / Technician (middle) --
  doc.setFont(font, 'normal'); doc.setFontSize(6.5); doc.setTextColor(120, 120, 120)
  doc.text('ลายเซ็นผู้ให้บริการ / Service', midCX, boxTop + 3.5, { align: 'center' })

  if (!blankSignature && data.resolvedBy) {
    if (data.resolvedBy.signaturePath) {
      try {
        const apiBase = (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') || ''
        const backendBase = apiBase.replace('/api', '')
        const signatureDataUrl = await loadImageAsDataURL(`${backendBase}/uploads/${data.resolvedBy.signaturePath}`)
        if (signatureDataUrl) {
          doc.addImage(signatureDataUrl, 'PNG', midCX - 18, boxTop + 4.5, 36, 11)
        } else {
          doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0)
          doc.text(data.resolvedBy.name, midCX, boxTop + 13, { align: 'center' })
        }
      } catch {
        doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0)
        doc.text(data.resolvedBy.name, midCX, boxTop + 13, { align: 'center' })
      }
    } else {
      doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0)
      doc.text(data.resolvedBy.name, midCX, boxTop + 13, { align: 'center' })
    }
  }

  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3)
  doc.line(midCX - 22, boxTop + 18, midCX + 22, boxTop + 18)

  if (!blankSignature && data.resolvedBy) {
    const resolverName = data.resolvedBy.name
    const sigName = data.technicians && data.technicians.length > 0
      ? [...data.technicians.filter(t => t.name === resolverName), ...data.technicians.filter(t => t.name !== resolverName)].map(t => t.name).join(', ')
      : resolverName
    doc.setFont(font, 'bold'); doc.setFontSize(7); doc.setTextColor(0, 0, 0)
    doc.text(`( ${sigName} )`, midCX, boxTop + 21.5, { align: 'center' })
  }
  if (!blankSignature && data.resolvedAt) {
    doc.setFont(font, 'normal'); doc.setFontSize(6); doc.setTextColor(120, 120, 120)
    doc.text(formatDate(data.resolvedAt), midCX, boxTop + 25, { align: 'center' })
  }

  // -- QR Code (right box) --
  try {
    const qrDataUrl = await QRCode.toDataURL(reportUrl, { width: 150, margin: 1 })
    const qrSize = Math.min(qrW - 10, 22)
    doc.addImage(qrDataUrl, 'PNG', qrCX - qrSize / 2, boxTop + 3, qrSize, qrSize)
  } catch { /* skip QR */ }
  doc.setFont(font, 'normal'); doc.setFontSize(5); doc.setTextColor(150, 150, 150)
  doc.text('Scan for digital copy', qrCX, boxTop + sigH - 1.5, { align: 'center' })

  return boxTop + sigH + 3
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║                    CLASSIC PDF GENERATOR                        ║
// ╚══════════════════════════════════════════════════════════════════╝

async function generateClassicPDF(data: ServiceReportData, options: PdfOptions): Promise<Blob | void> {
  const blankSignature = options.blankSignature ?? false
  const returnBlob = options.returnBlob ?? false
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasThai = await loadThaiFont(doc)
  const font = hasThai ? 'Sarabun' : 'helvetica'
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  let y = 16

  const { headerLogo, headerName, headerAddress, headerPhone, headerEmail, headerTaxId } = getProviderInfo(data)

  // ========== HEADER: Logo (left) + Company Info (right) ==========
  const headerStartY = y
  if (headerLogo) {
    try {
      const logoUrl = `${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${headerLogo}`
      const imgData = await fetchImageAsBase64(logoUrl)
      if (imgData) doc.addImage(imgData.dataUrl, imgData.format, margin, y, 42, 28)
    } catch (e) { console.error('Logo addImage failed:', e) }
  }

  const rightX = pageWidth - margin
  doc.setFont(font, 'bold'); doc.setFontSize(16); doc.setTextColor(0, 0, 0)
  doc.text(headerName, rightX, y + 8, { align: 'right' })
  doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
  let infoY = y + 13
  if (headerAddress) {
    const addressLines = doc.splitTextToSize(headerAddress, pageWidth * 0.55)
    for (const line of addressLines) { doc.text(line, rightX, infoY, { align: 'right' }); infoY += 3.5 }
  }
  const contactParts: string[] = []
  if (headerPhone) contactParts.push(`Tel: ${headerPhone}`)
  if (headerEmail) contactParts.push(`Email: ${headerEmail}`)
  if (contactParts.length > 0) { doc.setFontSize(7.5); doc.text(contactParts.join('  '), rightX, infoY, { align: 'right' }); infoY += 3.5 }
  if (headerTaxId) { doc.setFontSize(7.5); doc.text(`เลขประจำตัวผู้เสียภาษี: ${headerTaxId}`, rightX, infoY, { align: 'right' }) }

  y = headerStartY + 31
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  y += 0.5

  // ========== TITLE BAR ==========
  doc.setFillColor(50, 50, 50)
  doc.rect(margin, y, contentWidth, 7, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
  doc.text('SERVICE REPORT / ใบรายงานบริการ', pageWidth / 2, y + 5, { align: 'center' })
  y += 7

  const sectionGap = 5
  y += sectionGap

  // ========== DETAIL TABLE ==========
  const storeDisplay = data.store ? `${data.store.storeCode} ${data.store.name}` : '-'
  const storeAddress = data.store ? [data.store.address, data.store.province].filter(Boolean).join(', ') || '-' : '-'

  const cellPad = { top: 1, bottom: 1, left: 2.5, right: 1.5 }
  const labelStyle = { fontStyle: 'bold' as const, cellWidth: contentWidth * 0.28, fillColor: [220, 220, 220] as [number, number, number], textColor: [40, 40, 40] as [number, number, number], fontSize: 7 }
  const valueStyle = { cellWidth: contentWidth * 0.22 }
  const gridLine = { lineColor: [160, 160, 160] as [number, number, number], lineWidth: 0.2 }

  const topRows = [
    ['Ticket ID / Job No.', data.ticketNumber, 'วันเข้าปฏิบัติงาน / Started Date', data.checkInAt ? formatDate(data.checkInAt) : '-'],
    ['ชื่อลูกค้า / Customer Name', data.store?.company || '-', 'เลขที่ร้านค้า สาขา / Store ID Store Name', storeDisplay],
  ]

  autoTable(doc, { startY: y, body: topRows, theme: 'grid', styles: { font, fontSize: 7.5, cellPadding: cellPad, ...gridLine, textColor: [0, 0, 0], minCellHeight: 6 }, columnStyles: { 0: labelStyle, 1: valueStyle, 2: labelStyle, 3: valueStyle }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  const labelStyleWide = { fontStyle: 'bold' as const, cellWidth: contentWidth * 0.28, fillColor: [220, 220, 220] as [number, number, number], textColor: [40, 40, 40] as [number, number, number], fontSize: 7 }
  autoTable(doc, { startY: y, body: [['ที่อยู่ / Address', storeAddress]], theme: 'grid', styles: { font, fontSize: 7.5, cellPadding: cellPad, ...gridLine, textColor: [0, 0, 0] }, columnStyles: { 0: labelStyleWide, 1: { cellWidth: contentWidth * 0.72 } }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  autoTable(doc, { startY: y, body: [['เบอร์โทร / Phone', data.store?.phone || '-', 'อีเมล / E-mail', data.store?.email || '-']], theme: 'grid', styles: { font, fontSize: 7.5, cellPadding: cellPad, ...gridLine, textColor: [0, 0, 0], minCellHeight: 6 }, columnStyles: { 0: labelStyle, 1: valueStyle, 2: labelStyle, 3: valueStyle }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  const techName = data.technicians && data.technicians.length > 0 ? data.technicians.map(t => t.name).join(', ') : data.technician?.name || data.resolvedBy?.name || '-'
  autoTable(doc, { startY: y, body: [['ช่างเทคนิค / Technician', techName, 'วันเวลา แก้ไขเสร็จ / Time to Finish', data.resolvedAt ? formatDate(data.resolvedAt) : '-']], theme: 'grid', styles: { font, fontSize: 7.5, cellPadding: cellPad, ...gridLine, textColor: [0, 0, 0], minCellHeight: 6 }, columnStyles: { 0: labelStyle, 1: valueStyle, 2: labelStyle, 3: valueStyle }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  // ========== SECTION 2: Problem / Resolution ==========
  y += sectionGap
  const sectionHeaderStyle = { font, fontSize: 8, fontStyle: 'bold' as const, cellPadding: { top: 1, bottom: 1, left: 2.5, right: 2 }, ...gridLine, fillColor: [220, 220, 220] as [number, number, number], textColor: [40, 40, 40] as [number, number, number] }

  // Compute dynamic min heights so all 3 text sections + spare parts fit on 1 page
  // Budget: page(297) - footer(15) - current_y - tail(sectionGaps + spare parts + remark + status + sig header + sig)
  const _spN = (data.usedSpareParts && data.spareParts.length > 0) ? data.spareParts.length : 0
  const _spTableH = 7 + (_spN > 0 ? _spN * 5.5 : 5.5)
  const _fixedTail = 5 + 6 + _spTableH + 6 + 6 + 5 + 6 + 30  // gap+spHeader+spRows+remark+status+gap+sigHeader+sig
  const _availForText = 282 - y - _fixedTail
  const D_PROB = 30, D_WORK = 30, D_COMMENT = 20
  let _problemMin = D_PROB, _workMin = D_WORK, _commentMin = D_COMMENT
  const _deficit = (D_PROB + D_WORK + D_COMMENT) - _availForText
  if (_deficit > 0) {
    _commentMin = Math.max(8, D_COMMENT - _deficit)
    const _r1 = Math.max(0, _deficit - (D_COMMENT - _commentMin))
    _workMin = Math.max(8, D_WORK - _r1)
    const _r2 = Math.max(0, _r1 - (D_WORK - _workMin))
    _problemMin = Math.max(8, D_PROB - _r2)
  }

  const lineSpacing = 5
  const drawLinedContent = (cellDoc: jsPDF, cellData: any) => {
    if (cellData.section === 'body') {
      const cell = cellData.cell
      cellDoc.setDrawColor(220, 220, 220); cellDoc.setLineWidth(0.15)
      for (let ly = cell.y + lineSpacing; ly < cell.y + cell.height; ly += lineSpacing) {
        cellDoc.line(cell.x + 1, ly, cell.x + cell.width - 1, ly)
      }
    }
  }

  autoTable(doc, { startY: y, body: [['ปัญหา / อาการเสีย / Problem / Symptoms']], theme: 'grid', styles: sectionHeaderStyle, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY
  const problemContentStyle = { font, fontSize: 7.5, cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2.5 }, ...gridLine, textColor: [0, 0, 0] as [number, number, number], minCellHeight: _problemMin }
  autoTable(doc, { startY: y, body: [['    ' + (data.title || '-')]], theme: 'grid', styles: problemContentStyle, margin: { left: margin, right: margin }, didDrawCell: (cellData) => drawLinedContent(doc, cellData) })
  y = (doc as any).lastAutoTable.finalY

  autoTable(doc, { startY: y, body: [['วิธีการแก้ไขปัญหา / Work Performance']], theme: 'grid', styles: sectionHeaderStyle, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY
  const workContentStyle = { font, fontSize: 7.5, cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2.5 }, ...gridLine, textColor: [0, 0, 0] as [number, number, number], minCellHeight: _workMin }
  autoTable(doc, { startY: y, body: [['    ' + (data.resolutionNote || '-')]], theme: 'grid', styles: workContentStyle, margin: { left: margin, right: margin }, didDrawCell: (cellData) => drawLinedContent(doc, cellData) })
  y = (doc as any).lastAutoTable.finalY

  autoTable(doc, { startY: y, body: [['คำแนะนำ/เพิ่มเติม / Comment']], theme: 'grid', styles: sectionHeaderStyle, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY
  const commentContentStyle = { font, fontSize: 7.5, cellPadding: { top: 1.5, bottom: 1.5, left: 2.5, right: 2.5 }, ...gridLine, textColor: [0, 0, 0] as [number, number, number], minCellHeight: _commentMin }
  autoTable(doc, { startY: y, body: [['    ' + (data.comment || '-')]], theme: 'grid', styles: commentContentStyle, margin: { left: margin, right: margin }, didDrawCell: (cellData) => drawLinedContent(doc, cellData) })
  y = (doc as any).lastAutoTable.finalY

  // ========== SPARE PARTS ==========
  y += sectionGap
  autoTable(doc, { startY: y, body: [['อะไหล่ที่เปลี่ยน / Spare Parts']], theme: 'grid', styles: sectionHeaderStyle, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  {
    const hasParts = data.usedSpareParts && data.spareParts.length > 0
    const spRows: string[][] = []
    if (hasParts) {
      for (const sp of data.spareParts) {
        spRows.push([
          String(spRows.length + 1),
          sp.equipmentName || sp.deviceName || '-',
          sp.oldBrandModel || '-',
          sp.oldSerialNo || '-',
          sp.newBrandModel || '-',
          sp.newSerialNo || '-',
        ])
      }
    } else {
      spRows.push(['', 'ไม่มีการเปลี่ยนอะไหล่', '', '', '', ''])
    }

    const colW = (contentWidth - 7) / 5
    const spColWidths = {
      0: { cellWidth: 7, halign: 'center' as const },
      1: { cellWidth: colW },
      2: { cellWidth: colW },
      3: { cellWidth: colW },
      4: { cellWidth: colW },
      5: { cellWidth: colW },
    }
    autoTable(doc, {
      startY: y,
      head: [['#', 'Equipment Name', 'อุปกรณ์เดิม/ Old', 'Old Serial No.', 'อุปกรณ์ใหม่/ New', 'New Serial No.']],
      body: spRows,
      theme: 'grid',
      styles: { font, fontSize: 6.5, cellPadding: { top: 1, bottom: 1, left: 2, right: 2 }, ...gridLine, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: spColWidths,
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY
  }

  // Remark + Status
  const remarkLabelStyle = { fontStyle: 'bold' as const, cellWidth: contentWidth * 0.28, fillColor: [220, 220, 220] as [number, number, number], textColor: [40, 40, 40] as [number, number, number], fontSize: 7 }
  autoTable(doc, { startY: y, body: [['หมายเหตุ / Remark', '-']], theme: 'grid', styles: { font, fontSize: 7.5, cellPadding: { top: 1, bottom: 1, left: 2.5, right: 2 }, ...gridLine, textColor: [0, 0, 0], minCellHeight: 6 }, columnStyles: { 0: remarkLabelStyle, 1: { cellWidth: contentWidth * 0.72 } }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  autoTable(doc, { startY: y, body: [['สถานะงานบริการ / Service Status', data.status]], theme: 'grid', styles: { font, fontSize: 7.5, cellPadding: { top: 1, bottom: 1, left: 2.5, right: 2 }, ...gridLine, textColor: [0, 0, 0], minCellHeight: 6 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: contentWidth * 0.28, fillColor: [220, 220, 220], textColor: [40, 40, 40], fontSize: 7 }, 1: { cellWidth: contentWidth * 0.72 } }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  // ========== SIGNATURES ==========
  y += sectionGap
  autoTable(doc, { startY: y, body: [['ลายเซ็น / Signatures']], theme: 'grid', styles: { ...sectionHeaderStyle, halign: 'center' as const }, margin: { left: margin, right: margin } })
  y = (doc as any).lastAutoTable.finalY

  y = await drawSignatures(doc, font, data, blankSignature, y, margin, contentWidth, data.reportUrl)

  // Footer
  addFooter(doc, font, data)

  // Watermark
  if (!blankSignature) addCopyWatermark(doc, font)
  applyPdfWatermark(doc, { orgName: data.organizationName, ticketNumber: data.ticketNumber })

  if (returnBlob) return doc.output('blob')
  doc.save(`service-report-${data.ticketNumber}.pdf`)
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║                    MODERN PDF GENERATOR                         ║
// ╚══════════════════════════════════════════════════════════════════╝

async function generateModernPDF(data: ServiceReportData, options: PdfOptions): Promise<Blob | void> {
  const blankSignature = options.blankSignature ?? false
  const returnBlob = options.returnBlob ?? false
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasThai = await loadThaiFont(doc)
  const font = hasThai ? 'Sarabun' : 'helvetica'
  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const margin = 10
  const contentWidth = pageWidth - margin * 2 // 190mm
  let y = 0

  const { headerLogo, headerName, headerAddress, headerPhone, headerEmail, headerTaxId } = getProviderInfo(data)

  // Color scheme — HSL-adjusted so colors are always recognizable (not too dark / too light)
  const rawP = data.themeColors ? hexToHSL(data.themeColors.bgStart) : hexToHSL('#1e3a5f')
  const rawA = data.themeColors ? hexToHSL(data.themeColors.bgEnd) : hexToHSL('#0d9488')
  const pSatD = rawP[1] < 5 ? rawP[1] : Math.max(rawP[1], 30)
  const pSatL = rawP[1] < 5 ? rawP[1] : Math.max(rawP[1], 35)
  const aSatD = rawA[1] < 5 ? rawA[1] : Math.max(rawA[1], 30)
  // Dark: lightness 15-40%, Light tint: lightness 95%
  const accent = hslToRgb(rawA[0], aSatD, Math.max(20, Math.min(45, rawA[2])))
  const primaryTint = hslToRgb(rawP[0], pSatL, 95)
  const lightBg = [245, 247, 250] as [number, number, number]  // very light gray
  const textDark = [30, 41, 59] as [number, number, number]
  const textGray = [100, 116, 139] as [number, number, number]

  // ========== HEADER: White background ==========
  const headerH = 40
  // Bottom border line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(0, headerH, pageWidth, headerH)

  // Logo in header (left)
  if (headerLogo) {
    try {
      const logoUrl = `${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${headerLogo}`
      const imgData = await fetchImageAsBase64(logoUrl)
      if (imgData) doc.addImage(imgData.dataUrl, imgData.format, margin + 1, 8, 40, 27)
    } catch { /* skip */ }
  }

  // Company info in header (right, dark text on white)
  const rightX = pageWidth - margin
  doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(30, 41, 59)
  doc.text(headerName, rightX, 16, { align: 'right' })
  doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139)
  let infoY = 21
  if (headerAddress) {
    const lines = doc.splitTextToSize(headerAddress, pageWidth * 0.50)
    for (const line of lines) { doc.text(line, rightX, infoY, { align: 'right' }); infoY += 3.2 }
  }
  const contactLine: string[] = []
  if (headerPhone) contactLine.push(`Tel: ${headerPhone}`)
  if (headerEmail) contactLine.push(headerEmail)
  if (contactLine.length > 0) { doc.setFontSize(7); doc.text(contactLine.join('  |  '), rightX, infoY, { align: 'right' }); infoY += 3.2 }
  if (headerTaxId) { doc.setFontSize(7); doc.text(`Tax ID: ${headerTaxId}`, rightX, infoY, { align: 'right' }) }

  y = headerH + 2

  // ========== TITLE BAR (accent color, same as download button) ==========
  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(margin, y, contentWidth, 8, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
  doc.text('SERVICE REPORT / ใบรายงานบริการ', margin + 4, y + 5.5)

  // Ticket number (right side, same white color as title)
  doc.setFont(font, 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
  doc.text(data.ticketNumber, pageWidth - margin - 3, y + 5.5, { align: 'right' })

  y += 12

  // ========== DETAIL CARDS (2-column grid) ==========
  const storeDisplay = data.store ? `${data.store.storeCode} ${data.store.name}` : '-'
  const storeAddress = data.store ? [data.store.address, data.store.province].filter(Boolean).join(', ') || '-' : '-'

  const cardW = (contentWidth - 3) / 2
  const cardH = 12
  const cardPad = 2.5

  const drawCard = (x: number, cy: number, label: string, value: string, w = cardW) => {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
    doc.roundedRect(x, cy, w, cardH, 1.5, 1.5, 'F')
    doc.setFont(font, 'normal'); doc.setFontSize(6); doc.setTextColor(textGray[0], textGray[1], textGray[2])
    doc.text(label, x + cardPad, cy + 4)
    doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(textDark[0], textDark[1], textDark[2])
    const valLines = doc.splitTextToSize(value, w - cardPad * 2)
    doc.text(valLines[0] || '-', x + cardPad, cy + 9)
  }

  // Row 1
  drawCard(margin, y, 'ชื่อลูกค้า / Customer', data.store?.company || '-')
  drawCard(margin + cardW + 3, y, 'สาขา / Store', storeDisplay)
  y += cardH + 2

  // Row 2 - full width address
  drawCard(margin, y, 'ที่อยู่ / Address', storeAddress, contentWidth)
  y += cardH + 2

  // Row 3
  drawCard(margin, y, 'เบอร์โทร / Phone', data.store?.phone || '-')
  const modernTechName = data.technicians && data.technicians.length > 0 ? data.technicians.map(t => t.name).join(', ') : data.technician?.name || data.resolvedBy?.name || '-'
  drawCard(margin + cardW + 3, y, 'ช่างเทคนิค / Technician', modernTechName)
  y += cardH + 2

  // Row 4
  drawCard(margin, y, 'วันเข้าปฏิบัติงาน / Started', data.checkInAt ? formatDate(data.checkInAt) : '-')
  drawCard(margin + cardW + 3, y, 'วันแก้ไขเสร็จ / Finished', data.resolvedAt ? formatDate(data.resolvedAt) : '-')
  y += cardH + 5

  // ========== PROBLEM / WORK / COMMENT SECTIONS (dynamic height) ==========
  const sectionLabelH = 7

  // Pre-compute text heights from actual content
  const problemText = data.title || '-'
  const problemLines = doc.splitTextToSize(problemText, contentWidth - 8)
  const resText = data.resolutionNote || '-'
  const resLines = doc.splitTextToSize(resText, contentWidth - 8)
  const commentText = data.comment || '-'
  const commentLines = doc.splitTextToSize(commentText, contentWidth - 8)

  let mProblemH = Math.max(22, problemLines.length * 4.5 + 6)
  let mResH = Math.max(22, resLines.length * 4.5 + 6)
  let mCommentH = Math.max(18, commentLines.length * 4.5 + 6)

  // Budget: 3 section headers(7+1 each) + 3 gaps(3 each) + spare parts + status + sig header + sig + footer
  const mSpN = (data.usedSpareParts && data.spareParts.length > 0) ? data.spareParts.length : 0
  const mSpTableH = 7 + (mSpN > 0 ? mSpN * 5.5 : 5.5)
  const mFixedTail = (sectionLabelH + 1) * 3 + 3 * 3 + mSpTableH + 12 + (sectionLabelH + 1) + 30 + 10
  const mAvail = 285 - y - mFixedTail
  const mTotalText = mProblemH + mResH + mCommentH
  if (mTotalText > mAvail) {
    const mExcess = mTotalText - mAvail
    const mCommentShrink = Math.min(mExcess, Math.max(0, mCommentH - 8))
    mCommentH -= mCommentShrink
    const mRem1 = mExcess - mCommentShrink
    const mResShrink = Math.min(mRem1, Math.max(0, mResH - 8))
    mResH -= mResShrink
    const mRem2 = mRem1 - mResShrink
    mProblemH = Math.max(8, mProblemH - mRem2)
  }

  // Draw Problem
  doc.setFillColor(primaryTint[0], primaryTint[1], primaryTint[2])
  doc.roundedRect(margin, y, contentWidth, sectionLabelH, 1, 1, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 26)
  doc.text('ปัญหา / อาการเสีย / Problem', margin + 4, y + 4.8)
  y += sectionLabelH + 1
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
  doc.roundedRect(margin, y, contentWidth, mProblemH, 1.5, 1.5, 'F')
  doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text(problemLines, margin + 4, y + 5)
  y += mProblemH + 3

  // Draw Work Performance
  doc.setFillColor(primaryTint[0], primaryTint[1], primaryTint[2])
  doc.roundedRect(margin, y, contentWidth, sectionLabelH, 1, 1, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 26)
  doc.text('วิธีการแก้ไขปัญหา / Work Performance', margin + 4, y + 4.8)
  y += sectionLabelH + 1
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
  doc.roundedRect(margin, y, contentWidth, mResH, 1.5, 1.5, 'F')
  doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text(resLines, margin + 4, y + 5)
  y += mResH + 3

  // Draw Comment
  doc.setFillColor(primaryTint[0], primaryTint[1], primaryTint[2])
  doc.roundedRect(margin, y, contentWidth, sectionLabelH, 1, 1, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 26)
  doc.text('คำแนะนำ/เพิ่มเติม / Comment', margin + 4, y + 4.8)
  y += sectionLabelH + 1
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
  doc.roundedRect(margin, y, contentWidth, mCommentH, 1.5, 1.5, 'F')
  doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text(commentLines, margin + 4, y + 5)
  y += mCommentH + 3

  // ========== SPARE PARTS ==========
  doc.setFillColor(primaryTint[0], primaryTint[1], primaryTint[2])
  doc.roundedRect(margin, y, contentWidth, sectionLabelH, 1, 1, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 26)
  doc.text('อะไหล่ที่เปลี่ยน / Spare Parts', margin + 4, y + 4.8)
  y += sectionLabelH

  {
    const hasParts = data.usedSpareParts && data.spareParts.length > 0
    const spRows: string[][] = []
    if (hasParts) {
      for (const sp of data.spareParts) {
        spRows.push([
          String(spRows.length + 1),
          sp.equipmentName || sp.deviceName || '-',
          sp.oldBrandModel || '-',
          sp.oldSerialNo || '-',
          sp.newBrandModel || '-',
          sp.newSerialNo || '-',
        ])
      }
    } else {
      spRows.push(['', 'ไม่มีการเปลี่ยนอะไหล่', '', '', '', ''])
    }

    const modColW = (contentWidth - 8) / 5
    const spColWidths = {
      0: { cellWidth: 8, halign: 'center' as const },
      1: { cellWidth: modColW },
      2: { cellWidth: modColW },
      3: { cellWidth: modColW },
      4: { cellWidth: modColW },
      5: { cellWidth: modColW },
    }
    autoTable(doc, {
      startY: y,
      head: [['#', 'Equipment Name', 'อุปกรณ์เดิม/ Old', 'Old Serial No.', 'อุปกรณ์ใหม่/ New', 'New Serial No.']],
      body: spRows,
      theme: 'striped',
      styles: { font, fontSize: 6.5, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, textColor: textDark, lineWidth: 0 },
      headStyles: { fillColor: lightBg, textColor: textGray, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: spColWidths,
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY
  }

  // ========== STATUS BAR ==========
  y += 3
  const statusBadge = data.status
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
  doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F')
  doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(textGray[0], textGray[1], textGray[2])
  doc.text('สถานะ / Status:', margin + 4, y + 5.3)

  // Status badge
  const badgeX = margin + 32
  const isClosed = statusBadge === 'CLOSED' || statusBadge === 'CONFIRMED'
  const badgeColor = isClosed ? [22, 163, 74] as [number, number, number] : accent
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2])
  const badgeW = doc.getTextWidth(statusBadge) + 6
  doc.roundedRect(badgeX, y + 1.5, badgeW, 5, 1, 1, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255)
  doc.text(statusBadge, badgeX + badgeW / 2, y + 5, { align: 'center' })
  y += 12

  // ========== SIGNATURES ==========
  doc.setFillColor(primaryTint[0], primaryTint[1], primaryTint[2])
  doc.roundedRect(margin, y, contentWidth, sectionLabelH, 1, 1, 'F')
  doc.setFont(font, 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 26)
  doc.text('ลายเซ็น / Signatures', margin + contentWidth / 2, y + 4.8, { align: 'center' })
  y += sectionLabelH + 1

  y = await drawSignatures(doc, font, data, blankSignature, y, margin, contentWidth, data.reportUrl)

  // Footer with accent line
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setDrawColor(accent[0], accent[1], accent[2]); doc.setLineWidth(0.5)
  doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
  addFooter(doc, font, data)

  // Watermark
  if (!blankSignature) addCopyWatermark(doc, font)
  applyPdfWatermark(doc, { orgName: data.organizationName, ticketNumber: data.ticketNumber })

  if (returnBlob) return doc.output('blob')
  doc.save(`service-report-${data.ticketNumber}.pdf`)
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║                    PUBLIC API                                    ║
// ╚══════════════════════════════════════════════════════════════════╝

export async function generateServiceReportPDF(
  data: ServiceReportData,
  options?: PdfOptions
): Promise<Blob | void> {
  const opts = options || {}
  if (opts.style === 'modern') {
    return generateModernPDF(data, opts)
  }
  return generateClassicPDF(data, opts)
}
