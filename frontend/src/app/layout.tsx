// app/layout.tsx - Root Layout with Auth Provider
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RIM System - Rubjobb Incident Management',
  description: 'IT Service Management and Incident Tracking System',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RIM System',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — runs before paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('colorTheme')||'dark';document.documentElement.className=t;}catch(e){document.documentElement.className='dark';}})()` }} />
        {/* PWA */}
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" href="/api/pwa-icon" />
        {/* Capture beforeinstallprompt before React mounts — stored globally */}
        <script dangerouslySetInnerHTML={{ __html: `window.__pwaPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event('pwaPromptReady'));});` }} />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
