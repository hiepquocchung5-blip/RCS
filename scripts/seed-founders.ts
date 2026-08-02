import { Store } from "../apps/api/src/store.js";
import { loadConfig } from "../apps/api/src/config.js";
import { generatePassword } from "../apps/api/src/auth/password.js";

/**
 * Idempotently creates founders from RCS_FOUNDERS (Name:email pairs).
 * Passwords are generated at runtime, printed once, and only their hashes are
 * persisted. Existing accounts are deliberately left untouched.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required for founder seeding");
  const entries = (process.env.RCS_FOUNDERS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) throw new Error("RCS_FOUNDERS must contain Name:email pairs");

  const store = new Store(config.jwtSecret, config.databaseUrl);
  await store.init();
  try {
    for (const entry of entries) {
      const separator = entry.indexOf(":");
      if (separator < 1) throw new Error(`Invalid founder entry: ${entry}`);
      const name = entry.slice(0, separator).trim();
      const email = entry.slice(separator + 1).trim().toLowerCase();
      if (!email.includes("@")) throw new Error(`Invalid founder email: ${email}`);
      if (await store.findUserByEmail(email)) {
        console.log(`[founder-seed] Existing account retained: ${name} <${email}>`);
        continue;
      }
      const password = generatePassword();
      await store.createUser({ email, name, role: "admin", skillLevel: "senior", password });
      await store.log("api", "founder_seeded", `Founder account provisioned for ${name} (${email})`);
      console.log(`[founder-seed] Created ${name} <${email}>; one-time password: ${password}`);
    }
  } finally {
    await store.close();
  }
}

main().catch((error: unknown) => {
  console.error("Founder seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
