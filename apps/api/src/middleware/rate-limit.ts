import type { NextFunction, Request, Response } from "express";

interface WindowEntry { count: number; resetAt: number }

export function rateLimit(options: { windowMs: number; limit: number; key?: (req: Request) => string }) {
  const entries = new Map<string, WindowEntry>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.key?.(req) ?? req.ip ?? "unknown";
    const current = entries.get(key);
    const entry = current === undefined || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    entry.count += 1;
    entries.set(key, entry);
    res.setHeader("RateLimit-Limit", options.limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.limit - entry.count));
    if (entry.count > options.limit) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: "too many requests; try again later" });
      return;
    }
    next();
  };
}
