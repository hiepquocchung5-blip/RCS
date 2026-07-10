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
      res.status(401).json({ error: "unauthorized", message: "missing bearer token", code: 401 });
      return;
    }
    const claims = verifyToken(secret, header.slice("Bearer ".length), "session");
    if (claims === null) {
      res.status(401).json({ error: "unauthorized", message: "invalid or expired token", code: 401 });
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
      res.status(401).json({ error: "unauthorized", message: "unauthenticated", code: 401 });
      return;
    }
    if (!roles.includes(session.role)) {
      res.status(403).json({ error: "forbidden", message: `requires role: ${roles.join(" | ")}`, code: 403 });
      return;
    }
    next();
  };
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  console.error(`[rcs-api] Error on ${req.method} ${req.path}:`, err);
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "internal_server_error",
    message: isProduction ? "An unexpected error occurred" : err.message,
    code: 500,
  });
}
