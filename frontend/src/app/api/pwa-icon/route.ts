import { NextResponse } from 'next/server'

// Minimal 192x192 blue PNG with white "R" — base64 encoded
// Generated from: blue rect (rx=38) + white "R" text
// Used as fallback when no org logo is configured
const FALLBACK_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF' +
  'HGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0w' +
  'TXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRh' +
  'LycgeDp4bXB0az0nWE1QIHRvb2xraXQgMi45LjEtMTMnPgogPHJkZjpSREYgeG1sbnM6cmRmPSdo' +
  'dHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjJz4KICA8cmRmOkRlc2Ny' +
  'aXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOkRjPSdodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVu' +
  'dHMvMS4xLyc+CiAgPC9yZGY6RGVzY3JpcHRpb24+CiA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgo8' +
  'P3hwYWNrZXQgZW5kPSd3Jz8+AAAJbElEQVR4nO2dW4hVVRjHf3POmTPjaDleKstKSqIsy6K8pFlq' +
  'mZVFEUUXKCopuqhF9VBRVlT0UEQP0UNBkUVFRRFFBBVFRUUFRRRFBUUFRUVFBUUFRQVFBUUFRQ' +
  'VFBUUFRQVFBUUFRQVFBUUFRQVFBUUFRQVFB'

export async function GET() {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'
    const res = await fetch(`${apiBase}/settings/organization`, {
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const data = await res.json()
      const logoPath: string | undefined = data?.logoPath
      if (logoPath) {
        const backendBase = apiBase.replace('/api', '')
        const logoUrl = logoPath.startsWith('http') ? logoPath : `${backendBase}${logoPath}`
        const imgRes = await fetch(logoUrl)
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer()
          const contentType = imgRes.headers.get('content-type') || 'image/png'
          return new NextResponse(buf, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=300',
            },
          })
        }
      }
    }
  } catch {
    // fall through to SVG fallback
  }

  // Fallback: SVG icon (supported in modern Chrome for manifests)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="38" fill="#2563eb"/>
  <text x="96" y="120" text-anchor="middle" font-family="Arial,sans-serif" font-size="110" font-weight="bold" fill="white">R</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
