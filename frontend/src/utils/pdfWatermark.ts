/**
 * PDF Copyright Watermark Utility
 *
 * Embeds invisible copyright fingerprints into PDF documents.
 * Works on 2 levels:
 *   1. Invisible white-text fingerprint rendered on every page
 *   2. PDF document metadata (Author, Creator, Keywords)
 *
 * The fingerprint survives:
 *   - Screenshot (metadata layer)
 *   - Text extraction (invisible text layer)
 *   - PDF reader inspection (both layers)
 *
 * Usage:
 *   applyPdfWatermark(doc, { orgName: 'Acme Corp', ticketNumber: 'INC-001' })
 */


interface WatermarkOptions {
  orgName?: string
  ticketNumber?: string
  buildId?: string
}

function getBuildId(): string {
  return process.env.NEXT_PUBLIC_BUILD_FINGERPRINT || 'RIM-STD'
}

function getBuildCustomer(): string {
  return process.env.NEXT_PUBLIC_BUILD_CUSTOMER || 'UNKNOWN'
}

/**
 * Apply invisible copyright fingerprint to all pages of a jsPDF document.
 * Must be called AFTER all content has been added, BEFORE doc.save() / doc.output().
 */
export function applyPdfWatermark(doc: any, options: WatermarkOptions = {}): void {
  const buildId = getBuildId()
  const customer = getBuildCustomer()
  const orgName = options.orgName || 'RIM'
  const ticket = options.ticketNumber || ''
  const ts = new Date().toISOString()

  // Compose fingerprint string — contains: build ID, customer, org, ticket, timestamp
  const fp = `RIM|${buildId}|${customer}|${orgName}|${ticket}|${ts}`

  // ── Layer A: Document Metadata ──────────────────────────────────────────────
  // Readable via: pdfinfo / exiftool / any PDF viewer's "Document Properties"
  doc.setProperties({
    author: `RIM System - ${orgName}`,
    creator: `RIM-${buildId}`,
    keywords: `${buildId} ${customer}`,  // fingerprint in keywords field
    subject: doc.getProperties().subject || 'RIM System Document',
    title: doc.getProperties().title || 'RIM System',
  })

  // ── Layer B: Invisible text on every page ───────────────────────────────────
  // White text (255,255,255) at 0.5pt — invisible on white paper, present in PDF stream.
  // Extractable via: pdftotext, PDF.js, Adobe Acrobat text search
  const totalPages = (doc.internal as any).getNumberOfPages
    ? (doc.internal as any).getNumberOfPages()
    : (doc as any).internal.pages.length - 1

  // Save current doc state
  const prevFontSize = doc.getFontSize()
  const prevTextColor = (doc as any).getTextColor?.() ?? '#000000'

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Set invisible style
    doc.setFontSize(0.5)
    doc.setTextColor(255, 255, 255)  // white — invisible on white background

    // Top-left corner (outside normal margin zone, still within PDF bounds)
    doc.text(fp, 1, 1)

    // Bottom-right corner (second copy for redundancy)
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.text(fp, pw - 1, ph - 1, { align: 'right' })
  }

  // Restore previous state
  doc.setFontSize(prevFontSize)
  doc.setTextColor(0, 0, 0)
}

/**
 * Decode fingerprint from a PDF text extract.
 * Pass the raw text content extracted from the PDF.
 * Returns parsed fingerprint fields or null if not found.
 */
export function decodePdfFingerprint(rawText: string): {
  buildId: string
  customer: string
  orgName: string
  ticket: string
  timestamp: string
} | null {
  const match = rawText.match(/RIM\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|([^\s|]+)/)
  if (!match) return null
  return {
    buildId: match[1],
    customer: match[2],
    orgName: match[3],
    ticket: match[4],
    timestamp: match[5],
  }
}
