// Report Exporter Utility - CSV, Excel, HTML, PDF
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export interface ReportConfig {
  title: string
  reportType: string
  dateRange: { from: string; to: string }
  filters: Record<string, string>
  headers: string[]
  rows: (string | number)[][]
  generatedAt: string
  organizationName?: string
  summaryLine?: string
  /** Optional per-column width ratios (e.g. [5, 8, 30, 7, ...]) for PDF/HTML */
  columnWidths?: number[]
}

function getSystemTitle(config: ReportConfig): string {
  const orgName = config.organizationName?.trim()
  return orgName ? `${orgName} Incident Management System` : 'Incident Management System'
}

function buildHeaderLines(config: ReportConfig): string[] {
  const lines: string[] = [
    getSystemTitle(config),
    `Report: ${config.reportType}`,
    `Date Range: ${config.dateRange.from || 'All'} - ${config.dateRange.to || 'All'}`,
    `Generated: ${config.generatedAt}`,
  ]
  const filterParts = Object.entries(config.filters)
    .filter(([, v]) => v && v !== 'All')
    .map(([k, v]) => `${k}=${v}`)
  if (filterParts.length > 0) {
    lines.push(`Filters: ${filterParts.join(', ')}`)
  }
  return lines
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
}

function getFilename(config: ReportConfig, ext: string): string {
  const date = new Date().toISOString().split('T')[0]
  return `${sanitizeFilename(config.reportType)}_${date}.${ext}`
}

// ==================== CSV ====================

