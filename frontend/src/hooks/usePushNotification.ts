'use client'

import { useEffect, useRef } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

/**
 * Registers a Service Worker and subscribes the browser to Web Push.
 * Called once after user logs in (in the dashboard layout).
 * Silently no-ops if the browser doesn't support push or user denies permission.
 */
export function usePushNotification() {
  const registered = useRef(false)

  useEffect(() => {
    if (registered.current) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const token = localStorage.getItem('accessToken')
    if (!token) return

    registered.current = true

    ;(async () => {
      try {
        // 1. Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready

        // 2. Check current permission — don't ask if already denied
        if (Notification.permission === 'denied') return

        // 3. Fetch VAPID public key from server
        const keyRes = await fetch(`${API_URL}/push/vapid-public-key`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!keyRes.ok) return
        const { publicKey } = await keyRes.json()
        if (!publicKey) return

        // 4. Check if already subscribed with same key
        const existingSub = await reg.pushManager.getSubscription()
        if (existingSub) {
          // Re-send to backend in case it was lost (e.g. new device session)
          await sendSubscriptionToServer(existingSub, token)
          return
        }

        // 5. Request permission (shows browser prompt)
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // 6. Subscribe
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
        })

        // 7. Send subscription to our backend
        await sendSubscriptionToServer(subscription, token)
      } catch {
        // Silent — push is non-critical
      }
    })()
  }, [])
}

async function sendSubscriptionToServer(subscription: PushSubscription, token: string) {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

  await fetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {})
}

/** Convert VAPID base64 public key to Uint8Array (required by pushManager.subscribe) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
