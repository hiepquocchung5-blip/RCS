import type { UserProfile } from "@rcs/shared";

export interface Session {
  token: string;
  user: UserProfile;
}

const KEY = "rcs.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (raw === null) return null;
  try {
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
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
