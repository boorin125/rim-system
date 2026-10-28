// App icon badge (unread notification count) — Badging API
// Supported: iOS 16.4+ (home screen app), desktop Chrome/Edge installed app.
// Android Chrome has no API — launcher shows a dot from the push notification itself.

/** Fired after notifications are read/deleted outside NotificationBell so it re-fetches the count */
export const NOTIFICATIONS_CHANGED_EVENT = 'rim:notifications-changed'

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

export function setAppBadge(count: number) {
  if (typeof navigator === 'undefined') return
  const nav = navigator as BadgeNavigator
  if (!nav.setAppBadge || !nav.clearAppBadge) return
  const p = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()
  p.catch(() => { /* not installed / permission not granted */ })
}

export function clearAppBadge() {
  setAppBadge(0)
}

export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}
