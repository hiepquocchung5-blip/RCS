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
