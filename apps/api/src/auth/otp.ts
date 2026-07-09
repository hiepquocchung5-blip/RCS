import { randomInt } from "node:crypto";
import { Redis } from "ioredis";
import { OTP_DIGITS, OTP_TTL_SECONDS } from "@rcs/shared";

export function generateOtp(): string {
  let otp = "";
  for (let i = 0; i < OTP_DIGITS; i++) {
    otp += String(randomInt(10));
  }
  return otp;
}

/**
 * OTP storage with a strict 5-minute expiry. Redis is used when REDIS_URL is
 * configured (production); the in-memory store is the dev fallback and
 * enforces the exact same TTL.
 */
export interface OtpStore {
  issue(key: string, otp: string): Promise<void>;
  /** Verifies and consumes the OTP (one shot). */
  verify(key: string, otp: string): Promise<boolean>;
  close(): Promise<void>;
}

export class RedisOtpStore implements OtpStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async issue(key: string, otp: string): Promise<void> {
    await this.redis.set(`rcs:otp:${key}`, otp, "EX", OTP_TTL_SECONDS);
  }

  async verify(key: string, otp: string): Promise<boolean> {
    const redisKey = `rcs:otp:${key}`;
    const stored = await this.redis.get(redisKey);
    if (stored === null || stored !== otp) return false;
    await this.redis.del(redisKey);
    return true;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

interface MemoryOtpEntry {
  otp: string;
  expiresAt: number;
}

export class MemoryOtpStore implements OtpStore {
  private readonly entries = new Map<string, MemoryOtpEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  async issue(key: string, otp: string): Promise<void> {
    this.entries.set(key, {
      otp,
      expiresAt: this.now() + OTP_TTL_SECONDS * 1000,
    });
  }

  async verify(key: string, otp: string): Promise<boolean> {
    const entry = this.entries.get(key);
    if (entry === undefined) return false;
    if (this.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return false;
    }
    if (entry.otp !== otp) return false;
    this.entries.delete(key);
    return true;
  }

  async close(): Promise<void> {
    this.entries.clear();
  }
}

export function createOtpStore(redisUrl: string | null): OtpStore {
  return redisUrl !== null ? new RedisOtpStore(redisUrl) : new MemoryOtpStore();
}
