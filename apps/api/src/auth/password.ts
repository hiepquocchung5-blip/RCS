import { randomInt } from "node:crypto";
import { PASSWORD_LENGTH } from "@rcs/shared";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}<>?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(pool: string): string {
  const ch = pool[randomInt(pool.length)];
  if (ch === undefined) throw new Error("empty character pool");
  return ch;
}

/**
 * Generates a cryptographically secure password of exactly 16 characters,
 * guaranteed to contain at least one uppercase letter, one lowercase letter,
 * one digit and one symbol. Uses crypto.randomInt (CSPRNG) throughout,
 * including an unbiased Fisher–Yates shuffle.
 */
export function generatePassword(): string {
  const chars: string[] = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  while (chars.length < PASSWORD_LENGTH) {
    chars.push(pick(ALL));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const a = chars[i];
    const b = chars[j];
    if (a === undefined || b === undefined) throw new Error("shuffle bounds");
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join("");
}
