// components/PwaBranding.tsx — iOS takes the home-screen name from this meta tag at "Add to Home Screen",
// so set it per server (the manifest name/icon are served by the backend)
'use client'

import { useEffect } from 'react'

// Same naming rule as the backend manifest (settings/pwa.controller.ts)
export function appDisplayName(b: { appName?: string; organizationName?: string; isTestServer?: boolean }) {
  const base = b.appName || (b.organizationName ? `RIM ${b.organizationName}` : 'RIM System')
  return b.isTestServer && !/test/i.test(base) ? `${base} TEST` : base
}

export default function PwaBranding() {
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/public/branding`)
      .then(r => (r.ok ? r.json() : null))
      .then(b => {
        if (!b) return
        const name = appDisplayName(b)
        let meta = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement | null
        if (!meta) {
          meta = document.createElement('meta')
          meta.name = 'apple-mobile-web-app-title'
          document.head.appendChild(meta)
        }
        meta.content = name
      })
      .catch(() => {})
  }, [])
  return null
}