export function exportCSV(config: ReportConfig) {
  const headerLines = buildHeaderLines(config)
  const csvParts: string[] = []

  // Header rows
  headerLines.forEach((line) => {
    csvParts.push(`"${line.replace(/"/g, '""')}"`)
  })
  csvParts.push('') // blank line

  // Column headers
  csvParts.push(config.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','))

  // Data rows
  config.rows.forEach((row) => {
    csvParts.push(
      row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
    )
  })

  const blob = new Blob(['\uFEFF' + csvParts.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  downloadBlob(blob, getFilename(config, 'csv'))
}

// ==================== EXCEL ====================

export function exportExcel(config: ReportConfig) {
  const headerLines = buildHeaderLines(config)
  const wsData: (string | number)[][] = []

  // Header rows
  headerLines.forEach((line) => {
    wsData.push([line])
  })
  wsData.push([]) // blank row

  // Column headers
  wsData.push(config.headers)

  // Data rows
  config.rows.forEach((row) => {
    wsData.push(row)
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  if (config.columnWidths && config.columnWidths.length === config.headers.length) {
    const totalRatio = config.columnWidths.reduce((a, b) => a + b, 0)
    ws['!cols'] = config.columnWidths.map((ratio) => ({
      wch: Math.max(Math.round((ratio / totalRatio) * 120), 5),
    }))
  } else {
    const colWidths = config.headers.map((h, i) => {
      let maxLen = h.length
      config.rows.forEach((row) => {
        const cellLen = String(row[i] ?? '').length
        if (cellLen > maxLen) maxLen = cellLen
      })
      return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
    })
    ws['!cols'] = colWidths
  }

  // Merge header rows across all columns
  const totalCols = config.headers.length
  if (totalCols > 1) {
    ws['!merges'] = headerLines.map((_, i) => ({
      s: { r: i, c: 0 },
      e: { r: i, c: totalCols - 1 },
    }))
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')

  XLSX.writeFile(wb, getFilename(config, 'xlsx'))
}

// ==================== HTML ====================

export function exportHTML(config: ReportConfig) {
  const headerLines = buildHeaderLines(config)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.reportType)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .header { margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #1e40af; margin-bottom: 4px; }
    .header h2 { font-size: 18px; color: #374151; margin-bottom: 12px; }
    .header .meta { font-size: 13px; color: #6b7280; line-height: 1.8; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    thead th { background: #1e40af; color: white; padding: 10px 12px; text-align: left; font-weight: 600; white-space: nowrap; }
    tbody td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f1f5f9; }
    tbody tr:hover { background: #e2e8f0; }
    .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
      table { font-size: 11px; }
      thead th { background: #1e40af !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tbody tr:nth-child(even) { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save as PDF</button>
    <button onclick="window.close()" style="padding:8px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-left:8px;">Close</button>
  </div>
  <div class="header" style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <h1>${escapeHtml(getSystemTitle(config))}</h1>
      <h2>${escapeHtml(config.reportType)}</h2>
      <div class="meta">
        ${headerLines.slice(2).map((l) => `<div>${escapeHtml(l)}</div>`).join('\n        ')}
      </div>
    </div>${config.summaryLine ? `
    <div style="text-align:right;">
      <div style="font-size:24px;font-weight:bold;color:#f59e0b;">${escapeHtml(config.summaryLine)}</div>
    </div>` : ''}
  </div>
  <table${config.columnWidths ? ' style="table-layout:fixed;width:100%;"' : ''}>
${config.columnWidths ? `    <colgroup>\n${config.columnWidths.map((w) => `      <col style="width:${w}%;">`).join('\n')}\n    </colgroup>\n` : ''}    <thead>
      <tr>
        ${config.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('\n        ')}
      </tr>
    </thead>
    <tbody>
      ${config.rows
        .map(
          (row) =>
            `<tr>${row.map((val) => `<td>${escapeHtml(String(val ?? ''))}</td>`).join('')}</tr>`
        )
        .join('\n      ')}
    </tbody>
  </table>
  <div class="footer">
    Generated by ${escapeHtml(config.organizationName?.trim() || 'System')} &middot; ${escapeHtml(config.generatedAt)} &middot; Total: ${config.rows.length} records
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ==================== PDF ====================

async function loadThaiFont(doc: jsPDF) {
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch('/fonts/Sarabun-Regular.ttf'),
      fetch('/fonts/Sarabun-Bold.ttf'),
    ])
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ])

    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    }

    doc.addFileToVFS('Sarabun-Regular.ttf', toBase64(regularBuf))
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')

    doc.addFileToVFS('Sarabun-Bold.ttf', toBase64(boldBuf))
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold')

    doc.setFont('Sarabun')
    return true
  } catch {
    return false
  }
}

export async function exportPDF(config: ReportConfig) {
  const headerLines = buildHeaderLines(config)
  const colCount = config.headers.length
  const isWide = colCount > 5
  const isVeryWide = colCount > 12

  const doc = new jsPDF({
    orientation: isWide ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const hasThai = await loadThaiFont(doc)
  const fontFamily = hasThai ? 'Sarabun' : 'helvetica'
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = isVeryWide ? 8 : 14
  const tableWidth = pageWidth - margin * 2

  // Truncate long cell text for very wide tables (PDF is summary view)
  const maxCellLen = isVeryWide ? 55 : isWide ? 80 : 200
  const truncate = (s: string) => s.length > maxCellLen ? s.slice(0, maxCellLen - 1) + '…' : s
  const bodyRows = config.rows.map((row) =>
    row.map((val) => truncate(String(val ?? '')))
  )

  // Font sizes based on width
  const titleSize = isVeryWide ? 13 : 16
  const subtitleSize = isVeryWide ? 10 : 13
  const metaSize = isVeryWide ? 7.5 : 9
  const metaStep = isVeryWide ? 4 : 5
  const headFontSize = isVeryWide ? 6.5 : 8
  const bodyFontSize = isVeryWide ? 6.5 : 7.5
  const cellPad = isVeryWide ? 1.2 : 2

  // ── Document header ──────────────────────────────────────
  doc.setFont(fontFamily, 'bold')
  doc.setFontSize(titleSize)
  doc.setTextColor(30, 64, 175)
  doc.text(getSystemTitle(config), margin, isVeryWide ? 13 : 18)

  doc.setFontSize(subtitleSize)
  doc.setTextColor(55, 65, 81)
  doc.text(config.reportType, margin, isVeryWide ? 19 : 26)

  doc.setFont(fontFamily, 'normal')
  doc.setFontSize(metaSize)
  doc.setTextColor(107, 114, 128)
  let yPos = isVeryWide ? 24 : 33
  headerLines.slice(2).forEach((line) => {
    doc.text(line, margin, yPos)
    yPos += metaStep
  })

  if (config.summaryLine) {
    const summaryY = isVeryWide ? 24 : 33
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(isVeryWide ? 10 : 12)
    doc.setTextColor(245, 158, 11)
    doc.text(config.summaryLine, pageWidth - margin, summaryY, { align: 'right' })
  }

  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1)

  // ── Column widths ────────────────────────────────────────
  const columnStyles: Record<number, { cellWidth: number; overflow: string }> = {}
  if (config.columnWidths && config.columnWidths.length === colCount) {
    const totalRatio = config.columnWidths.reduce((a, b) => a + b, 0)
    config.columnWidths.forEach((ratio, i) => {
      columnStyles[i] = {
        cellWidth: (ratio / totalRatio) * tableWidth,
        overflow: 'ellipsize',
      }
    })
  }

  // ── Table ────────────────────────────────────────────────
  autoTable(doc, {
    head: [config.headers],
    body: bodyRows,
    startY: yPos + 4,
    theme: 'grid',
    columnStyles: Object.keys(columnStyles).length > 0 ? columnStyles : undefined,
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: headFontSize,
      halign: 'left',
      font: fontFamily,
      cellPadding: cellPad,
      minCellHeight: 0,
    },
    bodyStyles: {
      fontSize: bodyFontSize,
      textColor: [30, 41, 59],
      font: fontFamily,
      minCellHeight: 0,
      overflow: 'ellipsize',
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    styles: {
      cellPadding: cellPad,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      font: fontFamily,
      overflow: 'ellipsize',
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      const pageCount = (doc as any).getNumberOfPages()
      doc.setFont(fontFamily, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(156, 163, 175)
      doc.text(
        `Generated by ${config.organizationName?.trim() || 'System'} | ${config.generatedAt} | Page ${data.pageNumber} of ${pageCount}`,
        margin,
        pageHeight - 5
      )
    },
  })

  doc.save(getFilename(config, 'pdf'))
}

// ==================== HELPERS ====================

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
