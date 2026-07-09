import jwt from "jsonwebtoken";
import { isRole, type Role } from "@rcs/shared";

export interface SessionClaims {
  sub: string;
  email: string;
  role: Role;
  /** "session" for web sessions, "bridge" for RCS-CLI terminal sessions. */
  aud: "session" | "bridge";
}

export function signSessionToken(
  secret: string,
  claims: Omit<SessionClaims, "aud">,
): string {
  return jwt.sign({ ...claims, aud: "session" }, secret, { expiresIn: "12h" });
}

export function signBridgeToken(
  secret: string,
  claims: Omit<SessionClaims, "aud">,
): string {
  return jwt.sign({ ...claims, aud: "bridge" }, secret, { expiresIn: "1h" });
}

export function verifyToken(
  secret: string,
  token: string,
  audience: SessionClaims["aud"],
): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, secret, { audience });
    if (typeof decoded === "string") return null;
    const sub = decoded.sub;
    const email = decoded["email"];
    const role = decoded["role"];
    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string" ||
      !isRole(role)
    ) {
      return null;
    }
    return { sub, email, role, aud: audience };
  } catch {
    return null;
  }
}
