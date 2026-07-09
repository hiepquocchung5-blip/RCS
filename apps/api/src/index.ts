import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { loadConfig } from "./config.js";
import { createOtpStore } from "./auth/otp.js";
import { generatePassword } from "./auth/password.js";
import { Store } from "./store.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { ticketRoutes } from "./routes/tickets.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { requireAuth } from "./middleware.js";
import { attachChat } from "./chat.js";

const config = loadConfig();
const store = new Store();
const otpStore = createOtpStore(config.redisUrl);

/**
 * Seed the initial Admin (the Admin creates all other profiles). The
 * credential follows the 16-char rule; in dev it can be pinned via
 * RCS_ADMIN_PASSWORD, otherwise it is generated and printed once at boot.
 */
function seedAdmin(): void {
  const email = process.env.RCS_ADMIN_EMAIL ?? "admin@risecore.studio";
  const password = process.env.RCS_ADMIN_PASSWORD ?? generatePassword();
  store.createUser({ email, name: "RCS Admin", role: "admin", password });
  store.log("api", "admin_seeded", `Admin account provisioned for ${email}`);
  console.log(`[rcs-api] Admin: ${email}`);
  if (process.env.RCS_ADMIN_PASSWORD === undefined) {
    console.log(`[rcs-api] Admin password (generated this boot): ${password}`);
  }
}

/** Optional demo data — only seeded when RCS_SEED_DEMO=true (never dummy data by default). */
function seedDemoTickets(): void {
  const projectId = "payvia";
  store.createTicket({
    title: "Wire Monaco editor into Workspace view",
    description: "Center-top pane, Rise Dark theme, TS language services.",
    assigneeRole: "frontend",
    projectId,
  });
  store.createTicket({
    title: "Terminal bridge reconnect strategy",
    description: "Yellow indicator while reconnecting, red after 3 failures.",
    assigneeRole: "frontend",
    projectId,
  });
  store.createTicket({
    title: "GitHub webhook → ticket transition",
    description: "Merged PR titled with RCS-<id> advances the ticket one state.",
    assigneeRole: "backend",
    projectId,
  });
  store.createTicket({
    title: "Provision staging VPS",
    description: "Nginx reverse proxy for api + web, TLS via certbot.",
    assigneeRole: "devops",
    projectId,
  });
}

seedAdmin();
if (process.env.RCS_SEED_DEMO === "true") {
  seedDemoTickets();
  store.log("api", "demo_seeded", "Demo tickets seeded (RCS_SEED_DEMO=true)");
}

const app = express();
app.use(cors({ origin: config.webOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rcs-api" });
});

app.use("/auth", authRoutes(config, store, otpStore));
app.use("/admin", adminRoutes(config, store));
app.use("/tickets", ticketRoutes(config, store));
app.use("/webhooks", webhookRoutes(store));

app.get("/logs", requireAuth(config.jwtSecret), (_req, res) => {
  res.json({ logs: store.listLogs() });
});

const server = createServer(app);
attachChat(server);

server.listen(config.port, () => {
  console.log(`[rcs-api] listening on ${config.apiBaseUrl}`);
  console.log(
    `[rcs-api] OTP store: ${config.redisUrl !== null ? "redis" : "in-memory (dev fallback, same 5-min TTL)"}`,
  );
  console.log(
    `[rcs-api] entity store: ${config.databaseUrl !== null ? "postgresql (configured)" : "in-memory (dev fallback)"}`,
  );
  console.log(`[rcs-api] CORS origins: ${config.webOrigins.join(", ")}`);
});
