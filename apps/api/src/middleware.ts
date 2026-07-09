import type { NextFunction, Request, Response } from "express";
import type { Role } from "@rcs/shared";
import { verifyToken, type SessionClaims } from "./auth/tokens.js";

export interface AuthedRequest extends Request {
  session?: SessionClaims;
}

export function requireAuth(secret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header("authorization");
    if (header === undefined || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing bearer token" });
      return;
    }
    const claims = verifyToken(secret, header.slice("Bearer ".length), "session");
    if (claims === null) {
      res.status(401).json({ error: "invalid or expired token" });
      return;
    }
    req.session = claims;
    next();
  };
}

export function requireRole(...roles: readonly Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const session = req.session;
    if (session === undefined) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    if (!roles.includes(session.role)) {
      res.status(403).json({ error: `requires role: ${roles.join(" | ")}` });
      return;
    }
    next();
  };
}
