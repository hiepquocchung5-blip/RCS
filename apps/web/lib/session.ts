import type { UserProfile } from "@rcs/shared";

export interface Session {
  token: string;
  user: UserProfile;
}

const KEY = "rcs_session";

/**
 * Apex domain for the cross-subdomain session cookie (baked in at build
 * time). Unset in development, so the cookie stays host-only on localhost.
 */
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_RCS_COOKIE_DOMAIN;

function cookieDomainPart(): string {
  if (!COOKIE_DOMAIN) return "";
  const hostname = window.location.hostname;
  const onDomain =
    hostname === COOKIE_DOMAIN || hostname.endsWith(`.${COOKIE_DOMAIN}`);
  return onDomain ? `; domain=.${COOKIE_DOMAIN}` : "";
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  if (!cookieMatch || !cookieMatch[1]) return null;
  try {
    const raw = decodeURIComponent(cookieMatch[1]);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as { token?: unknown; user?: unknown };
    if (typeof candidate.token !== "string" || typeof candidate.user !== "object") {
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(session));
  const maxAge = 12 * 60 * 60; // 12 hours matching JWT expiry
  const securePart = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${KEY}=${value}; path=/${cookieDomainPart()}; max-age=${maxAge}; SameSite=Lax${securePart}`;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  const securePart = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${KEY}=; path=/${cookieDomainPart()}; max-age=0; SameSite=Lax${securePart}`;
}
