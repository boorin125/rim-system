import { NextResponse } from 'next/server'

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="38" fill="#2563eb"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="110" font-weight="bold" fill="white">R</text>
</svg>`

export async function GET() {
  try {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api')
    const res = await fetch(`${apiBase}/settings/organization`, {
      next: { revalidate: 300 }, // cache 5 min
    })
    if (res.ok) {
      const data = await res.json()
      const logoPath: string | undefined = data?.logoPath
      if (logoPath) {
        const backendBase = apiBase.replace('/api', '')
        const logoUrl = logoPath.startsWith('http') ? logoPath : `${backendBase}${logoPath}`
        // Proxy the image so browsers treat it as same-origin
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
    // fall through to default
  }

  // Default: blue "R" SVG icon
  return new NextResponse(DEFAULT_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
