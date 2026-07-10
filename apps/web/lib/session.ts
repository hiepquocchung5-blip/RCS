import type { UserProfile } from "@rcs/shared";

export interface Session {
  token: string;
  user: UserProfile;
}

const KEY = "rcs_session";

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
  const hostname = window.location.hostname;
  const isProd = hostname.endsWith("risecorestudio.com");
  const domainPart = isProd ? "; domain=.risecorestudio.com" : "";
  const maxAge = 12 * 60 * 60; // 12 hours matching JWT expiry
  const securePart = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${KEY}=${value}; path=/${domainPart}; max-age=${maxAge}; SameSite=Lax${securePart}`;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  const hostname = window.location.hostname;
  const isProd = hostname.endsWith("risecorestudio.com");
  const domainPart = isProd ? "; domain=.risecorestudio.com" : "";
  const securePart = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${KEY}=; path=/${domainPart}; max-age=0; SameSite=Lax${securePart}`;
}
