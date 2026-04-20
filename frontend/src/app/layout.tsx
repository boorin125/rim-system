// app/layout.tsx - Root Layout with Auth Provider
import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'

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
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/* Prevent flash of wrong theme — runs before paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('colorTheme')||'dark';document.documentElement.className=t;var s=localStorage.getItem('themeStyle');if(s){var st=JSON.parse(s);var hex=st.bgEnd.replace('#','');var r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s2=0,l=(mx+mn)/2;if(mx!==mn){var d=mx-mn;s2=l>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}var basePct=t==='dark'?42:62;try{var bs=localStorage.getItem('themeBrightnessState');if(bs){var bf=JSON.parse(bs).brightness;if(bf!==undefined){var adj=Math.round((bf-50)*0.3);basePct=Math.min(t==='dark'?56:72,Math.max(t==='dark'?30:48,basePct+adj));}}}catch(e2){}var pct=basePct;var hval=Math.round(h*360),sval=Math.max(Math.round(s2*100),30);document.documentElement.style.setProperty('--theme-highlight','hsl('+hval+','+sval+'%,'+pct+'%)');document.documentElement.style.setProperty('--theme-highlight-hover','hsl('+hval+','+sval+'%,'+Math.min(pct+8,75)+'%)');}}catch(e){document.documentElement.className='dark';}})()` }} />
        {/* PWA */}
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" href="/api/pwa-icon" />
        {/* Capture beforeinstallprompt before React mounts — stored globally */}
        <script dangerouslySetInnerHTML={{ __html: `window.__pwaPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event('pwaPromptReady'));});` }} />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
