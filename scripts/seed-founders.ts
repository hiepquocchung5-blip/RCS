import { Store } from "../apps/api/src/store.js";
import { loadConfig } from "../apps/api/src/config.js";

const FOUNDERS = [
  {
    name: "Filip",
    email: "filip@risecorestudio.com",
    password: "NgbkRD@5Q92pS8}K",
  },
  {
    name: "Shayy",
    email: "shayy@risecorestudio.com",
    password: "vF)CfXw>sA2T>*3Z",
  },
  {
    name: "Pai Htoo Khant",
    email: "paihtookhant@risecorestudio.com",
    password: "82Ewc%QGf6Sq-*ms",
  },
];

async function main() {
  const config = loadConfig();
  const store = new Store(config.jwtSecret, config.databaseUrl);
  await store.init();

  console.log("Seeding founder admin accounts...");

  for (const founder of FOUNDERS) {
    const existing = await store.findUserByEmail(founder.email);
    if (existing) {
      await store.changePassword(existing.id, founder.password, founder.password).catch(() => {});
      // Force update password_hash directly if old password changed
      const { hashPassword } = await import("../apps/api/src/security/credentials.js");
      const hash = hashPassword(founder.password);
      if (store["pool"]) {
        await store["pool"].query(
          `UPDATE users SET password_hash = $1, role = 'admin' WHERE email = $2`,
          [hash, founder.email]
        );
      }
      console.log(`[founder-seed] Updated existing founder: ${founder.name} (${founder.email})`);
    } else {
      await store.createUser({
        email: founder.email,
        name: founder.name,
        role: "admin",
        skillLevel: "senior",
        password: founder.password,
      });
      console.log(`[founder-seed] Created new founder: ${founder.name} (${founder.email})`);
    }
  }

  console.log("All founder accounts seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed founder accounts:", err);
  process.exit(1);
});
