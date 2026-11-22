// src/modules/integration/integration-domain.ts
// Domain rule of Integration API v1 (spec §3): a server may only connect to https://*.<its own registrable domain>.
// OWN_DOMAIN is computed from this server's public URL — no setting, no screen to change it.
import { getDomain } from 'tldts';

/** Public URL of this server — the same value used to build links in emails (APP_URL → FRONTEND_URL) */
export function publicBaseUrl(): string {
  return (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
}

/** OWN_DOMAIN (eTLD+1, Public Suffix List) of this server — null (IP / localhost / not https) disables integration */
export function ownDomain(publicUrl: string | undefined = publicBaseUrl()): string | null {
  try {
    const u = new URL(publicUrl ?? '');
    if (u.protocol !== 'https:') return null;
    return getDomain(u.hostname, { allowPrivateDomains: false }) ?? null;
  } catch {
    return null;
  }
}

/** https, no user:password, hostname (not an IP) under OWN_DOMAIN */
export function isAllowedUrl(raw: string | undefined | null, own: string | null = ownDomain()): boolean {
  if (!own || !raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    return getDomain(u.hostname, { allowPrivateDomains: false }) === own;
  } catch {
    return false;
  }
}

/** Compare / store URLs by origin only: "https://RSM.x.co.th/" → "https://rsm.x.co.th" */
export function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}
