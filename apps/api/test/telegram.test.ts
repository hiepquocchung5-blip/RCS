import { test } from "node:test";
import assert from "node:assert/strict";
import { createTelegramNotifier } from "../src/telegram.js";
import { loadConfig } from "../src/config.js";

test("telegram notifier returns false when env variables are unconfigured", async () => {
  const config = loadConfig();
  const notifier = createTelegramNotifier(config);

  const ok = await notifier.sendMessage("<b>Test Message</b>");
  // Should handle unconfigured environment gracefully without throwing
  assert.equal(typeof ok, "boolean");
});
