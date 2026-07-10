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
import { projectRoutes } from "./routes/projects.js";
import { orderRoutes } from "./routes/orders.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { requireAuth, requireRole } from "./middleware.js";
import { attachChat, chatRoutes } from "./chat.js";
import { metrics, requestContext } from "./observability.js";

const config = loadConfig();
const store = new Store(config.jwtSecret);
const otpStore = createOtpStore(config.redisUrl);

/**
 * Seed the initial Admin (the Admin creates all other profiles). The
 * credential follows the 16-char rule; in dev it can be pinned via
 * RCS_ADMIN_PASSWORD, otherwise it is generated and printed once at boot.
 */
function seedAdmin(): void {
  const email = process.env.RCS_ADMIN_EMAIL ?? "admin@risecore.studio";
  const password = process.env.RCS_ADMIN_PASSWORD ?? generatePassword();
  store.createUser({
    email,
    name: "RCS Admin",
    role: "admin",
    skillLevel: "senior",
    password,
  });
  store.log("api", "admin_seeded", `Admin account provisioned for ${email}`);
  console.log(`[rcs-api] Admin: ${email}`);
  if (process.env.RCS_ADMIN_PASSWORD === undefined) {
    console.log(`[rcs-api] Admin password (generated this boot): ${password}`);
  }
}

/** Optional demo data — only seeded when RCS_SEED_DEMO=true (never dummy data by default). */
function seedDemoTickets(): void {
  const project = store.createProject({
    name: "payvia",
    type: "web_app",
    description:
      "Payments dashboard with real-time settlement views, built by an RCS squad.",
    clientName: "Payvia Inc.",
    isPublic: true,
    techStack: ["Next.js", "TypeScript", "PostgreSQL", "Redis"],
    resourceMatrix: [
      { role: "backend", skillLevel: "senior", count: 1 },
      { role: "frontend", skillLevel: "junior", count: 2 },
      { role: "devops", skillLevel: "mid", count: 1 },
    ],
  });
  const projectId = project.id;
  store.createTicket({
    title: "Build the settlement reporting dashboard",
    description: "Deliver client-ready reporting views with export support.",
    assigneeRole: "frontend",
    projectId,
  });
  store.createTicket({
    title: "Complete responsive quality assurance",
    description: "Validate the delivery portal across supported breakpoints.",
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
app.use(express.json({
  verify(req, _res, buffer) {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(requestContext);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "rcs-api" });
});
app.get("/ready", (_req, res) => {
  res.json({ ok: true, storage: "memory", otp: config.redisUrl === null ? "memory" : "redis" });
});
app.get("/metrics", (_req, res) => {
  res.type("text/plain; version=0.0.4").send(metrics());
});

app.use("/auth", authRoutes(config, store, otpStore));
app.use("/admin", adminRoutes(config, store));
app.use("/tickets", ticketRoutes(config, store));
app.use("/projects", projectRoutes(config, store));
app.use("/orders", orderRoutes(config, store));
app.use("/chat", chatRoutes(config, store));
app.use("/webhooks", webhookRoutes(config, store));

// Public, client-facing: only is_public projects, client-safe fields.
app.get("/showcase", (_req, res) => {
  res.json({ projects: store.listShowcase() });
});

app.get("/logs", requireAuth(config.jwtSecret), requireRole("admin", "pm"), (_req, res) => {
  res.json({ logs: store.listLogs() });
});

const server = createServer(app);
attachChat(server, store, config.jwtSecret);

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[rcs-api] ${signal} received; closing gracefully`);
  server.close(async (error) => {
    await otpStore.close().catch((closeError: unknown) => {
      console.error("[rcs-api] failed to close OTP store", closeError);
    });
    if (error !== undefined) {
      console.error("[rcs-api] HTTP shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

server.listen(config.port, () => {
  console.log(`[rcs-api] listening on ${config.apiBaseUrl}`);
  console.log(
    `[rcs-api] OTP store: ${config.redisUrl !== null ? "redis" : "in-memory (dev fallback, same 5-min TTL)"}`,
  );
  console.log(
    `[rcs-api] entity store: ${config.databaseUrl !== null ? "in-memory (DATABASE_URL set; adapter pending)" : "in-memory (dev fallback)"}`,
  );
  console.log(`[rcs-api] CORS origins: ${config.webOrigins.join(", ")}`);
});
