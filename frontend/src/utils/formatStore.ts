/**
 * Standard store display format: "StoreID StoreName" (e.g., "201 Maneeya")
 * Use this everywhere a store name is shown in the UI.
 */
export function formatStore(
  store: { storeCode?: string | null; name?: string | null } | null | undefined,
  fallback = 'N/A',
): string {
  if (!store) return fallback
  const code = (store.storeCode ?? '').trim()
  const name = (store.name ?? '').trim()
  if (!code && !name) return fallback
  if (!code) return name
  if (!name) return code
  return `${code} ${name}`
}
