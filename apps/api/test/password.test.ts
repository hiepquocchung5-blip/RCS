import { test } from "node:test";
import assert from "node:assert/strict";
import { PASSWORD_LENGTH } from "@rcs/shared";
import { generatePassword } from "../src/auth/password.js";

test("password is exactly 16 characters", () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(generatePassword().length, PASSWORD_LENGTH);
  }
});

test("password always contains upper, lower, digit and symbol", () => {
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword();
    assert.match(pw, /[A-Z]/, `missing uppercase in ${pw}`);
    assert.match(pw, /[a-z]/, `missing lowercase in ${pw}`);
    assert.match(pw, /[0-9]/, `missing digit in ${pw}`);
    assert.match(pw, /[^A-Za-z0-9]/, `missing symbol in ${pw}`);
  }
});

test("passwords are not repeated", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    seen.add(generatePassword());
  }
  assert.equal(seen.size, 500);
});

test("user can change password with valid credentials", async () => {
  const { Store } = await import("../src/store.js");
  const store = new Store();
  const email = "founder@risecorestudio.com";
  const oldPw = "OldPassword123!";
  const newPw = "NewPassword456!";
  await store.createUser({
    email,
    name: "Founder",
    role: "admin",
    skillLevel: "senior",
    password: oldPw,
  });
  
  const userBefore = await store.authenticateUser(email, oldPw);
  assert.ok(userBefore);
  
  const changed = await store.changePassword(userBefore.id, oldPw, newPw);
  assert.equal(changed, true);
  
  const oldAuth = await store.authenticateUser(email, oldPw);
  assert.equal(oldAuth, undefined);
  
  const newAuth = await store.authenticateUser(email, newPw);
  assert.ok(newAuth);
});
