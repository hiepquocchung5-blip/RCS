import { test } from "node:test";
import assert from "node:assert/strict";
import { OTP_DIGITS, OTP_TTL_SECONDS } from "@rcs/shared";
import { generateOtp, MemoryOtpStore } from "../src/auth/otp.js";

test("OTP is a 6-digit code", () => {
  for (let i = 0; i < 100; i++) {
    assert.match(generateOtp(), new RegExp(`^\\d{${OTP_DIGITS}}$`));
  }
});

test("OTP verifies once and is consumed", async () => {
  const store = new MemoryOtpStore();
  await store.issue("app-1", "123456");
  assert.equal(await store.verify("app-1", "123456"), true);
  assert.equal(await store.verify("app-1", "123456"), false);
});

test("wrong OTP is rejected without consuming", async () => {
  const store = new MemoryOtpStore();
  await store.issue("app-1", "123456");
  assert.equal(await store.verify("app-1", "654321"), false);
  assert.equal(await store.verify("app-1", "123456"), true);
});

test("OTP expires strictly after 5 minutes", async () => {
  let now = 0;
  const store = new MemoryOtpStore(() => now);
  await store.issue("app-1", "123456");
  now = OTP_TTL_SECONDS * 1000 - 1;
  assert.equal(await store.verify("app-1", "123456"), true);

  await store.issue("app-2", "222222");
  now += OTP_TTL_SECONDS * 1000;
  assert.equal(await store.verify("app-2", "222222"), false);
});
