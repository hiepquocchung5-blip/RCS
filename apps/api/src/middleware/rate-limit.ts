import type { NextFunction, Request, Response } from "express";
import { Redis } from "ioredis";

interface WindowEntry { count: number; resetAt: number }

export function rateLimit(options: {
  windowMs: number;
  limit: number;
  key?: (req: Request) => string;
  redisClient?: Redis | null;
}) {
  const entries = new Map<string, WindowEntry>();
  const redis = options.redisClient ?? null;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const rawKey = options.key?.(req) ?? req.ip ?? "unknown";
    
    let count: number;
    let resetAt: number;

    if (redis) {
      const redisKey = `rcs:ratelimit:${rawKey}`;
      try {
        count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.pexpire(redisKey, options.windowMs);
          resetAt = now + options.windowMs;
        } else {
          const ttlMs = await redis.pttl(redisKey);
          resetAt = now + (ttlMs > 0 ? ttlMs : options.windowMs);
        }
      } catch (err) {
        console.error("[rcs-api] Redis rate limiter error, falling back to next()", err);
        next();
        return;
      }
    } else {
      const current = entries.get(rawKey);
      const entry = current === undefined || current.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : current;
      entry.count += 1;
      entries.set(rawKey, entry);
      count = entry.count;
      resetAt = entry.resetAt;
    }

    res.setHeader("RateLimit-Limit", options.limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.limit - count));
    
    if (count > options.limit) {
      res.setHeader("Retry-After", Math.ceil((resetAt - now) / 1000));
      res.status(429).json({
        error: "too_many_requests",
        message: "too many requests; try again later",
        code: 429
      });
      return;
    }
    next();
  };
}
